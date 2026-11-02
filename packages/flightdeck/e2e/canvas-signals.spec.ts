import { expect, test } from "@playwright/test";
import { gotoDemo, isPhone } from "./helpers";
import { row, sidebar } from "./sidebar-helpers";

// "Canvas updated" is worked out in the browser (the server's rows do not say, open item G20): a session lights up when a
// canvas newer than the one this person last looked at is written, and goes dark when its Canvas view is opened.

const ONBOARD = "a1f0c2d4-0010-4c00-9000-000000000010";
const dot = (list: import("@playwright/test").Locator, title: string) => row(list, title).getByRole("img", { name: "Canvas updated" });

test("a canvas written while you are elsewhere lights its session until you look at it", async ({ page }, info) => {
  test.skip(isPhone(info), "the sidebar rows are the surface; the drawer closes on every navigation");
  await gotoDemo(page, "/", info);
  const { list } = await sidebar(page, info);
  await expect(row(list, "Onboarding guide rewrite")).toBeVisible();
  // The watcher has met the session (it had no canvas) before anything is written.
  await expect.poll(() => page.evaluate((id) => Object.entries(localStorage).some(([k, v]) => k.startsWith("fd.canvasSeen@") && v.includes(id)), ONBOARD)).toBe(true);
  await expect(dot(list, "Onboarding guide rewrite")).toHaveCount(0);

  await page.evaluate((id) => {
    const h = (window as any).__fdDemo;
    h.artifacts.publishArtifact(id, { filename: "canvas.html", content: "<h1>Rewrite plan</h1>" });
    return h.invalidate(["artifacts"]);
  }, ONBOARD);
  await expect(dot(list, "Onboarding guide rewrite")).toBeVisible();

  // Opening the session's Canvas view is looking at it (the demo keeps the canvas in memory, so no reload here).
  await row(list, "Onboarding guide rewrite").click();
  await page.getByRole("tab", { name: /^Canvas/ }).click();
  await expect(page.getByRole("tab", { name: /^Canvas/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: "Overview" }).first().click();
  const again = (await sidebar(page, info)).list;
  await expect(row(again, "Onboarding guide rewrite")).toBeVisible();
  await expect(dot(again, "Onboarding guide rewrite")).toHaveCount(0);
});
