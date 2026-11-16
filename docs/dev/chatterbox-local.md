# Chatterbox TTS local setup (macOS, Apple Silicon)

Nessie's TS server calls a separate Chatterbox TTS HTTP server for synthesis
when `DEFAULT_TTS_PROVIDER=chatterbox` or when the UI toggles to Chatterbox.
The upstream project is
[devnen/Chatterbox-TTS-Server](https://github.com/devnen/Chatterbox-TTS-Server),
a FastAPI wrapper around the Resemble AI Chatterbox model.

This guide covers native install on an Apple Silicon Mac (so the server can
use Metal/MPS acceleration). Docker containers on macOS do **not** get Metal
access — see [Docker vs native](#docker-vs-native) below.

## Install location

```bash
git clone https://github.com/devnen/Chatterbox-TTS-Server.git ~/dev/chatterbox-tts-server
cd ~/dev/chatterbox-tts-server
uv venv --python 3.11
```

## Dependencies

The upstream `requirements.txt` pins a Linux CPU PyTorch index. On macOS arm64
we need the default PyPI wheels (which ship with MPS). Use the Nessie-specific
requirements list (committed in the Nessie repo at
`docs/dev/chatterbox-requirements-macos.txt`, or copy inline from below):

```bash
# Base deps (macOS arm64 PyTorch with MPS)
uv pip install --python .venv/bin/python \
  torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 \
  conformer==0.3.2 diffusers==0.29.0 transformers==4.46.3 \
  einops omegaconf==2.3.0 resampy==0.4.3 resemble-perth==1.0.1 \
  'fastapi>=0.100.0,<0.116.0' 'uvicorn[standard]>=0.27.0' \
  'numpy>=1.24.0' 'librosa>=0.10.0' 'safetensors>=0.4.0' \
  descript-audio-codec==1.0.0 'soundfile>=0.12.0' 'pydub>=0.25.0' \
  'audiotsm>=0.1.2' 'praat-parselmouth>=0.4.0' \
  'python-multipart>=0.0.5' 'requests>=2.28.0' 'Jinja2>=3.1.2,<3.2.0' \
  'aiofiles>=23.0.0' 'hf_transfer>=0.1.4' \
  'PyYAML>=6.0' 'watchdog>=3.0.0' 'unidecode>=1.3.0' 'inflect>=7.0.0' 'tqdm>=4.65.0'

# Chatterbox Turbo (with Turbo tags) — must be --no-deps
uv pip install --python .venv/bin/python --no-deps \
  'git+https://github.com/devnen/chatterbox-v2.git@master' \
  s3tokenizer==0.3.0 onnx==1.16.0

# Chatterbox imports pkg_resources, dropped from setuptools>=80
uv pip install --python .venv/bin/python 'setuptools<80' 'protobuf>=4.25.0'
```

## Known MPS quirks and workarounds

### setuptools ≥80 drops `pkg_resources`

The `resemble-perth` watermarker imports `pkg_resources`, which is gone in
modern setuptools. Pin `setuptools<80` (see above).

### torchaudio sinc resampler hits MPS conv1d ceiling

`torchaudio.transforms.Resample` uses a conv1d that throws
`NotImplementedError: Output channels > 65536 not supported at the MPS device`
on macOS, and `PYTORCH_ENABLE_MPS_FALLBACK=1` does **not** cover this op
([pytorch#134416](https://github.com/pytorch/pytorch/issues/134416)).

Patch the upstream `get_resampler` to run the resampler on CPU and copy the
result back to MPS. Edit
`.venv/lib/python3.11/site-packages/chatterbox/models/s3gen/s3gen.py`,
replacing the `get_resampler` function:

```python
class _CpuResampleWrapper:
    def __init__(self, resampler, target_device):
        self._resampler = resampler
        self._target_device = target_device

    def __call__(self, x):
        return self._resampler(x.to("cpu")).to(self._target_device)


@lru_cache(100)
def get_resampler(src_sr, dst_sr, device):
    resampler = ta.transforms.Resample(src_sr, dst_sr).to("cpu")
    return _CpuResampleWrapper(resampler, device)
```

Only the resample op runs on CPU; the rest of inference stays on MPS.

## Configure

Edit `config.yaml` in the Chatterbox server directory:

```yaml
tts_engine:
  device: mps              # was "auto"
audio_output:
  format: wav
  sample_rate: 16000       # was 24000 — matches the Nessie pipeline
```

## Run

```bash
PYTORCH_ENABLE_MPS_FALLBACK=1 HF_HUB_ENABLE_HF_TRANSFER=1 \
  .venv/bin/python server.py
```

First run downloads ~500 MB of model weights to `hf_cache/`. Subsequent
starts load in ~15 s.

The server listens on `http://localhost:8004` by default. Swagger docs at
`/docs`, web UI at `/`.

## Point Nessie at it

Defaults in `server/src/config.ts` already match: `CHATTERBOX_URL` defaults to
`http://localhost:8004` and `CHATTERBOX_VOICE` to `Emily.wav`. Override via
`.env`:

```
CHATTERBOX_URL=http://localhost:8004
CHATTERBOX_VOICE=Emily.wav
DEFAULT_TTS_PROVIDER=elevenlabs   # or chatterbox
```

Switch providers per-request by toggling the dropdown in the Nessie web UI
(top-right). The setting is persisted in `localStorage`.

## Voice reference files

Chatterbox clones voices from a short reference WAV in `voices/` or
`reference_audio/` (in the server directory). 28 preset voices ship
out-of-the-box; pick one or drop your own 5–30 second clean sample in.

Voice filenames must match `CHATTERBOX_VOICE` exactly (including `.wav`).

## Measured latency (M1 Max, 64 GB)

| | Time |
|--|--|
| First request (model + reference embedding warmup) | ~50 s |
| Warm request, ~5 s output audio | 7–8 s |

The resampler-on-CPU patch adds noticeable overhead. Upstream PyTorch fix
tracked in [pytorch#134416](https://github.com/pytorch/pytorch/issues/134416);
re-benchmark when PyTorch 2.6+ lands.

## Docker vs native

Docker on macOS runs a Linux VM via Hypervisor.framework, which does not
virtualize Metal. `PyTorch MPS` requires direct Metal API access and cannot
be reached from inside any Docker-on-Mac container as of 2026-04 (Docker
Model Runner runs vLLM natively on the host, not inside a container). Podman
+ libkrun can forward Vulkan via MoltenVK for llama.cpp-style workloads, but
PyTorch MPS does not use that path.

If you accept CPU inference (5–10x slower than MPS) you can use the upstream
`docker-compose-cpu.yml`. For real-time use, run natively as above.
