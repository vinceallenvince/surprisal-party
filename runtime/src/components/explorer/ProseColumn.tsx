'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProseItem } from '@/lib/tale-render';
import { seamNextIndex, seamPrevIndex, type ActiveSeam } from '@/lib/tale-render';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

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
 * The middle column itself has no hover/rollover trigger. In addition to the
 * keyboard walk, the active seam can be set externally via the `seamRequest`
 * prop — the shell raises one when a predicted tile (right strip) is clicked.
 * The request is consumed with the "adjust state during render" pattern (see
 * below); the existing auto-scroll effect then brings the seam into view.
 * `activeSeamValueRef` is re-synced to `activeSeam` every render, so a clicked
 * seam composes with the keyboard walk (arrows continue from the clicked seam).
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
  /** Fraction (0–1) of the seams the reveal pool is drawn from (grows with compression). */
  selectFraction: number;
  /**
   * External seam-activation request raised by clicking a predicted tile. The
   * `nonce` is a monotonically increasing counter so the SAME tile can be
   * re-clicked (e.g. after Esc cleared the seam) and re-trigger. Consumed via
   * the "adjust state during render" pattern (mirroring `prevStreamKey`), NOT a
   * setState-in-effect. If the `gapId` isn't present at the current position the
   * request is ignored.
   */
  seamRequest?: { gapId: number; nonce: number } | null;
  /**
   * Reports the active seam's gap ids (or null when none is active) so the
   * parent can highlight the matching tiles in the removed-words strip — the
   * reverse of `seamRequest`. Called from an effect keyed on the active seam +
   * position (NOT this component's own setState), so it never trips the
   * no-setState-in-an-effect rule; the parent's setter must be stable.
   */
  onActiveSeamChange?: (gapIds: number[] | null) => void;
};

const FLASH_HOLD_MS = 750; // how long the opened seams stay before closing
const REVEAL_MS = 200; // open/close transition duration
const STAGGER_MS = 55; // per-seam delay so flashed reveals ripple, not fire at once
const HINT_DISMISS_MS = 5000; // auto-dismiss the arrow-key hint after this long

/** How many candidates to sample before pruning to `count` (favouring multi-word). */
const OVERSELECT_FACTOR = 2;

function wordCount(text: string): number {
  const t = text.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Pick `count` random seam list-indices from `items`, drawn from the TOP
 * `fraction` of the seams (0–1). The pool shrinks toward the top at shallow
 * compression (long prose → keep reveals above the fold) and widens to the
 * whole set at deep compression (short constellation → draw from anywhere).
 *
 * Multi-word reveals (predicted text with > 1 word) are the satisfying ones, so
 * we over-select a candidate sample (`OVERSELECT_FACTOR × count`), take the
 * multi-word candidates first, then top up to `count` with single-word ones —
 * e.g. count 16 from 32 candidates with 12 multi-word → 12 multi + 4 single.
 * Returns them in shuffled order, which the caller uses to stagger the reveal.
 */
export function pickRevealed(
  items: ProseItem[],
  count: number,
  fraction: number,
): number[] {
  if (count <= 0) return [];
  const seamIdxs: number[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind === 'seam') seamIdxs.push(i);
  }
  if (seamIdxs.length === 0) return [];

  const poolN = Math.max(1, Math.ceil(seamIdxs.length * fraction));
  const pool = seamIdxs.slice(0, poolN);
  shuffleInPlace(pool);

  const candidates = pool.slice(0, Math.min(pool.length, count * OVERSELECT_FACTOR));
  const isMulti = (i: number): boolean => {
    const it = items[i];
    return it.kind === 'seam' && wordCount(it.predictedText) > 1;
  };
  const multi = candidates.filter(isMulti);
  const single = candidates.filter((i) => !isMulti(i));

  // Multi-word first, fill the remainder with single-word.
  const chosen = multi.concat(single).slice(0, count);

  // Guarantee at least one reveal among the first three seams (document order),
  // so there's always something near where the eye starts. If none of the
  // chosen are in the first three, swap one in — preferring a multi-word one,
  // and replacing a single-word slot to keep the multi-word bias.
  const firstThree = seamIdxs.slice(0, 3);
  if (firstThree.length > 0 && !chosen.some((i) => firstThree.includes(i))) {
    const multiFirst = firstThree.filter(isMulti);
    const pool2 = multiFirst.length > 0 ? multiFirst : firstThree;
    const force = pool2[Math.floor(Math.random() * pool2.length)];
    const slot = chosen.findIndex((i) => !isMulti(i));
    chosen[slot === -1 ? chosen.length - 1 : slot] = force;
  }

  // Randomise the reveal order for an organic stagger.
  shuffleInPlace(chosen);
  return chosen;
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
  openDelayMs,
  active,
  activeRef,
  showHint,
}: {
  predictedText: string;
  separator: string;
  open: boolean;
  /** Delay before the open/close transition starts — staggers flashed reveals. */
  openDelayMs: number;
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
          transitionDelay: `${openDelayMs}ms`,
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

export function ProseColumn({
  items,
  streamKey,
  revealCount,
  selectFraction,
  seamRequest,
  onActiveSeamChange,
}: ProseColumnProps) {
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
  // `idxs` is in pick order; a seam's position in it becomes its stagger rank.
  const [flash, setFlash] = useState<{ key: number; idxs: number[] } | null>(
    null,
  );
  useEffect(() => {
    if (reduce) return;
    let timer = 0;
    const raf = requestAnimationFrame(() => {
      setFlash({
        key: streamKey,
        idxs: pickRevealed(itemsRef.current, revealCount, selectFraction),
      });
      timer = window.setTimeout(() => {
        setFlash((f) => (f && f.key === streamKey ? null : f));
      }, FLASH_HOLD_MS);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [streamKey, reduce, revealCount, selectFraction]);

  // Map each flashed seam's list-index to its stagger rank (pick order), so the
  // reveals ripple in over STAGGER_MS steps instead of firing simultaneously.
  const flashRank =
    flash && flash.key === streamKey
      ? new Map(flash.idxs.map((id, rank) => [id, rank] as const))
      : null;

  // ---- Active-seam walk (Step 5) ----------------------------------------

  // The seam list-indices in story order, and each seam's ordinal. The ordinal
  // map lets a span know its position in the walk. Recomputed per render (cheap;
  // mirrors `items`). `seamOrdinalByListIdx[listIdx]` is the seam's ordinal.
  const seamListIdxs: number[] = [];
  const seamOrdinalByListIdx = new Map<number, number>();
  // Map every gap id to its seam's ordinal, so a clicked tile (which carries a
  // gap id) can resolve to the seam to activate. Adjacent gaps collapse into one
  // seam, so multiple gap ids legitimately map to the same ordinal.
  const gapIdToSeamOrdinal = new Map<number, number>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'seam') {
      const ordinal = seamListIdxs.length;
      seamOrdinalByListIdx.set(i, ordinal);
      for (const gapId of item.gapIds) {
        gapIdToSeamOrdinal.set(gapId, ordinal);
      }
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

  // External tile-click request → activate the matching seam. Same "adjust state
  // during render" pattern as the streamKey reset above (NOT a setState in an
  // effect, so it stays clear of React 19's no-setState-in-effect rule): compare
  // the request's nonce against the previous one held in *state*; on a new nonce,
  // record it and, if this position has the requested gap, set the active seam.
  // An unknown gap id is ignored (no clear, no throw). A tile click happens at a
  // fixed position, so it never races the streamKey reset above.
  const [prevSeamNonce, setPrevSeamNonce] = useState<number | null>(null);
  if (seamRequest && seamRequest.nonce !== prevSeamNonce) {
    setPrevSeamNonce(seamRequest.nonce);
    const ordinal = gapIdToSeamOrdinal.get(seamRequest.gapId);
    if (ordinal !== undefined) {
      setActiveSeam(ordinal);
    }
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

  // Single document-level keydown handler. The seam walk is otherwise unscoped
  // (the main slider is mouse-only), so the one real conflict is a modal that
  // wants the arrow keys for itself — the onboarding primer's threshold slider.
  // While ANY modal dialog is open we suspend the walk entirely: React 19
  // attaches its delegated listener to `document` (the same node as this one),
  // so a child's `stopPropagation()` can't reliably stop us; guarding here at
  // the source is the robust fix (and covers the About / corpus dialogs too).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (document.querySelector('[aria-modal="true"]')) return;
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

  // Report the active seam's gap ids up so the parent can highlight the matching
  // tiles in the removed-words strip (the reverse of `seamRequest`). Keyed on the
  // stable [activeSeam, streamKey] — NOT `items` (new identity every render) —
  // and reads the live items from the ref. This calls a PARENT callback, not
  // this component's own setState, so the no-setState-in-an-effect rule is moot;
  // the parent's setter is stable (useCallback / useState setter).
  const onActiveSeamChangeRef = useRef(onActiveSeamChange);
  useEffect(() => {
    onActiveSeamChangeRef.current = onActiveSeamChange;
  });
  useEffect(() => {
    const report = onActiveSeamChangeRef.current;
    if (!report) return;
    if (activeSeam === null) {
      report(null);
      return;
    }
    let ordinal = -1;
    for (const it of itemsRef.current) {
      if (it.kind !== 'seam') continue;
      ordinal += 1;
      if (ordinal === activeSeam) {
        report(it.gapIds);
        return;
      }
    }
    report(null);
  }, [activeSeam, streamKey]);

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
        {/* `prose-fade-in` is applied only at UNCOMPRESSED (streamKey 0); since
            it toggles off for every compressed position, returning the slider to
            the far left re-adds it and replays the gentle fade-in over the full
            restored text. Reduced motion disables it (utility media query). */}
        <p
          className={`max-w-(--prose-measure) whitespace-pre-wrap text-prose ${
            streamKey === 0 ? 'prose-fade-in' : ''
          }`}
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
            const rank = flashRank?.get(idx);
            const open = rank !== undefined || active;
            // The active (keyboard) seam opens immediately; flashed seams stay
            // staggered by their pick rank so the reveal ripples in.
            const openDelayMs = active ? 0 : (rank ?? 0) * STAGGER_MS;
            return (
              <SeamMark
                key={idx}
                predictedText={item.predictedText}
                separator={item.separator}
                open={open}
                openDelayMs={openDelayMs}
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
