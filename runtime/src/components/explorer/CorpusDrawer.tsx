'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';
import { CORPORA, type Corpus } from '@/lib/corpora';

/**
 * Corpus-picker drawer — the left-edge overlay summoned by the rail icon
 * (Phase 2, Step 6; Figma node 28-297). Implements the "open the corpus picker
 * to switch corpora" and "selecting a corpus loads it fresh" scenarios.
 *
 * Behaviour (scenario is the authority):
 *   - Collapsed by default; the parent renders this only while open (so "open"
 *     means "mounted", matching PrimerModal).
 *   - Slides in from the LEFT edge as an OVERLAY over a scrim. The scrim dims
 *     (does not remove) the explorer and intercepts pointer events, so the
 *     middle column does NOT reflow behind it.
 *   - Headed "CORPORA"; a quiet vertical list of corpora, each a title + one
 *     small meta line (word count). The currently-loaded corpus is marked with
 *     a coral title and an accent dot. No thumbnails.
 *   - Dismiss: click any corpus (including the current one), click the scrim,
 *     or press Esc. (The rail icon toggling closed is handled by the parent,
 *     which stops rendering this.)
 *
 * a11y mirrors PrimerModal: `role="dialog"` + `aria-modal`, labelled by the
 * "CORPORA" heading, focus moved into the panel on open and restored to the
 * opener (the rail icon) on close, Esc closes, a Tab focus-trap stays within
 * the panel. The slide respects `prefers-reduced-motion` (instant).
 *
 * Selecting a corpus calls `onSelect(slug)`; the parent re-fetches and resets
 * the view (slider → UNCOMPRESSED). The currently-loaded corpus is marked with
 * a coral title and accent dot but is still clickable — tapping it closes the
 * drawer (the parent handles the same-slug case).
 *
 * Below the corpus list, separated by a thin divider, a single quiet "About"
 * link sits at the bottom in a lighter weight than the corpus titles (clearly
 * secondary to the list). It is keyboard-focusable and part of the focus trap.
 * Clicking it calls `onAbout`, which opens the About modal STACKED ABOVE this
 * still-open drawer (the drawer stays mounted behind About's scrim).
 *
 * Stacking with About (`inert` prop): when About is open the drawer steps
 * aside so About alone is the active modal. Two simultaneous
 * `role="dialog" aria-modal="true"` elements confuse screen readers, and two
 * document-level Esc/Tab handlers + two scrims would fight each other. So while
 * `inert` is true the drawer (a) drops its `aria-modal` (it is no longer the
 * active modal — About is) and marks itself `aria-hidden`/`inert` to drop out
 * of the AT tree, and (b) suspends its own Esc-to-close and Tab focus-trap so
 * About owns the keyboard. About's scrim is a separate, higher-z full-viewport
 * overlay, so a click on it never reaches the drawer's scrim. This mirrors the
 * `[aria-modal="true"]` keyboard guard in `ProseColumn`.
 */

const HEADING_ID = 'corpus-drawer-heading';

type CorpusDrawerProps = {
  /** Slug of the currently-loaded corpus (marked in the list). */
  currentSlug: string;
  /** Called with the chosen slug; the parent loads it fresh and closes. */
  onSelect: (slug: string) => void;
  /** Closes the drawer without switching (scrim click / Esc). */
  onClose: () => void;
  /** Opens the About modal, stacked above this still-open drawer. */
  onAbout: () => void;
  /**
   * True while the About modal is stacked above the drawer. The drawer steps
   * aside: it drops `aria-modal`, hides from the AT tree, and suspends its
   * Esc/Tab handling so About alone is the active, topmost modal.
   */
  inert?: boolean;
};

export function CorpusDrawer({
  currentSlug,
  onSelect,
  onClose,
  onAbout,
  inert = false,
}: CorpusDrawerProps) {
  const reduce = usePrefersReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);
  // The element focused before the drawer opened (the rail icon), restored on
  // close. Captured + focus moved in the effect commit — a DOM call, not a
  // setState, so it stays clear of the "no setState in an effect" rule and
  // React 19's "no ref reads/writes during render".
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    // Focus the first selectable corpus; if there is none (e.g. only the
    // current corpus exists, which is not a button), focus the panel itself.
    const panel = panelRef.current;
    const firstButton = panel?.querySelector<HTMLButtonElement>('button');
    (firstButton ?? panel)?.focus();
    const opener = openerRef.current;
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  // Esc to close + a Tab focus-trap within the panel. Registered once; reads
  // the live DOM, so no re-subscription is needed.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // While About is stacked above, it owns the keyboard: bail so Esc/Tab
      // dismiss/trap only About, leaving this drawer open underneath. (Belt and
      // suspenders alongside the `inert` dep below, which re-subscribes.)
      if (inert) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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
  }, [onClose, inert]);

  // Scrim click closes; clicks on the panel must not bubble up to it. While
  // About is stacked above, its own higher-z scrim covers this one, so this
  // handler is also short-circuited as a safety net.
  const onScrimClick = useCallback(() => {
    if (inert) return;
    onClose();
  }, [onClose, inert]);

  const scrimTransition = reduce
    ? 'motion-reduce:transition-none'
    : 'transition-opacity duration-200 ease-out';
  const panelTransition = reduce
    ? 'motion-reduce:transition-none'
    : 'transition-transform duration-200 ease-out';

  return (
    <div
      data-corpus-scrim=""
      onClick={onScrimClick}
      className={`fixed inset-0 z-50 bg-black/60 ${scrimTransition}`}
    >
      <div
        ref={panelRef}
        role="dialog"
        // While About is stacked above, the drawer is no longer the active
        // modal — drop `aria-modal` and remove it from the AT tree (`inert` +
        // `aria-hidden`) so only About is announced as the modal. `inert` also
        // blocks pointer/focus into the drawer underneath About's scrim.
        aria-modal={inert ? undefined : 'true'}
        aria-hidden={inert ? 'true' : undefined}
        inert={inert || undefined}
        aria-labelledby={HEADING_ID}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`fixed inset-y-0 left-0 flex w-full flex-col border-r border-seam-strong bg-ground shadow-[0_0_40px_rgba(0,0,0,0.4)] outline-none md:w-[320px] ${panelTransition}`}
      >
        <h2
          id={HEADING_ID}
          className="px-6 pt-12 pb-6 text-xs font-medium tracking-[0.12em] text-faint uppercase"
        >
          Corpora
        </h2>
        <ul className="flex flex-col gap-1 overflow-y-auto px-3 pb-6">
          {CORPORA.map((corpus) => (
            <li key={corpus.slug}>
              <CorpusListItem
                corpus={corpus}
                current={corpus.slug === currentSlug}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
        {/* Pushed to the bottom; a thin divider separates this quiet, lighter-
            weight link from the corpus list above. */}
        <div className="mt-auto border-t border-seam px-3 py-4">
          <button
            type="button"
            onClick={onAbout}
            className="rounded-[8px] px-3 py-2 text-sm font-light text-faint hover:bg-ground-strip hover:text-muted"
          >
            About
          </button>
        </div>
      </div>
    </div>
  );
}

type CorpusListItemProps = {
  corpus: Corpus;
  current: boolean;
  onSelect: (slug: string) => void;
};

function CorpusListItem({ corpus, current, onSelect }: CorpusListItemProps) {
  const body = (
    <>
      <span className="flex items-center gap-2">
        {current ? (
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-kernel"
          />
        ) : null}
        <span className={`text-base ${current ? 'text-kernel' : 'text-prose'}`}>
          {corpus.title}
        </span>
      </span>
      <span className="text-xs tracking-tight text-faint">
        {corpus.wordCount.toLocaleString()} words
      </span>
    </>
  );

  return (
    <button
      type="button"
      aria-current={current ? 'true' : undefined}
      onClick={() => onSelect(corpus.slug)}
      className="flex w-full flex-col items-start gap-0.5 rounded-[8px] px-3 py-2.5 text-left hover:bg-ground-strip"
    >
      {body}
    </button>
  );
}
