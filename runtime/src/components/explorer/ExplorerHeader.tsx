import { Info } from 'lucide-react';

/**
 * Explorer header — maps to frame 28-163 node 28:165 (Container).
 *
 * Left: corpus title + a small info icon immediately to its right.
 * Right: the conserved-quantity readout "stored 100.0% · removed 0.0% ·
 * conserved 100.0%" with emphasized values. Percentages are shown to one
 * decimal so the early compression stops (which move only a fraction of a
 * percent) are visibly distinct rather than all reading 100.0 / 0.0.
 *
 * Naming note: the middle value's underlying datum is the cache's
 * `predicted_bits` (the prop stays `predictedPct`, matching the schema), but the
 * USER-FACING label is "removed" — the right strip shows the actual removed
 * words; the model's predictions live in the middle-column seams.
 *
 * Step 6 wires the info button: clicking it re-summons the onboarding primer
 * (via `onShowPrimer`), at any time and regardless of the seen-flag.
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
  conservedPct: number;
  /** Re-summons the onboarding primer when the ⓘ button is clicked. */
  onShowPrimer: () => void;
};

export function ExplorerHeader({
  corpusTitle,
  storedPct,
  predictedPct,
  conservedPct,
  onShowPrimer,
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
        <div className="flex items-start gap-6">
          <Readout label="stored" value={`${storedPct.toFixed(1)}%`} />
          <Readout label="removed" value={`${predictedPct.toFixed(1)}%`} />
          <Readout label="conserved" value={`${conservedPct.toFixed(1)}%`} />
        </div>
      </div>
    </header>
  );
}
