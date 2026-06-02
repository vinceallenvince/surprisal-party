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
 * is a controlled, mouse/pointer-only control. When the position changes the
 * prose column resets its scroll to the top (it is a fresh state) — done by
 * keying the prose region on the index so it remounts.
 */

type ExplorerShellProps = {
  corpusTitle: string;
  rendered: RenderedPosition;
  /** Currently selected slider stop index (0–4). */
  selectedIndex: number;
  /** Called with the nearest stop index when the user moves the slider. */
  onPositionChange: (index: number) => void;
};

export function ExplorerShell({
  corpusTitle,
  rendered,
  selectedIndex,
  onPositionChange,
}: ExplorerShellProps) {
  return (
    <div className="flex h-screen min-w-[1024px] flex-col overflow-hidden bg-ground">
      <ExplorerHeader
        corpusTitle={corpusTitle}
        storedPct={rendered.readout.storedPct}
        predictedPct={rendered.readout.predictedPct}
        conservedPct={rendered.readout.conservedPct}
      />
      <div className="flex min-h-0 grow">
        <CorpusRail />
        {/* Keyed on the position so a swap remounts the prose, resetting its
            scroll to the top (it is a new state). */}
        <ProseColumn key={selectedIndex} items={rendered.proseItems} />
        <PredictedStrip tiles={rendered.removedTiles} />
      </div>
      <CompressionSlider
        selectedIndex={selectedIndex}
        onChange={onPositionChange}
      />
    </div>
  );
}
