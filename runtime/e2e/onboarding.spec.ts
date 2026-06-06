import { test, expect, type Page } from '@playwright/test';

/**
 * Layer 1 (behavioral + screenshot capture) of the end-to-end test for the
 * Onboarding epic. Each `test.describe` mirrors one Gherkin user story; the
 * assertions use accessible selectors (role/name) that match the components'
 * unit tests (PrimerModal.test.tsx / MetricsModal.test.tsx).
 *
 * Screenshots are captured (viewport-only, NOT fullPage) into
 * `e2e/__screens__/onboarding/<label>.png` at each state that maps to a Figma
 * UI frame. The filenames (labels) are fixed so the separate "visual alignment"
 * layer can pair each shot with its design frame. No Figma work happens here.
 *
 * Every navigation uses `?boot=skip` so the loading ceremony (which now sits in
 * front of the whole app) does not block these assertions — the loader has its
 * own spec (`loading.spec.ts`).
 */

const PRIMER_SEEN_KEY = 'surprisalParty.primerSeen';
const CORPUS_TITLE = 'Little Red Riding Hood';
const SCREENS_DIR = 'e2e/__screens__/onboarding';

function shot(page: Page, label: string) {
  return page.screenshot({ path: `${SCREENS_DIR}/${label}.png` });
}

/**
 * Wait for the explorer corpus to finish loading (the container fetches the
 * tale JSON in the browser and shows a "Loading corpus…" skeleton until it
 * resolves). The header corpus title appears once the cache is in.
 */
async function waitForExplorer(page: Page) {
  await expect(
    page.getByRole('heading', { name: CORPUS_TITLE }),
  ).toBeVisible();
}

test.describe('Onboarding — Story 1: first-time visitor sees the 4-step primer', () => {
  test('walks the full primer and persists the seen-flag', async ({ page }) => {
    // First visit = empty storage; nothing to seed.
    await page.goto('/?boot=skip');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // --- Step 1: vocabulary definition -------------------------------------
    await expect(
      dialog.getByRole('heading', {
        name: /surprisal = how much a word surprises a predictor/i,
      }),
    ).toBeVisible();
    await expect(
      dialog.getByText(
        /predictable words carry little information, surprising words carry a lot/i,
      ),
    ).toBeVisible();
    await shot(page, 'surprisal-definition');

    await dialog.getByRole('button', { name: /next/i }).click();

    // --- Step 2: annotated surprisal values --------------------------------
    // The surprisal numbers render as baseline-aligned <sup>s with zero box
    // height, so assert presence (attached) rather than geometric visibility —
    // this mirrors the unit test's `toBeInTheDocument()`.
    await expect(dialog.getByText('20')).toBeAttached(); // predictor's surprisal
    await expect(dialog.getByText('12')).toBeAttached(); // surprises' surprisal
    await expect(
      dialog.getByText(/the small number is each word's surprisal/i),
    ).toBeVisible();
    await shot(page, 'surprisal-values');

    await dialog.getByRole('button', { name: /next/i }).click();

    // --- Step 3: threshold slider, initially uncompressed ------------------
    const slider = dialog.getByRole('slider', {
      name: /surprisal threshold/i,
    });
    await expect(slider).toBeVisible();
    const next = dialog.getByRole('button', { name: /next/i });
    await expect(next).toBeDisabled();
    await shot(page, 'onboarding-slider-uncompressed');

    // Move the slider to max compression: only the kernel "predictor" survives.
    await slider.focus();
    await slider.press('End');

    await expect(next).toBeEnabled();
    // The kernel word remains; a dropped word collapses (zero-width, aria-hidden).
    await expect(
      dialog.locator('[data-token="predictor"][data-survives="true"]'),
    ).toBeVisible();
    await expect(
      dialog.locator('[data-token="surprises"]'),
    ).not.toBeVisible();
    await shot(page, 'onboarding-max-compression');

    await next.click();

    // --- Step 4: predict / lossy reconstruction ----------------------------
    const predict = dialog.getByRole('button', {
      name: /predict the uncompressed text/i,
    });
    await expect(predict).toBeVisible();
    await expect(
      dialog.getByText(/the higher the surprisal, the more lossy the prediction/i),
    ).toBeVisible();
    const gotIt = dialog.getByRole('button', { name: /got it/i });
    await expect(gotIt).toBeDisabled();
    await shot(page, 'onboarding-predict-button');

    await predict.click();

    // The lossy reconstruction readout appears: actual text + 0.68 fidelity.
    await expect(dialog.getByText(/how much a word surprises a/i)).toBeVisible();
    await expect(dialog.getByText('0.68')).toBeVisible();
    await expect(gotIt).toBeEnabled();
    await shot(page, 'onboarding-prediction-results');

    await gotIt.click();

    // --- Dismissed: explorer revealed, seen-flag persisted -----------------
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await waitForExplorer(page);

    const seen = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      PRIMER_SEEN_KEY,
    );
    expect(seen).toBe('true');
  });
});

test.describe('Onboarding — Story 2: returning visitor skips the primer', () => {
  test('loads straight into the explorer and can re-summon the primer', async ({
    page,
    context,
  }) => {
    // Returning visitor: seed the seen-flag BEFORE the app mounts.
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, PRIMER_SEEN_KEY);

    await page.goto('/?boot=skip');

    // No primer; the explorer is shown.
    await waitForExplorer(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await shot(page, 'onboarding-modal-removed');

    // The title ⓘ re-summons the primer at any time, regardless of the flag.
    await page.getByRole('button', { name: /about surprisal/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page
        .getByRole('dialog')
        .getByRole('heading', {
          name: /surprisal = how much a word surprises a predictor/i,
        }),
    ).toBeVisible();
  });
});

test.describe('Onboarding — Story 3: metrics explainer', () => {
  test('opens and closes the metrics modal from the header ⓘ', async ({
    page,
    context,
  }) => {
    // Returning-visitor setup so the primer does not block the explorer.
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, PRIMER_SEEN_KEY);

    await page.goto('/?boot=skip');
    await waitForExplorer(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // The header showing the metrics ⓘ.
    const metricsInfo = page.getByRole('button', {
      name: /what the metrics mean/i,
    });
    await expect(metricsInfo).toBeVisible();
    await shot(page, 'metrics-info-icon');

    await metricsInfo.click();

    const metricsDialog = page.getByRole('dialog', {
      name: /what the header numbers mean/i,
    });
    await expect(metricsDialog).toBeVisible();
    await expect(metricsDialog.getByText('stored', { exact: true })).toBeVisible();
    await expect(metricsDialog.getByText('removed', { exact: true })).toBeVisible();
    await expect(
      metricsDialog.getByText('avg fidelity', { exact: true }),
    ).toBeVisible();
    await shot(page, 'metrics-modal');

    // Dismiss via the Close button and confirm it closes.
    await metricsDialog.getByRole('button', { name: /close/i }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
