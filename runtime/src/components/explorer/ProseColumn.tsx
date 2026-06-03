'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ProseItem } from '@/lib/tale-render';

/**
 * Middle prose column — maps to frame 28-163 nodes 28:191..28:196, in its
 * mid-compression form (frame 30-15994).
 *
 * Renders the survivor words of one cached position as a readable,
 * centered-measure column of body prose. Kernel words are coral (`text-kernel`,
 * constant from position 0). Each collapsed gap is a thin seam.
 *
 * Step 4 — state transition. Two effects on a slider swap, neither remounting
 * the column (DOM slots must persist):
 *   1. **Colour crossfade.** Words are keyed by *list position*, so as the text
 *      reflows each DOM slot is reused for a different word and its colour eases
 *      (white↔coral) — the prototype's shimmer.
 *   2. **Reveal flash (experiment).** On each swap a small RANDOM subset of the
 *      seams briefly *opens* its predicted text inline (the same left-to-right
 *      expand the hover reveal will use in Step 5), pushing the following text
 *      and reflowing — a fast, chaotic "reshuffle" that signals the prediction
 *      changing. The predicted text matches the surviving prose type, only in
 *      grey. The number revealed is inversely proportional to compression
 *      (`revealCount`: many shallow, few deep) — both an aesthetic choice and a
 *      perf guard, since deep positions have far more seams.
 *
 * Note: the reveal selection uses `Math.random` (a sanctioned exception to the
 * runtime's determinism rule — it is a transient, decorative animation; the
 * resting DOM is identical every time). `prefers-reduced-motion` disables it.
 */

type ProseColumnProps = {
  items: ProseItem[];
  /** Slider stop index — changes drive the colour crossfade and reveal flash. */
  streamKey: number;
  /** How many seams flash open on this swap (fewer as compression deepens). */
  revealCount: number;
};

const FLASH_HOLD_MS = 450; // how long the opened seams stay before closing
const REVEAL_MS = 200; // open/close transition duration

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCE_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(REDUCE_QUERY).matches;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
}

/**
 * Pick `count` random seam list-indices from `items`, restricted to the TOP
 * QUARTER of the seams — those are most likely above the fold, so the reveal is
 * visible without scrolling. Fisher–Yates over that quarter, then take `count`.
 */
function pickRevealed(items: ProseItem[], count: number): Set<number> {
  if (count <= 0) return new Set();
  const seamIdxs: number[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind === 'seam') seamIdxs.push(i);
  }
  const top = seamIdxs.slice(0, Math.ceil(seamIdxs.length / 4));
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [top[i], top[j]] = [top[j], top[i]];
  }
  return new Set(top.slice(0, count));
}

/**
 * Seam marker — a thin dim vertical pipe, plus the gap's predicted text which
 * is collapsed by default (`font-size: 0`) and expands left-to-right to the
 * prose size when `open`, reflowing the following text. The predicted text
 * shares the surviving prose's type (size, weight, spacing); only its colour
 * differs (grey). A distinct component so a slot flipping word↔seam remounts.
 */
function SeamMark({
  predictedText,
  separator,
  open,
}: {
  predictedText: string;
  separator: string;
  open: boolean;
}) {
  return (
    <>
      <span
        data-seam-pipe=""
        aria-hidden="true"
        className="mx-1.5 inline-block h-[0.85em] w-px translate-y-[0.1em] bg-faint align-baseline"
      />
      <span
        aria-hidden={!open}
        className="inline text-muted transition-all ease-out"
        style={{
          // Override the paragraph's inherited `pre-wrap`: the predicted text
          // can contain newlines, which would otherwise render as full-height
          // empty lines even at font-size 0 (line-height is absolute), leaving
          // a tall void. `normal` collapses those newlines to spaces.
          whiteSpace: 'normal',
          transitionDuration: `${REVEAL_MS}ms`,
          fontSize: open ? 'var(--prose-size)' : '0px',
          marginLeft: open ? '0.25rem' : '0',
          opacity: open ? 1 : 0,
        }}
      >
        {predictedText}
      </span>
      {separator}
    </>
  );
}

export function ProseColumn({ items, streamKey, revealCount }: ProseColumnProps) {
  const reduce = usePrefersReducedMotion();

  // Latest items, read inside the rAF without making the flash effect depend on
  // the (per-render-new) items array. Synced in an effect (not during render).
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });

  // Reveal flash: on a swap the column first renders with the seams closed,
  // then a rAF opens a random subset, then a timeout closes them. Setting state
  // inside rAF/timeout (not synchronously in the effect body) keeps this off
  // the "no setState in effect" rule.
  const [flash, setFlash] = useState<{ key: number; idxs: Set<number> } | null>(
    null,
  );
  useEffect(() => {
    if (reduce) return;
    let timer = 0;
    const raf = requestAnimationFrame(() => {
      setFlash({ key: streamKey, idxs: pickRevealed(itemsRef.current, revealCount) });
      timer = window.setTimeout(() => {
        setFlash((f) => (f && f.key === streamKey ? null : f));
      }, FLASH_HOLD_MS);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [streamKey, reduce, revealCount]);

  const openIdxs = flash && flash.key === streamKey ? flash.idxs : null;

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
          {/*
            Index keys are intentional: reusing the DOM slot across reflows is
            what drives the transition-colors crossfade (word identity lives in
            the data, not the key). Don't switch to stable per-word keys here.
          */}
          {items.map((item, idx) =>
            item.kind === 'word' ? (
              <span
                key={idx}
                className={`transition-colors duration-700 motion-reduce:transition-none ${
                  item.isKernel ? 'text-kernel' : 'text-prose'
                }`}
              >
                {item.text}
                {item.separator}
              </span>
            ) : (
              <SeamMark
                key={idx}
                predictedText={item.predictedText}
                separator={item.separator}
                open={openIdxs?.has(idx) ?? false}
              />
            ),
          )}
        </p>
      </div>
      {/* Reserved inspector band (node 28:196) — empty for Step 2. */}
      <div className="h-[54px] min-h-[54px] w-full shrink-0 border-t border-seam bg-ground-rail" />
    </div>
  );
}
