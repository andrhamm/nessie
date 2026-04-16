# Nessie Project Roadmap

## Vision

An AI-powered interactive children's companion toy. A character on an ESP32-P4 board that listens to kids, responds in character via a Claude agent, and grows its personality over time.

## Guiding Principles

1. **Each iteration produces something testable.** No iteration is "set up infrastructure." Every one ends with a demo you can show.
2. **Prove one new integration point per iteration.** Don't combine unknowns.
3. **Start simple, layer complexity.** Push-to-talk before VAD. Text responses before TTS. In-memory state before SQLite.
4. **Don't build what the SDK provides.** Use Vercel AI SDK's built-in agent loop, tool execution, and multi-step handling. Use Claude's prompt caching. Only build what's custom to Nessie.

## Agent Architecture Decisions

### Vercel AI SDK Capabilities We Use (Not Build)

Based on research of [AI SDK 6](https://vercel.com/blog/ai-sdk-6) and the [Anthropic provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic):

| Capability | SDK Feature | What we build |
|-----------|------------|---------------|
| Agent loop + tool execution | `ToolLoopAgent` class, automatic multi-step tool calling | Nothing — use as-is |
| Tool definitions | `tool()` with Zod schemas, typed execute functions | Define Nessie-specific tools (set_led, speak, recall_memory) |
| Streaming responses | `agent.stream()` with `textStream` | Wire to WebSocket |
| Structured output | `Output.object()` with Zod schema | Use for typed tool responses |
| Conversation history | `messages` array passed to `generate()`/`stream()` | We manage the message array (append, truncate, summarize) |
| Token tracking | `onStepFinish` callback with `usage` | Log costs per session |
| Prompt caching | Anthropic provider passes cache_control automatically | Structure system prompt for cache-friendliness (static character prompt first, dynamic context after) |

### What We Build Ourselves

| Capability | Why not SDK | Our approach |
|-----------|------------|-------------|
| **Session state** | SDK doesn't persist messages | In-memory Map<deviceId, messages[]> initially, SQLite later |
| **Memory / recall** | SDK has no built-in memory | Agent tools: `recall_memory(query)` reads from SQLite. `save_memory(content)` writes. Agent decides when to use them. |
| **Personality adaptation** | SDK has no concept of user profiles | Dynamic system prompt injection. Base character prompt is static (cacheable). Per-speaker context appended before each call (name, age, preferences, recent memories). |
| **Session summaries** | SDK doesn't auto-summarize | After session ends, make a separate Claude call to summarize the conversation. Store summary in SQLite. |
| **Context window management** | SDK doesn't truncate/compress | Sliding window on messages array. When approaching token limit, summarize oldest messages and replace with summary. |

### System Prompt Structure (Cache-Friendly)

```
┌─────────────────────────────────────────────────┐
│ STATIC (cached — rarely changes)                │
│                                                 │
│ Character definition: personality, voice, rules │
│ Tool descriptions and usage guidance            │
│ Safety boundaries                               │
│                                                 │
│ cache_control breakpoint ─────────────────────  │
├─────────────────────────────────────────────────┤
│ SEMI-STATIC (cached per session)                │
│                                                 │
│ Active speakers: names, ages, preferences       │
│ Relevant memories from past sessions            │
│ Current parental controls / goals               │
│                                                 │
│ cache_control breakpoint ─────────────────────  │
├─────────────────────────────────────────────────┤
│ DYNAMIC (never cached)                          │
│                                                 │
│ Conversation history (messages array)           │
│ Current ambient sounds                          │
│ Latest user message                             │
└─────────────────────────────────────────────────┘
```

The static block is the same across all sessions and all children. Cache hit rate should be very high. At Haiku 4.5 pricing ($1/$5 per 1M tokens, cache reads at 10%), the character prompt is essentially free after the first call.

Sources: [Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [Vercel AI SDK Anthropic provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)

### Model Choice

**Claude Haiku 4.5** for all character interactions:
- $1/M input, $5/M output tokens
- 200K context window
- Fast enough for conversational latency
- Prompt cache reads at $0.10/M tokens (90% savings)
- Tool use supported, streaming supported

Source: [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing)

## Iteration Roadmap

### Phase: Board Bringup

#### fw-toolchain
**ESP-IDF project scaffolds, builds, flashes to board. Serial prints "Hello Nessie".**

Proves: Dev environment works, board is alive.

#### fw-i2c-codec
**ES8311 initializes over I2C (GPIO7/8, addr 0x18). PA_CTRL GPIO set HIGH. Codec register read confirms detection.**

Proves: I2C bus works, ES8311 driver loads, PA control.

#### fw-mic
**I2S RX configured (GPIO9=DSDIN). Read PCM from mic into buffer. Print amplitude to serial (VU meter).**

Proves: I2S RX works, mic captures audio.

#### fw-speaker
**I2S TX configured (GPIO11=ASDOUT). Play sine wave or tone through speaker.**

Proves: I2S TX, DAC path, PA, speaker output.

#### fw-loopback
**Full-duplex I2S. Mic audio loops back to speaker in real-time.**

Proves: Full-duplex audio chain, hardware verified end-to-end.

#### fw-button-record
**Button GPIO configured. Press → record PCM to PSRAM buffer. Release → stop. LED on during recording.**

Proves: Bounded capture, PSRAM allocation, GPIO input.

#### fw-wifi
**Board connects to WiFi on boot via ESP32-C6. Logs IP address to serial.**

Proves: WiFi stack works through companion chip.

### Phase: First Audio Transfer

#### fw-http-upload
**On button release, POST raw PCM as binary body to `http://<laptop>:3000/audio`. Log HTTP response status.**

Proves: HTTP client on board, network audio transfer.

#### srv-http-receive
**Bun server listens on :3000. `POST /audio` receives binary body, saves as WAV file to disk, responds 200 with `{ status: "ok" }`.**

Proves: Bun HTTP server, binary body parsing, WAV file encoding.

### Phase: Transcription Pipeline

#### srv-python-ipc
**Bun spawns long-running Python process on startup. Sends JSON on stdin, reads JSON on stdout. Implement ping/pong health check.**

Proves: TS↔Python subprocess IPC protocol works.

#### srv-whisper
**Python process loads Whisper model on startup. Accepts `{ type: "transcribe", pcm: "<base64>" }` on stdin. Returns `{ type: "transcript", text: "..." }` on stdout.**

Proves: Whisper runs locally, transcribes audio.

#### srv-transcribe-endpoint
**`POST /audio` handler pipes received PCM to Python subprocess for transcription. Returns `{ transcript: "hello world" }` as HTTP response.**

Proves: Full pipeline: board→upload→transcribe→response.

#### fw-log-transcript
**Board reads transcript from HTTP response body. Logs it to serial: `Nessie heard: "hello world"`.**

Proves: End-to-end button→record→upload→transcribe→display. First complete vertical slice.

### Phase: Character Agent

#### srv-claude-basic
**New function: takes text input, sends to Claude Haiku via Vercel AI SDK `generateText()` with hardcoded system prompt, returns text response. Test with a simple script or curl-like call.**

Proves: Vercel AI SDK + Anthropic provider integration works.

#### srv-character-prompt
**Design and iterate on Nessie's character system prompt. Test with multiple inputs — verify personality, tone, safety boundaries, age-appropriateness. Pure prompt engineering, no code changes.**

Proves: Character design is right before wiring it in.

#### srv-audio-to-character
**Wire together: `/audio` → transcribe → Claude character → return response. HTTP response now includes `{ transcript: "...", response: "..." }`. Board logs both.**

Proves: First time Nessie "thinks" and responds to speech. Major milestone.

#### srv-multi-turn
**Server maintains conversation history as in-memory `Map<deviceId, CoreMessage[]>`. Board sends device ID header. Multiple button presses build a conversation. Claude sees full history.**

Proves: Multi-turn context management. Character remembers what was said 30 seconds ago.

### Phase: Event Queue

#### srv-event-types
**Define TypeScript types for event system: `SpeechEvent`, `InterruptEvent`, `BackgroundEvent`. Define `NessieEvent` union type and priority enum.**

Proves: Type foundation for queue exists.

#### srv-event-queue
**Implement sequential event queue. `/audio` handler enqueues a `SpeechEvent`. Queue processes events one at a time through the pipeline (transcribe → agent). Response returned to HTTP caller via callback.**

Proves: Pipeline decoupled from transport. Queue abstraction works.

#### srv-priority-events
**Queue supports priority tiers. `InterruptEvent` can flush pending `SpeechEvent`s. Test with injected interrupt events.**

Proves: Priority queue works. Foundation for "stop" commands, device shutdown.

### Phase: Agent Tools

#### srv-tool-framework
**Claude agent gets tool definitions via Vercel AI SDK `tool()` + Zod schemas. Start with `set_led_color({ color: string })`. Agent configured with `ToolLoopAgent`. Test: ask "turn the light red" → tool call returned.**

Proves: Tool use works with Vercel AI SDK agent loop.

#### srv-tool-response-format
**HTTP response format extended to include tool call results: `{ transcript, response, commands: [{ type: "set_led", color: "#FF0000" }] }`. Commands extracted from agent tool calls.**

Proves: Tool results serialized for board consumption.

#### fw-parse-commands
**Board parses `commands` array from HTTP response. Executes `set_led` by driving RGB LED GPIO. Logs executed commands to serial.**

Proves: End-to-end tool execution: speech → agent → tool call → hardware action.

### Phase: WebSocket

#### srv-websocket
**Add Bun WebSocket endpoint at `/ws`. Board connects on boot. Same functionality as HTTP — board sends binary audio message, server responds with JSON (transcript + response + commands).**

Proves: WebSocket connection works. Foundation for bidirectional communication.

#### fw-websocket-client
**Board switches from HTTP POST to WebSocket. Sends audio on button release. Receives and parses JSON response. Drives LED from commands.**

Proves: Board↔server persistent connection.

#### srv-server-push
**Server can push messages to board unprompted (LED commands, status). Board handles incoming messages in a receive loop independent of send.**

Proves: Server→client push. Required for future TTS audio streaming and VAD.

### Phase: On-Device Intelligence

#### fw-esp-sr-init
**ESP-SR AFE initializes with `"M"` format (single mic, no AEC). VAD detects speech frames. Log VAD state transitions (silence→speech, speech→silence) to serial.**

Proves: ESP-SR runs on P4, VAD works.

#### fw-auto-segment
**VAD segments speech turns. On speech→silence transition, buffered segment sent over WebSocket. Button removed from user flow (kept as fallback).**

Proves: Hands-free speech segmentation. No button needed.

#### fw-wake-word
**WakeNet enabled with built-in "Hi ESP" wake word. Board only sends speech segments after wake word detected. LED indicates wake state.**

Proves: Wake word detection. Board ignores ambient noise until addressed.

### Phase: Multi-User

#### srv-pyannote
**Python pipeline adds pyannote speaker diarization. Each transcript includes a speaker label (SPEAKER_0, SPEAKER_1). Agent sees who's talking.**

Proves: Speaker identification works.

#### srv-speaker-profiles
**Server stores voice embeddings keyed by speaker label. Labels stabilize across segments within a session. Parent API endpoint to name speakers: `PUT /speakers/SPEAKER_0 { name: "Alex" }`.**

Proves: Persistent speaker identity. Agent can address kids by name.

### Phase: Memory & Personality

#### srv-sqlite-schema
**SQLite database (bun:sqlite) with tables: `sessions`, `speakers`, `memories`. Basic insert/query. Schema migration on startup.**

Proves: Persistence layer exists.

#### srv-memory-tools
**Agent gets tools: `recall_memory({ query })` searches memories table. `save_memory({ content, speaker? })` inserts. Agent decides when to save/recall. Test: tell Nessie "I love dinosaurs" → later ask "what do I like?" → Nessie recalls.**

Proves: Agent-driven memory. Character remembers across sessions.

#### srv-session-summary
**After session ends (WebSocket disconnect or timeout), server makes a separate Claude call to summarize the conversation. Summary stored in `sessions` table with speaker participation.**

Proves: Async session rollup. Long-term memory compression.

#### srv-personality-adaptation
**System prompt dynamically includes per-speaker context: name, age (if known), preferences, recent memories. Character adapts behavior — plays differently with a 4-year-old vs an 8-year-old. Test with two mock speaker profiles.**

Proves: Personality evolves per child. Core character experience.

### Phase: Voice

#### srv-elevenlabs
**`speak` tool defined. When Claude calls `speak({ text, emotion? })`, server sends to ElevenLabs Flash v2.5. Returns PCM audio. Test with curl — save and play WAV locally.**

Proves: TTS API integration, voice character works.

#### srv-audio-to-board
**Server sends TTS PCM audio over WebSocket as binary message. Board receives, buffers, plays through speaker via I2S TX.**

Proves: Server→board audio playback.

#### fw-voice-loop
**Complete voice conversation: wake/button → record → transcribe → Claude → speak → TTS → audio back → speaker. Full end-to-end.**

Proves: The toy works as designed (minus AEC).

### Phase: Polish

#### fw-aec
**Switch AFE to `"MR"` format. Software loopback: copy I2S TX data as reference channel in feed buffer. Kids can talk while Nessie is speaking.**

Proves: Echo cancellation. Full-duplex interaction.

#### srv-ambient-sounds
**YAMNet classification added to Python pipeline. Run periodically on audio between speech segments. Agent sees `{ ambient: ["laughing", "running"] }` in context.**

Proves: Environmental awareness. Character reacts to play sounds.

#### fw-custom-wake-word
**Train custom "Nessie" wake word for WakeNet. Replace "Hi ESP" built-in.**

Proves: Brand identity. Kids say "Nessie" not "Hi ESP".

#### srv-parent-dashboard
**Simple web UI served by Bun. View live transcripts, name speakers, set content boundaries, toggle on/off. Basic HTML + vanilla JS or minimal framework.**

Proves: Parental governance layer.

## Milestone Map

```
fw-toolchain → fw-i2c-codec → fw-mic → fw-speaker → fw-loopback
    → fw-button-record → fw-wifi → fw-http-upload
        → srv-http-receive → srv-python-ipc → srv-whisper
            → srv-transcribe-endpoint → fw-log-transcript
                ╔══════════════════════════════════════╗
                ║  MILESTONE: "I hear you"             ║
                ║  Button → Record → Transcribe → Log  ║
                ╚══════════════════════════════════════╝
            → srv-claude-basic → srv-character-prompt
                → srv-audio-to-character
                    ╔══════════════════════════════════╗
                    ║  MILESTONE: "Nessie speaks"      ║
                    ║  Button → Record → Transcribe    ║
                    ║  → Claude → Character response   ║
                    ╚══════════════════════════════════╝
                → srv-multi-turn → srv-event-types
                    → srv-event-queue → srv-priority-events
                → srv-tool-framework → srv-tool-response-format
                    → fw-parse-commands
                        ╔══════════════════════════════╗
                        ║  MILESTONE: "Nessie acts"    ║
                        ║  Character controls LED      ║
                        ╚══════════════════════════════╝
                → srv-websocket → fw-websocket-client
                    → srv-server-push
                → fw-esp-sr-init → fw-auto-segment → fw-wake-word
                        ╔══════════════════════════════╗
                        ║  MILESTONE: "Hey Nessie"     ║
                        ║  Hands-free, wake word       ║
                        ╚══════════════════════════════╝
                → srv-pyannote → srv-speaker-profiles
                → srv-sqlite-schema → srv-memory-tools
                    → srv-session-summary → srv-personality-adaptation
                        ╔══════════════════════════════╗
                        ║  MILESTONE: "Nessie knows me"║
                        ║  Remembers kids, adapts      ║
                        ╚══════════════════════════════╝
                → srv-elevenlabs → srv-audio-to-board → fw-voice-loop
                        ╔══════════════════════════════╗
                        ║  MILESTONE: "Nessie talks"   ║
                        ║  Full voice conversation     ║
                        ╚══════════════════════════════╝
                → fw-aec → srv-ambient-sounds
                    → fw-custom-wake-word → srv-parent-dashboard
                        ╔══════════════════════════════╗
                        ║  MILESTONE: "Nessie v1"      ║
                        ║  Complete experience         ║
                        ╚══════════════════════════════╝
```

## References

- [Vercel AI SDK 6 — Agent class](https://vercel.com/blog/ai-sdk-6)
- [Vercel AI SDK — Building Agents](https://ai-sdk.dev/docs/agents/building-agents)
- [Vercel AI SDK — Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Vercel AI SDK — Anthropic Provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)
- [Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Claude Haiku 4.5 Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Audio Architecture Doc](../hardware/audio-architecture.md)
- [ESP32-P4 Hardware Doc](../hardware/esp32-p4.md)
