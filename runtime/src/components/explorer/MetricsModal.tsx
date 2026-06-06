'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Metrics-explainer modal — a small reference for the header readout
 * (stored / removed / avg fidelity). Reached from an ⓘ button immediately to the
 * left of the metrics in the header.
 *
 * Mirrors `AboutModal` / `PrimerModal`'s shell and a11y bar: a centered card
 * over a scrim that dims (does not remove) the explorer, `role="dialog"` +
 * `aria-modal`. It is headingless (no visible title), so the dialog's accessible
 * name comes from a static `aria-label` rather than `aria-labelledby`. Focus
 * moved to the Close button on open and
 * restored to the opener (the ⓘ button) on close, a Tab focus-trap, and Esc /
 * scrim / "Close" dismissal. Fade respects `prefers-reduced-motion` (instant).
 *
 * Open/closed state lives in `ExplorerContainer`; this component is
 * presentational + a11y only, mounted only while open.
 */

type Metric = { term: string; def: string };

const METRICS: readonly Metric[] = [
  {
    term: 'stored',
    def: "The share of the text's information still on the page, carried by the surviving high-surprisal words.",
  },
  {
    term: 'removed',
    def: 'The share carried by the words taken out with text compression. They must be predicted to rebuild the text. (stored + removed always total 100%)',
  },
  {
    term: 'avg fidelity',
    def: "How closely the model's predictions of the removed words match the originals (1.00 = exact). It decreases with compression, since removed words become harder to predict.",
  },
];

export function MetricsModal({ onDismiss }: { onDismiss: () => void }) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  // The element focused before the modal opened (the header ⓘ), restored on
  // close. Captured + focus moved in the effect commit (a DOM call, not a
  // setState), which is allowed under React 19's no-ref-in-render rule.
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    buttonRef.current?.focus();
    const opener = openerRef.current;
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  // Esc to dismiss + a simple focus trap (Tab/Shift+Tab cycles within the card).
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

  return (
    <div
      data-metrics-scrim=""
      onClick={onScrimClick}
      className="modal-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-8"
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="What the header numbers mean"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[672px] rounded-[10px] border border-seam-strong bg-ground p-[49px] shadow-[0_25px_25px_rgba(0,0,0,0.25)]"
      >
        <dl>
          {METRICS.map((m, i) => (
            <div key={m.term} className={i === 0 ? '' : 'pt-4'}>
              <dt className="text-[18px] leading-[29.25px] tracking-[-0.44px] text-prose">
                {m.term}
              </dt>
              <dd className="text-[18px] leading-[29.25px] tracking-[-0.44px] text-muted">
                {m.def}
              </dd>
            </div>
          ))}
        </dl>
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
