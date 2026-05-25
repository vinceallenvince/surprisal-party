"""Unit tests for `find_gaps()`."""

from __future__ import annotations

import pytest

from cprediction.reconciliation import Word
from cprediction.spans import Gap, find_gaps


def _w(
    surprisal: float,
    core: str = "x",
    trailing: str = "",
    terminal: bool = False,
) -> Word:
    return Word(
        core=core,
        trailing_punct=trailing,
        is_terminal_punct=terminal,
        char_start=0,
        char_end=len(core) + len(trailing),
        surprisal=surprisal,
    )


def test_empty_input_returns_no_gaps() -> None:
    assert find_gaps([], threshold=1.0) == []


def test_all_below_threshold_one_gap() -> None:
    words = [_w(0.1, "a"), _w(0.2, "b"), _w(0.3, "c")]
    gaps = find_gaps(words, threshold=1.0)
    assert len(gaps) == 1
    assert gaps[0].start_index == 0
    assert gaps[0].end_index == 2
    assert gaps[0].word_indices == [0, 1, 2]


def test_all_above_threshold_no_gaps() -> None:
    words = [_w(5.0, "a"), _w(6.0, "b"), _w(7.0, "c")]
    assert find_gaps(words, threshold=1.0) == []


def test_surviving_word_breaks_run() -> None:
    words = [
        _w(0.1, "the"),
        _w(0.2, "wolf"),
        _w(8.0, "RED"),  # high-surprisal kernel word
        _w(0.3, "ran"),
        _w(0.4, "fast"),
    ]
    gaps = find_gaps(words, threshold=1.0)
    assert len(gaps) == 2
    assert gaps[0].word_indices == [0, 1]
    assert gaps[1].word_indices == [3, 4]


def test_terminal_punct_closes_gap() -> None:
    words = [
        _w(0.1, "the", terminal=False),
        _w(0.2, "wolf", trailing=".", terminal=True),
        _w(0.3, "and"),
        _w(0.4, "she"),
    ]
    gaps = find_gaps(words, threshold=1.0)
    # First gap closes at the period; second begins after.
    assert len(gaps) == 2
    assert gaps[0].word_indices == [0, 1]
    assert gaps[1].word_indices == [2, 3]


def test_cap_split_at_comma() -> None:
    # 10 below-threshold words; word index 4 ends in a comma.
    # max_gap_words=5 should split at the comma.
    words = []
    for i in range(10):
        trailing = "," if i == 4 else ""
        words.append(_w(0.1, f"w{i}", trailing=trailing))
    gaps = find_gaps(words, threshold=1.0, max_gap_words=5)
    assert len(gaps) >= 2
    # First gap should end at the comma (index 4).
    assert gaps[0].end_index == 4
    assert gaps[1].start_index == 5


def test_cap_split_without_subsentence_punct_falls_back_to_cap() -> None:
    """If no sub-sentence boundary exists in the run, split at the cap."""
    words = [_w(0.1, f"w{i}") for i in range(12)]
    gaps = find_gaps(words, threshold=1.0, max_gap_words=5)
    # Should produce gaps of length 5, 5, 2.
    assert [len(g.word_indices) for g in gaps] == [5, 5, 2]


def test_cap_split_at_semicolon_or_dash() -> None:
    """Semicolons and hyphens also count as sub-sentence boundaries."""
    for punct in (";", "-"):
        words = [
            _w(0.1, f"w{i}", trailing=(punct if i == 3 else ""))
            for i in range(8)
        ]
        gaps = find_gaps(words, threshold=1.0, max_gap_words=5)
        assert gaps[0].end_index == 3, f"failed for punctuation {punct!r}"


def test_empty_core_words_are_skipped() -> None:
    """Empty-core words must not form gaps."""
    empty = Word(
        core="",
        trailing_punct="",
        is_terminal_punct=False,
        char_start=0,
        char_end=0,
        surprisal=0.0,
    )
    words = [empty, _w(5.0, "alpha"), empty]
    assert find_gaps(words, threshold=1.0) == []


def test_max_gap_words_must_be_positive() -> None:
    with pytest.raises(ValueError):
        find_gaps([_w(0.1)], threshold=1.0, max_gap_words=0)


def test_gap_word_indices_contiguous_when_single_gap() -> None:
    words = [_w(0.1) for _ in range(5)]
    gaps = find_gaps(words, threshold=1.0)
    assert len(gaps) == 1
    g = gaps[0]
    assert g.word_indices == list(range(g.start_index, g.end_index + 1))
