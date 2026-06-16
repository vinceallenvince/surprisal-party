#!/usr/bin/env python3
"""Compare two tale-cache JSONs gap-by-gap — for A/B-ing reconstruction strategies.

The thresholds (and therefore the gaps) are produced by surprisal scoring, which
is identical across reconstruction strategies, so two caches for the same corpus
share the same positions and gaps; only ``predicted_text`` and ``fidelity``
differ. This prints per-position mean fidelity for each cache, the delta, an
overall micro-average over all gaps, and a few side-by-side example gaps so the
reconstructions can be eyeballed.

Usage (from repo root or pipeline/):
    python scripts/compare_reconstructions.py BASELINE.json VARIANT.json
    python scripts/compare_reconstructions.py base.json var.json --examples 3
    python scripts/compare_reconstructions.py base.json var.json --all
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import mean


def _load(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _gap_fids(position: dict) -> list[float]:
    return [g["fidelity"] for g in position["gaps"]]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("baseline", help="baseline cache JSON")
    ap.add_argument("variant", help="variant cache JSON")
    ap.add_argument(
        "--examples",
        type=int,
        default=2,
        help="example gaps to print per position (default 2)",
    )
    ap.add_argument(
        "--all", action="store_true", help="print every gap, not just examples"
    )
    args = ap.parse_args()

    base = _load(args.baseline)
    var = _load(args.variant)

    title = base["metadata"]["title"]
    print(f"Corpus: {title}")
    print(f"  baseline: {args.baseline}  (model {base['metadata']['model_id']})")
    print(f"  variant:  {args.variant}  (model {var['metadata']['model_id']})")
    print()

    bpos = {p["index"]: p for p in base["positions"]}
    vpos = {p["index"]: p for p in var["positions"]}
    shared = sorted(set(bpos) & set(vpos))

    print("Per-position mean fidelity (higher = closer to the original):")
    print(f"  {'pos':>3}  {'thr':>7}  {'gaps':>4}  {'baseline':>8}  "
          f"{'variant':>8}  {'delta':>7}")
    all_b: list[float] = []
    all_v: list[float] = []
    for i in shared:
        b, v = bpos[i], vpos[i]
        fb, fv = _gap_fids(b), _gap_fids(v)
        all_b += fb
        all_v += fv
        mb = mean(fb) if fb else 0.0
        mv = mean(fv) if fv else 0.0
        n = max(len(fb), len(fv))
        flag = "" if len(fb) == len(fv) else f"  (!gap count {len(fb)} vs {len(fv)})"
        print(f"  {i:>3}  {b['threshold']:>7.3f}  {n:>4}  {mb:>8.3f}  "
              f"{mv:>8.3f}  {mv - mb:>+7.3f}{flag}")

    ob = mean(all_b) if all_b else 0.0
    ov = mean(all_v) if all_v else 0.0
    print()
    print(f"  Overall micro-avg over {len(all_b)} gaps:  "
          f"baseline {ob:.3f}   variant {ov:.3f}   delta {ov - ob:+.3f}")
    print()

    # Side-by-side example gaps.
    print("Example gaps (actual vs each strategy's prediction):")
    for i in shared:
        b, v = bpos[i], vpos[i]
        bg = {g["id"]: g for g in b["gaps"]}
        vg = {g["id"]: g for g in v["gaps"]}
        ids = sorted(set(bg) & set(vg))
        if not args.all:
            ids = ids[: args.examples]
        if not ids:
            continue
        print(f"\n── position {i} (threshold {b['threshold']:.3f}) ──")
        for gid in ids:
            gb, gv = bg[gid], vg[gid]
            print(f"  [gap {gid}]")
            print(f"    actual   : {gb['actual_text']!r}")
            print(f"    baseline : {gb['predicted_text']!r}  (fid {gb['fidelity']:.2f})")
            print(f"    variant  : {gv['predicted_text']!r}  (fid {gv['fidelity']:.2f})")


if __name__ == "__main__":
    main()
