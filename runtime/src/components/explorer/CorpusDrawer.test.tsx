import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import taleFixture from '../../../public/tales/little-red-riding-hood.json';

/**
 * Corpus-picker drawer behaviour (Phase 2, Step 6).
 *
 * Only ONE real corpus exists (`public/tales/little-red-riding-hood.json`), so
 * to exercise multi-corpus list rendering + switching we MOCK the manifest
 * module (`@/lib/corpora`) with a two-entry list. The mocked fetch returns the
 * single real fixture for whichever slug is requested — enough to drive the
 * fetch → parse → render path for both slugs. The mock lives at module scope
 * (hoisted by Vitest) so both the drawer and the container see the same list.
 */

vi.mock('@/lib/corpora', () => {
  const CORPORA = [
    { slug: 'little-red-riding-hood', title: 'Little Red Riding Hood', wordCount: 1378 },
    { slug: 'second-corpus', title: 'Second Corpus', wordCount: 999 },
  ] as const;
  return { CORPORA, DEFAULT_CORPUS_SLUG: CORPORA[0].slug };
});

// Imported AFTER the mock so they pick up the injected manifest.
import { CorpusDrawer } from './CorpusDrawer';
import { ExplorerContainer } from './ExplorerContainer';
import { PRIMER_SEEN_KEY } from '@/lib/primer';

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
  // Return the one real fixture regardless of slug — both manifest entries
  // resolve to a valid cache so the container can render either.
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(taleFixture),
    }),
  );
}

describe('CorpusDrawer (standalone: list, marking, a11y, dismissal)', () => {
  it('is a labelled dialog headed CORPORA listing the corpora', () => {
    render(
      <CorpusDrawer
        currentSlug="little-red-riding-hood"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onAbout={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: /corpora/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      within(dialog).getByRole('heading', { name: /corpora/i }),
    ).toBeInTheDocument();
    // All corpora are clickable buttons (including the current one, which
    // closes the drawer when tapped).
    expect(
      within(dialog).getByRole('button', { name: /little red riding hood/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /second corpus/i }),
    ).toBeInTheDocument();
  });

  it('renders each corpus with its word-count meta line', () => {
    render(
      <CorpusDrawer
        currentSlug="little-red-riding-hood"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onAbout={vi.fn()}
      />,
    );
    expect(screen.getByText(/1,378 words/i)).toBeInTheDocument();
    expect(screen.getByText(/999 words/i)).toBeInTheDocument();
  });

  it('marks the currently-loaded corpus via aria-current', () => {
    render(
      <CorpusDrawer
        currentSlug="second-corpus"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onAbout={vi.fn()}
      />,
    );
    const current = screen.getByRole('button', { name: /second corpus/i });
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(
      screen.getByRole('button', { name: /little red riding hood/i }),
    ).not.toHaveAttribute('aria-current');
  });

  it('moves focus to the first corpus button on open', () => {
    render(
      <CorpusDrawer
        currentSlug="little-red-riding-hood"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onAbout={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /little red riding hood/i }),
    ).toHaveFocus();
  });

  it('selecting a corpus calls onSelect with its slug', () => {
    const onSelect = vi.fn();
    render(
      <CorpusDrawer
        currentSlug="little-red-riding-hood"
        onSelect={onSelect}
        onClose={vi.fn()}
        onAbout={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /second corpus/i }));
    expect(onSelect).toHaveBeenCalledWith('second-corpus');
  });

  it('closes via Esc and via scrim click', () => {
    const onClose = vi.fn();
    const { container, rerender } = render(
      <CorpusDrawer
        currentSlug="little-red-riding-hood"
        onSelect={vi.fn()}
        onClose={onClose}
        onAbout={vi.fn()}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <CorpusDrawer
        currentSlug="little-red-riding-hood"
        onSelect={vi.fn()}
        onClose={onClose}
        onAbout={vi.fn()}
      />,
    );
    const scrim = container.querySelector('[data-corpus-scrim]');
    expect(scrim).not.toBeNull();
    fireEvent.click(scrim as Element);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('a click inside the panel does not close (no bubble to the scrim)', () => {
    const onClose = vi.fn();
    render(
      <CorpusDrawer
        currentSlug="little-red-riding-hood"
        onSelect={vi.fn()}
        onClose={onClose}
        onAbout={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('dialog', { name: /corpora/i }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders a keyboard-focusable About link at the bottom of the drawer', () => {
    render(
      <CorpusDrawer
        currentSlug="little-red-riding-hood"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onAbout={vi.fn()}
      />,
    );
    const about = screen.getByRole('button', { name: /about/i });
    expect(about).toBeInTheDocument();
    // Focusable (a real button, no tabindex=-1) and part of the focus trap.
    expect(about).not.toHaveAttribute('tabindex', '-1');
    about.focus();
    expect(about).toHaveFocus();
  });

  it('clicking About fires onAbout (and does not close via onClose)', () => {
    const onAbout = vi.fn();
    const onClose = vi.fn();
    render(
      <CorpusDrawer
        currentSlug="little-red-riding-hood"
        onSelect={vi.fn()}
        onClose={onClose}
        onAbout={onAbout}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /about/i }));
    expect(onAbout).toHaveBeenCalledTimes(1);
    // About stacks above the still-open drawer (the parent's job); the link
    // itself must not route through the scrim/Esc onClose path.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('steps aside while inert: drops aria-modal, suspends Esc/scrim close', () => {
    const onClose = vi.fn();
    const { container } = render(
      <CorpusDrawer
        currentSlug="little-red-riding-hood"
        onSelect={vi.fn()}
        onClose={onClose}
        onAbout={vi.fn()}
        inert
      />,
    );
    // No longer the active modal: aria-modal is dropped and it's hidden from AT.
    const panel = container.querySelector('[role="dialog"]');
    expect(panel).not.toBeNull();
    expect(panel).not.toHaveAttribute('aria-modal');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    // Esc and scrim click are suspended — About (stacked above) owns dismissal.
    fireEvent.keyDown(document, { key: 'Escape' });
    const scrim = container.querySelector('[data-corpus-scrim]');
    fireEvent.click(scrim as Element);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ExplorerContainer corpus switching', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Pre-seed the primer-seen flag so the primer dialog does not appear and
    // collide with the drawer dialog in these assertions.
    window.localStorage.setItem(PRIMER_SEEN_KEY, 'true');
    window.history.replaceState(null, '', '/');
    stubFetchWithFixture();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the drawer from the rail icon and toggles aria-expanded', async () => {
    render(<ExplorerContainer />);
    await waitFor(() =>
      expect(screen.getByText('Little Red Riding Hood')).toBeInTheDocument(),
    );
    const rail = screen.getAllByRole('button', { name: /open corpus picker/i })[0];
    expect(rail).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(rail);
    expect(
      screen.getByRole('dialog', { name: /corpora/i }),
    ).toBeInTheDocument();
    expect(rail).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the drawer when the rail icon is clicked again', async () => {
    render(<ExplorerContainer />);
    await waitFor(() =>
      expect(screen.getByText('Little Red Riding Hood')).toBeInTheDocument(),
    );
    const rail = screen.getAllByRole('button', { name: /open corpus picker/i })[0];
    fireEvent.click(rail);
    expect(screen.getByRole('dialog', { name: /corpora/i })).toBeInTheDocument();
    fireEvent.click(rail);
    expect(
      screen.queryByRole('dialog', { name: /corpora/i }),
    ).not.toBeInTheDocument();
  });

  it('selecting a corpus closes the drawer, re-fetches the slug, and resets the readout to UNCOMPRESSED', async () => {
    render(<ExplorerContainer />);
    await waitFor(() =>
      expect(screen.getByText('Little Red Riding Hood')).toBeInTheDocument(),
    );
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();

    fireEvent.click(screen.getAllByRole('button', { name: /open corpus picker/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /second corpus/i }));

    // Drawer closed.
    expect(
      screen.queryByRole('dialog', { name: /corpora/i }),
    ).not.toBeInTheDocument();
    // Re-fetched the newly-selected slug.
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/tales/second-corpus.json'),
    );
    // View reset to UNCOMPRESSED: slider value 0 and the reset readout.
    await waitFor(() => {
      const slider = screen.getByRole('slider', { name: /compression level/i });
      expect(slider).toHaveAttribute('aria-valuenow', '0');
    });
    // UNCOMPRESSED readout is "stored 100.0% · removed 0.0% · avg fidelity —".
    expect(screen.getByText('100.0%')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('clicking About stacks the About modal ABOVE the still-open drawer', async () => {
    render(<ExplorerContainer />);
    await waitFor(() =>
      expect(screen.getByText('Little Red Riding Hood')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getAllByRole('button', { name: /open corpus picker/i })[0]);
    expect(
      screen.getByRole('dialog', { name: /corpora/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^about$/i }));

    // About is up AND the drawer stays mounted behind it. The drawer steps
    // aside (drops aria-modal / aria-hidden) so About alone is the active
    // modal, but it remains in the DOM — `getByRole('dialog', {hidden})` finds
    // it. (`queryByRole` without `hidden` would skip the aria-hidden drawer.)
    expect(
      screen.getByRole('dialog', { name: /surprisal party/i }),
    ).toBeInTheDocument();
    const drawerPanel = document.querySelector(
      '[aria-labelledby="corpus-drawer-heading"]',
    );
    expect(drawerPanel).not.toBeNull();
    expect(drawerPanel).not.toHaveAttribute('aria-modal');
    expect(drawerPanel).toHaveAttribute('aria-hidden', 'true');
  });

  it('Esc and scrim close only About, leaving the drawer open underneath', async () => {
    render(<ExplorerContainer />);
    await waitFor(() =>
      expect(screen.getByText('Little Red Riding Hood')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getAllByRole('button', { name: /open corpus picker/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /^about$/i }));
    expect(
      screen.getByRole('dialog', { name: /surprisal party/i }),
    ).toBeInTheDocument();

    // Esc dismisses About only; the drawer is restored as the active modal.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: /surprisal party/i }),
    ).not.toBeInTheDocument();
    const drawer = screen.getByRole('dialog', { name: /corpora/i });
    expect(drawer).toHaveAttribute('aria-modal', 'true');

    // Re-open About, then dismiss via its scrim — again only About closes.
    fireEvent.click(screen.getByRole('button', { name: /^about$/i }));
    expect(
      screen.getByRole('dialog', { name: /surprisal party/i }),
    ).toBeInTheDocument();
    fireEvent.click(document.querySelector('[data-about-scrim]') as Element);
    expect(
      screen.queryByRole('dialog', { name: /surprisal party/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: /corpora/i }),
    ).toHaveAttribute('aria-modal', 'true');
  });

  it('returns focus to the drawer About link after dismissing About', async () => {
    render(<ExplorerContainer />);
    await waitFor(() =>
      expect(screen.getByText('Little Red Riding Hood')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getAllByRole('button', { name: /open corpus picker/i })[0]);
    const aboutLink = screen.getByRole('button', { name: /^about$/i });
    aboutLink.focus();
    fireEvent.click(aboutLink);
    expect(
      screen.getByRole('dialog', { name: /surprisal party/i }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    // The About link is still mounted (drawer stayed open), so focus restores
    // to it — no fall-through to <body>.
    expect(
      screen.getByRole('button', { name: /^about$/i }),
    ).toHaveFocus();
  });

  it('clicking the current corpus closes the drawer without reloading', async () => {
    render(<ExplorerContainer />);
    await waitFor(() =>
      expect(screen.getByText('Little Red Riding Hood')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getAllByRole('button', { name: /open corpus picker/i })[0]);
    const dialog = screen.getByRole('dialog', { name: /corpora/i });
    const currentBtn = within(dialog).getByRole('button', { name: /little red riding hood/i });
    expect(currentBtn).toHaveAttribute('aria-current', 'true');
    fireEvent.click(currentBtn);
    expect(screen.queryByRole('dialog', { name: /corpora/i })).toBeNull();
  });
});
