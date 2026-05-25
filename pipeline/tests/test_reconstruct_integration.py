"""Integration tests for ``reconstruct()`` against the locally-loaded model.

Gated behind ``@pytest.mark.integration`` and skipped if the model is not
downloaded yet. Run with ``pytest -m integration``.
"""

from __future__ import annotations

import pytest


pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True, scope="module")
def _skip_if_model_missing() -> None:
    try:
        from transformers import AutoTokenizer

        from cprediction._model import MODEL_ID

        AutoTokenizer.from_pretrained(MODEL_ID, local_files_only=True)
    except (OSError, ImportError) as exc:
        pytest.skip(
            f"Reference model not available locally: {exc}. "
            "Run `huggingface-cli download Qwen/Qwen2.5-7B-Instruct`."
        )


def test_reconstruct_returns_non_empty_for_small_gap() -> None:
    from cprediction.reconstruct import reconstruct

    left = "Once upon a time there lived a "
    right = " little girl whom everyone loved."
    out = reconstruct(left, right)
    assert isinstance(out, str)
    assert out.strip() != ""
    # No chat-framing artifacts leaked through.
    assert "<<<GAP>>>" not in out
    assert "LEFT:" not in out
    assert "RIGHT:" not in out
    lowered = out.lower().lstrip().lstrip("\"'`")
    for opener in ("sure, here", "here is", "here's", "of course"):
        assert not lowered.startswith(opener), f"reply starts with chat opener: {out!r}"
