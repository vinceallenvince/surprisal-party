"""Unit tests for `select_thresholds()`."""

from __future__ import annotations

import pytest

from cprediction.reconciliation import Word
from cprediction.thresholds import select_thresholds


def _word(surprisal: float, core: str = "x") -> Word:
    return Word(
        core=core,
        trailing_punct="",
        is_terminal_punct=False,
        char_start=0,
        char_end=len(core),
        surprisal=surprisal,
    )


def test_returns_n_ascending_thresholds() -> None:
    words = [_word(float(i)) for i in range(20)]
    thresholds = select_thresholds(words, n=5)
    assert len(thresholds) == 5
    assert thresholds == sorted(thresholds)


def test_lowest_threshold_keeps_everything_visible() -> None:
    """At the lowest threshold, no word should be strictly below it."""
    words = [_word(float(i)) for i in range(10)]
    thresholds = select_thresholds(words, n=5)
    removed = [w for w in words if w.surprisal < thresholds[0]]
    assert removed == []


def test_highest_threshold_leaves_kernel_only() -> None:
    """At the highest threshold, only a small minority should survive."""
    words = [_word(float(i)) for i in range(100)]
    thresholds = select_thresholds(words, n=5)
    survivors = [w for w in words if w.surprisal >= thresholds[-1]]
    # 95th percentile => roughly top ~5%; allow a small interpolation slack.
    assert 1 <= len(survivors) <= 15


def test_default_percentiles_at_n5() -> None:
    """Default percentiles for n=5 should be (0, 25, 50, 75, 95)."""
    # On 0..100, percentiles map linearly to values.
    words = [_word(float(i)) for i in range(101)]
    thresholds = select_thresholds(words, n=5)
    assert thresholds[0] == pytest.approx(0.0)
    assert thresholds[1] == pytest.approx(25.0)
    assert thresholds[2] == pytest.approx(50.0)
    assert thresholds[3] == pytest.approx(75.0)
    assert thresholds[4] == pytest.approx(95.0)


def test_empty_core_words_excluded() -> None:
    """Whitespace-only / empty-core words must not contaminate the distribution."""
    real = [_word(float(i)) for i in range(10)]
    empty = Word(
        core="",
        trailing_punct="",
        is_terminal_punct=False,
        char_start=0,
        char_end=0,
        surprisal=999.0,
    )
    thresholds = select_thresholds(real + [empty], n=5)
    # If empty was included, the 95th percentile would jump near 999.
    assert thresholds[-1] < 50.0


def test_empty_input_raises() -> None:
    with pytest.raises(ValueError):
        select_thresholds([], n=5)


def test_custom_percentiles_respected() -> None:
    words = [_word(float(i)) for i in range(101)]
    thresholds = select_thresholds(words, n=3, percentiles=(10.0, 50.0, 90.0))
    assert thresholds[0] == pytest.approx(10.0)
    assert thresholds[1] == pytest.approx(50.0)
    assert thresholds[2] == pytest.approx(90.0)


def test_mismatched_n_and_percentiles_raises() -> None:
    words = [_word(1.0)]
    with pytest.raises(ValueError):
        select_thresholds(words, n=3, percentiles=(10.0, 50.0))


def test_non_ascending_percentiles_raises() -> None:
    words = [_word(1.0)]
    with pytest.raises(ValueError):
        select_thresholds(words, n=3, percentiles=(50.0, 10.0, 90.0))


def test_single_threshold() -> None:
    words = [_word(float(i)) for i in range(10)]
    thresholds = select_thresholds(words, n=1)
    assert len(thresholds) == 1
    assert thresholds[0] == pytest.approx(0.0)
