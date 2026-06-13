import type { RemovedTile } from '@/lib/tale-render';

/**
 * Right "removed" strip — maps to frame 28-163 node 28:197, in its
 * mid-compression form (frame 30-15994).
 *
 * Renders the words removed at the current position as faded fixed-width
 * (mono) tiles packed into the strip as a dense mass, with the heading count
 * reflecting how many migrated. These are the ACTUAL removed words (the ground
 * truth taken out), NOT the model's predictions — the prediction for each gap
 * is what appears in the middle column's seam when a tile is clicked. Hence the
 * "Removed" label (matching the header readout). Tiles render statically (no
 * entrance animation); the heading stays pinned and the tile mass scrolls if it
 * overflows.
 *
 * Each tile is a real `<button>`: clicking it (or activating it from the
 * keyboard) calls `onTileActivate(tile.gapId)`, which the shell turns into a
 * seam-activation request for the middle column — revealing that word's
 * predicted phrase exactly as the keyboard walk would. Tiles also gain a hover
 * rollover where the text turns white. No sound fires from the click path (the
 * keyboard walk owns the click sounds).
 */

type PredictedStripProps = {
  tiles: RemovedTile[];
  /** Called with a tile's gap id when the tile is clicked/activated. */
  onTileActivate: (gapId: number) => void;
  /**
   * Gap ids of the currently active seam (from the keyboard walk or a tile
   * click), reported up by ProseColumn. Tiles whose `gapId` is in this set are
   * highlighted, so walking the seams lights up the matching removed words.
   */
  activeGapIds?: number[] | null;
};

export function PredictedStrip({
  tiles,
  onTileActivate,
  activeGapIds,
}: PredictedStripProps) {
  const count = tiles.length;
  const activeSet = activeGapIds ? new Set(activeGapIds) : null;
  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col overflow-hidden border-l border-seam bg-ground-strip pt-12 pr-6 pl-[25px] md:flex">
      <p className="shrink-0 text-[10px] tracking-[0.1em] whitespace-nowrap text-faint uppercase">
        Removed ({count} {count === 1 ? 'word' : 'words'})
      </p>
      <div className="mt-4 flex min-h-0 grow flex-wrap content-start gap-1 overflow-y-auto pb-4">
        {tiles.map((tile) => {
          const active = activeSet?.has(tile.gapId) ?? false;
          return (
            <button
              key={tile.index}
              type="button"
              aria-label={`Reveal prediction for "${tile.text}"`}
              data-active={active}
              onClick={() => onTileActivate(tile.gapId)}
              className={`cursor-pointer rounded-sm px-1.5 py-0.5 font-mono text-[11px] leading-tight whitespace-nowrap transition-colors outline-none hover:bg-seam/60 hover:text-prose focus-visible:ring-2 focus-visible:ring-kernel motion-reduce:transition-none ${
                active ? 'bg-kernel/25 text-prose' : 'bg-seam/40 text-faint'
              }`}
            >
              {tile.text}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
