# On-Device STT Software Feasibility by Hardware Tier (as of 2026-10-19)

Scope: which open-vocabulary ASR engines run on tiers A–F, at what speed/memory/accuracy, plus child-speech evidence, streaming support, wake-word/VAD footprints, and hybrid-architecture evidence. All numbers below are from the cited source; anything I could not source is in Gaps or marked UNVERIFIED. Research tool note: the web-search budget for this session ran out after ~45 searches; remaining gaps are listed per section.

## Key Question 1: Hardware-tier-to-engine feasibility matrix (which engines run where, RTF/latency, RAM, model size, WER)

### Takeaway
Open-vocabulary STT has now been demonstrated on every tier including bare ESP32-S3 (Oído, Oct 2026) and MCU+NPU (STM32N6 CynipsNet, Oct 2026; Arm Conformer-S on Ethos-U85, Jan 2026), but only Tier D (RK3588-class) and above run Whisper/Moonshine-class models comfortably faster than real time with headroom; Tier A is ~2x slower than real time, and Tier B is real-time-capable only on new NPUs with small CTC/Conformer models rather than Whisper.

### Feasibility matrix (summary; details and sources in bullets below)

| Tier | Engine(s) with evidence | Speed | RAM / model | Accuracy (LibriSpeech unless noted) | Verdict |
|---|---|---|---|---|---|
| A: ESP32-S3 (no NPU) | Oído (Conformer-CTC Small int8/int4, custom runtime); ESP-SR MultiNet (command-only) | Oído: 1.97x real time (slower than RT); 3.6–3.8 s command -> text 4.1–7.4 s after end of speech | 2.4 MB PSRAM peak, 8 MB octal PSRAM + 16 MB flash required; model 8.3–15.3 MB | Oído int8+LM 3.3/7.2 (clean/other); MultiNet7 8.5/21.3 but fixed command list | Open-vocab exists but NOT real time; needs max-spec S3 module |
| A: ESP32-P4 (no NPU) | ESP-SR WakeNet/VADNet/MultiNet7 (command-only, up to 200 cmds) | MultiNet7 8 ms per 32 ms frame; response delay "within 500 ms" | MultiNet7: 18 KB internal RAM + 2920 KB PSRAM | MultiNet7-en 8.5%/21.3% (on command grammar) | No published open-vocab STT on P4 found (GAP) |
| B: MCU + NPU | STM32N6 Neural-ART: CynipsNet 7.2M-param ASR (third-party, Oct 2026); Ethos-U85: Arm Conformer-S int8 via ExecuTorch (Jan 2026); Ethos-U55/Syntiant NDP120/eIQ Neutron: only KWS/command/vendor engines found | Ethos-U85-256 @1 GHz: 206.4M NPU cycles for a 15 s input = ~0.206 s (RTF ~0.014, NPU time only, FVP sim); STM32N6: latency not reported | Ethos-U85 run: 1.08 MB "method memory"; STM32N6: not reported | Conformer-S fp32 6.43% test-clean (int8 not reported); CynipsNet 5.32%/14.84% greedy | Feasible on U85/N6-class NPUs with sub-10M CTC models; Whisper not demonstrated on any MCU NPU |
| C: Linux SoC 0.5–1 TOPS (RV1106, SG2002, CV1800B) | sherpa-onnx RKNN list excludes RV1106; SG2002 demo found used cloud ASR + local NPU wake word only | — | 128–256 MB DDR on these boards | — | No on-device open-vocab ASR evidence found (GAP) |
| D: Linux SoC 3–6 TOPS (RK3588/RK3576, AX630C) | whisper.cpp CPU (RK3588); RKNN Whisper base 20 s (RK3588 NPU, Radxa); sherpa-onnx RKNN (streaming Zipformer, SenseVoice, Paraformer on RK3588/3576/3568/3566/3562); Axera StackFlow whisper-tiny/base/small, SenseVoice, Zipformer (AX630C) | whisper.cpp RK3588 8 threads: tiny RTF 0.10, base 0.16, small 0.47; RKNN Whisper-base-20s on RK3588: 1.37 s for 5.86 s English audio (RTF 0.234); AX630C whisper-tiny: encode 248 ms, decode 32.5 ms/token | whisper.cpp peak RSS: tiny 299 MB, base 410 MB, small 889 MB | Whisper tiny.en 6.3/15.9, base.en lower (see Q2/Q1 bullets) | Comfortable; CPU alone beats real time with ~5–10x headroom for tiny/base |
| E: Pi 5 (+Hailo-8L/8) | whisper (tiny.en/base.en) on CPU; Moonshine Voice streaming; Hailo whisper tiny/base (encoder on Hailo, decoder on CPU in community hybrid) | Pi 5 CPU: tiny.en RTF 0.23–0.39, base.en 0.41–0.61, small.en 1.05–1.88 (thermal throttling); Moonshine Tiny Streaming 237 ms vs Whisper Tiny 5,863 ms (Moonshine's own table); Hailo hybrid ~250 ms caption refresh | Whisper tiny.en/base.en <=15.5% of Pi RAM (RAM size unstated) | Moonshine Tiny Streaming 4.83% LS test-clean (quantized), Open-ASR avg 12.00%; Whisper Tiny Open-ASR 12.81% | Comfortable for tiny/base/Moonshine; small is marginal |
| F: Jetson Orin Nano | whisper_trt (TensorRT), faster-whisper, PyTorch whisper; Riva (JetPack 7.2 support unclear for Orin Nano), nemo-speech.cpp | whisper_trt: tiny.en 0.64 s and base.en 0.86 s for 20 s audio (RTF 0.032 / 0.043) | tiny.en 488 MB, base.en 439 MB (whisper_trt) | Same Whisper WERs | Overkill for tiny/base; enables small/medium |

### Cited Findings

**Tier A — ESP32-S3 / ESP32-P4**
- Oído (Lokutor) runs open-vocabulary English and Spanish ASR entirely on an ESP32-S3 (NVIDIA Conformer-CTC Small, fine-tuned; 16 layers, d=176, CTC over 1024 BPE tokens; optional 1.3M-param GRU LM). README status date 9 Oct 2026. LibriSpeech WER on chip: int8 greedy 3.7/8.2 (test-clean/test-other, 14.0 MB); int4 4.6/10.0 (8.3 MB); int8+LM 3.3/7.2 (15.3 MB); streaming+LM 32-frame chunks 4.9/11.0. Same table lists Espressif MultiNet7 (fixed command lists) on ESP32-S3 at 8.5/21.3 (2.7 MB), Moonshine tiny fp32 on laptop 5.0/12.1, Whisper tiny.en fp32 on laptop 6.3/15.9, Vosk small 9.9/21.6. — [Oído wiki/README](https://github.com/lokutor-ai/oido/wiki)
- Oído speed: English int8+LM runs at 1.97x real time (i.e., slower than real time); utterance mode shows text 6.9–7.4 s after a 3.6–3.8 s command ends (+0.8 s end-of-speech wait); streaming mode 4.1–4.2 s after end. README: "That is not real time yet." Dual-core mode disabled due to wrong transcripts on silicon. Memory: 2.4 MB PSRAM peak for a 20 s utterance; >=122 KB internal RAM free; requires ESP32-S3-WROOM-1-N16R8 (16 MB flash, 8 MB octal PSRAM). Uses no NPU. Code GPLv3 (commercial license available); weights CC-BY / CC-BY-SA. ESP32-P4 not mentioned. — [Oído wiki/README](https://github.com/lokutor-ai/oido/wiki)
- Oído robustness (mean WER over 14 noise/reverb conditions): CTC int8 8.4; CTC int8+LM 7.5; transducer int8 6.7; Whisper tiny.en 12.1; Moonshine tiny 12.2; Vosk small 21.7. — [Oído wiki/README](https://github.com/lokutor-ai/oido/wiki)
- ESP-SR MultiNet on ESP32-P4 is predefined command-word recognition (not open vocabulary); "Up to 200 commands are supported"; Chinese and English (no mixing in one command); must be used after WakeNet wake-up; stated response delay within 500 ms; supports single and continuous recognition until timeout. — [ESP-SR P4 Speech Command docs](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/speech_command_recognition/README.html). Note: the general ESP-SR component page says up to 300 commands — [ESP-SR component](https://components.espressif.com/components/espressif/esp-sr); treat the 200 vs 300 discrepancy as a docs-version difference.
- ESP-SR P4 benchmark page: MultiNet 7 uses 18 KB internal RAM, 2920 KB PSRAM, 8 ms avg per 32 ms frame. MultiNet LibriSpeech WER: MultiNet5-en 16.5/41.4, MultiNet6-en 9.0/21.3, MultiNet7-en 8.5/21.3. Speech-command accuracy at 3 m: MultiNet7_en 97.2% quiet, 92.3% stationary noise (SNR 5–10 dB), 90.6% speech noise. — [ESP-SR P4 benchmark](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/benchmark/README.html)
- No result reported running Whisper tiny itself on an ESP32-S3; openWakeWord FAQ notes an ESP32-S3 "may still take several seconds to process a single 80 ms frame" with quantized openWakeWord models (illustrates how compute-starved the S3 is for ONNX/TFLite transformer-ish models). — [openWakeWord README](https://github.com/dscripka/openWakeWord)

**Tier B — MCU with NPU**
- Arm (21 Jan 2026): end-to-end int8 Conformer-S (144-dim encoder, 16 layers, 4 heads, CTC, 128-token SentencePiece) trained on LibriSpeech, fp32 WER 6.43% test-clean (int8 WER not reported), deployed via ExecuTorch (MLEK 25.12 adds ExecuTorch 1.0.0) to Ethos-U85-256 (Corstone-320 FVP, also run on Alif Ensemble E8). NPU ACTIVE 206,370,332 cycles for one fixed 15 s input = ~0.206 s at 1 GHz; method memory 1,080,898 bytes used. Ethos-U85 scales 128–2048 MACs, up to 4 TOPS at 1 GHz. — [Arm IoT blog](https://developer.arm.com/community/arm-community-blogs/b/internet-of-things-blog/posts/end-to-end-int8-conformer-on-arm-training-quantization-and-deployment-on-ethos-u85)
- STM32N6570-DK (Cortex-M55 up to 800 MHz + Neural-ART NPU up to 600 GOPS) running CynipsNet v1.0, ~7.2M-param ASR on the NPU: WER 5.32% test-clean / 14.84% test-other (greedy, no LM); English only; capitals, no punctuation; best ~1 m from mic; ~0.2 W peak; latency/RTF and memory NOT reported. Source: fotonik-sk/stm32n6-asr. Article 8 Oct 2026. — [CircuitDigest](https://circuitdigest.com/news/this-stm32n6-turns-speech-into-text-offline-using-its-npu-and-a-7-2m-parameter-asr-model)
- STM32 model zoo v4.0 audio categories are Audio Event Detection (3 families) and Speech Enhancement (1 family); no official ASR model; zoo supports Neural-ART NPU. — [STM32 model zoo](https://stm32ai.st.com/model-zoo/)
- Ethos-U55 is "optimized to accelerate machine learning workloads based on convolutional and recurrent neural network (CNN, RNN) models" (not transformers). Arm ML Embedded Evaluation Kit ASR use case uses Wav2Letter (convolutional) on Corstone-300. — [Arm AI Tech Talk](https://developer.arm.com/-/media/Arm%20Developer%20Community/PDF/AI%20Tech%20Talks/AI_Tech_Talk_Run_ML_on_the_EthosU55); [MLEK gitiles](https://review.mlplatform.org/plugins/gitiles/ml/ethos-u/ml-embedded-evaluation-kit/+/afb0963b9d4413a398ebaa0185db88d88295e954)
- Sensory TrulyNatural runs on Alif Ensemble E3 (Cortex-M55 + Ethos-U55), recognition primarily on the Ethos-U55; a microwave LM footprint fell from 17 MB to 1.6 MB (vendor case study; domain-limited, not open vocab). — [Arm/Sensory case study](https://www.arm.com/company/success-library/made-possible/sensory)
- Syntiant NDP120: keyword spotting, multiple wake words, "local commands recognition", speaker ID, under 1 mW; sources (2021–2023) say "bigger vocabulary of commands", not open-vocabulary transcription. — [Design&Reuse](https://design-reuse.com/news/49260/syntiant-deep-learning-processor.html); [CNX Nicla Voice](https://cnx-software.com/2023/01/28/arduino-nicla-voice-always-on-speech-recognition-syntiant-ndp120-neural-decision-processor)
- NXP eIQ Neutron (MCX N, i.MX RT700): vendor materials cite "voice recognition/control" and ship VoiceSpot wake word + VIT command recognition; no open-vocab ASR demo found. — [edge-ai-vision MCX N](https://www.edge-ai-vision.com/2023/08/nxp-demonstration-of-ai-functions-implemented-on-low-power-mcx-and-rt-microcontrollers/); [CNX RT700](https://cnx-software.com/?p=138204)

**Tier C — small Linux SoC 0.5–1 TOPS**
- sherpa-onnx RKNN docs list boards "known to work": RK3588, RK3576, RK3568, RK3566, RK3562. RV1106 is not listed. Models: streaming Zipformer bilingual zh-en, SenseVoice 20 s, Paraformer-zh 15 s. — [sherpa-onnx RKNN docs](https://k2-fsa.github.io/sherpa/onnx/rknn/index.html)
- RV1106: Cortex-A7 1.2 GHz + RISC-V coprocessor; NPU 0.5 TOPS (G2) / 1.0 TOPS (G3) int8; 128 MB (Pro) / 256 MB (Max) DDR3L. No ASR demo found. — [CNX RV1106 SoM](https://www.cnx-software.com/2025/01/21/solderable-rockchip-rv1106-system-on-module-features-112-castellated-pins-offers-wifi-6-and-bluetooth-5-2-connectivity/); [Waveshare Luckfox Pico Pro](https://waveshare.com/luckfox-pico-pro.htm?sku=25717)
- SG2002 (LicheeRV Nano): 1 GHz main core, 256 MB DDR3, 1 TOPS int8 NPU; the Sophgo forum voice-chat demo uses cloud ASR, with only wake word/PANNs audio model on the NPU. — [Sipeed wiki](https://wiki.sipeed.com/hardware/en/lichee/RV_Nano/1_intro); [Sophgo forum](https://forum.sophgo.com/t/sg200x-licheerv-nano-duo-s-chat/621)

**Tier D — Linux SoC 3–6 TOPS**
- whisper.cpp on RK3588 (Turing RK1, 8 threads, 5-min 16 kHz English clip, Ubuntu 22.04; article dated 1 Jun 2026): tiny 29.79 s, RTF 0.10, 299 MB peak RSS; base 48.57 s, RTF 0.16, 410 MB; small 141.86 s, RTF 0.47, 889 MB; medium 453.96 s, RTF 1.51, 2.14 GB. — [Turing Pi blog](https://turingpi.com/whisper-cpp-piper-tts-arm64-turing-pi-rk3588/)
- RKNN Whisper (rknn_model_zoo via Radxa ROCK 4D docs): whisper base, fixed 20 s window (encoder input [1,80,2000]), RK3588 target in logs; English 5.855 s clip inferred in 1372.85 ms (RTF 0.234), Chinese 1656.6 ms (RTF 0.295); decoder token input fixed at [1,12]. RK3576 is a selectable TARGET_PLATFORM but not the tested one. — [Radxa whisper doc](https://docs.radxa.com/en/rock4/rock4d/application-dev/npu/whisper)
- M5Stack StackFlow whisper-tiny on AX630C-class (LLM630 Compute Kit / Module LLM) and AX650C (AI Pyramid): encoding time 248.0 ms, average decoding time 32.54 ms (per token implied); page also lists Whisper-base, Whisper-small, SenseVoice, KWS, Silero-VAD models without numbers. — [M5Stack whisper-tiny](https://docs.m5stack.com/en/stackflow/models/whisper-tiny)
- Axera Pulsar2 toolchain covers AX650/AX8850, AX630C/AX620Q, AX615, AX637; Axera's HF org lists Zipformer among audio models as a sherpa-onnx Axera backend; sherpa-onnx lists Axera NPU support; M5Stack AI Pyramid ships SenseVoice with separate ax630c and ax650 folders using sherpa-onnx-v1.12.20-axera build. — [AXERA-TECH HF](https://huggingface.co/AXERA-TECH); [M5Stack AI Pyramid sherpa-onnx](https://docs.m5stack.com/en/compute/ai_pyramid/sherpa_onnx)
- sherpa-onnx docs say small online (streaming) Zipformer models (14M, 20M params) are "suitable for resource constrained embedded systems" and that all models run in real time on Raspberry Pi 4 (qualitative). — [sherpa small online models](https://github.com/k2-fsa/sherpa/blob/master/docs/source/onnx/pretrained_models/small-online-models.rst)
- Third-party streaming Zipformer (Korean, 174M) RTF on desktop CPU: int8 chunk-16 RTF 0.073 at 1 thread, 320 ms latency; fp32 0.134 (not embedded). — [HF model card](https://huggingface.co/kangkyu/icefall-asr-ko-streaming-zipformer-174m)

**Tier E — Raspberry Pi 5 (+ Hailo)**
- UT Dallas (arXiv 2507.14451, 19 Jul 2025): on Raspberry Pi 5, fine-tuned Whisper tiny.en RTF ~0.23–0.39 across 9–30 s clips; base.en RTF ~0.41–0.61; small.en RTF ~1.05–1.88 and triggered thermal throttling near 80 C; RAM: tiny.en <15%, base.en peak 15.5%, small.en 17% (Pi RAM size not stated); GFLOPs ~24–28 (tiny.en), ~68–72 (base.en), ~304–313 (small.en). Runtime (whisper.cpp vs PyTorch) not stated in the extract — UNVERIFIED which runtime. — [arXiv 2507.14451](https://arxiv.org/html/2507.14451v1)
- Moonshine Voice docs table: Moonshine Tiny Streaming 34M params, Open-ASR avg WER 12.00%, R. Pi 5 latency 237 ms; Whisper Tiny 39M, 12.81%, 5,863 ms; Moonshine Small Streaming 123M, 7.84%, 527 ms; Whisper Small 244M, 8.59%, 10,397 ms. Latency definition not specified on page (vendor table). — [Moonshine docs mirror](https://mintlify.wiki/moonshine-ai/moonshine)
- Moonshine LibriSpeech test-clean WER (shipped quantized): Tiny Streaming 4.83%, Small Streaming 2.61%, Medium Streaming 2.17%. Model table: Tiny Streaming 34M, Small Streaming 123M, Medium Streaming 245M, Base 58M (10.07%), Tiny 26M (12.66%); MIT license. — [Moonshine accuracy](https://moonshine-voice.readthedocs.io/en/latest/models/accuracy/); [Available models](https://moonshine-voice.readthedocs.io/en/latest/models/available-models/)
- Moonshine paper (Oct 2024): 5x compute reduction vs Whisper tiny-en for a 10 s segment, no WER increase; trained on variable-length segments without zero-padding. — [arXiv 2410.15608](https://arxiv.org/abs/2410.15608). Moonshine v2 (12 Feb 2026): sliding-window self-attention streaming encoder, "bounded, low-latency inference", matches models 6x its size (no numbers in abstract). — [arXiv 2602.12241](https://arxiv.org/abs/2602.12241)
- Hailo: official hailo-whisper repo supports Whisper tiny/tiny.en/base/base.en on Hailo-8 (DFC 3.x, also 8L) and Hailo-10H (DFC 5.x); requires HailoRT >= 4.20, Python 3.10/3.11; tested on x86 Ubuntu 22; token embedding runs on host; English-only models; full release announced 14 Jul 2025, repo 12 Sep 2025; no latency numbers published. — [hailo-whisper](https://github.com/hailocs/hailo-whisper); [Hailo community release post](https://community.hailo.ai/t/whisper-full-release-now-available/16228)
- Community hybrid (17 Oct 2025): encoder on Hailo-8L, decoder on Pi 5 CPU; "~250ms refresh time" live captions; claimed 8.4x faster than faster-whisper on CPU; running whole model on Hailo "really slow in autoregressive decoding without KV cache". Single-user claim. — [Hailo community thread](https://community.hailo.ai/t/real-time-asr-on-raspberry-pi-hailo8l-with-whisper/17936)
- whisper.cpp ggml model sizes: tiny.en 75 MiB, base.en 142 MiB. — [HF ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp)
- Home Assistant (Feb 2025): Whisper on Pi 4 "takes at least 5 seconds to turn your speech into text"; Speech-to-Phrase (closed phrase set, not open vocab) <1 s on Green/Pi 4, ~150 ms per command on Pi 5. — [HA Voice Chapter 9](https://www.home-assistant.io/blog/2025/02/13/voice-chapter-9-speech-to-phrase/)
- Interspeech 2021 (ETRI): a speech recognizer at 0.84 xRT with avg latency 0.75 +/- 0.62 s on Raspberry Pi 4B (model unnamed in snippet). — [ETRI](https://ksp.etri.re.kr/ksp/article/read?id=63962)

**Tier F — Jetson Orin Nano**
- NVIDIA whisper_trt, Orin Nano, 20 s of speech: tiny.en PyTorch 1.74 s / 569 MB; faster_whisper 0.85 s / 404 MB; whisper_trt 0.64 s / 488 MB. base.en PyTorch 2.55 s / 666 MB; whisper_trt 0.86 s / 439 MB. (Benchmark date not stated.) — [whisper_trt](https://github.com/NVIDIA-AI-IOT/whisper_trt)
- Riva Quickstart on JetPack 7.2 "appears to be targeted at the Jetson Thor platform" per an Aug 2026 forum thread; NVIDIA staff pointed to nemo-speech.cpp "verified on Jetpack 7.2+Orin". — [NVIDIA forum](https://forums.developer.nvidia.com/t/nvidia-riva-support-for-jetson-orin-nano-with-jetpack-7-2/378939); [nemo-speech NGC](https://catalog.ngc.nvidia.com/orgs/nvidia/-/containers/nemo-speech/26.07)

**Other engines (status)**
- Picovoice Cheetah (streaming) and Leopard (batch) support Linux/macOS/Windows/Android/iOS/Web and Raspberry Pi 3/4/5; ESP32 not listed; models under 20 MB "not microcontrollers" per 2022 launch coverage. — [Cheetah docs](https://picovoice.ai/docs/cheetah); [Leopard C quickstart](https://picovoice.ai/docs/quick-start/leopard-c); [Hackster](https://hackster.io/news/picovoice-launches-on-device-speech-to-text-engines-cheetah-and-leopard-43b9d7a577b4)
- Coqui STT: "This project is no longer actively maintained"; model zoo hosting stopped; users pointed to Whisper. — [coqui-ai/STT](https://github.com/coqui-ai/STT)
- Vosk: portable per-language models ~50 MB; runs offline on Raspberry Pi, Android, iOS; streaming API; 20+ languages; no WER or latency on page. Oído table: Vosk small 9.9/21.6 LibriSpeech. — [Vosk](https://alphacephei.com/vosk/); [Oído wiki](https://github.com/lokutor-ai/oido/wiki)
- Kyutai STT: 1B (en/fr, 0.5 s delay, semantic VAD) and 2.6B (en, 2.5 s delay) models; PyTorch/Rust(CUDA)/MLX runtimes; 1B reportedly runs on iPhone 16 Pro; no CPU or embedded Linux mention; weights CC-BY 4.0. — [delayed-streams-modeling](https://github.com/kyutai-labs/delayed-streams-modeling)
- Qualcomm AI Hub Whisper Tiny En encoder-only profiles (GPU): 84.4 ms (Snapdragon 8 Elite), 101–114 ms (Galaxy S23/SM8550), 129–139 ms (QCS8450), 191 ms (SA8775P), 405 ms (SA7255P); encoder only, fixed 80x3000 input; Jun–Aug 2025 jobs. — [AI Hub job](https://aihub.qualcomm.com/jobs/jgdq3e9e5)
- Arm AI Portal Whisper (INT8, XNNPACK/ExecuTorch, Android CPU): end-to-end latency p50 1169.5 ms vs 1547 ms baseline on LibriSpeech test-clean. — [Arm AI Portal](https://developer.arm.com/ai/models/hugging-face/Arm/whisper-tiny-int8-xnnpack-executorch/whisper-tiny-int8-pte)

### Inferences
- The gap between Tier A and Tier D is ~20x: Oído on ESP32-S3 at 1.97x RT vs whisper.cpp tiny on RK3588 at 0.10 RTF. A P4 (400 MHz, dual RISC-V, larger PSRAM) would plausibly be 2–3x faster than the S3 for the same Oído model but that is an extrapolation; no P4 port exists.
- On Tier B the only real-time open-vocab path is a small CTC Conformer compiled for a transformer-capable NPU (Ethos-U85, Neural-ART). The ~0.2 s NPU time per 15 s audio on U85-256 is a simulator number excluding feature extraction, CTC decode and memory stalls; expect real wall-clock to be several times higher.
- Whisper's fixed 30 s (or 20 s on RKNN) padded window makes it a poor fit for short child utterances on NPUs; Moonshine (variable-length) and streaming Zipformer/SenseVoice (sherpa-onnx) are the better engine class for toys at Tiers D–E.
- Tier C currently has no evidence base at all for open-vocab STT; the 128–256 MB DDR alone rules out Whisper and makes even sherpa-onnx small Zipformer (14–20M params) a from-scratch porting job.

### Gaps
- No whisper.cpp `bench` numbers found specifically for Raspberry Pi 5 from a primary source (secondary guides claim tiny 1–2x RT and base ~RT at -t 4, UNVERIFIED). The UT Dallas Pi 5 RTF figures do not state the runtime.
- sherpa-onnx RKNN "Speed test" numbers (SenseVoice int8 on Cortex-A55/A76 and on one RK3588 NPU core) exist on the docs page but the values were not retrievable (page fetch returned 404 for the SenseVoice sub-page; search budget exhausted).
- No RTF/latency for any STT engine on RK3576, AX630C beyond M5Stack's whisper-tiny encode/decode times, RV1106, SG2002, CV1800B, Ethos-U55, Syntiant NDP, or eIQ Neutron.
- STM32N6 CynipsNet latency, memory and whether vocabulary is open were not reported in the article.
- Vosk and wenet embedded RTF: no measurements found. Coqui STT last release date not confirmed.
- Jetson Orin Nano Parakeet/Riva latency: none found.

## Key Question 2: Child speech accuracy — do tiny models degrade badly on kids?

### Takeaway
Yes: zero-shot Whisper WER on children's speech roughly doubles from small to tiny (MyST 13.4% -> 20.6%; OGI read speech 25.4% -> 53.8% in one benchmark), but fine-tuning on ~130–200 h of child speech recovers most of the gap (tiny.en 28.0% -> 15.9% on MyST), so a fine-tuned tiny-class model is viable while an off-the-shelf tiny model is not.

### Cited Findings
- Zero-shot WER (MyST test / OGI test), Interspeech 2024 benchmark: Whisper-tiny (39M) 20.6 / 53.8; Whisper-base (74M) 16.8 / 38.0; Whisper-small (242M) 13.4 / 25.4; Whisper-large-v3 12.6 (MyST) / 19.9 (OGI); Canary 1.0B 9.5 / 18.2. MyST filtered to ~133 h training, utterances >30 s removed. — [arXiv 2406.10507](https://arxiv.org/pdf/2406.10507)
- UT Dallas on-device paper (Jul 2025), MyST (ages 8–11) test A(Org): zero-shot tiny.en 28.0%, base.en 22.9%, small.en 18.8%; fine-tuned tiny.en 15.9%, base.en 13.9%, small.en 13.0%; multilingual tiny/base/small zero-shot 31.4/25.6/20.4. Best 11.8% on filtered test with fine-tuned tiny.en. Paper states relative WER reduction 36/49/55% for small.en/base.en/tiny.en (table arithmetic gives ~31/39/43%; discrepancy noted by the fetch). "Zero-shot test WER reduced as the model size increased from tiny to medium, and saturated thereafter." — [arXiv 2507.14451](https://arxiv.org/html/2507.14451v1)
- Kid-Whisper (AAAI AIES 2024): with better MyST preprocessing, Whisper-Small MyST test WER 13.93% -> 9.11%, Medium 13.23% -> 8.61%; on CSLU Kids spontaneous (not in training) Small 32.00% -> 27.16%, Medium 31.85% -> 16.53%. — [arXiv 2309.07927](https://arxiv.org/html/2309.07927v3); [AIES paper](https://ojs.aaai.org/index.php/AIES/article/view/31618)
- A separate 2023 comparison reports much higher zero-shot MyST WERs under its setup: tiny 40.09, base 32.14, tiny.en 33.02; most models "hovering around the 25% mark even for the much larger models". — [arXiv 2311.04936](https://arxiv.org/pdf/2311.04936)
- Learning Agency report: fine-tuning Whisper on child voice datasets reduces error rate 12–30% on held-out same-dataset data. — [Learning Agency](https://the-learning-agency.com/guides-resources/finetuning-asr-models-for-child-voices/)
- 2025 causal analysis fine-tunes Wav2Vec2.0 and Whisper on MyST and analyzes error drivers by age/gender on CSLU (numbers not seen). — [arXiv 2502.08587](https://arxiv.org/pdf/2502.08587)

### Inferences
- A toy for ages ~4–8 will see worse numbers than MyST (ages 8–11 conversational); CSLU/OGI read speech from younger children is 2–3x worse for tiny/base, so plan on fine-tuning whatever on-device model is chosen, or on server-side large models.
- None of the child-speech papers evaluate Moonshine, Zipformer, SenseVoice, or Oído's Conformer; the tiny-Whisper degradation curve is the only quantified evidence and is likely representative of other ~30–40M-param models.

### Gaps
- No child-speech WER found for Moonshine, sherpa-onnx Zipformer/SenseVoice, Picovoice, Vosk, or any Tier A/B model.
- No child-speech evaluation on noisy/far-field toy-like conditions (all cited work is on curated corpora).

## Key Question 3: Streaming vs batch — which embedded engines emit partials and latency implications

### Takeaway
Streaming with partials is available at Tier D+ via sherpa-onnx streaming Zipformer, Moonshine Streaming (v2), Picovoice Cheetah, Vosk and Kyutai; Whisper (whisper.cpp, RKNN, Hailo) is batch over fixed 20–30 s windows and is emulated as streaming by re-running on growing buffers; at Tier A Oído offers a streaming mode that trades accuracy for ~3 s less latency but still finishes >4 s after end of speech.

### Cited Findings
- Moonshine Streaming models (Tiny/Small/Medium, v2 architecture, sliding-window attention, "bounded, low-latency inference"); toolkit "Optimized for live streaming" with work done while the user is still talking. — [arXiv 2602.12241](https://arxiv.org/abs/2602.12241); [moonshine repo](https://github.com/usefulsensors/moonshine)
- sherpa-onnx ASR support covers streaming and non-streaming; Zipformer (streaming) and SenseVoice (non-streaming) both on RKNN NPU; streaming Zipformer int8 chunk-16 has 320 ms algorithmic latency (third-party card). — [sherpa-onnx README](https://cdn.jsdelivr.net/gh/k2-fsa/sherpa-onnx@master/README.md); [sherpa RKNN](https://k2-fsa.github.io/sherpa/onnx/rknn/index.html); [HF card](https://huggingface.co/kangkyu/icefall-asr-ko-streaming-zipformer-174m)
- Picovoice Cheetah = streaming (incremental results); Leopard = batch. — [Cheetah docs](https://picovoice.ai/docs/cheetah)
- Vosk provides a streaming API. — [Vosk](https://alphacephei.com/vosk/)
- Kyutai STT: 0.5 s delay (1B) / 2.5 s (2.6B) streaming; GPU/Apple-silicon runtimes only. — [delayed-streams-modeling](https://github.com/kyutai-labs/delayed-streams-modeling)
- RKNN Whisper uses a fixed 20 s encoder window and fixed 12-token decoder input (batch). — [Radxa](https://docs.radxa.com/en/rock4/rock4d/application-dev/npu/whisper)
- Whisper pads every input to 30 s; Moonshine's compute scales with input length. — [arXiv 2509.02523](https://arxiv.org/pdf/2509.02523)
- Hailo: running Whisper decoder on the accelerator is slow "without KV cache"; hybrid encoder-on-NPU/decoder-on-CPU gives ~250 ms caption refresh. — [Hailo thread](https://community.hailo.ai/t/real-time-asr-on-raspberry-pi-hailo8l-with-whisper/17936)
- Oído streaming: text 4.1–4.2 s after end of a 3.6–3.8 s command (vs 6.9–7.4 s utterance mode), WER 4.9/11.0 vs 3.3/7.2 utterance+LM. — [Oído wiki](https://github.com/lokutor-ai/oido/wiki)
- Picovoice general latency decomposition for cloud STT: network ~50 ms+, audio buffering ~250 ms, model 100–300 ms, endpoint detection 200–500 ms; cloud systems typically 500–1200 ms end to end in real deployments (vendor estimate). — [Picovoice blog](https://picovoice.ai/blog/latency-in-speech-recognition)

### Inferences
- For a conversational toy the dominant latency is end-of-speech detection plus final decode; streaming encoders (Zipformer, Moonshine v2) let the final transcript land within a few hundred ms of endpoint on Tier D–E, whereas batch Whisper adds the full utterance decode (0.3–0.6x utterance length on Pi 5 CPU) after endpoint.

### Gaps
- No measured "time from end-of-speech to final transcript" for sherpa-onnx streaming Zipformer or Moonshine Streaming on RK3588/Pi 5 from a primary source; Moonshine's "237 ms" Pi 5 figure lacks a definition.

## Key Question 4: Wake word + VAD on device — best options per tier and footprint

### Takeaway
On ESP32-S3/P4, Espressif WakeNet9/10 (16–20 KB RAM, 324–523 KB PSRAM, 2.6–4.1 ms per 32 ms frame) and ESPHome microWakeWord are proven; openWakeWord and Silero VAD are Linux-tier (Pi 3 single core runs 15–20 openWakeWord models); Picovoice Porcupine/Cobra cover Cortex-M, Pi and Linux but do not list ESP32.

### Cited Findings
- ESP-SR on ESP32-P4 @400 MHz: AFE pipeline AEC -> VAD (vadnet1_medium) -> WakeNet (wn9_hilexin); single-mic SR LOW_COST config 60.1 KB internal RAM, 739.7 KB PSRAM, 8.8% feed / 9.8% fetch CPU (one core); dual-mic MMNR SR LOW_COST 79.1 KB / 1153.7 KB / 23.7% / 22.9%. — [ESP-SR P4 benchmark](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/benchmark/README.html)
- WakeNet resource: quantised WakeNet9 2-ch 16 KB RAM, 324 KB PSRAM, 2.6 ms per 32 ms frame; 3-ch 20 KB / 347 KB / 3.1 ms; WakeNet10 3-ch 16 KB / 523 KB / 4.1 ms, 14.1% CPU on one core. WakeNet9 Alexa model on ESP32-S3-Korvo: 98% wake rate quiet at 1 m/3 m, 94% in speech noise SNR 4 dB, false trigger once in 12 h. WakeNet10 released Aug 2026 (changelog). — [ESP-SR P4 benchmark](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/benchmark/README.html); [ESP-SR component](https://components.espressif.com/components/espressif/esp-sr)
- No standalone VADNet resource table on the P4 benchmark page; VADNet appears only inside the AFE pipeline numbers above. — [ESP-SR P4 benchmark](https://docs.espressif.com/projects/esp-sr/en/latest/esp32p4/benchmark/README.html)
- microWakeWord: MixConv streaming model, 40 spectrogram features per 10 ms, inference every 30 ms, quantized, TFLite-Micro; created because openWakeWord "was too large to run on low power devices like S3-BOX-3"; requires ESP32-S3 with PSRAM; v2 models claimed 2x better than v1 on a Picovoice-style benchmark; S3 can run three wake words simultaneously. No published tensor-arena size or FA/hour (HA says FA/hour is treated as trade secret). — [microWakeWord](https://github.com/kahrendt/microWakeWord); [HA Voice Ch.6](https://home-assistant.io/blog/2024/02/21/voice-chapter-6); [HA Voice Ch.7](https://www.home-assistant.io/blog/2024/06/26/voice-chapter-7/)
- openWakeWord: single Pi 3 core runs 15–20 models in real time; targets <5% false-reject and <0.5/h false-accept; "likely too heavy for very low-power edge devices" — several seconds per 80 ms frame on ESP32-S3; recommends microWakeWord there. — [openWakeWord](https://github.com/dscripka/openWakeWord)
- Silero VAD: ~0.24M params, ~2.27 MB float ONNX; <1 ms per 30+ ms chunk on one x86 CPU thread; 8/16 kHz; license listed CC BY-NC 4.0 on PyPI (a fork says MIT — check before commercial use); no MCU port found. M5Stack lists a Silero-VAD model for Axera NPUs. — [silero-vad PyPI](https://pypi.org/project/silero-vad); [Qualcomm Silero-VAD](https://huggingface.co/qualcomm/Silero-VAD); [M5Stack](https://docs.m5stack.com/en/stackflow/models/whisper-tiny)
- Picovoice Porcupine platforms: Arm Cortex-M (STM32, Arduino), Raspberry Pi Zero/3/4/5, Android, iOS, web, Linux/macOS/Windows; ESP32 not listed; Cobra VAD has Microcontroller/Arduino quick starts. No footprint numbers on page. — [Porcupine docs](https://picovoice.ai/docs/porcupine/)
- Research wake-word latency: phone-aligned models ~130–150 ms, E2E models slower (before look-ahead). — [arXiv 2207.03331](https://arxiv.org/pdf/2207.03331)

### Inferences
- On the ESP32-P4 the full AFE+WakeNet+VAD front end costs <25% of one core and ~1.2 MB PSRAM even in the dual-mic noise-reduction configuration, leaving the second core and most PSRAM free for networking/audio playback; this is the mature path for Nessie's client.

### Gaps
- microWakeWord per-model flash/RAM/inference-time numbers (ESPHome manifests) not retrieved.
- Porcupine/Cobra MIPS and RAM figures not on the fetched page.
- No independent (non-vendor) wake-word false-accept comparison across WakeNet, microWakeWord, Porcupine.

## Key Question 5: Practical verdict — minimum viable hardware for on-device open-vocab STT in a toy (2026)

### Takeaway
Minimum viable for real-time open-vocabulary STT with acceptable child-speech accuracy is Tier D (RK3588/RK3576/AX630C-class, >=2 GB RAM) or Tier E (Pi 5), running a fine-tuned tiny-class model (Whisper tiny.en, Moonshine Tiny Streaming, or small streaming Zipformer) at RTF 0.1–0.4 with sub-second post-endpoint latency; Tier A is 2x slower than real time and Tier B is only feasible with bleeding-edge NPUs and research-grade CTC models.

### Cited Findings
- Tier A ceiling: Oído on ESP32-S3 1.97x real time, text 4–7 s after end of speech, author: "not real time yet". — [Oído wiki](https://github.com/lokutor-ai/oido/wiki)
- Tier B evidence is two 2026 demos (Arm Conformer-S on Ethos-U85 FVP/Alif E8, Jan 2026; CynipsNet on STM32N6, Oct 2026) with no reported wall-clock latency on real hardware and no child-speech data. — [Arm blog](https://developer.arm.com/community/arm-community-blogs/b/internet-of-things-blog/posts/end-to-end-int8-conformer-on-arm-training-quantization-and-deployment-on-ethos-u85); [CircuitDigest](https://circuitdigest.com/news/this-stm32n6-turns-speech-into-text-offline-using-its-npu-and-a-7-2m-parameter-asr-model)
- Tier D: whisper.cpp tiny/base RTF 0.10/0.16 on RK3588 CPU, 299–410 MB RSS. — [Turing Pi](https://turingpi.com/whisper-cpp-piper-tts-arm64-turing-pi-rk3588/)
- Tier E: Pi 5 tiny.en RTF 0.23–0.39, base.en 0.41–0.61, small.en >1 with throttling; fine-tuned tiny.en 15.9% WER on MyST. — [arXiv 2507.14451](https://arxiv.org/html/2507.14451v1)
- Moonshine Tiny Streaming on Pi 5: 237 ms (vendor), Open-ASR 12.00% vs Whisper Tiny 12.81%. — [Moonshine docs mirror](https://mintlify.wiki/moonshine-ai/moonshine)
- Amazon's on-device Alexa ASR (RNN-T, <1% of cloud model size) still requires a neural accelerator (AZ family) to run at acceptable speed. — [Amazon Science](https://www.amazon.science/blog/on-device-speech-processing-makes-alexa-faster-lower-bandwidth)

### Inferences
- Realistic latency budget on Tier D/E with a streaming engine: endpoint detection ~300–800 ms + final decode <300 ms = ~0.6–1.1 s from the child stopping talking to transcript; with batch Whisper tiny on Pi 5 CPU add ~0.25–0.4x utterance length (e.g. +1–2 s for a 5 s utterance).
- For Nessie specifically, the ESP32-P4 cannot host open-vocab STT today; its correct role is wake+VAD+AFE+segmentation (which ESP-SR covers with measured footprint) with STT on the home server or a Tier D/E module.
- If an all-in-device product is required later, the cheapest board class with evidence is RK3588/RK3576 or AX630C (M5Stack Module LLM) — not Pi-5-plus-Hailo, since Hailo only helps the encoder and the decoder stays on CPU.

### Gaps
- No single source benchmarks all engines on one board; cross-tier comparisons above mix runtimes, clip lengths and dates.
- No power/thermal data for sustained STT on RK3576 or AX630C.

## Key Question 6: Hybrid architecture evidence (on-device wake+VAD+segmentation, server/cloud STT) and latency numbers

### Takeaway
Home Assistant Voice PE (ESP32-S3 + XMOS, on-device wake word, STT on an N100-class server or cloud) and Alexa (on-device RNN-T producing a lattice, cloud LM rescoring; speculative end-pointer ~200 ms faster) are the two documented hybrids; HA reports sub-second local commands via Speech-to-Phrase (~150 ms on Pi 5) but >=5 s for Whisper on Pi 4, and no official end-to-end Voice PE latency exists.

### Cited Findings
- HA Voice Preview Edition (19 Dec 2024): ESP32-S3 with 8 MB octal PSRAM, dual mics, XMOS chip for AEC/noise/AGC; STT runs on the Home Assistant server (recommended Intel N100 or better) or Home Assistant Cloud; STT is "the harder of the two to run locally"; no latency figures. — [HA Voice PE blog](https://www.home-assistant.io/blog/2024/12/19/voice-preview-edition-the-era-of-open-voice/)
- Voice PE product page: performance depends on server hardware; suggests HA Cloud on Pi-class hosts. — [Pimoroni listing](https://shop.pimoroni.com/en-au/products/home-assistant-voice)
- HA Speech-to-Phrase (13 Feb 2025): Whisper on Pi 4 >=5 s; Speech-to-Phrase <1 s on Green/Pi 4, ~150 ms per command on Pi 5 (closed phrase set). — [HA Voice Ch.9](https://www.home-assistant.io/blog/2025/02/13/voice-chapter-9-speech-to-phrase/)
- Community/guide latency reports (UNVERIFIED, secondary): Voice PE "sub-second response on common commands"; whisper tiny-int8 ~3–5 s on Pi 4, base-int8 ~8–12 s on Pi 5 in HA pipelines; HA core issue #160534 about STT lag in 2026.1. — [botmonster review](https://botmonster.com/smart-home/home-assistant-voice-preview-edition-review/); [aivideosensei guide](https://aivideosensei.com/guides/home-assistant-local-voice-guide)
- Hailo community Whisper service exposes a Wyoming Protocol interface for HA (v1.0.0). — [Hailo community](https://community.hailo.ai/t/whisper-hailo8-l-fastapi/15806)
- Amazon (25 Jan 2022): on-device end-to-end RNN-T compresses cloud models to <1% size with minimal accuracy loss; device emits a ranked lattice, cloud LM reranks; two end-pointers, speculative one ~200 ms faster than final; runs on AZ-family neural edge processors. — [Amazon Science](https://www.amazon.science/blog/on-device-speech-processing-makes-alexa-faster-lower-bandwidth)
- AZ1 Neural Edge (Amazon/MediaTek) vendor claims: "reduces hundreds of milliseconds per response", 2x faster speech processing, 85% lower memory vs predecessor (no independent benchmark). — [Android Central](https://androidcentral.com/amazons-az1-neural-edge-processor-makes-alexa-even-faster)
- Alexa models went "from gigabytes to less than 100MB" with E2E models; offline models need an on-device accelerator. — [VentureBeat](https://venturebeat.com/ai/amazon-embraces-end-to-end-models-to-improve-alexas-speech-recognition)
- Picovoice cloud-STT latency decomposition: network ~50 ms+, buffering ~250 ms, model 100–300 ms, endpointing 200–500 ms; 500–1200 ms typical (vendor estimate). — [Picovoice blog](https://picovoice.ai/blog/latency-in-speech-recognition)

### Inferences
- The Nessie design (ESP32-P4 wake/VAD/segmentation -> LAN WebSocket -> laptop STT) mirrors HA Voice PE and is the architecture every shipping consumer product uses at the MCU tier; a LAN hop (~ms) removes most of the 500–1200 ms cloud budget, leaving endpointing + server STT as the latency floor.

### Gaps
- No primary measured end-to-end latency (wake -> transcript) for HA Voice PE, Alexa, or Wyoming satellites.
- Web-search budget exhausted before checking Wyoming protocol docs or ESPHome voice_assistant timing options.
