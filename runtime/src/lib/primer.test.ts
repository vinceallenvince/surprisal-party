import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PRIMER_SEEN_KEY,
  hasSeenPrimer,
  markPrimerSeen,
  shouldForcePrimer,
  resolvePrimerOnLoad,
} from './primer';

/**
 * Primer gating + dev-override logic. The seen-flag lives in localStorage; the
 * override (`NEXT_PUBLIC_FORCE_INTRO` / `?intro`) forces the primer without
 * mutating that flag.
 */

describe('primer gating', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Reset the query string between tests (jsdom default is "").
    window.history.replaceState(null, '', '/');
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('first-visit: not seen → show, not forced, flag untouched', () => {
    expect(hasSeenPrimer()).toBe(false);
    expect(resolvePrimerOnLoad()).toEqual({ show: true, forced: false });
    expect(window.localStorage.getItem(PRIMER_SEEN_KEY)).toBeNull();
  });

  it('markPrimerSeen persists the flag so a returning visitor is not shown', () => {
    markPrimerSeen();
    expect(window.localStorage.getItem(PRIMER_SEEN_KEY)).toBe('true');
    expect(hasSeenPrimer()).toBe(true);
    expect(resolvePrimerOnLoad()).toEqual({ show: false, forced: false });
  });

  it('?intro forces the primer even for a returning visitor, marked forced', () => {
    markPrimerSeen();
    window.history.replaceState(null, '', '/?intro');
    expect(shouldForcePrimer()).toBe(true);
    expect(resolvePrimerOnLoad()).toEqual({ show: true, forced: true });
  });

  it('NEXT_PUBLIC_FORCE_INTRO truthy forces the primer', () => {
    markPrimerSeen();
    vi.stubEnv('NEXT_PUBLIC_FORCE_INTRO', '1');
    expect(shouldForcePrimer()).toBe(true);
    expect(resolvePrimerOnLoad()).toEqual({ show: true, forced: true });
  });

  it('NEXT_PUBLIC_FORCE_INTRO falsey values do not force', () => {
    vi.stubEnv('NEXT_PUBLIC_FORCE_INTRO', 'false');
    expect(shouldForcePrimer()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_FORCE_INTRO', '0');
    expect(shouldForcePrimer()).toBe(false);
  });

  it('the override never mutates the seen-flag', () => {
    window.history.replaceState(null, '', '/?intro');
    expect(resolvePrimerOnLoad()).toEqual({ show: true, forced: true });
    // Reading the override left storage untouched (it was never seen).
    expect(window.localStorage.getItem(PRIMER_SEEN_KEY)).toBeNull();
  });
});
