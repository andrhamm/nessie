# ESP32-P4 (Espressif)

> **Status:** Primary candidate for Nessie client device
> **Variant under evaluation:** [Waveshare ESP32-P4-WIFI6](https://www.waveshare.com/esp32-p4-wifi6.htm)

## Chip Specifications

| Spec | Value | Source |
|------|-------|--------|
| Architecture | RISC-V 32-bit dual-core (HP) + single-core (LP) | [Datasheet v1.0, p.3](datasheets/esp32-p4-datasheet-parsed.txt) |
| HP CPU Clock | **360 MHz** default (400 MHz available on request) | [Datasheet v1.0, p.3](datasheets/esp32-p4-datasheet-parsed.txt) |
| LP CPU Clock | Up to 40 MHz | [Datasheet v1.0, p.3](datasheets/esp32-p4-datasheet-parsed.txt) |
| CoreMark Score | 2489.62 @ 360 MHz (6.92/MHz) | [Datasheet v1.0, p.3](datasheets/esp32-p4-datasheet-parsed.txt) |
| HP ROM | 128 KB | [Datasheet v1.0, p.3](datasheets/esp32-p4-datasheet-parsed.txt) |
| HP L2MEM | 768 KB | [Datasheet v1.0, p.3](datasheets/esp32-p4-datasheet-parsed.txt) |
| LP ROM | 16 KB | [Datasheet v1.0, p.3](datasheets/esp32-p4-datasheet-parsed.txt) |
| LP SRAM | 32 KB | [Datasheet v1.0, p.3](datasheets/esp32-p4-datasheet-parsed.txt) |
| System SPM | 8 KB (Scratchpad Memory) | [Datasheet v1.0, p.3](datasheets/esp32-p4-datasheet-parsed.txt) |
| PSRAM | 16 MB or 32 MB in-package | [Datasheet v1.0, p.1](datasheets/esp32-p4-datasheet-parsed.txt) |
| GPIOs | 55 programmable (5 strapping) | [Datasheet v1.0, p.3](datasheets/esp32-p4-datasheet-parsed.txt) |
| Package | QFN104 (10x10 mm) | [Datasheet v1.0, p.1](datasheets/esp32-p4-datasheet-parsed.txt) |
| WiFi/BT | **None built-in** — requires companion chip (ESP32-C6 on Waveshare board) | [Espressif product page](https://www.espressif.com/en/products/socs/esp32-p4) |

## Audio-Relevant Peripherals

| Peripheral | Details | Source |
|-----------|---------|--------|
| I2S | **3x I2S controllers** (HP) + 1x LP I2S, with PDM support | [Datasheet v1.0, p.3-4](datasheets/esp32-p4-datasheet-parsed.txt) |
| **Hardware VAD** | Voice Activity Detection as a hardware peripheral (section 4.2.3.5, p.78) | [Datasheet v1.0, p.4](datasheets/esp32-p4-datasheet-parsed.txt) |
| USB | USB 2.0 High-Speed OTG + USB 2.0 Full-Speed OTG + USB Serial/JTAG | [Datasheet v1.0, p.4](datasheets/esp32-p4-datasheet-parsed.txt) |
| SD/MMC | SDHOST controller | [Datasheet v1.0, p.4](datasheets/esp32-p4-datasheet-parsed.txt) |
| Touch | Touch sensor | [Datasheet v1.0, p.4](datasheets/esp32-p4-datasheet-parsed.txt) |

## ESP-SR Support (Speech Recognition)

ESP-SR **officially supports ESP32-P4** with the following components:

| Component | Status | Details | Source |
|-----------|--------|---------|--------|
| WakeNet | Supported | WakeNet9, WakeNet9l (Dilated Convolution). Up to 5 wake words. | [ESP-SR ESP32-P4 User Guide (Feb 2026)](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/esp-sr-en-master-esp32p4.pdf) |
| VADNet | Supported | Replaces WebRTC VAD, improved performance. Released Feb 2025. | [ESP-SR GitHub](https://github.com/espressif/esp-sr) |
| MultiNet | Supported | Speech command recognition | [ESP-SR Getting Started](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/getting_started/readme.html) |
| AFE | Supported | AEC, Noise Suppression, BSS, VAD, AGC. 16kHz mono, 30ms frames. | [ESP-SR AFE docs](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/audio_front_end/README.html) |
| Speech Synthesis | Chinese only | TTS only supports Chinese language | [ESP-SR Getting Started](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/getting_started/readme.html) |

### AFE Microphone Configurations

- Single mic: `"M"`
- Dual mic: `"MM"`
- Dual mic + reference: `"MMNR"` (two mics, unused channel, playback reference)
- Input must be channel-interleaved, 16kHz, 16-bit signed integers

Source: [ESP-SR AFE README](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/audio_front_end/README.html)

## Waveshare ESP32-P4-WIFI6 Board

| Spec | Value | Source |
|------|-------|--------|
| Processor | ESP32-P4 (360 MHz dual-core RISC-V) | [Waveshare product page](https://www.waveshare.com/esp32-p4-wifi6.htm) |
| Wireless | ESP32-C6 companion (WiFi 6 + BLE 5) | [Waveshare product page](https://www.waveshare.com/esp32-p4-wifi6.htm) |
| PSRAM | 32 MB | [Waveshare product page](https://www.waveshare.com/esp32-p4-wifi6.htm) |
| Flash | 32 MB (GD25Q256EYIGR) | [Waveshare schematic](https://www.waveshare.com/esp32-p4-wifi6.htm) |
| Onboard Mic | Yes (microphone input connector) | [Waveshare schematic](https://www.waveshare.com/esp32-p4-wifi6.htm) |
| Onboard Speaker | Yes (speaker output connector) | [Waveshare schematic](https://www.waveshare.com/esp32-p4-wifi6.htm) |
| MicroSD | Yes | [Waveshare schematic](https://www.waveshare.com/esp32-p4-wifi6.htm) |
| Display | MIPI-DSI + MIPI-CSI connectors | [Waveshare product page](https://www.waveshare.com/esp32-p4-wifi6.htm) |
| GPIO Header | 2x20 (40-pin), 27 available GPIOs | [Waveshare product page](https://www.waveshare.com/esp32-p4-wifi6.htm) |
| I2C Default Pins | SCL: GPIO8, SDA: GPIO7 | [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-P4-WIFI6) |
| USB | Type-C (debug) | [Waveshare schematic](https://www.waveshare.com/esp32-p4-wifi6.htm) |

### Onboard Audio Subsystem (from schematic)

The board has a complete audio chain:

| Component | Chip | Details | Source |
|-----------|------|---------|--------|
| Audio Codec | **ES8311** | Low-power mono codec. 24-bit ADC/DAC, 8-96 kHz, I2S/PCM, I2C config (addr 0x18). 100dB SNR (ADC), 110dB SNR (DAC). | [ES8311 User Guide](datasheets/es8311-user-guide.pdf), [Waveshare schematic](datasheets/waveshare-esp32-p4-wifi6-datasheet.pdf) |
| Power Amplifier | **NS4150B** | 3W mono Class D, 3.0-5.0V, 88% efficiency, filterless, built-in overcurrent/overheat/undervoltage protection. | [NS4150B datasheet](https://datasheet4u.com/datasheets/Nsiway/NS4150B/1544751) |
| Microphone | Onboard (MIC1 connector, differential MIC_P/MIC_N) | Connected to ES8311 MIC1P/MIC1N inputs | [Waveshare schematic](datasheets/waveshare-esp32-p4-wifi6-datasheet.pdf) |
| Speaker | Header connector (PA_OUTL+/OUT-) | Driven by NS4150B via ES8311 OUTP/OUTN | [Waveshare schematic](datasheets/waveshare-esp32-p4-wifi6-datasheet.pdf) |

### I2S Pin Mapping (from schematic)

| Signal | GPIO | Direction | Notes |
|--------|------|-----------|-------|
| I2S_MCLK | GPIO13 | Output | Master clock to ES8311 |
| I2S_SCLK (BCLK) | GPIO12 | Output | Bit clock |
| I2S_ASDOUT | GPIO11 | Output | Audio data to codec (playback) |
| I2S_LRCK (WS) | GPIO10 | Output | Left/right word select |
| I2S_DSDIN | GPIO9 | Input | Audio data from codec (recording) |

Source: [Waveshare schematic](datasheets/waveshare-esp32-p4-wifi6-datasheet.pdf)

### I2C Codec Control

| Signal | GPIO |
|--------|------|
| I2C SDA | GPIO7 |
| I2C SCL | GPIO8 |

ES8311 I2C address: `0x18`

Source: [Waveshare schematic](datasheets/waveshare-esp32-p4-wifi6-datasheet.pdf), [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-P4-WIFI6)

### PA Control

The NS4150B power amplifier has a `PA_CTRL` pin that must be set HIGH to enable speaker output. This is noted in the [ESP-IDF I2S ES8311 example](https://github.com/espressif/esp-idf/blob/master/examples/peripherals/i2s/i2s_codec/i2s_es8311/README.md) as a common gotcha on P4 boards.

### ESP-IDF Audio Support

- Official ESP-IDF example: [`examples/peripherals/i2s/i2s_codec/i2s_es8311`](https://github.com/espressif/esp-idf/blob/master/examples/peripherals/i2s/i2s_codec/i2s_es8311/README.md)
- ES8311 driver available via IDF Component Manager: [`espressif/es8311`](https://components.espressif.com/components/espressif/es8311)
- ESP32-P4 is listed as a supported target
- Supports "music mode" (playback) and "echo mode" (mic → speaker loopback)

### Waveshare ESP32-AIChats Library

Waveshare provides an official library for connecting ESP32 boards to cloud AI for voice interaction:
- **Repo:** [github.com/waveshareteam/ESP32-AIChats](https://github.com/waveshareteam/ESP32-AIChats)
- Supports ESP32-P4 and ESP32-S3
- Integrates with OpenAI, Doubao, and other LLM platforms
- Uses ESP-IDF framework with LVGL for UI
- Licensed Apache 2.0

This library demonstrates the exact audio-to-cloud-AI-and-back pattern that Nessie needs, though we'll be using a local server rather than cloud APIs directly from the device.

### WiFi Stability Risk (ESP-Hosted via SDIO)

The ESP32-P4 has no built-in WiFi. It relies on the ESP32-C6 companion chip via SDIO using `esp-hosted-mcu`. **Multiple users report stability issues as of early 2026:**

- WiFi association failing/looping with "Disconnected... reason: Association Leave" — [esphome#10956](https://github.com/esphome/esphome/issues/10956)
- Intermittent connectivity, WiFi only connects sporadically — [esphome#13636](https://github.com/esphome/esphome/issues/13636)
- SDIO RX queue overflow during association causing packet loss — [ESP32 Forum](https://esp32.com/viewtopic.php?t=47208)
- Firmware version mismatches between host and co-processor — [arduino-esp32#11404](https://github.com/espressif/arduino-esp32/issues/11404)

**Impact on Nessie:** Any networking protocol (WebSocket, HTTP, MQTT) goes through this same SDIO path. Persistent connections (WebSocket) may be particularly fragile. Short-lived HTTP requests are more resilient to intermittent drops.

**Mitigation:** Design the client-server protocol to be tolerant of disconnects. Start with simple HTTP POST+poll. Revisit when esp-hosted matures or when testing on actual hardware.

### Unverified / Needs Investigation

- [ ] Exact onboard microphone part number (MEMS? electret? — schematic shows differential MIC_P/MIC_N connected to ES8311)
- [ ] PA_CTRL GPIO pin number (need to trace in schematic)
- [ ] Waveshare wiki returns 403 — retry later for full documentation
- [ ] Power consumption under audio workload
- [ ] Physical dimensions of board
- [ ] NRND status of P4NRW16/P4NRW32 — need to verify if this affects the Waveshare board

## Nessie Relevance

The ESP32-P4 is a strong candidate for the Nessie client because:

1. **Hardware VAD** — detects speech with near-zero CPU overhead
2. **ESP-SR support** — WakeNet for "Nessie" wake word, VADNet for speech boundaries, MultiNet for command recognition ("stop", "quiet")
3. **32 MB PSRAM** — ample buffer for audio segments before sending to server
4. **3x I2S + PDM** — native audio interface support
5. **360 MHz RISC-V** — enough headroom for on-device audio preprocessing

The board can act as a **smart client** that sends pre-segmented speech chunks to the server rather than a continuous raw audio stream.

## Datasheets

| Document | Local Path | Source URL |
|----------|-----------|------------|
| ESP32-P4 Chip Rev v1.3 Datasheet v1.0 | [PDF](datasheets/esp32-p4-chip-revision-v1.3-datasheet-v1.0.pdf) / [Parsed Text](datasheets/esp32-p4-datasheet-parsed.txt) / [Parsed JSON](datasheets/esp32-p4-datasheet-parsed.json) | [Espressif](https://documentation.espressif.com/esp32-p4-chip-revision-v1.3_datasheet_en.pdf) |
| Hardware Design Guidelines | Not yet downloaded | [Espressif](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32p4/esp-hardware-design-guidelines-en-master-esp32p4.pdf) |

## NRND Warning

The datasheet lists both ESP32-P4NRW16 and ESP32-P4NRW32 variants as **"Not Recommended for New Designs (NRND)"**. This needs investigation — it may mean these specific package variants are being superseded, not that the P4 chip itself is discontinued.
