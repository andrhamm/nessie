"""Integration test: transcribe a real audio sample with mlx-whisper.

Requires the model to be downloaded. Run with:
  uv run pytest tests/test_transcriber_integration.py -v -s

Skipped by default in CI (no GPU). Run explicitly when testing locally.
"""

from pathlib import Path

import pytest

SAMPLES_DIR = Path(__file__).parent.parent.parent / "server" / "voice-samples"


def get_first_sample() -> Path | None:
    """Find the first .mp3 sample file."""
    if not SAMPLES_DIR.exists():
        return None
    samples = sorted(SAMPLES_DIR.glob("*.mp3"))
    return samples[0] if samples else None


@pytest.mark.skipif(
    get_first_sample() is None,
    reason="No voice samples found in server/voice-samples/",
)
def test_transcribe_real_audio():
    """Run the transcriber subprocess and send it a real audio file via JSONL."""
    sample = get_first_sample()
    assert sample is not None

    # Use mlx_whisper directly to transcribe the mp3 file
    import mlx_whisper

    result = mlx_whisper.transcribe(
        str(sample),
        path_or_hf_repo="mlx-community/whisper-tiny",
        language="en",
    )

    text = result.get("text", "").strip()
    print(f"\nSample: {sample.name}")
    print(f"Transcription: {text}")

    # Should produce some non-empty text from our voice samples
    assert len(text) > 0, "Transcription should not be empty"
    assert isinstance(text, str)
