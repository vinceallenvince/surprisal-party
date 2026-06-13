import { test, expect, type Page } from '@playwright/test';

/**
 * Mobile onboarding spec — the primer is unchanged on mobile (all 4 steps) but
 * reflows to the narrow viewport. Captures 6 screenshots into
 * `e2e/__screens__/onboarding/mobile/` for the figma-alignment skill.
 *
 * Mobile frames in figma-sources.yaml:
 *   surprisal-definition           → 101-64
 *   surprisal-values               → 101-114
 *   onboarding-slider-uncompressed → 101-166
 *   onboarding-max-compression     → 101-268
 *   onboarding-predict-button      → 101-340
 *   onboarding-prediction-results  → 101-396
 */

const SCREENS_DIR = 'e2e/__screens__/onboarding/mobile';

function shot(page: Page, label: string) {
  return page.screenshot({ path: `${SCREENS_DIR}/${label}.png` });
}

test.describe('Mobile Onboarding — first-time visitor sees the 4-step primer', () => {
  test('walks the full primer at mobile width', async ({ page }) => {
    await page.goto('/?boot=skip');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Step 1: vocabulary definition
    await expect(
      dialog.getByRole('heading', {
        name: /surprisal = how much a word surprises a predictor/i,
      }),
    ).toBeVisible();
    await shot(page, 'surprisal-definition');

    await dialog.getByRole('button', { name: /next/i }).click();

    // Step 2: annotated surprisal values
    await expect(dialog.getByText('20')).toBeAttached();
    await shot(page, 'surprisal-values');

    await dialog.getByRole('button', { name: /next/i }).click();

    // Step 3: threshold slider, initially uncompressed
    const slider = dialog.getByRole('slider', {
      name: /surprisal threshold/i,
    });
    await expect(slider).toBeVisible();
    const next = dialog.getByRole('button', { name: /next/i });
    await expect(next).toBeDisabled();
    await shot(page, 'onboarding-slider-uncompressed');

    // Move slider to max compression
    await slider.focus();
    await slider.press('End');
    await expect(next).toBeEnabled();
    await shot(page, 'onboarding-max-compression');

    await next.click();

    // Step 4: predict / lossy reconstruction
    const predict = dialog.getByRole('button', {
      name: /predict the uncompressed text/i,
    });
    await expect(predict).toBeVisible();
    const gotIt = dialog.getByRole('button', { name: /got it/i });
    await expect(gotIt).toBeDisabled();
    await shot(page, 'onboarding-predict-button');

    await predict.click();

    await expect(dialog.getByText('0.68')).toBeVisible();
    await expect(gotIt).toBeEnabled();
    await shot(page, 'onboarding-prediction-results');
  });
});
