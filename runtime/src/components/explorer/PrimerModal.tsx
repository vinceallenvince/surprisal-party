'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

/**
 * Onboarding primer modal — frame 28-80 (the onboarding overlay over the
 * explorer). A large centered card over a scrim that dims (does not remove) the
 * explorer behind it. The scrim intercepts pointer events, so the explorer is
 * not interactive while the primer is open.
 *
 * It carries the project's one sanctioned piece of explanatory copy: a two-line
 * vocabulary primer on *surprisal*. It is NOT a tutorial — it says nothing
 * about the slider or the seams. Copy is fixed (the two lines below).
 *
 * Dismissal: the "Got it" button, Esc, or a scrim click. Accessibility:
 * `role="dialog"` + `aria-modal`, labelled by the heading, focus moved to the
 * button on open and a focus trap while open, focus restored to the opener on
 * close. Fade/scale respects `prefers-reduced-motion` (instant).
 *
 * Open/closed state and the persistence/dev-override gating live in
 * `ExplorerContainer`; this component is presentational + a11y only. It is
 * mounted only while open (the container conditionally renders it), so "open"
 * here means "mounted".
 */

const HEADING_ID = 'primer-heading';

export function PrimerModal({ onDismiss }: { onDismiss: () => void }) {
  const reduce = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  // The element focused before the modal opened, restored on close.
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
      data-primer-scrim=""
      onClick={onScrimClick}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-8 ${transition}`}
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
          <span className="text-kernel">surprisal</span> = how much a word
          surprises a predictor
        </h1>
        <p className="pt-6 text-[18px] leading-[29.25px] tracking-[-0.44px] text-muted">
          predictable words carry little information, surprising words carry a
          lot
        </p>
        <div className="pt-12">
          <button
            ref={buttonRef}
            type="button"
            onClick={onDismiss}
            className="rounded-[8px] border border-seam-strong bg-seam px-5 py-3 text-sm font-medium tracking-tight text-prose"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
