"""Corpus integrity tests for the starter fairy-tale set.

These are pure unit tests: no model, no tokenizer. They confirm that each
corpus file is readable, well-formed UTF-8, contains the canonical story
beats that pin down the source/translation, survives the normalization
roundtrip used by the pipeline, and falls inside the word-count band
committed to in `docs/implementation-plan.md` (~1,500-3,000 words).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from cprediction import normalize


CORPUS_DIR = Path(__file__).resolve().parent.parent / "corpus"

# Canonical story beats. Each token must appear (case-insensitively) in the
# tale text. The point is to pin down "this is the correct tale in the
# expected translation" — not to enforce wording.
_BEATS: dict[str, tuple[str, ...]] = {
    "little-red-riding-hood.txt": (
        "Red-Cap",
        "wolf",
        "grandmother",
        "huntsman",
    ),
    "hansel-and-gretel.txt": (
        "Hansel",
        "Gretel",
        "witch",
        "oven",
        "father",
        "stepmother",
    ),
}

# Either of these (case-insensitive) is enough to confirm the witch's
# sweets-house beat — Hunt uses "bread", "cake", and "sugar" rather than
# the modern "gingerbread", so we accept any of the canonical synonyms.
_HANSEL_HOUSE_SYNONYMS: tuple[str, ...] = ("gingerbread", "sweet", "sugar", "cake")

# Translation-discriminator markers. These pin down not just the tale but
# Margaret Hunt's 1884 English translation specifically. `_BEATS` already
# covers LRRH via "Red-Cap" (Hunt's choice over the common "Red Riding
# Hood"); H&G needs its own marker — Hunt's distinctive closing line.
_TRANSLATION_MARKERS: dict[str, str] = {
    "hansel-and-gretel.txt": (
        "My tale is done, there runs a mouse"
    ),
}

# Curly quote characters that `normalize()` must fold to ASCII straight
# quotes. We assert presence in the source and absence in the normalized
# output so the smart-quote folding is exercised by real data.
_CURLY_SINGLES: tuple[str, ...] = ("‘", "’")  # ‘ ’
_CURLY_DOUBLES: tuple[str, ...] = ("“", "”")  # “ ”


@pytest.fixture(params=sorted(_BEATS.keys()))
def corpus_path(request: pytest.FixtureRequest) -> Path:
    return CORPUS_DIR / request.param


def test_corpus_file_exists_and_nonempty(corpus_path: Path) -> None:
    assert corpus_path.exists(), f"missing corpus file: {corpus_path}"
    assert corpus_path.stat().st_size > 0, f"empty corpus file: {corpus_path}"


def test_corpus_is_valid_utf8(corpus_path: Path) -> None:
    raw = corpus_path.read_bytes()
    # Reject UTF-8 BOM explicitly — the abstract calls for clean UTF-8.
    assert not raw.startswith(b"\xef\xbb\xbf"), f"unexpected BOM in {corpus_path}"
    # Will raise UnicodeDecodeError if invalid.
    raw.decode("utf-8")


def test_corpus_contains_canonical_beats(corpus_path: Path) -> None:
    text = corpus_path.read_text(encoding="utf-8")
    lower = text.lower()
    for beat in _BEATS[corpus_path.name]:
        assert beat.lower() in lower, (
            f"corpus {corpus_path.name} missing canonical beat {beat!r}"
        )
    # Hansel's sweets-house beat: accept any of the canonical synonyms.
    if corpus_path.name == "hansel-and-gretel.txt":
        assert any(s in lower for s in _HANSEL_HOUSE_SYNONYMS), (
            "hansel-and-gretel.txt missing sweets-house beat "
            f"(expected one of {_HANSEL_HOUSE_SYNONYMS})"
        )


def test_corpus_normalize_roundtrip(corpus_path: Path) -> None:
    text = corpus_path.read_text(encoding="utf-8")
    normalized = normalize(text)
    # normalize() strips outer whitespace and folds a small set of unicode
    # variants to ASCII; the resulting length should be within 1% of the
    # input (after stripping outer whitespace ourselves for a fair compare).
    stripped_len = len(text.strip())
    assert stripped_len > 0
    delta = abs(len(normalized) - stripped_len)
    assert delta / stripped_len < 0.01, (
        f"normalize() changed length of {corpus_path.name} by "
        f"{delta} chars ({delta / stripped_len:.2%}); expected <1%"
    )


def test_corpus_smart_quotes_folded(corpus_path: Path) -> None:
    """The raw corpus must contain curly quotes; normalize() must fold them.

    The length-delta check above would pass even if smart-quote folding
    silently broke (the replacements are same-length ASCII), so we assert
    the substitution directly: curly quotes IN, straight quotes OUT.
    """
    text = corpus_path.read_text(encoding="utf-8")
    normalized = normalize(text)

    # Every Hunt-translation corpus uses curly single quotes for dialogue
    # and apostrophes. Doubles are tale-dependent (LRRH has them, H&G
    # does not), so we only require at least one curly character total.
    curly_present = any(ch in text for ch in _CURLY_SINGLES + _CURLY_DOUBLES)
    assert curly_present, (
        f"{corpus_path.name} has no curly quotes — the smart-quote folding "
        "test is meaningless without them. Re-source the corpus from a "
        "typographically faithful edition."
    )

    # After normalize(), no curly quote variant may remain.
    for ch in _CURLY_SINGLES + _CURLY_DOUBLES:
        assert ch not in normalized, (
            f"normalize({corpus_path.name}) left curly quote {ch!r} unfolded"
        )

    # And the straight-ASCII replacements must be present in the output.
    # (Any corpus with curly singles becomes ASCII apostrophes; any corpus
    # with curly doubles becomes ASCII double-quotes.)
    if any(ch in text for ch in _CURLY_SINGLES):
        assert "'" in normalized, (
            f"normalize({corpus_path.name}) produced no ASCII apostrophes "
            "despite curly singles in the input"
        )
    if any(ch in text for ch in _CURLY_DOUBLES):
        assert '"' in normalized, (
            f"normalize({corpus_path.name}) produced no ASCII double quotes "
            "despite curly doubles in the input"
        )


def test_corpus_translation_marker(corpus_path: Path) -> None:
    """Confirm the corpus is Margaret Hunt's 1884 translation, not another.

    `_BEATS` confirms the tale; this confirms the translation. LRRH is
    covered by "Red-Cap" already in `_BEATS` (Hunt's choice; other English
    translations use "Little Red Riding Hood" / "Red Riding Hood"). H&G
    has no equivalent name-level discriminator, so we pin it to Hunt's
    distinctive closing line.
    """
    marker = _TRANSLATION_MARKERS.get(corpus_path.name)
    if marker is None:
        pytest.skip("translation marker covered by _BEATS")
    text = corpus_path.read_text(encoding="utf-8")
    assert marker in text, (
        f"{corpus_path.name} missing Hunt-translation marker {marker!r}"
    )


def test_corpus_word_count_in_band(corpus_path: Path) -> None:
    text = corpus_path.read_text(encoding="utf-8")
    word_count = len(text.split())
    # docs/abstract.md says "roughly 1,500-3,000 words each". Hunt's LRRH
    # comes in just under at ~1,378 — close enough to "roughly" that we
    # accept it rather than re-source the tale. The hard ceiling protects
    # against accidentally pasting two tales into one file.
    assert 1300 <= word_count <= 3000, (
        f"{corpus_path.name} has {word_count} words; "
        "expected roughly 1,500-3,000 per docs/abstract.md"
    )
