#!/usr/bin/env python3
"""Render the reconstructed reading text for a cache at one slider position.

This is the "page" a reader would see: surviving words verbatim, each removed
gap replaced in place by the model's predicted text (wrapped in ⟦…⟧ so you can
see what was reconstructed vs what survived). Pure stdlib — reads the cache JSON
directly, no model. Use it to judge how the reconstructions READ, rather than by
per-gap token fidelity.

Usage:
    python scripts/render_reading.py CACHE.json POSITION [--limit-words N]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("cache", help="tale-cache JSON")
    ap.add_argument("position", type=int, help="slider position index (0..n-1)")
    ap.add_argument(
        "--limit-words",
        type=int,
        default=0,
        help="stop after roughly N source words (0 = whole text)",
    )
    args = ap.parse_args()

    cache = json.loads(Path(args.cache).read_text(encoding="utf-8"))
    pos = cache["positions"][args.position]

    gap_by_word: dict[int, dict] = {}
    for g in pos["gaps"]:
        for wi in g["word_indices"]:
            gap_by_word[wi] = g

    parts: list[str] = []
    emitted: set[int] = set()
    seen_words = 0
    for w in cache["words"]:
        if w["is_empty_core"]:
            continue
        seen_words += 1
        if args.limit_words and seen_words > args.limit_words:
            parts.append("…")
            break
        idx = w["index"]
        g = gap_by_word.get(idx)
        if g is not None:
            if g["id"] not in emitted:
                parts.append(f"⟦{g['predicted_text']}⟧")
                emitted.add(g["id"])
            # removed word itself is not printed
        else:
            parts.append(w["core"] + w["trailing_punct"])

    print(
        f"# {cache['metadata']['title']}  ·  position {args.position} "
        f"(threshold {pos['threshold']:.3f}, "
        f"removed {pos['words_removed']}/{pos['words_removed'] + pos['words_remaining']} words)"
    )
    print()
    print(" ".join(parts))


if __name__ == "__main__":
    main()
