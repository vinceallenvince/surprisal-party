/**
 * Boot-control query params for the loading ceremony (a test + dev affordance,
 * with no design frame — paralleling `lib/primer`'s `?intro` override).
 *
 * The loading screen sits in front of the entire app, so it must be steerable
 * deterministically for e2e capture and local iteration. These overrides are
 * read client-side only, never touch `localStorage`, and are inert without the
 * param (the default boot runs the full timer-driven ceremony).
 *
 *   ?boot=skip    — skip the loader entirely; mount the explorer immediately
 *                   (so non-loading e2e specs aren't blocked by the ceremony).
 *   ?boot=manual  — mount the loader but SUSPEND its timers; the state machine
 *                   advances exactly one named state per call to the
 *                   `window.__boot.next()` hook (attached only in this mode).
 *                   This lets the loading spec capture each keyframe with no
 *                   timing race (the mid-collapse window is otherwise ~450 ms).
 *   ?boot=stall   — run the full timeline but hold `loaded=false` forever, so
 *                   the screen rests on the kernel (verifies rest-until-loaded).
 *
 * Static-export / SSR safe: every read guards `window`, and the server snapshot
 * is always "default" so the initial render is identical on the client.
 */

export type BootMode = 'default' | 'skip' | 'manual' | 'stall';

/** Read the `?boot=` query param, defaulting to the normal timed ceremony. */
export function resolveBootMode(): BootMode {
  if (typeof window === 'undefined') return 'default';
  try {
    const value = new URLSearchParams(window.location.search).get('boot');
    if (value === 'skip' || value === 'manual' || value === 'stall') {
      return value;
    }
  } catch {
    // Malformed search string — fall through to the default ceremony.
  }
  return 'default';
}

/**
 * The deterministic step hook attached to `window` only in `?boot=manual`. The
 * loading spec calls `window.__boot.next()` between screenshots to advance the
 * state machine one named phase at a time.
 */
export type BootManualHook = {
  next: () => void;
};

declare global {
  interface Window {
    __boot?: BootManualHook;
  }
}
