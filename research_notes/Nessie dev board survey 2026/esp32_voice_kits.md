# ESP32-class voice/AI dev kits (MCU tier, no Linux) — fact sheets for a battery-powered plush toy

Research date: 2026-10-19. Prices are USD from US stores unless marked. "UNVERIFIED" = could not be confirmed from a fetched source in this pass. Local repo docs (`docs/hardware/esp32-p4.md`, `docs/hardware/xiao-esp32-s3-sense.md`) were used only where they cite a datasheet/schematic already saved under `docs/hardware/datasheets/`.

## Key Question 1 — Per-board fact sheets (mics, speaker/amp, battery, radio, size, price, availability, SDK, openness)

### Takeaway
No single off-the-shelf kit ships with *all* of: dual mics + amp + LiPo charging + ESP-SR-grade compute + small size. The closest "complete" small kits are M5Stack CoreS3 (2 mics, 1 W amp, 500 mAh battery + AXP2101 PMIC, 54 mm square) and Waveshare ESP32-S3-AUDIO-Board (dual mic array, ES7210+ES8311, amp, LiPo charger, S3R8). The Espressif ESP32-S3-BOX-3 is the best-documented ESP-SR reference but battery only via the 18650 SENSOR dock. ESP32-P4 boards (Waveshare P4-WIFI6, P4-Function-EV) have a single onboard mic + 3 W NS4150B amp and no battery circuit; only ESP32-P4-EYE adds a LiPo connector (1 mic, no speaker stated).

### Cited Findings

#### Espressif ESP32-S3-BOX-3 (+ DOCK / SENSOR / BREAD / BRACKET)
- Main unit: ESP32-S3-WROOM-1 module, 512 KB SRAM, 16 MB quad flash, 16 MB octal PSRAM, 2.4" 320x240 SPI touch LCD, **two digital microphones**, one speaker, 3-axis gyro + 3-axis accel, USB-C, high-density PCIe-style expansion connector, 3 buttons, 2.4 GHz Wi-Fi + BT 5 LE. Codec/amp/mic part numbers and dimensions are not in the page text (they are in spec images and the PCB/schematic folders). — [esp-box hardware overview (GitHub)](https://github.com/espressif/esp-box/blob/master/docs/hardware_overview/esp32_s3_box_3/hardware_overview_for_box_3.md)
- DOCK: two Pmod-compatible headers (16 GPIOs, 3.3 V), USB-A host (720p USB cam, USB disk, HID), USB-C "5 V input power only". SENSOR accessory: temp/humidity, IR TX/RX, radar, **18650 rechargeable battery slot with charging** (capacity/charge current not stated), microSD up to 32 GB. — [same](https://github.com/espressif/esp-box/blob/master/docs/hardware_overview/esp32_s3_box_3/hardware_overview_for_box_3.md)
- Main unit has **no built-in battery**; battery holder only via the optional SENSOR accessory. — [CNX Software](https://www.cnx-software.com/?p=118496)
- Price/availability: ESP32-S3-BOX-3B (bare-bones: main unit + DOCK + USB-C cable + RGB LED module; "without add-ons") is **$47.50 at Adafruit, currently out of stock** (notify-me). — [Adafruit 5883](https://www.adafruit.com/product/5883); Jameco lists the same 3B at $74.95 — [Jameco](https://www.jameco.com/z/5883-Adafruit-Industries-Espressif-Esp32-S3-Box-3B_2527503.html)
- Mouser UK (non-US): full BOX-3 £39.04 (343 in stock in snapshot), BOX-3B £34.16; Mouser IT lists a 101-week factory lead time. — [Mouser UK search](https://www.mouser.co.uk/c/embedded-solutions/engineering-tools/embedded-processor-development-kits/?q=esp32-s3), [Mouser IT](https://www.mouser.it/it/c/?q=esp32-s3)
- SDK: ESP-IDF via esp-box repo (open hardware files: PCB + schematic folders linked from the hardware overview) — [esp-box](https://github.com/espressif/esp-box/blob/master/docs/hardware_overview/esp32_s3_box_3/hardware_overview_for_box_3.md); ESPHome with on-device microWakeWord explicitly targets "devices like the ESP32-S3-BOX-3". — [Home Assistant blog, Feb 2024](https://home-assistant.io/blog/2024/02/21/voice-chapter-6)

#### Espressif ESP32-S3-Korvo-2 (V3.0 / V3.1)
- Two-microphone array for near/far-field wake-up; ES7210 mic ADC, ES8311 speaker codec, ILI9341 LCD + TT21100 touch, camera via esp32-camera, microSD, buttons, LED, no IMU. BSP compatible with V3.0 and V3.1. — [Espressif component registry esp32_s3_korvo_2 4.1.2](https://components.espressif.com/components/espressif/esp32_s3_korvo_2/versions/4.1.2/readme)
- Adafruit: **$49.95, "No longer stocked"**; optional (not included) speaker via JST PH, optional 3.7 V/4.2 V Li-ion/LiPo battery, optional OV5640/OV2640 camera. — [Adafruit 5829](https://www.adafruit.com/product/5829)
- Schematic PDF (V3.0, 2021-09-18) is public. — [Espressif schematic](https://dl.espressif.com/dl/schematics/PCB_ESP32-S3-KORVO-2_V3.0_20210918.pdf)
- UNVERIFIED in this pass: module flash/PSRAM size, amplifier part, charger IC, dimensions (ESP-ADF user guide URL has moved and returned 404 at both old and new paths).

#### Espressif ESP32-P4-Function-EV-Board (v1.5.2)
- ESP32-P4 ("supports up to 32 MB PSRAM"), 16 MB SPI flash, **ES8311 mono codec with one onboard microphone**, **NS4150B 3 W class-D amp**, 2.00 mm speaker port "can drive a 4 Ω, 3 W speaker", **ESP32-C6-MINI-1** for Wi-Fi 6 + BT 5 LE, USB-C power only, **no battery support mentioned**, 7" MIPI-DSI LCD + MIPI-CSI camera. — [Espressif user guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32p4/esp32-p4-function-ev-board/user_guide.html)
- Price: launched Aug 2024 at $55.44 on Espressif AliExpress (limited quantities); DigiKey lists it Active with 16-week manufacturer lead time (no price in snippet); Newegg $124.99; Comet (Bulgaria) €68.29 ex-VAT, 0 stock. — [CNX Software](https://cnx-software.com/2024/08/07/esp32-p4-function-ev-board-development-board-launched-for-55-with-7-inch-display-and-camera-module/?amp=1), [DigiKey](https://azcus.digikey.com/en/products/detail/espressif-systems/ESP32-P4-FUNCTION-EV-BOARD/26763155), [Newegg](https://www.newegg.com/p/3C6-06GK-00HK1), [Comet](https://store.comet.bg/en/CatalogueSchukat/Product/3071190)
- Large board (7" display class) — too big for a plush toy; dimensions only in a linked PDF. — [user guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32p4/esp32-p4-function-ev-board/user_guide.html)

#### Waveshare ESP32-P4-WIFI6
- ESP32-P4NRW32X: **32 MB in-package PSRAM, 32 MB NOR flash**; onboard microphone (type not specified); 2-pin MX1.25 speaker header for 8 Ω 2 W speaker; ESP32-C6-MINI-1 over SDIO 3.0 for Wi-Fi 6 + BT 5; USB-C power; **no battery/charging mentioned**; price **$13.99–$69.99 depending on kit** (board only / pre-soldered header / KIT-A / KIT-B). — [Waveshare product page](https://www.waveshare.com/esp32-p4-wifi6.htm)
- Repo doc (from saved Waveshare schematic + NS4150B datasheet): audio path is ES8311 codec + **NS4150B 3 W mono class-D amp**; mic is a differential MIC_P/MIC_N input to ES8311 MIC1P/MIC1N via "MIC1 connector"; exact mic part still flagged unverified; NS4150B `PA_CTRL` must be driven HIGH. — [docs/hardware/esp32-p4.md](../../docs/hardware/esp32-p4.md), [ESP-IDF i2s_es8311 example](https://github.com/espressif/esp-idf/blob/master/examples/peripherals/i2s/i2s_codec/i2s_es8311/README.md)
- Community BSP (espp, not official) says the Waveshare wiki "self-contradicts on 16 vs 32 MB of flash"; its example covers display/touch, audio record/playback, camera, uSD, Ethernet — **no ESP-SR example**. — [espp esp32-p4-wifi6-dev-kit BSP](https://components.espressif.com/components/espp/esp32-p4-wifi6-dev-kit/versions/1.3.8/readme)
- Dimensions: UNVERIFIED (only outline image on product page; repo doc also flags it).

#### Espressif ESP32-P4-EYE (and P4X-EYE revision)
- ESP32-P4 + 16 MB SPI flash (fitted PSRAM not stated), **one digital microphone**, 1.54" 240x240 ST7789 LCD, 2 MP MIPI-CSI camera with manual focus + fill light, **ESP32-C6-MINI-1U**, **lithium battery connector** (1.25 mm pitch, battery max 4 x 25 x 45 mm, red/green charge LED, charges over USB), **no speaker/amp mentioned**. — [Espressif user guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32p4/esp32-p4-eye/user_guide.html)
- Announced May 2025; a P4X-EYE kit revision is listed by Mouser (2026) keeping the single digital mic. — [Espressif developer blog](https://developer.espressif.com/blog/2025/05/introducing-p4-eye/), [Mouser PR](https://www.mouser.ee/newsroom/publicrelations-espressif-esp32-p4x-eye-kit-2026final/)
- No other ESP32-P4 board with an onboard **mic array** was found in this pass (search for P4-Nano / P4 Module DEV audio returned nothing).

#### Home Assistant Voice Preview Edition (Nabu Casa)
- ESP32-S3 (dual LX7 240 MHz, vector ext.), **8 MB octal PSRAM, 16 MB flash**, **XMOS XU316** (16 logical cores) doing echo cancellation, stationary noise removal, AGC; **internal dual-mic array**; TI AIC3202 DAC @ 48 kHz; internal speaker + 3.5 mm stereo jack; Grove port; button, rotary dial, hardware mute switch that physically cuts mic power; **5 V/2 A USB-C, no battery**; 84 x 84 x 21 mm, 96 g; **$59 / €59**; launched ~2024-12-20; ESPHome firmware preloaded, XMOS firmware also open source. — [CNX Software, 2024-12-20](https://cnx-software.com/2024/12/20/59-voice-preview-edition-adds-an-offline-smart-speaker-to-your-home-assistant-server)
- US retail: CloudFree lists it. — [CloudFree](https://cloudfree.shop/products/home-assistant-voice-preview-edition) (price not captured; UNVERIFIED current price/stock)
- Official Nabu Casa spec page returned HTTP 403 to the fetcher.

#### FutureProofHomes Satellite1 Dev Kit
- ESP32-S3 (512 KB SRAM, 8 MB PSRAM, 16 MB flash, Wi-Fi 4, BT 5.x) running ESPHome + audio "HAT" with **XMOS XU316-1024-QF60V-I32** (16 cores, 800 MHz, 1 MB SRAM, 8 MB flash); **four microphones, only two active in current XMOS firmware**; **TAS2780 25 W mono amp** + PCM5122 line-out + 3.5 mm jack; speaker not included; LTR-303ALS light, AHT20 temp/humidity, optional LD2410/LD2450 mmWave; 24 NeoPixels; 4 buttons; 40-pin RPi header; power 5 V (headphone only) / **9 V @ 3 A** (included adapter) / up to 20 V @ 1.5 A; **no battery support mentioned**; 88 x 88 x 10 mm, 44 g; **$79.99 dev kit / $54.99 HAT only** (pre-order, ship June 2025); schematics PDF on GitHub, license not stated. — [CNX Software, 2025-05-16](https://www.cnx-software.com/2025/05/16/satellite1-dev-kit-is-an-home-assistant-compatible-diy-voice-assistant-with-esp32-s3-module-xmos-xu316-audio-processor/)
- Docs site reflects firmware "Sat1 v0.2.1-beta.0" and links a Satellite1-ESPHome repo; dev-kit sub-page 404'd. — [docs.futureproofhomes.net](https://docs.futureproofhomes.net/)

#### Seeed ReSpeaker Lite (XU316, 2-mic) with XIAO ESP32S3
- **$30.99 at Seeed (10+ tier shown), in stock (US + CN warehouses)**; "Powered by XMOS XU316"; 2-mic array; noise reduction / voice processing. — [Seeed product page](https://www.seeedstudio.com/ReSpeaker-Lite-Voice-Assistant-Kit-p-5929.html)
- Retailer spec sheets: 2 digital mics, −26 dBFS sensitivity, 64 dBA SNR; power USB 5 V or external 5 V; **35 x 86 mm**; XIAO ESP32S3 = ESP32-S3R8, 8 MB PSRAM, 8 MB flash; ESPHome/Home Assistant support. One retailer lists a battery input (4.2 V, 100 mA charge) and ~14 µA deep sleep at 3.8 V — these are XIAO ESP32S3 figures, not confirmed for the Lite board. — [The Pi Hut](https://thepihut.com/products/respeaker-lite-with-xiao-esp32s3), [Pakronics](https://pakronics.com.au/products/respeaker-lite-voice-assistant-kit-with-xiao-esp32s3-ss110061601)
- Speaker amp output power: UNVERIFIED (Seeed wiki getting-started URL 404'd).

#### Seeed ReSpeaker XVF3800 (4-mic) with XIAO ESP32S3 (+ "ReSpeaker Flex" split-board variants)
- **$66.99 at Seeed ($61.99 @10+), in stock**; circular 4-mic array; 360° far-field pickup to 5 m; onboard AEC, AGC, DoA, VAD, dereverb, beamforming, noise suppression. — [Seeed product page](https://www.seeedstudio.com/reSpeaker-XVF3800-4-Mic-Array-with-XIAO-ESP32S3-p-6489.html)
- Wiki: quad **PDM MEMS** mics; **LM48511 class-D amp**, 3.5 mm AUX, JST speaker connector "up to 5 W"; USB-C (UAC 2.0), I2S + I2C headers, 3 GPI/5 GPO; firmware images for USB, I2S (INT-Device) and Home Assistant; Arduino listed as I2S host, ESPHome not mentioned on wiki; power draw / dimensions / battery not stated (wiki updated 2025-11-10). — [Seeed wiki](https://wiki.seeedstudio.com/respeaker_xvf3800_introduction/)
- Flex (linear/circular) variants exist at UK retail (£49.40 ex-VAT). — [The Pi Hut Flex circular](https://thepihut.com/collections/all/products/respeaker-flex-xvf3800-circular-with-xiao-esp32s3)

#### Seeed XIAO ESP32S3 Sense
- 8 MB flash + 8 MB PSRAM; **one PDM digital mic** (CLK GPIO42, DATA GPIO41; part not listed); OV5640 camera on detachable board; **no speaker/amp**; 3.7 V LiPo solder pads with charge management (charge current rows list 50 mA/100 mA fast); **21 x 17.8 mm (x 15 mm with Sense board)**; measured: deep sleep 3 mA @3.8 V, light sleep 5 mA, modem sleep 44 mA, Wi-Fi active 110 mA, mic recording + SD write 54.58 mA avg / 86.7 mA peak. — [Seeed wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/)
- Price: UNVERIFIED in this pass (wiki links to store only).

#### M5Stack Atom Echo (now "Atom Voice", C008-C)
- ESP32-PICO-D4 (original ESP32, 4 MB flash, no PSRAM listed), **SPM1423 PDM mic**, **0.8 W speaker via NS4168 I2S amp**, SK6812 RGB LED, 24 x 24 x 16.8 mm, no battery. — [M5Stack docs](https://docs.m5stack.com/en/atom/atomecho)
- Note: original ESP32 is **not** supported by newer ESP-SR algorithms ("The new algorithms will no longer support ESP32 chips"). — [ESP-SR component readme](https://components.espressif.com/components/espressif/esp-sr/versions/1.6.0/readme)

#### M5Stack Atom EchoS3R / "Atom VoiceS3R"
- ESP32-S3-PICO-1-N8R8 (8 MB flash, 8 MB PSRAM), MEMS mic 65 dB SNR, ES8311 mono 24-bit codec, **NS4150B class-D amp, 8 Ω 1 W 1318 speaker**, 24 x 24 x 16.8 mm, 9.3 g, DC 5 V, **no battery listed**; UK price £13.90 incl. VAT, **sold out**. — [The Pi Hut](https://thepihut.com/products/atom-echos3r-smart-speaker-dev-kit)
- Official M5Stack doc URL 404'd; US price UNVERIFIED.

#### M5Stack Atomic Echo Base (A149, for AtomS3/AtomS3R)
- ES8311 codec + MSM381A3729H9BPC MEMS mic (SNR ≥65 dB) + NS4150B class-D amp; 2014-size cavity speaker **1 W @ 8 Ω**; full duplex; released 2024-12-27 (catalog). A UiFlow note says "Microphone is not quite ready yet" in MicroPython. — [M5Stack docs](https://docs.m5stack.switch-science.com/en/atom/Atomic%20Echo%20Base), [UiFlow docs](https://uiflow-micropython.readthedocs.io/en/2.2.7/base/echo.html), [lang-ship catalog](https://m5stack.lang-ship.com/catalog/products/base/a149_atomic-echo-base/)
- Echo Pyramid base (different product): AW87559 amp, LMA3729T381-0Y3S MEMS mic + ES7210 ADC. — [The Pi Hut](https://thepihut.com/products/echo-pyramid-smart-speaker-base-without-m5atom)
- No battery on either base (not listed). AtomS3R host board specs not captured in this pass.

#### M5Stack CoreS3 (and CoreS3-Lite)
- ESP32-S3, 16 MB flash, 8 MB quad PSRAM; **dual-mic input via ES7210**; **1 W speaker via AW88298 16-bit I2S amp**; **internal 500 mAh battery (200 mAh on Lite) with AXP2101 PMIC**; GC0308 0.3 MP camera + LTR-553 proximity; 54.0 x 54.0 x 15.5 mm. — [M5Stack docs](https://docs.m5stack.com/en/core/CoreS3)
- Price UNVERIFIED (not on docs page).

#### DFRobot UNIHIKER K10
- ESP32-S3N16R8 (16 MB flash, 8 MB PSRAM), **2x MEMS mic array**, **2 W speaker**, 2.8" 240x320 ILI9341 LCD, GC2145 2 MP camera, **2-pin PH2.0 battery connector** (charging not confirmed), 83 x 51.6 x 11 mm, **$28.90** on DFRobot (Mar 2025), programmed via MindPlus or MicroPython; "local (offline) speech recognition and custom voice commands" — engine/command count not stated. — [CNX Software, 2025-03-14](https://www.cnx-software.com/2025/03/14/unihiker-k10-low-cost-tinyml-education-platform-supports-image-detection-and-voice-recognition/)
- Official DFRobot wiki URL 404'd in this pass.

#### Waveshare ESP32-S3-AUDIO-Board
- ESP32-S3R8 (8 MB PSRAM, 16 MB flash), **dual digital mic array**, **ES8311 codec + ES7210 ADC**, echo cancellation/noise reduction supported, onboard amp + speaker header (amp model/power not stated), **MX1.25 2-pin 3.7 V Li battery header with charge manager + indicator + battery switch**, PCF85063 RTC, LCD + DVP camera connectors, RGB LEDs; Arduino (ESP32 core ≥3.2.0) and ESP-IDF 5.5; **ships ESP-SR demos** (`esp_sr_02`, `factory_01`, wake word "hi esp"). — [Waveshare wiki](https://www.waveshare.com/wiki/ESP32-S3-AUDIO-Board), [CNX Software](https://www.cnx-software.com/?p=156657)
- Price/dimensions UNVERIFIED (not in wiki text).

#### Waveshare ESP32-S3 1.85" Round LCD Touch board (with/without speaker box + LiPo)
- 1.85" 360x360 touch LCD, onboard microphone, speaker output header, microSD, **MX1.25 LiPo interface with charge circuit**; sold with optional speaker box + battery; Waveshare price **$15.99–$17.99**. — [The Pi Hut](https://thepihut.com/products/esp32-s3-1-85-round-lcd-touch-display-dev-board-with-microphone-and-speaker), [CNX Software](https://cnx-software.com/?p=148173)
- Mic count/type and amp UNVERIFIED (likely single mic — not confirmed).

#### Elecrow CrowPanel (Advance series, 2.8"–7"; 2.01" watch module)
- Advance series: ESP32-S3 HMI displays with swappable wireless modules (Wi-Fi 6, Thread/Zigbee, LoRa); 7" model lists built-in mic + speaker connector; 4.3" has mic + speaker for voice. Battery: **sources conflict** — CNX spec shows 2-pin battery connector on 7", atomic14 says "Battery: No". — [CNX Software, 2025-01-17](https://www.cnx-software.com/2025/01/17/crowpanel-advance-esp32-s3-displays-with-replaceable-wifi-6-thread-zigbee-lora-and-2-4ghz-wireless-modules/), [atomic14](https://www.atomic14.com/esp32/boards/elecrow-crowpanel-advance-7/)
- 2.01" watch HMI (DHB56201D): mic + speaker + knob, voice command recognition; battery not mentioned. — [Elecrow](https://www.elecrow.com/crowpanel-2-01inch-hmi-esp32-watch-display-240-296-ips-touch-screen-with-microphone-supports-voice-control-only-pcb.html?idd=6)
- These are display-first HMI panels, not voice kits; mic count and amp specs UNVERIFIED.

### Inferences
- For a plush toy the display-centric boards (BOX-3, Function-EV, CrowPanel, Unihiker) carry dead weight; the audio-first candidates that already include LiPo charging are Waveshare ESP32-S3-AUDIO-Board, M5Stack CoreS3, and (single-mic, no amp) XIAO ESP32S3 Sense.
- Every ESP32-P4 board surveyed uses an ESP32-C6 co-processor for Wi-Fi (P4 has no radio), so Wi-Fi power draw is the C6's, plus SDIO hosting overhead — relevant to battery budgeting.
- Availability risk: BOX-3B is out of stock at Adafruit with 100-week Mouser lead times; Korvo-2 is discontinued at Adafruit; Atom EchoS3R is sold out at UK retail. Seeed ReSpeaker Lite/XVF3800 and Waveshare boards appear to be the most consistently in-stock options.

### Gaps
- BOX-3 codec/amp/mic part numbers, dimensions and full-kit US price (only in images/schematics).
- Korvo-2 flash/PSRAM, amp, charger IC, dimensions (ESP-ADF guide URL moved; both URLs 404).
- Satellite1 current (Oct 2026) price/stock and whether 4-mic XMOS firmware shipped.
- ReSpeaker Lite amp power, dimensions on Seeed's own page; XVF3800 power draw and dimensions.
- CoreS3, XIAO Sense, EchoS3R, ESP32-S3-AUDIO-Board current US prices.
- Waveshare P4-WIFI6 exact mic part and board dimensions.
- Current HA Voice PE US stock/price (official spec page 403).

## Key Question 2 — What ESP-SR runs on-device, and can ESP32-S3/P4 do open-vocabulary STT?

### Takeaway
ESP-SR provides wake word (WakeNet9/9s/9l/10/10s), neural VAD (VADNet, Feb 2025), fixed-vocabulary command recognition (MultiNet, ≤300 commands), and an AFE with AEC, noise suppression, DoA, GSC/NN beamforming on ESP32-S3 and ESP32-P4 — but **no open-vocabulary STT**. The only credible on-device open-vocabulary result found is the third-party Oído project on ESP32-S3 (N16R8): ~3.7% WER LibriSpeech test-clean but **~2x slower than real time** (≈7 s delay after a 3.7 s utterance), which the authors themselves say "is not real time yet". No Whisper/Moonshine/sherpa-onnx ESP32 benchmark exists publicly.

### Cited Findings
- ESP-SR support matrix (GitHub README, Oct 2026): AFE — ESP32, ESP32-S3, ESP32-P4, ESP32-S31; WakeNet — ESP32, S2, S3, S31, P4, C3, C5, C6; MultiNet — **ESP32-S3, ESP32-P4, ESP32-S31 only**; MultiNet models: S3 = mn5q8/mn6/mn7 (CN/EN), P4/S31 = **mn7 only**; "up to 300 Chinese or English commands", custom commands without retraining. — [espressif/esp-sr](https://github.com/espressif/esp-sr)
- ESP-SR timeline: V2.0 2025-02-14; VADNet 2025-02-13 ("replacement for WebRTC VAD"); DOA 2025-04-17; WakeNet9s 2025-04-21; WakeNet9l 2025-10-20 (~1.3x WakeNet9 CPU/memory); new full-duplex AEC 2026-04-28; preliminary ESP32-S31 2026-05-09; **WakeNet10 2026-08-17** (w16a16/w8a16 via esp-dl); GSC beamforming + DOA update 2026-08-28; WakeNet10 adds CN/EN/JA/FR/DE/ES/PT/RU 2026-09-30; **v2.6.0 2026-10-09** adds WakeNet10s for non-SIMD chips. Wake word training pipeline V3 (2026-04-23) supports CN/EN/JA/FR custom wake words. — [espressif/esp-sr](https://github.com/espressif/esp-sr), [esp-sr 2.6.0 readme](https://components.espressif.com/components/espressif/esp-sr/versions/2.6.0/readme)
- VADNet: NN VAD trained on ~5,000 h each CN/EN/multilingual; model "vadnet1 medium"; included in AFE and enabled by default; `vad_cache` avoids truncating the first word; tunables `vad_min_noise_ms`, `vad_min_speech_ms`, `vad_delay_ms`, `vad_mode`. — [ESP-SR VADNet (P4 docs)](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/vadnet/README.html)
- WakeNet resource table (P4 docs): WakeNet9 2-ch 16 KB RAM / 324 KB PSRAM / 2.6 ms per 32 ms frame; WakeNet9 3-ch 20 KB / 347 KB / 3.1 ms; **WakeNet10 3-ch 16 KB / 523 KB / 4.1 ms, 14.1% of one core**. Accuracy (measured on ESP32-S3-Korvo V4.0, WakeNet9 "Alexa"): 98% quiet, 96% stationary noise SNR 4 dB, 94% speech noise, false trigger once/12 h. — [ESP-SR Benchmark (P4 docs)](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/benchmark/README.html)
- MultiNet7 resources: 18 KB RAM, **2920 KB PSRAM**, 8 ms/32 ms frame. MultiNet7-en "WER" on LibriSpeech test-clean/test-other **8.5% / 21.3%** (vs MN6 9.0/21.3, MN5 16.5/41.4); command accuracy at 3 m: 97.2% quiet / 92.3% stationary noise / 90.6% speech noise. — [ESP-SR Benchmark](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/benchmark/README.html)
- ESP-SR docs: speech synthesis "only supports Chinese"; AFE is 16 kHz mono, 30 ms frames; mic configs "M", "MM", "MMNR". — [ESP-SR getting started (P4)](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/getting_started/readme.html), [docs/hardware/esp32-p4.md](../../docs/hardware/esp32-p4.md)
- ESP-SR explicitly recommends ESP32-S3 (AI instructions + octal PSRAM) and states new algorithms "will no longer support ESP32 chips". — [esp-sr 1.6.0 readme](https://components.espressif.com/components/espressif/esp-sr/versions/1.6.0/readme)
- **Open-vocabulary on ESP32-S3 (third-party, self-reported):** Oído (lokutor-ai) runs Conformer-CTC English/Spanish on ESP32-S3 **N16R8 (16 MB flash, 8 MB octal PSRAM)**; model 14.0 MB int8 / 8.3 MB int4; 2.4 MB PSRAM peak for 20 s utterance; **RTF 1.97x real time on one core (int8+LM)**; latency: utterance mode text appears **6.9–7.4 s after** a 3.6–3.8 s command (+0.8 s end-of-speech wait); streaming mode 4.1–4.2 s after; WER LibriSpeech 3.3/7.2 (int8+LM), streaming 4.9/11.0; 1024 BPE tokens; GPL-3.0 code (commercial licence offered), CC-BY weights; authors: "That is not real time yet." Whisper tiny.en numbers in their table are laptop fp32 (6.3/15.9), **not run on ESP32**. — [Oído wiki](https://github.com/lokutor-ai/oido/wiki)
- No public benchmark of Whisper tiny, Moonshine, or sherpa-onnx zipformer on ESP32-S3 or ESP32-P4 was found; sherpa-onnx lists "embedded systems" generically with no ESP32 target. — [sherpa-onnx docs index](https://docsearch.algolia.com/mcp/docs/repo/k2-fsa/sherpa-onnx); Groq-based "whisper on ESP32-S3" Arduino libs are cloud calls, not on-device. — [arduinolibraries groq_stt](https://www.arduinolibraries.info/libraries/groq_stt)
- Home Assistant moved wake word on-device because openWakeWord "was too large to run on low power devices like S3-BOX-3", leading to microWakeWord (ESPHome). — [HA blog 2024-02-21](https://home-assistant.io/blog/2024/02/21/voice-chapter-6)

### Inferences
- Keyword/command recognition (MultiNet) ≠ STT: the "WER" Espressif reports is on a command-constrained decode; it does not transcribe arbitrary speech. For Nessie, on-device scope should be WakeNet + VADNet + (optionally) MultiNet for "stop/quiet", with full transcription on the server — consistent with CLAUDE.md.
- Oído shows open-vocab STT is *possible* on S3-class silicon but at ~2x RTF and 7 s latency it is unusable for conversational turns; it also saturates one core, conflicting with Wi-Fi + AFE. ESP32-P4 (400 MHz RISC-V, 32 MB PSRAM) would plausibly cut RTF, but no port or benchmark exists — treat as speculation.
- WakeNet10 (Aug 2026) with 8 languages and trainable custom wake words (pipeline V3, Apr 2026) makes a custom "Nessie" wake word feasible via Espressif's training pipeline; whether training is self-serve or Espressif-service was not confirmed.

### Gaps
- No Espressif statement found explicitly denying/announcing open-vocabulary ASR on ESP32-P4; esp-dl Whisper port not found.
- Whether MultiNet mn7 on P4 has P4-specific CPU numbers (benchmark table doesn't name chip).
- VADNet resource usage numbers (benchmark page has none).
- Terms/cost of Espressif custom wake word training (pipeline V3).

## Key Question 3 — ESP32-P4 specifics (PSRAM, hardware VAD, ESP-SR P4 status, Waveshare board audio)

### Takeaway
ESP32-P4 ships with 16 or 32 MB in-package PSRAM (Waveshare P4-WIFI6 uses the 32 MB P4NRW32X), has a hardware VAD peripheral, and is a first-class ESP-SR target (AFE, WakeNet incl. WakeNet10, MultiNet mn7, VADNet, GSC beamforming/DOA added for P4 in 2026). The Waveshare ESP32-P4-WIFI6 has an onboard mic and an ES8311 + NS4150B 3 W amp with speaker header, but no battery/charging — a LiPo charger must be added. Wi-Fi 6 comes from an ESP32-C6-MINI-1 over SDIO (ESP-Hosted).

### Cited Findings
- P4 datasheet (saved locally): 16 MB or 32 MB in-package PSRAM; **hardware Voice Activity Detection peripheral** (datasheet §4.2.3.5); ESP32-P4NRW16/NRW32 variants flagged NRND in datasheet — needs investigation. — [docs/hardware/esp32-p4.md](../../docs/hardware/esp32-p4.md) citing [datasheet parsed text](../../docs/hardware/datasheets/esp32-p4-datasheet-parsed.txt)
- ESP-SR P4 AFE benchmark @ 400 MHz, L2 cache 256 KB (nsnet2 + vadnet1_medium + wn9_hilexin): single mic+ref (MR) SR low-cost **60.1 KB RAM / 739.7 KB PSRAM / 8.8% + 9.8% CPU (one core)**; voice-communication mode 30.6%+4.7%; dual-mic+ref (MMNR) SR low-cost 79.1 KB / 1153.7 KB / 23.7% + 22.9%. — [ESP-SR Benchmark (P4)](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/benchmark/README.html)
- ESP-SR 2.6.0 release notes: GSC beamforming and updated DOA documented for P4; MultiNet on P4 = mn7 CN/EN. — [esp-sr 2.6.0](https://components.espressif.com/components/espressif/esp-sr/versions/2.6.0/readme), [espressif/esp-sr](https://github.com/espressif/esp-sr)
- Waveshare ESP32-P4-WIFI6: P4NRW32X 32 MB PSRAM, 32 MB flash, onboard mic, MX1.25 speaker header (8 Ω 2 W), ESP32-C6-MINI-1 via SDIO 3.0, USB-C power, no battery, $13.99–$69.99 by kit. — [Waveshare](https://www.waveshare.com/esp32-p4-wifi6.htm); amp = NS4150B (3 W class-D) per saved schematic. — [docs/hardware/esp32-p4.md](../../docs/hardware/esp32-p4.md)
- Espressif P4-Function-EV: ES8311 + 1 onboard mic + NS4150B 3 W, ESP32-C6-MINI-1, no battery. — [user guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32p4/esp32-p4-function-ev-board/user_guide.html)
- Espressif P4-EYE: 1 digital mic, LiPo connector + charging, ESP32-C6-MINI-1U, no speaker stated. — [user guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32p4/esp32-p4-eye/user_guide.html)
- `PA_CTRL` must be HIGH to enable the NS4150B — common P4 board gotcha. — [ESP-IDF i2s_es8311 example](https://github.com/espressif/esp-idf/blob/master/examples/peripherals/i2s/i2s_codec/i2s_es8311/README.md)

### Inferences
- Single-mic P4 boards limit AFE to "M"/"MR" configs (no beamforming, no BSS); for a plush toy with the speaker close to the mic, the MR config (mic + playback reference for AEC) is the relevant one, and it costs only ~19% of one P4 core.
- The P4's hardware VAD peripheral is distinct from ESP-SR VADNet (software NN). No source was found describing ESP-SR using the hardware VAD; assume VADNet is what ESP-SR uses.

### Gaps
- No found source documents ESP-SR/ESP-IDF use of the P4 hardware VAD peripheral (API, power savings).
- P4 ESP-SR WakeNet/MultiNet P4-specific CPU% beyond the AFE table.
- P4 NRND status of NRW16/NRW32 variants unresolved.
- Waveshare P4-WIFI6 mic part number and dimensions.

## Key Question 4 — XMOS XU316 boards: what the XMOS does, local STT?, power

### Takeaway
On HA Voice PE, Satellite1 and ReSpeaker Lite/XVF3800 the XMOS part is an audio front-end DSP (AEC, noise suppression, AGC, and on XVF3800 also beamforming/DoA/dereverb/VAD) feeding clean audio to the ESP32-S3, which still does wake word; **none of these do local STT on the XMOS**. Published power figures are thin: only a marketplace claim of ~300–350 mW for the xcore-voice framework, and HA Voice PE needs a 5 V/2 A supply with no measured idle number found.

### Cited Findings
- HA Voice PE: XU316 (16 logical cores) performs echo cancellation, stationary noise removal, AGC; ESP32-S3 runs ESPHome (wake word); open-source firmware for both chips. — [CNX Software](https://cnx-software.com/2024/12/20/59-voice-preview-edition-adds-an-offline-smart-speaker-to-your-home-assistant-server), [Pimoroni](https://shop.pimoroni.com/products/home-assistant-voice)
- Satellite1: XU316-1024-QF60V-I32, 16 cores @ 800 MHz, 1 MB SRAM, 8 MB flash; 4 mics, 2 enabled in firmware. — [CNX Software](https://www.cnx-software.com/2025/05/16/satellite1-dev-kit-is-an-home-assistant-compatible-diy-voice-assistant-with-esp32-s3-module-xmos-xu316-audio-processor/)
- ReSpeaker XVF3800: AEC, beamforming, dereverb, DoA, dynamic noise suppression, AGC (60 dB range), VAD, 360° to 5 m; quad PDM MEMS; LM48511 class-D amp up to 5 W. — [Seeed wiki](https://wiki.seeedstudio.com/respeaker_xvf3800_introduction/)
- ReSpeaker Lite: "XMOS XU316 AI Sound and Audio chipset", noise reduction / voice processing. — [Seeed](https://www.seeedstudio.com/ReSpeaker-Lite-Voice-Assistant-Kit-p-5929.html)
- Power: marketplace listing describes xcore-voice far-field framework at "300–350 mW" (not a datasheet value). — [Alibaba XMOS listing](https://electronics.alibaba.com/product/xmos-usb); XU316 core supply 0.855–0.945 V; 600/800 MHz variants, 1 MB memory. — [Mouser XMOS](https://www.mouser.com/c/?m=XMOS)
- HA Voice PE requires 5 V/2 A USB-C; no measured idle wattage found. — [The Pi Hut](https://thepihut.com/products/home-assistant-voice-preview-edition)
- Satellite1 requires 9 V @ 3 A for speaker use (25 W amp). — [CNX Software](https://www.cnx-software.com/2025/05/16/satellite1-dev-kit-is-an-home-assistant-compatible-diy-voice-assistant-with-esp32-s3-module-xmos-xu316-audio-processor/)

### Inferences
- Adding an XU316 roughly doubles the always-on silicon budget (ESP32-S3 + ~0.3 W XMOS) — a poor fit for a small LiPo toy; ESP-SR's own AFE (AEC/NS on the S3/P4) is the lower-power path. XMOS boards are mains-powered designs (no battery on HA PE, Satellite1, or XVF3800 pages).
- The XVF3800 is the only surveyed XMOS board with onboard beamforming/DoA; ESP-SR added GSC/NN beamforming in 2026, narrowing that advantage for multi-mic ESP32 designs.

### Gaps
- No measured idle/active current for HA Voice PE, Satellite1, or ReSpeaker boards; no XU316 datasheet IDD figure retrieved.
- Whether any XMOS firmware offers on-chip keyword spotting (none of the fetched pages claim it; treat as "no" but UNVERIFIED).

## Key Question 5 — Battery life / idle current for always-listening operation

### Takeaway
No vendor publishes a battery-life figure for continuous wake-word listening. The only board-level measurements found are Seeed's XIAO ESP32S3: 44 mA modem-sleep, 110 mA Wi-Fi active, ~55 mA average while recording mic to SD, 3 mA deep sleep (board-level). Espressif's chip figures (88 mA Wi-Fi RX, 380 µA light sleep) and ESP-SR CPU-load tables are the inputs for an estimate; everything else must be bench-measured.

### Cited Findings
- XIAO ESP32S3 (Sense) measured: Type-C 5 V @ 38.3 mA / BAT 3.8 V @ 43.2 mA baseline (with expansion board); modem-sleep 44 mA; light-sleep 5 mA; deep sleep 3 mA; Wi-Fi active 110 mA; BLE active 102 mA; mic recording + SD write 54.58 mA avg / 86.7 mA peak. — [Seeed wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/)
- ESP32-S3 chip-level: Wi-Fi receiver 88 mA (single core 80 MHz), light sleep 380 µA; a DevKitM-1 measured ~31.7 mA in normal mode at 3.3 V; a DevKitC-1 user couldn't get below 3.5 mA in wake-on-radio because the 7–8 µA spec is bare-chip. — [Deneyap](https://deneyapkart.org/en/docs/guc-tuketimi-esp32-s3), [lucidar.me](https://lucidar.me/en/esp32/power-consumption-of-esp32-s3-devkitm-1/), [Arduino forum](https://forum.arduino.cc/t/esp32-lora-mp3-energy-consumption/1409550)
- ESP-SR CPU load while listening (P4 @ 400 MHz): AFE MR SR ≈ 18.6% of one core total; WakeNet10 3-ch 14.1% of one core; WakeNet9 2.6 ms per 32 ms frame (~8%). — [ESP-SR Benchmark](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/benchmark/README.html)
- ReSpeaker Lite retailer sheet: ~14 µA deep sleep @ 3.8 V, 100 mA charge current (XIAO figures). — [Pakronics](https://pakronics.com.au/products/respeaker-lite-voice-assistant-kit-with-xiao-esp32s3-ss110061601)
- No search result provided a measured microWakeWord or ESP-SR always-listening current. — [search summary: HA blog](https://home-assistant.io/blog/2024/02/21/voice-chapter-6)

### Inferences
- Order-of-magnitude estimate (inference, not measured): an ESP32-S3 listening with AFE+WakeNet and Wi-Fi in modem-sleep lands roughly in the 50–80 mA band (XIAO's 44 mA modem-sleep + mic/AFE load), i.e. a 1000 mAh LiPo gives on the order of 12–20 h of always-listening, far less during streaming (110 mA+). A P4 + C6 pair adds the C6 radio and SDIO host overhead; no data to quantify.
- Boards with a hardware mute or mic power switch (HA PE) or PMIC (CoreS3 AXP2101) make power gating easier; XIAO Sense's 3 mA deep-sleep floor is board-level, so true sleep budgeting needs the bare module or a custom board.

### Gaps
- No measured always-listening current for any surveyed board with ESP-SR or microWakeWord running.
- No ESP32-P4 or ESP32-C6 board-level current figures found.
- No XMOS-board power measurements.
