# XIAO ESP32-S3 Sense (Seeed Studio)

> **Status:** Original candidate for Nessie client device. May still serve as a secondary/wearable component.

## Chip Specifications (ESP32-S3)

| Spec | Value | Source |
|------|-------|--------|
| Architecture | Xtensa LX7 dual-core, 32-bit | [ESP32-S3 Datasheet v1.6, p.3](datasheets/esp32-s3-datasheet-parsed.txt) |
| CPU Clock | Up to 240 MHz | [ESP32-S3 Datasheet v1.6, p.3](datasheets/esp32-s3-datasheet-parsed.txt) |
| CoreMark Score | 1181.60 @ 240 MHz dual-core (4.92/MHz) | [ESP32-S3 Datasheet v1.6, p.3](datasheets/esp32-s3-datasheet-parsed.txt) |
| ROM | 384 KB | [ESP32-S3 Datasheet v1.6, p.3](datasheets/esp32-s3-datasheet-parsed.txt) |
| SRAM | 512 KB | [ESP32-S3 Datasheet v1.6, p.3](datasheets/esp32-s3-datasheet-parsed.txt) |
| RTC SRAM | 16 KB | [ESP32-S3 Datasheet v1.6, p.3](datasheets/esp32-s3-datasheet-parsed.txt) |
| WiFi | 802.11 b/g/n 2.4 GHz, up to 150 Mbps | [ESP32-S3 Datasheet v1.6, p.3](datasheets/esp32-s3-datasheet-parsed.txt) |
| Bluetooth | BLE 5, Mesh | [ESP32-S3 Datasheet v1.6, p.3](datasheets/esp32-s3-datasheet-parsed.txt) |
| GPIOs | 45 programmable | [ESP32-S3 Datasheet v1.6, p.3](datasheets/esp32-s3-datasheet-parsed.txt) |

## XIAO ESP32-S3 Sense Board Specifications

| Spec | Value | Source |
|------|-------|--------|
| Chip variant | ESP32-S3R8 (8 MB PSRAM on-chip) | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| Flash | 8 MB | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| PSRAM | 8 MB | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| Camera | OV3660 (2048x1536) — OV2640 discontinued | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| Microphone | Digital MEMS, PDM interface | [Seeed Mic Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_sense_mic/) |
| SD Card | Onboard slot, FAT, up to 32 GB | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| USB | Type-C (power + programming) | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| Antenna | U.FL connector, 100m+ range | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| Dimensions | 21mm x 17.8mm x 15mm (with sense board) | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| User LED | GPIO 21 | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| Buttons | Reset, Boot | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| Battery | 3.7V LiPo with charge management | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |

## Microphone Details

| Spec | Value | Source |
|------|-------|--------|
| Type | Digital MEMS | [Seeed Mic Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_sense_mic/) |
| Interface | **PDM** (accessed via I2S driver) | [Seeed Mic Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_sense_mic/) |
| Data Pin | GPIO 41 (PDM data) | [Seeed Mic Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_sense_mic/) |
| Clock Pin | GPIO 42 (PDM clock) | [Seeed Mic Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_sense_mic/) |
| Sample Rate | **16 kHz** (most stable) | [Seeed Mic Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_sense_mic/) |
| Bit Depth | **16-bit only** | [Seeed Mic Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_sense_mic/) |
| Mode | **PDM Mono only** | [Seeed Mic Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_sense_mic/) |

### Known Limitations

- Only `PDM_MONO_MODE` supported on ESP32-S3
- Fixed 16-bit sampling width
- 16 kHz is the stable sample rate
- PSRAM required for recording longer audio segments
- No hardware VAD

### I2S Init (Arduino ESP32 v3.0.x+)

```cpp
I2S.setPinsPdmRx(42, 41);
if (!I2S.begin(I2S_MODE_PDM_RX, 16000, I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO))
```

Source: [Seeed Mic Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_sense_mic/)

## Power Consumption

| Mode | Current (@ 3.8V) | Source |
|------|------------------|--------|
| WiFi active | 81-110 mA | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| BLE active | 85-102 mA | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| Mic + SD write | 54-109 mA | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| Modem-sleep | 27-44 mA | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| Light-sleep | 2-5 mA | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| Deep sleep | 14-33.5 uA | [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |

## Development Support

- Arduino IDE (ESP32 package v2.0.8+)
- MicroPython
- ESP-IDF
- Zephyr RTOS
- PlatformIO

Source: [Seeed Wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/)

## Comparison with ESP32-P4

| Spec | XIAO ESP32-S3 Sense | ESP32-P4 (Waveshare) |
|------|---------------------|----------------------|
| CPU | 240 MHz Xtensa LX7 | **360 MHz RISC-V** |
| CoreMark | 1181.60 (dual) | **2489.62 (dual)** |
| PSRAM | 8 MB | **32 MB** |
| Flash | 8 MB | **32 MB** |
| I2S | 2x | **3x + LP I2S** |
| Hardware VAD | No | **Yes** |
| ESP-SR WakeNet | Yes | **Yes** |
| WiFi | Built-in (802.11 b/g/n) | Via ESP32-C6 (WiFi 6) |
| Size | **21x17.8mm** (tiny) | Larger (TBD) |
| Onboard Mic | Yes (PDM MEMS) | Mic connector (TBD) |
| Battery | LiPo charge circuit | TBD |

## Nessie Relevance

The XIAO remains a potential option for:
- A **secondary wearable device** (extremely small form factor)
- A **fallback** if the ESP32-P4 proves too large for the toy enclosure
- A **BLE peripheral** that talks to the P4 base station

Its limitations for primary use: no hardware VAD, only 8 MB PSRAM, weaker CPU, PDM mono only.

## Datasheets

| Document | Local Path | Source URL |
|----------|-----------|------------|
| ESP32-S3 Datasheet v1.6 | [PDF](datasheets/esp32-s3-datasheet.pdf) / [Parsed Text](datasheets/esp32-s3-datasheet-parsed.txt) / [Parsed JSON](datasheets/esp32-s3-datasheet-parsed.json) | [Seeed/Espressif](https://files.seeedstudio.com/wiki/SeeedStudio-XIAO-ESP32S3/res/esp32-s3_datasheet.pdf) |
