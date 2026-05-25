"""Select N fixed surprisal thresholds for the slider's discrete positions.

The slider exposes a small number of precomputed states. Each state is defined
by a surprisal threshold: words whose surprisal is *below* the threshold are
candidates for removal; words at or above the threshold survive.

The lowest threshold leaves the full text visible (no words below it). The
highest threshold leaves only the kernel — the small set of highest-surprisal
load-bearing words.

Phase 0 uses percentile-based threshold selection over the source's per-word
surprisals. By default we pick five percentiles spanning the distribution
(0, 25, 50, 75, ~95). The top percentile is capped at 95 rather than 100 so
the kernel is small but non-empty.
"""

from __future__ import annotations

from cprediction.reconciliation import Word


_DEFAULT_PERCENTILES: tuple[float, ...] = (0.0, 25.0, 50.0, 75.0, 95.0)


def _percentile(sorted_values: list[float], pct: float) -> float:
    """Linear-interpolation percentile of an already-sorted list.

    `pct` is in [0, 100]. We use linear interpolation between order statistics
    (the "C=1" convention) so percentile=0 returns the min and percentile=100
    returns the max.
    """

    if not sorted_values:
        raise ValueError("Cannot take a percentile of an empty sequence.")
    if pct <= 0:
        return sorted_values[0]
    if pct >= 100:
        return sorted_values[-1]
    n = len(sorted_values)
    rank = (pct / 100.0) * (n - 1)
    lo = int(rank)
    hi = min(lo + 1, n - 1)
    frac = rank - lo
    return sorted_values[lo] * (1 - frac) + sorted_values[hi] * frac


def select_thresholds(
    words: list[Word],
    n: int = 5,
    percentiles: tuple[float, ...] | None = None,
) -> list[float]:
    """Choose N surprisal thresholds spanning the distribution.

    Returns thresholds in ascending order. The lowest leaves the full text
    visible (it equals the minimum word surprisal, so nothing is strictly
    below it); the highest is at the 95th percentile by default so the kernel
    is small but non-empty.

    `words` may include empty-core entries (whitespace-only inputs); those are
    skipped so they do not contaminate the distribution. Words with zero
    surprisal are kept — they are legitimately the most predictable words.

    Args:
        words: per-word surprisal list from `reconcile()`.
        n: number of thresholds. Must match `len(percentiles)` when both are
            given. Defaults to 5.
        percentiles: explicit percentile points in [0, 100], ascending. If
            omitted, uses (0, 25, 50, 75, 95) when `n == 5`, otherwise spaces
            evenly from 0 to 95.

    Raises:
        ValueError: on empty input, mismatched n/percentiles, or non-ascending
            percentiles.
    """

    candidates = [w.surprisal for w in words if not w.is_empty_core]
    if not candidates:
        raise ValueError("No non-empty words to derive thresholds from.")
    if percentiles is None:
        if n == 5:
            percentiles = _DEFAULT_PERCENTILES
        elif n == 1:
            percentiles = (0.0,)
        else:
            step = 95.0 / (n - 1)
            percentiles = tuple(step * i for i in range(n))
    if len(percentiles) != n:
        raise ValueError(
            f"percentiles has length {len(percentiles)} but n={n}."
        )
    for a, b in zip(percentiles, percentiles[1:]):
        if b < a:
            raise ValueError("percentiles must be non-descending.")
    sorted_vals = sorted(candidates)
    return [_percentile(sorted_vals, p) for p in percentiles]
