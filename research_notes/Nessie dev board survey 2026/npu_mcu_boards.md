# NPU-equipped MCU dev boards with onboard microphones (tinyML / "edge AI" tier, no Linux) — survey as of 2026-10-19

Scope note: research was done 2026-10-19 via web search + page fetches. Several vendor PDFs (ST data brief, Arduino Nicla Voice datasheet, Infineon product brief) could not be text-extracted by the fetch tool, and the web-search budget ran out before every gap was closed; those items are marked UNVERIFIED. Prices are distributor list prices in USD unless noted, captured on undated/variously-dated distributor pages — re-check before buying. Renesas RZ/V2 kits are Linux-class (Cortex-A) and were not researched beyond noting they fall outside the "no Linux" constraint (UNVERIFIED in this pass).

## Key Question 1 — Per-board fact sheets (NPU, RAM, mics, audio out, battery, wireless, size, price, availability, SDK maturity, hobbyist friendliness)

### Takeaway
No single board combines everything Nessie wants (NPU + ≥4 MB RAM + mics + speaker amp + WiFi + LiPo PMIC + hobbyist tooling). The closest "big-RAM NPU" MCU boards (STM32N6570-DK 4.2 MB SRAM; Alif E7/E8 kits up to 13.5 MB SRAM; NXP i.MX RT700 EVK 7.5 MB SRAM; Infineon PSoC Edge E84 AI kit) are $90–$375 dev boards without battery/PMIC and mostly without WiFi/BLE (the Infineon AI kit is the exception with an onboard AIROC WiFi/BT module). The small battery-friendly boards (Nicla Voice, Thingy:53, XIAO nRF54LM20, Nano 33 BLE Sense Rev2) have ≤512 KB RAM and are keyword-spotting-only.

### Cited Findings

#### STMicro STM32N6570-DK (Neural-ART NPU)
- MCU STM32N657X0H3Q: Arm Cortex-M55 up to 800 MHz; NPU "ST Neural-ART Accelerator @ 1 GHz, 600 GOPS"; "first STM32 with a custom NPU" — [CNX Software](https://www.cnx-software.com/?p=142105)
- ST wiki: Neural-ART NPU "600 GOPS and 3 TOPS/W" — [ST wiki](https://wiki.st.com/stm32mcu/index.php?curid=3863)
- RAM: 4.2 MB contiguous on-chip SRAM; board adds 1-Gbit Octo-SPI flash and 256-Mbit (32 MB) Hexadeca-SPI PSRAM — [Zephyr board docs](https://docs.zephyrproject.org/boards/st/stm32n6570_dk/doc/index.html)
- Mics: one onboard MEMS digital mic; stereo headset jack incl. analog mic input; audio MEMS daughterboard expansion connector; WM8904 audio codec on SAI (headphone out; no speaker amp mentioned) — [ST product page](https://st.com/en/evaluation-tools/stm32n6570-dk.html); [Zephyr board docs](https://docs.zephyrproject.org/boards/st/stm32n6570_dk/doc/index.html)
- Wireless: none onboard; wired 1-Gbit Ethernet (RTL8211F PHY). Also 5" touch LCD, 5-MP CSI camera. Powered via ST-LINK USB — [Zephyr board docs](https://docs.zephyrproject.org/boards/st/stm32n6570_dk/doc/index.html)
- Price: $185 at launch (CNX, undated); RS Thailand THB 9,184 indicative — [CNX Software](https://www.cnx-software.com/?p=142105); [RS Online TH](https://th.rs-online.com/web/p/microcontrollers/0266775). Current US distributor price UNVERIFIED (Mouser pages fetched did not expose price).
- Battery/PMIC: none found (UNVERIFIED — data brief PDF not parsed). Board size: UNVERIFIED.
- SDK: STM32Cube.AI / ST Edge AI suite; ST case study shows a partner running a real-time speech-enhancement NN "using only on-chip computing and memory" — [ST Edge AI case study](https://www.st.com/content/st_com/en/st-edge-ai-suite/case-studies/how-edge-ai-is-redefining-clear-speech-in-a-noisy-world.html)
- Hobbyist: Elektor Labs project "Portable Voice Assistant with STM32N6" recognizes commands like "Turn on the LED" with a TFLite model — [Elektor](https://www.elektormagazine.com/labs/portable-voice-assistant-with-stm32n6); Zephyr upstream support exists — [Zephyr](https://docs.zephyrproject.org/boards/st/stm32n6570_dk/doc/index.html)

#### Alif Semiconductor Ensemble E7 — AK-E7-AIML AppKit and DK-E7 DevKit (Ethos-U55)
- E7: two Cortex-M55 (400 MHz + 160 MHz), two Ethos-U55 (256-MAC + 128-MAC, "250 GOPS" combined; alternatively quoted as "up to 204 GOPS" + "up to 46 GOPS"), two Cortex-A32 — [Mouser DK-E7](https://www.mouser.in/en/new/alif-semiconductor/alif-semi-dk-e7-development-kit/); [CNX Software](https://www.cnx-software.com/2022/12/11/alif-ensemble-cortex-a32-cortex-m55-chips-feature-ethos-u55-ai-accelerator/)
- Memory: up to 5.5 MB MRAM and up to 13.5 MB SRAM on-chip; M55-HP core has 1.25 MB TCM, M55-HE 512 KB ECC SRAM — [CNX Software](https://www.cnx-software.com/2022/12/11/alif-ensemble-cortex-a32-cortex-m55-chips-feature-ethos-u55-ai-accelerator/)
- Chip audio I/O: 4x 2-channel PDM mic inputs + 4x 2-channel low-power PDM inputs; supply 1.75–4.2 V (battery-direct range); "aiPM" power domains — [CNX Software](https://www.cnx-software.com/2022/12/11/alif-ensemble-cortex-a32-cortex-m55-chips-feature-ethos-u55-ai-accelerator/); [Mouser DK-E7](https://www.mouser.in/en/new/alif-semiconductor/alif-semi-dk-e7-development-kit/)
- AppKit AK-E7-AIML: on-board PDM and I2S microphones (two each), 4.3" LCD, camera module, pre-built demos (vision-focused) — [Mouser AK-E7-AIML](https://www.mouser.in/en/new/alif-semiconductor/alif-semi-ak-e7-aiml-ensemble-appkit/)
- AppKit price: $249.00 at qty 1, 37 in stock (Mouser Honduras storefront, USD) — [Mouser](https://www.mouser.hk/alif-semi-ak-e7-aiml-ensemble-appkit). DK-E7 price UNVERIFIED (Mouser page timed out).
- Wireless: none mentioned on either kit (UNVERIFIED). Battery/PMIC on kit: UNVERIFIED.
- SDK: Edge Impulse officially supports both E7 DevKit and AppKit — [Edge Impulse docs](https://docs.edgeimpulse.com/docs/edge-ai-hardware/mcu-+-ai-accelerators/alif-ensemble-e7); Sensory VoiceHub has an Alif/Ethos-U55-128 and -256 output target — [Sensory docs](https://doc.sensory.com/tnl/7.9/reference/voicehub/)

#### Alif Ensemble E8 DevKit DK-E8 (Ethos-U85)
- E8: two Cortex-M55, two Ethos-U55 + one Ethos-U85, two Cortex-A32; datasheet blurb "up to 450 GOPS" (family figure, not U85 alone) — [Alif E8 DevKit page](https://alifsemi.com/support/kits/ensemble-e8devkit/)
- Kit: two I2S/PDM microphone ports, two MIPI cameras, on-board J-Link — [Mouser DK-E8](https://www.mouser.ch/new/alif-semiconductor/alif-semi-dk-8-ensemble-e8-development-kit/)
- Price: $249.00, "new product" at Mouser — [Mouser DK-E8](https://www.mouser.ch/new/alif-semiconductor/alif-semi-dk-8-ensemble-e8-development-kit/)
- Tooling: Arm Learning Path runs a diffusion model on E8's Ethos-U85 (needs Alif SETOOLS ≥1.110.00, J-Link ≥8.42) — [Arm Learn](https://learn.arm.com/learning-paths/embedded-and-microcontrollers/generate-faces-alif-e8/set-up-the-devkit/)
- No speech/ASR demo listed on Alif's E8 page — [Alif](https://alifsemi.com/support/kits/ensemble-e8devkit/)

#### Arduino Nicla Voice (Syntiant NDP120)
- NDP120: Syntiant Core 2 DNN engine + HiFi 3 DSP + Cortex-M0 @48 MHz; companion nRF52832 (Cortex-M4 64 MHz, 512 KB flash, 64 KB RAM) in u-blox ANNA-B112 module, Bluetooth 5.0 LE — [Arduino store](https://store.arduino.cc/en-bg/products/nicla-voice); [Arduino docs](https://docs.arduino.cc/hardware/nicla-voice/)
- NDP120 RAM: 48 KB SRAM dedicated (per Arduino datasheet as quoted by search); quiescent 1 µA typ / 3 µA max — [SparkFun-hosted ABX00061 datasheet](https://cdn.sparkfun.com/assets/a/e/6/f/c/ABX00061-datasheet.pdf) (PDF not parsed by fetch; figures from search snippet — treat as UNVERIFIED)
- Mic: Infineon IM69D130 digital MEMS; external mic via ZIF connector; BMI270 IMU, BMM150 mag; 16 MB SPI flash; 22.86 x 22.86 mm, ~2 g; battery connector + 3.7 V LiPo charger — [Arduino store](https://store.arduino.cc/en-bg/products/nicla-voice); [Arduino docs](https://docs.arduino.cc/hardware/nicla-voice/)
- Audio output: none found (UNVERIFIED). WiFi: none (BLE only).
- Price: €83.49 (Arduino BE), $82 (Make:), €79.80 (Kubii) — [Arduino store](https://store.arduino.cc/en-be/collections/som/products/nicla-voice); [Make:](https://makezine.com/products/boards/arduino-nicla-voice); [Kubii](https://kubii.com/en/micro-controllers/4639-arduino-nicla-voice-7630049203204.html)
- Availability: in stock at RS Korea with restock Dec 2025; Arduino forum threads active Mar 2026; no EOL notice found — [RS Korea](https://kr.rs-online.com/web/p/arduino/2654984); [Arduino forum](https://forum.arduino.cc/c/official-hardware/nicla-family/169)
- Capability: "always-on speech and motion recognition"; no ASR claimed — [Arduino docs](https://docs.arduino.cc/hardware/nicla-voice/)

#### Syntiant TinyML board (NDP101) / NDP250
- TinyML board (NDP101): DigiKey part SYNTIANT-TINYML, status Active, $35.99 qty 1, ~195 in stock, 20-week lead time; works with Edge Impulse and Arduino — [DigiKey](https://www.digikey.com/en/products/detail/syntiant-corp/SYNTIANT-TINYML/15293343); [EE World](https://www.eeworldonline.com/tinyml-dev-board-includes-neural-processor/)
- NDP250 (announced 9–10 Apr 2024, "sampling now"): Core 3 engine, >30 GOPS, >6M 8-bit params, Cortex-M0 + HiFi 3 DSP, up to 120 MHz, dual PDM mic in, I2S, "always-on image recognition at under 30 mW", 6.1 x 5.1 mm eWLB — [Electronic Specifier](https://www.electronicspecifier.com/?p=31382)
- NDP250 is marketed for "integrating ASR and TTS directly into devices"; no dev board, WER, or availability for a kit found — [Electronic Specifier](https://www.electronicspecifier.com/?p=31382); [GlobeNewswire](https://www.globenewswire.com/fr/news-release/2024/04/09/2859793/0/en/syntiant-unveils-ndp250-neural-decision-processor-with-next-gen-core-3-architecture.html) (403 on fetch)

#### Nordic Thingy:53 (nRF5340 — no NPU) and nRF54 boards (nRF54LM20B — Axon NPU)
- Thingy:53: nRF5340 dual Cortex-M33; app core 128 MHz, 1 MB flash, 512 KB RAM; net core 64 MHz, 256 KB flash, 64 KB RAM — [Nordic nRF5340 PS](https://docs.nordicsemi.com/r/bundle/ps_nrf5340/page/chapters/soc_overview/doc/soc_overview.html)
- Thingy:53 has a MEMS mic and buzzer; PDM mic can wake the SoC from standby on sound; rechargeable battery in enclosure (per Nordic/Rutronik) — [Nordic](https://www.nordicsemi.com/Home/Products/Development%20hardware/Nordic%20Thingy%2053/GetStarted?lang=zh-CN); [Rutronik](https://rutronik.com/article/easy-handling-for-complex-applications-prototyping-platform-nordic-thingy53-at-rutronik)
- Thingy:53 price: $61.25 DigiKey (121 in stock); $60.53 Future (14-wk lead) — [DigiKey](https://www.digikey.com/en/product-highlight/n/nordic-semi/nordic-thingy-53-iot-prototyping-platform); [Future](https://www.futureelectronics.com/p/8205208). No NPU — Edge Impulse/TFLM on CPU only.
- nRF54H20 DK: no built-in accelerometer/mic noted; no NPU found — [Nordic ML app docs](https://nrfconnectdocs.nordicsemi.com/ncs/latest/nrf/applications/machine_learning/app_desc.html)
- nRF54LM20B: 128 MHz integrated Axon NPU, 2 MB NVM, 512 KB RAM; BLE / Channel Sounding / Matter / Thread / Zigbee; no WiFi; Edge AI Add-on for nRF Connect SDK — [Nordic nRF54LM20 DK](https://www.nordicsemi.com/Products/Development-hardware/nRF54LM20-DK)
- nRF54LM20 DK: $39.00 at DigiKey, 2-week lead (CNX, undated); announced at Embedded World 2026; no onboard mic listed — [CNX](https://www.cnx-software.com/?p=172935); [audioXpress](https://audioxpress.com/news/nordic-semiconductor-strengthens-ultra-low-power-on-device-ai-portfolio-for-battery-powered-designs); [Future](https://www.futureelectronics.com/en/resources/featured-products/nordic-semiconductor-nrf54lm20-dk-development-kit)
- Axon NPU "up to 15x faster than the Cortex-M33" and up to 15x better energy efficiency; demo = "Okay Nordic" wakeword + 10 keywords; "larger vocabularies or NLU call for a more powerful SoC or cloud" — [Novel Bits, 21 May 2026, Nordic-sponsored](https://novelbits.io/nordic-axon-voice-workout-tracker/)
- Seeed XIAO nRF54LM20A Sense: PDM mic, 6-axis IMU, 512 KB RAM, 2 MB NVM + 8 MB flash, nPM1300 PMIC for 3.7 V LiPo, 21 x 17.5 mm, ~$16 pre-order, shipping from 15 Jul 2026; nRF54LM20B (Axon NPU) XIAO variants "expected end of Q3 2026" — [CNX, 30 Jun 2026](https://www.cnx-software.com/2026/06/30/xiao-nrf54lm20a-sense-board-enables-ultra-low-power-bluetooth-6-0-matter-thread-zigbee-or-2-4-ghz-proprietary-applications/)

#### NXP FRDM-MCXN947 (eIQ Neutron NPU)
- MCX N947: dual Cortex-M33 @150 MHz, 2 MB flash, 1 MB RAM (NXP page) — [NXP](https://www.nxp.com/design/design-center/development-boards-and-designs/FRDM-MCXN947); Elektor/RS quote 512 KB RAM — [Elektor](https://elektor.com/products/get-started-with-the-nxp-frdm-mcxn947-development-board-bundle) (conflict: NXP's own page says 1 MB)
- NPU: eIQ Neutron, no GOPS figure published on NXP page — [NXP](https://www.nxp.com/design/design-center/development-boards-and-designs/FRDM-MCXN947)
- Mic: none listed on board; MCU has PDM MICFIL interface — [NXP](https://www.nxp.com/design/design-center/development-boards-and-designs/FRDM-MCXN947); [Zephyr](https://docs.zephyrproject.org/latest/boards/nxp/frdm_mcxn947/doc/index.html)
- Wireless: none; WiFi connector (PMOD/mikroBUS) is DNP — [NXP](https://www.nxp.com/design/design-center/development-boards-and-designs/FRDM-MCXN947)
- Price: $25.00 NXP ("Pending Stock"); $23.17 Future — [NXP](https://www.nxp.com/design/design-center/development-boards-and-designs/FRDM-MCXN947); [Future](https://futureelectronics.com/p/development-tools--microcontroller-microprocessor--32-bit-eval-board/frdm-mcxn947-nxp-9181293)

#### NXP i.MX RT700 EVK (MIMXRT700-EVK, eIQ Neutron NPU)
- SoC: Cortex-M33 @325 MHz + HiFi 4 DSP @325 MHz + eIQ Neutron NPU @325 MHz (main); Cortex-M33 @250 MHz + HiFi 1 (sense); EZH-V RISC-V; 7.5 MB on-chip SRAM; xSPI PSRAM on board; WM8962 codec; DMIC interface up to 8 ch — [Zephyr](https://docs.zephyrproject.org/latest/boards/nxp/mimxrt700_evk/doc/index.html)
- Onboard mics: not listed in Zephyr docs; NXP sells a separate "Configurable Digital Microphone Board" — [NXP](https://www.nxp.com/design/design-center/development-boards-and-designs/MIMXRT700-EVK). Mic count on EVK UNVERIFIED.
- Wireless: none mentioned — [Zephyr](https://docs.zephyrproject.org/latest/boards/nxp/mimxrt700_evk/doc/index.html)
- Price: $201.12 qty 1 (Future, 2 in US stock, 13-week lead); ~€207 Farnell — [Future](https://www.futureelectronics.com/p/3209470?utm=API); [Farnell](https://ee.farnell.com/nxp/mimxrt700-evk/evaluation-kit-32bit-arm-cortex/dp/4848969)

#### Infineon PSoC Edge E84 kits (Ethos-U55 + NNLite)
- PSoC Edge E84: Cortex-M55 + Helium + Ethos-U55 NPU, plus low-power Cortex-M33 + NNLite ultra-low-power NPU — [DigiKey](https://www.digikey.com/en/product-highlight/i/infineon/kitpse84evaltobo1-psoc-edge-device-functional-evaluation)
- Eval Kit KITPSE84EVALTOBO1: analog + PDM mics, headphone connector, speaker, 4.3" display, USB camera; $373.20 DigiKey (Oct 2025 listing) — [DigiKey](https://www.digikey.com/en/product-highlight/i/infineon/kitpse84evaltobo1-psoc-edge-device-functional-evaluation); [Zephyr](https://docs.zephyrproject.org/latest/boards/infineon/kit_pse84_eval/doc/index.html)
- AI Kit KITPSE84AITOBO1: two analog mics (I2S) + two digital mics (PDM); radar/pressure/IMU; 128-Mb Octal HyperRAM; Wi-Fi + Bluetooth via LBEE5HY2FY module (AIROC CYW55513); OV7675 camera; $91.38 DigiKey (19 in stock) — [Infineon product brief](https://www.infineon.com/assets/row/public/documents/30/45/infineon-psoc-edge-e84-ai-kit-product-brief.pdf); [Zephyr](https://docs.zephyrproject.org/latest/boards/infineon/kit_pse84_ai/doc/index.html); [DigiKey](https://www.digikey.com/en/videos/i/infineon-technologies/meet-the-psoc-edge-microcontroller-family-infineon-technologies)
- SDK: DEEPCRAFT Studio with "ready to deploy ML models" and "support for voice, audio, and vision" — [Future](https://www.futureelectronics.com/en/resources/featured-products/infineon-psoc-edge-microcontrollers-for-machine-learning)
- On-chip SRAM size, Ethos-U55 MAC config, battery/PMIC: UNVERIFIED (search budget exhausted; product brief PDF not parsed).

#### Ambiq Apollo510 EVB (AP510EVB) / Apollo4 Plus
- Apollo510: Cortex-M55 + Helium up to 250 MHz; 4 MB NVM, 3.75 MB SRAM (top config; brief lists 1–4 MB NVM / 1.15–3.75 MB SRAM); 1x LP always-on audio ADC, 2x PDM DMIC, 2x I2S — [CNX](https://www.cnx-software.com/2024/03/28/ambiq-apollo510-arm-cortex-m55-mcu-delivers-up-to-30x-better-power-efficiency-for-ai-ml-workloads/); [Ambiq product brief](https://contentportal.ambiq.com/documents/20123/2877485/Apollo510-SoC-Product-Brief-A4.pdf)
- No dedicated NPU: AI runs on M55/Helium; vendor claims "16x better latency / >2x lower power vs Apollo4 Plus" — [Mouser](https://www.mouser.it/new/ambiq/ambiq-ap510evb-board)
- EVB has "ultra-low power analog microphone ADC for always-on voice processing" — [Mouser](https://www.mouser.it/new/ambiq/ambiq-ap510evb-board). Mic count, speaker, wireless, battery: UNVERIFIED.
- Price: $262.49 qty 1, 8-week lead (Future) — [Future](https://www.futureelectronics.com/p/8190111)
- SDK: neuralSPOT v1.2.0 beta (open source) examples: keyword spotting, speech enhancement, speaker ID, HAR, ECG; pipelines listed: KWS, speech-to-intent, speech enhancement, speaker ID — [Ambiq news](https://ambiq.com/news/ambiq-expands-ai-development-support-with-neuralspot-sdk-v1-2-0-beta-for-apollo510-and-apollo510b/); [Ambiq neuralSPOT](https://ambiq.com/cn/technology/neuralspot/)
- Apollo4 Plus EVB price and Ambiq "voice kit" details: UNVERIFIED (search budget exhausted).

#### Renesas EK-RA8P1 (Ethos-U55); RZ/V2 (Linux-class)
- RA8P1: Cortex-M85 @1 GHz + Cortex-M33 @250 MHz + Ethos-U55 @500 MHz = 256 GOPS; 2 MB SRAM (1.6 MB ECC), 0.5/1 MB MRAM, optional 4/8 MB flash SiP; 3x PDM for mic array, 2x SSIE — [CNX, 2 Jul 2025](https://www.cnx-software.com/2025/07/02/renesas-r8p1-a-1-ghz-arm-cortex-m85-microcontroller-with-ethos-u55-npu-for-audio-and-vision-ai-applications/)
- EK-RA8P1: PDM MEMS microphones + audio codec with speaker-out; 64 MB SDRAM; GbE; 7" LCD; 5-MP camera; $195.98 Mouser — [Wevolver spec page](https://www.wevolver.com/specs/renesas-electronics-ek-ra8p1-evaluation-kit); [CNX](https://www.cnx-software.com/2025/07/02/renesas-r8p1-a-1-ghz-arm-cortex-m85-microcontroller-with-ethos-u55-npu-for-audio-and-vision-ai-applications/)
- Renesas positions RA8P1 for "voice AI (KWS, ASR, and NLP)" on Ethos-U55 — [Mouser PR](https://www.mouser.co.il/newsroom/publicrelations-renesas-ra8p1-mcus-2025final); Cyberon DSpotterNLU for RA8: Flash 250–900 KB, RAM 200–230 KB, command/NLU (not dictation) — [Renesas](https://renesas.com/en/document/prb/cyberon-dspotternlu)
- Wireless on EK-RA8P1: not mentioned (UNVERIFIED). RZ/V2 (DRP-AI): Cortex-A Linux class — out of scope; not researched (UNVERIFIED).

#### Google Coral Dev Board Micro
- NXP i.MX RT1176 (M7 @800 MHz + M4 @400 MHz), Coral Edge TPU 4 TOPS int8, 64 MB SDRAM, 128 MiB NAND, 324x324 camera, one PDM mono mic (3 unused PDM lanes); WiFi/PoE are separate add-ons — [Coral datasheet](https://coral.ai/static/files/Coral-Dev-Board-Micro-datasheet.pdf); [CNX](https://www.cnx-software.com/2023/02/04/coral-dev-board-micro-nxp-i-mx-rt1176-mcu-edge-tpu-raspberry-pi-zero/)
- Launch price $79.99 — [Make:](https://makezine.com/?p=562020)
- Availability: Mouser India flags it "Scheduled for obsolescence and will be discontinued by the manufacturer"; coral.ai product URL now redirects to developers.google.com/coral, which has no buy link — [Mouser](https://www.mouser.in/en/c/embedded-solutions/engineering-tools/embedded-processor-development-kits/?b=Coral); [developers.google.com/coral](https://developers.google.com/coral)

#### Himax WiseEye2 HX6538 — Seeed Grove Vision AI Module V2
- HX6538: Cortex-M55 @400 MHz + Cortex-M55 @150 MHz + Ethos-U55 @400 MHz; up to 2432 KB SRAM; 16 MB flash on module; onboard PDM mic; MIPI CSI (OV5647); ~0.35 W (retailer figure) — [CNX](https://www.cnx-software.com/?p=123856); [Seeed wiki](https://wiki.seeedstudio.com/grove_vision_ai_v2/)
- No onboard wireless; "compatible with XIAO boards" (wireless via a stacked XIAO) — [Seeed wiki](https://wiki.seeedstudio.com/grove_vision_ai_v2/)
- Price: $19.70 RobotShop (sale), £15.40 Pi Hut, $25–29 OpenELab — [RobotShop](https://www.robotshop.com/products/seeedstudio-grove-vision-ai-module-v2-arm-cortex-m55-ethos-u55-arduino-rpi); [Pi Hut](https://thepihut.com/products/grove-vision-ai-module-v2); [OpenELab](https://openelab.com/products/seeed-studio-grove-vision-ai)
- Himax: WE2 "supports audio capabilities, including keyword spotting for voice control"; vision inference ~5 mW; used in Alibaba Qwen Glasses N1 (Oct 2026 report) — [GlobeNewswire](https://www.globenewswire.com/news-release/2023/12/20/2799063/8267/en/Himax-to-Present-Innovative-Solutions-for-tinyML-Opportunities-with-WiseEye-AI-During-CES-2024.html); [Unite.ai](https://www.unite.ai/?p=485700)
- Tooling: SenseCraft AI no-code, Arduino (Seeed_Arduino_SSCMA), Home Assistant, TF/PyTorch; vision-model-centric — [Seeed wiki](https://wiki.seeedstudio.com/grove_vision_ai_v2/)

#### Arduino Nano 33 BLE Sense Rev2 (no NPU — baseline)
- nRF52840 Cortex-M4 @64 MHz (256 KB RAM / 1 MB flash per Nordic; not re-verified here — UNVERIFIED), mic MP34DT06JTR (Arduino) vs MP34DT05 (SparkFun, conflicting), BMI270/BMM150, LPS22HB — [Arduino store](https://store.arduino.cc/en-de/collections/boards-modules/products/nano-33-ble-sense-rev2); [SparkFun](https://www.sparkfun.com/products/15580)
- Price: €45–47 Arduino EU; $39.70 Newegg Business; SparkFun listing retired — [Arduino store](https://store.arduino.cc/en-ie/collections/wearables/products/nano-33-ble-sense-rev2); [Newegg](https://www.neweggbusiness.com/p/9B-3D0-001E-00043)
- Picovoice Porcupine (wake word) officially supports this board — [Picovoice](https://picovoice.ai/docs/quick-start/porcupine-microcontroller)

#### New 2025–2026 entrants
- Espressif ESP32-S31 (mass production announced 27 Jul 2026, $4.51 launch): dual RISC-V @320 MHz with 128-bit SIMD "AI instruction-set acceleration" (not a discrete NPU), 512 KB SRAM, 250 MHz PSRAM, WiFi 6 2.4 GHz, ESP-DL — [Hackster](https://www.hackster.io/news/espressif-s-esp32-s31-dual-core-edge-smarts-microcontroller-hits-the-mainstream-launches-at-4-51-f616e6fc1716); [Espressif S31 page](https://esp32-s31.espressif.com/en/official-projects/6); [Components101](https://components101.com/news/espressif-esp32-s31-risc-v-soc-enters-mass-production)
- Espressif posted an "NPU design engineer" job (5 Jan 2026) — indicates in-house NPU work, not a product — [Espressif careers](https://www.espressif.com/zh-hans/job-detail/XVt)
- Ethos-U85: announced Apr 2024, up to 4 TOPS; Alif (E8) and Infineon disclosed as licensees — [MONOist](https://monoist.itmedia.co.jp/mn/articles/2404/09/news066.html). The only shipping U85 dev kit found is Alif DK-E8 ($249).
- Nordic nRF54LM20B Axon NPU DK ($39) and Seeed XIAO nRF54LM20B (end Q3 2026) — see Nordic section above.

### Inferences
- For Nessie's "wake word + VAD on device, stream to server" baseline, RAM-light NPU boards (Nicla Voice, nRF54LM20, Grove Vision AI V2) suffice, but only Nicla Voice and the XIAO nRF54LM20 Sense ship with a LiPo charger/PMIC in a plush-friendly footprint; none has WiFi (BLE only) so the server link would be BLE or a second radio.
- For local open-vocab ASR, only the ≥4 MB-SRAM class (STM32N6, Alif E7/E8, i.MX RT700, possibly PSoC Edge) is plausible, and these are large dev boards without battery management — a custom PCB would be needed for a toy.
- The Infineon PSoC Edge E84 AI kit ($91) is the only surveyed NPU board with onboard WiFi/BT + mics + NPU; its SRAM is unverified so ASR suitability is unknown.

### Gaps
- STM32N6570-DK current US price, board dimensions, battery options (ST data brief PDF unparsed; search budget exhausted).
- Alif DK-E7 price; Alif kit wireless/battery; Alif always-on-voice current figures.
- PSoC Edge E84 on-chip SRAM, Ethos-U55 MAC count, battery support.
- i.MX RT700 EVK onboard mic count; FRDM-MCXN947 RAM conflict (1 MB per NXP vs 512 KB per Elektor/RS).
- Ambiq AP510EVB mic/speaker/wireless/battery; Apollo4 Plus EVB price; Ambiq voice kits.
- EK-RA8P1 wireless; Renesas RZ/V2 kits (Linux-class, not researched).
- Nicla Voice power figures and PMIC part (datasheet PDF unparsed).
- Coral Dev Board Micro definitive EOL statement from Google (only distributor obsolescence flag found).

## Key Question 2 — Which boards have VENDOR-demonstrated on-device open-vocabulary ASR (not keyword spotting)? Demos, WER, RTF, memory

### Takeaway
No vendor-published open-vocabulary ASR demo with WER/RTF/memory numbers was found for any surveyed board. The strongest evidence is a community project (Oct 2026) running a 7.2M-parameter CTC-style ASR model on the STM32N6570-DK NPU at 5.32% WER (LibriSpeech test-clean), and Sensory's "large vocabulary" TrulyNatural engine (domain-constrained, 1.6 MB model) on Alif Ensemble E3 Ethos-U55. No Whisper/Moonshine port to any Cortex-M/Ethos-U board was found.

### Cited Findings
- STM32N6570-DK community ASR (GitHub fotonik-sk/stm32n6-asr, article 8 Oct 2026): CynipsNet v1.0, 7.2M params, log-mel on CPU, model on Neural-ART NPU; WER greedy/no LM: dev-clean 5.22, dev-other 14.73, test-clean 5.32%, test-other 14.84%; ~0.2 W peak (unoptimized); English only, uppercase no punctuation, best within ~1 m, "not suited to long-form dictation (needs 100 MB+ models)"; weights CC BY-NC-SA 4.0 (non-commercial), code Apache-2.0; RTF and RAM/flash NOT reported — [CircuitDigest](https://circuitdigest.com/news/this-stm32n6-turns-speech-into-text-offline-using-its-npu-and-a-7-2m-parameter-asr-model); [GitHub](https://github.com/fotonik-sk/stm32n6-asr)
- This is NOT an ST-official release; ST's own N6 audio material covers speech enhancement and command recognition — [ST case study](https://www.st.com/content/st_com/en/st-edge-ai-suite/case-studies/how-edge-ai-is-redefining-clear-speech-in-a-noisy-world.html); [Elektor](https://www.elektormagazine.com/labs/portable-voice-assistant-with-stm32n6)
- Sensory TrulyNatural on Alif Ensemble E3 (Cortex-M55 + Ethos-U55): "speech recognition runs primarily on the Ethos-U55"; "large vocabulary language model" for appliance control shrunk from 17 MB to 1.6 MB; no vocabulary size, WER, power, or date given — [Arm success story](https://www.arm.com/company/success-library/made-possible/sensory); [Sensory news](https://sensory.com/news/sensory-speech-technologies-on-arm-ip-cortex-m-ethos-u-micronpu/)
- Arm (Hot Chips 2020, RTL simulation): M55+U55 "50x speed-to-inference vs Cortex-M7" on a speech-recognition workload; Arm says the pair enables "to some extent, automatic speech recognition" — [Arm Hot Chips PDF](https://www.hc32.hotchips.org/assets/program/conference/day1/HotChips2020_Edge_Computing_Arm_Cortex-M55.pdf); [Arm blog](https://developer.arm.com/community/arm-community-blogs/b/architectures-and-processors-blog/posts/cortex-m55-and-ethos-u55-processors-extending-the-performance-of-arm-ml-portfolio-for-endpoint-devices)
- Arm Learn's Whisper tutorial (2026) targets Linux, not MCUs — [learn.arm.com](https://learn.arm.com/tag/whisper/)
- Renesas markets RA8P1 for "KWS, ASR, and NLP" on Ethos-U55 but no ASR demo page found — [Mouser PR](https://www.mouser.co.il/newsroom/publicrelations-renesas-ra8p1-mcus-2025final)
- Syntiant NDP250 marketed for integrating ASR + TTS as an LLM speech front end; no WER/latency given; no eval board — [Electronic Specifier](https://www.electronicspecifier.com/?p=31382)
- Ambiq neuralSPOT examples: KWS, speech enhancement, speaker ID, speech-to-intent — no transcription example — [Ambiq](https://ambiq.com/news/ambiq-expands-ai-development-support-with-neuralspot-sdk-v1-2-0-beta-for-apollo510-and-apollo510b/)
- Nordic Axon demo: wakeword + 10 keywords; author states larger vocab/NLU needs "a more powerful SoC or cloud inference" — [Novel Bits](https://novelbits.io/nordic-axon-voice-workout-tracker/)
- Moonshine Tiny streaming (34M params, 12.00% WER) vs Whisper Tiny (39M, 12.81% WER) benchmarked on Raspberry Pi 5, not MCUs; smallest Moonshine models ~26 MB — [Moonshine docs](https://moonshine-voice.readthedocs.io/en/latest/moonshine-vs-whisper/); [GitHub mirror](https://github.com/thinhlpg/moonshine)
- Alif E8 (Ethos-U85) DevKit page lists no speech/ASR demo — [Alif](https://alifsemi.com/support/kits/ensemble-e8devkit/)

### Inferences
- A 7.2M-param int8 CTC model (~7–8 MB weights) fits the STM32N6's 4.2 MB SRAM + external PSRAM/flash; similar models should port to Alif E7 (13.5 MB SRAM) and i.MX RT700 (7.5 MB SRAM) but no one has published this.
- Whisper-tiny-class models (39M params ≈ 40 MB int8, 30-s fixed windows) exceed all surveyed on-chip SRAM; any MCU deployment would need external RAM and heavy custom work — consistent with zero demos found.
- For Nessie, the realistic split remains: on-device wake word/VAD/KWS, server-side Whisper.

### Gaps
- No RTF or memory footprint for the STM32N6 ASR project (author says unoptimized).
- No Sensory TrulyNatural vocabulary size / WER on Alif.
- The planned search for "Ethos-U85 + Whisper" (Arm/Alif blogs) could not be run — search budget exhausted. UNVERIFIED whether such a demo exists.
- No independent benchmarks of any MCU ASR.

## Key Question 3 — Do Picovoice, Sensory, Cyberon, or Edge Impulse offer open-vocab STT on any MCU?

### Takeaway
No. Picovoice's Cheetah/Leopard STT list only Linux/macOS/Windows/Android/iOS/Web/Raspberry Pi; only Porcupine (wake word), Rhino (intent) and Cobra (VAD) have MCU SDKs. Cyberon DSpotterNLU and Sensory TrulyNatural are command/NLU engines with constrained grammars (Sensory's "large vocabulary" is domain-specific). Edge Impulse offers keyword/audio classification only.

### Cited Findings
- Picovoice Cheetah supported platforms: Linux x86_64, macOS, Windows, Android, iOS, Web, Raspberry Pi 3/4/5 — no microcontroller — [Picovoice Cheetah docs](https://picovoice.ai/docs/cheetah/)
- Picovoice Porcupine MCU quick start lists Arduino Nano 33 BLE Sense and STM32F411E-DISCO (Cortex-M4); Cheetah/Leopard have no "Microcontroller" quick start — [Picovoice](https://picovoice.ai/docs/quick-start/porcupine-microcontroller); STM32F407 voice assistant tutorial uses Porcupine + Rhino — [Picovoice blog](https://picovoice.ai/blog/offline-voice-assistant-on-an-stm32-microcontroller/)
- Picovoice ESP32 support issue (2021) closed with "interested in adding support" — status dated/UNVERIFIED — [Lightrun mirror](https://lightrun.com/answers/picovoice-picovoice-esp-32-support)
- Cyberon DSpotterNLU: "build applications from text input, no training data required"; Flash 250–900 KB, RAM 200–230 KB on RA8; command + NLU — [Renesas](https://renesas.com/en/document/prb/cyberon-dspotternlu); grammar-constrained, runs even on RA2 (M0/M23) — [Renesas/Cyberon white paper](https://renesas.com/us/en/document/whp/renesas-cyberon-speech-recognition)
- Sensory TrulyNatural on Alif E3: domain "large vocabulary" model 1.6 MB; VoiceHub exports Alif Ethos-U55-128/256 targets — [Arm](https://www.arm.com/company/success-library/made-possible/sensory); [Sensory VoiceHub docs](https://doc.sensory.com/tnl/7.9/reference/voicehub/)
- Edge Impulse MCU audio examples are keyword spotting (e.g., "yes/no", 23-keyword CNN on Nano 33 BLE Sense); ESP32 projects are wake word + on/off commands — [Seeed wiki](https://wiki.seeedstudio.com/edgeimpulse/); [arXiv 2504.16213](https://arxiv.org/abs/2504.16213); [Hackster](https://www.hackster.io/CircuitDigest/offline-esp32-voice-recognition-with-edge-impulse-fc93c9)
- Edge Impulse officially supports Alif E7 DevKit/AppKit — [Edge Impulse](https://docs.edgeimpulse.com/docs/edge-ai-hardware/mcu-+-ai-accelerators/alif-ensemble-e7); Syntiant TinyML board works with Edge Impulse — [EE World](https://www.eeworldonline.com/tinyml-dev-board-includes-neural-processor/)

### Inferences
- Commercial MCU voice stacks all stop at wake word + constrained command/NLU; this is a market signal that open-vocab STT on MCU is not yet productized.

### Gaps
- Sensory's actual vocabulary limits and licensing cost for TrulyNatural on MCU not found.
- Whether Picovoice has added ESP32-S3/P4 Porcupine support since 2021 — UNVERIFIED.

## Key Question 4 — Realistic power consumption for always-listening wake word mode

### Takeaway
Dedicated audio NPUs and tiny NPU-MCUs achieve sub-mW to ~1.5 mW system-level always-listening: Syntiant NDP120 <280 µW for "Hey Google"; Nordic nRF54LM20B Axon wakeword net ~92 µA avg, ~1.5 mA whole system incl. mic. Big NPU MCUs (STM32N6) have no published always-on KWS figure; the N6 ASR project draws ~0.2 W peak during inference.

### Cited Findings
- Syntiant NDP120 activates Google Assistant at "under 280 µW" listening for "Hey Google"/"Ok Google" — [New Electronics](https://newelectronics.co.uk/content/news/edge-ai-chip-company-syntiant-announces-support-for-google-keywords); NDP10x class described as ~1 mW voice command chip — [Electronic Design](https://www.electronicdesign.com/technologies/embedded/article/21152263/startup-rolls-out-on-device-voice-command-chip-that-runs-on-1mw)
- NDP120 quiescent 1 µA typ / 3 µA max (Arduino Nicla Voice datasheet, via search snippet) — [SparkFun-hosted datasheet](https://cdn.sparkfun.com/assets/a/e/6/f/c/ABX00061-datasheet.pdf) (UNVERIFIED — PDF not parsed)
- Nordic nRF54LM20B Axon: wakeword network ~92 µA average at ~30 ms cadence, ~1.3 ms/inference, ~8.3 µJ/inference, ~3 mA peak; low-power capture 282.84 µA avg incl. deep sleep; full firmware listening floor ~971 µA disconnected / ~831 µA BLE-connected; ~1.5 mA est. whole system incl. external PDM mic — [Novel Bits, May 2026 (Nordic-sponsored)](https://novelbits.io/nordic-axon-voice-workout-tracker/)
- Syntiant NDP250: "always-on image recognition at under 30 mW" (vision, not audio) — [Electronic Specifier](https://www.electronicspecifier.com/?p=31382)
- Himax HX6538: ~5 mW on-device visual inference (vision) — [Unite.ai](https://www.unite.ai/?p=485700)
- STM32N6 ASR project: ~0.2 W peak during feature extraction + inference, unoptimized — [CircuitDigest](https://circuitdigest.com/news/this-stm32n6-turns-speech-into-text-offline-using-its-npu-and-a-7-2m-parameter-asr-model)
- STM32N6 KWS: arXiv 2509.07051 found N6 has best energy-delay product vs H7/U5 for end-to-end KWS, but no standalone mW in excerpt — [arXiv](https://arxiv.org/pdf/2509.07051); ST wiki rates Neural-ART at 3 TOPS/W — [ST wiki](https://wiki.st.com/stm32mcu/index.php?curid=3863)
- Ambiq (2018, Apollo2 era) + Sensory/DSP Concepts: "4x lower power" KWS; multi-mic beamforming pipeline ">1 week on CR2032" — [Ambiq](https://ambiq.com/ambiq-micro-dsp-concepts-and-sensory-join-forces-to-bring-always-on-voice-control-to-portable-battery-operated-devices); Apollo510 claims >2x lower power than Apollo4 Plus, no KWS µW given — [Mouser](https://www.mouser.it/new/ambiq/ambiq-ap510evb-board)
- MEMS mic wake-on-sound mode ~10 µA — [DigiKey article](https://www.digikey.com/en/articles/how-to-reduce-power-consumption-in-always-on-voice-interface-designs)

### Inferences
- A plush toy on a ~2000 mAh LiPo could listen for weeks on an NDP120/Axon-class front end (≈1–2 mA system), but a WiFi radio (ESP32-class) will dominate once streaming starts; a BLE-only front end with WiFi on a separate, duty-cycled MCU is the power-optimal architecture.
- Big-NPU MCUs should be duty-cycled: wake word on a low-power core/NPU, and the 600-GOPS NPU only woken for ASR bursts.

### Gaps
- No published always-listening KWS current for STM32N6, Alif E7/E8, i.MX RT700, PSoC Edge, Apollo510, HX6538 (audio), or RA8P1.
- Nicla Voice board-level battery life not found.
