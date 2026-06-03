import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExplorerContainer } from './ExplorerContainer';
import { PrimerModal } from './PrimerModal';
import { PRIMER_SEEN_KEY } from '@/lib/primer';
import taleFixture from '../../../public/tales/little-red-riding-hood.json';

/**
 * Onboarding-primer behaviour (Phase 2, Step 6).
 *
 * The container fetches the tale cache and decides primer visibility after
 * mount inside a rAF. jsdom has no `matchMedia`, `requestAnimationFrame`, or a
 * relevant `fetch`, so we stub them. `waitFor` covers the fetch → parse → rAF
 * hops before asserting.
 */

const HEADING = /surprisal = how much a word surprises a predictor/i;

beforeAll(() => {
  // The prose column's reduced-motion hook + the modal's both read matchMedia.
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
  // ProseColumn preloads Audio and auto-scrolls; stub both for jsdom.
  vi.stubGlobal(
    'Audio',
    class {
      preload = '';
      currentTime = 0;
      play = vi.fn().mockResolvedValue(undefined);
    },
  );
  Element.prototype.scrollTo = vi.fn();
});

function stubFetchWithFixture() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(taleFixture),
    }),
  );
}

describe('PrimerModal (standalone a11y + dismissal)', () => {
  it('is a labelled modal dialog with the two-line copy and a Got it button', () => {
    render(<PrimerModal onDismiss={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: HEADING })).toBeInTheDocument();
    expect(
      screen.getByText(
        /predictable words carry little information, surprising words carry a lot/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument();
  });

  it('moves focus to the Got it button on open', () => {
    render(<PrimerModal onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: /got it/i })).toHaveFocus();
  });

  it('dismisses via the button, Esc, and scrim click', () => {
    const onDismiss = vi.fn();
    const { container, rerender } = render(
      <PrimerModal onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender(<PrimerModal onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(2);

    rerender(<PrimerModal onDismiss={onDismiss} />);
    const scrim = container.querySelector('[data-primer-scrim]');
    expect(scrim).not.toBeNull();
    fireEvent.click(scrim as Element);
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });

  it('a click inside the card does not dismiss (no bubble to the scrim)', () => {
    const onDismiss = vi.fn();
    render(<PrimerModal onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('ExplorerContainer primer gating', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.unstubAllEnvs();
    stubFetchWithFixture();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('first visit: shows the primer, and dismissing sets the seen-flag', async () => {
    render(<ExplorerContainer />);
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toBeInTheDocument(),
    );
    expect(window.localStorage.getItem(PRIMER_SEEN_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(PRIMER_SEEN_KEY)).toBe('true');
  });

  it('returning visitor (flag preset): does not show the primer', async () => {
    window.localStorage.setItem(PRIMER_SEEN_KEY, 'true');
    render(<ExplorerContainer />);
    // Wait until the corpus is loaded (header title appears), then assert no dialog.
    await waitFor(() =>
      expect(screen.getByText('Little Red Riding Hood')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the header ⓘ re-summons the primer for a returning visitor', async () => {
    window.localStorage.setItem(PRIMER_SEEN_KEY, 'true');
    render(<ExplorerContainer />);
    await waitFor(() =>
      expect(screen.getByText('Little Red Riding Hood')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /about surprisal/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('dev-override (?intro) shows the primer without mutating the seen-flag', async () => {
    window.localStorage.setItem(PRIMER_SEEN_KEY, 'true');
    window.history.replaceState(null, '', '/?intro');
    render(<ExplorerContainer />);
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toBeInTheDocument(),
    );
    // Dismissing the forced primer must leave the flag exactly as it was.
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(window.localStorage.getItem(PRIMER_SEEN_KEY)).toBe('true');
  });

  it('dev-override (?intro) on a first visit does not write the flag on dismiss', async () => {
    window.history.replaceState(null, '', '/?intro');
    render(<ExplorerContainer />);
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    // Forced path must not persist — the visitor is still "unseen".
    expect(window.localStorage.getItem(PRIMER_SEEN_KEY)).toBeNull();
  });
});
