import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Layer 1 (behavioral + screenshot capture) of the end-to-end test for the
 * Compression and Reconstruction epic. Each `test.describe` mirrors one
 * Gherkin user story from `docs/user-scenarios.md` ("Compression and
 * Reconstruction"); assertions use accessible selectors (role/name) that match
 * the components' unit tests (CompressionSlider/ProseColumn/PredictedStrip).
 *
 * Screenshots are captured (viewport-only, NOT fullPage) into
 * `e2e/__screens__/compression-prediction/<label>.png` for the separate
 * visual-alignment layer. No Figma work here.
 *
 * Mirrors `onboarding.spec.ts`: a `waitForExplorer` helper, an `addInitScript`
 * that preseeds the primer-seen flag, a fresh context per test, role+name
 * selectors, and auto-waiting (no sleeps).
 *
 * Slider note: `CompressionSlider` is POINTER-only (not keyboard-operable) by
 * design (the arrow keys drive the seam walk). We drive it by clicking its
 * track at an x-fraction of the bounding box and assert the resulting
 * `aria-valuenow` (0–4). Stop 0 = UNCOMPRESSED, 4 = MAX COMPRESSED.
 *
 * Seam walk note: the walk is a DOCUMENT-level keydown — `page.keyboard.press`
 * works without focusing anything, as long as no modal dialog is open.
 */

const PRIMER_SEEN_KEY = 'surprisalParty.primerSeen';
const CORPUS_TITLE = 'Little Red Riding Hood';
const SCREENS_DIR = 'e2e/__screens__/compression-prediction';

const INSPECTOR_PLACEHOLDER = 'Press an arrow key to walk the seams';

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

/**
 * Drive the pointer-only slider by clicking its track at `fraction` (0–1) of
 * the track width, then wait for the reported `aria-valuenow` to settle. The
 * fraction snaps to the nearest of the five stops, so e.g. 0 → 0, 0.5 → 2,
 * 1 → 4. Returns the resolved stop index.
 */
async function setCompression(page: Page, fraction: number): Promise<number> {
  const track = slider(page);
  const box = await track.boundingBox();
  if (!box) throw new Error('slider track has no bounding box');
  const x = box.x + box.width * fraction;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  // The thumb snaps discretely; aria-valuenow updates synchronously on click.
  await expect(track).not.toHaveAttribute('aria-valuenow', '');
  const now = await track.getAttribute('aria-valuenow');
  return Number(now);
}

async function valueNow(page: Page): Promise<number> {
  return Number(await slider(page).getAttribute('aria-valuenow'));
}

/** Read the header readout numbers: { stored, removed, fidelity|null }. */
async function readHeader(page: Page): Promise<{
  stored: number;
  removed: number;
  fidelity: number | null;
}> {
  const header = page.getByRole('banner');
  const text = (await header.innerText()).replace(/\s+/g, ' ');
  // "stored 99.x% · removed 0.x% · avg fidelity 0.xx" (or "—" at UNCOMPRESSED).
  const stored = Number(/stored\s+([\d.]+)%/i.exec(text)?.[1] ?? 'NaN');
  const removed = Number(/removed\s+([\d.]+)%/i.exec(text)?.[1] ?? 'NaN');
  const fidMatch = /avg fidelity\s+([\d.]+|—)/i.exec(text)?.[1];
  const fidelity = fidMatch === undefined || fidMatch === '—' ? null : Number(fidMatch);
  return { stored, removed, fidelity };
}

function seamPipes(page: Page): Locator {
  return page.locator('[data-seam-pipe]');
}

function removedTiles(page: Page): Locator {
  return page.getByRole('button', { name: /reveal prediction for/i });
}

/**
 * The reconstruction inspector's "Actual" source-text value — the span that
 * immediately follows the "Actual" label. Changes as the active seam moves, so
 * it's a reliable signal that the walk advanced to a different seam.
 */
function inspectorActual(page: Page): Locator {
  return page
    .locator('span', { hasText: /^Actual$/ })
    .locator('xpath=following-sibling::span[1]');
}

test.describe('Compression — Story 1: compress by dragging the slider rightward', () => {
  test('raising the threshold removes words, grows the strip, and lowers fidelity', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/');
    await waitForExplorer(page);

    // Start at UNCOMPRESSED: no removed words, no seams, fidelity unscored.
    expect(await valueNow(page)).toBe(0);
    const uncompressed = await readHeader(page);
    expect(uncompressed.removed).toBe(0);
    expect(uncompressed.fidelity).toBeNull();
    await expect(seamPipes(page)).toHaveCount(0);

    // --- Move to a low stop ---------------------------------------------------
    const low = await setCompression(page, 0.25);
    expect(low).toBeGreaterThan(0);
    await expect(seamPipes(page).first()).toBeVisible();
    await expect(removedTiles(page).first()).toBeVisible();
    const lowHeader = await readHeader(page);
    expect(lowHeader.removed).toBeGreaterThan(uncompressed.removed);
    expect(lowHeader.fidelity).not.toBeNull();
    await shot(page, 'compress-light');

    const lowSeamCount = await seamPipes(page).count();
    const lowTileCount = await removedTiles(page).count();

    // --- Move to a higher stop: threshold rises, more removed, fidelity falls -
    const high = await setCompression(page, 0.75);
    expect(high).toBeGreaterThan(low);
    const highHeader = await readHeader(page);
    expect(highHeader.removed).toBeGreaterThan(lowHeader.removed);
    expect(highHeader.stored).toBeLessThan(lowHeader.stored);
    expect(highHeader.fidelity!).toBeLessThan(lowHeader.fidelity!);
    expect(await seamPipes(page).count()).toBeGreaterThan(lowSeamCount);
    expect(await removedTiles(page).count()).toBeGreaterThan(lowTileCount);
    await shot(page, 'compress-heavy');
  });
});

test.describe('Compression — Story 2: decompress by dragging the slider leftward', () => {
  test('lowering the threshold returns tiles, removes seams, and lowers removed%', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/');
    await waitForExplorer(page);

    // Start compressed (MAX).
    const max = await setCompression(page, 1.0);
    expect(max).toBe(4);
    const compressed = await readHeader(page);
    const compressedTiles = await removedTiles(page).count();
    expect(await seamPipes(page).count()).toBeGreaterThan(0);
    expect(compressedTiles).toBeGreaterThan(0);
    await shot(page, 'decompress-before');

    // --- Move left to a lower stop -------------------------------------------
    const lower = await setCompression(page, 0.25);
    expect(lower).toBeLessThan(max);
    const decompressed = await readHeader(page);
    expect(decompressed.removed).toBeLessThan(compressed.removed);
    expect(decompressed.stored).toBeGreaterThan(compressed.stored);
    // Tiles return to the middle column as their source text reappears: fewer
    // words are removed, so the strip holds fewer tiles. (NOTE: raw seam *count*
    // is NOT a decompression proxy — at MAX many adjacent gaps merge into FEWER,
    // larger seams, so the count can actually be lower at MAX than at a shallow
    // stop. The removed%/stored% readout and the tile count are the robust
    // signals, so we assert on those.)
    expect(await removedTiles(page).count()).toBeLessThan(compressedTiles);
    await shot(page, 'decompress-after');
  });
});

test.describe('Compression — Story 3: walk through the seams with the arrow keys', () => {
  test('arrow keys step the active seam; Esc clears it', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/');
    await waitForExplorer(page);

    // A mid stop gives us several seams to walk.
    await setCompression(page, 0.5);
    await expect(seamPipes(page).first()).toBeVisible();

    const inspector = page.getByText(INSPECTOR_PLACEHOLDER);
    await expect(inspector).toBeVisible(); // hint shown, no seam active yet
    await expect(seamPipes(page).locator('[data-seam-active]')).toHaveCount(0);

    // --- First ArrowRight: seam 0 active, inspector fills --------------------
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(INSPECTOR_PLACEHOLDER)).toHaveCount(0);
    await expect(page.getByText('Actual', { exact: true })).toBeVisible();
    await expect(page.getByText('Fidelity', { exact: true })).toBeVisible();
    // The active seam carries a data-seam-active marker.
    await expect(page.locator('[data-seam-active]')).toHaveCount(1);
    // Capture the inspector's actual source text — it identifies the active
    // seam (auto-scroll re-centers the active pipe, so its viewport position is
    // NOT a reliable "did it move" signal; the inspector content is).
    const firstActualText = (await inspectorActual(page).first().innerText()).trim();
    expect(firstActualText.length).toBeGreaterThan(0);
    await shot(page, 'walk-first-seam');

    // --- ArrowRight again: next seam in story order --------------------------
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-seam-active]')).toHaveCount(1);
    // The inspector now reflects a different seam's actual text.
    await expect(inspectorActual(page).first()).not.toHaveText(firstActualText);
    await shot(page, 'walk-next-seam');

    // --- ArrowLeft: previous seam (still exactly one active) -----------------
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-seam-active]')).toHaveCount(1);

    // --- Esc: active seam cleared, the hint placeholder returns --------------
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-seam-active]')).toHaveCount(0);
    await expect(page.getByText(INSPECTOR_PLACEHOLDER)).toBeVisible();
  });
});

test.describe('Compression — Story 4: click a removed word to reveal its seam', () => {
  test('hovering a tile signals interactivity; clicking activates its seam', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/');
    await waitForExplorer(page);

    await setCompression(page, 0.5);
    const tile = removedTiles(page).first();
    await expect(tile).toBeVisible();

    // The tile is a real button with a hover rollover (text brightens). We
    // assert the interactive affordance via the hover utility classes the unit
    // test relies on, plus that it is a <button>.
    await expect(tile).toHaveClass(/hover:text-prose/);
    await tile.hover();
    await shot(page, 'removed-hover');

    // No seam is active before the click.
    await expect(page.locator('[data-seam-active]')).toHaveCount(0);

    // --- Click the tile: its seam activates, inspector fills, tile highlights -
    await tile.click();
    await expect(page.getByText(INSPECTOR_PLACEHOLDER)).toHaveCount(0);
    await expect(page.getByText('Actual', { exact: true })).toBeVisible();
    await expect(page.getByText('Fidelity', { exact: true })).toBeVisible();
    await expect(page.locator('[data-seam-active]')).toHaveCount(1);
    // The clicked tile (and any sharing its seam) is highlighted (data-active).
    await expect(page.locator('button[data-active="true"]').first()).toBeVisible();
    await shot(page, 'removed-click-revealed');
  });
});

test.describe('Compression — Story 5: nudged to discover the arrow-key walk', () => {
  test('the arrow-key hint appears on first compression and dismisses on an arrow key', async ({
    page,
    context,
  }) => {
    // Fresh context (session-scoped hint state is clean) — preseed primer only.
    await seedPrimerSeen(context);
    await page.goto('/');
    await waitForExplorer(page);

    // No hint at UNCOMPRESSED.
    await expect(
      page.getByRole('status', { name: /use arrow keys to walk the seams/i }),
    ).toHaveCount(0);

    // First move past UNCOMPRESSED → the hint bubble appears above the first seam.
    await setCompression(page, 0.5);
    const hint = page.getByRole('status', {
      name: /use arrow keys to walk the seams/i,
    });
    await expect(hint).toBeVisible();
    await expect(page.getByText('← keys →')).toBeVisible();
    await shot(page, 'keyboard-hint');

    // Engaging (an arrow key) dismisses the hint and does not bring it back.
    await page.keyboard.press('ArrowRight');
    await expect(hint).toHaveCount(0);
  });
});

test.describe('Compression — Story 6: see prediction fidelity fall as I compress', () => {
  test('inspector shows a 0–1 fidelity; header avg fidelity is lower when more compressed', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/');
    await waitForExplorer(page);

    // --- Low stop: activate a seam, assert inspector format + capture avg ----
    await setCompression(page, 0.25);
    await expect(seamPipes(page).first()).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Actual', { exact: true })).toBeVisible();

    // The inspector's Fidelity readout is a 0–1 number with two decimals. It
    // sits immediately after the "Fidelity" label; read the trailing value.
    const fidelityValue = page
      .locator('span', { hasText: /^Fidelity$/ })
      .locator('xpath=following-sibling::span[1]');
    const lowFidText = (await fidelityValue.first().innerText()).trim();
    expect(lowFidText).toMatch(/^\d\.\d{2}$/);
    const lowFidNum = Number(lowFidText);
    expect(lowFidNum).toBeGreaterThanOrEqual(0);
    expect(lowFidNum).toBeLessThanOrEqual(1);

    const lowHeader = await readHeader(page);
    expect(lowHeader.fidelity).not.toBeNull();
    await shot(page, 'fidelity-light');

    // --- High stop: activate a seam, assert header avg fidelity is LOWER -----
    await setCompression(page, 1.0);
    await expect(seamPipes(page).first()).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Actual', { exact: true })).toBeVisible();

    const highHeader = await readHeader(page);
    expect(highHeader.fidelity).not.toBeNull();
    // The monotonic-regime claim: deeper compression → lower average fidelity.
    expect(highHeader.fidelity!).toBeLessThan(lowHeader.fidelity!);
    await shot(page, 'fidelity-heavy');
  });
});

test.describe('Compression — Story 7: compress to its kernel', () => {
  test('MAX leaves only the kernel; removed is maxed, fidelity is lowest; a seam reconstructs', async ({
    page,
    context,
  }) => {
    await seedPrimerSeen(context);
    await page.goto('/');
    await waitForExplorer(page);

    // Capture a mid-stop reference so we can assert MAX is the extreme.
    const mid = await setCompression(page, 0.5);
    expect(mid).toBeGreaterThan(0);
    const midHeader = await readHeader(page);

    // --- Far right: MAX COMPRESSED -------------------------------------------
    const max = await setCompression(page, 1.0);
    expect(max).toBe(4);
    await expect(seamPipes(page).first()).toBeVisible();
    const maxHeader = await readHeader(page);
    // Removed is at its max and avg fidelity at its lowest relative to the mid stop.
    expect(maxHeader.removed).toBeGreaterThan(midHeader.removed);
    expect(maxHeader.fidelity!).toBeLessThan(midHeader.fidelity!);

    // Activating a seam shows the reconstruction (actual source text + fidelity).
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(INSPECTOR_PLACEHOLDER)).toHaveCount(0);
    await expect(page.getByText('Actual', { exact: true })).toBeVisible();
    await expect(page.getByText('Fidelity', { exact: true })).toBeVisible();
    await expect(page.locator('[data-seam-active]')).toHaveCount(1);
    await shot(page, 'kernel');
  });
});
