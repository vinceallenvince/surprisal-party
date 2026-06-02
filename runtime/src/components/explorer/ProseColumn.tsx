import type { ProseItem } from '@/lib/tale-render';

/**
 * Middle prose column — maps to frame 28-163 nodes 28:191..28:196, in its
 * mid-compression form (frame 30-15994).
 *
 * Renders the survivor words of one cached position as a readable,
 * centered-measure column of body prose. Kernel words are coral
 * (`text-kernel`); each collapsed gap is a static thin seam between the
 * surviving tokens on either side — no hover, no reveal, no inspector text
 * (those arrive in Step 5). The 54px reserved band at the bottom (node
 * 28:196) is the future inspector's space, kept empty so nothing reflows.
 *
 * The inter-word separators are the literal `source` separators (spaces and
 * newlines), so paragraph breaks render faithfully. `whitespace-pre-wrap`
 * preserves the newlines that mark paragraph boundaries.
 */

type ProseColumnProps = {
  items: ProseItem[];
};

export function ProseColumn({ items }: ProseColumnProps) {
  return (
    <div className="flex min-h-0 min-w-0 grow flex-col">
      <div className="min-h-0 grow overflow-y-auto p-12">
        <p
          className="max-w-(--prose-measure) whitespace-pre-wrap text-prose"
          style={{
            fontSize: 'var(--prose-size)',
            lineHeight: 'var(--prose-leading)',
            letterSpacing: '-0.44px',
          }}
        >
          {items.map((item) =>
            item.kind === 'word' ? (
              <span key={`w${item.index}`} className={item.isKernel ? 'text-kernel' : undefined}>
                {item.text}
                {item.separator}
              </span>
            ) : (
              <span key={`s${item.gapId}`}>
                {/* Static seam marker (node 30-15994): a thin dim vertical
                    pipe between survivors. No hover / reveal / inspector —
                    that is Step 5. */}
                <span
                  aria-hidden="true"
                  className="mx-1.5 inline-block h-[0.85em] w-px translate-y-[0.1em] bg-faint align-baseline"
                />
                {item.separator}
              </span>
            ),
          )}
        </p>
      </div>
      {/* Reserved inspector band (node 28:196) — empty for Step 2. */}
      <div className="h-[54px] min-h-[54px] w-full shrink-0 border-t border-seam bg-ground-rail" />
    </div>
  );
}
