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
        />
        <PredictedStrip tiles={rendered.removedTiles} />
      </div>
      <CompressionSlider
        selectedIndex={selectedIndex}
        onChange={onPositionChange}
      />
    </div>
  );
}
