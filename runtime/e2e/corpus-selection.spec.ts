import { test, expect, type Page } from '@playwright/test';

/**
 * Layer 1 (behavioral + screenshot capture) of the end-to-end test for the
 * Corpus Selection epic. Each `test.describe` mirrors one Gherkin user story
 * from `docs/user-scenarios.md` ("Corpus Selection"); assertions use accessible
 * selectors (role/name) that match the components' unit tests
 * (CorpusDrawer.test.tsx / AboutModal.test.tsx).
 *
 * Screenshots are captured (viewport-only, NOT fullPage) into
 * `e2e/__screens__/corpus-selection/<label>.png` at each state that maps to a
 * Figma UI frame, for the separate visual-alignment layer. No Figma work here.
 *
 * Mirrors `onboarding.spec.ts`: a `waitForExplorer` helper, an `addInitScript`
 * that preseeds the primer-seen flag (so the primer never gates the explorer),
 * a fresh context per test, role+name selectors, and auto-waiting (no sleeps).
 */

const PRIMER_SEEN_KEY = 'surprisalParty.primerSeen';
const CORPUS_TITLE = 'Little Red Riding Hood';
const SCREENS_DIR = 'e2e/__screens__/corpus-selection';

function shot(page: Page, label: string) {
  return page.screenshot({ path: `${SCREENS_DIR}/${label}.png` });
}

/**
 * Wait for the explorer corpus to finish loading. The container fetches the
 * tale JSON in the browser and shows a "Loading corpus…" skeleton until it
 * resolves; the header corpus title appears once the cache is in.
 */
async function waitForExplorer(page: Page) {
  await expect(
    page.getByRole('heading', { name: CORPUS_TITLE }),
  ).toBeVisible();
}

/** Preseed the primer-seen flag so the explorer is reachable on first paint. */
async function seedPrimerSeen(context: import('@playwright/test').BrowserContext) {
  await context.addInitScript((key) => {
    window.localStorage.setItem(key, 'true');
  }, PRIMER_SEEN_KEY);
}

test.describe('Corpus Selection — Story 1: open the corpus picker to switch corpora', () => {
  test('opens the drawer from the rail, shows the marked corpus + About, dismisses every way', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/?boot=skip');
    await waitForExplorer(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const railIcon = page.getByRole('button', { name: /open corpus picker/i });
    await expect(railIcon).toBeVisible();
    await expect(railIcon).toHaveAttribute('aria-expanded', 'false');

    // --- Open: the left-edge drawer slides in as a labelled "Corpora" dialog --
    await railIcon.click();
    const drawer = page.getByRole('dialog', { name: /corpora/i });
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute('aria-modal', 'true');
    await expect(railIcon).toHaveAttribute('aria-expanded', 'true');
    await expect(
      drawer.getByRole('heading', { name: /corpora/i }),
    ).toBeVisible();
    // The currently-loaded corpus is marked (aria-current) and NOT a button
    // (already loaded → nothing to switch to).
    await expect(drawer.locator('[aria-current="true"]')).toContainText(
      CORPUS_TITLE,
    );
    await expect(
      drawer.getByRole('button', { name: new RegExp(CORPUS_TITLE, 'i') }),
    ).toHaveCount(0);
    // A quiet "About" link sits at the bottom of the drawer.
    await expect(drawer.getByRole('button', { name: /^about$/i })).toBeVisible();
    await shot(page, 'open-corpora-menu');

    // --- Dismiss via the scrim ------------------------------------------------
    // NOTE: the rail icon cannot be re-clicked to close in a real browser — the
    // drawer's full-viewport scrim (z-50) sits over the rail and intercepts the
    // pointer. The unit test exercises the icon-again toggle via fireEvent
    // (which bypasses hit-testing); here we verify the two pointer/keyboard
    // dismissal paths that actually work against the live overlay: scrim + Esc.
    //
    // The scrim is the overlay behind the 320px-wide left panel; click well to
    // the right of the panel so the click lands on the scrim itself.
    await page
      .locator('[data-corpus-scrim]')
      .click({ position: { x: 900, y: 400 } });
    await expect(page.getByRole('dialog', { name: /corpora/i })).toHaveCount(0);
    await expect(railIcon).toHaveAttribute('aria-expanded', 'false');

    // --- Dismiss via Esc ------------------------------------------------------
    await railIcon.click();
    await expect(page.getByRole('dialog', { name: /corpora/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /corpora/i })).toHaveCount(0);
    await expect(railIcon).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('Corpus Selection — Story 2: selecting a corpus loads it fresh', () => {
  test('selecting a different corpus re-fetches its cache and resets the view', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/?boot=skip');
    await waitForExplorer(page); // default corpus (LRRH) loaded

    // Open the picker and select the OTHER corpus (Hansel and Gretel) — the
    // current corpus is a non-interactive row, so the other is the only button.
    await page.getByRole('button', { name: /open corpus picker/i }).click();
    const drawer = page.getByRole('dialog', { name: /corpora/i });
    await expect(drawer).toBeVisible();
    const otherCorpus = drawer.getByRole('button', {
      name: /hansel and gretel/i,
    });
    await expect(otherCorpus).toBeVisible();
    await otherCorpus.click();

    // The drawer collapses and the explorer reloads fresh with the new corpus.
    await expect(page.getByRole('dialog', { name: /corpora/i })).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: /hansel and gretel/i }),
    ).toBeVisible();
    // The view resets: slider snaps back to UNCOMPRESSED (stop 0).
    await expect(
      page.getByRole('slider', { name: /compression level/i }),
    ).toHaveAttribute('aria-valuenow', '0');

    await shot(page, 'load-new-corpora');
  });
});

test.describe('Corpus Selection — Story 3: read more about the project from the drawer', () => {
  test('opens the About modal from the drawer, shows the write-up link, dismisses', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/?boot=skip');
    await waitForExplorer(page);

    // Open the drawer, then click the quiet "About" link at its bottom.
    await page.getByRole('button', { name: /open corpus picker/i }).click();
    const drawer = page.getByRole('dialog', { name: /corpora/i });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: /^about$/i }).click();

    // About stacks ABOVE the still-open drawer (Figma shows the drawer behind
    // About). The drawer steps aside (drops aria-modal / goes aria-hidden) so
    // About alone is the active modal, but stays mounted underneath.
    const about = page.getByRole('dialog', { name: /surprisal party/i });
    await expect(about).toBeVisible();
    await expect(
      about.getByRole('heading', { name: /surprisal party/i }),
    ).toBeVisible();
    // The drawer is still in the DOM behind About, just hidden from AT.
    await expect(
      page.locator('[aria-labelledby="corpus-drawer-heading"]'),
    ).toHaveAttribute('aria-hidden', 'true');

    // The write-up link shows its destination and opens in a new tab.
    const writeup = about.getByRole('link', { name: /vinceallen\.com/i });
    await expect(writeup).toBeVisible();
    await expect(writeup).toHaveAttribute('href', 'https://vinceallen.com');
    await expect(writeup).toHaveAttribute('target', '_blank');
    // This screenshot now intentionally shows the drawer behind the About modal.
    await shot(page, 'about-modal');

    // Dismiss via the Close button: About closes and I return to the open
    // drawer (NOT the bare explorer). The drawer is the active modal again.
    await about.getByRole('button', { name: /close/i }).click();
    await expect(
      page.getByRole('dialog', { name: /surprisal party/i }),
    ).toHaveCount(0);
    const reopenedDrawer = page.getByRole('dialog', { name: /corpora/i });
    await expect(reopenedDrawer).toBeVisible();
    await expect(reopenedDrawer).toHaveAttribute('aria-modal', 'true');
  });
});
