import { Info } from 'lucide-react';

/**
 * Explorer header — maps to frame 28-163 node 28:165 (Container).
 *
 * Left: corpus title + a small info icon immediately to its right.
 * Right: the readout "stored 100.0% · removed 0.0% · avg fidelity —" with
 * emphasized values. stored/removed are percentages shown to one decimal so the
 * early compression stops (which move only a fraction of a percent) are visibly
 * distinct rather than all reading 100.0 / 0.0.
 *
 * Naming note: the middle value's underlying datum is the cache's
 * `predicted_bits` (the prop stays `predictedPct`, matching the schema), but the
 * USER-FACING label is "removed" — the right strip shows the actual removed
 * words; the model's predictions live in the middle-column seams.
 *
 * Third metric: `avgFidelity` (0–1, 2 decimals) is the mean reconstruction
 * fidelity over the position's gaps — it falls as compression deepens, replacing
 * the old constant "conserved 100%". It is `null` at UNCOMPRESSED (no gaps to
 * score), rendered as an em dash.
 *
 * Two ⓘ buttons: the one beside the title re-summons the onboarding primer (via
 * `onShowPrimer`), at any time and regardless of the seen-flag; the one
 * immediately left of the metrics opens the metrics-explainer modal (via
 * `onShowMetrics`).
 */

type ReadoutProps = {
  label: string;
  value: string;
};

function Readout({ label, value }: ReadoutProps) {
  return (
    <span className="text-sm tracking-tight text-muted">
      {label} <span className="text-prose">{value}</span>
    </span>
  );
}

type ExplorerHeaderProps = {
  corpusTitle: string;
  storedPct: number;
  predictedPct: number;
  /** Mean reconstruction fidelity (0–1), or null at UNCOMPRESSED (no gaps). */
  avgFidelity: number | null;
  /** Re-summons the onboarding primer when the title ⓘ button is clicked. */
  onShowPrimer: () => void;
  /** Opens the metrics-explainer modal when the metrics ⓘ button is clicked. */
  onShowMetrics: () => void;
};

export function ExplorerHeader({
  corpusTitle,
  storedPct,
  predictedPct,
  avgFidelity,
  onShowPrimer,
  onShowMetrics,
}: ExplorerHeaderProps) {
  return (
    <header className="w-full border-b border-seam">
      <div className="flex items-center justify-between px-8 pt-4 pb-[17px]">
        <div className="flex items-center gap-4">
          <h1 className="text-sm tracking-tight whitespace-nowrap text-muted">
            {corpusTitle}
          </h1>
          <button
            type="button"
            aria-label="About surprisal"
            onClick={onShowPrimer}
            className="flex size-4 items-center justify-center text-muted"
          >
            <Info className="size-4" aria-hidden="true" />
          </button>
        </div>
        {/* Icon → first metric uses gap-4 to match the title → its-ⓘ gap above;
            the metrics themselves keep their own gap-6 rhythm in an inner group. */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="What the metrics mean"
            onClick={onShowMetrics}
            className="flex size-4 items-center justify-center text-muted"
          >
            <Info className="size-4" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-6">
            <Readout label="stored" value={`${storedPct.toFixed(1)}%`} />
            <Readout label="removed" value={`${predictedPct.toFixed(1)}%`} />
            <Readout
              label="avg fidelity"
              value={avgFidelity === null ? '—' : avgFidelity.toFixed(2)}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
