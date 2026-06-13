import { test, expect, type Page } from '@playwright/test';

/**
 * Mobile corpus-selection spec — on mobile the picker is opened from the header
 * icon (not the left rail) and the drawer is full-width. No metrics readout to
 * assert. Captures 3 screenshots into `e2e/__screens__/corpus-selection/mobile/`
 * for the figma-alignment skill.
 *
 * Mobile frames in figma-sources.yaml:
 *   open-corpora-menu → 105-2
 *   load-new-corpora  → 105-60
 *   about-modal       → 105-97
 */

const PRIMER_SEEN_KEY = 'surprisalParty.primerSeen';
const SCREENS_DIR = 'e2e/__screens__/corpus-selection/mobile';

function shot(page: Page, label: string) {
  return page.screenshot({ path: `${SCREENS_DIR}/${label}.png` });
}

async function waitForExplorer(page: Page) {
  await expect(
    page.getByRole('slider', { name: /compression level/i }),
  ).toBeVisible();
}

async function seedPrimerSeen(context: import('@playwright/test').BrowserContext) {
  await context.addInitScript((key) => {
    window.localStorage.setItem(key, 'true');
  }, PRIMER_SEEN_KEY);
}

test.describe('Mobile Corpus Selection — open the picker', () => {
  test('opens the full-width drawer from the header icon', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/?boot=skip');
    await waitForExplorer(page);

    // On mobile the picker icon is in the header
    const pickerIcon = page.getByRole('button', { name: /open corpus picker/i });
    await expect(pickerIcon).toBeVisible();
    await pickerIcon.click();

    const drawer = page.getByRole('dialog', { name: /corpora/i });
    await expect(drawer).toBeVisible();
    await shot(page, 'open-corpora-menu');
  });
});

test.describe('Mobile Corpus Selection — select a corpus', () => {
  test('selecting a different corpus loads it fresh', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/?boot=skip');
    await waitForExplorer(page);

    await page.getByRole('button', { name: /open corpus picker/i }).click();
    const drawer = page.getByRole('dialog', { name: /corpora/i });
    await expect(drawer).toBeVisible();
    const otherCorpus = drawer.getByRole('button', {
      name: /hansel and gretel/i,
    });
    await expect(otherCorpus).toBeVisible();
    await otherCorpus.click();

    await expect(page.getByRole('dialog', { name: /corpora/i })).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: /hansel and gretel/i }),
    ).toBeVisible();
    await shot(page, 'load-new-corpora');
  });
});

test.describe('Mobile Corpus Selection — about modal', () => {
  test('opens the About modal from the drawer', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/?boot=skip');
    await waitForExplorer(page);

    await page.getByRole('button', { name: /open corpus picker/i }).click();
    const drawer = page.getByRole('dialog', { name: /corpora/i });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: /^about$/i }).click();

    const about = page.getByRole('dialog', { name: /surprisal party/i });
    await expect(about).toBeVisible();
    await shot(page, 'about-modal');
  });
});
