'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ProseItem } from '@/lib/tale-render';
import { seamNextIndex, seamPrevIndex, type ActiveSeam } from '@/lib/tale-render';

/**
 * Middle prose column — maps to frame 28-163 nodes 28:191..28:196, in its
 * mid-compression form (frame 30-15994) and active-seam form (frame 30-15997).
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
 *      seams briefly *opens* its predicted text inline, pushing the following
 *      text and reflowing — a fast, chaotic "reshuffle" that signals the
 *      prediction changing. The predicted text matches the surviving prose type,
 *      only in grey. The number revealed is inversely proportional to
 *      compression (`revealCount`: many shallow, few deep).
 *
 * Step 5 — seam reconstruction reveal + keyboard walk. A single shared
 * **active-seam** ordinal (index into this position's seams in story order) is
 * driven by the document-level arrow keys: Right → next, Left → previous (no
 * wrap-around), Esc → cleared; from cleared the first Right activates seam 0.
 * The active seam is `open` (its predicted text expands inline) and fills the
 * fixed reconstruction inspector at the bottom with the gap's ACTUAL source text
 * and FIDELITY. A seam is `open` if the reveal-flash selected it OR it is the
 * active seam. A real Right move plays `click1.mp3` (advance), a real Left move
 * plays `click2.mp3` (back); no sound on no-op edges, Esc, or reduced motion.
 * The column auto-scrolls to keep the active seam roughly centered. The active
 * seam resets to cleared whenever the slider position (`streamKey`) changes.
 *
 * The reveal is keyboard-only — there is intentionally no hover/rollover trigger.
 *
 * Note: the reveal-flash selection uses `Math.random` (a sanctioned exception to
 * the runtime's determinism rule — it is a transient, decorative animation; the
 * resting DOM is identical every time). `prefers-reduced-motion` disables it and
 * the click sounds.
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
const HINT_DISMISS_MS = 5000; // auto-dismiss the arrow-key hint after this long

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
 *
 * When `active` (the keyboard walk's current seam) the marker carries a ref so
 * the column can scroll it into view.
 */
function SeamMark({
  predictedText,
  separator,
  open,
  active,
  activeRef,
  showHint,
}: {
  predictedText: string;
  separator: string;
  open: boolean;
  active: boolean;
  activeRef: React.Ref<HTMLSpanElement>;
  /** When true (the first seam, on first compression), show the arrow-key hint above the pipe. */
  showHint: boolean;
}) {
  const pipe = (
    <span
      ref={active ? activeRef : undefined}
      data-seam-pipe=""
      data-seam-active={active ? '' : undefined}
      aria-hidden="true"
      className="mx-1.5 inline-block h-[0.85em] w-px translate-y-[0.1em] bg-faint align-baseline"
    />
  );
  return (
    <>
      {showHint ? (
        <span className="relative inline-block">
          {pipe}
          <span
            role="status"
            aria-label="Use arrow keys to walk the seams"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-md border border-seam bg-ground-strip px-3 py-1.5 text-xs whitespace-nowrap text-muted shadow-md"
          >
            <span aria-hidden="true">← keys →</span>
            {/* Downward caret on the bottom edge: outer triangle is the border
                colour, inner (offset 1px up) is the fill, leaving a 1px edge. */}
            <span
              aria-hidden="true"
              className="absolute top-full left-1/2 -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid var(--color-seam)',
              }}
            />
            <span
              aria-hidden="true"
              className="absolute top-full left-1/2 -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                marginTop: '-1px',
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid var(--color-ground-strip)',
              }}
            />
          </span>
        </span>
      ) : (
        pipe
      )}
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

/**
 * Fixed reconstruction inspector — frame 30-15997's bottom band. A single quiet
 * monospace line: small uppercase ACTUAL label + the gap's source text
 * (truncated to one line), then a right-aligned FIDELITY label + value. Its
 * height is always reserved (the band exists whether or not a seam is active),
 * so filling/emptying it never reflows the column.
 */
function ReconstructionInspector({
  actualText,
  fidelity,
  hasSeams,
}: {
  actualText: string | null;
  fidelity: number | null;
  /** Whether the current position has any seams to walk (false at UNCOMPRESSED). */
  hasSeams: boolean;
}) {
  const active = actualText !== null && fidelity !== null;
  // Something to show whenever a seam is active or there are seams to walk; at
  // UNCOMPRESSED (no seams) the band fades to empty rather than blinking off.
  const visible = active || hasSeams;
  return (
    <div className="h-[54px] min-h-[54px] w-full shrink-0 border-t border-seam bg-ground-rail px-12 font-mono text-[13px]">
      <div
        className={`flex h-full w-full items-center gap-3 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {active ? (
          <>
            <span className="shrink-0 text-[10px] tracking-[0.1em] text-faint uppercase">
              Actual
            </span>
            <span className="min-w-0 grow truncate text-prose">{actualText}</span>
            <span className="ml-auto shrink-0 text-[10px] tracking-[0.1em] text-faint uppercase">
              Fidelity
            </span>
            <span className="shrink-0 text-prose">{fidelity.toFixed(2)}</span>
          </>
        ) : (
          <span className="text-faint/60">
            Press an arrow key to walk the seams
          </span>
        )}
      </div>
    </div>
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

  // ---- Active-seam walk (Step 5) ----------------------------------------

  // The seam list-indices in story order, and each seam's ordinal. The ordinal
  // map lets a span know its position in the walk. Recomputed per render (cheap;
  // mirrors `items`). `seamOrdinalByListIdx[listIdx]` is the seam's ordinal.
  const seamListIdxs: number[] = [];
  const seamOrdinalByListIdx = new Map<number, number>();
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind === 'seam') {
      seamOrdinalByListIdx.set(i, seamListIdxs.length);
      seamListIdxs.push(i);
    }
  }
  const seamCount = seamListIdxs.length;

  const [activeSeam, setActiveSeam] = useState<ActiveSeam>(null);

  // Reset the active seam whenever the slider position changes. streamKey is the
  // only writer of the position; a new position means a new (incomparable) set
  // of seams. React's "adjust state during render" pattern: compare the prop to
  // the previous value held in *state* (not a ref) and reset in the same render.
  const [prevStreamKey, setPrevStreamKey] = useState(streamKey);
  if (prevStreamKey !== streamKey) {
    setPrevStreamKey(streamKey);
    setActiveSeam(null);
  }

  // Preload the click clips once. Refs (not state) — they are imperative.
  const advanceAudioRef = useRef<HTMLAudioElement | null>(null);
  const backAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const advance = new Audio('/audio/click1.mp3');
    const back = new Audio('/audio/click2.mp3');
    advance.preload = 'auto';
    back.preload = 'auto';
    advanceAudioRef.current = advance;
    backAudioRef.current = back;
    return () => {
      advanceAudioRef.current = null;
      backAudioRef.current = null;
    };
  }, []);

  // Reduced motion gates sound too (per the plan): keep a ref so the keydown
  // handler — registered once — always reads the current preference.
  const reduceRef = useRef(reduce);
  useEffect(() => {
    reduceRef.current = reduce;
  });

  const playClip = useCallback((ref: React.RefObject<HTMLAudioElement | null>) => {
    if (reduceRef.current) return;
    const el = ref.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => {
      // Autoplay/availability failures are non-fatal — the walk still works.
    });
  }, []);

  // The hint dismisses on the first arrow press; keep the dismisser in a ref so
  // the single keydown listener can call it without re-subscribing.
  const onArrowEngageRef = useRef<() => void>(() => {});

  // Seam count and the current active-seam value, mirrored into refs so the
  // single keydown listener can compute the next value *outside* the state
  // updater. (Computing it in the updater would double-fire the click sound
  // under React StrictMode, which invokes updaters twice in development.)
  const seamCountRef = useRef(seamCount);
  const activeSeamValueRef = useRef<ActiveSeam>(activeSeam);
  useEffect(() => {
    seamCountRef.current = seamCount;
    activeSeamValueRef.current = activeSeam;
  });

  // Single document-level keydown handler. Arrows ALWAYS drive the seams (no
  // focus scoping) — the slider is mouse-only, so there is no conflict.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onArrowEngageRef.current();
        activeSeamValueRef.current = null; // keep the mirror in sync; no sound
        setActiveSeam(null);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onArrowEngageRef.current();
        const cur = activeSeamValueRef.current;
        const next = seamNextIndex(cur, seamCountRef.current);
        if (next !== cur) {
          activeSeamValueRef.current = next; // keep the mirror in sync now
          playClip(advanceAudioRef); // only on a real move (not a no-op edge)
          setActiveSeam(next);
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onArrowEngageRef.current();
        const cur = activeSeamValueRef.current;
        const prev = seamPrevIndex(cur, seamCountRef.current);
        if (prev !== cur) {
          activeSeamValueRef.current = prev;
          playClip(backAudioRef); // only on a real move
          setActiveSeam(prev);
        }
        return;
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [playClip]);

  // Auto-scroll the active seam roughly to center when it is not comfortably in
  // view. Driven from an effect on activeSeam change (a DOM read + an
  // imperative scroll, not a setState).
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeSeamRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (activeSeam === null) return;
    const container = scrollRef.current;
    const node = activeSeamRef.current;
    if (!container || !node) return;
    const cRect = container.getBoundingClientRect();
    const nRect = node.getBoundingClientRect();
    const margin = cRect.height * 0.2; // "comfortably in view" band
    const above = nRect.top < cRect.top + margin;
    const below = nRect.bottom > cRect.bottom - margin;
    if (!above && !below) return; // already comfortably visible
    const target =
      container.scrollTop +
      (nRect.top - cRect.top) -
      cRect.height / 2 +
      nRect.height / 2;
    container.scrollTo({
      top: target,
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [activeSeam, reduce, streamKey]);

  // ---- Discoverability hint (Step 5) ------------------------------------

  // Session-scoped state machine, in component state (not refs, so it is safe to
  // read during render):
  //   'idle'  — not yet shown this session
  //   'shown' — the bubble is visible
  //   'done'  — dismissed (by arrow/Esc/expiry); never shows again this session
  // It shows the first time the slider moves past UNCOMPRESSED (streamKey > 0)
  // and never reappears once the user engages.
  const [hintPhase, setHintPhase] = useState<'idle' | 'shown' | 'done'>('idle');

  // Trigger: when streamKey first becomes > 0 while idle, show the bubble. The
  // state mutation happens in timeouts (not synchronously in the effect body).
  useEffect(() => {
    if (streamKey <= 0 || hintPhase !== 'idle') return;
    const show = window.setTimeout(() => setHintPhase('shown'), 0);
    const hide = window.setTimeout(() => setHintPhase('done'), HINT_DISMISS_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [streamKey, hintPhase]);

  // Wire the arrow/Esc dismisser (called from the keydown handler). Marking the
  // hint 'done' both hides it and prevents it from reappearing this session.
  useEffect(() => {
    onArrowEngageRef.current = () => setHintPhase('done');
  });

  const hintVisible = hintPhase === 'shown';

  const activeListIdx = activeSeam === null ? null : seamListIdxs[activeSeam];
  const activeItem =
    activeListIdx !== null ? items[activeListIdx] : undefined;
  const inspectorActual =
    activeItem && activeItem.kind === 'seam' ? activeItem.actualText : null;
  const inspectorFidelity =
    activeItem && activeItem.kind === 'seam' ? activeItem.fidelity : null;

  return (
    <div className="flex min-h-0 min-w-0 grow flex-col">
      <div ref={scrollRef} className="relative min-h-0 grow overflow-y-auto p-12">
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
          {items.map((item, idx) => {
            if (item.kind === 'word') {
              return (
                <span
                  key={idx}
                  className={`transition-colors duration-700 motion-reduce:transition-none ${
                    item.isKernel ? 'text-kernel' : 'text-prose'
                  }`}
                >
                  {item.text}
                  {item.separator}
                </span>
              );
            }
            const ordinal = seamOrdinalByListIdx.get(idx);
            const active = ordinal === activeSeam;
            const open = (openIdxs?.has(idx) ?? false) || active;
            return (
              <SeamMark
                key={idx}
                predictedText={item.predictedText}
                separator={item.separator}
                open={open}
                active={active}
                activeRef={activeSeamRef}
                showHint={hintVisible && ordinal === 0}
              />
            );
          })}
        </p>
      </div>
      <ReconstructionInspector
        actualText={inspectorActual}
        fidelity={inspectorFidelity}
        hasSeams={seamCount > 0}
      />
    </div>
  );
}
