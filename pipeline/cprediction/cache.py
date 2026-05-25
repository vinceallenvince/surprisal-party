"""Phase 1 cache writer: shape pipeline state into versioned JSON for the runtime.

This module emits one JSON file per tale that the Next.js runtime in Phase 2
will consume directly. The Phase 0 Markdown artifact is a hand-readable
sibling, not a runtime input.

What the runtime needs from each field
--------------------------------------

- ``schema_version`` — the runtime can refuse caches it does not understand.
- ``metadata`` — title (page header), model id and timestamp (provenance
  caption), ``total_bits`` (the conservation denominator for the
  "stored / predicted / conserved" header), and ``word_count`` /
  ``token_count`` so the runtime can sanity-check the cache it loaded.
- ``source`` — the *normalized* source text (post :func:`normalize`). The
  runtime renders this as the page body and uses per-word ``char_start`` /
  ``char_end`` offsets to overlay highlights, fades, and seams.
- ``words`` — every reconciled :class:`Word`, including empty-core ones, so
  word indices are stable across all consumers. The runtime filters
  ``is_empty_core`` at render time. Per-word ``surprisal`` drives kernel
  highlighting and faded-tile opacity.
- ``kernel_word_indices`` — convenience: which words survive at the deepest
  slider position. The runtime highlights these from position 0 (the
  "backbone of the story" affordance in ``docs/abstract.md``).
- ``positions`` — one entry per slider position. Each carries
  ``words_remaining`` / ``words_removed`` for the tile-migration animation,
  ``stored_bits`` / ``predicted_bits`` for the conservation header, and the
  list of ``gaps`` for seam rendering. Per-gap ``word_indices`` tell the
  runtime exactly which tiles migrate when this position is selected.

Schema validation
-----------------

We use **pydantic v2** for schema definition and validation. Reasons:

1. Models are the schema — no second source-of-truth JSON Schema file to keep
   in sync with the dataclass shape.
2. Construction-time validation is automatic; we get type / range checks for
   free, plus clear errors with field paths.
3. ``model_dump_json`` produces JSON directly and respects field serializers,
   so float rounding is handled in one place.

Pydantic v2 emits JSON Schema via ``model_json_schema()`` if a runtime-side
validator (vanilla JSON Schema in Node) ever wants to validate independently.

Float precision
---------------

All bit values (surprisals, stored_bits, predicted_bits, total_bits) and
fidelity scores are rounded to :data:`FLOAT_PRECISION` decimal places at
serialization time. Char offsets and word counts are integers and emitted
verbatim.

Invariants checked before write
-------------------------------

- ``schema_version`` matches :data:`CACHE_SCHEMA_VERSION`.
- For every position, ``stored_bits + predicted_bits`` equals
  ``metadata.total_bits`` within :data:`CONSERVATION_TOLERANCE`.

Either failure raises ``ValueError`` so we never write a cache that the
runtime would then refuse.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_serializer

if TYPE_CHECKING:  # pragma: no cover - typing only
    from cprediction.reconciliation import Word


# Bump minor for additive fields, major for breaking changes.
CACHE_SCHEMA_VERSION: str = "0.1.0"

# Float precision applied to every emitted bits / fidelity value.
FLOAT_PRECISION: int = 4

# Tolerance for the per-position ``stored + predicted == total`` invariant.
# Matches the abs_tol used in :mod:`cprediction.run`.
CONSERVATION_TOLERANCE: float = 1e-6


def _round(value: float) -> float:
    """Round to :data:`FLOAT_PRECISION` decimal places."""

    return round(float(value), FLOAT_PRECISION)


class _RoundedFloatModel(BaseModel):
    """Base model that rounds every ``float`` field on serialization.

    The wildcard ``field_serializer("*")`` below runs for every field on every
    subclass; it rounds floats to :data:`FLOAT_PRECISION` and passes all other
    types through unchanged. Subclasses therefore declare their fields
    normally without per-field serializer boilerplate.
    """

    model_config = ConfigDict(extra="forbid")

    @field_serializer("*")
    def _serialize_floats(self, v):  # type: ignore[no-untyped-def]
        if isinstance(v, float):
            return _round(v)
        return v


class WordEntry(_RoundedFloatModel):
    """One reconciled word, serialized for the runtime."""

    index: int = Field(ge=0)
    core: str
    trailing_punct: str
    is_terminal_punct: bool
    is_empty_core: bool
    char_start: int = Field(ge=0)
    char_end: int = Field(ge=0)
    surprisal: float


class GapEntry(_RoundedFloatModel):
    """One gap at one slider position."""

    id: int = Field(ge=0)
    start_word_index: int = Field(ge=0)
    end_word_index: int = Field(ge=0)
    word_indices: list[int]
    actual_text: str
    predicted_text: str
    fidelity: float = Field(ge=0.0, le=1.0)


class PositionEntry(_RoundedFloatModel):
    """One slider position."""

    index: int = Field(ge=0)
    threshold: float
    words_remaining: int = Field(ge=0)
    words_removed: int = Field(ge=0)
    stored_bits: float = Field(ge=0.0)
    predicted_bits: float = Field(ge=0.0)
    gaps: list[GapEntry]


class CacheMetadata(_RoundedFloatModel):
    """Top-level provenance and totals."""

    title: str
    source_file: str
    model_id: str
    generated_at: str  # ISO 8601 UTC
    total_bits: float = Field(ge=0.0)
    word_count: int = Field(ge=0)
    token_count: int = Field(ge=0)


class TaleCache(_RoundedFloatModel):
    """The full cache shape; the JSON document mirrors this 1:1."""

    schema_version: str
    metadata: CacheMetadata
    source: str
    words: list[WordEntry]
    kernel_word_indices: list[int]
    positions: list[PositionEntry]


def _word_to_entry(index: int, word: Word) -> WordEntry:
    return WordEntry(
        index=index,
        core=word.core,
        trailing_punct=word.trailing_punct,
        is_terminal_punct=word.is_terminal_punct,
        is_empty_core=word.is_empty_core,
        char_start=word.char_start,
        char_end=word.char_end,
        surprisal=word.surprisal,
    )


def build_cache(
    *,
    title: str,
    source_file: str,
    model_id: str,
    normalized_source: str,
    words: list[Word],
    positions: list,  # list[PositionResult] — imported lazily to avoid cycle
    total_bits: float,
    token_count: int,
    generated_at: datetime | None = None,
) -> TaleCache:
    """Assemble a :class:`TaleCache` from in-memory pipeline state.

    Pure data shaping. No I/O, no model invocation. The conservation invariant
    is asserted here so any drift fails before the cache is emitted.
    """

    if generated_at is None:
        generated_at = datetime.now(timezone.utc)

    real_words = [w for w in words if not w.is_empty_core]

    word_entries = [_word_to_entry(i, w) for i, w in enumerate(words)]

    # Kernel: words that survive at the deepest slider position (the last
    # PositionResult). We compute it from the positions themselves rather than
    # re-deriving from the threshold, so the kernel definition is exactly what
    # the runtime will see when the slider is dragged to the right edge.
    kernel: list[int] = []
    if positions:
        deepest = positions[-1]
        removed: set[int] = {wi for g in deepest.gaps for wi in g.gap.word_indices}
        kernel = [
            i
            for i, w in enumerate(words)
            if not w.is_empty_core and i not in removed
        ]

    position_entries: list[PositionEntry] = []
    for p in positions:
        # Re-assert conservation here. ``run.py`` already asserts it during
        # the build, but the cache writer is a second, structural checkpoint:
        # if anything ever short-circuits the run-time assert (e.g. someone
        # constructs PositionResults by hand), we still refuse to emit a
        # broken cache.
        if not math.isclose(
            p.stored_bits + p.predicted_bits,
            total_bits,
            rel_tol=1e-9,
            abs_tol=CONSERVATION_TOLERANCE,
        ):
            raise ValueError(
                f"conservation violated at position {p.position}: "
                f"stored={p.stored_bits} + predicted={p.predicted_bits} "
                f"!= total={total_bits}"
            )
        gap_entries = [
            GapEntry(
                id=g_idx,
                start_word_index=gr.gap.start_index,
                end_word_index=gr.gap.end_index,
                word_indices=list(gr.gap.word_indices),
                actual_text=gr.actual,
                predicted_text=gr.predicted,
                fidelity=gr.fidelity_score,
            )
            for g_idx, gr in enumerate(p.gaps)
        ]
        position_entries.append(
            PositionEntry(
                index=p.position,
                threshold=p.threshold,
                words_remaining=p.words_remaining,
                words_removed=p.words_removed,
                stored_bits=p.stored_bits,
                predicted_bits=p.predicted_bits,
                gaps=gap_entries,
            )
        )

    metadata = CacheMetadata(
        title=title,
        source_file=source_file,
        model_id=model_id,
        generated_at=generated_at.replace(microsecond=0).isoformat().replace(
            "+00:00", "Z"
        ),
        total_bits=total_bits,
        word_count=len(real_words),
        token_count=token_count,
    )

    return TaleCache(
        schema_version=CACHE_SCHEMA_VERSION,
        metadata=metadata,
        source=normalized_source,
        words=word_entries,
        kernel_word_indices=kernel,
        positions=position_entries,
    )


def write_cache(
    path: Path,
    *,
    title: str,
    source_file: str,
    model_id: str,
    normalized_source: str,
    words: list[Word],
    positions: list,
    total_bits: float,
    token_count: int,
    generated_at: datetime | None = None,
) -> None:
    """Build the cache and write it to ``path`` as pretty-printed JSON.

    Raises ``ValueError`` if the per-position conservation invariant is
    violated. The file is only created on success.
    """

    cache = build_cache(
        title=title,
        source_file=source_file,
        model_id=model_id,
        normalized_source=normalized_source,
        words=words,
        positions=positions,
        total_bits=total_bits,
        token_count=token_count,
        generated_at=generated_at,
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        cache.model_dump_json(indent=2) + "\n",
        encoding="utf-8",
    )
