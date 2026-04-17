"""JSONL transcription service using mlx-whisper.

Reads JSON commands from stdin, writes JSON responses to stdout.
Runs as a long-lived subprocess spawned by the Bun server.

Protocol:
  Input:  {"type": "transcribe", "id": "sp_abc", "pcm_base64": "<base64 16kHz 16-bit mono PCM>"}
  Output: {"type": "transcript", "id": "sp_abc", "text": "hello world", "language": "en"}

  Input:  {"type": "ping"}
  Output: {"type": "pong"}
"""

import base64
import json
import sys
import numpy as np


# Lazy-load model to avoid slow startup blocking the health check
_model_repo: str = "mlx-community/whisper-tiny"
_model_loaded: bool = False


def _ensure_model() -> None:
    global _model_loaded
    if not _model_loaded:
        # Pre-download/cache the model on first use
        import mlx_whisper  # noqa: F401
        _model_loaded = True


def transcribe_pcm(pcm_base64: str) -> dict:
    """Transcribe base64-encoded 16kHz 16-bit signed LE mono PCM."""
    import mlx_whisper

    _ensure_model()

    pcm_bytes = base64.b64decode(pcm_base64)
    pcm_int16 = np.frombuffer(pcm_bytes, dtype=np.int16)
    pcm_float32 = pcm_int16.astype(np.float32) / 32768.0

    result = mlx_whisper.transcribe(
        pcm_float32,
        path_or_hf_repo=_model_repo,
        language="en",
    )

    return {
        "text": result.get("text", "").strip(),
        "language": result.get("language", "en"),
    }


def handle_message(line: str) -> str | None:
    """Process a single JSONL message. Returns response JSON string or None."""
    try:
        msg = json.loads(line)
    except json.JSONDecodeError:
        return json.dumps({"type": "error", "message": "invalid JSON"})

    msg_type = msg.get("type")

    if msg_type == "ping":
        return json.dumps({"type": "pong"})

    if msg_type == "transcribe":
        msg_id = msg.get("id", "")
        pcm_base64 = msg.get("pcm_base64", "")
        if not pcm_base64:
            return json.dumps({"type": "error", "id": msg_id, "message": "missing pcm_base64"})
        try:
            result = transcribe_pcm(pcm_base64)
            return json.dumps({
                "type": "transcript",
                "id": msg_id,
                "text": result["text"],
                "language": result["language"],
            })
        except Exception as e:
            return json.dumps({"type": "error", "id": msg_id, "message": str(e)})

    return json.dumps({"type": "error", "message": f"unknown type: {msg_type}"})


def main() -> None:
    """Main loop: read JSONL from stdin, write responses to stdout."""
    # Signal ready
    print(json.dumps({"type": "ready"}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        response = handle_message(line)
        if response is not None:
            print(response, flush=True)


if __name__ == "__main__":
    main()
