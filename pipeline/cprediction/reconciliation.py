"""Tokenization reconciliation: BPE tokens -> user-visible words.

This module bridges the gap between the model's token stream (subword pieces
with leading-whitespace prefixes, BOS/EOS markers, etc.) and the words the
runtime renders as tiles. Every committed rule from the Phase 0 implementation
plan is enforced here.

Rules:
- Leading whitespace attaches to the FOLLOWING word.
- Trailing punctuation folds into the PRECEDING word's tile.
- Terminal punctuation (. ! ?) sets `is_terminal_punct=True` so the runtime
  can keep it visible (anchored) when its word fades.
- Apostrophes and hyphens DO NOT split words: `grandmother's`, `well-known`
  are each one word.
- BOS/EOS tokens are stripped before aggregation so they never contaminate
  the conserved surprisal total.
- Source text is Unicode-normalized (NFC, smart quotes folded to ASCII,
  en-/em-dashes folded to ASCII hyphens) before reconciliation.

TODO (Phase 1): The BOS/EOS allowlist below is a literal-string set chosen
from common conventions (Anthropic-style `<|...|>`, HuggingFace `<s>`/`</s>`,
etc.). Once we have the real Anthropic logprob API output in hand, validate
this set against it and migrate from a literal allowlist to a predicate fed
by SDK metadata (token id or role marker). Otherwise, unseen control tokens
(e.g. `<|im_start|>` or chat-framing pieces) could leak surprisal into words.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field


# Token strings that are treated as model control tokens and stripped entirely
# before aggregation. We recognise both common Anthropic-style markers and the
# generic HuggingFace-style ones so that hand-rolled fixtures and real API
# output both work.
#
# TODO(phase-1): replace with a predicate fed by SDK metadata; see module
# docstring.
_BOS_EOS_LITERALS: frozenset[str] = frozenset(
    {
        "<BOS>",
        "<EOS>",
        "<bos>",
        "<eos>",
        "<|begin_of_text|>",
        "<|end_of_text|>",
        "<|startoftext|>",
        "<|endoftext|>",
        "<s>",
        "</s>",
        "[BOS]",
        "[EOS]",
    }
)

# Smart-quote and dash folding map applied after NFC normalization. We
# deliberately fold to ASCII so the downstream tokenizer (whichever it is)
# sees a stable, narrow alphabet rather than a sprinkling of typographic
# variants.
_FOLD_MAP: dict[str, str] = {
    "‘": "'",  # left single quote
    "’": "'",  # right single quote / apostrophe
    "‚": "'",  # single low-9 quote
    "‛": "'",  # single high-reversed-9 quote
    "“": '"',  # left double quote
    "”": '"',  # right double quote
    "„": '"',  # double low-9 quote
    "‟": '"',  # double high-reversed-9 quote
    "–": "-",  # en dash
    "—": "-",  # em dash
    "−": "-",  # minus sign
    "…": "...",  # horizontal ellipsis
    " ": " ",  # non-breaking space
}

_TERMINAL_PUNCT: frozenset[str] = frozenset({".", "!", "?"})

# Characters that are part of a word's "core" body. Apostrophes and hyphens
# are intentionally included so contractions and hyphenated compounds stay
# whole.
_WORD_INTERIOR: frozenset[str] = frozenset({"'", "-"})


@dataclass(frozen=True)
class Token:
    """One model token plus its surprisal in bits.

    `text` is the raw token string as the model emitted it, including any
    leading whitespace (BPE convention). `surprisal` is -log2 p(token|context).
    """

    text: str
    surprisal: float


@dataclass
class Word:
    """A user-visible word tile, assembled from one or more model tokens.

    Note: ``core`` may be the empty string (``""``). This happens in two
    legitimate situations and downstream code must handle it:

    1. Leading standalone punctuation with no preceding word (e.g. the opening
       quote in ``'No!'`` when there is whitespace before it). The punctuation
       is recorded in ``trailing_punct`` with an empty ``core``.
    2. A token stream that contains only whitespace / control characters and
       no word characters at all. A single empty-core ``Word`` is emitted to
       hold the surprisal so that the conservation invariant is preserved.

    Use :pyattr:`is_empty_core` to detect this state instead of testing
    ``core == ""`` directly.

    Attributes:
        core: The word body, e.g. "wolf", "grandmother's", "well-known".
            May be ``""``; see note above.
        trailing_punct: Any punctuation folded onto the end of this word
            ("", ",", ".", "?!", etc.).
        is_terminal_punct: True iff `trailing_punct` ends in `.`, `!`, or `?`.
            The runtime uses this to anchor sentence boundaries.
        char_start: Inclusive offset into the normalized source text.
        char_end: Exclusive offset into the normalized source text. The slice
            normalized_text[char_start:char_end] always equals
            core + trailing_punct.
        surprisal: Sum of the surprisals of the tokens that compose this word.
        token_indices: Indices (into the original token list passed to
            `reconcile`) of every token that contributed to this word, in
            the order those tokens were appended. Order is guaranteed
            structurally — see `reconcile` for how it is preserved.
    """

    core: str
    trailing_punct: str
    is_terminal_punct: bool
    char_start: int
    char_end: int
    surprisal: float
    token_indices: list[int] = field(default_factory=list)

    @property
    def is_empty_core(self) -> bool:
        """True iff this word has no word characters in its core.

        Returned by punctuation-only and whitespace-only inputs; see the
        class docstring. Prefer this over comparing ``core == ""`` directly
        so downstream callers do not have to memorize the convention.
        """

        return self.core == ""


def normalize(text: str) -> str:
    """Normalize source text before tokenization or reconciliation.

    Applies NFC normalization, folds smart quotes and en-/em-dashes to ASCII,
    replaces NBSP with a regular space, and strips leading/trailing
    whitespace. Leading/trailing whitespace carries no narrative content,
    is not stable across corpus sources, and is reliably stripped by chat
    models — so the echo strategy in `score()` requires the normalized
    source to be pre-stripped for an exact-match comparison. Inter-word
    whitespace is preserved.

    Exposed separately from `reconcile` so it can be tested and used by
    other pipeline stages.
    """

    nfc = unicodedata.normalize("NFC", text)
    folded = "".join(_FOLD_MAP.get(ch, ch) for ch in nfc)
    return folded.strip()


def _is_control_token(text: str) -> bool:
    """Return True if `text` is a model control token (BOS/EOS-style)."""

    stripped = text.strip()
    return stripped in _BOS_EOS_LITERALS


def _classify_char(ch: str) -> str:
    """Bucket a single character for the reconciliation state machine.

    Returns one of: "space", "wordchar", "punct", "interior".

    `interior` characters (apostrophe, hyphen) only act as word-glue when they
    sit BETWEEN two alphanumeric characters — i.e. `grandmother's`, `well-known`.
    A leading `'` (as in `'No!'`) or a trailing `-` is punctuation. The state
    machine resolves the ambiguity with context.
    """

    if ch.isspace():
        return "space"
    if ch.isalnum():
        return "wordchar"
    if ch in _WORD_INTERIOR:
        return "interior"
    return "punct"


def reconcile(source_text: str, tokens: list[Token]) -> list[Word]:
    """Merge model tokens into user-visible words.

    `source_text` should already be normalized via `normalize()`. We re-walk
    the source text character by character, building words per the committed
    rules, and attribute each character to the token that produced it. Token
    surprisals are then summed onto whichever word their characters landed in.

    BOS/EOS tokens are dropped before any character attribution. A token whose
    `text` (after stripping) appears in the control-token set contributes
    neither characters nor surprisal.

    Trailing punctuation folds onto the preceding word. Whitespace between two
    words breaks the current word but its surprisal is attributed to the
    upcoming word (matching BPE's " grandmother" convention).

    If the input contains only non-control whitespace tokens (no word
    characters ever open), a single empty-core ``Word`` is emitted to carry
    the accumulated surprisal so the conservation invariant holds. Inspect
    :pyattr:`Word.is_empty_core` to detect this case.
    """

    # Build a flat per-character stream paired with the originating token
    # index, after stripping BOS/EOS tokens. We also keep token surprisals
    # in a position-indexed list so the surprisal-lookup is structurally
    # ordered, not dependent on dict insertion-order semantics.
    char_stream: list[tuple[str, int]] = []
    # `token_surprisals[idx]` is the surprisal for the original token at
    # position `idx`. Control tokens are kept as 0.0 placeholders so the
    # list stays index-aligned with the caller's `tokens` list.
    token_surprisals: list[float] = [0.0] * len(tokens)
    for idx, tok in enumerate(tokens):
        if _is_control_token(tok.text):
            continue
        token_surprisals[idx] = tok.surprisal
        for ch in tok.text:
            char_stream.append((ch, idx))

    reconstructed = "".join(ch for ch, _ in char_stream)
    if reconstructed != source_text:
        raise ValueError(
            "Token stream does not reconstruct source_text. "
            f"Expected {source_text!r}, got {reconstructed!r}. "
            "Ensure source_text was normalized and tokens cover it exactly."
        )

    words: list[Word] = []
    # Per-word accumulators.
    cur_core_start: int | None = None
    cur_core_end: int | None = None
    cur_trailing_start: int | None = None
    cur_trailing_end: int | None = None
    cur_token_idxs: list[int] = []
    cur_pending_token_idxs: list[int] = []  # tokens seen in leading whitespace

    def flush() -> None:
        nonlocal cur_core_start, cur_core_end
        nonlocal cur_trailing_start, cur_trailing_end, cur_token_idxs
        if cur_core_start is None:
            return
        core = source_text[cur_core_start:cur_core_end]
        if cur_trailing_start is not None:
            trailing = source_text[cur_trailing_start:cur_trailing_end]
            end = cur_trailing_end
        else:
            trailing = ""
            end = cur_core_end
        is_terminal = bool(trailing) and trailing[-1] in _TERMINAL_PUNCT
        # Deduplicate while preserving append order. `cur_token_idxs` is a
        # list (not a dict), so iteration order is structurally determined.
        seen: set[int] = set()
        ordered: list[int] = []
        for i in cur_token_idxs:
            if i not in seen:
                seen.add(i)
                ordered.append(i)
        surprisal = sum(token_surprisals[i] for i in ordered)
        words.append(
            Word(
                core=core,
                trailing_punct=trailing,
                is_terminal_punct=is_terminal,
                char_start=cur_core_start,
                char_end=end,
                surprisal=surprisal,
                token_indices=ordered,
            )
        )
        cur_core_start = None
        cur_core_end = None
        cur_trailing_start = None
        cur_trailing_end = None
        cur_token_idxs = []

    for pos, (ch, tok_idx) in enumerate(char_stream):
        kind = _classify_char(ch)
        if kind == "interior":
            # Glue char (apostrophe / hyphen) acts as wordchar only when it
            # connects two word characters. Mid-word and followed (after any
            # run of interior chars) by another wordchar -> glue. Otherwise
            # it's punctuation.
            next_kind: str | None = None
            j = pos + 1
            while j < len(char_stream):
                nk = _classify_char(char_stream[j][0])
                if nk == "interior":
                    j += 1
                    continue
                next_kind = nk
                break
            in_word = cur_core_start is not None and cur_trailing_start is None
            if in_word and next_kind == "wordchar":
                kind = "wordchar"
            else:
                kind = "punct"
        if kind == "space":
            # Whitespace ends the current word's punctuation/core but the
            # token that owns this space belongs to the NEXT word.
            if cur_core_start is not None:
                flush()
            # A single BPE token can span both a flushed word's trailing
            # punctuation AND the whitespace that follows (e.g. Qwen's
            # ``.\n\n`` paragraph-break piece). Its surprisal was already
            # accounted for by the word we just flushed, so do not also
            # forward it as pending — that would double-count it onto the
            # next word and violate conservation.
            if words and tok_idx in words[-1].token_indices:
                pass
            else:
                cur_pending_token_idxs.append(tok_idx)
        elif kind == "wordchar":
            if cur_trailing_start is not None:
                # We had punctuation after a word; a new alphanumeric char
                # means a new word starts (e.g. "No!' loudly" — after !' we
                # see space then "loudly", but if no space, e.g. "a.b", we
                # still start a new word).
                flush()
            if cur_core_start is None:
                cur_core_start = pos
                cur_core_end = pos + 1
                # Pending whitespace tokens belong to this word.
                cur_token_idxs.extend(cur_pending_token_idxs)
                cur_pending_token_idxs = []
                cur_token_idxs.append(tok_idx)
            else:
                cur_core_end = pos + 1
                cur_token_idxs.append(tok_idx)
        else:  # punct
            if cur_core_start is None:
                # Leading punctuation with no word yet — emit a standalone
                # "word" whose core is empty and trailing_punct holds the
                # punctuation. This keeps every input character attributable.
                # In practice this is rare; opening quotes ride along to the
                # next word via the whitespace path below.
                cur_core_start = pos
                cur_core_end = pos  # empty core
                cur_trailing_start = pos
                cur_trailing_end = pos + 1
                cur_token_idxs.extend(cur_pending_token_idxs)
                cur_pending_token_idxs = []
                cur_token_idxs.append(tok_idx)
            else:
                if cur_trailing_start is None:
                    cur_trailing_start = pos
                    cur_trailing_end = pos + 1
                else:
                    cur_trailing_end = pos + 1
                cur_token_idxs.append(tok_idx)

    # Flush the tail. Any pending whitespace-only tokens (e.g. a trailing
    # newline-only token) are folded onto the last word so their surprisal is
    # still conserved.
    if cur_pending_token_idxs and words and cur_core_start is None:
        last = words[-1]
        for i in cur_pending_token_idxs:
            if i not in last.token_indices:
                last.surprisal += token_surprisals[i]
                last.token_indices.append(i)
        cur_pending_token_idxs = []
    if cur_core_start is not None:
        # Trailing whitespace tokens that arrived after the last word's body
        # but before any new word started: fold onto this word so surprisal
        # stays conserved.
        for i in cur_pending_token_idxs:
            if i not in cur_token_idxs:
                cur_token_idxs.append(i)
        cur_pending_token_idxs = []
        flush()
    elif cur_pending_token_idxs and not words:
        # Pure-whitespace (or otherwise word-character-free) input. No word
        # was ever opened, so there is nothing to fold the surprisal onto.
        # Emit a synthetic empty-core word that owns the whole span so the
        # conservation invariant (sum of word surprisals == sum of non-control
        # token surprisals) still holds. Callers detect this with
        # `Word.is_empty_core`.
        seen: set[int] = set()
        ordered: list[int] = []
        for i in cur_pending_token_idxs:
            if i not in seen:
                seen.add(i)
                ordered.append(i)
        surprisal = sum(token_surprisals[i] for i in ordered)
        words.append(
            Word(
                core="",
                trailing_punct="",
                is_terminal_punct=False,
                char_start=0,
                char_end=len(source_text),
                surprisal=surprisal,
                token_indices=ordered,
            )
        )
        cur_pending_token_idxs = []

    return words
