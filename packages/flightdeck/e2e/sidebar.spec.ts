import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { demoCalls, expectNoSeriousAxe, gotoDemo, IDS, isPhone, shot, watchConsole } from "./helpers";
import { openAllSections, row, sidebar } from "./sidebar-helpers";

// The sidebar: page links, then the sessions list as the LAST section. On a phone the same sidebar is a
// drawer opened from the top bar. Demo data: p95 (needs you), deps (failed), research (view-only, waiting
// on a hold), release (waiting, has sub-agents), cost, onboarding (idle), a completed wiki session, and
// several projects (Release 0.8.8, Ops, ...). The sidebar loads fully folded; `sidebar()` unfolds it unless a test asks not to.

/** A section's own fold button (its name alone), not its actions menu. */
const fold = (list: Locator, name: RegExp) => list.getByRole("heading").getByRole("button", { name });

test("Sessions is the last section: after Overview, Boards, Outputs and Library", async ({ page }, info) => {
  const errors = watchConsole(page);
  await gotoDemo(page, "/", info);
  const { root, list } = await sidebar(page, info);
  const order = await root.evaluate((el) => {
    const pos = (node: Element | null) => (node ? Array.from(el.querySelectorAll("a,nav,button")).indexOf(node) : -1);
    const names = ["Overview", "Boards", "Outputs", "Library"].map((n) => pos(Array.from(el.querySelectorAll("nav[aria-label='Primary'] a")).find((a) => a.textContent?.trim().startsWith(n)) || null));
    return { links: names, sessions: pos(el.querySelector("nav[aria-label='Sessions']")) };
  });
  expect(order.links.every((p) => p >= 0)).toBe(true);
  expect([...order.links].sort((a, b) => a - b)).toEqual(order.links); // in the stated order
  expect(order.sessions).toBeGreaterThan(Math.max(...order.links)); // the list comes after every page link
  await expect(list.getByRole("link", { name: "Projects", exact: true })).toHaveAttribute("href", "/projects");
  expect(errors).toEqual([]);
});

test("Needs you comes first and holds the sessions that need you", async ({ page }, info) => {
  await gotoDemo(page, "/", info);
  const { list } = await sidebar(page, info);
  const first = list.locator("section").first();
  await expect(first.getByRole("heading", { level: 2 })).toContainText("Needs you");
  await expect(row(first, "Investigate p95 spike on chk")).toBeVisible();
  await expect(row(first, "Weekly dependency bumps")).toBeVisible();
  await shot(page, info, "needs-first");
});

test("Pin with P and unpin from the menu; the pin stays when you move around the app", async ({ page }, info) => {
  test.skip(isPhone(info), "keyboard pinning is a desktop path; the phone menu is covered below");
  await gotoDemo(page, "/", info);
  const { root, list } = await sidebar(page, info);
  const pinnedSection = (l: Locator) => l.locator("section").filter({ has: page.getByRole("heading", { name: /^Pinned/ }) });
  const target = row(list, "Onboarding guide rewrite");
  await expect(row(pinnedSection(list), "Onboarding guide rewrite")).toHaveCount(0);
  await target.focus();
  await page.keyboard.press("p");
  await expect(row(pinnedSection(list), "Onboarding guide rewrite")).toBeVisible();
  // Pins live in the account's profile settings (the demo keeps them in memory), so they survive navigating, not reloading the demo.
  await root.getByRole("link", { name: "Boards" }).click();
  await expect(page).toHaveURL(/\/boards/);
  const again = (await sidebar(page, info)).list;
  await expect(row(pinnedSection(again), "Onboarding guide rewrite")).toBeVisible();
  // Unpin from the row's menu.
  const r = row(pinnedSection(again), "Onboarding guide rewrite");
  await r.hover();
  await page.getByRole("button", { name: "Actions for Onboarding guide rewrite" }).first().click();
  await page.getByRole("menuitem", { name: /^Unpin/ }).click();
  await expect(row(pinnedSection(again), "Onboarding guide rewrite")).toHaveCount(0);
});

test("Every section loads folded; opening one is kept for the visit, not across a reload", async ({ page }, info) => {
  await gotoDemo(page, "/", info);
  let { list } = await sidebar(page, info, { folded: true });
  const toggles = list.locator("h2 button[aria-expanded]");
  await expect(toggles.first()).toBeVisible();
  for (const t of await toggles.all()) await expect(t).toHaveAttribute("aria-expanded", "false");
  await expect(list.locator("a[data-sidebar-row]")).toHaveCount(0); // folded sections show no rows
  await expect(list.getByRole("status")).toBeAttached(); // what needs you is still said, by the count beside the heading
  await fold(list, /^Recents/).click();
  await expect(fold(list, /^Recents/)).toHaveAttribute("aria-expanded", "true");
  await expect(list.locator("a[data-sidebar-row]").first()).toBeVisible();
  await page.reload();
  list = (await sidebar(page, info, { folded: true })).list;
  await expect(fold(list, /^Recents/)).toHaveAttribute("aria-expanded", "false");
});

test("Opening a project shows its sessions, one project at a time", async ({ page }, info) => {
  await gotoDemo(page, "/", info);
  const { list } = await sidebar(page, info);
  const release = list.getByRole("button", { name: /Release 0\.8\.8.*tree/ }).first();
  await expect(release).toHaveAttribute("aria-expanded", "false");
  await release.click();
  await expect(release).toHaveAttribute("aria-expanded", "true");
  await expect(list.getByRole("link", { name: "Port canvas host to TSX" }).first()).toBeVisible();
  await list.getByRole("button", { name: /Ops.*tree/ }).first().click();
  await expect(release).toHaveAttribute("aria-expanded", "false");
});

test("Delete from a row asks first: no call before confirming or after cancelling, one after", async ({ page }, info) => {
  await gotoDemo(page, "/", info);
  const { list } = await sidebar(page, info);
  const title = "Onboarding guide rewrite";
  const openMenu = async () => { await row(list, title).hover(); await page.getByRole("button", { name: `Actions for ${title}` }).click(); };
  await openMenu();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this session?" });
  await expect(dialog).toBeVisible();
  expect(await demoCalls(page, "deleteSession")).toHaveLength(0); // asking is not doing
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(dialog).toBeHidden();
  expect(await demoCalls(page, "deleteSession")).toHaveLength(0);
  await expect(row(list, title)).toBeVisible();

  await openMenu();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("dialog", { name: "Delete this session?" }).getByRole("button", { name: "Delete" }).click();
  await expect(row(list, title)).toHaveCount(0);
  const calls = await demoCalls(page, "deleteSession");
  expect(calls).toHaveLength(1);
  expect(calls[0].params).toEqual({ id: "a1f0c2d4-0010-4c00-9000-000000000010" });
});

test("Keyboard: arrows, Home and End move between rows, Enter opens, M opens the menu", async ({ page }, info) => {
  test.skip(isPhone(info), "keyboard roving is a desktop path");
  await gotoDemo(page, "/", info);
  const { list } = await sidebar(page, info);
  const rows = list.locator("a[data-sidebar-row]");
  await expect(rows.first()).toBeVisible(); // the list loads after the page does
  const count = await rows.count();
  expect(count).toBeGreaterThan(3);
  // One tab stop for the whole list: exactly one row is tabbable.
  expect(await list.locator("a[data-sidebar-row][tabindex='0']").count()).toBe(1);
  await rows.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(rows.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(rows.nth(count - 1)).toBeFocused();
  await page.keyboard.press("Home");
  await expect(rows.first()).toBeFocused();
  await page.keyboard.press("m");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(rows.first()).toBeFocused(); // focus returns to the row
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/s\//);
});

test("Account menu holds Models & spend, Admin and Settings", async ({ page }, info) => {
  await gotoDemo(page, "/", info);
  const { root } = await sidebar(page, info);
  await root.getByRole("button", { name: /^Account and settings/ }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: /Models & spend/ })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /^Admin/ })).toBeVisible(); // demo data signs in as an admin
  await expect(menu.getByRole("menuitem", { name: "Settings" })).toBeVisible();
  await expectNoSeriousAxe(page, menu, "account menu");
  await menu.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings/);
});

test("Title menu lists every session action; Pin puts the session in Pinned", async ({ page }, info) => {
  await gotoDemo(page, `/s/${IDS.canvasPort}`, info);
  await page.getByRole("button", { name: "Session actions" }).click();
  const menu = page.getByRole("menu");
  for (const name of ["Rename", "Pin", "Move to project…", "Share…", "Copy link", "Export history", "Complete session", "Cancel session", "Delete"]) {
    await expect(menu.getByRole("menuitem", { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  await menu.getByRole("menuitem", { name: /^Pin/ }).click();
  const { list } = await sidebar(page, info);
  await expect(list.locator("section").filter({ has: page.getByRole("heading", { name: /^Pinned/ }) }).getByRole("link", { name: "Port canvas host to TSX" }).first()).toBeVisible();
});

test("Title menu: Delete asks first; zero calls before confirming and after Keep it, one after", async ({ page }, info) => {
  await gotoDemo(page, `/s/${IDS.cost}`, info);
  await page.getByRole("button", { name: "Session actions" }).click();
  await page.getByRole("menuitem", { name: /^Delete/ }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this session?" });
  await expect(dialog).toBeVisible();
  expect(await demoCalls(page, "deleteSession")).toHaveLength(0);
  await dialog.getByRole("button", { name: "Keep it" }).click();
  expect(await demoCalls(page, "deleteSession")).toHaveLength(0);
  await page.getByRole("button", { name: "Session actions" }).click();
  await page.getByRole("menuitem", { name: /^Delete/ }).click();
  await page.getByRole("dialog", { name: "Delete this session?" }).getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  expect(await demoCalls(page, "deleteSession")).toHaveLength(1);
});

test("Context tab shows environment and context usage for a running session, and hides what is empty", async ({ page }, info) => {
  await gotoDemo(page, `/s/${IDS.canvasPort}?view=context`, info);
  const panel = page.locator("[data-context-panel]");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Environment" })).toBeVisible();
  await expect(panel.getByText("coder")).toBeVisible();
  await expect(panel.getByRole("meter", { name: "Context window used" })).toHaveAttribute("aria-valuenow", "38");
  await expect(panel.getByText(/38% used/)).toBeVisible();
  // A session that reported no context usage and has no folder shows neither block.
  await page.goto(`/s/${IDS.p95}?view=context&data=demo`);
  const p95 = page.locator("[data-context-panel]");
  await expect(p95.getByRole("heading", { name: "Environment" })).toBeVisible();
  await expect(p95.getByRole("heading", { name: "Context window" })).toHaveCount(0);
  await expect(p95.getByText("Folder", { exact: true })).toHaveCount(0);
  await shot(page, info, "context-tab");
  await expectNoSeriousAxe(page, p95, "context panel");
});

test("Phone: the drawer opens from the menu button and the Sessions tab, and focus returns", async ({ page }, info) => {
  test.skip(!isPhone(info), "the drawer is the phone sidebar");
  await gotoDemo(page, "/", info);
  const opener = page.getByRole("button", { name: "Open menu and sessions" }).first();
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "PilotSwarm" });
  await expect(drawer).toBeVisible();
  await expectNoSeriousAxe(page, drawer, "navigation drawer");
  await shot(page, info, "drawer");
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(opener).toBeFocused();
  // The Sessions tab opens the same drawer, on the list.
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: /Sessions/ }).click();
  const sessions = page.getByRole("dialog", { name: "PilotSwarm" }).getByRole("navigation", { name: "Sessions" });
  await expect(sessions).toBeVisible();
  await openAllSections(sessions); // the drawer, like the sidebar, loads folded
  // Choosing a session closes the drawer and opens it.
  await page.getByRole("dialog", { name: "PilotSwarm" }).getByRole("link", { name: "Weekly dependency bumps" }).click();
  await expect(page).toHaveURL(new RegExp(IDS.deps));
  await expect(page.getByRole("dialog", { name: "PilotSwarm" })).toBeHidden();
});

test("Axe: the sidebar and a row menu have no serious violations", async ({ page }, info) => {
  await gotoDemo(page, "/", info);
  const { root, list } = await sidebar(page, info);
  await expectNoSeriousAxe(page, root, "sidebar");
  await row(list, "Onboarding guide rewrite").hover();
  await page.getByRole("button", { name: "Actions for Onboarding guide rewrite" }).click();
  await expectNoSeriousAxe(page, page.getByRole("menu"), "row menu");
  await shot(page, info, "row-menu");
});
