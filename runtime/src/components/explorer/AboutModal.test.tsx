import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AboutModal } from './AboutModal';

/**
 * About-modal behaviour (Phase 2, Step 6).
 *
 * Mirrors PrimerModal's a11y bar: a labelled dialog over a scrim, focus moved
 * in on open, Esc / scrim / Close-button dismissal, and a focus trap. The modal
 * carries the opt-in project copy plus the single external link to the author's
 * write-up (new tab, rel="noopener noreferrer", bare-domain text). jsdom has no
 * matchMedia, so the reduced-motion hook's read is stubbed.
 */

const HEADING = /surprisal party/i;
const WRITEUP_URL = 'https://vinceallen.com';

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

describe('AboutModal', () => {
  it('is a labelled modal dialog with the project copy and a Close button', () => {
    render(<AboutModal onDismiss={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: HEADING });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: HEADING })).toBeInTheDocument();
    // Copy describes the project's core (compression == prediction; the kernel
    // survives) without being a tutorial.
    expect(
      screen.getByText(/compression and prediction are the same/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/irreducible kernel/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /close/i }),
    ).toBeInTheDocument();
  });

  it('links to the author site in a new tab, showing its destination', () => {
    render(<AboutModal onDismiss={vi.fn()} />);
    const link = screen.getByRole('link', { name: /vinceallen\.com/i });
    expect(link).toHaveAttribute('href', WRITEUP_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // Destination is visible: the bare domain is the link text.
    expect(link).toHaveTextContent('vinceallen.com');
  });

  it('moves focus to the Close button on open', () => {
    render(<AboutModal onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();
  });

  it('dismisses via the button, Esc, and scrim click', () => {
    const onDismiss = vi.fn();
    const { container, rerender } = render(
      <AboutModal onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender(<AboutModal onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(2);

    rerender(<AboutModal onDismiss={onDismiss} />);
    const scrim = container.querySelector('[data-about-scrim]');
    expect(scrim).not.toBeNull();
    fireEvent.click(scrim as Element);
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });

  it('a click inside the card does not dismiss (no bubble to the scrim)', () => {
    const onDismiss = vi.fn();
    render(<AboutModal onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('dialog', { name: HEADING }));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
