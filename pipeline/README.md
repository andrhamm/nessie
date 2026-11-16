# Nessie pipeline

Local speech-to-text for the Nessie server. It runs [mlx-whisper](https://pypi.org/project/mlx-whisper/), so it needs Apple Silicon.

The server spawns `uv run python3 src/transcriber.py` and exchanges one JSON message per line over stdin and stdout. Each request carries base64-encoded 16 kHz, 16-bit mono PCM. Each response is either `{"type":"transcript","text":...,"language":...}` or `{"type":"error","message":...}`.

```bash
uv sync
uv run pytest -q
uvx ruff check .
```
