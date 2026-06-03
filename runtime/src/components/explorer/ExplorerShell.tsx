'use client';

import { useCallback, useState } from 'react';
import { ExplorerHeader } from './ExplorerHeader';
import { CorpusRail } from './CorpusRail';
import { ProseColumn } from './ProseColumn';
import { PredictedStrip } from './PredictedStrip';
import { CompressionSlider } from './CompressionSlider';
import type { RenderedPosition } from '@/lib/tale-render';

/**
 * Static three-region explorer shell — frame 28-163 (returning-visitor
 * State 1), shown here in its mid-compression form (frame 30-15994).
 * Composition, top to bottom:
 *
 *   - ExplorerHeader   (title + info icon + readout)        node 28:165
 *   - content row:
 *       CorpusRail     (left picker rail)                   node 28:182
 *       ProseColumn    (middle prose + reserved inspector)  node 28:191
 *       PredictedStrip (right strip, tiles)                 node 28:197
 *   - CompressionSlider (bottom track + labels)             node 28:202
 *
 * Layout invariant (preserved from Step 1): `h-screen`, header + slider
 * pinned, the prose column is the *sole* internal scroll region (`min-h-0` +
 * `overflow-y-auto` inside ProseColumn).
 *
 * Step 3 wires the slider: the parent owns `selectedIndex` and passes the
 * matching `rendered` position plus an `onPositionChange` callback. The slider
 * is a controlled, mouse/pointer-only control.
 *
 * Step 4 (state transition, prototype-faithful): the prose column must NOT be
 * remounted on a position swap — the transition is a CSS `transition-colors`
 * crossfade on index-keyed word spans, which needs the DOM slots to persist
 * across renders. So the `key={selectedIndex}` that Step 3 used to reset scroll
 * is removed; ProseColumn keeps its scroll across swaps. See the note there.
 *
 * Tile → seam reveal: the shell is the natural shared owner of `ProseColumn`
 * and `PredictedStrip`, so it holds the seam-activation request. Clicking a
 * predicted tile calls `onTileActivate(gapId)`, which bumps a request
 * `{ gapId, nonce }`; the nonce is a monotonically increasing counter (NOT
 * Date.now/Math.random — banned + nondeterministic) so re-clicking the SAME
 * tile after Esc clears the seam still re-triggers. `ProseColumn` consumes the
 * request via the "adjust state during render" pattern and activates the
 * matching seam (then auto-scrolls it into view through its existing effect).
 *
 * Seam → tiles highlight (the reverse): `ProseColumn` reports the active seam's
 * gap ids up via `onActiveSeamChange`; the shell holds them and passes them to
 * `PredictedStrip`, which highlights the tiles whose `gapId` matches. So walking
 * the seams (keyboard) — or clicking a tile — lights up the corresponding
 * removed words in the strip.
 */

type ExplorerShellProps = {
  corpusTitle: string;
  rendered: RenderedPosition;
  /** Currently selected slider stop index (0–4). */
  selectedIndex: number;
  /** How many seams flash open per swap (fewer as compression deepens). */
  revealCount: number;
  /** Fraction (0–1) of the seams the reveal pool is drawn from. */
  selectFraction: number;
  /** Called with the nearest stop index when the user moves the slider. */
  onPositionChange: (index: number) => void;
  /** Re-summons the onboarding primer (wired to the header ⓘ button). */
  onShowPrimer: () => void;
  /** Whether the corpus-picker drawer is open (drives the rail's aria-expanded). */
  drawerOpen: boolean;
  /** Toggles the corpus-picker drawer (wired to the rail icon). */
  onToggleDrawer: () => void;
};

export function ExplorerShell({
  corpusTitle,
  rendered,
  selectedIndex,
  revealCount,
  selectFraction,
  onPositionChange,
  onShowPrimer,
  drawerOpen,
  onToggleDrawer,
}: ExplorerShellProps) {
  // Seam-activation request raised by clicking a predicted tile. The nonce is a
  // plain incrementing counter so the same tile can be re-clicked and re-fire
  // (e.g. after Esc clears the seam) — deterministic, no Date.now/Math.random.
  const [seamRequest, setSeamRequest] = useState<{
    gapId: number;
    nonce: number;
  } | null>(null);

  // The active seam's gap ids, reported up by ProseColumn, used to highlight the
  // matching removed-word tiles. Stable setter (useState) — passed straight to
  // ProseColumn's effect-driven `onActiveSeamChange`.
  const [activeGapIds, setActiveGapIds] = useState<number[] | null>(null);
  const handleActiveSeamChange = useCallback(
    (gapIds: number[] | null) => setActiveGapIds(gapIds),
    [],
  );

  return (
    <div className="flex h-screen min-w-[1024px] flex-col overflow-hidden bg-ground">
      <ExplorerHeader
        corpusTitle={corpusTitle}
        storedPct={rendered.readout.storedPct}
        predictedPct={rendered.readout.predictedPct}
        conservedPct={rendered.readout.conservedPct}
        onShowPrimer={onShowPrimer}
      />
      <div className="flex min-h-0 grow">
        <CorpusRail expanded={drawerOpen} onToggle={onToggleDrawer} />
        {/* No `key` here on purpose: remounting would reset the DOM slots and
            kill the Step 4 transition-colors crossfade. ProseColumn keeps its
            identity across position swaps. */}
        <ProseColumn
          items={rendered.proseItems}
          streamKey={selectedIndex}
          revealCount={revealCount}
          selectFraction={selectFraction}
          seamRequest={seamRequest}
          onActiveSeamChange={handleActiveSeamChange}
        />
        <PredictedStrip
          tiles={rendered.removedTiles}
          activeGapIds={activeGapIds}
          onTileActivate={(gapId) =>
            setSeamRequest((r) => ({ gapId, nonce: (r?.nonce ?? 0) + 1 }))
          }
        />
      </div>
      <CompressionSlider
        selectedIndex={selectedIndex}
        onChange={onPositionChange}
      />
    </div>
  );
}
