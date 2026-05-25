"""Unit tests for `fidelity()` (token-set F1)."""

from __future__ import annotations

import pytest

from cprediction.fidelity import fidelity


TOL = 1e-9


def test_exact_match_is_one() -> None:
    assert fidelity("the quick brown fox", "the quick brown fox") == pytest.approx(1.0)


def test_case_insensitive_match_is_one() -> None:
    assert fidelity("The Quick Brown Fox", "the quick brown fox") == pytest.approx(1.0)


def test_punctuation_ignored() -> None:
    assert fidelity("hello, world!", "hello world") == pytest.approx(1.0)


def test_total_mismatch_is_zero() -> None:
    assert fidelity("alpha beta", "gamma delta") == pytest.approx(0.0)


def test_both_empty_is_one() -> None:
    assert fidelity("", "") == pytest.approx(1.0)


def test_one_empty_is_zero() -> None:
    assert fidelity("", "anything") == pytest.approx(0.0)
    assert fidelity("anything", "") == pytest.approx(0.0)


def test_partial_overlap_is_intermediate() -> None:
    # predicted: 4 tokens, actual: 4 tokens, overlap: 2 ("brown fox")
    # precision = 2/4 = 0.5, recall = 2/4 = 0.5, F1 = 0.5
    score = fidelity("the slow brown fox", "a quick brown fox")
    assert 0.0 < score < 1.0
    assert score == pytest.approx(0.5)


def test_multiset_semantics_for_repeats() -> None:
    # predicted has "fox" twice, actual has "fox" once -> overlap counts once
    # predicted=2, actual=1, overlap=1 -> P=1/2, R=1/1, F1=2*0.5*1/1.5
    score = fidelity("fox fox", "fox")
    assert score == pytest.approx(2 * 0.5 * 1.0 / 1.5)


def test_contractions_kept_as_one_token() -> None:
    # apostrophe stays inside; "grandmother's" is one token
    assert fidelity("grandmother's house", "grandmother's house") == pytest.approx(1.0)


def test_score_in_unit_interval() -> None:
    cases = [
        ("a b c", "a b c d"),
        ("a a b", "a b b"),
        ("very different text here", "totally distinct other words"),
    ]
    for p, a in cases:
        s = fidelity(p, a)
        assert 0.0 <= s <= 1.0
