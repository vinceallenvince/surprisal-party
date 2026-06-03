'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';
import { pointerToStopIndex, positionToThumbPct } from '@/lib/tale-render';

/**
 * Onboarding primer modal — frame 28-80 (the onboarding overlay over the
 * explorer). A large centered card over a scrim that dims (does not remove) the
 * explorer behind it. The scrim intercepts pointer events, so the explorer is
 * not interactive while the primer is open.
 *
 * Reworked from a single static card into a FOUR-STEP interactive primer that
 * teaches the surprisal-threshold intuition on a tiny self-referential example
 * (the primer's own definition sentence), then closes the loop with the inverse
 * (prediction). By the end the user has compressed the text themselves AND seen
 * it lossily reconstructed — i.e. they have *done* both halves of the mechanic.
 *
 *   Step 1 — the vocabulary definition (the original two lines, unchanged).
 *   Step 2 — the same sentence annotated with each word's (illustrative)
 *             surprisal as a small superscript; the kernel word in coral.
 *   Step 3 — the annotated sentence plus a keyboard-operable threshold slider;
 *             raising the threshold fades + contracts the words below it until
 *             only the highest-surprisal word ("predictor") survives.
 *   Step 4 — the inverse: from the lone kernel `predictor`, a "predict" button
 *             reveals a LOSSY reconstruction of the original sentence —
 *             predicted words fill in left-to-right (mirroring the middle
 *             column's seam reveal), shown beside the actual text and a fidelity
 *             score. Closes the loop.
 *
 * State (step, the slider's stop index, whether the slider has moved, and
 * whether the user has predicted) lives INSIDE this component; the container
 * contract is unchanged — it still just mounts the modal and passes
 * `onDismiss`. "Done" (step 4) calls `onDismiss`, same as the old "Got it"; the
 * container persists the seen-flag.
 *
 * Dismissal: the "Done" button (step 4), Esc, or a scrim click — from any step.
 * Accessibility: `role="dialog"` + `aria-modal`; step 1 is labelled by its
 * heading (`aria-labelledby`), steps 2–4 are headingless and fall back to a
 * static `aria-label`. A Tab/Shift+Tab focus trap, focus moved to the primary
 * control on each step (Next on 1–2, slider on 3, the "predict" button on 4)
 * and restored to the opener on close. Fades respect
 * `prefers-reduced-motion` (instant). Static-export safe and deterministic: the
 * surprisal values and threshold stops below are hardcoded illustrations, NOT
 * pipeline output.
 *
 * Slider note: unlike the main app slider (mouse-only, because the arrow keys
 * drive the seam walk), THIS slider is keyboard-operable. The arrow keys don't
 * collide with `ProseColumn`'s document-level seam-walk listener because that
 * listener suspends itself whenever a modal dialog is open (it checks for
 * `[aria-modal="true"]`); the primer slider only `preventDefault()`s the keys
 * to stop the modal/page from scrolling.
 */

const HEADING_ID = 'primer-heading';

/**
 * The example sentence — the primer's own definition, made self-referential.
 * The `surprisal` numbers are ILLUSTRATIVE hardcoded values (NOT from the
 * pipeline); they only need to rank the words plausibly so the threshold
 * walk-through drops them in a satisfying order. `predictor` is the kernel:
 * the highest-surprisal word, the one that survives to the end.
 */
type PrimerToken = { text: string; surprisal: number };

const SENTENCE: readonly PrimerToken[] = [
  { text: 'how', surprisal: 3 },
  { text: 'much', surprisal: 5 },
  { text: 'a', surprisal: 1 },
  { text: 'word', surprisal: 8 },
  { text: 'surprises', surprisal: 12 },
  { text: 'a', surprisal: 1 },
  { text: 'predictor', surprisal: 20 },
];

// The kernel word — rendered in coral throughout steps 2 and 3 so the eye
// tracks the word that will survive.
const KERNEL_INDEX = SENTENCE.length - 1;

// Five threshold stops. A word survives iff `surprisal >= threshold`.
//   τ=0  → all 7 words
//   τ=2  → drops both `a`(1)
//   τ=4  → also drops `how`(3)
//   τ=7  → also drops `much`(5)
//   τ=15 → also drops `word`(8) + `surprises`(12); just `predictor` remains.
const THRESHOLDS = [0, 2, 4, 7, 15] as const;
const STOP_COUNT = THRESHOLDS.length;
const MAX_STOP_INDEX = STOP_COUNT - 1;

/**
 * Step 4's lossy reconstruction of the original sentence from the kept kernel.
 * These are ILLUSTRATIVE hardcoded values (NOT pipeline output): `predicted:
 * true` words animate in left-to-right; the lone `predicted: false` word is the
 * kept kernel (coral, already present from step 3's end state). Predicted words
 * render in white — the same colour as the actual text — to make the
 * comparison to `actual` legible (the main app uses grey there; the onboarding
 * favours the connection). The prediction is lossy ON PURPOSE — "fools"/"often"
 * differ from `actual`, and that difference is the loss the 0.68 fidelity score
 * quantifies; the readout shows `actual` next to the score.
 */
const RECONSTRUCTION = {
  tokens: [
    { text: 'how', predicted: true },
    { text: 'often', predicted: true },
    { text: 'a', predicted: true },
    { text: 'word', predicted: true },
    { text: 'fools', predicted: true },
    { text: 'a', predicted: true },
    { text: 'predictor', predicted: false },
  ],
  // The actual removed words the predictor had to reconstruct — NOT including
  // the kept kernel `predictor` (it was never removed, so it isn't part of the
  // prediction being scored).
  actual: 'how much a word surprises a',
  fidelity: 0.68,
} as const;

// Per-index stagger for the predicted-word reveal (matches ProseColumn's seam
// reveal ripple). A fixed delay per index — the resting DOM stays deterministic.
const RECONSTRUCTION_STAGGER_MS = 60;

type Step = 1 | 2 | 3 | 4;

/**
 * The annotated sentence. In step 2 every word shows; in step 3 words whose
 * surprisal is below the active threshold fade out and the sentence contracts.
 * Dropped words are NOT `display:none` — they stay in the DOM and collapse to
 * zero width (`max-w-0 opacity-0 mr-0 overflow-hidden`) so the opacity+width
 * transition can animate the reflow; they are `aria-hidden` so they neither
 * read out nor occupy space once collapsed.
 */
function AnnotatedSentence({
  threshold,
  reduce,
}: {
  threshold: number;
  reduce: boolean;
}) {
  // Dropped words fade their opacity AND collapse their horizontal space so the
  // line reflows (the compression). When motion is reduced both changes are
  // instant. We keep dropped words in the DOM (not display:none) so the opacity
  // transition has something to animate; they are `aria-hidden` and zero-width
  // so they neither read out nor take layout space once collapsed.
  const transition = reduce
    ? 'motion-reduce:transition-none'
    : 'transition-all duration-300 ease-out';

  return (
    <p className="flex flex-wrap items-baseline text-[22px] leading-[34px] text-prose">
      {SENTENCE.map((token, i) => {
        const survives = token.surprisal >= threshold;
        const isKernel = i === KERNEL_INDEX;
        return (
          <span
            key={i}
            data-token={token.text}
            data-survives={survives}
            aria-hidden={survives ? undefined : true}
            className={`inline-flex items-baseline overflow-hidden whitespace-nowrap align-baseline ${transition} ${
              survives
                ? 'mr-[0.4em] max-w-[12em] opacity-100'
                : 'mr-0 max-w-0 opacity-0'
            }`}
          >
            <span className={isKernel ? 'text-kernel' : ''}>{token.text}</span>
            <sup className="ml-[1px] text-[11px] font-normal text-faint">
              {token.surprisal}
            </sup>
          </span>
        );
      })}
    </p>
  );
}

/** The keyboard-operable threshold slider (step 3). */
function ThresholdSlider({
  stopIndex,
  onMove,
  trackRef,
}: {
  stopIndex: number;
  onMove: (index: number) => void;
  // Owned by the parent so it can move focus here on entering step 3 (the
  // slider is the step's primary operable control — Done is disabled until a
  // move, and disabled buttons aren't focusable).
  trackRef: React.RefObject<HTMLDivElement | null>;
}) {
  const thumbPct = positionToThumbPct(stopIndex, STOP_COUNT);

  const snapFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      if (rect.width === 0) return;
      const fraction = (clientX - rect.left) / rect.width;
      const next = pointerToStopIndex(fraction, STOP_COUNT);
      if (next !== stopIndex) onMove(next);
    },
    [onMove, stopIndex, trackRef],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      snapFromClientX(event.clientX);
    },
    [snapFromClientX],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      snapFromClientX(event.clientX);
    },
    [snapFromClientX],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  // Keyboard: Left/Down step back, Right/Up step forward, Home/End jump to the
  // ends. `preventDefault` keeps Arrow/Home/End from scrolling the modal/page.
  // No `stopPropagation` is needed to protect ProseColumn's seam walk — that
  // document-level listener suspends itself while a modal dialog is open (see
  // ProseColumn), which is the robust fix in the App Router (where React's
  // delegated listener shares the `document` node and bubbling can't be relied
  // on). Tab/Esc are left to bubble so the focus trap + Esc-dismiss still work.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      let next: number | null = null;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          next = Math.min(MAX_STOP_INDEX, stopIndex + 1);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          next = Math.max(0, stopIndex - 1);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = MAX_STOP_INDEX;
          break;
        default:
          return; // let other keys (Tab, Esc) bubble normally
      }
      event.preventDefault();
      if (next !== stopIndex) onMove(next);
    },
    [onMove, stopIndex],
  );

  const threshold = THRESHOLDS[stopIndex];

  return (
    <div className="w-full">
      <div
        ref={trackRef}
        className="slider-track relative h-2 w-full cursor-pointer touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-kernel"
        role="slider"
        tabIndex={0}
        aria-label="Surprisal threshold"
        aria-valuemin={THRESHOLDS[0]}
        aria-valuemax={THRESHOLDS[MAX_STOP_INDEX]}
        aria-valuenow={threshold}
        aria-valuetext={`threshold ${threshold}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        {THRESHOLDS.map((t, i) => (
          <div
            key={t}
            className="absolute top-[-4px] h-4 w-0.5 -translate-x-1/2 rounded-full bg-notch"
            style={{ left: `${positionToThumbPct(i, STOP_COUNT)}%` }}
          />
        ))}
        <div
          className="absolute top-[-10px] size-7 -translate-x-1/2 rounded-full border-2 border-notch bg-thumb shadow-lg"
          style={{ left: `${thumbPct}%` }}
          role="presentation"
        />
      </div>
      {/* Threshold-value tick labels */}
      <div className="relative mt-5 h-4 w-full">
        {THRESHOLDS.map((t, i) => (
          <p
            key={t}
            className="absolute top-0 text-xs whitespace-nowrap text-faint"
            style={{
              left: `${positionToThumbPct(i, STOP_COUNT)}%`,
              transform: 'translateX(-50%)',
            }}
          >
            {t}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * Step 4's lossy reconstruction line. Before the user clicks "predict", only the
 * kept kernel `predictor` shows (far left, continuous with step 3's end state).
 * After (`revealed`), the predicted words fill in BEFORE it with a staggered
 * left-to-right fade/expand (mirroring the middle column's seam reveal — opacity
 * + width), reflowing `predictor` rightward into its natural sentence-final
 * position. They render in white (`text-prose`), matching the `actual` text so
 * the comparison reads clearly — the main app uses grey for predicted text, but
 * the onboarding favours the visual connection.
 *
 * Predicted words are kept in the DOM (not display:none) and collapse to zero
 * width when hidden so the opacity+width transition can animate the reflow. The
 * resting DOM after the reveal is deterministic (fixed per-index stagger; no
 * randomness). When motion is reduced both opacity and width snap instantly.
 */
function Reconstruction({
  revealed,
  reduce,
}: {
  revealed: boolean;
  reduce: boolean;
}) {
  const transition = reduce
    ? 'motion-reduce:transition-none'
    : 'transition-all duration-300 ease-out';

  // The stagger rank is the count of predicted words at or before this index,
  // computed from the data (not a mutable counter — the React 19 immutability
  // rule forbids reassigning across the render). For this fixed reconstruction
  // the predicted words are a contiguous prefix, so this is just the index, but
  // counting keeps it correct regardless of token order.
  return (
    <p className="flex flex-wrap items-baseline text-[22px] leading-[34px] text-prose">
      {RECONSTRUCTION.tokens.map((token, i) => {
        const isPredicted = token.predicted;
        const predictedRank = RECONSTRUCTION.tokens
          .slice(0, i)
          .filter((t) => t.predicted).length;
        // A predicted word is shown once revealed; the kernel is always shown.
        const shown = isPredicted ? revealed : true;
        const delayMs =
          reduce || !isPredicted ? 0 : predictedRank * RECONSTRUCTION_STAGGER_MS;
        return (
          <span
            key={i}
            data-recon-token={token.text}
            data-predicted={isPredicted}
            data-shown={shown}
            className={`inline-flex items-baseline overflow-hidden whitespace-nowrap align-baseline ${transition} ${
              shown
                ? 'mr-[0.4em] max-w-[12em] opacity-100'
                : 'mr-0 max-w-0 opacity-0'
            } ${isPredicted ? 'text-prose' : 'text-kernel'}`}
            style={reduce ? undefined : { transitionDelay: `${delayMs}ms` }}
          >
            {token.text}
          </span>
        );
      })}
    </p>
  );
}

export function PrimerModal({ onDismiss }: { onDismiss: () => void }) {
  const reduce = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);
  // The primary advancing control on steps 1–2 ("Next") — focus moves here when
  // the step changes.
  const advanceRef = useRef<HTMLButtonElement | null>(null);
  // The step-3 threshold slider track — the step's primary operable control, so
  // focus moves here on entering step 3 (NOT to "Done", which is disabled until
  // the slider moves and so cannot receive focus).
  const sliderRef = useRef<HTMLDivElement | null>(null);
  // The step-4 "predict" button — the step's primary operable control, so focus
  // moves here on entering step 4 (NOT to "Done", which is disabled until the
  // prediction is revealed and so cannot receive focus).
  const predictRef = useRef<HTMLButtonElement | null>(null);
  // The element focused before the modal opened, restored on close.
  const openerRef = useRef<Element | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [stopIndex, setStopIndex] = useState(0);
  const [hasMovedSlider, setHasMovedSlider] = useState(false);
  const [hasPredicted, setHasPredicted] = useState(false);

  // Capture the opener once, on mount; restore it on unmount.
  useEffect(() => {
    openerRef.current = document.activeElement;
    const opener = openerRef.current;
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  // Move focus to the step's primary control whenever the step changes: the
  // slider on step 3 (its Next is disabled and unfocusable until a move), the
  // "predict" button on step 4 (Done is disabled and unfocusable until a
  // prediction), else the "Next" button. A DOM `.focus()` call in the effect's
  // commit (allowed); not a setState-in-effect and no ref read/write in render.
  useEffect(() => {
    if (step === 3) sliderRef.current?.focus();
    else if (step === 4) predictRef.current?.focus();
    else advanceRef.current?.focus();
  }, [step]);

  // Esc to dismiss + a Tab/Shift+Tab focus trap. Registered once; reads the
  // live DOM, so no re-subscription needed.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
        return;
      }
      if (e.key !== 'Tab') return;
      const card = cardRef.current;
      if (!card) return;
      const focusable = card.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  // Scrim click dismisses; clicks on the card must not bubble up to it.
  const onScrimClick = useCallback(() => onDismiss(), [onDismiss]);

  // Any slider movement (pointer or keyboard) to a different stop arms Done.
  // Setting state in the handler is fine (the React 19 rule only forbids
  // setState synchronously inside an effect).
  const handleSliderMove = useCallback((next: number) => {
    setStopIndex(next);
    setHasMovedSlider(true);
  }, []);

  // Clicking "predict the uncompressed text" reveals the lossy reconstruction
  // and arms Done. Setting state in the handler is fine (the React 19 rule only
  // forbids setState synchronously inside an effect).
  const handlePredict = useCallback(() => setHasPredicted(true), []);

  const transition = reduce
    ? 'motion-reduce:transition-none'
    : 'transition-opacity duration-200 ease-out';

  const threshold = THRESHOLDS[stopIndex];

  // Only step 1 carries a visible heading (the vocabulary definition). Steps 2
  // and 3 are headingless by request, so the dialog falls back to a static
  // `aria-label` for its accessible name; on step 1 the `aria-labelledby` to the
  // heading takes precedence.
  return (
    <div
      data-primer-scrim=""
      onClick={onScrimClick}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-8 ${transition}`}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Surprisal primer"
        aria-labelledby={step === 1 ? HEADING_ID : undefined}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[840px] flex-col rounded-[10px] border border-seam-strong bg-ground p-[49px] shadow-[0_25px_25px_rgba(0,0,0,0.25)]"
      >
        {/* Content region — a fixed min-height so the footer doesn't bounce as
            step content changes. Steps 1 and 2 share the same two-line layout
            (a lead line at 22px + a muted second line), so step 1's heading is
            rendered here at the lead-line size rather than as a separate, larger
            header block above the content. */}
        <div className="min-h-[200px] pt-6">
          {/* Keyed by step so it remounts on each advance, replaying the gentle
              fade-in over the step's content (reduced-motion disables it). */}
          <div key={step} className="primer-fade-in">
          {step === 1 && (
            <div className="flex flex-col gap-6">
              <h1
                id={HEADING_ID}
                className="text-[22px] leading-[34px] text-prose"
              >
                <span className="text-kernel">surprisal</span> = how much a word
                surprises a predictor
              </h1>
              <p className="text-[18px] leading-[29.25px] tracking-[-0.44px] text-muted">
                predictable words carry little information, surprising words
                carry a lot
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-6">
              <AnnotatedSentence threshold={0} reduce={reduce} />
              <p className="text-[18px] leading-[29.25px] tracking-[-0.44px] text-muted">
                the small number is each word&apos;s surprisal, its cost to a
                predictor
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-8">
              <AnnotatedSentence threshold={threshold} reduce={reduce} />
              <ThresholdSlider
                stopIndex={stopIndex}
                onMove={handleSliderMove}
                trackRef={sliderRef}
              />
              <p className="text-[18px] leading-[29.25px] tracking-[-0.44px] text-muted">
                raise the threshold to compress the text. only the surprising
                words survive
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-6">
              {/* The reconstruction line: before the click only the coral kernel
                  `predictor` shows (far left, continuous with step 3's end
                  state); after, the predicted words fill in before it. */}
              <Reconstruction revealed={hasPredicted} reduce={reduce} />
              <p className="text-[18px] leading-[29.25px] tracking-[-0.44px] text-muted">
                the higher the surprisal, the more lossy the prediction
              </p>
              {hasPredicted ? (
                // Actual + fidelity readout — mirrors ProseColumn's
                // reconstruction inspector (small uppercase labels + values),
                // showing the true text beside the prediction's fidelity.
                <p className="primer-fade-in flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[13px]">
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] tracking-[0.1em] text-faint uppercase">
                      Actual
                    </span>
                    <span className="text-prose">{RECONSTRUCTION.actual}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] tracking-[0.1em] text-faint uppercase">
                      Fidelity
                    </span>
                    <span className="text-prose">
                      {RECONSTRUCTION.fidelity.toFixed(2)}
                    </span>
                  </span>
                </p>
              ) : (
                <button
                  ref={predictRef}
                  type="button"
                  onClick={handlePredict}
                  className="self-start rounded-[8px] border border-seam-strong bg-seam px-5 py-3 text-sm font-medium tracking-tight text-prose"
                >
                  predict the uncompressed text
                </button>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between pt-12">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="rounded-[8px] border border-seam-strong bg-ground px-5 py-3 text-sm font-medium tracking-tight text-muted"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}

          {step < 4 ? (
            <button
              ref={advanceRef}
              type="button"
              onClick={() => setStep((s) => (s + 1) as Step)}
              // Step 3's Next preserves the must-compress requirement: it is
              // disabled until the slider has moved (the gate that previously
              // sat on Done). Steps 1–2 Next is always enabled.
              disabled={step === 3 && !hasMovedSlider}
              className="rounded-[8px] border border-seam-strong bg-seam px-5 py-3 text-sm font-medium tracking-tight text-prose disabled:cursor-not-allowed disabled:border-seam disabled:bg-ground disabled:text-faint"
            >
              Next →
            </button>
          ) : (
            <button
              ref={advanceRef}
              type="button"
              onClick={onDismiss}
              // Step 4's Done is disabled until the user predicts (clicks
              // "predict the uncompressed text"), so it cannot take focus on
              // entry — the predict button is step 4's primary control.
              disabled={!hasPredicted}
              className="rounded-[8px] border border-seam-strong bg-seam px-5 py-3 text-sm font-medium tracking-tight text-prose disabled:cursor-not-allowed disabled:border-seam disabled:bg-ground disabled:text-faint"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
