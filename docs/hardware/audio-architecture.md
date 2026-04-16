# Nessie Audio Architecture

## Overview

The audio system spans two devices: the **ESP32-P4 client** (on-device processing) and the **laptop server** (ML pipeline + agent). This document maps the complete signal path from microphone to Claude and back to speaker.

## Signal Chain

```
┌─────────────────── ESP32-P4 Client ───────────────────┐
│                                                        │
│  Mic (analog)                                          │
│    │                                                   │
│    ▼                                                   │
│  ES8311 ADC (16kHz, 16-bit)                            │
│    │                                                   │
│    ▼ I2S RX (GPIO9 = DSDIN)                            │
│                                                        │
│  ┌──────────────────────────────────┐                  │
│  │ ESP-SR AFE Pipeline              │                  │
│  │                                  │                  │
│  │  Input: "MR" format              │                  │
│  │  (1 mic + 1 playback reference)  │                  │
│  │                                  │                  │
│  │  ┌─────┐  ┌────┐  ┌─────┐       │                  │
│  │  │ AEC │→ │ NS │→ │ VAD │       │                  │
│  │  └─────┘  └────┘  └─────┘       │                  │
│  │              │         │         │                  │
│  │              ▼         ▼         │                  │
│  │         Clean PCM   Speech?      │                  │
│  │              │      yes/no       │                  │
│  │              ▼                   │                  │
│  │         ┌─────────┐             │                  │
│  │         │ WakeNet │             │                  │
│  │         │"Nessie" │             │                  │
│  │         └─────────┘             │                  │
│  └──────────────────────────────────┘                  │
│                 │                                      │
│    ┌────────────┼────────────┐                         │
│    ▼            ▼            ▼                         │
│  VAD=speech  Wake detected  VAD=silence                │
│  Buffer PCM  WAKE event     End of turn →              │
│              + LED feedback  Send buffered segment     │
│                                                        │
│  ──── WebSocket TX ────────────────────────────────▶   │
│  { type: "speech", pcm: <bytes>,                       │
│    duration_ms, vad_confidence, wake: bool }            │
│                                                        │
│  ◀──── WebSocket RX ──────────────────────────────    │
│  { type: "audio", pcm: <bytes> }  (TTS playback)      │
│  { type: "led", color: "#FF0000" }                     │
│  { type: "stop" }                                      │
│                                                        │
│    ▼                                                   │
│  ES8311 DAC → NS4150B PA → Speaker                     │
│    │                                                   │
│    └──→ I2S TX (GPIO11 = ASDOUT)                       │
│         Also feeds back to AFE as reference channel     │
│         for AEC (the "R" in "MR")                      │
└────────────────────────────────────────────────────────┘

                        │ WiFi 6 │
                        ▼        ▲

┌─────────────────── Laptop Server ─────────────────────┐
│                                                        │
│  Bun WebSocket Server                                  │
│    │                                                   │
│    ▼                                                   │
│  Event Queue (priority-based)                          │
│    │                                                   │
│    ├─ INTERRUPT: "stop" keyword, device off             │
│    ├─ SPEECH: pre-segmented audio chunk                 │
│    └─ BACKGROUND: memory rollups, profile updates       │
│                                                        │
│    ▼                                                   │
│  Python Pipeline (subprocess, stdin/stdout JSONL)       │
│    │                                                   │
│    ├──→ Whisper (transcription)                         │
│    ├──→ pyannote (speaker diarization)                  │
│    └──→ YAMNet (ambient sound, periodic)                │
│    │                                                   │
│    ▼                                                   │
│  { speaker: "SPEAKER_0", text: "let's play",           │
│    ambient: ["laughing"], timestamp: ... }              │
│    │                                                   │
│    ▼                                                   │
│  Claude Agent (Vercel AI SDK)                           │
│    │                                                   │
│    ▼                                                   │
│  Tool calls: speak(), set_led(), ...                    │
│    │                                                   │
│    ▼                                                   │
│  ElevenLabs TTS → PCM audio                            │
│    │                                                   │
│    ▼                                                   │
│  WebSocket → back to ESP32-P4                           │
└────────────────────────────────────────────────────────┘
```

## ESP32-P4 Audio Hardware

### I2S Pin Mapping

| Signal | GPIO | Direction | Connected To |
|--------|------|-----------|-------------|
| I2S_MCLK | GPIO13 | Out | ES8311 MCLK |
| I2S_SCLK (BCLK) | GPIO12 | Out | ES8311 SCLK |
| I2S_ASDOUT | GPIO11 | Out | ES8311 DSDIN (playback data) |
| I2S_LRCK (WS) | GPIO10 | Out | ES8311 LRCK |
| I2S_DSDIN | GPIO9 | In | ES8311 ASDOUT (recording data) |

Source: [Waveshare schematic](datasheets/waveshare-esp32-p4-wifi6-datasheet.pdf)

### I2C Control

| Signal | GPIO |
|--------|------|
| SDA | GPIO7 |
| SCL | GPIO8 |

ES8311 I2C address: `0x18`

### I2S Full-Duplex Mode

The ESP32-P4 supports full-duplex I2S — simultaneous TX (playback) and RX (recording) on the same I2S controller with shared BCLK and WS. This is essential for:
1. Playing TTS audio while keeping the mic active
2. Providing the playback reference signal to ESP-SR's AEC algorithm

Configuration: allocate both TX and RX handles in a single `i2s_new_channel()` call. They automatically share clock signals.

Source: [ESP-IDF I2S docs (ESP32-P4)](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/peripherals/i2s.html)

### Audio Codec: ES8311

- 24-bit ADC: 100dB SNR, 8-96 kHz
- 24-bit DAC: 110dB SNR, 8-96 kHz
- I2S/PCM interface (master or slave mode)
- I2C configuration interface (up to 400 kbps)
- Mono codec — one mic input (differential MIC_P/MIC_N), one output (OUTP/OUTN)
- Can route playback signal internally as feedback channel for AEC

Source: [ES8311 User Guide](datasheets/es8311-user-guide.pdf), [Espressif ES8311 component](https://components.espressif.com/components/espressif/es8311)

### Power Amplifier: NS4150B

- 3W mono Class D
- 3.0-5.0V operating voltage
- 88% efficiency, filterless
- **PA_CTRL pin must be set HIGH to enable speaker output**

Source: [NS4150B datasheet](https://datasheet4u.com/datasheets/Nsiway/NS4150B/1544751), [ESP-IDF ES8311 example README](https://github.com/espressif/esp-idf/blob/master/examples/peripherals/i2s/i2s_codec/i2s_es8311/README.md)

## ESP-SR Audio Front-End (AFE)

### Configuration for Nessie

```c
// Single mic + playback reference for AEC
afe_config_t *afe_config = afe_config_init(
    "MR",                    // M=mic, R=playback reference
    models,
    AFE_TYPE_SR,             // Speech recognition mode
    AFE_MODE_HIGH_PERF       // High performance mode
);
```

The `"MR"` input format means:
- Channel 0: Microphone (from ES8311 ADC via I2S RX)
- Channel 1: Playback reference (from I2S TX data, looped back in software)
- Data must be 16-bit signed, 16 kHz, channel-interleaved

Source: [ESP-SR AFE docs (ESP32-P4)](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/audio_front_end/README.html)

### AFE Pipeline Output

Each call to `afe_handle->fetch()` returns:
- `result->data` — cleaned single-channel PCM audio (AEC + NS applied)
- `result->vad_state` — real-time voice activity state per frame
- `result->wakeup_state` — wake word detection state

### Resource Usage (ESP32-P4)

| Component | Internal RAM | PSRAM | CPU (single core) |
|-----------|-------------|-------|------------------|
| AFE (MR, SR, HIGH_PERF) | ~73-117 KB | ~733-1173 KB | Feed: 10-42%, Fetch: 6-25% |
| WakeNet9 (2-ch) | 16 KB | 324 KB | 2.6 ms/frame (32ms frames) |
| WakeNet9 (3-ch) | 20 KB | 347 KB | 3.1 ms/frame |
| MultiNet7 | 18 KB | 2920 KB | 8 ms/frame |
| TTS (Chinese only) | 20 KB runtime | — | 1.8-4.5x realtime |

Source: [ESP-SR Benchmarks (ESP32-P4)](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/benchmark/README.html)

### WakeNet Performance

- Detection rate: 94-98% at 1-3m distance
- False trigger rate: ~once per 12 hours
- Frame length: 32 ms
- Supports up to 5 simultaneous wake words

Source: [ESP-SR Benchmarks](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/benchmark/README.html)

### Memory Budget

With `"MR"` config + WakeNet9 + AFE (HIGH_PERF):
- Internal RAM: ~90 KB (of 768 KB L2MEM available)
- PSRAM: ~1100 KB (of 32 MB available)
- Leaves ample headroom for WiFi stack, WebSocket buffers, and application logic

## AEC Reference Signal — Deep Dive

### The Problem

AEC needs a **reference signal** — the exact audio being played through the speaker — so it can subtract speaker echo from the mic input. Without this, when Nessie speaks, the mic picks up the speaker output, and the system hears itself talking.

### Three Approaches (and their trade-offs)

#### Approach 1: Hardware Reference via Separate ADC (ES7210)

This is Espressif's **recommended** approach, used on their reference boards (ESP32-S3-Korvo-2, ESP-BOX-3):

```
ES8311 DAC → OUTP/OUTN → NS4150B PA → Speaker
                    └──→ ES7210 ADC (captures reference) → I2S → ESP32
ES8311 ADC ← Mic ──────────────────────────────────────→ I2S → ESP32
```

The ES7210 is a 4-channel ADC (~$1) that captures the analog signal going to the speaker. This gives the cleanest reference because it captures what the speaker actually plays, including amplifier distortion.

**Problem for Nessie:** The Waveshare ESP32-P4-WIFI6 board does NOT have an ES7210. It only has the ES8311.

Sources: [ESP32-S3-Korvo-2 design](https://docs.espressif.com/projects/esp-adf/en/latest/design-guide/dev-boards/user-guide-esp32-s3-korvo-2.html), [xiaozhi-esp32 audio codecs](https://deepwiki.com/zhubinsheng/xiaozhi-esp32/5.4-audio-codecs)

#### Approach 2: ES8311 Internal Feedback Channel

The ES8311 User Guide Section 10.4 describes routing the DAC output back through the ADC as a feedback channel. In theory, the left I2S channel carries the feedback signal and the right carries the mic.

**This does not work in practice.** A developer reported in [esp-adf#1552](https://github.com/espressif/esp-adf/issues/1552) that the feedback channel produces no audio on single-channel boards. The issue remains open with no resolution from Espressif as of the report date (Nov 2025).

Source: [esp-adf#1552](https://github.com/espressif/esp-adf/issues/1552)

#### Approach 3: Software Loopback

The ESP32-P4 copies the PCM data it sends to I2S TX and manually interleaves it as the "R" channel when calling `afe_handle->feed()`.

```c
// Software loopback: interleave mic + playback reference
for (int i = 0; i < frame_size; i++) {
    feed_buff[i * 2 + 0] = mic_data[i];      // M channel
    feed_buff[i * 2 + 1] = playback_data[i];  // R channel (loopback)
}
afe_handle->feed(afe_data, feed_buff);
```

This is confirmed working in the ESP-SR test suite ([test_afe.cpp](https://github.com/espressif/esp-sr/blob/master/test_apps/esp-sr/main/test_afe.cpp)).

**Trade-offs:**
- The reference signal is the digital PCM before the DAC and amplifier, not the actual analog signal going to the speaker. It doesn't capture DAC distortion, amplifier nonlinearity, or speaker response.
- AEC timing: the recording signal must be delayed 0-10ms relative to the reference. With software loopback, this delay is deterministic (I2S DMA buffer latency), so it's manageable.
- This approach is called "software AEC" in Espressif's terminology.

Sources: [ESP-SR AFE docs](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/audio_front_end/README.html), [ESP-SR test_afe.cpp](https://github.com/espressif/esp-sr/blob/master/test_apps/esp-sr/main/test_afe.cpp)

#### Approach 4: No AEC — Use `"M"` Format

Skip AEC entirely. Use `"M"` input format (single mic, no reference). ESP-SR still provides NS, VAD, and WakeNet.

**Trade-offs:**
- Simplest implementation
- When Nessie speaks through the speaker, the mic hears it. WakeNet and VAD could false-trigger on Nessie's own voice.
- Mitigation: mute the mic during TTS playback (half-duplex). The character can't hear kids while speaking. Acceptable for a toy? Maybe — but it feels less alive.

### Recommendation for Nessie

**Start with Approach 3 (software loopback, `"MR"` format)** for these reasons:

1. It's confirmed working in ESP-SR's own test suite
2. The Waveshare board lacks an ES7210, ruling out Approach 1 without hardware modification
3. ES8311 hardware feedback (Approach 2) is broken
4. No-AEC (Approach 4) limits interactivity — kids couldn't interrupt Nessie mid-speech

**If software AEC quality is insufficient**, two escalation paths:
- **Hardware mod:** Add an ES7210 breakout board (~$1-5) wired to a second I2S controller on the ESP32-P4 (it has 3). Capture the analog reference from the PA output.
- **Server-side AEC:** Send the raw audio (with echo) to the server. The server already knows what audio it sent for playback, so it can do AEC in Python (e.g., SpeexDSP, webrtcvad) before feeding Whisper. More latency, but separates the problem from the embedded side.

### AEC Timing Constraint

The ESP-SR AFE requires the recording signal to be delayed by **0-10ms** relative to the reference signal. With software loopback:
- I2S DMA introduces a fixed, deterministic delay
- The `debug_input` config flag can be set to `true` to log timing for calibration
- `algo_stream_set_delay()` can fine-tune the alignment

Source: [ESP-SR AFE docs](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/audio_front_end/README.html)

## Client → Server Protocol

### Speech Segment Message

When VAD detects end-of-speech (transition from speech → silence):

```json
{
  "type": "speech",
  "pcm": "<base64 encoded 16kHz 16-bit mono PCM>",
  "duration_ms": 3200,
  "timestamp": 1713312000000,
  "wake_detected": false,
  "vad_confidence": 0.95
}
```

### Event Messages

```json
{ "type": "wake", "word": "nessie", "timestamp": 1713312000000 }
{ "type": "button", "state": "pressed", "timestamp": 1713312000000 }
{ "type": "status", "battery": 85, "wifi_rssi": -45 }
```

### Server → Client Messages

```json
{ "type": "audio", "pcm": "<base64 16kHz 16-bit mono PCM>", "seq": 1 }
{ "type": "led", "color": "#00FF00", "mode": "pulse" }
{ "type": "stop" }
```

## Server Audio Pipeline

### Python subprocess protocol

The TS orchestrator spawns a single long-running Python process:

- **stdin**: PCM audio chunks (from client speech segments) as JSONL
- **stdout**: Annotated events as JSONL

```jsonl
→ {"type":"transcribe","pcm":"<base64>","id":"seg_001"}
← {"type":"transcript","id":"seg_001","text":"let's play pirates","speaker":"SPEAKER_0","confidence":0.94}
← {"type":"ambient","sounds":["laughing","clapping"],"timestamp":1713312000}
```

### Pipeline internals

1. **Whisper** (faster-whisper or whisper.cpp) — transcribes speech segment
2. **pyannote** — identifies speaker from voice embedding
3. **YAMNet** — classifies ambient sounds (run periodically, not every segment)

All three share the Python process. Whisper and pyannote run on every speech segment. YAMNet runs on a timer or when ambient audio is present between speech turns.

## Known Issues & Risks

| Issue | Impact | Mitigation |
|-------|--------|------------|
| **ES8311 hardware AEC feedback broken** ([esp-adf#1552](https://github.com/espressif/esp-adf/issues/1552)) | Can't use ES8311's internal feedback channel for AEC reference | Use software loopback (`"MR"` format) — confirmed working in ESP-SR test suite |
| **No ES7210 on Waveshare board** | Can't use Espressif's recommended hardware AEC design | Software loopback first; hardware mod (add ES7210 breakout) if quality insufficient |
| **Software AEC quality unknown** | Loopback captures digital PCM, not actual analog signal — misses DAC/PA distortion | Test with real hardware; escalate to server-side AEC or ES7210 mod if needed |
| **AEC timing calibration needed** | Recording must be delayed 0-10ms relative to reference | Use `debug_input=true` to measure; `algo_stream_set_delay()` to tune |
| PA_CTRL must be set HIGH for speaker | No audio output by default | Set GPIO in firmware init |
| Onboard mic type unknown | May affect SNR and pickup pattern | Verify mic part from board; follow [Espressif mic design guidelines](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/audio_front_end/Espressif_Microphone_Design_Guidelines.html) |
| ESP-SR TTS is Chinese-only | Can't use on-device TTS | Using ElevenLabs on server — not affected |
| WakeNet false trigger ~1/12hr | Character may activate unprompted | Acceptable for toy; can tune threshold |

## References

- [ESP-IDF I2S docs (ESP32-P4)](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/peripherals/i2s.html)
- [ESP-SR AFE docs (ESP32-P4)](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/audio_front_end/README.html)
- [ESP-SR Benchmarks (ESP32-P4)](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/benchmark/README.html)
- [ESP-SR Mic Design Guidelines](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/audio_front_end/Espressif_Microphone_Design_Guidelines.html)
- [ESP-IDF I2S ES8311 example](https://github.com/espressif/esp-idf/blob/master/examples/peripherals/i2s/i2s_codec/i2s_es8311/README.md)
- [ES8311 Espressif component](https://components.espressif.com/components/espressif/es8311)
- [Waveshare ESP32-AIChats](https://github.com/waveshareteam/ESP32-AIChats)
- [AEC issue with ES8311 (esp-adf#1552)](https://github.com/espressif/esp-adf/issues/1552)
