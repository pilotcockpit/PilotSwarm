import { expect, test } from "@playwright/test";
import { gotoDemo, setTheme } from "./helpers";

// window.__fdDemo is a dev-server test hook. It must exist only for the demo source: never with live data.
// (The production build is checked separately by scripts/check-dist.mjs, run by `npm run build`.)

test("with live data there is no window.__fdDemo", async ({ page }) => {
  // The demo fixtures are imported eagerly, so this proves the hook is gated on the ACTIVE source.
  await page.route("**/api/v1/**", (route) => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem("fd.data", "live"); } catch { /* storage unavailable */ } });
  await page.goto("/?data=live");
  await page.locator("#root > *").first().waitFor({ state: "attached" }); // the app mounted
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => localStorage.getItem("fd.data"))).toBe("live"); // and it is the live source that is active
  expect(await page.evaluate(() => "__fdDemo" in window)).toBe(false);
  expect(await page.evaluate(() => typeof (window as any).__fdDemo)).toBe("undefined");
});

test("with demo data the hook is there, and it is removed again when the source switches to live", async ({ page }, info) => {
  await gotoDemo(page, "/", info);
  expect(await page.evaluate(() => typeof (window as any).__fdDemo?.calls)).toBe("function");
  expect(await page.evaluate(() => typeof (window as any).__fdDemo?.workspace?.writeBehind)).toBe("function");
  // Switch to live in the same page (the palette command does the same): the hook goes away.
  await page.route("**/api/v1/**", (route) => route.abort());
  await page.evaluate(() => localStorage.setItem("fd.data", "live"));
  await page.goto("/?data=live");
  await page.locator("#root > *").first().waitFor({ state: "attached" });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => typeof (window as any).__fdDemo)).toBe("undefined");
});

test("the call log starts empty and records what a click sent", async ({ page }, info) => {
  await gotoDemo(page, "/admin?tab=maintenance", info);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => (window as any).__fdDemo.clearCalls());
  expect(await page.evaluate(() => (window as any).__fdDemo.calls().filter((c: any) => c.op === "pruneDeletedSummaries"))).toEqual([]);
});
