"""Gap-finding: turn (words, threshold) into a list of contiguous gaps.

Implements the committed Phase 1 span-merging rule:

    Sentence-boundary-bounded greedy: walk left-to-right, collecting any run
    of consecutive below-threshold words into a single gap. Two rules close
    a gap:

    1. **Terminal punctuation** (``.``, ``!``, ``?``) on the last below-
       threshold word closes the gap immediately — sentence boundaries are
       always respected.
    2. **Cap of ~30-40 words.** When a run would exceed
       ``max_gap_words``, the gap is split at the most recent sub-sentence
       boundary (a word whose ``trailing_punct`` ends in ``,``, ``;``, or
       ``-``). If no such boundary exists within the run, we split at the
       cap itself (preferring not to mid-phrase, but yielding the cap rather
       than producing arbitrarily long gaps).

Any word at or above ``threshold`` is a surviving word and breaks the current
gap. Empty-core words are skipped entirely (they hold no visible content).
"""

from __future__ import annotations

from dataclasses import dataclass

from cprediction.reconciliation import Word


_SUB_SENTENCE_PUNCT: frozenset[str] = frozenset({",", ";", "-"})


@dataclass(frozen=True)
class Gap:
    """A contiguous run of below-threshold words.

    Attributes:
        start_index: Index (into the input `words` list) of the first word
            in the gap. Inclusive.
        end_index: Index of the last word in the gap. Inclusive.
        word_indices: All word indices that make up the gap, in order. For a
            simple gap this is just `range(start_index, end_index + 1)`.
    """

    start_index: int
    end_index: int
    word_indices: list[int]


def _ends_in_sub_sentence_punct(word: Word) -> bool:
    return bool(word.trailing_punct) and word.trailing_punct[-1] in _SUB_SENTENCE_PUNCT


def find_gaps(
    words: list[Word],
    threshold: float,
    max_gap_words: int = 35,
) -> list[Gap]:
    """Find every gap (contiguous below-threshold run) per the merging rule.

    Args:
        words: per-word surprisal list from `reconcile()`.
        threshold: words with `surprisal < threshold` are removable.
        max_gap_words: soft cap; runs longer than this are split at the most
            recent sub-sentence boundary, or at the cap itself if none exists
            within the run.

    Returns:
        Gaps in left-to-right order. Empty list if no word qualifies.
    """

    if max_gap_words < 1:
        raise ValueError("max_gap_words must be >= 1.")

    gaps: list[Gap] = []
    current: list[int] = []

    def emit(indices: list[int]) -> None:
        if not indices:
            return
        gaps.append(
            Gap(
                start_index=indices[0],
                end_index=indices[-1],
                word_indices=list(indices),
            )
        )

    def split_at_cap(run: list[int]) -> tuple[list[int], list[int]]:
        """Split `run` at the most recent sub-sentence boundary, or at the cap.

        Returns (emitted_prefix, remainder). Looks for the latest index within
        `run[:max_gap_words]` whose word ends in `,`, `;`, or `-`. If found,
        the prefix is everything up to and including that index; the remainder
        is what comes after. If not found, prefix is the first
        ``max_gap_words`` items and the remainder is the rest.
        """

        window = run[:max_gap_words]
        split = -1
        for i in range(len(window) - 1, -1, -1):
            if _ends_in_sub_sentence_punct(words[window[i]]):
                split = i
                break
        if split == -1:
            split = len(window) - 1
        return run[: split + 1], run[split + 1 :]

    for idx, w in enumerate(words):
        if w.is_empty_core:
            continue
        if w.surprisal < threshold:
            current.append(idx)
            # Terminal punctuation closes the gap immediately.
            if w.is_terminal_punct:
                emit(current)
                current = []
                continue
            # Cap enforcement.
            while len(current) > max_gap_words:
                prefix, current = split_at_cap(current)
                emit(prefix)
        else:
            # Surviving word breaks the run.
            emit(current)
            current = []

    emit(current)
    return gaps
