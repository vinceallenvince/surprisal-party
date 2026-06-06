import { test, expect, type Page } from '@playwright/test';

/**
 * Layer 1 (behavioral + screenshot capture) of the end-to-end test for the
 * Loading epic. Each `test.describe` mirrors one Gherkin user story from
 * `docs/user-scenarios.md` ("Loading"). The loader performs the app's own
 * mechanic while the default corpus cache warms: the phrase
 * "we threw you a surprisal party" compresses to its coral kernel.
 *
 * Captures are race-free via the `?boot=manual` step hook: the loader's timers
 * are suspended and the state machine advances exactly one named state per
 * `window.__boot.next()` call, so each keyframe is captured deterministically
 * (the mid-collapse window is otherwise a ~450 ms race). `data-phase` and
 * `data-dropped` on the loader root are the deterministic signals.
 *
 * The default Playwright context forces `reducedMotion: reduce` for stable
 * shots, but the staged collapse IS the thing under test here, so this spec
 * overrides it to `no-preference` so the words drop one-at-a-time.
 *
 * Screenshots are captured (viewport-only, NOT fullPage) into
 * `e2e/__screens__/loading/<label>.png` at the states that map to Figma frames:
 *   loading-full          → 84-833 (full annotated phrase)
 *   loading-collapse      → 84-861 (mid-collapse: threw/surprisal/party)
 *   loading-kernel-clean  → 84-877 (clean coral "surprisal party")
 *   loading-abbreviated   → 84-885 (returning-visitor end state)
 */

const PRIMER_SEEN_KEY = 'surprisalParty.primerSeen';
const SCREENS_DIR = 'e2e/__screens__/loading';

// The staged collapse needs motion; the default context reduces it.
test.use({ contextOptions: { reducedMotion: 'no-preference' } });

function shot(page: Page, label: string) {
  return page.screenshot({ path: `${SCREENS_DIR}/${label}.png` });
}

function loader(page: Page) {
  return page.locator('[data-loading-screen]');
}

/** Advance the manual-boot loader one named state (after its hook attaches). */
async function step(page: Page) {
  // The loader attaches `window.__boot` in a post-mount rAF; wait for it so the
  // very first step is never a silent no-op (which would desync the step count).
  await page.waitForFunction(() => typeof window.__boot?.next === 'function');
  await page.evaluate(() => window.__boot!.next());
}

test.describe('Loading — Story 1: first-time visitor sees the full ceremony', () => {
  test('compresses the welcome phrase to its kernel, capturing each keyframe', async ({
    page,
  }) => {
    // First-time visitor (empty storage). Manual boot suspends the timers so we
    // can step the collapse keyframe by keyframe.
    await page.goto('/?boot=manual');

    // --- Full annotated phrase (pre-load) ------------------------------------
    await expect(loader(page)).toBeVisible();
    await expect(loader(page)).toHaveAttribute('data-phase', 'hold');
    await expect(loader(page)).toHaveAttribute('data-dropped', '');
    // All six words present; the two kernel words are coral.
    for (const w of ['we', 'threw', 'you', 'a', 'surprisal', 'party']) {
      await expect(page.locator(`[data-token="${w}"]`)).toBeVisible();
    }
    await expect(
      page.locator('[data-token="surprisal"]'),
    ).toHaveAttribute('data-kernel', 'true');
    // Surprisal superscripts are present (no spinner / percentage / bar).
    await expect(page.locator('[data-sup]').first()).toBeAttached();
    await shot(page, 'loading-full');

    // --- Mid-collapse: drop a → we → you (threw/surprisal/party remain) -------
    await step(page); // drop a
    await step(page); // drop we
    await step(page); // drop you
    await expect(loader(page)).toHaveAttribute('data-dropped', 'a,we,you');
    await expect(page.locator('[data-token="a"]')).toHaveCount(0);
    await expect(page.locator('[data-token="we"]')).toHaveCount(0);
    await expect(page.locator('[data-token="you"]')).toHaveCount(0);
    await expect(page.locator('[data-token="threw"]')).toBeVisible();
    await expect(page.locator('[data-token="surprisal"]')).toBeVisible();
    await expect(page.locator('[data-token="party"]')).toBeVisible();
    await shot(page, 'loading-collapse');

    // --- Rest on the kernel, then settle to a clean coral "surprisal party" --
    await step(page); // drop threw → only kernel remains
    await expect(loader(page)).toHaveAttribute('data-dropped', 'a,we,you,threw');
    await step(page); // enter rest (manual gate is not load-blocked)
    await step(page); // settle stage 1: superscripts FADE (opacity → 0)
    await expect(loader(page)).toHaveAttribute('data-phase', 'settle');
    await expect(loader(page)).toHaveAttribute('data-settle', 'fading');
    await step(page); // settle stage 2: superscripts COLLAPSE (kernel words slide together)
    await expect(loader(page)).toHaveAttribute('data-settle', 'collapsed');
    await expect(page.locator('[data-token="surprisal"]')).toBeVisible();
    await expect(page.locator('[data-token="party"]')).toBeVisible();
    // The settle is a 300 ms CSS transition while the state flips synchronously;
    // wait for BOTH animated properties to reach their end values before the
    // capture so the shot never catches a superscript mid-fade/mid-collapse (the
    // clean Figma frame 84-877 shows fully gone superscripts). Deterministic — no
    // arbitrary timeout.
    const sup = page.locator('[data-sup] span').first();
    await expect(sup).toHaveCSS('opacity', '0');
    await expect(sup).toHaveCSS('max-width', '0px');
    await shot(page, 'loading-kernel-clean');

    // --- Complete: the loader fades out and the first-visit primer appears ---
    await step(page); // kernelHold
    await step(page); // exit
    await step(page); // done → onComplete → reveal + open primer
    await expect(
      page.getByRole('dialog'),
    ).toBeVisible();
    await expect(
      page
        .getByRole('dialog')
        .getByRole('heading', {
          name: /surprisal = how much a word surprises a predictor/i,
        }),
    ).toBeVisible();
  });
});

test.describe('Loading — Story 2: returning visitor gets the abbreviated loader', () => {
  test('compresses to the kernel and fades straight into the explorer (no primer)', async ({
    page,
    context,
  }) => {
    // Returning visitor: seed the primer-seen flag BEFORE the app mounts (same
    // idiom as onboarding.spec.ts). This selects the abbreviated loader and
    // suppresses the primer on completion.
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, PRIMER_SEEN_KEY);

    await page.goto('/?boot=manual');
    await expect(loader(page)).toBeVisible();

    // Step the loader through to its clean-kernel end state (abbreviated path is
    // the same staged collapse here; the difference is timing, which manual mode
    // suspends). Drop all four words, rest, settle.
    await step(page); // a
    await step(page); // we
    await step(page); // you
    await step(page); // threw
    await step(page); // rest
    await step(page); // settle stage 1: fade
    await expect(loader(page)).toHaveAttribute('data-phase', 'settle');
    await expect(loader(page)).toHaveAttribute('data-settle', 'fading');
    await step(page); // settle stage 2: collapse (kernel words slide together)
    await expect(loader(page)).toHaveAttribute('data-settle', 'collapsed');
    await expect(page.locator('[data-token="surprisal"]')).toBeVisible();
    await expect(page.locator('[data-token="party"]')).toBeVisible();
    // Wait for the settle transition to fully finish (both properties at their
    // end values) before the capture — see the kernel-clean shot above.
    const sup = page.locator('[data-sup] span').first();
    await expect(sup).toHaveCSS('opacity', '0');
    await expect(sup).toHaveCSS('max-width', '0px');
    await shot(page, 'loading-abbreviated');

    // --- Complete: fades directly into the explorer, NO primer ---------------
    await step(page); // kernelHold
    await step(page); // exit
    await step(page); // done → onComplete → reveal only (returning visitor)
    await expect(
      page.getByRole('heading', { name: /little red riding hood/i }),
    ).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
