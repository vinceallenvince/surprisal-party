import type { RemovedTile } from '@/lib/tale-render';

/**
 * Right "predicted" strip — maps to frame 28-163 node 28:197, in its
 * mid-compression form (frame 30-15994).
 *
 * Renders the words removed at the current position as faded fixed-width
 * (mono) tiles packed into the strip as a dense mass, with the heading count
 * reflecting how many migrated. Tiles render statically (no entrance
 * animation); the heading stays pinned and the tile mass scrolls if it
 * overflows.
 */

type PredictedStripProps = {
  tiles: RemovedTile[];
};

export function PredictedStrip({ tiles }: PredictedStripProps) {
  const count = tiles.length;
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-hidden border-l border-seam bg-ground-strip pt-12 pr-6 pl-[25px]">
      <p className="shrink-0 text-[10px] tracking-[0.1em] whitespace-nowrap text-faint uppercase">
        Predicted ({count} {count === 1 ? 'word' : 'words'})
      </p>
      <div className="mt-4 flex min-h-0 grow flex-wrap content-start gap-1 overflow-y-auto pb-4">
        {tiles.map((tile) => (
          <span
            key={tile.index}
            className="rounded-sm bg-seam/40 px-1.5 py-0.5 font-mono text-[11px] leading-tight whitespace-nowrap text-faint"
          >
            {tile.text}
          </span>
        ))}
      </div>
    </aside>
  );
}
