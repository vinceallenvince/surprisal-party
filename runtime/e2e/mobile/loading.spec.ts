import { test, expect, type Page } from '@playwright/test';

/**
 * Mobile loading spec — captures the same boot ceremony as the desktop spec at
 * the mobile viewport (393×852). Screenshots write to
 * `e2e/__screens__/loading/mobile/` for the figma-alignment skill.
 *
 * Mobile frames in figma-sources.yaml:
 *   loading-full          → 101-32
 *   loading-collapse      → 101-2
 *   loading-kernel-clean  → 101-18
 */

const PRIMER_SEEN_KEY = 'surprisalParty.primerSeen';
const SCREENS_DIR = 'e2e/__screens__/loading/mobile';

test.use({ contextOptions: { reducedMotion: 'no-preference' } });

function shot(page: Page, label: string) {
  return page.screenshot({ path: `${SCREENS_DIR}/${label}.png` });
}

function loader(page: Page) {
  return page.locator('[data-loading-screen]');
}

async function step(page: Page) {
  await page.waitForFunction(() => typeof window.__boot?.next === 'function');
  await page.evaluate(() => window.__boot!.next());
}

test.describe('Mobile Loading — full ceremony', () => {
  test('compresses the welcome phrase at mobile width', async ({ page }) => {
    await page.goto('/?boot=manual');

    await expect(loader(page)).toBeVisible();
    await expect(loader(page)).toHaveAttribute('data-phase', 'hold');
    await shot(page, 'loading-full');

    // Mid-collapse: drop a → we → you (threw/surprisal/party remain)
    await step(page); // drop a
    await step(page); // drop we
    await step(page); // drop you
    await expect(loader(page)).toHaveAttribute('data-dropped', 'a,we,you');
    await shot(page, 'loading-collapse');

    // Drop threw, rest, settle (fade + collapse) → clean kernel
    await step(page); // drop threw
    await step(page); // rest
    await step(page); // settle fade
    await step(page); // settle collapse
    await expect(loader(page)).toHaveAttribute('data-settle', 'collapsed');
    const sup = page.locator('[data-sup] span').first();
    await expect(sup).toHaveCSS('opacity', '0');
    await expect(sup).toHaveCSS('max-width', '0px');
    await shot(page, 'loading-kernel-clean');
  });
});
