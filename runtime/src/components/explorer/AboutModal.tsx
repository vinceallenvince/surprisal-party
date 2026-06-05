'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

/**
 * About modal — the opt-in "read more about the project" surface (Phase 2,
 * Step 6; Figma node 29-467). Reached from the quiet "About" link at the bottom
 * of the corpus drawer (`CorpusDrawer`), which opens this modal STACKED ABOVE
 * the still-open drawer (the Figma frame shows the drawer open behind About).
 *
 * Stacking: this modal's scrim + card sit at a HIGHER z-index than the drawer
 * (`z-[60]` vs the drawer's `z-50`), so About's scrim dims the drawer too and
 * the card renders clearly on top. The drawer steps aside while About is open
 * (drops its `aria-modal`, goes `inert`, suspends its Esc/Tab handling — see
 * `CorpusDrawer`), so About alone is the active modal and Esc / scrim-click
 * dismiss ONLY About, returning the user to the still-open drawer.
 *
 * Mirrors `PrimerModal`'s pattern and a11y bar exactly: a centered card over a
 * scrim that dims (does not remove) what is behind it, `role="dialog"` +
 * `aria-modal` + `aria-labelledby`, focus moved to the Close button on open and
 * restored to the opener (the drawer's About link, still mounted) on close, a
 * Tab focus-trap, and Esc / scrim / "Close" dismissal. Fade respects
 * `prefers-reduced-motion` (instant).
 *
 * Unlike the primer (the one sanctioned line of mechanic-teaching copy) this is
 * opt-in, so a little more copy is fine: a short heading and one/two short
 * paragraphs drawn from `../docs/abstract.md`, in the project's lightly-ironic
 * voice, plus an external link to the author's write-up. It is NOT a tutorial.
 *
 * Open/closed state lives in `ExplorerContainer`; this component is
 * presentational + a11y only, mounted only while open.
 */

const HEADING_ID = 'about-heading';

// The author's site — where the longer write-up lives.
const WRITEUP_URL = 'https://vinceallen.com';
// Bare domain shown as the link text so the destination is visible (the only
// <a> in the app). Keep in sync with WRITEUP_URL's host.
const WRITEUP_LABEL = 'vinceallen.com';

export function AboutModal({ onDismiss }: { onDismiss: () => void }) {
  const reduce = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  // The element focused before the modal opened (the drawer's About link),
  // restored on close.
  const openerRef = useRef<Element | null>(null);

  // Move focus into the modal on open and restore it on close. Capturing the
  // opener and focusing the button happen in the effect's commit (a DOM call,
  // not a setState), which is allowed; React 19's "no ref read/write during
  // render" rule only forbids touching refs in the render body.
  useEffect(() => {
    openerRef.current = document.activeElement;
    buttonRef.current?.focus();
    const opener = openerRef.current;
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  // Esc to dismiss + a simple focus trap (Tab/Shift+Tab cycles within the
  // card). Registered once; reads the live DOM, so no re-subscription needed.
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
  }, [onDismiss]);

  // Scrim click dismisses; clicks on the card must not bubble up to it.
  const onScrimClick = useCallback(() => onDismiss(), [onDismiss]);

  const transition = reduce
    ? 'motion-reduce:transition-none'
    : 'transition-opacity duration-200 ease-out';

  return (
    <div
      data-about-scrim=""
      onClick={onScrimClick}
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-8 ${transition}`}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={HEADING_ID}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[672px] rounded-[10px] border border-seam-strong bg-ground p-[49px] shadow-[0_25px_25px_rgba(0,0,0,0.25)]"
      >
        <h1
          id={HEADING_ID}
          className="text-[24px] leading-[39px] font-medium tracking-[0.07px] text-prose"
        >
          <span className="text-kernel">Surprisal Party</span>
        </h1>
        <p className="pt-6 text-[18px] leading-[29.25px] tracking-[-0.44px] text-muted">
          Predictable words carry little information, surprising words carry a lot.
          The text algorithm demonstrated here preserves words at varying levels of compression
          based on their surprisal value. Drag the slider to max compression
          and what stays is the irreducible kernel the model could not have known. Hidden
          in between the compression seams are predictions of neighboring words. The higher
          the compression, the more lossy the predictions become.
        </p>
        <p className="pt-4 text-[18px] leading-[29.25px] tracking-[-0.44px] text-muted">
          Read the longer
          write-up at{' '}
          <a
            href={WRITEUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-kernel underline underline-offset-2"
          >
            {WRITEUP_LABEL}
          </a>
          .
        </p>
        <div className="pt-12">
          <button
            ref={buttonRef}
            type="button"
            onClick={onDismiss}
            className="rounded-[8px] border border-seam-strong bg-seam px-5 py-3 text-sm font-medium tracking-tight text-prose"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
