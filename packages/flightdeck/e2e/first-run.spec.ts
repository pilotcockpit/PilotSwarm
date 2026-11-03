import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe, gotoDemo, shot, watchConsole } from "./helpers";
import { sidebar } from "./sidebar-helpers";

// A brand-new account: no sessions, no projects, no outputs (`?scenario=empty`, kept in the browser). Every screen
// that normally shows work must say what will appear and how to start, without errors, overflow or axe violations.

const PAGES: Array<{ path: string; says: RegExp }> = [
  { path: "/", says: /Welcome to PilotSwarm/ },
  { path: "/projects", says: /No sessions yet/ },
  { path: "/outputs?tab=canvases", says: /Your canvases will appear here/ },
  { path: "/outputs?tab=files", says: /Your files will appear here/ },
  { path: "/boards", says: /An empty board|Add tile/ },
  { path: "/library", says: /Library|Choose the right agent/ },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem("fd.demoScenario", "empty"); } catch { /* storage unavailable */ } });
});

for (const p of PAGES) {
  test(`first run ${p.path}: says what will appear; no errors, overflow or serious axe violations`, async ({ page }, info) => {
    const errors = watchConsole(page);
    await gotoDemo(page, p.path, info);
    await expect(page.getByRole("main")).toContainText(p.says);
    await page.waitForTimeout(250);
    await expectNoSeriousAxe(page, undefined, `first run ${p.path}`, info);
    const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    expect(width.scroll).toBeLessThanOrEqual(width.inner);
    expect(errors).toEqual([]);
    if (p.path === "/") await shot(page, info, "first-run-overview");
  });
}

test("first run: the sidebar says there are no sessions and offers to start one; no empty sections", async ({ page }, info) => {
  await gotoDemo(page, "/", info);
  const { list } = await sidebar(page, info, { folded: true });
  await expect(list).toContainText("No sessions yet");
  await expect(list.getByRole("button", { name: "Start one" })).toBeVisible();
  await expect(list.getByRole("heading")).toHaveCount(0);
});

test("first run: the first project can be made from the Projects page", async ({ page }, info) => {
  await gotoDemo(page, "/projects", info);
  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByRole("textbox", { name: "Name" }).fill("First project");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("main")).toContainText("First project");
});
