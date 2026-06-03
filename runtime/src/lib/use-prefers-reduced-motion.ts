'use client';

import { useSyncExternalStore } from 'react';

/**
 * Shared `prefers-reduced-motion: reduce` hook.
 *
 * Reads the media query via `useSyncExternalStore` so it is SSR/static-export
 * safe: the server snapshot is always `false` (no animation assumed during
 * prerender), and the client subscribes to live changes after hydration — no
 * setState-in-effect, no hydration mismatch on the resting (false) value.
 *
 * Originally local to `ProseColumn`; lifted here so the primer modal and the
 * prose column share one implementation.
 */

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCE_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(REDUCE_QUERY).matches;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
