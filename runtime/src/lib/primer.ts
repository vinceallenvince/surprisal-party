/**
 * Onboarding-primer persistence + dev-override logic (Phase 2, Step 6).
 *
 * The primer shows once per visitor, gated by a persisted seen-flag in
 * `localStorage`. All access is client-only and guarded so the static export /
 * prerender (where `window` is absent) never touches it — see the deferred
 * read in `ExplorerContainer`, which only calls these after mount.
 *
 * A development override (`NEXT_PUBLIC_FORCE_INTRO` env truthy, or an `?intro`
 * query param) forces the primer to appear on load regardless of the flag. The
 * override deliberately changes ONLY whether the modal renders — it must never
 * mutate the persisted seen record (per the implementation plan), so iterating
 * on the modal does not require clearing browser storage. See `markPrimerSeen`,
 * which is called on dismiss in both the normal and overridden cases; the
 * override's value comes from `shouldForcePrimer`, never from the stored flag.
 */

export const PRIMER_SEEN_KEY = 'surprisalParty.primerSeen';

/** Whether the visitor has already seen and dismissed the primer. */
export function hasSeenPrimer(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PRIMER_SEEN_KEY) === 'true';
  } catch {
    // Private-mode / disabled storage: treat as not-seen (show once this load).
    return false;
  }
}

/** Record that the primer has been seen. Never called for the dev-override path. */
export function markPrimerSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PRIMER_SEEN_KEY, 'true');
  } catch {
    // Storage unavailable — nothing to persist; non-fatal.
  }
}

/**
 * Whether a dev-override forces the primer open on load, independent of the
 * seen-flag. True if the build sets `NEXT_PUBLIC_FORCE_INTRO` truthy, or the
 * URL carries an `?intro` query param (read client-side).
 */
export function shouldForcePrimer(): boolean {
  const env = process.env.NEXT_PUBLIC_FORCE_INTRO;
  if (env && env !== 'false' && env !== '0') return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).has('intro');
  } catch {
    return false;
  }
}

/**
 * The full on-load decision: should the primer show? It shows when forced by
 * the dev-override OR when the visitor has not seen it. Returns whether to show
 * AND whether this is the override path (so the caller knows not to persist the
 * flag on dismiss).
 */
export function resolvePrimerOnLoad(): { show: boolean; forced: boolean } {
  const forced = shouldForcePrimer();
  if (forced) return { show: true, forced: true };
  return { show: !hasSeenPrimer(), forced: false };
}
