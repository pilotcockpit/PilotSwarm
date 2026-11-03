import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe, gotoDemo, shot, watchConsole } from "./helpers";

// The Admin overview summarises flags, workers and system sessions. A flag read that fails must say so:
// "0 of 0 feature flags on" next to a green glyph would be a healthy-looking answer to an unanswered question.

test("a failed feature-flag read says unavailable and offers Retry, not '0 of 0 on'", async ({ page }, info) => {
  const errors = watchConsole(page);
  await gotoDemo(page, "/admin?tab=overview", info);
  const main = page.getByRole("main");
  await expect(main.getByText(/[1-9]\d* of [1-9]\d* feature flags on/)).toBeVisible();   // the healthy answer first

  await page.evaluate(() => { const h = (window as any).__fdDemo; h.failOps(["listFlags"]); return h.invalidate(["flags"]); });
  const row = main.getByRole("status").filter({ hasText: "Feature flags unavailable" });
  await expect(row).toBeVisible();
  await expect(main.getByText(/\b0 of 0\b/)).toHaveCount(0);
  await expect(main.getByText(/feature flags on/)).toHaveCount(0);
  await shot(page, info, "flags-unavailable");
  await expectNoSeriousAxe(page, main, "admin overview with flags unavailable", info);

  // Retry reads again; once the server answers the real count returns.
  await page.evaluate(() => (window as any).__fdDemo.clearFailures());
  await row.getByRole("button", { name: "Retry" }).click();
  await expect(main.getByText(/[1-9]\d* of [1-9]\d* feature flags on/)).toBeVisible();
  await expect(row).toHaveCount(0);
  expect(errors.filter((e) => !/Feature flags are unavailable/.test(e)), "no unexpected console errors").toEqual([]);
});
