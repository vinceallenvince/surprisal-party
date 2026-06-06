import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ExplorerContainer } from './ExplorerContainer';
import { PrimerModal } from './PrimerModal';
import { PRIMER_SEEN_KEY } from '@/lib/primer';
import taleFixture from '../../../public/tales/little-red-riding-hood.json';

/**
 * Onboarding-primer behaviour (Phase 2, Step 6) — reworked into a three-step
 * interactive primer.
 *
 * The container fetches the tale cache and decides primer visibility after
 * mount inside a rAF. jsdom has no `matchMedia`, `requestAnimationFrame`, or a
 * relevant `fetch`, so we stub them. `waitFor` covers the fetch → parse → rAF
 * hops before asserting.
 */

const STEP1_HEADING = /surprisal = how much a word surprises a predictor/i;

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
  // jsdom doesn't implement pointer capture; the slider calls it on pointerdown.
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    Element.prototype.releasePointerCapture = vi.fn();
  }
});

function stubFetchWithFixture() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(taleFixture),
    }),
  );
}

/** Advance the standalone primer from step 1 to step 3. */
function gotoStep3() {
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
}

/**
 * Advance to step 4: next, next (→ step 3), move the slider (which arms step
 * 3's Next), next (→ step 4).
 */
function gotoStep4() {
  gotoStep3();
  const slider = screen.getByRole('slider', { name: /surprisal threshold/i });
  fireEvent.keyDown(slider, { key: 'ArrowRight' });
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
}

describe('PrimerModal (standalone steps + a11y + dismissal)', () => {
  it('step 1 is a labelled modal dialog with the definition copy', () => {
    render(<PrimerModal onDismiss={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      screen.getByRole('heading', { name: STEP1_HEADING }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /predictable words carry little information, surprising words carry a lot/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('moves focus to the primary advancing control on step 1', () => {
    render(<PrimerModal onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: /next/i })).toHaveFocus();
  });

  it('Next advances to step 2, which shows the annotated surprisal numbers', () => {
    render(<PrimerModal onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // The annotated sentence shows each word's surprisal superscript.
    expect(screen.getByText('20')).toBeInTheDocument(); // predictor
    expect(screen.getByText('12')).toBeInTheDocument(); // surprises
    expect(
      screen.getByText(/the small number is each word's surprisal/i),
    ).toBeInTheDocument();
  });

  it('moves focus to "Next" on entering step 2', () => {
    render(<PrimerModal onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('button', { name: /next/i })).toHaveFocus();
  });

  it('Next from step 2 advances to step 3 (the threshold slider)', () => {
    render(<PrimerModal onDismiss={vi.fn()} />);
    gotoStep3();
    expect(
      screen.getByRole('slider', { name: /surprisal threshold/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/only the surprising words survive/i),
    ).toBeInTheDocument();
  });

  it('moves focus to the dialog card, not the slider, on entering step 3', () => {
    // Auto-focusing the slider showed its focus-visible ring on arrival — a
    // stray highlight before the user has done anything. Step 3 focuses the
    // dialog card instead, so focus stays inside the modal (Esc + trap work)
    // with nothing visibly highlighted.
    render(<PrimerModal onDismiss={vi.fn()} />);
    gotoStep3();
    expect(screen.getByRole('dialog')).toHaveFocus();
    expect(
      screen.getByRole('slider', { name: /surprisal threshold/i }),
    ).not.toHaveFocus();
  });

  it('Back returns to the prior step', () => {
    render(<PrimerModal onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // On step 2 now; Back returns to step 1's definition copy.
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(
      screen.getByText(/predictable words carry little information/i),
    ).toBeInTheDocument();
  });

  it('on step 3 Next is disabled until the slider is moved', () => {
    render(<PrimerModal onDismiss={vi.fn()} />);
    gotoStep3();
    const next = screen.getByRole('button', { name: /next/i });
    expect(next).toBeDisabled();

    // An arrow keydown on the slider counts as a move and arms Next.
    const slider = screen.getByRole('slider', { name: /surprisal threshold/i });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(next).toBeEnabled();
  });

  it('arrow keys step the threshold (aria-valuenow tracks the stops)', () => {
    render(<PrimerModal onDismiss={vi.fn()} />);
    gotoStep3();
    const slider = screen.getByRole('slider', { name: /surprisal threshold/i });
    // Stops are [0, 2, 4, 7, 15]; starts at 0.
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '2');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '15');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
  });

  it('sliding to the max threshold leaves only "predictor" surviving + visible', () => {
    render(<PrimerModal onDismiss={vi.fn()} />);
    gotoStep3();
    const slider = screen.getByRole('slider', { name: /surprisal threshold/i });
    fireEvent.keyDown(slider, { key: 'End' });

    const dialog = document.querySelector('[role="dialog"]')!;
    // Exactly one word survives, and it's the kernel "predictor".
    const surviving = Array.from(
      dialog.querySelectorAll('[data-token][data-survives="true"]'),
    ).map((el) => el.getAttribute('data-token'));
    expect(surviving).toEqual(['predictor']);

    // Dropped words are kept in the DOM but collapsed (zero-width + transparent
    // + aria-hidden), not display:none — verify the contraction styling and that
    // the survivor is NOT collapsed.
    const droppedA = dialog.querySelector(
      '[data-token="a"][data-survives="false"]',
    )!;
    expect(droppedA).not.toBeNull();
    expect(droppedA).toHaveClass('max-w-0', 'opacity-0');
    expect(droppedA).toHaveAttribute('aria-hidden', 'true');

    const predictor = dialog.querySelector(
      '[data-token="predictor"][data-survives="true"]',
    )!;
    expect(predictor).toHaveClass('opacity-100');
    expect(predictor).not.toHaveClass('opacity-0');
    expect(predictor).not.toHaveAttribute('aria-hidden');
  });

  it('step 4 shows the kernel lead line, subtext, predict button, and a disabled Done', () => {
    render(<PrimerModal onDismiss={vi.fn()} />);
    gotoStep4();
    // The coral kernel lead line (the lone survivor from step 3).
    const kernel = document
      .querySelector('[role="dialog"]')!
      .querySelector('[data-recon-token="predictor"]')!;
    expect(kernel).toHaveClass('text-kernel');
    expect(
      screen.getByText(
        /the higher the surprisal, the more lossy the prediction/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /predict the uncompressed text/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /got it/i })).toBeDisabled();
  });

  it('moves focus to the predict button on entering step 4 (not the disabled Done)', () => {
    render(<PrimerModal onDismiss={vi.fn()} />);
    gotoStep4();
    expect(
      screen.getByRole('button', { name: /predict the uncompressed text/i }),
    ).toHaveFocus();
  });

  it('clicking predict reveals the lossy reconstruction + fidelity and enables Done', () => {
    render(<PrimerModal onDismiss={vi.fn()} />);
    gotoStep4();
    // Before the click only the kernel shows; the predicted words are collapsed.
    const dialog = document.querySelector('[role="dialog"]')!;
    const often = dialog.querySelector('[data-recon-token="often"]')!;
    expect(often).toHaveAttribute('data-shown', 'false');

    fireEvent.click(
      screen.getByRole('button', { name: /predict the uncompressed text/i }),
    );

    // The predicted words are now revealed, in white (text-prose) to match the
    // actual text (the onboarding favours the connection over the app's grey).
    expect(often).toHaveAttribute('data-shown', 'true');
    expect(often).toHaveClass('text-prose');
    expect(
      dialog.querySelector('[data-recon-token="fools"]'),
    ).toHaveAttribute('data-shown', 'true');
    // The actual text + fidelity readout appears.
    expect(
      screen.getByText('how much a word surprises a'),
    ).toBeInTheDocument();
    expect(screen.getByText('0.68')).toBeInTheDocument();
    // Done is now enabled.
    expect(screen.getByRole('button', { name: /got it/i })).toBeEnabled();
  });

  it('dismisses via Done (after predicting), Esc, and scrim click', () => {
    const onDismiss = vi.fn();
    const { container, rerender } = render(
      <PrimerModal onDismiss={onDismiss} />,
    );
    gotoStep4();
    fireEvent.click(
      screen.getByRole('button', { name: /predict the uncompressed text/i }),
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

/** Walk all four primer steps to Done and click it (used by the gating tests). */
function completePrimer() {
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  const slider = screen.getByRole('slider', { name: /surprisal threshold/i });
  fireEvent.keyDown(slider, { key: 'ArrowRight' });
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  fireEvent.click(
    screen.getByRole('button', { name: /predict the uncompressed text/i }),
  );
  fireEvent.click(screen.getByRole('button', { name: /got it/i }));
}

describe('ExplorerContainer primer gating', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // The loading ceremony now sits in front of everything; `?boot=skip`
    // bypasses it so these primer-gating tests resolve the primer on mount
    // (the loader's onComplete sequencing is covered separately below).
    window.history.replaceState(null, '', '/?boot=skip');
    vi.unstubAllEnvs();
    stubFetchWithFixture();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('first visit: shows the primer, and completing it sets the seen-flag', async () => {
    render(<ExplorerContainer />);
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toBeInTheDocument(),
    );
    expect(window.localStorage.getItem(PRIMER_SEEN_KEY)).toBeNull();
    completePrimer();
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
    window.history.replaceState(null, '', '/?boot=skip&intro');
    render(<ExplorerContainer />);
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toBeInTheDocument(),
    );
    // Dismissing the forced primer must leave the flag exactly as it was.
    completePrimer();
    expect(window.localStorage.getItem(PRIMER_SEEN_KEY)).toBe('true');
  });

  it('dev-override (?intro) on a first visit does not write the flag on dismiss', async () => {
    window.history.replaceState(null, '', '/?boot=skip&intro');
    render(<ExplorerContainer />);
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toBeInTheDocument(),
    );
    completePrimer();
    // Forced path must not persist — the visitor is still "unseen".
    expect(window.localStorage.getItem(PRIMER_SEEN_KEY)).toBeNull();
  });
});

/**
 * The loading ceremony's integration with the container: the loader gates first
 * paint, the primer opens on the loader's `onComplete` (not on mount), and a
 * Shift+Cmd/Ctrl+L replay re-runs the ceremony. Uses `?boot=manual` to step the
 * loader deterministically (no real timers), driving it via `window.__boot`.
 */
describe('ExplorerContainer — loading ceremony integration', () => {
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

  /** Drive the manual-boot loader to its `onComplete` via the window hook. */
  async function runLoaderToComplete() {
    // The loader attaches `window.__boot` in its own post-mount rAF; wait for it.
    await waitFor(() => expect(window.__boot).toBeTruthy());
    // Step through every named state to reach `done` (which fires onComplete).
    // Full timeline: 4 drops + rest + settle(fade) + settle(collapse) +
    // kernelHold + exit + done = 10.
    for (let i = 0; i < 10; i++) {
      const hook = window.__boot;
      if (!hook) break;
      act(() => hook.next());
    }
  }

  it('shows the loader first (not the primer), then opens the primer on its onComplete (first visit)', async () => {
    window.history.replaceState(null, '', '/?boot=manual');
    render(<ExplorerContainer />);

    // The loader is mounted; the primer is NOT open yet (it opens on complete).
    await waitFor(() =>
      expect(document.querySelector('[data-loading-screen]')).toBeTruthy(),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Drive the loader to completion → reveal + open the first-visit primer.
    await runLoaderToComplete();
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('heading', { name: STEP1_HEADING }),
    ).toBeInTheDocument();
  });

  it('returning visitor: the loader completes and reveals the explorer with NO primer', async () => {
    window.localStorage.setItem(PRIMER_SEEN_KEY, 'true');
    window.history.replaceState(null, '', '/?boot=manual');
    render(<ExplorerContainer />);

    await waitFor(() =>
      expect(document.querySelector('[data-loading-screen]')).toBeTruthy(),
    );
    await runLoaderToComplete();
    // Explorer revealed (header title), no primer dialog.
    await waitFor(() =>
      expect(screen.getByText('Little Red Riding Hood')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Shift+Cmd+L replays the full ceremony (remounts the loader)', async () => {
    window.localStorage.setItem(PRIMER_SEEN_KEY, 'true');
    window.history.replaceState(null, '', '/?boot=skip'); // start without the loader
    render(<ExplorerContainer />);

    // No loader on a skip boot.
    await waitFor(() =>
      expect(screen.getByText('Little Red Riding Hood')).toBeInTheDocument(),
    );
    expect(document.querySelector('[data-loading-screen]')).toBeNull();

    // The replay shortcut re-runs the ceremony, available in production.
    act(() => {
      fireEvent.keyDown(document, { key: 'L', shiftKey: true, metaKey: true });
    });
    await waitFor(() =>
      expect(document.querySelector('[data-loading-screen]')).toBeTruthy(),
    );
  });
});
