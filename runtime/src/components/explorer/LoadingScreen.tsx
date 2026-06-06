'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';
import { resolveBootMode, type BootMode } from '@/lib/boot';

/**
 * Loading screen — the boot experience (Figma Loading page 84:4). Rather than a
 * spinner, the boot wait PERFORMS the app's own mechanic: the welcome phrase
 * "we threw you a surprisal party" is shown with each word's surprisal as a
 * superscript and compresses to its coral kernel "surprisal party" as the cache
 * loads. Behaviour authority is the `## Loading` section of `user-scenarios.md`.
 *
 * The collapse is DECOUPLED from bytes — `fetch().json()` exposes no progress
 * and gzip makes a byte-percentage unreliable — so the collapse is a fixed,
 * timed sequence and the real fetch only gates the EXIT (the `rest → settle`
 * load gate). Props:
 *   loaded       — `cache !== null` in the container; gates the exit.
 *   abbreviated  — `hasSeenPrimer()`; a returning visitor gets the faster timeline.
 *   onExitStart  — fired as the exit fade BEGINS (loader still mounted, fading on
 *                  top). The container opens the primer here so it is already
 *                  present underneath and the loader cross-fades INTO it — no
 *                  beat of blank screen, no late modal pop-in.
 *   onComplete   — fired after the exit fade completes; the container unmounts
 *                  the loader (`setBooted(true)`) on this call.
 *
 * State machine (timer-driven; all timers tracked in a ref and cleared on
 * unmount — StrictMode-safe; NO setState synchronously inside an effect — state
 * is only set in handlers / timer callbacks):
 *
 *   intro? → hold → collapse(drop a→we→you→threw) → rest → settle
 *          → kernelHold → exit → onComplete()
 *
 * Word drops are HARD CUTS: surviving tokens are simply rendered (conditional),
 * so flexbox re-centres instantly — no per-word fade or width transition.
 * `settle` is the only animated step, and it is itself ORDERED two stages: the
 * superscripts FADE (opacity → 0), and only THEN do they COLLAPSE (width → 0) so
 * the two kernel words slide together to reclaim the superscript space, leaving a
 * clean centred "surprisal party". The two stages are exposed via `data-settle`
 * (`none → fading → collapsed`) for deterministic capture. On entering `rest` the
 * timeline HOLDS on the kernel until `loaded` is true (the "rests until the cache
 * finishes" gate), then proceeds.
 *
 * Reduced motion (`usePrefersReducedMotion`): skip the staged collapse and
 * crossfade directly from the full phrase to the clean kernel; the holds still
 * apply (shortened) so the message stays legible.
 *
 * SSR / determinism: the initial render is the full phrase (`hold`), identical
 * on the server and client (no hydration mismatch); abbreviated / reduced-motion
 * decisions change only timing, not the initial DOM. `data-phase` exposes the
 * current phase and `data-dropped` lists the words removed so far, for
 * deterministic e2e capture.
 *
 * The phrase tokens are AUTHORED illustrative values (NOT pipeline output),
 * mirroring `PrimerModal`'s hardcoded constants.
 */

type PhraseToken = { text: string; surprisal: number; kernel: boolean };

// "we² threw⁷ you³ a¹ surprisal²⁰ party¹⁸". Authored values, NOT pipeline
// output. Kernel = the two highest-surprisal words, "surprisal" and "party".
const PHRASE: readonly PhraseToken[] = [
  { text: 'we', surprisal: 2, kernel: false },
  { text: 'threw', surprisal: 7, kernel: false },
  { text: 'you', surprisal: 3, kernel: false },
  { text: 'a', surprisal: 1, kernel: false },
  { text: 'surprisal', surprisal: 20, kernel: true },
  { text: 'party', surprisal: 18, kernel: true },
];

// Drop order ascending by surprisal: a(1) → we(2) → you(3) → threw(7). The two
// kernel words never drop. This is the order the words are hard-cut from the line.
const DROP_ORDER: readonly string[] = ['a', 'we', 'you', 'threw'];

// One timings block, full / abbreviated, kept together for tuning. The `settle`
// step is ORDERED two stages — the superscripts first fade (opacity), then
// collapse (width) so the kernel words slide together. `settleFade` +
// `settleCollapse` keep the total in the same ballpark as the old single
// `settle` constant (300 / 250 ms).
type Timings = {
  hold: number;
  dropInterval: number;
  settleFade: number;
  settleCollapse: number;
  kernelHold: number;
  exit: number;
};

const FULL_TIMINGS: Timings = {
  hold: 2000,
  dropInterval: 450,
  settleFade: 150,
  settleCollapse: 150,
  kernelHold: 2000,
  exit: 400,
};

const ABBREVIATED_TIMINGS: Timings = {
  hold: 500,
  dropInterval: 200,
  settleFade: 125,
  settleCollapse: 125,
  kernelHold: 700,
  exit: 400,
};

// The phases the root's `data-phase` exposes. `intro` is the very first paint
// (a synonym for the held full phrase); the resting/initial DOM is the full
// phrase either way.
type Phase =
  | 'hold'
  | 'collapse'
  | 'rest'
  | 'settle'
  | 'kernelHold'
  | 'exit'
  | 'done';

export function LoadingScreen({
  loaded,
  abbreviated,
  onExitStart,
  onComplete,
}: {
  loaded: boolean;
  abbreviated: boolean;
  onExitStart?: () => void;
  onComplete: () => void;
}) {
  const reduce = usePrefersReducedMotion();
  const timings = abbreviated ? ABBREVIATED_TIMINGS : FULL_TIMINGS;

  // The boot mode is read after mount (SSR-safe): the server render is always
  // the default full-phrase hold. `manual` suspends the timers; `stall` pins
  // the load gate so the screen rests on the kernel forever.
  const [bootMode, setBootMode] = useState<BootMode>('default');

  // Phase + the count of words dropped so far (0..DROP_ORDER.length). The
  // initial render is the full phrase held (`hold`), matching the server.
  const [phase, setPhase] = useState<Phase>('hold');
  const [droppedCount, setDroppedCount] = useState(0);
  // The `settle` step is ordered: `faded` flips first (superscripts → opacity 0),
  // then `collapsed` (superscripts → width 0, so the kernel words slide
  // together). Kept separate from `phase` so the exit fade can keep the clean
  // kernel rendered. `data-settle` derives `none → fading → collapsed` from them.
  const [faded, setFaded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // All pending timers live here so unmount (incl. StrictMode's double-mount)
  // can clear every one — no setState after unmount.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  }, []);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  // `loaded` is read inside async timer callbacks; a ref keeps the gate honest
  // without re-subscribing the whole timeline when the flag flips mid-rest.
  // `?boot=stall` pins it false so the screen rests on the kernel forever.
  const loadedRef = useRef(loaded);
  const onCompleteRef = useRef(onComplete);
  const onExitStartRef = useRef(onExitStart);
  // Sync the live props/mode into the refs from an effect (the repo forbids ref
  // writes during render). The timer callbacks read `.current` when they fire.
  useEffect(() => {
    loadedRef.current = bootMode === 'stall' ? false : loaded;
    onCompleteRef.current = onComplete;
    onExitStartRef.current = onExitStart;
  });

  // --- The timeline steps, shared by the timed and manual drivers. ---------
  // Each step performs its state change and (in timed mode) schedules the next.
  // In manual mode the scheduling is skipped and the step is invoked directly
  // by `window.__boot.next()`.

  const finishExit = useCallback(() => {
    setPhase('done');
    onCompleteRef.current();
  }, []);

  const startExit = useCallback(
    (timed: boolean) => {
      setPhase('exit');
      // Reveal the primer NOW (loader still fading on top) so the loader
      // cross-fades into an already-present modal rather than popping it in
      // after the fade. Fired in both timed and manual modes (shared step).
      onExitStartRef.current?.();
      if (timed) schedule(finishExit, timings.exit);
    },
    [finishExit, schedule, timings.exit],
  );

  const startKernelHold = useCallback(
    (timed: boolean) => {
      setPhase('kernelHold');
      if (timed) schedule(() => startExit(true), timings.kernelHold);
    },
    [schedule, startExit, timings.kernelHold],
  );

  // Settle stage 2: collapse the (already-faded) superscripts' width so the two
  // kernel words slide together into the reclaimed space.
  const startSettleCollapse = useCallback(
    (timed: boolean) => {
      setCollapsed(true);
      if (timed) schedule(() => startKernelHold(true), timings.settleCollapse);
    },
    [schedule, startKernelHold, timings.settleCollapse],
  );

  // Settle stage 1: fade the superscripts out (opacity only — they still occupy
  // their width). The width collapse follows once the fade completes, so the
  // slide-together reads as a distinct second beat, not simultaneous.
  const startSettle = useCallback(
    (timed: boolean) => {
      setPhase('settle');
      setFaded(true);
      if (timed) schedule(() => startSettleCollapse(true), timings.settleFade);
    },
    [schedule, startSettleCollapse, timings.settleFade],
  );

  // The load gate: enter `rest` and only proceed to `settle` once `loaded` is
  // true. In timed mode we poll the ref on a short interval-via-timeout so we
  // never setState synchronously and never throttle the real fetch.
  const enterRest = useCallback(
    (timed: boolean) => {
      setPhase('rest');
      if (!timed) return;
      const waitForLoad = () => {
        if (loadedRef.current) {
          startSettle(true);
        } else {
          schedule(waitForLoad, 80);
        }
      };
      waitForLoad();
    },
    [schedule, startSettle],
  );

  // Drop the next word (hard cut). When the last droppable word is gone we are
  // on the kernel, so the next step is the load gate. `dropNext` self-schedules
  // the subsequent drop in timed mode; the recursive call goes through a ref to
  // avoid referencing the callback before it is declared. The next-drop count is
  // tracked in a ref (not derived inside the `setDroppedCount` updater) so the
  // chained timer is scheduled synchronously in the callback body — this keeps
  // the whole staged collapse advancing under a single fake-timer tick in tests.
  const dropProgress = useRef(0);
  const dropNextRef = useRef<(timed: boolean) => void>(() => {});
  const dropNext = useCallback(
    (timed: boolean) => {
      const next = dropProgress.current + 1;
      dropProgress.current = next;
      setDroppedCount(next);
      setPhase('collapse');
      if (timed) {
        if (next < DROP_ORDER.length) {
          schedule(() => dropNextRef.current(true), timings.dropInterval);
        } else {
          schedule(() => enterRest(true), timings.dropInterval);
        }
      }
    },
    [enterRest, schedule, timings.dropInterval],
  );
  useEffect(() => {
    dropNextRef.current = dropNext;
  }, [dropNext]);

  const startCollapse = useCallback(
    (timed: boolean) => {
      dropNext(timed);
    },
    [dropNext],
  );

  // --- Drivers. The timed driver runs the whole timeline; reduced motion
  // skips the staged collapse and crossfades straight to the kernel. -------

  const runTimed = useCallback(() => {
    if (reduce) {
      // Crossfade: hold the full phrase, drop ALL words at once (no staged
      // collapse), then the load gate → clean kernel → hold → exit.
      schedule(() => {
        setDroppedCount(DROP_ORDER.length);
        enterRest(true);
      }, timings.hold);
      return;
    }
    schedule(() => startCollapse(true), timings.hold);
  }, [enterRest, reduce, schedule, startCollapse, timings.hold]);

  // The manual driver: build the ordered list of steps and advance one per
  // `next()` call. Mirrors the timed sequence but never schedules anything.
  const manualStep = useRef(0);
  const manualNext = useCallback(() => {
    const steps: Array<() => void> = reduce
      ? [
          // reduced motion: hold → (drop all) rest → settle(fade → collapse) → kernelHold → exit → done
          () => {
            setDroppedCount(DROP_ORDER.length);
            enterRest(false);
          },
          () => startSettle(false),
          () => startSettleCollapse(false),
          () => startKernelHold(false),
          () => startExit(false),
          () => finishExit(),
        ]
      : [
          // full: each word drop is its own step, then rest, settle(fade →
          // collapse), kernelHold, exit, done
          ...DROP_ORDER.map(() => () => dropNext(false)),
          () => enterRest(false),
          () => startSettle(false),
          () => startSettleCollapse(false),
          () => startKernelHold(false),
          () => startExit(false),
          () => finishExit(),
        ];
    const i = manualStep.current;
    if (i >= steps.length) return;
    steps[i]();
    manualStep.current = i + 1;
  }, [
    reduce,
    dropNext,
    enterRest,
    finishExit,
    startExit,
    startKernelHold,
    startSettle,
    startSettleCollapse,
  ]);

  // Resolve the boot mode and kick off the right driver after mount. setState
  // happens in the rAF callback (not synchronously in the effect body), and all
  // timers are cleared on unmount.
  useEffect(() => {
    const mode = resolveBootMode();
    const raf = requestAnimationFrame(() => {
      setBootMode(mode);
      if (mode === 'manual') {
        manualStep.current = 0;
        window.__boot = { next: () => manualNext() };
      } else {
        // 'default' and 'stall' both run the timed timeline; 'stall' just pins
        // the load gate via `loadedRef` so it rests on the kernel forever.
        runTimed();
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimers();
      if (window.__boot) delete window.__boot;
    };
    // Intentionally run once on mount. The timeline reads `loaded`/`reduce`
    // through refs/closures captured here; re-running would restart the
    // ceremony. `manualNext` is stable enough for this one-shot wiring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const droppedWords = DROP_ORDER.slice(0, droppedCount);
  const droppedSet = new Set(droppedWords);

  // The exit fade. Once we reach `exit`/`done` the whole screen fades out.
  const exiting = phase === 'exit' || phase === 'done';
  const exitTransition = reduce
    ? 'motion-reduce:transition-none'
    : `transition-opacity ease-out`;

  // The two ordered settle stages. `faded` drives the opacity transition;
  // `collapsed` (only after the fade) drives the width transition so the kernel
  // words slide together as a distinct second beat. `data-settle` exposes the
  // stage for deterministic capture.
  const settleStage = collapsed ? 'collapsed' : faded ? 'fading' : 'none';

  // One transition declaration covering BOTH animated properties, in the order
  // `opacity, max-width`, so the per-property durations below line up. The two
  // beats are ordered by WHEN each property changes (faded flips first, collapsed
  // second), not by the transition declaration.
  const supTransition = reduce
    ? 'motion-reduce:transition-none'
    : 'transition-[opacity,max-width] ease-out';

  return (
    <div
      data-loading-screen=""
      data-phase={phase}
      data-dropped={droppedWords.join(',')}
      data-settle={settleStage}
      role="status"
      aria-label="Loading"
      className={`fixed inset-0 z-[70] flex items-center justify-center bg-ground px-8 ${exitTransition}`}
      style={{
        opacity: exiting ? 0 : 1,
        transitionDuration: reduce ? undefined : `${timings.exit}ms`,
      }}
    >
      {/* A single, stable announcement for assistive tech. The animated phrase
          below is `aria-hidden` (it is the VISUAL indicator only); without this
          the collapsing word spans would re-announce the phrase on every drop.
          One quiet "Loading…" in a polite live region is all a SR user hears. */}
      <span className="sr-only" aria-live="polite">
        Loading…
      </span>
      {/* `gap-x` supplies the inter-word space so a hard cut re-centres cleanly
          (no trailing-space spans to manage as words drop). */}
      {/* A plain inline flow (NOT flex) so the native <sup> superscript baseline
          shift applies; `gap`-style spacing is supplied as a right margin on
          each word wrapper. Flex would make the <sup> a flex item and strip its
          vertical-align, dropping it to the baseline. */}
      <p
        aria-hidden="true"
        className="max-w-[90vw] text-center text-[32px] leading-[1.4] text-prose"
      >
        {PHRASE.map((token, i) => {
          if (droppedSet.has(token.text)) return null; // hard cut
          const last = i === PHRASE.length - 1;
          return (
            <span
              key={token.text}
              data-token={token.text}
              data-kernel={token.kernel}
              className="whitespace-nowrap"
              // Inter-word space; a hard cut just stops rendering the wrapper, so
              // the surviving words re-centre cleanly.
              style={{ marginRight: last ? undefined : '0.32em' }}
            >
              <span className={token.kernel ? 'text-kernel' : ''}>
                {token.text}
              </span>
              {/* Native superscript. Tailwind's preflight resets `sup` to
                  vertical-align:baseline, so the raise is re-applied via
                  `align-super`. The inner span settles in two ordered beats:
                  first opacity → 0 (fade), then max-width → 0 (collapse), so the
                  kernel words slide into the reclaimed space as a second beat.
                  The whole phrase is `aria-hidden` on the parent <p>, so this is
                  a purely visual element. */}
              <sup
                data-sup=""
                className="ml-[1px] align-super text-[16px] leading-none font-normal text-faint"
              >
                <span
                  className={`inline-block overflow-hidden align-baseline leading-none ${supTransition} ${
                    faded ? 'opacity-0' : 'opacity-100'
                  } ${collapsed ? 'max-w-0' : 'max-w-[3em]'}`}
                  style={{
                    // Per-property durations, matching the `opacity, max-width`
                    // order of the transition declaration above.
                    transitionDuration: reduce
                      ? undefined
                      : `${timings.settleFade}ms, ${timings.settleCollapse}ms`,
                  }}
                >
                  {token.surprisal}
                </span>
              </sup>
            </span>
          );
        })}
      </p>
    </div>
  );
}
