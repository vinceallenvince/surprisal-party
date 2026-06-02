/**
 * Right "predicted" strip — maps to frame 28-163 node 28:197 (Container).
 *
 * A 256px vertical panel with a faint uppercase heading. Empty for Step 1
 * (predicted-word tiles migrate in here in later steps). The heading's word
 * count is hard-coded to 0 to match the State 1 frame; Step 3 binds it.
 */

type PredictedStripProps = {
  count?: number;
};

export function PredictedStrip({ count = 0 }: PredictedStripProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-clip border-l border-seam bg-ground-strip pt-12 pr-6 pl-[25px]">
      <p className="text-[10px] tracking-[0.1em] whitespace-nowrap text-faint uppercase">
        Predicted ({count} {count === 1 ? 'word' : 'words'})
      </p>
    </aside>
  );
}
