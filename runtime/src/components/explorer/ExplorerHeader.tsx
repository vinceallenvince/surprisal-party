import { Info } from 'lucide-react';

/**
 * Explorer header — maps to frame 28-163 node 28:165 (Container).
 *
 * Left: corpus title + a small info icon immediately to its right.
 * Right: the conserved-quantity readout "stored 100% · predicted 0% ·
 * conserved 100%" with emphasized values.
 *
 * Static for Step 1: the info button is rendered but not yet wired (the
 * primer it re-summons arrives in Step 7).
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
};

export function ExplorerHeader({
  corpusTitle,
  storedPct,
  predictedPct,
  conservedPct,
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
            className="flex size-4 items-center justify-center text-muted"
          >
            <Info className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-start gap-6">
          <Readout label="stored" value={`${storedPct}%`} />
          <Readout label="predicted" value={`${predictedPct}%`} />
          <Readout label="conserved" value={`${conservedPct}%`} />
        </div>
      </div>
    </header>
  );
}
