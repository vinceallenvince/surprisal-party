import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Mobile compression spec — view-only compression: slider + prose + seam marks.
 * No right strip, no header metrics, no seam reveal, no inspector. Captures 5
 * screenshots into `e2e/__screens__/compression-prediction/mobile/` for the
 * figma-alignment skill.
 *
 * Mobile frames in figma-sources.yaml:
 *   compress-light     → 113-6
 *   compress-heavy     → 113-63
 *   decompress-before  → 113-113
 *   decompress-after   → 113-169
 *   kernel             → 113-206
 */

const PRIMER_SEEN_KEY = 'surprisalParty.primerSeen';
const CORPUS_TITLE = 'Little Red Riding Hood';
const SCREENS_DIR = 'e2e/__screens__/compression-prediction/mobile';

function shot(page: Page, label: string) {
  return page.screenshot({ path: `${SCREENS_DIR}/${label}.png` });
}

async function waitForExplorer(page: Page) {
  await expect(
    page.getByRole('heading', { name: CORPUS_TITLE }),
  ).toBeVisible();
}

async function seedPrimerSeen(context: import('@playwright/test').BrowserContext) {
  await context.addInitScript((key) => {
    window.localStorage.setItem(key, 'true');
  }, PRIMER_SEEN_KEY);
}

function slider(page: Page): Locator {
  return page.getByRole('slider', { name: /compression level/i });
}

async function setCompression(page: Page, fraction: number): Promise<number> {
  const track = slider(page);
  const box = await track.boundingBox();
  if (!box) throw new Error('slider track has no bounding box');
  const x = box.x + box.width * fraction;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await expect(track).not.toHaveAttribute('aria-valuenow', '');
  const now = await track.getAttribute('aria-valuenow');
  return Number(now);
}

function seamPipes(page: Page): Locator {
  return page.locator('[data-seam-pipe]');
}

test.describe('Mobile Compression — compress rightward', () => {
  test('raising the threshold removes words (no right strip, no metrics)', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/?boot=skip');
    await waitForExplorer(page);

    // Start at UNCOMPRESSED: no seams
    expect(
      Number(await slider(page).getAttribute('aria-valuenow')),
    ).toBe(0);
    await expect(seamPipes(page)).toHaveCount(0);

    // Low compression — seams appear
    const low = await setCompression(page, 0.25);
    expect(low).toBeGreaterThan(0);
    await expect(seamPipes(page).first()).toBeVisible();
    await shot(page, 'compress-light');

    // Higher compression — more seams
    const high = await setCompression(page, 0.75);
    expect(high).toBeGreaterThan(low);
    await expect(seamPipes(page).first()).toBeVisible();
    await shot(page, 'compress-heavy');
  });
});

test.describe('Mobile Compression — decompress leftward', () => {
  test('lowering the threshold removes seams', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/?boot=skip');
    await waitForExplorer(page);

    // Start at MAX
    const max = await setCompression(page, 1.0);
    expect(max).toBe(4);
    await expect(seamPipes(page).first()).toBeVisible();
    await shot(page, 'decompress-before');

    // Move left
    const lower = await setCompression(page, 0.25);
    expect(lower).toBeLessThan(max);
    await shot(page, 'decompress-after');
  });
});

test.describe('Mobile Compression — kernel', () => {
  test('MAX shows only the kernel', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/?boot=skip');
    await waitForExplorer(page);

    const max = await setCompression(page, 1.0);
    expect(max).toBe(4);
    await expect(seamPipes(page).first()).toBeVisible();
    await shot(page, 'kernel');
  });
});
