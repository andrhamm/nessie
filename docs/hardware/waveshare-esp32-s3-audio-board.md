# Waveshare ESP32-S3-AUDIO-Board

> **Status:** Alternative candidate for the Nessie client prototype (rank 2 in [the 2026 board survey](../../reports/Nessie%20dev%20board%20survey%202026.md)). Researched 2026-10-19. Same audio chain as [ESP-VoCat](esp-vocat.md), with no display and a lower price.

## Board Specifications

| Spec | Value | Source |
|------|-------|--------|
| SoC | ESP32-S3R8 (8 MB in-package PSRAM), dual-core LX7 240 MHz | [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board), [schematic](datasheets/waveshare-esp32-s3-audio-board-schematic-v1.1-parsed.txt) |
| Flash | 16 MB (W25Q128JVSI) | [schematic](datasheets/waveshare-esp32-s3-audio-board-schematic-v1.1-parsed.txt) |
| Wireless | 2.4 GHz Wi-Fi 802.11 b/g/n, Bluetooth 5 (LE); ceramic antenna, IPEX by resistor swap | [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board) |
| Microphones | Dual mic array. Wiki says "digital"; schematic wires MIC1/MIC2 as differential analog inputs to ES7210 | [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board), [schematic](datasheets/waveshare-esp32-s3-audio-board-schematic-v1.1-parsed.txt) |
| Mic ADC | ES7210 4-ch; MIC3 labelled "AEC" and tied to the codec output (echo reference) | [schematic](datasheets/waveshare-esp32-s3-audio-board-schematic-v1.1-parsed.txt), [ES7210 datasheet](datasheets/es7210-datasheet-parsed.txt) |
| Playback codec | ES8311 | [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board) |
| Amplifier | NS4150B class-D, enable line `PA_CTRL` | [schematic](datasheets/waveshare-esp32-s3-audio-board-schematic-v1.1-parsed.txt) |
| Speaker | Speaker header only; no speaker listed in package contents | [Waveshare store](https://www.waveshare.com/esp32-s3-audio-board.htm) |
| Battery | MX1.25 2-pin header for 3.7 V Li battery; battery switch; charge LED | [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board) |
| Charger | ETA6098 switching charger; DMP2066LSN power-path FETs | [schematic](datasheets/waveshare-esp32-s3-audio-board-schematic-v1.1-parsed.txt) |
| Battery sense | Divider to `BAT_ADC` on GPIO1 (no fuel gauge) | [schematic](datasheets/waveshare-esp32-s3-audio-board-schematic-v1.1-parsed.txt) |
| Regulator | MP1605GTF-Z buck, 3.3 V up to 2 A | [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board) |
| IO expander | TCA9555PWR (LCD/touch reset, SD CS, camera control, PA control) | [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board) |
| RTC | PCF85063, with rechargeable RTC battery header | [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board) |
| LEDs | 7x WS2812B-type RGB ring | [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board), [schematic](datasheets/waveshare-esp32-s3-audio-board-schematic-v1.1-parsed.txt) |
| Expansion | 18-pin SPI/QSPI LCD FPC, 24-pin DVP camera, TF card, pin header | [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board) |
| Dimensions | Round PCB, Φ58 mm; 43.7 mm tall in the pictured speaker housing | [Waveshare wiki dimension drawing](https://www.waveshare.com/w/upload/4/45/ESP32-S3-AUDIO-Board-details-size.jpg) |
| Price | $15.99 to $17.99; `-EN` variant without battery, standard variant with MX1.25 battery | [Waveshare store](https://www.waveshare.com/esp32-s3-audio-board.htm) |

## Pin Map

| Signal | GPIO |
|--------|------|
| I2C SDA / SCL (ES8311, ES7210, TCA9555, RTC, touch) | 11 / 10 |
| I2S MCLK / SCLK / LRCK | 12 / 13 / 14 |
| I2S DSDIN (to ES8311) | 16 |
| I2S ASDOUT (from ES7210) | 15 |
| Battery ADC | 1 |
| TF card SCK / MOSI / MISO, CS | 40 / 42 / 41, EXIO3 |

Source: [Waveshare wiki pinout](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board), [schematic](datasheets/waveshare-esp32-s3-audio-board-schematic-v1.1-parsed.txt)

## Software

| Stack | Notes | Source |
|-------|-------|--------|
| ESP-IDF demos | `factory_01`, `esp_sr_02` (ESP-SR wake word "hi esp" + commands), `mp3_play_03`, `lvgl9_3_example_04` | [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board) |
| Arduino | ESP32 core; LVGL and ESP-SR model-switch demos | [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board) |
| Custom commands | Waveshare tooling for English phoneme / Chinese pinyin MultiNet commands | [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board) |
| xiaozhi-esp32 | `waveshare/esp32-s3-audio-board` board directory | [78/xiaozhi-esp32 boards](https://github.com/78/xiaozhi-esp32/tree/main/main/boards) |

Wiki FAQ: if the ESP-IDF program keeps resetting after flashing, downgrade ESP-IDF to v5.4.1 ([Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board)).

## Nessie Relevance

**Pros**
1. Cheapest full audio front end found: dual mics, ES7210 with an AEC reference channel, ES8311, NS4150B and a LiPo charger for about $16 to $18.
2. No display. The LCD and camera are optional connectors, so there is nothing to strip out for a plush.
3. Round 58 mm board with an RGB ring, a natural fit for a plush's chest or belly.
4. ESP-SR wake word demo ships, so the first hardware milestone is "flash and talk".

**Cons**
1. 8 MB PSRAM, versus 16 MB on ESP-VoCat v1.2 and 32 MB on the P4-WIFI6.
2. No fuel gauge (ADC divider only), no IMU and no touch-pad connector.
3. Speaker not included.
4. Third-party vendor; documentation is thinner than Espressif's.

### Unverified / Needs Investigation

- [ ] UNVERIFIED: amplifier output power and recommended speaker impedance (NS4150B datasheet not downloaded)
- [ ] UNVERIFIED: mic part number. Schematic text does not name it, and the wiki's "digital" conflicts with the analog wiring
- [ ] UNVERIFIED: whether the pictured speaker housing ships with any variant
- [ ] UNVERIFIED: GPIO1 is both `BAT_ADC` (schematic) and `CAM_HREF` (wiki camera pinout), so camera and battery sense may conflict
- [ ] UNVERIFIED: `PA_CTRL` appears next to `Extend_IO8` in parsed text; confirm whether the amp enable is on the TCA9555
- [ ] UNVERIFIED: ETA6098 charge current setting and included battery capacity
- [ ] UNVERIFIED: idle and listening current draw
- [ ] UNVERIFIED: supported ESP-IDF version (FAQ says v5.4.1; survey notes cite v5.5)

## Datasheets

| Document | Local Path | Source URL |
|----------|-----------|------------|
| ESP32-S3-AUDIO-Board schematic v1.1 | [PDF](datasheets/waveshare-esp32-s3-audio-board-schematic-v1.1.pdf) / [Parsed Text](datasheets/waveshare-esp32-s3-audio-board-schematic-v1.1-parsed.txt) | [Waveshare](https://files.waveshare.com/wiki/ESP32-S3-AUDIO-Board/ESP32-S3-AUDIO-Board_1.1.pdf) |
| ES7210 4-ch ADC datasheet, Rev 21.0 (Jan 2023) | [PDF](datasheets/es7210-datasheet.pdf) / [Parsed Text](datasheets/es7210-datasheet-parsed.txt) | [Waveshare](https://files.waveshare.com/wiki/common/ES7210_DS.pdf) |
| ES8311 codec user guide | [PDF](datasheets/es8311-user-guide.pdf) / [Parsed Text](datasheets/es8311-user-guide-parsed.txt) | existing |
| ESP32-S3 datasheet | [PDF](datasheets/esp32-s3-datasheet.pdf) / [Parsed Text](datasheets/esp32-s3-datasheet-parsed.txt) | existing |
