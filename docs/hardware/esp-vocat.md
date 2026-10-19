# ESP-VoCat (Espressif), formerly EchoEar

> **Status:** Top candidate for the Nessie client prototype (rank 1 in [the 2026 board survey](../../reports/Nessie%20dev%20board%20survey%202026.md)). Researched 2026-10-19.

## Naming

Espressif launched this kit as **EchoEar** (Sept 2025) and renamed it **ESP-VoCat** on 2026-03-10. Older articles, xiaozhi board names and some code still say "EchoEar".

| Evidence | Source |
|----------|--------|
| Commit "feat(repo): rename echoear to esp_vocat", 2026-03-10 | [espressif/esp-brookesia b1f7408](https://github.com/espressif/esp-brookesia/commit/b1f74081ec1112b43654749e97bf1b4625d7b6ae) |
| Board manager changelog: "Rename `echoear_core_board_v1_0/v1_2` to `esp_vocat_board_v1_0/v1_2`" | [espressif/esp-board-manager CHANGELOG](https://github.com/espressif/esp-board-manager/blob/main/esp_board_manager/CHANGELOG.md) |
| VoCat user guide links its replication tutorial at `oshwhub.com/esp-college/echoear` | [esp-dev-kits user_guide_v1.0.rst](https://github.com/espressif/esp-dev-kits/blob/master/docs/en/esp-vocat/user_guide_v1.0.rst) |

Not to be confused with **VoCat ESP-VoCat-S31** (喵伴), a newer desktop variant on ESP32-S31 with a camera ([Espressif AI Companion](https://docs.espressif.com/projects/esp-adf/en/latest/solution-center/ai-companion.html)).

## Board Specifications (v1.2)

| Spec | Value | Source |
|------|-------|--------|
| Module | ESP32-S3-WROOM-1-N16R16VA | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| Flash / PSRAM | 16 MB / 16 MB | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| Wireless | 2.4 GHz Wi-Fi, Bluetooth 5 (LE) | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| Microphones | 2x LMA3729T381-OY3S on a separate MicBoard (FPC); "local voice wake-up and sound source localization" | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html), [schematic](datasheets/espressif-esp-vocat-schematic-v1.2-parsed.txt) |
| Mic ADC | ES7210, 4-ch | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html), [ES7210 datasheet](datasheets/es7210-datasheet-parsed.txt) |
| Playback codec | ES8311 mono | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html), [ES8311 guide](datasheets/es8311-user-guide-parsed.txt) |
| Amplifier / speaker | NS4150B 3 W class-D; built-in 3 W speaker on 2-wire connector | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| Battery | "Integrated 3.7 V lithium battery", connector on CoreBoard | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| Charger | TP4057, 250 mA charge current | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| Fuel gauge | BQ27220 | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| Power switch | SAM8108 soft power controller; single click of POWER toggles on/off | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| Regulators | TLV62569 (5 V to 3.3 V system), SY8088AAC (3.3 V codec rail) | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| IMU | BMI270 6-axis | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| Touch | Touch copper-foil connector; v1.2 has 2 pads (IO6, IO7) for slide sensing | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| Display | 1.85" round 360x360 ST77916 QSPI LCD, CST816T touch | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html), [display spec](https://dl.espressif.com/AE/esp-dev-kits/UE018HV-RB39-A002A%20%20V1.0%20SPEC.pdf) |
| Storage | microSD, up to 32 GB, 1-wire SDIO | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| Expansion | Magnetic pogo connector (UART + 5 V), HC-1.25-4P I2C header (v1.2) | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| Power inputs | USB-C, magnetic connector, or battery; both external inputs charge the battery | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| Price | $69.95, in stock (SparkFun DEV-31339, 2026-10-19); ~$40 AliExpress / $55 Amazon at launch | [SparkFun](https://www.sparkfun.com/espressif-esp-vocat.html), [CNX Software 2025-09-26](https://www.cnx-software.com/2025/09/26/espressif-echoear-esp32-s3-voice-controlled-ai-chatbot-with-circular-touchscreen-and-mic-array/) |
| Dimensions | Not published | — |

## Audio Front End

ES7210 runs 3 channels, labelled `FL`, `FR` and `RE`: two mics plus a hardware **echo reference** of the speaker signal. That reference is what ESP-SR's AEC needs for barge-in ("Nessie, stop" while she is talking).

```yaml
adc_channel_mask: "0111"
adc_channel_labels: ['NA', 'RE', 'FR', 'FL']  # MSB ~ LSB
```

Source: [esp-claw board_devices.yaml](https://github.com/espressif/esp-claw/blob/master/application/edge_agent/boards/espressif/esp_vocat_board_v1_2/board_devices.yaml)

## Pin Map (v1.2)

| Signal | GPIO |
|--------|------|
| I2C SDA / SCL (ES7210 0x80, ES8311 0x30, touch, IMU, gauge) | 2 / 1 |
| I2S MCLK / BCLK / WS | 42 / 40 / 39 |
| I2S DOUT (to ES8311) / DIN (from ES7210) | 41 / 3 |
| PA enable (NS4150B) | 15 |
| Codec power | 48 |
| LCD + SD power | 9 |
| LCD backlight (LEDC) | 44 |
| Touch pads | 6, 7 |
| Green LED | 43 |
| SD CLK / CMD / D0 | 16 / 38 / 17 |

Source: [esp-claw board_peripherals.yaml](https://github.com/espressif/esp-claw/blob/master/application/edge_agent/boards/espressif/esp_vocat_board_v1_2/board_peripherals.yaml), [VoCat v1.2 revision notes](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html)

### v1.0 to v1.2 Changes

v1.2 moved I2S_DI (IO15 to IO3), PA_CTRL (IO4 to IO15), LCD_RST_CTRL (IO3 to IO47) and the UART pins. It also added a second touch pad, codec power control on IO48, and an I2C header. Firmware must target the right revision ([VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html)).

## Software

| Stack | Notes | Source |
|-------|-------|--------|
| ESP-IDF + esp-bsp | Official BSP | [VoCat v1.2 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp-vocat/user_guide_v1.2.html) |
| esp-brookesia | Official examples and factory firmware | [espressif/esp-brookesia](https://github.com/espressif/esp-brookesia) |
| esp-board-manager | `esp_vocat_board_v1_0` / `v1_2` definitions | [Board manager docs](https://docs.espressif.com/projects/esp-board-manager/en/latest/references/boards/esp_vocat_1_0.html) |
| ESP-SR | AFE (AEC/NS/VAD), WakeNet, MultiNet on ESP32-S3 | [espressif/esp-sr](https://github.com/espressif/esp-sr) |
| xiaozhi-esp32 | `espressif/esp-vocat` board directory; reference for WebSocket audio streaming | [78/xiaozhi-esp32 boards](https://github.com/78/xiaozhi-esp32/tree/main/main/boards) |

## Nessie Relevance

Fits the existing architecture: on-device wake word + VAD + AEC, speech chunks streamed to the home server. No on-device open-vocabulary STT is possible on ESP32-S3 at conversational speed (see [the survey](../../reports/Nessie%20dev%20board%20survey%202026.md)).

**Pros**
1. Complete battery toy out of the box: battery, charger, fuel gauge and soft power button. The current P4-WIFI6 board has none of these.
2. Dual mics plus hardware echo reference. That is the minimum for full-duplex barge-in.
3. BMI270 and touch pads map directly to plush interactions (pick-up, hug, petting).
4. 16 MB PSRAM (v1.2) gives ESP-SR plenty of room. It matches the P4-WIFI6's job, though with half its 32 MB.
5. First-party Espressif support and a public schematic.

**Cons**
1. The round LCD is unused in a plush. It can be power-gated through IO9, but it still costs size and price.
2. Wi-Fi 4 only. A 16 kHz 16-bit mono stream is 256 kbps, so this matters little.
3. 250 mA charging is slow. Battery capacity and runtime are unpublished.
4. Housing and dimensions are designed for a desk device. Fitting it in a plush may mean removing the board from the shell.

### Unverified / Needs Investigation

- [ ] UNVERIFIED: battery capacity (mAh) and real runtime while always listening
- [ ] UNVERIFIED: board and housing dimensions
- [ ] UNVERIFIED: whether firmware boots and runs cleanly with the LCD disconnected
- [ ] UNVERIFIED: v1.0 module variant. CNX (Sept 2025) reported S3R8 with 8 MB PSRAM; v1.2 is N16R16
- [ ] UNVERIFIED: which revision SparkFun currently ships
- [ ] UNVERIFIED: whether custom WakeNet "Nessie" model training is available for ESP32-S3
- [ ] UNVERIFIED: idle and listening current draw
- Mics are analog: each LMA3729 feeds ES7210 `ADC_MIC1`/`ADC_MIC2` differential inputs through 1 µF caps ([schematic](datasheets/espressif-esp-vocat-schematic-v1.2-parsed.txt))

## Datasheets

| Document | Local Path | Source URL |
|----------|-----------|------------|
| ESP-VoCat v1.2 schematic | [PDF](datasheets/espressif-esp-vocat-schematic-v1.2.pdf) / [Parsed Text](datasheets/espressif-esp-vocat-schematic-v1.2-parsed.txt) | [Espressif](https://dl.espressif.com/AE/esp-dev-kits/ESP-VoCat_SCH_V1_2.pdf) |
| ES7210 4-ch ADC datasheet, Rev 21.0 (Jan 2023) | [PDF](datasheets/es7210-datasheet.pdf) / [Parsed Text](datasheets/es7210-datasheet-parsed.txt) | [Waveshare mirror](https://files.waveshare.com/wiki/common/ES7210_DS.pdf) (Everest original not fetched) |
| ES8311 codec user guide | [PDF](datasheets/es8311-user-guide.pdf) / [Parsed Text](datasheets/es8311-user-guide-parsed.txt) | existing |
| ESP32-S3 datasheet | [PDF](datasheets/esp32-s3-datasheet.pdf) / [Parsed Text](datasheets/esp32-s3-datasheet-parsed.txt) | existing |
| PCB layout | Not downloaded | [Espressif](https://dl.espressif.com/AE/esp-dev-kits/ESP-VoCat_pcb_V1_2.zip) |
| Display spec | Not downloaded (display unused in plush) | [Espressif](https://dl.espressif.com/AE/esp-dev-kits/UE018HV-RB39-A002A%20%20V1.0%20SPEC.pdf) |
