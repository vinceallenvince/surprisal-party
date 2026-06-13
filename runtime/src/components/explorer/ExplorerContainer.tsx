'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExplorerShell } from './ExplorerShell';
import { PrimerModal } from './PrimerModal';
import { CorpusDrawer } from './CorpusDrawer';
import { AboutModal } from './AboutModal';
import { MetricsModal } from './MetricsModal';
import { LoadingScreen } from './LoadingScreen';
import { renderPosition } from '@/lib/tale-render';
import {
  hasSeenPrimer,
  markPrimerSeen,
  resolvePrimerOnLoad,
} from '@/lib/primer';
import { resolveBootMode } from '@/lib/boot';
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
 * quiet "About" link calls `handleShowAbout`, which opens the About modal WHILE
 * leaving the drawer open: About stacks ABOVE the drawer (matching the Figma
 * frame, which shows the drawer open behind About). Dismissing the About modal
 * (`handleDismissAbout`) just closes it and returns the user to the still-open
 * drawer — matching the "the modal closes and I return to the drawer" scenario.
 * While About is open the drawer steps aside for it: the drawer drops its own
 * Esc/scrim handling and `aria-modal` (see `CorpusDrawer`) so About alone is the
 * active, topmost modal.
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
  // link. About stacks ABOVE the still-open drawer rather than replacing it).
  const [aboutOpen, setAboutOpen] = useState(false);

  // Metrics-explainer modal visibility (opened from the header's metrics ⓘ).
  const [metricsOpen, setMetricsOpen] = useState(false);

  // Primer visibility. Starts closed to match the static prerender (no
  // hydration mismatch); the real first-visit decision lands after mount.
  const [primerOpen, setPrimerOpen] = useState(false);
  // True while the open modal was forced by the dev-override; dismissing in
  // that state must NOT persist the seen-flag.
  const [primerForced, setPrimerForced] = useState(false);

  // Boot gating. While `!booted` the LoadingScreen ceremony plays as a fixed
  // overlay over the (warming) explorer; it reveals on its `onComplete`. Starts
  // `true` to match the static prerender (no overlay on the server); the real
  // boot decision lands after mount, where `?boot=skip` can bypass the loader.
  const [booted, setBooted] = useState(true);
  // `abbreviated` (the returning-visitor faster timeline) and the loader's
  // first-visit-vs-returning behaviour are read after mount — SSR-safe, the same
  // deferral the primer gating uses. `abbreviated` is only meaningful while the
  // loader is shown.
  const [abbreviated, setAbbreviated] = useState(false);

  const handlePositionChange = useCallback((index: number) => {
    setSelectedPositionIndex(index);
  }, []);

  const handleToggleDrawer = useCallback(() => {
    setDrawerOpen((open) => !open);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  // Opening About from the drawer stacks About ABOVE the drawer: the drawer
  // stays open behind About's scrim, matching the Figma frame. About's higher
  // z-index and the drawer stepping aside (dropping its Esc/scrim handling and
  // `aria-modal` while About is open — see `CorpusDrawer`) make About the
  // active, topmost modal. Dismissing About returns to the still-open drawer,
  // and focus restores to the drawer's About link (still mounted).
  const handleShowAbout = useCallback(() => {
    setAboutOpen(true);
  }, []);

  const handleDismissAbout = useCallback(() => {
    setAboutOpen(false);
  }, []);

  const handleShowMetrics = useCallback(() => {
    setMetricsOpen(true);
  }, []);

  const handleDismissMetrics = useCallback(() => {
    setMetricsOpen(false);
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

  // Open the primer per the first-visit decision (forced override OR not-seen).
  // Shared by the loader's `onComplete` and the `?boot=skip` on-mount path.
  const resolvePrimer = useCallback(() => {
    const { show, forced } = resolvePrimerOnLoad();
    setPrimerForced(forced);
    setPrimerOpen(show);
  }, []);

  // The loader's exit fade BEGINS: run the first-visit primer decision now, so
  // the primer mounts UNDERNEATH the still-fading loader and the loader
  // cross-fades into an already-present modal (no blank beat, no late pop-in).
  // First visit → open primer; returning → no-op (reveal only). The loader
  // (z-70) sits above the primer (z-50), so the primer's own entrance is masked
  // until the loader has faded away.
  const handleBootExitStart = useCallback(() => {
    resolvePrimer();
  }, [resolvePrimer]);

  // The loader's exit fade COMPLETES: unmount it. The explorer was already
  // warming underneath and (for a first visit) the primer is already open.
  const handleBootComplete = useCallback(() => {
    setBooted(true);
  }, []);

  // Boot decision, deferred past mount via rAF so the setState happens in the
  // frame callback rather than synchronously in the effect body (the repo's
  // "no setState in an effect" rule). `?boot=skip` bypasses the loader entirely
  // and goes straight to the existing on-mount primer resolution; every other
  // mode shows the loader, which runs the primer decision on its `onComplete`.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (resolveBootMode() === 'skip') {
        resolvePrimer();
        return;
      }
      setAbbreviated(hasSeenPrimer());
      setBooted(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [resolvePrimer]);

  // Replay shortcut: Shift+Cmd+L (mac) / Shift+Ctrl+L (win) replays the full
  // ceremony by resetting `booted` to false. Available in production (NOT
  // dev-gated). `preventDefault` is required — Cmd+L focuses the address bar.
  // The cache is already loaded on replay, so the loader's `loaded` prop is
  // immediately true and the timeline runs straight through to the exit.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setAbbreviated(hasSeenPrimer());
        setBooted(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
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

  // The boot loader sits in front of everything while `!booted`, gating ONLY
  // the default corpus's first paint. It overlays the (warming) explorer and
  // reveals on its `onComplete` (`loaded = cache !== null` gates its exit). The
  // replay shortcut re-enters this with the cache already loaded. Rendered as a
  // fixed overlay so it covers whatever is (or isn't yet) underneath.
  const loader = !booted ? (
    <LoadingScreen
      loaded={cache !== null}
      abbreviated={abbreviated}
      onExitStart={handleBootExitStart}
      onComplete={handleBootComplete}
    />
  ) : null;

  // Null-guard until the cache resolves. The "Loading corpus…" skeleton still
  // covers corpus SWITCHING (where `booted` stays true and `cache` is cleared);
  // during boot the LoadingScreen overlay sits on top of it, so it's never seen.
  if (!cache) {
    return (
      <>
        <div
          className="flex h-dvh items-center justify-center bg-ground text-faint md:min-w-[1024px]"
          aria-busy="true"
        >
          <span className="text-sm">Loading corpus…</span>
        </div>
        {loader}
      </>
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
        onShowMetrics={handleShowMetrics}
        drawerOpen={drawerOpen}
        onToggleDrawer={handleToggleDrawer}
      />
      {loader}
      {drawerOpen ? (
        <CorpusDrawer
          currentSlug={slug}
          onSelect={handleSelectCorpus}
          onClose={handleCloseDrawer}
          onAbout={handleShowAbout}
          // While About is stacked above, the drawer steps aside: it drops its
          // Esc/scrim handling, focus trap, and `aria-modal` so About alone is
          // the active modal.
          inert={aboutOpen}
        />
      ) : null}
      {aboutOpen ? <AboutModal onDismiss={handleDismissAbout} /> : null}
      {metricsOpen ? <MetricsModal onDismiss={handleDismissMetrics} /> : null}
      {primerOpen ? <PrimerModal onDismiss={handleDismissPrimer} /> : null}
    </>
  );
}
