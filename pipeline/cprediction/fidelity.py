"""Fidelity scoring for reconstructed gaps.

Given the model's reconstruction of a removed span and the actual removed
text, return a score in [0.0, 1.0] where 1.0 is an exact match and 0.0 is
no overlap. Phase 0 uses a simple token-set F1 over case-folded, punctuation-
stripped word tokens. Higher is better.

Token-set F1 was chosen over normalized edit distance because:

- It is symmetric, bounded in [0, 1], and trivial to interpret.
- Word-order rearrangements between source and reconstruction (which we expect
  for paraphrastic, "lossy-region" gaps) are penalized far less than by edit
  distance, which is the right call for the eyeball test: a reconstruction
  that preserves all the right content words in a different order is still a
  good fill.
- It avoids edit-distance's dependency on string length normalization, which
  is awkward for very short gaps.

Edge cases:
- Empty predicted AND empty actual -> 1.0 (vacuous match).
- One empty, the other non-empty -> 0.0.
- Otherwise: F1 = 2 * |P ∩ A| / (|P| + |A|), using multisets so repeated
  tokens are credited proportionally.
"""

from __future__ import annotations

import re
from collections import Counter


_WORD_RE = re.compile(r"[\w']+", re.UNICODE)


def _tokenize(text: str) -> list[str]:
    """Lowercase + strip non-word chars, return a list of word tokens.

    Apostrophes are kept inside tokens so ``grandmother's`` stays one token,
    matching the reconciliation layer's word definition.
    """

    return [m.group(0).lower() for m in _WORD_RE.finditer(text)]


def fidelity(predicted: str, actual: str) -> float:
    """Return a fidelity score in [0.0, 1.0] for `predicted` vs `actual`.

    Token-set F1 with multiset semantics. See module docstring for rationale.
    """

    p_tokens = _tokenize(predicted)
    a_tokens = _tokenize(actual)
    if not p_tokens and not a_tokens:
        return 1.0
    if not p_tokens or not a_tokens:
        return 0.0
    p_counts = Counter(p_tokens)
    a_counts = Counter(a_tokens)
    overlap = sum((p_counts & a_counts).values())
    if overlap == 0:
        return 0.0
    precision = overlap / sum(p_counts.values())
    recall = overlap / sum(a_counts.values())
    return 2 * precision * recall / (precision + recall)
