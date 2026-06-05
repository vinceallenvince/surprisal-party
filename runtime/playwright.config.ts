import { defineConfig, devices } from "@playwright/test";

// Set PWDEMO=1 to *watch* the suite run: headed, each step slowed, and with the
// app's animations playing. Normal/CI runs stay headless + instant +
// reduced-motion for stable screenshots.
const demo = !!process.env.PWDEMO;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    // Match the Figma UI frames (1184×789) so app screenshots line up with the
    // design frames.
    viewport: { width: 1184, height: 789 },
    // Headless + instant + reduced-motion by default (deterministic shots);
    // PWDEMO flips to a watchable headed run that slows each step and lets the
    // app's fades play. `reducedMotion` is a context option in this Playwright
    // version (not a top-level `use` field), so it goes via `contextOptions`.
    headless: !demo,
    launchOptions: demo ? { slowMo: 600 } : {},
    contextOptions: { reducedMotion: demo ? "no-preference" : "reduce" },
  },
  projects: [
    // Chromium-only to start; add firefox/webkit later if we want cross-browser.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // The dev server's first compile can exceed Playwright's 60s default.
    timeout: 120_000,
  },
});
