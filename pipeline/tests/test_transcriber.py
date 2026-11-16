"""Tests for the transcriber JSONL protocol."""

import base64
import json
from unittest.mock import MagicMock, patch

import numpy as np

from src.transcriber import handle_message, transcribe_pcm


def make_pcm_base64(duration_s: float = 0.5, sample_rate: int = 16000) -> str:
    """Generate base64-encoded silent PCM audio."""
    samples = int(duration_s * sample_rate)
    pcm = np.zeros(samples, dtype=np.int16)
    return base64.b64encode(pcm.tobytes()).decode("ascii")


class TestHandleMessage:
    def test_ping(self):
        result = json.loads(handle_message('{"type": "ping"}'))
        assert result == {"type": "pong"}

    def test_invalid_json(self):
        result = json.loads(handle_message("not json"))
        assert result["type"] == "error"
        assert "invalid JSON" in result["message"]

    def test_unknown_type(self):
        result = json.loads(handle_message('{"type": "unknown"}'))
        assert result["type"] == "error"
        assert "unknown type" in result["message"]

    def test_transcribe_missing_pcm(self):
        msg = json.dumps({"type": "transcribe", "id": "sp_1"})
        result = json.loads(handle_message(msg))
        assert result["type"] == "error"
        assert result["id"] == "sp_1"
        assert "missing pcm_base64" in result["message"]

    @patch("src.transcriber.transcribe_pcm")
    def test_transcribe_success(self, mock_transcribe):
        mock_transcribe.return_value = {"text": "hello world", "language": "en"}
        pcm = make_pcm_base64()
        msg = json.dumps({"type": "transcribe", "id": "sp_2", "pcm_base64": pcm})
        result = json.loads(handle_message(msg))
        assert result["type"] == "transcript"
        assert result["id"] == "sp_2"
        assert result["text"] == "hello world"
        assert result["language"] == "en"

    @patch("src.transcriber.transcribe_pcm")
    def test_transcribe_error(self, mock_transcribe):
        mock_transcribe.side_effect = RuntimeError("model failed")
        pcm = make_pcm_base64()
        msg = json.dumps({"type": "transcribe", "id": "sp_3", "pcm_base64": pcm})
        result = json.loads(handle_message(msg))
        assert result["type"] == "error"
        assert result["id"] == "sp_3"
        assert "model failed" in result["message"]


class TestTranscribePcm:
    @patch("src.transcriber.mlx_whisper", create=True)
    def test_converts_int16_to_float32(self, mock_mlx):
        # Use importlib to handle the lazy import in transcribe_pcm
        mock_module = MagicMock()
        mock_module.transcribe.return_value = {"text": "test", "language": "en"}

        with (
            patch.dict("sys.modules", {"mlx_whisper": mock_module}),
            patch("src.transcriber._model_loaded", True),
        ):
            pcm = make_pcm_base64(duration_s=0.1)
            transcribe_pcm(pcm)

            call_args = mock_module.transcribe.call_args
            audio_arg = call_args[0][0]
            assert audio_arg.dtype == np.float32
            assert len(audio_arg) == 1600  # 0.1s * 16000

    @patch("src.transcriber.mlx_whisper", create=True)
    def test_values_normalized(self, mock_mlx):
        mock_module = MagicMock()
        mock_module.transcribe.return_value = {"text": "", "language": "en"}

        # Create PCM with max value
        samples = np.array([32767, -32768, 0], dtype=np.int16)
        pcm_b64 = base64.b64encode(samples.tobytes()).decode("ascii")

        with (
            patch.dict("sys.modules", {"mlx_whisper": mock_module}),
            patch("src.transcriber._model_loaded", True),
        ):
            transcribe_pcm(pcm_b64)
            audio_arg = mock_module.transcribe.call_args[0][0]
            assert abs(audio_arg[0] - 1.0) < 0.001  # 32767/32768
            assert abs(audio_arg[1] - (-1.0)) < 0.001  # -32768/32768
            assert audio_arg[2] == 0.0
