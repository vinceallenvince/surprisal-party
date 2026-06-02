import { ExplorerHeader } from './ExplorerHeader';
import { CorpusRail } from './CorpusRail';
import { ProseColumn } from './ProseColumn';
import { PredictedStrip } from './PredictedStrip';
import { CompressionSlider } from './CompressionSlider';

/**
 * Static three-region explorer shell — frame 28-163 (returning-visitor
 * State 1). Composition, top to bottom:
 *
 *   - ExplorerHeader   (title + info icon + readout)        node 28:165
 *   - content row:
 *       CorpusRail     (left picker rail)                   node 28:182
 *       ProseColumn    (middle prose + reserved inspector)  node 28:191
 *       PredictedStrip (right strip, empty)                 node 28:197
 *   - CompressionSlider (bottom track + labels)             node 28:202
 *
 * No data binding, no interactivity — Step 1 scope only. Min-width 1024px per
 * the desktop/tablet envelope; below that the shell still renders (the
 * "best viewed on desktop" gate is Phase 3).
 */
export function ExplorerShell() {
  return (
    <div className="flex h-screen min-w-[1024px] flex-col overflow-hidden bg-ground">
      <ExplorerHeader corpusTitle="Little Red Riding Hood" />
      <div className="flex min-h-0 grow">
        <CorpusRail />
        <ProseColumn />
        <PredictedStrip />
      </div>
      <CompressionSlider />
    </div>
  );
}
