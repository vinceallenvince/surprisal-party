"""Integration tests for ``score()`` against the locally-loaded reference model.

Gated behind ``@pytest.mark.integration``. Additionally skipped if the
model is not downloaded yet (we probe the tokenizer in offline mode and
skip on failure rather than trigger a 14 GB download as a side effect of
running the test suite).

Run with: ``pytest -m integration``.
"""

from __future__ import annotations

import pytest

from cprediction.reconciliation import reconcile


pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True, scope="module")
def _skip_if_model_missing() -> None:
    """Skip the module if the reference model hasn't been downloaded."""
    try:
        from transformers import AutoTokenizer

        from cprediction._model import MODEL_ID

        AutoTokenizer.from_pretrained(MODEL_ID, local_files_only=True)
    except (OSError, ImportError) as exc:
        pytest.skip(
            f"Reference model not available locally: {exc}. "
            "Run `huggingface-cli download Qwen/Qwen2.5-7B-Instruct`."
        )


def test_score_short_input_roundtrips() -> None:
    """A short input should normalize, score, and reconcile cleanly."""
    from cprediction.score import score

    text = "The wolf saw Little Red Riding Hood walking through the forest."
    normalized, tokens = score(text)
    assert tokens, "expected at least one token back"
    # Surprisals are non-negative and the total is positive.
    assert all(t.surprisal >= 0 for t in tokens)
    assert sum(t.surprisal for t in tokens) > 0
    # The token stream reconstructs the normalized source.
    assert "".join(t.text for t in tokens) == normalized
    # Reconciliation works end-to-end.
    words = reconcile(normalized, tokens)
    assert any(w.core == "wolf" for w in words)


def test_score_surprisal_conservation() -> None:
    """Sum of word surprisals equals sum of non-control token surprisals."""
    from cprediction.score import score

    text = "Grandmother's house stood deep in the dark forest."
    normalized, tokens = score(text)
    words = reconcile(normalized, tokens)
    token_total = sum(t.surprisal for t in tokens)
    word_total = sum(w.surprisal for w in words)
    # Tight tolerance is intentional: reconcile() reuses the very same float
    # surprisal values from the token stream when assigning them to words,
    # so this is a *structural* identity check (no information should be
    # lost or duplicated by reconciliation), not a numerical-precision
    # comparison across two independent computations.
    assert word_total == pytest.approx(token_total, rel=1e-6, abs=1e-6)


def test_score_empty_string() -> None:
    """Empty input should normalize to empty and return zero tokens cleanly."""
    from cprediction.score import score

    normalized, tokens = score("")
    assert normalized == ""
    assert tokens == []


def test_score_multi_paragraph() -> None:
    """A short two-paragraph passage should score, reconstruct, and conserve."""
    from cprediction.score import score

    text = (
        "Once upon a time there was a little girl who lived at the edge of "
        "the deep wood. Her grandmother had sewn her a red velvet cap, and "
        "she wore it everywhere she went.\n\n"
        "One bright morning her mother gave her a basket of cake and wine "
        "and sent her along the forest path to visit her grandmother, who "
        "had taken ill."
    )
    normalized, tokens = score(text)
    # (a) Tokens reconstruct the normalized source exactly.
    assert "".join(t.text for t in tokens) == normalized
    # (b) Surprisal stream is non-empty and non-degenerate.
    assert len(tokens) > 20
    total = sum(t.surprisal for t in tokens)
    assert total > 0
    # Non-degenerate: at least a few tokens should carry meaningful
    # surprisal (some content is genuinely uncertain).
    assert sum(1 for t in tokens if t.surprisal > 1.0) >= 5
    # (c) Conservation against reconcile() holds (structural identity).
    words = reconcile(normalized, tokens)
    word_total = sum(w.surprisal for w in words)
    assert word_total == pytest.approx(total, rel=1e-6, abs=1e-6)
