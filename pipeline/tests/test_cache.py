"""Unit tests for the cache writer.

Pure data-shaping tests: no model is loaded, no scoring is performed. We
build synthetic ``Token`` lists by hand, pass them through the real
``reconcile``, ``select_thresholds``, and ``find_gaps`` (none of which touch
the model), then attach hand-supplied reconstruction strings and fidelity
values before asking ``write_cache`` to serialize.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone

import pytest

from cprediction.cache import (
    CACHE_SCHEMA_VERSION,
    CONSERVATION_TOLERANCE,
    FLOAT_PRECISION,
    build_cache,
    write_cache,
)
from cprediction.reconciliation import Token, normalize, reconcile
from cprediction.run import GapResult, PositionResult
from cprediction.spans import find_gaps
from cprediction.thresholds import select_thresholds


# ---------------------------------------------------------------------------
# Fixture builders
# ---------------------------------------------------------------------------


def _make_tokens(source: str, per_word_surprisal: list[float]) -> list[Token]:
    """Split ``source`` on spaces, attach one surprisal per word.

    Whitespace attaches to the FOLLOWING word (BPE convention), so the first
    word gets no leading space and the rest do. ``per_word_surprisal`` must
    have one entry per whitespace-delimited token.
    """

    pieces = source.split(" ")
    assert len(pieces) == len(per_word_surprisal), (
        f"piece count {len(pieces)} != surprisal count "
        f"{len(per_word_surprisal)}"
    )
    tokens: list[Token] = []
    for i, (piece, surp) in enumerate(zip(pieces, per_word_surprisal)):
        text = piece if i == 0 else " " + piece
        tokens.append(Token(text=text, surprisal=surp))
    return tokens


def _build_state():
    """Build a small synthetic pipeline state, no model required."""

    # 3 short sentences, hand-picked surprisals. Lower-surprisal words
    # ("the", "a", "and", commas) will get swept into gaps at the medium
    # thresholds; higher-surprisal words ("wolf", "forest", "grandmother")
    # form the kernel.
    raw = (
        "the wolf met a girl, "
        "the girl walked to the forest, "
        "and met grandmother."
    )
    surprisals = [
        # "the wolf met a girl,"
        0.5, 12.0, 4.0, 0.7, 9.0,
        # "the girl walked to the forest,"
        0.6, 9.5, 6.0, 1.0, 0.4, 11.0,
        # "and met grandmother."
        0.8, 5.0, 15.0,
    ]
    normalized = normalize(raw)
    tokens = _make_tokens(normalized, surprisals)
    words = reconcile(normalized, tokens)
    real_words = [w for w in words if not w.is_empty_core]
    total_bits = sum(w.surprisal for w in real_words)

    thresholds = select_thresholds(words, n=4)

    positions: list[PositionResult] = []
    for pos_idx, threshold in enumerate(thresholds):
        gaps = find_gaps(words, threshold=threshold, max_gap_words=10)
        gap_word_ids = {wi for g in gaps for wi in g.word_indices}
        predicted_bits = sum(words[wi].surprisal for wi in gap_word_ids)
        stored_bits = sum(
            w.surprisal
            for i, w in enumerate(words)
            if not w.is_empty_core and i not in gap_word_ids
        )
        gap_results = [
            GapResult(
                gap=g,
                actual=normalized[words[g.start_index].char_start : words[g.end_index].char_end],
                predicted="<PRED>",  # hand-supplied; no model
                fidelity_score=0.5 + 0.01 * gi,  # deterministic, distinct
            )
            for gi, g in enumerate(gaps)
        ]
        positions.append(
            PositionResult(
                position=pos_idx,
                threshold=threshold,
                words_remaining=len(real_words) - len(gap_word_ids),
                words_removed=len(gap_word_ids),
                gaps=gap_results,
                stored_bits=stored_bits,
                predicted_bits=predicted_bits,
            )
        )

    return {
        "normalized": normalized,
        "words": words,
        "real_words": real_words,
        "positions": positions,
        "total_bits": total_bits,
        "tokens": tokens,
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_write_cache_emits_valid_json(tmp_path):
    state = _build_state()
    out = tmp_path / "tale.json"

    write_cache(
        out,
        title="Test Tale",
        source_file="corpus/test.txt",
        model_id="test/model",
        normalized_source=state["normalized"],
        words=state["words"],
        positions=state["positions"],
        total_bits=state["total_bits"],
        token_count=len(state["tokens"]),
    )

    assert out.exists()
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["schema_version"] == CACHE_SCHEMA_VERSION


def test_round_trip_preserves_word_and_gap_structure(tmp_path):
    state = _build_state()
    out = tmp_path / "tale.json"
    write_cache(
        out,
        title="Test Tale",
        source_file="corpus/test.txt",
        model_id="test/model",
        normalized_source=state["normalized"],
        words=state["words"],
        positions=state["positions"],
        total_bits=state["total_bits"],
        token_count=len(state["tokens"]),
    )
    data = json.loads(out.read_text(encoding="utf-8"))

    # Source matches the normalized text exactly.
    assert data["source"] == state["normalized"]

    # Every word's index, char offsets, and surprisal round-trip.
    assert len(data["words"]) == len(state["words"])
    for i, (w_in, w_out) in enumerate(zip(state["words"], data["words"])):
        assert w_out["index"] == i
        assert w_out["core"] == w_in.core
        assert w_out["trailing_punct"] == w_in.trailing_punct
        assert w_out["is_terminal_punct"] == w_in.is_terminal_punct
        assert w_out["is_empty_core"] == w_in.is_empty_core
        assert w_out["char_start"] == w_in.char_start
        assert w_out["char_end"] == w_in.char_end
        assert math.isclose(
            w_out["surprisal"], round(w_in.surprisal, FLOAT_PRECISION),
            abs_tol=10 ** -FLOAT_PRECISION,
        )

    # Gap word_indices match exactly.
    for p_in, p_out in zip(state["positions"], data["positions"]):
        assert len(p_in.gaps) == len(p_out["gaps"])
        for g_in, g_out in zip(p_in.gaps, p_out["gaps"]):
            assert g_out["word_indices"] == list(g_in.gap.word_indices)
            assert g_out["start_word_index"] == g_in.gap.start_index
            assert g_out["end_word_index"] == g_in.gap.end_index
            assert g_out["actual_text"] == g_in.actual
            assert g_out["predicted_text"] == g_in.predicted


def test_conservation_holds_per_position(tmp_path):
    state = _build_state()
    out = tmp_path / "tale.json"
    write_cache(
        out,
        title="Test Tale",
        source_file="corpus/test.txt",
        model_id="test/model",
        normalized_source=state["normalized"],
        words=state["words"],
        positions=state["positions"],
        total_bits=state["total_bits"],
        token_count=len(state["tokens"]),
    )
    data = json.loads(out.read_text(encoding="utf-8"))

    total = data["metadata"]["total_bits"]
    # Tolerance must accommodate the rounding to FLOAT_PRECISION digits on
    # both stored_bits and predicted_bits.
    rounding_slop = 2 * (10 ** -FLOAT_PRECISION)
    for p in data["positions"]:
        assert math.isclose(
            p["stored_bits"] + p["predicted_bits"], total,
            abs_tol=rounding_slop + CONSERVATION_TOLERANCE,
        ), p


def test_metadata_counts_match_inputs(tmp_path):
    state = _build_state()
    out = tmp_path / "tale.json"
    write_cache(
        out,
        title="Test Tale",
        source_file="corpus/test.txt",
        model_id="test/model",
        normalized_source=state["normalized"],
        words=state["words"],
        positions=state["positions"],
        total_bits=state["total_bits"],
        token_count=len(state["tokens"]),
    )
    data = json.loads(out.read_text(encoding="utf-8"))

    assert data["metadata"]["word_count"] == len(state["real_words"])
    assert data["metadata"]["token_count"] == len(state["tokens"])
    assert data["metadata"]["title"] == "Test Tale"
    assert data["metadata"]["model_id"] == "test/model"
    assert data["metadata"]["source_file"] == "corpus/test.txt"


def test_floats_rounded_to_documented_precision(tmp_path):
    state = _build_state()
    out = tmp_path / "tale.json"
    write_cache(
        out,
        title="Test Tale",
        source_file="corpus/test.txt",
        model_id="test/model",
        normalized_source=state["normalized"],
        words=state["words"],
        positions=state["positions"],
        total_bits=state["total_bits"],
        token_count=len(state["tokens"]),
    )
    # Inspect raw text: no float should have more than FLOAT_PRECISION digits
    # after a decimal point.
    raw = out.read_text(encoding="utf-8")
    import re

    for match in re.finditer(r"-?\d+\.(\d+)", raw):
        frac = match.group(1)
        assert len(frac) <= FLOAT_PRECISION, (
            f"value {match.group(0)} exceeds {FLOAT_PRECISION} decimal places"
        )


def test_kernel_word_indices_are_survivors_of_deepest_position(tmp_path):
    state = _build_state()
    cache = build_cache(
        title="Test Tale",
        source_file="corpus/test.txt",
        model_id="test/model",
        normalized_source=state["normalized"],
        words=state["words"],
        positions=state["positions"],
        total_bits=state["total_bits"],
        token_count=len(state["tokens"]),
    )
    deepest = state["positions"][-1]
    removed = {wi for g in deepest.gaps for wi in g.gap.word_indices}
    expected_kernel = [
        i
        for i, w in enumerate(state["words"])
        if not w.is_empty_core and i not in removed
    ]
    assert cache.kernel_word_indices == expected_kernel


def test_conservation_violation_raises(tmp_path):
    state = _build_state()
    # Perturb one position so stored + predicted no longer matches total.
    state["positions"][1].stored_bits += 5.0

    with pytest.raises(ValueError, match="conservation violated"):
        write_cache(
            tmp_path / "tale.json",
            title="Test Tale",
            source_file="corpus/test.txt",
            model_id="test/model",
            normalized_source=state["normalized"],
            words=state["words"],
            positions=state["positions"],
            total_bits=state["total_bits"],
            token_count=len(state["tokens"]),
        )
    # And no partial file is left behind.
    assert not (tmp_path / "tale.json").exists()


@pytest.mark.parametrize(
    "perturbation, expectation",
    [
        # Inside the tolerance band: build must succeed.
        (CONSERVATION_TOLERANCE * 0.5, "should_pass"),
        # Outside the tolerance band: build must raise.
        (CONSERVATION_TOLERANCE * 10.0, "should_fail"),
    ],
)
def test_conservation_tolerance_boundary(tmp_path, perturbation, expectation):
    """Lock the conservation tolerance: half-tol passes, 10x-tol fails."""

    state = _build_state()
    state["positions"][1].stored_bits += perturbation

    if expectation == "should_pass":
        cache = build_cache(
            title="Test Tale",
            source_file="corpus/test.txt",
            model_id="test/model",
            normalized_source=state["normalized"],
            words=state["words"],
            positions=state["positions"],
            total_bits=state["total_bits"],
            token_count=len(state["tokens"]),
        )
        assert cache.schema_version == CACHE_SCHEMA_VERSION
    else:
        with pytest.raises(ValueError, match="conservation violated"):
            build_cache(
                title="Test Tale",
                source_file="corpus/test.txt",
                model_id="test/model",
                normalized_source=state["normalized"],
                words=state["words"],
                positions=state["positions"],
                total_bits=state["total_bits"],
                token_count=len(state["tokens"]),
            )


def test_pydantic_rejects_wrong_field_types():
    """Construction-time validation: wrong types fail loudly, not silently."""

    from cprediction.cache import WordEntry, GapEntry
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        WordEntry(
            index="not-an-int",  # type: ignore[arg-type]
            core="x",
            trailing_punct="",
            is_terminal_punct=False,
            is_empty_core=False,
            char_start=0,
            char_end=1,
            surprisal=1.0,
        )

    with pytest.raises(ValidationError):
        GapEntry(
            id=0,
            start_word_index=0,
            end_word_index=1,
            word_indices=[0, 1],
            actual_text="a b",
            predicted_text="c d",
            fidelity=1.5,  # out of [0, 1]
        )


def test_atomic_write_preserves_prior_file_on_failure(tmp_path, monkeypatch):
    """``run._atomic_write_text`` must leave a pre-existing target unchanged
    if the temp write or rename fails partway through. This locks the
    stale-but-consistent-snapshot guarantee described in run.py."""

    from cprediction import run as run_module

    target = tmp_path / "tale.json"
    target.write_text("PRIOR", encoding="utf-8")

    # Simulate an interruption AFTER the temp file is written but BEFORE the
    # rename completes (mimics a torn write / SIGINT during disk pressure).
    def boom(*args, **kwargs):
        raise OSError("simulated interruption")

    monkeypatch.setattr(run_module.os, "replace", boom)

    with pytest.raises(OSError, match="simulated interruption"):
        run_module._atomic_write_text(target, "NEW CONTENT")

    # Prior file is untouched.
    assert target.read_text(encoding="utf-8") == "PRIOR"

    # And the temp file is cleaned up — no orphan .tmp left behind for
    # the next run to misinterpret as a partially-written artifact.
    orphan = target.with_suffix(target.suffix + ".tmp")
    assert not orphan.exists()


def test_generated_at_is_iso8601_utc(tmp_path):
    state = _build_state()
    fixed = datetime(2026, 5, 25, 13, 35, 0, tzinfo=timezone.utc)
    out = tmp_path / "tale.json"
    write_cache(
        out,
        title="Test Tale",
        source_file="corpus/test.txt",
        model_id="test/model",
        normalized_source=state["normalized"],
        words=state["words"],
        positions=state["positions"],
        total_bits=state["total_bits"],
        token_count=len(state["tokens"]),
        generated_at=fixed,
    )
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["metadata"]["generated_at"] == "2026-05-25T13:35:00Z"
