import { defineConfig, devices } from "@playwright/test";

// Flight Deck end-to-end tests. They run against the demo data (no server, no database) and
// assert PROPERTIES and OUTCOMES (roles, text, focus, geometry, axe) rather than pixel baselines,
// like packages/app/web/playwright.config.mjs. Screenshots are written for a person to review.
//
// Four projects: desktop and phone, each in light and dark. The app keeps its theme in
// localStorage ("fd.theme"), which e2e/helpers.ts sets before load.
const PORT = Number(process.env.FD_E2E_PORT || 5181);

const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } };
const phone = { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  outputDir: "./e2e/.results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"]],
  timeout: 45_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    reducedMotion: "reduce",
    actionTimeout: 10_000,
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
  },
  projects: [
    { name: "desktop-light", use: { ...desktop, colorScheme: "light" }, metadata: { theme: "light", phone: false } },
    { name: "desktop-dark", use: { ...desktop, colorScheme: "dark" }, metadata: { theme: "dark", phone: false } },
    { name: "phone-light", use: { ...phone, colorScheme: "light" }, metadata: { theme: "light", phone: true } },
    { name: "phone-dark", use: { ...phone, colorScheme: "dark" }, metadata: { theme: "dark", phone: true } },
  ],
});
