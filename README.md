# Nessie

**A plush friend that talks back.** Nessie is an open-source, AI-powered companion toy for young children: a character-driven stuffed animal that chats, plays imaginative games, remembers the people in a child's life, and will one day help kids learn to read.

Nessie is built on a few principles:

- **A friend, not a caretaker.** Nessie is warm, emotionally literate, and playful, and is grounded in child-development research. It never pretends to be human.
- **Parents stay in charge.** Parents set routines, content boundaries, and who's who, through a parent console. Every memory the agent writes is auditable.
- **Privacy by design.** Audio is transcribed on a server on the home network. Raw recordings of children never leave the house. Only text goes to cloud APIs.
- **Cheap, hackable hardware.** The target is an off-the-shelf ESP32 audio board (about $16–70) sewn into a plush. It handles wake word and voice detection on the device and streams speech to a home server.

> **Status: early prototype.** The server, agent, memory, parent console, and a browser test client work end to end on a Mac. Firmware for the plush hasn't been written yet. Expect breaking changes.

## What works today

| Area | Status | Notes |
|---|---|---|
| Conversation agent | ✅ Working | Claude via the [Vercel AI SDK](https://ai-sdk.dev). Has a character prompt, speaker-aware context, and outputs an LED color and mode alongside each spoken reply. |
| Speech-to-text | ✅ Working (Apple Silicon) | Python subprocess running [mlx-whisper](https://pypi.org/project/mlx-whisper/), on the home server. |
| Text-to-speech | ✅ Working | Pluggable providers: [ElevenLabs](https://elevenlabs.io) (cloud, expressive audio tags) or a local [Chatterbox TTS server](https://github.com/devnen/Chatterbox-TTS-Server). Chatterbox is slow on an M1 Max (6–15× slower than real time). |
| Memory | ✅ Working | People, relationships, events, and memories, stored as Markdown files. Indexed in embedded [SurrealDB](https://surrealdb.com) with local MiniLM embeddings for semantic recall. |
| Parent console | ✅ Working | A chat-based parent agent: set routines and constraints, manage profiles and people, query the audit log. |
| Safety | ✅ Basic | Input screening (PII, URLs, unsafe categories), output checks, and safe fallback replies. |
| Context | ✅ Working | Time, timezone, and weather ([Open-Meteo](https://open-meteo.com)) injected into each turn. |
| Browser test client | ✅ Working | Push-to-talk mic client and parent console at `http://localhost:3000`. |
| Speaker diarization, ambient sound | ⏳ Planned | pyannote and YAMNet are in the design, not yet built. |
| ESP32 firmware | ⏳ Planned | Board shortlist and hardware docs are done (see [Hardware](#hardware)). No firmware yet. |
| Reading companion (e-ink) | 💭 Future | |

## How it works

```
Plush (ESP32, planned)                    Home server (Bun + TypeScript)
┌──────────────────────┐                  ┌──────────────────────────────────────┐
│ mic → wake word, VAD │   speech chunk   │ POST /v1/speech                      │
│ (ESP-SR on device)   │ ───────────────▶ │  ├─ Whisper (Python, local)  → text  │
│                      │                  │  ├─ input screening                  │
│                      │                  │  ├─ Nessie agent (Claude) + tools    │
│                      │                  │  │    memory · people · events ·     │
│                      │                  │  │    weather · routines             │
│                      │                  │  ├─ output check                     │
│ speaker ◀── PCM 16k  │ ◀─────────────── │  └─ TTS (ElevenLabs | Chatterbox)    │
│ RGB LED ◀── color    │   reply + LED    │                                      │
└──────────────────────┘                  │ Parent console ── parent agent       │
   (today: browser client)                │ Data: Markdown + SurrealDB (local)   │
                                          └──────────────────────────────────────┘
```

A turn is one HTTP request. The client posts 16 kHz, 16-bit mono PCM (`audio/L16`), or a text transcript, to `POST /v1/speech`. It then polls `GET /v1/speech/:id` and fetches `GET /v1/speech/:id/response_audio` when the turn is ready.

## Quick start (macOS, Apple Silicon)

Requirements:

- [Bun](https://bun.sh) (tested with 1.4)
- [uv](https://docs.astral.sh/uv/) for the Python pipeline
- An [Anthropic API key](https://console.anthropic.com)
- A TTS provider: either an ElevenLabs API key, or a local Chatterbox server (see [docs/dev/chatterbox-local.md](docs/dev/chatterbox-local.md))

```bash
git clone https://github.com/andrhamm/nessie.git
cd nessie/pipeline && uv sync
cd ../server && bun install
```

Secrets are encrypted with [dotenvx](https://dotenvx.com):

```bash
bunx dotenvx set ANTHROPIC_API_KEY sk-ant-...
bunx dotenvx set ELEVENLABS_API_KEY ...                       # optional
bunx dotenvx set DEFAULT_TTS_PROVIDER chatterbox --plain      # if not using ElevenLabs
```

```bash
bun run serve   # http://localhost:3000 (mic client + Parent tab)
bun run chat    # text-only chat in the terminal
```

Configuration lives in [`server/src/config.ts`](server/src/config.ts). Every setting is an environment variable with a default.

## Development

```bash
cd server && bun run lint && bunx tsc --noEmit && bun run test   # Biome, types, 320 tests
cd server && bun run test:e2e                                    # Playwright (Firefox)
cd pipeline && uvx ruff check . && uv run pytest
```

Contributors follow test-driven development (failing test first). Commits are small, and TypeScript is linted with Biome and Python with Ruff. CI runs on every push and pull request ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Repository layout

| Path | What |
|---|---|
| [`server/`](server/) | Bun + TypeScript orchestrator: HTTP API, agents, memory, moderation, TTS, web client |
| [`pipeline/`](pipeline/) | Python speech-to-text service (mlx-whisper), spoken to over stdin/stdout JSON |
| [`docs/hardware/`](docs/hardware/) | Hardware knowledge base: board specs, pinouts, Nessie fit, open questions |
| [`reports/`](reports/), [`research_notes/`](research_notes/) | 2026 dev-board survey: on-device speech-to-text feasibility and ranked shortlist |
| [`docs/superpowers/`](docs/superpowers/) | Design specs and implementation plans |
| [`prototypes/`](prototypes/) | Spikes: eSpeak-NG local voice demo, SurrealDB memory proof of concept |
| [`scripts/`](scripts/) | `fetch-datasheets.sh` downloads vendor datasheets (not redistributed here) |

## Hardware

The current front-runner for the plush is Espressif's [ESP-VoCat](docs/hardware/esp-vocat.md), formerly EchoEar. It's an ESP32-S3 board with two mics, an echo-cancellation reference channel, a speaker amp, a battery charger with fuel gauge, an IMU, and touch pads. The cheaper alternative without a display is the [Waveshare ESP32-S3-AUDIO-Board](docs/hardware/waveshare-esp32-s3-audio-board.md). See the [2026 dev board survey](reports/Nessie%20dev%20board%20survey%202026.md) for the full comparison.

## Roadmap

**Next**
- [ ] ESP32 firmware: wake word ("Nessie"), VAD-segmented speech upload, PCM playback, LED control
- [ ] Faster local TTS. Chatterbox is too slow on Apple Silicon; evaluate alternatives and streaming playback.
- [ ] Wake-up alarm: parent-scheduled morning greeting plus gentle music
- [ ] Containerize the server for an always-on home box

**Later**
- [ ] Speaker diarization (pyannote) and ambient sound classification (YAMNet)
- [ ] Streaming replies (sentence-level TTS) to cut response latency
- [ ] On-device speech-to-text experiments on the ESP32 for offline use
- [ ] Plush integration: enclosure, battery life, speaker tuning

**Someday**
- [ ] E-ink reading companion
- [ ] Personality that evolves through session rollups

## Privacy and safety

Nessie is built for children, so the defaults are conservative:

- **Raw audio stays on your home server.** Only text transcripts go to Claude and ElevenLabs. Pick providers whose data terms you're comfortable with.
- **Memory stays local.** Everything is stored under `server/data/`, which is git-ignored. Every write by an agent is recorded in an audit log the parent can query.
- **Nessie isn't a monitoring device or a substitute for adult supervision.** This is a hobby prototype, not a certified children's product.

## License

[MIT](LICENSE). Vendor datasheets referenced in `docs/hardware/` belong to their publishers and are not included.
