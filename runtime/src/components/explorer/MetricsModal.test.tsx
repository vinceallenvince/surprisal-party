import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetricsModal } from './MetricsModal';

/**
 * Metrics-explainer modal behaviour. Mirrors the About/Primer a11y bar: a
 * labelled dialog over a scrim, focus moved to Close on open, Esc / scrim /
 * Close dismissal, and a focus trap. jsdom has no matchMedia, so the
 * reduced-motion hook's read is stubbed.
 */

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
});

describe('MetricsModal', () => {
  it('is a labelled dialog listing the three metrics with a Close button', () => {
    render(<MetricsModal onDismiss={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: /what the header numbers mean/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // The three metric terms are present as definition terms.
    expect(screen.getByText('stored')).toBeInTheDocument();
    expect(screen.getByText('removed')).toBeInTheDocument();
    expect(screen.getByText('avg fidelity')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /close/i }),
    ).toBeInTheDocument();
  });

  it('moves focus to the Close button on open', () => {
    render(<MetricsModal onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();
  });

  it('dismisses via Close, Esc, and scrim click', () => {
    const onDismiss = vi.fn();
    const { container, rerender } = render(
      <MetricsModal onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender(<MetricsModal onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(2);

    rerender(<MetricsModal onDismiss={onDismiss} />);
    const scrim = container.querySelector('[data-metrics-scrim]');
    expect(scrim).not.toBeNull();
    fireEvent.click(scrim as Element);
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });

  it('a click inside the card does not dismiss (no bubble to the scrim)', () => {
    const onDismiss = vi.fn();
    render(<MetricsModal onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
