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
 * Step 2 binds one fixed cached position; the slider is non-interactive (its
 * thumb only reflects the position). Slider interactivity is Step 3.
 */

type ExplorerShellProps = {
  corpusTitle: string;
  rendered: RenderedPosition;
  /** Thumb position as a percentage along the track (0–100). */
  thumbPct: number;
};

export function ExplorerShell({
  corpusTitle,
  rendered,
  thumbPct,
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
        <ProseColumn items={rendered.proseItems} />
        <PredictedStrip tiles={rendered.removedTiles} />
      </div>
      <CompressionSlider thumbPct={thumbPct} />
    </div>
  );
}
