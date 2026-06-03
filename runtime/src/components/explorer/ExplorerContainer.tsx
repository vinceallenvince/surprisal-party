'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExplorerShell } from './ExplorerShell';
import { PrimerModal } from './PrimerModal';
import { CorpusDrawer } from './CorpusDrawer';
import { AboutModal } from './AboutModal';
import { renderPosition } from '@/lib/tale-render';
import { markPrimerSeen, resolvePrimerOnLoad } from '@/lib/primer';
import { DEFAULT_CORPUS_SLUG } from '@/lib/corpora';
import {
  parseTaleCache,
  SUPPORTED_SCHEMA_VERSION,
  type TaleCache,
} from '@/types/tale-cache';

/**
 * Client-side data binding for the explorer (Step 2).
 *
 * Per `runtime/CLAUDE.md`, tale JSON is fetched in the browser from
 * `public/tales/<slug>.json` (static export — no server fetch). This is why
 * the data-bound layer is a client component. It fetches the one hardcoded
 * LRRH cache, validates it against the schema, then renders one fixed
 * mid-slider position into the shell. Corpus *switching* is out of scope
 * (Step 7); the slug is hardcoded here.
 *
 * Step 3 lifts the slider's selected position into this container: a single
 * `selectedPositionIndex` (0–4, default 0 = UNCOMPRESSED) drives both the
 * re-derived `renderPosition` output and the controlled slider. Position swaps
 * are instantaneous (no animation — that is Step 4).
 *
 * Loading / error handling is intentionally minimal — a null-guard skeleton.
 * Full loading / error / slow-network states are Phase 3.
 *
 * Step 6 also lifts the active corpus slug into this container as state
 * (replacing the former hardcoded `TALE_SLUG` constant), seeded from the
 * corpus manifest's default. The cache-fetch effect keys on `slug`, so it
 * re-fetches whenever the slug changes. The corpus-picker drawer's open/closed
 * state lives here too; selecting a corpus (`handleSelectCorpus`) sets the slug
 * (→ re-fetch), resets `selectedPositionIndex` to 0 (UNCOMPRESSED — which also
 * clears any active seam downstream), and closes the drawer. Selecting the
 * already-current corpus still closes + resets (harmless). The brief load
 * between corpora reuses the same null-guard skeleton: `cache` is cleared on
 * switch so the skeleton shows until the new cache resolves.
 *
 * Step 6 lifts the onboarding primer's open/closed state here. First-visit
 * gating must be SSR/static-export safe: the prerendered HTML cannot read
 * `localStorage`, so the modal starts closed (matching the server render → no
 * hydration mismatch) and the on-load decision is made AFTER mount, inside a
 * `requestAnimationFrame` (not synchronously in the effect body — that would
 * trip the repo's "no setState in an effect" rule). On dismiss the seen-flag is
 * persisted UNLESS the modal was forced open by the dev-override, which must
 * not mutate the flag. The header ⓘ re-summons the primer at any time via
 * `handleShowPrimer`, regardless of the flag and without touching it.
 *
 * Step 6 also lifts the About modal's open/closed state here. The drawer's
 * quiet "About" link calls `handleShowAbout`, which sets `drawerOpen=false` and
 * `aboutOpen=true` in the same step so the two dialogs never stack (drawer →
 * modal). Dismissing the About modal (`handleDismissAbout`) just closes it.
 */

export function ExplorerContainer() {
  // The active corpus slug, seeded from the manifest default. The cache-fetch
  // effect keys on this; changing it re-fetches the matching tale JSON.
  const [slug, setSlug] = useState(DEFAULT_CORPUS_SLUG);
  const [cache, setCache] = useState<TaleCache | null>(null);
  // Default to UNCOMPRESSED (far left, index 0). The slider is the only writer.
  const [selectedPositionIndex, setSelectedPositionIndex] = useState(0);

  // Corpus-picker drawer visibility (collapsed by default).
  const [drawerOpen, setDrawerOpen] = useState(false);

  // About modal visibility (closed by default; opened from the drawer's About
  // link, which closes the drawer in the same step so two dialogs never stack).
  const [aboutOpen, setAboutOpen] = useState(false);

  // Primer visibility. Starts closed to match the static prerender (no
  // hydration mismatch); the real first-visit decision lands after mount.
  const [primerOpen, setPrimerOpen] = useState(false);
  // True while the open modal was forced by the dev-override; dismissing in
  // that state must NOT persist the seen-flag.
  const [primerForced, setPrimerForced] = useState(false);

  const handlePositionChange = useCallback((index: number) => {
    setSelectedPositionIndex(index);
  }, []);

  const handleToggleDrawer = useCallback(() => {
    setDrawerOpen((open) => !open);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  // Opening About from the drawer transitions drawer → modal: close the drawer
  // and open the About modal in the same step (no stacked dialogs). Focus
  // restoration on About close targets the drawer's About link, which is gone
  // by then; the browser falls back to <body>, matching the primer's behaviour
  // when its opener is unmounted.
  const handleShowAbout = useCallback(() => {
    setDrawerOpen(false);
    setAboutOpen(true);
  }, []);

  const handleDismissAbout = useCallback(() => {
    setAboutOpen(false);
  }, []);

  // Selecting a (different) corpus loads it fresh: switch the slug (→ re-fetch),
  // snap the slider back to UNCOMPRESSED (which also clears any active seam
  // downstream), and close the drawer. The fetch effect clears `cache` on a slug
  // change so the skeleton shows until the new cache resolves.
  //
  // The current corpus is non-interactive in the drawer, so `next` should never
  // equal `slug`; the guard is defensive — nulling `cache` for a same-slug pick
  // would strand the app on the skeleton (the `[slug]` effect wouldn't re-run).
  const handleSelectCorpus = useCallback(
    (next: string) => {
      setDrawerOpen(false);
      if (next === slug) {
        setSelectedPositionIndex(0);
        return;
      }
      setSelectedPositionIndex(0);
      setCache(null);
      setSlug(next);
    },
    [slug],
  );

  // First-visit gating, deferred past mount via rAF so the setState happens in
  // the frame callback rather than synchronously in the effect body.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const { show, forced } = resolvePrimerOnLoad();
      setPrimerForced(forced);
      setPrimerOpen(show);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleDismissPrimer = useCallback(() => {
    // Persist the seen-flag only for a genuine first-visit dismissal; the
    // dev-override path leaves the stored record untouched. (`markPrimerSeen`
    // runs in the handler, not in a state updater, so it stays StrictMode-safe.)
    if (!primerForced) markPrimerSeen();
    setPrimerForced(false);
    setPrimerOpen(false);
  }, [primerForced]);

  // Header ⓘ re-summon — opens the primer at any time, never as the override
  // path (so dismissing it still records the flag, harmlessly idempotent).
  const handleShowPrimer = useCallback(() => {
    setPrimerForced(false);
    setPrimerOpen(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/tales/${slug}.json`);
      const json: unknown = await res.json();
      const parsed = parseTaleCache(json);
      if (parsed.schema_version !== SUPPORTED_SCHEMA_VERSION) {
        // The runtime can refuse caches it does not understand. Richer
        // version-mismatch UX is out of Step 2 scope.
        throw new Error(
          `Unsupported tale-cache schema_version "${parsed.schema_version}" ` +
            `(runtime supports ${SUPPORTED_SCHEMA_VERSION}).`,
        );
      }
      if (!cancelled) setCache(parsed);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Minimal null-guard skeleton until the cache resolves.
  if (!cache) {
    return (
      <div
        className="flex h-screen min-w-[1024px] items-center justify-center bg-ground text-faint"
        aria-busy="true"
      >
        <span className="text-sm">Loading corpus…</span>
      </div>
    );
  }

  // Clamp defensively in case a cache ever ships fewer positions than the
  // slider's five stops; the derivation is re-run per selected index.
  const positionIndex = Math.min(
    selectedPositionIndex,
    cache.positions.length - 1,
  );
  const rendered = renderPosition(cache, positionIndex);

  // Reveal-flash count falls off exponentially as compression deepens, anchored
  // at 2 for the deepest position and doubling toward shallower ones:
  // 2^(stopCount - index). e.g. 5 stops → 25%:16, 50%:8, 75%:4, MAX:2.
  // UNCOMPRESSED has no seams, so its count is moot. The actual reveal is capped
  // by the seams available in the top quarter.
  const revealCount = 2 ** (cache.positions.length - positionIndex);

  // The pool the reveals are drawn from grows with compression: ~10% of the
  // seams at the far left (long prose → keep reveals near the top, above the
  // fold) up to 100% at MAX (short constellation → draw from anywhere).
  const stopCount = cache.positions.length;
  const selectFraction =
    stopCount > 1 ? 0.1 + 0.9 * (positionIndex / (stopCount - 1)) : 1;

  return (
    <>
      <ExplorerShell
        corpusTitle={cache.metadata.title}
        rendered={rendered}
        selectedIndex={positionIndex}
        revealCount={revealCount}
        selectFraction={selectFraction}
        onPositionChange={handlePositionChange}
        onShowPrimer={handleShowPrimer}
        drawerOpen={drawerOpen}
        onToggleDrawer={handleToggleDrawer}
      />
      {drawerOpen ? (
        <CorpusDrawer
          currentSlug={slug}
          onSelect={handleSelectCorpus}
          onClose={handleCloseDrawer}
          onAbout={handleShowAbout}
        />
      ) : null}
      {aboutOpen ? <AboutModal onDismiss={handleDismissAbout} /> : null}
      {primerOpen ? <PrimerModal onDismiss={handleDismissPrimer} /> : null}
    </>
  );
}
