# Small Linux SBCs / SoMs with NPU for fully on-device ASR (battery plush-toy context)

Research date: 2026-10-19. All prices USD unless noted. Anything not backed by a URL is marked UNVERIFIED. Web-search budget was exhausted before every gap could be closed; gaps are listed per section.

## Key Question 1: Per-board fact sheets (SoC, NPU, RAM, mic/codec/amp, WiFi/BLE, battery, power, size, price, availability, boot, Linux/SDK)

### Takeaway
For a battery-powered plush toy, the Axera AX630C family (M5Stack Module LLM / LLM630 Compute Kit / Sipeed MaixCAM2) is the only class that combines ~0.5 W idle / ~1.5 W load, a vendor-maintained Whisper/SenseVoice/KWS/TTS NPU stack, onboard mic + speaker amp, and a built-in Li-ion charger, at roughly $50–$120. Rockchip RK3588/RK3576 boards have the best-documented NPU Whisper (RTF ~0.2) but idle at 3–5 W with no battery path; Pi 5 + Hailo and Jetson are 4–25 W desk-class parts; RV1106/SG2002/CV1800B sub-$20 boards have no published NPU ASR path.

### Cited Findings

**M5Stack Module LLM (AX630C) — 54×54×13 mm module**
- SoC AX630C, dual Cortex-A53 @1.2 GHz; NPU 3.2 TOPS INT8 / 12.8 TOPS INT4; 4 GB LPDDR4 (1 GB system, 3 GB for acceleration), 32 GB eMMC — [CNX Software](https://www.cnx-software.com/2024/11/05/m5stack-releases-ax630c-powered-offline-module-llm-for-local-smart-home-and-ai-applications/)
- Power: idle 5 V @ 0.5 W, full load 5 V @ 1.5 W (M5Stack official figures reproduced by CNX) — [CNX Software](https://www.cnx-software.com/2024/11/05/m5stack-releases-ax630c-powered-offline-module-llm-for-local-smart-home-and-ai-applications/); [Electronics-Lab](https://www.electronics-lab.com/m5stack-module-llm-ax630c-soc-with-3-2-tops-npu-for-offline-ai-applications/)
- Audio: built-in microphone; 8 Ω 1 W speaker driven by AW8737 audio driver; microSD; USB OTG — [CNX Software](https://www.cnx-software.com/2024/11/05/m5stack-releases-ax630c-powered-offline-module-llm-for-local-smart-home-and-ai-applications/)
- No WiFi on the module itself; 100 Mbps Ethernet only via optional debug kit (designed to stack on an ESP32 M5Stack core for connectivity) — [CNX Software](https://www.cnx-software.com/2024/11/05/m5stack-releases-ax630c-powered-offline-module-llm-for-local-smart-home-and-ai-applications/)
- Size 54×54×13 mm, 17.4 g, operating 0–40 °C — [CNX Software](https://www.cnx-software.com/2024/11/05/m5stack-releases-ax630c-powered-offline-module-llm-for-local-smart-home-and-ai-applications/)
- Price: $49.90 at launch on M5Stack store (out of stock at time of article) — [CNX Software](https://www.cnx-software.com/2024/11/05/m5stack-releases-ax630c-powered-offline-module-llm-for-local-smart-home-and-ai-applications/); Pi Hut UK listed the Module LLM Kit at £53.90 (later "sold out") — [The Pi Hut](https://thepihut.com/products/m5stack-llm-module-kit-ax630c)
- Pre-installed LLM Qwen2.5-0.5B; Qwen2.5-1.5B, Llama3.2-1B, InternVL2-1B planned; KWS/ASR/TTS listed — [CNX Software](https://www.cnx-software.com/2024/11/05/m5stack-releases-ax630c-powered-offline-module-llm-for-local-smart-home-and-ai-applications/)

**M5Stack LLM630 Compute Kit (AX630C) — standalone board, 90.3×31.6×12 mm**
- SoC AX630C dual A53 1.2 GHz; NPU 3.2 TOPS INT8 (12.8 INT4); 4 GB LPDDR4 (2 GB system / 2 GB accel); 32 GB eMMC 5.1 + microSD — [M5Stack docs](https://docs.m5stack.com/en/core/LLM630%20Compute%20Kit)
- Connectivity: ESP32-C6 for 2.4 GHz Wi-Fi 6 (BLE not listed on the page); JL2101B 1 GbE; SMA antenna — [M5Stack docs](https://docs.m5stack.com/en/core/LLM630%20Compute%20Kit)
- Audio: MIC+SPK 5P 1.25 mm header; NS4150B Class-D amplifier onboard (speaker/mic are external via header) — [M5Stack docs](https://docs.m5stack.com/en/core/LLM630%20Compute%20Kit)
- Battery: 3.7 V Li-ion via 1.25 mm connector; AW32001ECSR charger; BQ27220 fuel gauge; power-on/off via PWR/BOOT button on battery — [M5Stack docs](https://docs.m5stack.com/en/core/LLM630%20Compute%20Kit)
- Power input USB 5 V @ 2 A; operating 0–40 °C; 23.6 g; BMI270 6-axis IMU; MIPI DSI/CSI; 2× USB-C — [M5Stack docs](https://docs.m5stack.com/en/core/LLM630%20Compute%20Kit)
- Linux kernel 4.19.125 package listed in resources (old kernel) — [M5Stack docs](https://docs.m5stack.com/en/core/LLM630%20Compute%20Kit)
- Price: ¥13,376 tax-incl. at Switch Science (release 2025-07-11, "100+" in stock in one snapshot) — [Switch Science](https://www.switch-science.com/products/10218). USD store price not retrieved (store fetch returned a catalog page) — UNVERIFIED; roughly $85–95 by JPY conversion — inference only.
- Power draw for the LLM630 itself is not listed on its docs page; the Module LLM's 0.5/1.5 W uses the same SoC — [M5Stack docs](https://docs.m5stack.com/en/core/LLM630%20Compute%20Kit)

**Sipeed MaixCAM2 (AX630C) — 66.5×50×21.2 mm camera-style board**
- AX630C, 2× A53 1.2 GHz Linux (Ubuntu) + RISC-V E907 running RT-Thread; 3.2 TOPS INT8; 1 GB or 4 GB LPDDR4; 32 GB eMMC + TF — [Sipeed wiki](https://wiki.sipeed.com/hardware/en/maixcam/maixcam2.html)
- Audio: two onboard analog silicon mics; onboard PA driving a 1 W speaker — [Sipeed wiki](https://wiki.sipeed.com/hardware/en/maixcam/maixcam2.html)
- Onboard WiFi 6 + BLE 5.4; Li-ion charge/discharge management, battery-equipped version available — [Sipeed wiki](https://wiki.sipeed.com/hardware/en/maixcam/maixcam2.html)
- 2.4" 640×480 touchscreen, 8 MP/4K camera, 6-axis IMU, RTC — [Sipeed wiki](https://wiki.sipeed.com/hardware/en/maixcam/maixcam2.html)
- Price: Kickstarter from $69 (1 GB), $99 (4 GB/2K), $119 (4 GB/4K), shipping expected Feb 2026 — [Hackster](https://www.hackster.io/news/sipeed-s-69-ai-camera-packs-a-serious-punch-a27b0146e9da); [CNX Software](https://www.cnx-software.com/?p=164486). Current AliExpress retail price not found — UNVERIFIED.
- Power consumption, boot time, operating temperature not published on wiki — gap.
- Note: Sipeed sells the MaixCAM2 core board (AX630C SoM) separately per wiki "modular" description — [CNX Software](https://www.cnx-software.com/?p=164486) (module pricing UNVERIFIED).

**Other Axera: M5Stack LLM-8850 (AX8850, not AX650N)**
- M.2 2242 card, AX8850 SoC, 24 TOPS INT8, 8 GB LPDDR4x; $99 at launch; needs a host (Pi 5 adapter kits sold) — [CNX Software](https://www.cnx-software.com/?p=157983); [Switch Science](https://www.switch-science.com/products/10786)
- Whisper tiny/base/small packages exist for it (`llm-model-whisper-base-axcl`) — [M5Stack docs](https://docs.m5stack.com/en/stackflow/models/whisper-base)
- No standalone AX650N SBC found in this search — gap. M5Stack "AI Pyramid" is an AX650-based device running sherpa-onnx SenseVoice on NPU — [M5Stack docs](https://docs.m5stack.com/en/compute/ai_pyramid/sherpa_onnx) (price/power/size not retrieved — UNVERIFIED).

**Rockchip RK3588/RK3588S — Radxa ROCK 5C, Orange Pi 5, CM5**
- ROCK 5C launch prices: 2 GB $49.90, 4 GB $59.90, 8 GB $79.90, 16 GB $119.90, 32 GB $199.90 — [Radxa blog](https://radxa.com/blog/ROCK-5C-Official-Announcement)
- Orange Pi 5 launched at $60+ — [CNX Software](https://www.cnx-software.com/?p=101401)
- Idle power: retailer blog claims ROCK 5C idles 3–5 W, 10–15 W sustained (not independently measured) — [Radxa forum thread](https://forum.radxa.com/t/announcing-the-rock-5c-power-performance-and-versatility-for-just-30/20429?page=2) — UNVERIFIED; Orange Pi 5 Max measured 2.4 (Wh, headless idle, unit ambiguous) by LinuxLinks — [LinuxLinks](https://www.linuxlinks.com/radxa-cubie-a7a-single-board-computer-running-linux-power-consumption/3/)
- No onboard mic/speaker amp on these SBCs (standard SBC I/O; audio via HDMI/3.5 mm/I2S) — inference from product briefs; not explicitly verified — UNVERIFIED
- Raspberry Pi CM5 (not NPU — listed for completeness): from $45 at launch (1 GB dropped); boots ~4 s faster than CM4 (absolute not given); ~1.5× more efficient under HPL load than CM4 — [Jeff Geerling](https://www.jeffgeerling.com/blog/2024/raspberry-pi-cm5-2-3x-faster-drop-upgrade-mostly/); Digi-Key $55 (2 GB Lite) to $225 (16 GB/64 GB) — [Digi-Key](https://www.digikey.com/es/product-highlight/r/raspberry-pi/raspberry-pi-compute-module-5)

**Rockchip RK3576 — Radxa ROCK 4D, Luckfox Omni3576/Core3576**
- RK3576: 4× A72 2.2 GHz + 4× A53 2.0 GHz, 6 TOPS NPU — [Spotpear](https://spotpear.com/index.php/shop/Luckfox-Omni3576-Core3576-Rockchip-RK3576.html)
- ROCK 4D: 6 TOPS NPU (INT4/8/16, FP16, BF16, TF32), 2–16 GB LPDDR5; launch $30 (2 GB) to $100 (16 GB) — [Radxa](https://radxa.com/products/rock4/4d); [Liliputing](https://liliputing.com/?p=182074); Amazon 4 GB $59.99 (Jan 2026 snapshot) — [camelcamelcamel](https://camelcamelcamel.com/product/B0G32YL29F)
- Radxa publishes an RKNN Whisper guide for ROCK 4D — [Radxa docs](https://docs.radxa.com/en/rock4/rock4d/application-dev/npu/whisper)
- Luckfox Omni3576 kits ~$79–98 at Spotpear but marked off-production; Core3576 module $44.99–71.99 at Waveshare (snapshot) — [Spotpear](https://spotpear.com/index.php/shop/Luckfox-Omni3576-Core3576-Rockchip-RK3576.html); [Waveshare](https://www.waveshare.com/product/ai/boards-kits/luckfox.htm)

**Rockchip RK3566 — Radxa Zero 3W (Pi Zero form factor)**
- RK3566, WiFi 6, up to 8 GB, Pi Zero 2 W form factor — [CNX Software](https://cnx-software.com/news/4k/page/9)
- Price at Ameridroid $25.95–$92.95 by config, one listing $43.95 — [Ameridroid](https://ameridroid.com/products/radxa-zero-3w)
- Power: community figures 0.9 W idle, 3.3 W max (model not clearly 3W) — [Radxa forum](https://forum.radxa.com/t/energy-consumption/12404) — treat as rough; product brief says DVFS and passive operation for light-to-moderate load — [Radxa product brief](https://dl2.radxa.com/zero3/docs/hw/3w/radxa_zero_3w_product_brief.pdf)
- RK3566 Whisper RTF on NPU is 1.207 (slower than real time) — see KQ2 — [rknn_model_zoo](https://github.com/airockchip/rknn_model_zoo)

**Rockchip RK3506 — Luckfox Lyra (NO NPU)**
- RK3506 = 3× Cortex-A7 up to 1.5 GHz + Cortex-M0 200 MHz, 2D GPU; no NPU in any source — [MYIR PDF](https://srcc.myir.cn/files/20250306/76a0d87b1d002863749b8233ee588cd7.pdf); [CNX roadmap](https://www.cnx-software.com/2023/11/02/rockchip-roadmap-reveals-rk3576-and-rk3506-iot-processors-linux-6-1-sdk/)
- Lyra RK3506G2 $7.99–67.99; Lyra Ultra $16.99–71.99 (Waveshare snapshots) — [Waveshare](https://www.waveshare.com/product/ai/boards-kits/luckfox.htm)

**Rockchip RV1106/RV1103 — Luckfox Pico family**
- Pico Ultra/Ultra W: RV1106G3, Cortex-A7 1.2 GHz, 1 TOPS NPU (INT4/8/16), 256 MB DDR3L; Ultra W adds 2.4 GHz Wi-Fi 6 + BT 5.2/BLE; speaker MX1.25 interface only (no amp mentioned); Buildroot only — [Luckfox wiki](https://wiki.luckfox.com/Luckfox-Pico-Ultra/)
- Retail listing says Ultra has "onboard microphone" — [Core Electronics](https://core-electronics.com.au/luckfox-pico-ultra-rv1106-linux-development-board.html); wiki does not mention it — conflict, treat as UNVERIFIED
- Pico Pro/Max: integrated audio codec, 0.5 / 1 TOPS, 128/256 MB — [Grobotronics](https://grobotronics.com/luckfox-pico-max-rv1106-a7-risc-v-256mb-memory.html)
- Boot time: ~3 s to interactive shell over USB on Pico Mini with a stripped static-BusyBox userland (not stock Buildroot) — [xnux.eu](https://xnux.eu/log/101.html)
- rknn_model_zoo speech examples (whisper/zipformer/wav2vec2) do NOT list RV1103/RV1106 — [rknn_model_zoo](https://github.com/airockchip/rknn_model_zoo)

**Sophgo SG2002 — Sipeed MaixCAM / MaixCAM-Pro / LicheeRV Nano**
- SG2002: 1 GHz main core (RISC-V/Arm selectable) + 700 MHz RISC-V, 256 MB DDR3, 1 TOPS INT8 NPU — [Sipeed wiki](https://wiki.sipeed.com/hardware/en/lichee/RV_Nano/1_intro); [CNX Software](https://www.cnx-software.com/2024/02/08/licheerv-nano-low-cost-sg2002-risc-v-arm-camera-display-board-wifi-6-ethernet/)
- LicheeRV Nano has onboard analog mic; MaixCAM has analog silicon mic + PA driving 1 W speaker — [Sipeed MaixCAM-Pro wiki](https://wiki.sipeed.com/hardware/en/maixcam/maixcam_pro.html); [CNX](https://www.cnx-software.com/2024/02/08/licheerv-nano-low-cost-sg2002-risc-v-arm-camera-display-board-wifi-6-ethernet/)
- LicheeRV Nano price: ~$15–25 range and ~1–2 W (DeepWiki aggregator, unverified); $41.99 for a 2-pack WiFi6 version at one US listing — [DeepWiki](https://deepwiki.com/sipeed/sipeed_wiki/3-lichee-risc-v-series) — UNVERIFIED
- Whisper/SenseVoice NOT supported on MaixCAM/MaixCAM-Pro (SG2002); only Maix-Speech (Chinese, CPU library) — [Sipeed MaixPy](https://wiki.sipeed.com/maixpy/doc/en/audio/recognize.html)
- LicheeRV Nano cannot use MaixPy/MaixCDK; raw SG2002 Linux SDK only — [Sipeed MaixCAM-Pro wiki](https://wiki.sipeed.com/hardware/en/maixcam/maixcam_pro.html)

**Sophgo SG2000/CV1800B — Milk-V Duo S / Duo 256M**
- Duo S: SG2000 (C906 1 GHz + C906 700 MHz + Cortex-A53 1 GHz, Arm/RISC-V not simultaneous), TPU 0.5 TOPS INT8, 512 MB, optional WiFi 6/BT 5, 5 V/1 A, 43×43 mm, from $9.90; no mic listed, audio via header — [Milk-V](https://milkv.io/duo-s)
- Only community thread found on voice recognition for Duo (mic input/I2S progress, no TPU ASR) — [Milk-V community](https://community.milkv.io/t/has-anyone-tried-building-a-custom-voice-command-recognition-for-duo/1405/10)

**Seeed reSpeaker Core v2 (RK3229, no NPU)**
- RK3229 quad-core, 1 GB RAM, 4 GB eMMC, 6-mic array, Debian; SDK does KWS/beamforming/DOA/NS/AEC only — [Seeed wiki](https://wiki.seeedstudio.com/ReSpeaker_Core_v2.0); [CNX](https://www.cnx-software.com/2018/03/13/respeaker-core-v2-is-a-6-mic-array-audio-development-kit-powered-by-rockchip-rk3229-processor/). 2018 part; no Whisper evidence. reCamera: not found in results — gap.

**Raspberry Pi 5 + AI HAT+ (Hailo-8L 13 TOPS $70 / Hailo-8 26 TOPS $110) and AI HAT+ 2 (Hailo-10H)**
- AI HAT+ prices $70 (13 TOPS) / $110 (26 TOPS) — [Tom's Hardware](https://tomshardware.com/raspberry-pi/raspberry-pi-release-higher-performance-ai-hat-13-and-26-tops-variants); [SparkFun](https://www.sparkfun.com/raspberry-pi-ai-hat-13-tops.html)
- AI HAT+ 2 (Hailo-10H, 8 GB onboard RAM): $130 at CanaKit/SparkFun; launched $130 Jan 2026, ~$200 at resellers after April increase (checked 2026-10-12) — [CanaKit](https://www.canakit.com/raspberry-pi-ai-hat-2.html); [ComputingForGeeks](https://computingforgeeks.com/edge-llm-jetson-orin-vs-ai-hat-2-vs-hailo-10h/); Pi 5 only, 0–50 °C — [Little Bird](https://littlebirdelectronics.com.au/products/raspberry-pi-ai-hat-plus-2.md)
- Pi 5 pricing Oct 2026: 2 GB $77.50, 8 GB $175, 16 GB $305 list (three increases since launch) — [ComputingForGeeks](https://computingforgeeks.com/edge-llm-jetson-orin-vs-ai-hat-2-vs-hailo-10h/)
- Power: Pi 5 8 GB idle 3.1 W, 4.2 W with AI HAT+ 2, 7.1 W peak under LLM load; Hailo-10H 2.5 W typical — [ComputingForGeeks](https://computingforgeeks.com/edge-llm-jetson-orin-vs-ai-hat-2-vs-hailo-10h/); Pi 5 idle 2.7–3.2 W, AI HAT+ (8L) adds +2–3 W during inference — [raspberry.tips](https://raspberry.tips/en/raspberrypi-tutorials/raspberry-pi-power-consumption-update-2026-all-models-compared)
- No mic on Pi 5; demos use USB mic — [Hackster](https://hackster.io/news/hailo-demonstrates-accelerated-llm-based-speech-recognition-on-the-raspberry-pi-ai-hat-63eec0214603)

**Raspberry Pi Zero 2 W (no NPU, 512 MB)**
- Zero 2 W has 512 MB RAM; whisper.cpp tiny needs ~273–390 MB — [whisper.cpp README mirror](https://huggingface.co/spaces/natasa365/whisper.cpp/blob/c46c0dc376af3318d8eb7ede4fb35684d4958752/README.md); [mustafa.net](https://mustafa.net/tools/ai/whisper-cpp/)
- No Zero 2 W whisper benchmark found; Pi 4 runs tiny "under 5 seconds" at 2× Pi 5 time — [openHAB](https://next.openhab.org/addons/voice/whisperstt/); older Pis lacked memory headroom for Whisper, Vosk recommended — [fast.io](https://www.fast.io/resources/openclaw-raspberry-pi-speech-recognition-offline-voice-agent.md)

**NVIDIA Jetson Orin Nano Super Developer Kit**
- Price $399 as of Oct 2026 (launched $249 Dec 2024; raised July 2026) — [ComputingForGeeks](https://computingforgeeks.com/edge-llm-jetson-orin-vs-ai-hat-2-vs-hailo-10h/); launch $249, 67 TOPS, 102 GB/s — [Decrypt](https://decrypt.co/297983/nvidia-upgrades-low-cost-jetson-ai-computer)
- Power modes 7/15/25 W (+MAXN); 25 W "Super" mode +30–70 % — [JetsonHacks](https://jetsonhacks.com/2024/12/17/jetson-orin-nano-super-developer-kit/); [ComputingForGeeks](https://computingforgeeks.com/edge-llm-jetson-orin-vs-ai-hat-2-vs-hailo-10h/)
- Measured idle: ~4.7 W (JetPack 5.1.1, 8 GB); ~4.7 W on Super dev kit, down to ~2.5 W after switching NVMe→microSD and disabling display/audio/PCIe in DT; 2.6 W whole carrier with aggressive tuning — [NVIDIA forum](https://forums.developer.nvidia.com/t/reducing-idle-power-on-orin-nano-super-dev-kit/358482); [NVIDIA forum](https://forums.developer.nvidia.com/t/jetson-orin-nano-8gb-lowest-theoretical-operating-power-consumption/348662)
- No onboard mic/WiFi on the module (dev kit has M.2 WiFi card) — UNVERIFIED (not re-checked)

**Qualcomm Dragonwing QCS6490 — Thundercomm Rubik Pi 3**
- QCS6490, octa Kryo 670, 8 GB LPDDR4x, 128 GB UFS 2.2, 12–12.5 TOPS Hexagon; Wi-Fi 5 + BT 5.2; USB-C PD 12 V 3 A; ~4–8 W (third-party doc) — [Peridio](https://docs.peridio.com/hardware/qualcomm/rubik-pi-3); [CNX](https://www.cnx-software.com/2024/10/10/qualcomm-qcs6490-rubik-pi-ai-sbc-supports-android-linux-and-lu-operating-systems/)
- Ships with Qualcomm Linux or Ubuntu 24.04; Qualcomm AI Hub model deployment — [Thundercomm](https://www.thundercomm.com/rubik-pi-3/en/docs/about-rubikpi/)
- Price: $179 at CES 2025; $99 limited release Oct 2025; AndyMark bundle $109–114 — [Thundercomm](https://www.thundercomm.com/rubik-pi-3-99/); [Barchart/Thundercomm PR](https://www.barchart.com/story/news/30353977/thundercomm-launches-rubik-pi-3-at-ces-2025-setting-a-new-benchmark-for-ondevice-ai); [AndyMark](https://andymark.com/am-5698)
- Only 3.5 mm jack listed; no onboard mic found — [Peridio](https://docs.peridio.com/hardware/qualcomm/rubik-pi-3)

**Allwinner T527/A527 — Radxa Cubie A5E**
- NPU 2 TOPS INT8 only on T527 industrial variant; A527 has none; LPDDR4x up to 4 GB; Wi-Fi 6 + BT 5.4; 30 W PD adapter accessory — [Radxa](https://radxa.com/products/cubie/a5e); [Radxa docs](https://docs.radxa.com/en/cubie/a5e/getting-started/introduction)
- Price "$15 and up" (A527 1 GB) — [Liliputing](https://liliputing.com/radxa-cubie-a5e-is-a-tiny-single-board-pc-with-an-m-2-socket-and-dual-lan-ports-for-15-and-up/); T527 price not found — gap
- Radxa marketing lists "AI Voice Recognition" as an NPU use case, no SDK/benchmarks — [Radxa](https://radxa.com/products/cubie/a5e)

**Orange Pi RV2 (Ky X1 RISC-V, 2 TOPS)**
- 8-core RISC-V, 2 TOPS NPU, 2/4/8 GB LPDDR4X, $30–49.90, Ubuntu 24.04; chip possibly SpacemiT K1 variant (unconfirmed) — [CNX Software](https://www.cnx-software.com/2025/03/08/orange-pi-rv2-low-cost-risc-v-sbc-ky-x1-octa-core-soc-2-tops-ai-accelerator/). No ASR toolchain found — gap. Banana Pi AI boards: nothing found — gap.

**Audio/toy SoCs (not Linux SBCs, for context)**
- Rockchip RK2118G/M: dual Star-SE Armv8-M audio MCU with NPU (32× FP16 MAC/cycle, 80 KB buffer), 3 DSPs, 1 MB SRAM, optional 64 MB in-package DDR (G), PDM up to 8 mics — [CNX Software](https://www.cnx-software.com/2024/05/14/rockchip-rk2118g-rk2118m-dual-core-star-se-armv8-m-microcontrollers-target-smart-audio-applications/) — too small for Whisper-class ASR (inference)
- Allwinner R128: RISC-V + Cortex-M33 + HiFi 5 DSP, WiFi/BT, mic arrays; no NPU — [CNX Software](https://www.cnx-software.com/2023/03/06/allwinner-r128-wireless-soc-features-64-bit-risc-v-core-arm-cortex-m33-core-and-hifi-5-audio-dsp/)
- Allwinner V821: dual RISC-V camera SoC, 64 MB DDR2, Wi-Fi 4; no NPU found (1 TOPS NPU belongs to sibling V861) — [CNX Software](https://www.cnx-software.com/2025/04/17/avaota-f1-a-tiny-camera-board-based-on-allwinner-v821-risc-v-soc-with-built-in-wifi-and-64mb-ddr2/?amp=1); [linux-sunxi](https://linux-sunxi.org/V821)
- Ingenic T41NQ: 1.2 TOPS INT8 / 4.8 INT4, 700 MHz RISC-V coprocessor, Magik 2.0 SDK; T41ZL SBC claims "two-way voice" — [CSDN datasheet summary](https://damodev.csdn.net/6a43771d6b2ae520ee59b9d7.html); [armdesigner](https://armdesigner.com/IdeaT41_release). No ASR model support found — gap. Ingenic X2600: nothing found — gap.
- Commercial AI plush products (Curio Grok) use ESP32-class WiFi voice boxes with cloud LLMs; Open Toys uses ESP32-S3 + external backend — [Tom's Guide](https://www.tomsguide.com/ai/i-tested-this-adorable-ai-voice-toy-with-my-4-year-old-heres-what-happened-after-a-week-with-grok-by-curio); [letsdatascience](https://letsdatascience.com/news/open-toys-enables-offline-llm-powered-custom-toys-0f14254e). No 2025–2026 small NPU SoM announced specifically for AI toys was found — gap.

### Inferences
- The AX630C boards are the only candidates in this survey with the full plush-toy checklist on one PCB (mic, amp, Li-ion charger, WiFi, NPU ASR stack, ~1.5 W). The LLM630 Compute Kit lacks onboard mic/speaker (header only) but has the charger; MaixCAM2 has mics+speaker+charger but carries a camera/screen you'd pay for and not use.
- RK3588-class boards would need an external PMIC/charger board, USB or I2S mic, and a ~10 Wh pack for 2–3 h — poor fit for a toy.
- Pi 5 + Hailo and Jetson are desk-class (4–25 W) and physically large; not plush-toy candidates except as a home "hub".

### Gaps
- USD price and power draw of LLM630 Compute Kit from M5Stack store (store fetch returned a catalog page).
- MaixCAM2 retail price, power draw, boot time, operating temperature.
- Boot time for Module LLM / LLM630 / Pi 5 / RK3588 boards (no measured figures found; only Pico Mini ~3 s custom userland).
- Luckfox Pico Ultra W price and whether an onboard mic exists (wiki vs retailer conflict).
- Jetson Orin Nano production module price/size; Rubik Pi 3 mic input; T527 Cubie A5E price; Seeed reCamera entirely.

## Key Question 2: Documented on-device ASR with RTF < 1 (benchmarks: RTF, latency, model, quantization)

### Takeaway
Documented sub-real-time NPU ASR exists on AX630C (Whisper tiny encode 248 ms, base 660 ms, small 1.6 s; SenseVoice RTF 0.06 on AX650), RK3588 (Whisper base RTF 0.196–0.234, zipformer RTF 0.059), RK3576 (Whisper RTF 0.224), RK3562 (0.36) and RV1126B (0.305); RK3566 Whisper is RTF 1.21 (slower than real time) though zipformer is 0.18. Hailo publishes no RTF; one community hybrid (encoder on Hailo-8L, decoder on CPU) reports ~250 ms refresh and 8.4× over faster-whisper CPU. Jetson Orin Nano does 20 s of audio in 0.64–0.86 s (RTF ~0.03–0.04). Pi 5 CPU alone: whisper tiny ~3.4 s for 5 s audio (RTF ~0.7); Moonshine Tiny streaming 237 ms end-latency.

### Cited Findings

**Axera AX630C (M5Stack StackFlow; same packages for Module LLM / LLM630 / Module LLM Kit)**
- Whisper-tiny NPU: encode 248.0 ms, average decode 32.54 ms/step — [M5Stack docs](https://docs.m5stack.com/en/stackflow/models/whisper-tiny)
- Whisper-base NPU: encode 660.31 ms, avg decode 51.11 ms/step; `apt install llm-model-whisper-base` — [M5Stack docs](https://docs.m5stack.com/en/stackflow/models/whisper-base)
- Whisper-small NPU: encode 1606.08 ms, avg decode 148.92 ms/step — [M5Stack docs](https://docs.m5stack.com/en/stackflow/models/whisper-small)
- M5Stack "ASR" unit = sherpa-ncnn streaming Zipformer on CPU (20M English 2023-02-17; 14M Chinese 2023-02-23), available on LLM630/Module LLM/AI Pyramid; no RTF published — [M5Stack docs](https://docs.m5stack.com/en/stackflow/models/asr)
- Other StackFlow speech units: SenseVoice, KWS, Silero-VAD, MeloTTS (en/zh/ja/es) — [M5Stack docs](https://docs.m5stack.com/en/stackflow/models/whisper-tiny) (sidebar)
- Whisper docs do not state quantization, memory, max audio length, or streaming — gap; whisper filenames on MaixCAM2 imply 16 kHz mono WAV input, base model supports zh/en, needs 1 GB RAM — [Sipeed MaixPy](https://wiki.sipeed.com/maixpy/doc/en/mllm/asr_whisper.html)
- MaixCAM2 (AX630C) additionally documents SenseVoice with live mic capture — [Sipeed MaixPy](https://en.wiki.sipeed.com/maixpy/doc/en/mllm/asr_sensevoice.html)

**Axera AX650 (M5Stack AI Pyramid, sherpa-onnx `--provider=axera`)**
- SenseVoiceSmall 10-s axmodel, 2 threads, greedy: 0.119 s for 7.152 s audio → RTF 0.017; VAD long-audio RTF 0.069; SenseVoice page lists RTF 0.061; onboard 4-ch mic not supported by examples (USB mic required) — [M5Stack docs](https://docs.m5stack.com/en/compute/ai_pyramid/sherpa_onnx); [M5Stack docs](https://docs.m5stack.com/en/stackflow/models/sensevoice)
- sherpa-onnx README lists Axera and Rockchip (RKNN) as supported NPUs — [sherpa-onnx README](https://cdn.jsdelivr.net/gh/k2-fsa/sherpa-onnx@master/README.md)

**Rockchip RKNN (airockchip/rknn_model_zoo, FP16 models)**
- whisper_base_20s RTF: RK3566/3568 1.207; RK3562 0.360; RK3588 (single NPU core) 0.196; RK3576 (single core) 0.224; RV1126B 0.305. Streaming zipformer bilingual RTF: 0.183 / 0.094 / 0.059 / 0.072 / 0.106 respectively. RV1103/RV1106/RK1808/RV1109/RV1126 not supported for speech — [rknn_model_zoo](https://github.com/airockchip/rknn_model_zoo)
- Also wav2vec2, yamnet (classification), mms_tts in model zoo for the same chips — [rknn_model_zoo](https://github.com/airockchip/rknn_model_zoo)
- Radxa CM5 (RK3588) measured: Whisper base 20-s FP16 encoder+decoder, inference 1372.85 ms for 5.855 s English → RTF 0.234; 1656.61 ms for 5.611 s Chinese → RTF 0.295; encoder init 122–200 ms, decoder init 223–283 ms; rknn-toolkit2 2.3.2 — [Radxa docs](https://docs.radxa.com/en/som/cm/cm5/radxa-os/app-dev/ai/whisper)
- sherpa-onnx RKNN page: known-working RK3588/3576/3568/3566/3562; pre-built RKNN models (RK3588 only): streaming zipformer bilingual (2023-02-16/20), SenseVoice 20-s (2024-07-17, 2025-09-09), Paraformer 15-s (2025-10-07); speed-test section exists but numbers not extracted — [sherpa-onnx docs](https://k2-fsa.github.io/sherpa/onnx/rknn/index.html)
- RK3588 CPU-only whisper.cpp (Turing RK1, 8 threads): tiny 29.79 s / 5-min clip → RTF 0.10, 299 MB RSS; base 48.57 s — [Turing Pi](https://turingpi.com/whisper-cpp-piper-tts-arm64-turing-pi-rk3588/)

**Hailo-8/8L/10H (Pi 5)**
- hailo-apps speech_recognition: Hailo-8, 8L, 10H; models base and tiny (tiny.en 10H only); default record `--duration` 10 s; separate encoder/decoder HEFs; HailoRT 4.20+; mic mode is record-then-transcribe; no latency figures — [hailo-apps](https://github.com/hailo-ai/hailo-apps/tree/main/hailo_apps/python/standalone_apps/speech_recognition)
- Full release July 2025: tiny + base, English-tuned; token embedding runs on host; Transformers conversion needed Conv1D→Conv2D and 1000 mel features (10 s); no new commits for months as of Nov 2025 — [Hailo community](https://community.hailo.ai/t/whisper-full-release-now-available/16228)
- hailocs/hailo-whisper: tiny/tiny.en/base/base.en; Hailo-8 (DFC 3.x) and Hailo-10H (DFC 5.x); no benchmarks — [GitHub](https://github.com/hailocs/hailo-whisper)
- Community hybrid (encoder on Hailo-8L, decoder on Pi 5 CPU): ~250 ms refresh live captioning, 8.4× faster than faster-whisper CPU; Hailo-only decode "really slow" without KV cache — [Hailo community](https://community.hailo.ai/t/real-time-asr-on-raspberry-pi-hailo8l-with-whisper/17936) (repo github.com/ktomanek/edge_whisper)
- Hailo-10H decoder cost ~80 ms/token base, ~30 ms/token tiny (fixed-sequence decoder reprocesses window each step) — [Hailo community](https://community.hailo.ai/t/kv-cache-low-latency-decoding-for-custom-fine-tuned-whisper-on-hailo-10h/19528)
- AI HAT+ 2 lists Whisper base as a launch model; Whisper-small requires HailoRT 5.2.0; one user reported voice_assistant transcripts matching "max 40%" — [CanaKit](https://www.canakit.com/raspberry-pi-ai-hat-2.html); [Hailo community](https://community.hailo.ai/t/speech-to-text-does-not-work-well-upgrading-to-hailort-5-2-0-using-whisper-small/19003)

**NVIDIA Jetson Orin Nano**
- WhisperTRT: 20 s clip → tiny.en 0.64 s (TRT) vs 0.85 s (faster-whisper); base.en 0.86 s TRT; ~3× faster, ~60 % memory vs PyTorch — [NVIDIA-AI-IOT/whisper_trt](https://github.com/NVIDIA-AI-IOT/whisper_trt) → RTF ≈ 0.03–0.04 (computed)
- faster-whisper small ~3 s for 20 s audio (RTF ~0.15); PyPI aarch64 ctranslate2 wheels are CPU-only — [Docker Hub speaches](https://hub.docker.com/r/cbinckly/speaches)

**Raspberry Pi 5 CPU (no NPU)**
- OpenAI whisper (PyTorch) on Pi 5, 5 s audio: tiny ~3 s (log: 3.42 s), base ~6 s, small ~20 s — [Peridio](https://docs.peridio.com/developer-reference/references/python-whisper)
- faster-whisper tiny: 10 s clip in 2–3 s on Pi 5 8 GB — [fast.io](https://www.fast.io/resources/openclaw-raspberry-pi-speech-recognition-offline-voice-agent.md)
- whisper.cpp: tiny faster than real time, base ≈ real time with 4 threads (no numbers) — [PromptQuorum](https://www.promptquorum.com/power-local-llm/local-whisper-stt-comparison-2026)
- Moonshine (vendor benchmark, Pi 5): Tiny Streaming 34M params, latency-after-speech-ends 237 ms, WER 12.00 %; Whisper Tiny 5,863 ms, WER 12.81 % — [Moonshine docs](https://www.mintlify.com/moonshine-ai/moonshine/models/benchmarks); original claim 5× faster than Whisper on 10 s segments — [GitHub usefulsensors/moonshine](https://github.com/usefulsensors/moonshine)

**Qualcomm QCS6490**
- No Whisper timing found; AI Hub Whisper model page returned 404; AI Hub profiling of Real-ESRGAN on QCS6490 ~171.8 ms shows NPU path works — [Radxa docs](https://docs.radxa.com/dragon/q8b/app-dev/npu-dev/qai-hub-models) — Whisper on QCS6490 UNVERIFIED

### Inferences
- For a 5-s child utterance on AX630C: whisper-tiny ≈ 0.25 s encode + ~20 tokens × 33 ms ≈ 0.9 s (RTF ~0.2); whisper-base ≈ 0.66 + 20×0.051 ≈ 1.7 s (RTF ~0.35); whisper-small ≈ 1.6 + 20×0.15 ≈ 4.6 s (RTF ~0.9, marginal). Computed from M5Stack per-step figures; token count assumed.
- RK3588/RK3576 give the fastest documented NPU Whisper base (RTF ~0.2) but at 3–5 W idle; RK3566 (Zero 3W) is not viable for Whisper on NPU (RTF 1.2) but viable for streaming zipformer (RTF 0.18).
- Hailo's whisper path is batch (10 s record-then-transcribe) and the decoder is the bottleneck; it is not a clean win over AX630C for a toy.

### Gaps
- No vendor RTF/latency for Hailo-8L/8/10H Whisper; no Whisper numbers for QCS6490, T527, Ky X1, SG2002, CV1800B, RV1106.
- No Pi Zero 2 W whisper.cpp/Vosk measurements found.
- M5Stack per-platform differences (Module LLM vs LLM630 share figures; quantization/memory unspecified).
- sherpa-onnx RKNN speed-test numbers not extracted.

## Key Question 3: Streaming (incremental) vs batch-per-utterance support

### Takeaway
True streaming on-device ASR is documented on AX630C via sherpa-ncnn streaming Zipformer (CPU, 14M/20M models) and on RK35xx via RKNN streaming Zipformer (NPU, RTF 0.06–0.18); Whisper is batch-per-utterance everywhere (20-s fixed window on RKNN, 10-s on Hailo/Axera SenseVoice). Moonshine Tiny Streaming offers streaming on CPU (Pi 5 237 ms).

### Cited Findings
- M5Stack ASR unit is "a streaming ASR model" (sherpa-ncnn streaming zipformer, CPU, en-only or zh-only) on LLM630/Module LLM — [M5Stack docs](https://docs.m5stack.com/en/stackflow/models/asr)
- rknn_model_zoo zipformer example is "streaming audio" input, bilingual zh-en, RTF 0.059 on RK3588 — [rknn_model_zoo](https://github.com/airockchip/rknn_model_zoo); same model listed in sherpa-onnx RKNN pre-trained set — [sherpa-onnx docs](https://k2-fsa.github.io/sherpa/onnx/rknn/index.html)
- RKNN whisper uses a fixed 20-s encoder window (mel [1,80,2000]) → batch — [Radxa docs](https://docs.radxa.com/en/som/cm/cm5/radxa-os/app-dev/ai/whisper)
- Hailo speech_recognition mic mode: press Enter to start/stop recording, max duration 10 s, then transcribe — batch — [hailo-apps](https://github.com/hailo-ai/hailo-apps/tree/main/hailo_apps/python/standalone_apps/speech_recognition); community hybrid achieves 250 ms live-caption refresh by re-decoding on CPU — [Hailo community](https://community.hailo.ai/t/real-time-asr-on-raspberry-pi-hailo8l-with-whisper/17936)
- Axera SenseVoice sherpa-onnx examples: offline file, VAD-segmented, and ALSA mic+VAD (segment-then-recognize); 10-s model — [M5Stack docs](https://docs.m5stack.com/en/compute/ai_pyramid/sherpa_onnx)
- Maix-Speech on SG2002 runs frame-by-frame from onboard mic (`speech.run(1)`), Chinese only — [Sipeed MaixPy](https://wiki.sipeed.com/maixpy/doc/en/audio/recognize.html)
- Moonshine streaming models do most work while user talks; latency measured from speech end to transcript — [Moonshine docs](https://www.mintlify.com/moonshine-ai/moonshine/models/benchmarks)
- Silero-VAD and KWS units on StackFlow enable VAD-gated utterance batching — [M5Stack docs](https://docs.m5stack.com/en/stackflow/models/whisper-tiny) (sidebar)

### Inferences
- A practical toy pipeline on AX630C: KWS + Silero-VAD → whisper-tiny/base batch per utterance (~1–2 s), or sherpa-ncnn streaming zipformer for partials (English-only 20M model). Nessie's current design (client segments speech, server transcribes) maps directly onto the batch path.

### Gaps
- No latency/RTF for sherpa-ncnn streaming zipformer on AX630C CPU.
- Whether sherpa-onnx streaming zipformer RKNN models exist pre-built for RK3566/RK3576 (page lists RK3588 only).

## Key Question 4: Thermal concerns inside a plush toy; passive cooling

### Takeaway
Only the AX630C class has a plausible passive-in-fabric thermal budget (≤1.5 W, rated 0–40 °C ambient). RK3588 (10–15 W sustained), Pi 5 + Hailo (7–12.5 W), Jetson (7–25 W) require heatsinks/fans and are unsuitable inside insulating fabric. No board-specific thermal-throttling data for AX630C was found.

### Cited Findings
- Module LLM: 1.5 W full load, operating 0–40 °C — [CNX Software](https://www.cnx-software.com/2024/11/05/m5stack-releases-ax630c-powered-offline-module-llm-for-local-smart-home-and-ai-applications/); LLM630 operating 0–40 °C — [M5Stack docs](https://docs.m5stack.com/en/core/LLM630%20Compute%20Kit)
- Radxa Zero 3W: DVFS, runs without additional cooling for light-to-moderate workloads — [Radxa product brief](https://dl2.radxa.com/zero3/docs/hw/3w/radxa_zero_3w_product_brief.pdf)
- ROCK 5C 10–15 W sustained (retailer claim) — [Radxa forum](https://forum.radxa.com/t/announcing-the-rock-5c-power-performance-and-versatility-for-just-30/20429?page=2) — UNVERIFIED
- Pi 5 + AI HAT+ 7.5 W typical, 12.5 W full load; 27 W PSU recommended — [raspberry.tips](https://raspberry.tips/en/raspberrypi-tutorials/raspberry-pi-power-consumption-update-2026-all-models-compared); AI HAT+ 2 operating 0–50 °C — [Little Bird](https://littlebirdelectronics.com.au/products/raspberry-pi-ai-hat-plus-2.md)
- Jetson Orin Nano Super 25 W max dev kit — [NVIDIA forum](https://forums.developer.nvidia.com/t/power-modes-on-orin-nano/378184)
- Rubik Pi 3 ~4–8 W — [Peridio](https://docs.peridio.com/hardware/qualcomm/rubik-pi-3)
- Generic: small heatsinks only handle bursts; prolonged load needs active cooling — [Pine64 forum](https://forum.pine64.org/showthread.php?tid=12957)

### Inferences
- A 40 °C ambient ceiling inside a plush body (child's body heat + insulation) is a real constraint for AX630C boards; a small aluminum plate bonded to the SoC plus a vented pocket is the minimum. Duty cycle matters: ASR runs ~1–2 s per utterance, so average draw stays near the 0.5 W idle figure.
- The 0–40 °C ratings for M5Stack parts are consumer-grade; the T527 "industrial" Cubie A5E is the only wide-temp NPU part surveyed, but it has no documented ASR stack.

### Gaps
- No measured SoC temperatures or throttling thresholds for AX630C, SG2002, RV1106 boards.
- No published MaixCAM2 thermal or power data.

## Key Question 5: On-device TTS / small LLM (bonus)

### Takeaway
AX630C boards ship MeloTTS (en/zh/ja/es) and Qwen2.5-0.5B pre-installed with 1.5B-class LLMs planned; RK3588/RK3576 run RKLLM (Qwen2.5-1.5B W8A8) and mms_tts via RKNN; Pi 5 + Hailo-10H runs a Whisper→LLM→TTS voice assistant demo; Jetson runs 3B models at 22–43 tok/s.

### Cited Findings
- Module LLM pre-installs Qwen2.5-0.5B; Qwen2.5-1.5B / Llama3.2-1B / InternVL2-1B planned; TTS listed — [CNX Software](https://www.cnx-software.com/2024/11/05/m5stack-releases-ax630c-powered-offline-module-llm-for-local-smart-home-and-ai-applications/); MeloTTS en/zh/ja/es in StackFlow — [M5Stack docs](https://docs.m5stack.com/en/stackflow/models/whisper-tiny) (sidebar)
- MaixCAM2 advertises plug-and-play LLM/VLM/ASR/TTS — [Sipeed wiki](https://wiki.sipeed.com/hardware/en/maixcam/maixcam2.html)
- RKLLM: Qwen2.5-1.5B-Instruct W8A8 on RK3588 workflow; Radxa table TinyLlama 1.1B 15.03 tok/s, Qwen 1.8B 14.18 tok/s (settings unspecified) — [Radxa docs](https://docs.radxa.com/en/rock5/rock5a/app-development/rkllm_usage); llama.cpp CPU Qwen2.5-1.5B Q4_K_M 22.57 tok/s on RK3588 — [Turing Pi](https://turingpi.com/?p=722203); mms_tts in rknn_model_zoo — [rknn_model_zoo](https://github.com/airockchip/rknn_model_zoo)
- Hailo-10H voice assistant (Whisper→LLM→TTS) example exists; users request full local run — [Hailo community](https://community.hailo.ai/t/request-for-hailort-sdk-full-package-including-hailortcli-for-raspberry-pi-ai-hat-2/19535)
- Jetson Orin Nano Super 3B-class LLMs 22–43 tok/s; Pi 5 + AI HAT+ 2 lower power but slower — [ComputingForGeeks](https://computingforgeeks.com/edge-llm-jetson-orin-vs-ai-hat-2-vs-hailo-10h/)
- Piper TTS runs on RK3588 CPU alongside whisper.cpp — [Turing Pi](https://turingpi.com/whisper-cpp-piper-tts-arm64-turing-pi-rk3588/)

### Inferences
- A 0.5B LLM on AX630C is far below the quality Nessie needs (character + child-dev grounding), so on-device LLM is only useful for fallback/offline canned behaviors; ASR + KWS + TTS on device with cloud LLM remains the realistic split.

### Gaps
- No tokens/s figure for Qwen2.5-0.5B on Module LLM; no MeloTTS latency on AX630C.
