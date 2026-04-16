# Nessie

AI-powered interactive children's companion toy. A character-driven stuffed animal friend that can chat, play imaginative games, and help kids read.

## Architecture

Nessie is a multi-component system:

- **Server** (Bun + TypeScript) — Orchestrator running in Docker on a laptop on the home network. Manages audio pipeline, agent sessions, memory, parental controls.
- **Client** (C++ / ESP-IDF or Arduino) — Runs on ESP32-P4 (Waveshare ESP32-P4-WIFI6 board). Captures audio via I2S mic, runs on-device VAD + wake word detection via ESP-SR, streams pre-segmented speech chunks to server over WiFi 6 WebSocket. Drives RGB LED, plays TTS audio via speaker.
- **Display** (future phase) — E-ink display client for reading companion features.

### Client On-Device Processing (ESP32-P4)

The ESP32-P4 has hardware VAD and ESP-SR support, enabling it to act as a smart client:
- **Hardware VAD** — detects speech with near-zero CPU overhead
- **WakeNet** — "Nessie" wake word detection (up to 5 wake words)
- **VADNet** — speech boundary detection for segmenting audio turns
- **Keyword spotting** — interrupt commands ("stop", "quiet")

The client sends **discrete, pre-segmented speech chunks with metadata** (timestamp, duration, speaker turn boundaries) rather than a continuous raw audio stream.

### Server Layers

1. **Audio Pipeline** (Python services) — Whisper transcription, pyannote speaker diarization, YAMNet ambient sound classification. Runs as subprocess services called by the TS orchestrator. Receives pre-segmented speech chunks from client, not raw continuous audio.
2. **Agent Orchestrator** (TypeScript) — Manages Claude sessions via Vercel AI SDK (`ai` + `@ai-sdk/anthropic`). Exposes tools to the agent: `speak`, `set_led_color`, `set_screen_content`. Handles event queue with priority interrupts.
3. **Memory Layer** (TypeScript) — Async session rollups, speaker profiles, personality evolution. Local SQLite via `bun:sqlite`.
4. **Governance Layer** (TypeScript) — Parental controls, content boundaries, bedtime schedules, educational goals. Injects/modifies system prompts.
5. **TTS Service** (TypeScript) — ElevenLabs API integration for character voice with emotional audio tags.

### Data Flow

```
ESP32-P4 Client                              Server (Docker/Laptop)
┌─────────────────────┐                      ┌──────────────────────────┐
│ I2S Mic → PCM       │                      │                          │
│ Hardware VAD         │                      │                          │
│ ESP-SR WakeNet      │                      │                          │
│ Speech segmentation │                      │                          │
│                     │                      │  Receive speech chunks   │
│ Pre-segmented chunk │──[WebSocket/WiFi6]──→│  + metadata              │
│ + metadata          │                      │       │                  │
│                     │                      │  Python Pipeline         │
│                     │                      │  (Whisper + pyannote     │
│                     │                      │   + YAMNet)              │
│                     │                      │       │                  │
│                     │                      │  Vercel AI SDK → Claude  │
│                     │                      │       │                  │
│ LED commands     ◄──│←─[WebSocket]─────────│  Tool calls              │
│ TTS audio        ◄──│                      │  (speak → ElevenLabs)    │
│ Device events    ◄──│                      │  (set_led, set_screen)   │
└─────────────────────┘                      └──────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Server runtime | Bun |
| Server language | TypeScript |
| Audio ML pipeline | Python (faster-whisper or whisper.cpp, pyannote.audio v4.0.4, YAMNet) |
| LLM integration | Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) |
| TTS | ElevenLabs API (`elevenlabs` npm package) — Flash v2.5 ~75ms latency |
| Database | SQLite via `bun:sqlite` |
| WebSocket | Bun native WebSocket server |
| Firmware | C++ / ESP-IDF or Arduino (PlatformIO) |
| Firmware board | Waveshare ESP32-P4-WIFI6 (primary), XIAO ESP32-S3 Sense (secondary/wearable) |
| Container | Docker |
| Testing | Bun test (server), pytest (Python pipeline) |
| Linting | Biome (TypeScript), Ruff (Python) |

## Project Structure

```
nessie/
├── CLAUDE.md
├── server/              # Bun + TypeScript orchestrator
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── pipeline/            # Python audio processing services
│   ├── src/
│   └── pyproject.toml
├── firmware/            # ESP32-P4 / ESP-IDF or PlatformIO
│   ├── src/
│   └── platformio.ini
├── docker/              # Docker configuration
│   └── Dockerfile
└── docs/
    ├── hardware/        # Hardware knowledge base (see below)
    │   ├── datasheets/  # Source PDFs + parsed text/JSON
    │   ├── esp32-p4.md
    │   └── xiao-esp32-s3-sense.md
    └── superpowers/
        └── plans/
```

## Hard Rules

### Citation Requirement

**Every hardware, firmware, and electronics claim must be backed by recent web search sources.** Do not rely on training data for:
- Board compatibility and specifications
- Library/SDK compatibility with specific hardware
- Pin configurations and wiring
- Protocol support and limitations
- Pricing for external services

When making any hardware or electronics recommendation:
1. Search the web for current documentation
2. Include source URLs in your response
3. Flag when information could not be verified
4. Prefer official documentation and recent forum posts over training data

### Hardware Documentation Requirement

All hardware components under evaluation or in use **must** have:
1. **Source datasheets** saved to `docs/hardware/datasheets/` (PDF originals)
2. **Parsed versions** alongside the PDFs (use `liteparse` / `lit` CLI to parse PDFs to text and JSON)
3. **A wiki-style markdown doc** in `docs/hardware/` with specs, citations, source URLs, and Nessie relevance assessment
4. **Unverified items** explicitly flagged with checkboxes

Use `qmd` to search the hardware knowledge base when answering hardware questions.

### Privacy

- Audio is transcribed locally on the server. Raw audio of children never leaves the home network.
- Only text transcripts are sent to external APIs (Claude, ElevenLabs).

### Development Standards

- TDD: Write failing tests first, then implement.
- Small commits with clear messages.
- DRY, YAGNI — no speculative abstractions.
- Biome for TypeScript linting/formatting, Ruff for Python.
- All Python audio services communicate with the TS orchestrator via well-defined interfaces (stdin/stdout JSON or local HTTP).

## Tooling & Workflows

### Document Parsing — liteparse

Use `lit` CLI (`@llamaindex/liteparse`) to parse PDFs and other documents locally:

```bash
# Parse PDF to text
lit parse document.pdf --no-ocr --format text -o output.txt

# Parse PDF to structured JSON (with bounding boxes)
lit parse document.pdf --no-ocr --format json -o output.json

# Parse specific pages
lit parse document.pdf --target-pages "1-10" --format text -o output.txt
```

Always save both source PDFs and parsed outputs. Prefer parsed text for knowledge base references.

### Knowledge Base Search — qmd

Use `qmd` to create searchable collections from the hardware docs and other markdown knowledge bases:

```bash
# Create a collection from hardware docs
qmd create hardware-docs docs/hardware/ --pattern "**/*.md"

# Search the collection
qmd search hardware-docs "I2S microphone configuration"

# Embed for semantic search
qmd embed
```

### Web Research

Use `WebSearch` tool for all hardware/electronics research. Never rely on training data alone for hardware claims.

## Key References

### Software
- [Bun WebSocket docs](https://bun.com/docs/runtime/http/websockets)
- [Vercel AI SDK Anthropic provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)
- [pyannote.audio](https://github.com/pyannote/pyannote-audio) — v4.0.4 (Feb 2026)
- [ElevenLabs API pricing](https://elevenlabs.io/pricing/api) — Flash v2.5 ~75ms latency, $0.06/1k chars
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript)

### Hardware
- [ESP32-P4 Espressif product page](https://www.espressif.com/en/products/socs/esp32-p4)
- [ESP32-P4 Datasheet v1.0](https://documentation.espressif.com/esp32-p4-chip-revision-v1.3_datasheet_en.pdf)
- [ESP-SR on ESP32-P4](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/getting_started/readme.html)
- [ESP-SR GitHub](https://github.com/espressif/esp-sr)
- [Waveshare ESP32-P4-WIFI6](https://www.waveshare.com/esp32-p4-wifi6.htm)
- [XIAO ESP32-S3 Sense mic usage](https://wiki.seeedstudio.com/xiao_esp32s3_sense_mic/)
- [XIAO ESP32-S3 WebSocket audio streaming example](https://github.com/fabio-garavini/Xiao_Sense_CameraWebServer_Audio)

### Hardware Knowledge Base
- [ESP32-P4 hardware doc](docs/hardware/esp32-p4.md) — full specs, ESP-SR support, Waveshare board details
- [XIAO ESP32-S3 Sense hardware doc](docs/hardware/xiao-esp32-s3-sense.md) — full specs, mic details, comparison
