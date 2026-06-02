import { PLACEHOLDER_PROSE } from './placeholder-prose';

/**
 * Middle prose column — maps to frame 28-163 nodes 28:191..28:196.
 *
 * A readable, centered-measure column of body prose with kernel tokens
 * highlighted in coral. The 54px-tall reserved band at the bottom (node
 * 28:196) is the future reconstruction inspector's reserved space — kept here
 * so nothing reflows when later steps fill it.
 *
 * NO data binding yet: text comes from the static PLACEHOLDER_PROSE stand-in.
 */
export function ProseColumn() {
  return (
    <div className="flex min-h-0 min-w-0 grow flex-col">
      <div className="min-h-0 grow overflow-y-auto p-12">
        <p
          className="max-w-(--prose-measure) text-prose"
          style={{
            fontSize: 'var(--prose-size)',
            lineHeight: 'var(--prose-leading)',
            letterSpacing: '-0.44px',
          }}
        >
          {PLACEHOLDER_PROSE.map((token, i) =>
            token.kernel ? (
              <span key={i} className="text-kernel">
                {token.text}
              </span>
            ) : (
              <span key={i}>{token.text}</span>
            ),
          )}
        </p>
      </div>
      {/* Reserved inspector band (node 28:196) — empty for Step 1. */}
      <div className="h-[54px] min-h-[54px] w-full shrink-0 border-t border-seam bg-ground-rail" />
    </div>
  );
}
