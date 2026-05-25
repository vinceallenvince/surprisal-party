"""Phase 0 end-to-end run: normalize -> score -> reconcile -> threshold -> gaps -> reconstruct.

Reads one source text, runs the full pipeline, and emits a hand-readable
Markdown artifact for the eyeball-test exit criterion.

Usage:
    cd pipeline && python -m cprediction.run

Defaults to ``corpus/little-red-riding-hood.txt`` and writes
``output/little-red-riding-hood.md``. Override via CLI args (positional:
input path, output path).
"""

from __future__ import annotations

import math
import os
import sys
from dataclasses import dataclass
from pathlib import Path

from cprediction._model import MODEL_ID
from cprediction.cache import build_cache
from cprediction.fidelity import fidelity
from cprediction.reconciliation import Word, reconcile
from cprediction.reconstruct import reconstruct
from cprediction.score import score
from cprediction.spans import Gap, find_gaps
from cprediction.thresholds import select_thresholds


_DEFAULT_INPUT = Path(__file__).resolve().parent.parent / "corpus" / "little-red-riding-hood.txt"
_DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "output" / "little-red-riding-hood.md"

_CONTEXT_CHARS = 200  # how much surviving text to send as left/right context to reconstruct()


@dataclass
class GapResult:
    """One gap at one threshold position with the model's reconstruction."""

    gap: Gap
    actual: str
    predicted: str
    fidelity_score: float


@dataclass
class PositionResult:
    """All results for a single slider position (one threshold)."""

    position: int
    threshold: float
    words_remaining: int
    words_removed: int
    gaps: list[GapResult]
    stored_bits: float
    predicted_bits: float


def _gap_text(words: list[Word], gap: Gap, source: str) -> str:
    """The source slice corresponding to this gap, verbatim."""
    start = words[gap.start_index].char_start
    end = words[gap.end_index].char_end
    return source[start:end]


def _surviving_text_with_placeholders(
    words: list[Word],
    gaps: list[Gap],
    source: str,
) -> str:
    """Render the source with each gap collapsed to a `<gap N>` placeholder.

    Anchored terminal punctuation on the gap's last word is preserved.
    """
    in_gap = {i: None for i in range(len(words))}
    for idx, g in enumerate(gaps):
        for wi in g.word_indices:
            in_gap[wi] = idx
    parts: list[str] = []
    last_end = 0
    skip_until = -1
    for wi, w in enumerate(words):
        if w.is_empty_core:
            continue
        if in_gap[wi] is not None and wi > skip_until:
            # This is the first word of a gap (or we're resuming).
            gap_idx = in_gap[wi]
            gap = gaps[gap_idx]
            # Emit any inter-word source chars (whitespace) before the gap starts.
            parts.append(source[last_end : w.char_start])
            parts.append(f"<gap {gap_idx + 1}>")
            # Anchor terminal punctuation if the gap's last word has it.
            last_word = words[gap.end_index]
            if last_word.is_terminal_punct:
                parts.append(last_word.trailing_punct)
            last_end = last_word.char_end
            skip_until = gap.end_index
        elif in_gap[wi] is None:
            parts.append(source[last_end : w.char_end])
            last_end = w.char_end
    # Trailing whitespace after the last word.
    parts.append(source[last_end:])
    return "".join(parts)


def _left_right_context(
    source: str,
    words: list[Word],
    gap: Gap,
    radius: int = _CONTEXT_CHARS,
) -> tuple[str, str]:
    start = words[gap.start_index].char_start
    end = words[gap.end_index].char_end
    left = source[max(0, start - radius) : start]
    right = source[end : end + radius]
    return left, right


def _percent(numerator: float, denominator: float) -> str:
    if denominator <= 0:
        return "0.0%"
    return f"{(numerator / denominator) * 100:.1f}%"


def run(input_path: Path = _DEFAULT_INPUT, output_path: Path = _DEFAULT_OUTPUT) -> Path:
    """Execute the full Phase 0 pipeline and write the Markdown artifact.

    Returns the output path.
    """

    raw = input_path.read_text(encoding="utf-8")
    print(f"[run] read {len(raw):,} chars from {input_path}", file=sys.stderr)

    print(f"[run] loading {MODEL_ID}...", file=sys.stderr)
    print(f"[run] scoring with {MODEL_ID}...", file=sys.stderr)
    normalized, tokens = score(raw)
    print(
        f"[run] received {len(tokens):,} tokens, total surprisal "
        f"{sum(t.surprisal for t in tokens):.1f} bits",
        file=sys.stderr,
    )

    words = reconcile(normalized, tokens)
    real_words = [w for w in words if not w.is_empty_core]
    total_bits = sum(w.surprisal for w in real_words)
    print(
        f"[run] reconciled to {len(real_words):,} words, total {total_bits:.1f} bits",
        file=sys.stderr,
    )

    thresholds = select_thresholds(words, n=5)
    print(f"[run] thresholds = {[round(t, 3) for t in thresholds]}", file=sys.stderr)

    positions: list[PositionResult] = []
    for pos_idx, threshold in enumerate(thresholds):
        gaps = find_gaps(words, threshold=threshold, max_gap_words=35)
        removed_word_count = sum(len(g.word_indices) for g in gaps)
        words_remaining = len(real_words) - removed_word_count
        # Compute predicted_bits and stored_bits *independently* so the
        # "stored + predicted == total" column is a genuine invariant rather
        # than a subtraction tautology. predicted_bits sums surprisals of
        # words inside any gap; stored_bits sums surprisals of words that
        # survive at this slider position. Drift here means something is
        # wrong upstream (e.g., gap word-index overlap), so we assert it.
        gap_word_ids: set[int] = {
            wi for g in gaps for wi in g.word_indices
        }
        predicted_bits = sum(words[wi].surprisal for wi in gap_word_ids)
        stored_bits = sum(
            w.surprisal
            for i, w in enumerate(words)
            if not w.is_empty_core and i not in gap_word_ids
        )
        assert math.isclose(
            stored_bits + predicted_bits, total_bits, rel_tol=1e-9, abs_tol=1e-6
        ), (
            f"conservation violated at position {pos_idx}: "
            f"stored={stored_bits} + predicted={predicted_bits} != total={total_bits}"
        )
        print(
            f"[run] position {pos_idx} threshold={threshold:.3f} "
            f"gaps={len(gaps)} removed_words={removed_word_count} "
            f"stored_bits={stored_bits:.1f} predicted_bits={predicted_bits:.1f}",
            file=sys.stderr,
        )

        gap_results: list[GapResult] = []
        for g_idx, gap in enumerate(gaps):
            actual = _gap_text(words, gap, normalized)
            left, right = _left_right_context(normalized, words, gap)
            predicted = reconstruct(
                left, right, expected_words=len(gap.word_indices)
            )
            f = fidelity(predicted, actual)
            gap_results.append(
                GapResult(
                    gap=gap, actual=actual, predicted=predicted, fidelity_score=f
                )
            )
            print(
                f"[run]   gap {g_idx + 1}/{len(gaps)} "
                f"({len(gap.word_indices)} words) fidelity={f:.2f}",
                file=sys.stderr,
            )

        positions.append(
            PositionResult(
                position=pos_idx,
                threshold=threshold,
                words_remaining=words_remaining,
                words_removed=removed_word_count,
                gaps=gap_results,
                stored_bits=stored_bits,
                predicted_bits=predicted_bits,
            )
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    title = _title_from_path(input_path)
    json_path = output_path.with_suffix(".json")

    # Build the cache BEFORE any file write. ``build_cache`` re-asserts the
    # per-position conservation invariant; if it raises, neither the .md nor
    # the .json on disk is touched, so any prior successful pair survives as a
    # stale-but-consistent snapshot.
    cache = build_cache(
        title=title,
        source_file=str(input_path),
        model_id=MODEL_ID,
        normalized_source=normalized,
        words=words,
        positions=positions,
        total_bits=total_bits,
        token_count=len(tokens),
    )
    markdown = _render_markdown(normalized, words, positions, total_bits, title)

    # Temp-and-rename for both artifacts: ``os.replace`` is atomic on POSIX,
    # so a torn write (disk pressure, interrupt) cannot leave a half-formed
    # file in either location, and the .md / .json pair stays consistent.
    try:
        _atomic_write_text(output_path, markdown)
        _atomic_write_text(
            json_path, cache.model_dump_json(indent=2) + "\n"
        )
    except OSError as e:
        print(
            f"[run] write failed ({e}); prior artifacts (if any) are unchanged",
            file=sys.stderr,
        )
        raise
    print(f"[run] wrote {output_path} and {json_path}", file=sys.stderr)
    return output_path


def _atomic_write_text(path: Path, content: str) -> None:
    """Write ``content`` to ``path`` atomically via temp-file + ``os.replace``.

    The temp file lives in the same directory so the rename is on one
    filesystem. On failure of either step, any pre-existing file at ``path``
    is unchanged and the temp file is cleaned up (no orphan ``.tmp`` left
    behind for the next run to step on).
    """

    tmp = path.with_suffix(path.suffix + ".tmp")
    try:
        tmp.write_text(content, encoding="utf-8")
        os.replace(tmp, path)
    except OSError:
        tmp.unlink(missing_ok=True)
        raise


_TITLE_LOWERCASE_WORDS: frozenset[str] = frozenset(
    {"a", "an", "and", "at", "but", "for", "in", "of", "on", "or", "the", "to"}
)


def _title_from_path(path: Path) -> str:
    """Derive a display title from a corpus filename.

    `little-red-riding-hood.txt` -> `Little Red Riding Hood`;
    `hansel-and-gretel.txt` -> `Hansel and Gretel`. Hyphens and
    underscores become spaces; the first word is always capitalized and
    subsequent words are capitalized except for a small set of articles
    and conjunctions that conventionally stay lowercase in English titles.
    """

    raw = path.stem.replace("-", " ").replace("_", " ")
    words = raw.split()
    return " ".join(
        w.lower() if i > 0 and w.lower() in _TITLE_LOWERCASE_WORDS else w.capitalize()
        for i, w in enumerate(words)
    )


def _render_markdown(
    source: str,
    words: list[Word],
    positions: list[PositionResult],
    total_bits: float,
    title: str,
) -> str:
    real_words = [w for w in words if not w.is_empty_core]
    lines: list[str] = []
    lines.append(f"# Phase 0 end-to-end run: {title}\n")
    lines.append(f"Reference model: `{MODEL_ID}`")
    lines.append("")
    lines.append(f"- Source words: **{len(real_words):,}**")
    lines.append(f"- Total surprisal (stored + predicted): **{total_bits:.1f} bits**")
    lines.append("")

    # Summary table.
    lines.append("## Summary")
    lines.append("")
    lines.append(
        "| Pos | Threshold (bits) | Words remaining | Words removed | "
        "Stored bits | Predicted bits | Conserved total |"
    )
    lines.append("|----:|-----------------:|----------------:|--------------:|------------:|---------------:|----------------:|")
    for p in positions:
        conserved = p.stored_bits + p.predicted_bits
        lines.append(
            f"| {p.position} | {p.threshold:.3f} | "
            f"{p.words_remaining} ({_percent(p.words_remaining, len(real_words))}) | "
            f"{p.words_removed} ({_percent(p.words_removed, len(real_words))}) | "
            f"{p.stored_bits:.1f} | {p.predicted_bits:.1f} | {conserved:.1f} |"
        )
    lines.append("")

    for p in positions:
        lines.append(f"## Position {p.position} — threshold {p.threshold:.3f} bits\n")
        avg_gap = (
            sum(len(g.gap.word_indices) for g in p.gaps) / len(p.gaps)
            if p.gaps
            else 0.0
        )
        lines.append(
            f"- Gaps: **{len(p.gaps)}** · words remaining "
            f"**{p.words_remaining}** · avg gap length **{avg_gap:.1f}** words"
        )
        lines.append(
            f"- Stored **{p.stored_bits:.1f}** bits · predicted "
            f"**{p.predicted_bits:.1f}** bits"
        )
        lines.append("")
        lines.append("### Surviving text")
        lines.append("")
        lines.append("```text")
        lines.append(_surviving_text_with_placeholders(words, [g.gap for g in p.gaps], source))
        lines.append("```")
        lines.append("")
        if p.gaps:
            lines.append("### Gaps")
            lines.append("")
            for i, gr in enumerate(p.gaps, start=1):
                lines.append(f"**Gap {i}** ({len(gr.gap.word_indices)} words, fidelity {gr.fidelity_score:.2f})")
                lines.append("")
                lines.append(f"- Actual: `{gr.actual.strip()}`")
                lines.append(f"- Predicted: `{gr.predicted.strip()}`")
                lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    in_path = Path(argv[0]) if len(argv) >= 1 else _DEFAULT_INPUT
    out_path = Path(argv[1]) if len(argv) >= 2 else _DEFAULT_OUTPUT
    run(in_path, out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
