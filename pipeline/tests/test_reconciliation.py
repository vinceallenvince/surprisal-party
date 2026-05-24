"""Unit tests for the tokenization reconciliation layer.

Token streams are constructed by hand so the tests exercise the reconciliation
logic, not any specific tokenizer. Every committed rule from the implementation
plan has at least one test below.
"""

from __future__ import annotations

import math

import pytest

from cprediction import Token, Word, normalize, reconcile


TOL = 1e-9


def _tokens(*pairs: tuple[str, float]) -> list[Token]:
    return [Token(text=t, surprisal=s) for t, s in pairs]


def _assert_offsets_roundtrip(source: str, words: list[Word]) -> None:
    for w in words:
        assert source[w.char_start : w.char_end] == w.core + w.trailing_punct, (
            f"offset mismatch for {w!r} in {source!r}"
        )


# ---------------------------------------------------------------------------
# 1. Multi-token name
# ---------------------------------------------------------------------------


def test_multi_token_name_merges_into_one_word() -> None:
    """A name split across BPE pieces should reconcile to one word."""
    source = "Aschenputtel ran"
    tokens = _tokens(
        ("As", 4.0),
        ("chen", 2.0),
        ("put", 1.5),
        ("tel", 0.5),
        (" ran", 3.0),
    )
    words = reconcile(source, tokens)
    assert len(words) == 2
    assert words[0].core == "Aschenputtel"
    assert words[0].trailing_punct == ""
    assert words[0].is_terminal_punct is False
    assert words[0].surprisal == pytest.approx(4.0 + 2.0 + 1.5 + 0.5)
    assert words[0].token_indices == [0, 1, 2, 3]
    assert words[1].core == "ran"
    assert words[1].surprisal == pytest.approx(3.0)
    _assert_offsets_roundtrip(source, words)


# ---------------------------------------------------------------------------
# 2. Contraction
# ---------------------------------------------------------------------------


def test_contraction_is_single_word() -> None:
    source = "grandmother's house"
    tokens = _tokens(
        ("grand", 1.0),
        ("mother", 1.5),
        ("'s", 0.25),
        (" house", 2.0),
    )
    words = reconcile(source, tokens)
    assert [w.core for w in words] == ["grandmother's", "house"]
    assert words[0].trailing_punct == ""
    assert words[0].is_terminal_punct is False
    assert words[0].surprisal == pytest.approx(1.0 + 1.5 + 0.25)
    _assert_offsets_roundtrip(source, words)


# ---------------------------------------------------------------------------
# 3. Hyphenated form
# ---------------------------------------------------------------------------


def test_hyphenated_form_is_single_word() -> None:
    source = "well-known author"
    tokens = _tokens(
        ("well", 1.0),
        ("-", 0.1),
        ("known", 0.5),
        (" author", 2.0),
    )
    words = reconcile(source, tokens)
    assert [w.core for w in words] == ["well-known", "author"]
    assert words[0].trailing_punct == ""
    assert words[0].surprisal == pytest.approx(1.6)
    _assert_offsets_roundtrip(source, words)


# ---------------------------------------------------------------------------
# 4. Sentence-initial word
# ---------------------------------------------------------------------------


def test_sentence_initial_word_no_leading_whitespace() -> None:
    """The very first word has no leading whitespace token."""
    source = "Once upon a time"
    tokens = _tokens(
        ("Once", 2.0),
        (" upon", 1.0),
        (" a", 0.5),
        (" time", 0.25),
    )
    words = reconcile(source, tokens)
    assert [w.core for w in words] == ["Once", "upon", "a", "time"]
    assert words[0].char_start == 0
    assert words[0].surprisal == pytest.approx(2.0)
    _assert_offsets_roundtrip(source, words)


# ---------------------------------------------------------------------------
# 5. Trailing comma
# ---------------------------------------------------------------------------


def test_trailing_comma_folds_into_word_non_terminal() -> None:
    source = "wolf, then"
    tokens = _tokens(
        ("wolf", 1.0),
        (",", 0.1),
        (" then", 0.5),
    )
    words = reconcile(source, tokens)
    assert words[0].core == "wolf"
    assert words[0].trailing_punct == ","
    assert words[0].is_terminal_punct is False
    assert words[0].surprisal == pytest.approx(1.1)
    _assert_offsets_roundtrip(source, words)


# ---------------------------------------------------------------------------
# 6. Terminal punctuation
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("punct", [".", "!", "?"])
def test_terminal_punctuation_anchored(punct: str) -> None:
    source = f"wolf{punct}"
    tokens = _tokens(("wolf", 1.0), (punct, 0.2))
    words = reconcile(source, tokens)
    assert len(words) == 1
    assert words[0].core == "wolf"
    assert words[0].trailing_punct == punct
    assert words[0].is_terminal_punct is True
    _assert_offsets_roundtrip(source, words)


# ---------------------------------------------------------------------------
# 7. Punctuation-heavy sentence
# ---------------------------------------------------------------------------


def test_punctuation_heavy_sentence() -> None:
    source = "She said, 'No!' loudly."
    tokens = _tokens(
        ("She", 1.0),
        (" said", 0.5),
        (",", 0.1),
        (" '", 0.2),
        ("No", 1.5),
        ("!", 0.3),
        ("'", 0.05),
        (" loudly", 1.2),
        (".", 0.1),
    )
    words = reconcile(source, tokens)
    cores = [w.core for w in words]
    # "'" leading the quote attaches to "No" via the whitespace+punct path,
    # making it the trailing punct of... well, an empty preceding word would
    # be wrong. Verify the actual behavior: leading "'" is emitted as an
    # empty-core word holding just the quote.
    assert "She" in cores
    assert "No" in cores
    assert "loudly" in cores

    # Find the words we care about.
    by_core = {w.core: w for w in words if w.core}
    assert by_core["She"].trailing_punct == ""
    assert by_core["said"].trailing_punct == ","
    assert by_core["said"].is_terminal_punct is False
    assert by_core["No"].trailing_punct == "!'"
    assert by_core["No"].is_terminal_punct is False  # ends in ', not in .!?
    assert by_core["loudly"].trailing_punct == "."
    assert by_core["loudly"].is_terminal_punct is True

    _assert_offsets_roundtrip(source, words)

    # Surprisal conservation across all tokens (no BOS/EOS here).
    total_tokens = sum(t.surprisal for t in tokens)
    total_words = sum(w.surprisal for w in words)
    assert total_words == pytest.approx(total_tokens, abs=TOL)


# ---------------------------------------------------------------------------
# 8. Unicode normalization
# ---------------------------------------------------------------------------


def test_normalize_folds_smart_quotes_and_dashes() -> None:
    raw = "“Hello” — it’s an en–dash"
    out = normalize(raw)
    assert out == '"Hello" - it\'s an en-dash'


def test_normalize_applies_nfc() -> None:
    # "é" as NFD (e + combining acute) should fold to NFC single codepoint.
    raw = "café"
    out = normalize(raw)
    assert out == "café"
    assert len(out) == 4


def test_reconcile_works_on_normalized_unicode_input() -> None:
    raw = "She said “no” — firmly."
    source = normalize(raw)
    # source is: She said "no" - firmly.
    tokens = _tokens(
        ("She", 1.0),
        (" said", 0.5),
        (' "', 0.2),
        ("no", 1.0),
        ('"', 0.1),
        (" -", 0.3),
        (" firmly", 1.5),
        (".", 0.05),
    )
    words = reconcile(source, tokens)
    by_core = {w.core: w for w in words if w.core}
    assert by_core["no"].trailing_punct == '"'
    assert by_core["firmly"].trailing_punct == "."
    assert by_core["firmly"].is_terminal_punct is True
    _assert_offsets_roundtrip(source, words)


# ---------------------------------------------------------------------------
# 9. BOS/EOS stripping
# ---------------------------------------------------------------------------


def test_bos_eos_stripped_before_aggregation() -> None:
    source = "wolf"
    tokens = _tokens(
        ("<BOS>", 99.0),
        ("wolf", 1.0),
        ("<EOS>", 77.0),
    )
    words = reconcile(source, tokens)
    assert len(words) == 1
    assert words[0].core == "wolf"
    # BOS/EOS surprisal must not leak in.
    assert words[0].surprisal == pytest.approx(1.0)
    # Conserved total over real tokens excludes BOS/EOS.
    real_total = sum(t.surprisal for t in tokens if t.text not in {"<BOS>", "<EOS>"})
    assert sum(w.surprisal for w in words) == pytest.approx(real_total)


# ---------------------------------------------------------------------------
# 10. Surprisal conservation
# ---------------------------------------------------------------------------


def test_surprisal_conservation_clean_input() -> None:
    source = "the quick brown fox"
    tokens = _tokens(
        ("the", 0.5),
        (" quick", 2.0),
        (" brown", 1.25),
        (" fox", 3.0),
    )
    words = reconcile(source, tokens)
    token_total = sum(t.surprisal for t in tokens)
    word_total = sum(w.surprisal for w in words)
    assert word_total == pytest.approx(token_total, abs=TOL)
    assert not math.isnan(word_total)


# ---------------------------------------------------------------------------
# 11. Character-offset round-trip
# ---------------------------------------------------------------------------


def test_offsets_roundtrip_complex() -> None:
    source = "Hansel, well-known, met grandmother's wolf."
    tokens = _tokens(
        ("Hans", 1.0),
        ("el", 0.5),
        (",", 0.1),
        (" well", 0.8),
        ("-", 0.05),
        ("known", 0.4),
        (",", 0.1),
        (" met", 0.7),
        (" grand", 0.6),
        ("mother", 0.9),
        ("'s", 0.2),
        (" wolf", 1.1),
        (".", 0.05),
    )
    words = reconcile(source, tokens)
    cores = [w.core for w in words]
    assert cores == ["Hansel", "well-known", "met", "grandmother's", "wolf"]
    _assert_offsets_roundtrip(source, words)
    # Conservation also holds here.
    assert sum(w.surprisal for w in words) == pytest.approx(
        sum(t.surprisal for t in tokens), abs=TOL
    )


# ---------------------------------------------------------------------------
# 12. Empty / single-word inputs
# ---------------------------------------------------------------------------


def test_empty_input() -> None:
    assert reconcile("", []) == []


def test_empty_input_with_only_control_tokens() -> None:
    """BOS/EOS alone, no source — should still produce no words."""
    tokens = _tokens(("<BOS>", 1.0), ("<EOS>", 1.0))
    assert reconcile("", tokens) == []


def test_single_word_input() -> None:
    source = "hello"
    tokens = _tokens(("hello", 2.5))
    words = reconcile(source, tokens)
    assert len(words) == 1
    assert words[0].core == "hello"
    assert words[0].trailing_punct == ""
    assert words[0].is_terminal_punct is False
    assert words[0].surprisal == pytest.approx(2.5)
    _assert_offsets_roundtrip(source, words)


def test_single_word_with_terminal_punct() -> None:
    source = "Go!"
    tokens = _tokens(("Go", 1.0), ("!", 0.2))
    words = reconcile(source, tokens)
    assert len(words) == 1
    assert words[0].core == "Go"
    assert words[0].trailing_punct == "!"
    assert words[0].is_terminal_punct is True
    _assert_offsets_roundtrip(source, words)


# ---------------------------------------------------------------------------
# Defensive: mismatched tokens should raise rather than silently corrupt.
# ---------------------------------------------------------------------------


def test_mismatched_tokens_raise() -> None:
    with pytest.raises(ValueError):
        reconcile("hello world", _tokens(("hello", 1.0)))


# ---------------------------------------------------------------------------
# Multi-sentence input
# ---------------------------------------------------------------------------


def test_multi_sentence_input() -> None:
    source = "Hi. Bye."
    tokens = _tokens(
        ("Hi", 1.0),
        (".", 0.2),
        (" Bye", 0.7),
        (".", 0.15),
    )
    words = reconcile(source, tokens)
    assert [w.core for w in words] == ["Hi", "Bye"]
    assert words[0].trailing_punct == "."
    assert words[0].is_terminal_punct is True
    assert words[1].trailing_punct == "."
    assert words[1].is_terminal_punct is True
    _assert_offsets_roundtrip(source, words)
    assert sum(w.surprisal for w in words) == pytest.approx(
        sum(t.surprisal for t in tokens), abs=TOL
    )


# ---------------------------------------------------------------------------
# Tab/newline between words
# ---------------------------------------------------------------------------


def test_tab_and_newline_between_words() -> None:
    source = "one\ttwo\nthree"
    tokens = _tokens(
        ("one", 1.0),
        ("\t", 0.1),
        ("two", 2.0),
        ("\n", 0.05),
        ("three", 3.0),
    )
    words = reconcile(source, tokens)
    assert [w.core for w in words] == ["one", "two", "three"]
    # Whitespace tokens attach to the following word.
    assert words[1].surprisal == pytest.approx(0.1 + 2.0)
    assert words[2].surprisal == pytest.approx(0.05 + 3.0)
    _assert_offsets_roundtrip(source, words)
    assert sum(w.surprisal for w in words) == pytest.approx(
        sum(t.surprisal for t in tokens), abs=TOL
    )


# ---------------------------------------------------------------------------
# Multiple consecutive spaces between words
# ---------------------------------------------------------------------------


def test_multiple_consecutive_spaces_between_words() -> None:
    source = "hi   bye"
    tokens = _tokens(
        ("hi", 1.0),
        ("   ", 0.3),
        ("bye", 2.0),
    )
    words = reconcile(source, tokens)
    assert [w.core for w in words] == ["hi", "bye"]
    # The three-space token's surprisal attaches to the FOLLOWING word.
    assert words[0].surprisal == pytest.approx(1.0)
    assert words[1].surprisal == pytest.approx(0.3 + 2.0)
    _assert_offsets_roundtrip(source, words)
    assert sum(w.surprisal for w in words) == pytest.approx(
        sum(t.surprisal for t in tokens), abs=TOL
    )


# ---------------------------------------------------------------------------
# Multi-terminal punctuation ("Really?!")
# ---------------------------------------------------------------------------


def test_multi_terminal_punctuation() -> None:
    source = "Really?!"
    tokens = _tokens(
        ("Really", 1.5),
        ("?", 0.2),
        ("!", 0.1),
    )
    words = reconcile(source, tokens)
    assert len(words) == 1
    assert words[0].core == "Really"
    assert words[0].trailing_punct == "?!"
    # Trailing char is "!", which is terminal.
    assert words[0].is_terminal_punct is True
    assert words[0].surprisal == pytest.approx(1.5 + 0.2 + 0.1)
    _assert_offsets_roundtrip(source, words)


# ---------------------------------------------------------------------------
# No-space punctuation ("a.b")
# ---------------------------------------------------------------------------


def test_no_space_punctuation_splits_words() -> None:
    source = "a.b"
    tokens = _tokens(
        ("a", 1.0),
        (".", 0.5),
        ("b", 2.0),
    )
    words = reconcile(source, tokens)
    assert [w.core for w in words] == ["a", "b"]
    assert words[0].trailing_punct == "."
    assert words[0].is_terminal_punct is True
    assert words[1].trailing_punct == ""
    _assert_offsets_roundtrip(source, words)
    assert sum(w.surprisal for w in words) == pytest.approx(
        sum(t.surprisal for t in tokens), abs=TOL
    )


# ---------------------------------------------------------------------------
# Pure-whitespace input (latent conservation case)
# ---------------------------------------------------------------------------


def test_pure_whitespace_input_emits_empty_core_word() -> None:
    """Whitespace-only token streams must not silently drop surprisal.

    A single empty-core ``Word`` is emitted to hold the accumulated surprisal
    so the conservation invariant is preserved. Detect via ``is_empty_core``.
    """
    source = "   "
    tokens = _tokens(("   ", 1.0))
    words = reconcile(source, tokens)
    assert len(words) == 1
    assert words[0].is_empty_core is True
    assert words[0].core == ""
    assert words[0].trailing_punct == ""
    assert words[0].is_terminal_punct is False
    assert words[0].surprisal == pytest.approx(1.0)
    assert words[0].token_indices == [0]
    # Conservation: sum of word surprisals == sum of (non-control) tokens.
    assert sum(w.surprisal for w in words) == pytest.approx(
        sum(t.surprisal for t in tokens), abs=TOL
    )


# ---------------------------------------------------------------------------
# Smart-apostrophe contraction round-trip through normalize + reconcile
# ---------------------------------------------------------------------------


def test_smart_apostrophe_contraction_roundtrip() -> None:
    raw = "grandmother’s"  # smart right single quote
    source = normalize(raw)
    assert source == "grandmother's"
    tokens = _tokens(
        ("grand", 1.0),
        ("mother", 1.5),
        ("'s", 0.25),
    )
    words = reconcile(source, tokens)
    assert len(words) == 1
    assert words[0].core == "grandmother's"
    assert words[0].trailing_punct == ""
    assert words[0].surprisal == pytest.approx(1.0 + 1.5 + 0.25)
    _assert_offsets_roundtrip(source, words)


# ---------------------------------------------------------------------------
# Word.is_empty_core helper
# ---------------------------------------------------------------------------


def test_is_empty_core_helper() -> None:
    # Leading standalone punctuation produces an empty-core word.
    source = "'hi"
    tokens = _tokens(
        ("'", 0.4),
        ("hi", 1.0),
    )
    words = reconcile(source, tokens)
    # First word: empty core, trailing_punct = "'"
    assert words[0].is_empty_core is True
    assert words[0].core == ""
    assert words[0].trailing_punct == "'"
    # Second word: real word.
    assert words[1].is_empty_core is False
    assert words[1].core == "hi"
    _assert_offsets_roundtrip(source, words)
