import { expect, test, type Page } from "@playwright/test";
import { demoCalls, gotoDemo, IDS, isPhone, toastRegion, watchConsole } from "./helpers";
import { row, sidebar } from "./sidebar-helpers";

// Every action on a session, from the sidebar row menu and from the title menu: nothing is sent before it
// is confirmed, nothing after it is cancelled, exactly one correctly targeted call after, and a refusal
// leaves the session as it was. Plus what the keyboard, system sessions, drafts and stored preferences do.

const ONBOARD = "a1f0c2d4-0010-4c00-9000-000000000010";

const failOps = (page: Page, ops: string[]) => page.evaluate((o) => (window as any).__fdDemo.failOps(o), ops);
const refresh = (page: Page) => page.evaluate(() => (window as any).__fdDemo.invalidate([]));

type Close = { kind: "complete" | "cancel" | "delete"; op: string; dialog: string; keep: string; confirm: string; rowItem: string; titleItem: RegExp };
const CLOSES: Close[] = [
  { kind: "complete", op: "completeSession", dialog: "Complete this session?", keep: "Keep it", confirm: "Complete", rowItem: "Complete", titleItem: /^Complete session/ },
  { kind: "cancel", op: "cancelSession", dialog: "Cancel this session?", keep: "Keep it", confirm: "Cancel session", rowItem: "Cancel", titleItem: /^Cancel session/ },
  { kind: "delete", op: "deleteSession", dialog: "Delete this session?", keep: "Keep it", confirm: "Delete", rowItem: "Delete", titleItem: /^Delete/ },
];
const TARGET = { id: IDS.cost, title: "Nightly cost report" };

for (const c of CLOSES) {
  test(`Row menu ${c.kind}: nothing before confirming or after Keep it, one targeted call after; a refusal changes nothing`, async ({ page }, info) => {
    await gotoDemo(page, "/", info);
    const { list } = await sidebar(page, info);
    const open = async () => { await row(list, TARGET.title).hover(); await page.getByRole("button", { name: `Actions for ${TARGET.title}` }).click(); await page.getByRole("menuitem", { name: c.rowItem, exact: true }).click(); };
    const dialog = page.getByRole("dialog", { name: c.dialog });

    await open();
    await expect(dialog).toBeVisible();
    expect(await demoCalls(page, c.op)).toHaveLength(0); // asking is not doing
    await dialog.getByRole("button", { name: c.keep }).click();
    await expect(dialog).toBeHidden();
    expect(await demoCalls(page, c.op)).toHaveLength(0);

    // A refusal from the server: one call is made, the dialog says it did not work, the session is untouched.
    await failOps(page, [c.op]);
    await open();
    await dialog.getByRole("button", { name: c.confirm, exact: true }).click();
    await expect(toastRegion(page)).toContainText("That didn't work");
    await expect(toastRegion(page)).toContainText("The server refused that.");
    expect(await demoCalls(page, c.op)).toHaveLength(1);
    await dialog.getByRole("button", { name: c.keep }).click();
    await expect(row(list, TARGET.title)).toBeVisible();
    await page.evaluate(() => (window as any).__fdDemo.clearFailures());

    // Confirmed: exactly one more call, aimed at this session and no other.
    await open();
    await dialog.getByRole("button", { name: c.confirm, exact: true }).click();
    await expect.poll(async () => (await demoCalls(page, c.op)).length).toBe(2);
    const calls = await demoCalls(page, c.op);
    expect(calls.map((x) => x.params)).toEqual([{ id: TARGET.id }, { id: TARGET.id }]);
  });

  test(`Title menu ${c.kind}: nothing before confirming or after Keep it, one targeted call after; a refusal changes nothing`, async ({ page }, info) => {
    await gotoDemo(page, `/s/${TARGET.id}`, info);
    const open = async () => { await page.getByRole("button", { name: "Session actions" }).click(); await page.getByRole("menuitem", { name: c.titleItem }).click(); };
    const dialog = page.getByRole("dialog", { name: c.dialog });

    await open();
    await expect(dialog).toBeVisible();
    expect(await demoCalls(page, c.op)).toHaveLength(0);
    await dialog.getByRole("button", { name: c.keep }).click();
    await expect(dialog).toBeHidden();
    expect(await demoCalls(page, c.op)).toHaveLength(0);

    await failOps(page, [c.op]);
    await open();
    await dialog.getByRole("button", { name: c.confirm, exact: true }).click();
    await expect(toastRegion(page)).toContainText("The server refused that.");
    expect(await demoCalls(page, c.op)).toHaveLength(1);
    await dialog.getByRole("button", { name: c.keep }).click();
    await page.evaluate(() => (window as any).__fdDemo.clearFailures());

    await open();
    await dialog.getByRole("button", { name: c.confirm, exact: true }).click();
    await expect.poll(async () => (await demoCalls(page, c.op)).length).toBe(2);
    expect((await demoCalls(page, c.op)).map((x) => x.params)).toEqual([{ id: TARGET.id }, { id: TARGET.id }]);
  });
}

test("Rename from a row: nothing before Save or after Cancel, one targeted call after; a refusal keeps the old title", async ({ page }, info) => {
  await gotoDemo(page, "/", info);
  const { list } = await sidebar(page, info);
  const open = async () => { await row(list, TARGET.title).hover(); await page.getByRole("button", { name: `Actions for ${TARGET.title}` }).click(); await page.getByRole("menuitem", { name: "Rename", exact: true }).click(); };
  const dialog = page.getByRole("dialog", { name: "Rename session" });
  await open();
  await dialog.getByLabel("Title").fill("Cost report, weekly");
  expect(await demoCalls(page, "renameSession")).toHaveLength(0);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect(await demoCalls(page, "renameSession")).toHaveLength(0);

  await failOps(page, ["renameSession"]);
  await open();
  await dialog.getByLabel("Title").fill("Cost report, weekly");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(toastRegion(page)).toContainText("Couldn't rename");
  expect(await demoCalls(page, "renameSession")).toHaveLength(1);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(row(list, TARGET.title)).toBeVisible();
  await page.evaluate(() => (window as any).__fdDemo.clearFailures());

  await open();
  await dialog.getByLabel("Title").fill("Cost report, weekly");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(row(list, "Cost report, weekly")).toBeVisible();
  const calls = await demoCalls(page, "renameSession");
  expect(calls).toHaveLength(2);
  expect(calls[1].params).toEqual({ id: TARGET.id, title: "Cost report, weekly" });
});

test("Rename from the title: Escape sends nothing, Enter sends one targeted call, a refusal restores the title", async ({ page }, info) => {
  test.skip(isPhone(info), "the inline title editor is a desktop path");
  await gotoDemo(page, `/s/${TARGET.id}`, info);
  const heading = page.getByRole("heading", { level: 1 });
  await heading.getByRole("button", { name: TARGET.title }).click();
  await page.getByRole("textbox", { name: "Session title" }).fill("Typed then abandoned");
  await page.keyboard.press("Escape");
  expect(await demoCalls(page, "renameSession")).toHaveLength(0);
  await expect(heading).toContainText(TARGET.title);

  await failOps(page, ["renameSession"]);
  await heading.getByRole("button", { name: TARGET.title }).click();
  await page.getByRole("textbox", { name: "Session title" }).fill("Refused title");
  await page.keyboard.press("Enter");
  await expect(toastRegion(page)).toContainText("Couldn't rename");
  expect(await demoCalls(page, "renameSession")).toHaveLength(1);
  await expect(heading).toContainText(TARGET.title);
  await page.evaluate(() => (window as any).__fdDemo.clearFailures());

  await heading.getByRole("button", { name: TARGET.title }).click();
  await page.getByRole("textbox", { name: "Session title" }).fill("Cost report, weekly");
  await page.keyboard.press("Enter");
  await expect(heading).toContainText("Cost report, weekly");
  const calls = await demoCalls(page, "renameSession");
  expect(calls).toHaveLength(2);
  expect(calls[1].params).toEqual({ id: TARGET.id, title: "Cost report, weekly" });
});

test("Pinning sends nothing to the server, from the keyboard or either menu", async ({ page }, info) => {
  test.skip(isPhone(info), "keyboard pinning is a desktop path");
  await gotoDemo(page, `/s/${TARGET.id}`, info);
  const { list } = await sidebar(page, info);
  await row(list, "Onboarding guide rewrite").focus();
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "Session actions" }).click();
  await page.getByRole("menuitem", { name: /^Pin/ }).click();
  await expect(list.getByRole("heading", { name: /^Pinned/ })).toBeVisible();
  // Pins are this person's, in this browser: no operation that changes anything is ever sent.
  const sent = (await demoCalls(page)).map((c) => c.op).filter((op) => /^(set|create|place|rename|complete|cancel|delete|grant|revoke|update|upload|send|regenerate|restart)/i.test(op));
  expect(sent).toEqual([]);
});

test("Pinning with P keeps keyboard focus on the same session, and the arrow keys carry on from there", async ({ page }, info) => {
  test.skip(isPhone(info), "keyboard roving is a desktop path");
  await gotoDemo(page, "/", info);
  const { list } = await sidebar(page, info);
  await expect(list.locator("a[data-sidebar-row]").first()).toBeVisible();
  const activeId = () => page.evaluate(() => document.activeElement?.getAttribute("data-session-id") ?? null);
  await row(list, "Onboarding guide rewrite").focus();
  await page.keyboard.press("p"); // the row leaves Recent and appears under Pinned: a different place in the DOM
  await expect(list.getByRole("heading", { name: /^Pinned/ })).toBeVisible();
  await expect.poll(activeId).toBe(ONBOARD);
  await page.keyboard.press("ArrowDown");
  await expect.poll(async () => { const id = await activeId(); return id && id !== ONBOARD; }).toBeTruthy();
  await page.keyboard.press("ArrowUp");
  await expect.poll(activeId).toBe(ONBOARD);
  await page.keyboard.press("p"); // and back
  await expect(list.getByRole("heading", { name: /^Pinned/ })).toHaveCount(0);
  await expect.poll(activeId).toBe(ONBOARD);
});

test("Deleting the focused row hands focus to its neighbour, and the arrows keep working", async ({ page }, info) => {
  test.skip(isPhone(info), "keyboard roving is a desktop path");
  await gotoDemo(page, "/", info);
  const { list } = await sidebar(page, info);
  await expect(list.locator("a[data-sidebar-row]").first()).toBeVisible();
  const activeId = () => page.evaluate(() => document.activeElement?.getAttribute("data-session-id") ?? null);
  await row(list, "Onboarding guide rewrite").focus();
  await page.keyboard.press("Delete");
  const dialog = page.getByRole("dialog", { name: "Delete this session?" });
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(row(list, "Onboarding guide rewrite")).toHaveCount(0);
  await expect.poll(async () => { const id = await activeId(); return id && id !== ONBOARD; }).toBeTruthy(); // on a row, not lost on the page
  const here = await activeId();
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => { const id = await activeId(); return id && id !== here; }).toBeTruthy();
});

test("A system session cannot be renamed, completed, cancelled or deleted from the sidebar; an admin restarts it", async ({ page }, info) => {
  test.skip(isPhone(info), "covered on the desktop sidebar; the phone drawer uses the same menu");
  await gotoDemo(page, "/", info);
  const { list } = await sidebar(page, info);
  await page.getByRole("button", { name: "Filter and group sessions" }).click();
  await page.getByRole("switch", { name: "Show system sessions" }).click();
  await page.keyboard.press("Escape");
  const name = "Sweeper Agent";
  await expect(row(list, name)).toBeVisible();
  await row(list, name).hover();
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  const menu = page.getByRole("menu");
  for (const item of ["Rename", "Complete", "Cancel", "Delete"]) await expect(menu.getByRole("menuitem", { name: item, exact: true })).toHaveAttribute("aria-disabled", "true");
  await menu.getByRole("menuitem", { name: /^Restart/ }).click();
  await expect(page.getByRole("dialog", { name: `Restart ${name}` })).toBeVisible();
  await page.keyboard.press("Escape");
  // The Delete key does not open the delete dialog for it either.
  await row(list, name).focus();
  await page.keyboard.press("Delete");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await demoCalls(page, "deleteSession")).toHaveLength(0);
});

test("The title menu of a system session disables the ordinary actions and offers Restart", async ({ page }, info) => {
  test.skip(isPhone(info), "the title menu is the same on a phone");
  await gotoDemo(page, `/s/${IDS.sweeper}`, info);
  await page.getByRole("button", { name: "Session actions" }).click();
  const menu = page.getByRole("menu");
  for (const item of [/^Rename/, /^Complete session/, /^Cancel session/, /^Delete/]) await expect(menu.getByRole("menuitem", { name: item })).toHaveAttribute("aria-disabled", "true");
  await menu.getByRole("menuitem", { name: /^Restart/ }).click();
  await expect(page.getByRole("dialog", { name: /^Restart / })).toBeVisible();
  // And its title is plain text: there is no rename control.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { level: 1 }).getByRole("button")).toHaveCount(0);
});

test("A rename already typed in the dialog is not overwritten by a poll; the dialog says so and offers theirs", async ({ page }, info) => {
  test.skip(isPhone(info), "desktop path");
  await gotoDemo(page, "/", info);
  const { list } = await sidebar(page, info);
  await row(list, TARGET.title).hover();
  await page.getByRole("button", { name: `Actions for ${TARGET.title}` }).click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Rename session" });
  const input = dialog.getByLabel("Title");
  await input.fill("My draft");
  await page.evaluate((id) => { (window as any).__fdDemo.sessions.setTitle(id, "Renamed by someone else"); return (window as any).__fdDemo.invalidate(["sessions"]); }, TARGET.id);
  await expect(dialog.locator("[data-title-changed]")).toContainText("Renamed by someone else");
  await expect(input).toHaveValue("My draft"); // the draft survived the poll
  await dialog.getByRole("button", { name: "Use theirs" }).click();
  await expect(input).toHaveValue("Renamed by someone else");
});

test("A title being edited in the header is not overwritten by a poll; saving says what it replaced and offers Undo", async ({ page }, info) => {
  test.skip(isPhone(info), "the inline title editor is a desktop path");
  await gotoDemo(page, `/s/${TARGET.id}`, info);
  const heading = page.getByRole("heading", { level: 1 });
  await heading.getByRole("button", { name: TARGET.title }).click();
  const input = page.getByRole("textbox", { name: "Session title" });
  await input.fill("My draft");
  await page.evaluate((id) => { (window as any).__fdDemo.sessions.setTitle(id, "Renamed by someone else"); return (window as any).__fdDemo.invalidate([]); }, TARGET.id);
  await page.waitForTimeout(400);
  await expect(input).toHaveValue("My draft");
  await page.keyboard.press("Enter");
  await expect(heading).toContainText("My draft");
  await expect(toastRegion(page)).toContainText("Renamed by someone else"); // what it replaced, said out loud
  await toastRegion(page).getByRole("button", { name: "Undo" }).click();
  await expect(heading).toContainText("Renamed by someone else");
});

test("Context window: a ratio above 1 is over the limit, with a valid meter; the Access row appears only when the server said", async ({ page }, info) => {
  await gotoDemo(page, `/s/${IDS.canvasPort}?view=context`, info);
  const panel = page.locator("[data-context-panel]");
  await expect(panel.getByRole("meter", { name: "Context window used" })).toHaveAttribute("aria-valuenow", "38");
  await page.evaluate((id) => { (window as any).__fdDemo.sessions.setContextUtilization(id, 1.2); return (window as any).__fdDemo.invalidate([]); }, IDS.canvasPort);
  const meter = panel.getByRole("meter", { name: "Context window used" });
  await expect(meter).toHaveAttribute("aria-valuenow", "100");
  await expect(meter).toHaveAttribute("aria-valuetext", /Over the limit: 120%/);
  await expect(panel.getByText(/Over the limit: 120% of the window/)).toBeVisible();
  // This session reported no visibility: the panel does not invent "Private".
  await expect(panel.getByText("Access", { exact: true })).toHaveCount(0);
  await page.goto(`/s/${IDS.p95}?view=context&data=demo`);
  await expect(page.locator("[data-context-panel]").getByText("Access", { exact: true })).toBeVisible();
});

test("Context outputs: clicking a canvas opens that canvas's slot, not the first one", async ({ page }, info) => {
  await gotoDemo(page, `/s/${IDS.canvasPort}?view=context`, info);
  await page.evaluate((id) => (window as any).__fdDemo.artifacts.publishArtifact(id, { filename: "canvas3.html", content: "<h1>Third canvas</h1>" }), IDS.canvasPort);
  await page.evaluate(() => (window as any).__fdDemo.invalidate([]));
  const panel = page.locator("[data-context-panel]");
  await panel.getByRole("button", { name: /canvas3\.html/ }).click();
  await expect(page).toHaveURL(/view=canvas/);
  await expect(page).toHaveURL(/slot=3/);
});

test("Needs you changes are announced politely, once, after they settle", async ({ page }, info) => {
  test.skip(isPhone(info), "desktop path");
  await gotoDemo(page, "/", info);
  const { root, list } = await sidebar(page, info);
  const status = root.locator("[data-needs-status]");
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(status).toHaveText("");
  // Demo data: p95 (asks a question), deps (failed) and research (paused on a limit) need you. Completing p95 leaves two.
  await row(list, "Investigate p95 spike on chk").hover();
  await page.getByRole("button", { name: "Actions for Investigate p95 spike on chk" }).click();
  await page.getByRole("menuitem", { name: "Complete", exact: true }).click();
  await page.getByRole("dialog", { name: "Complete this session?" }).getByRole("button", { name: "Complete", exact: true }).click();
  await expect(status).toHaveText("2 sessions need you", { timeout: 8000 });
});

test("Stored preferences are per person and per data source, and bad stored values cannot crash the sidebar", async ({ page }, info) => {
  test.skip(isPhone(info), "desktop path");
  const errors = watchConsole(page);
  // An old, shared key from before preferences were scoped: it must not pin anything for anyone.
  await page.addInitScript((id) => { try { if (!localStorage.getItem("__seeded")) { localStorage.setItem("fd.pins", JSON.stringify([id])); localStorage.setItem("__seeded", "1"); } } catch { /* storage unavailable */ } }, ONBOARD);
  await gotoDemo(page, "/", info);
  let { list } = await sidebar(page, info);
  await expect(list.locator("a[data-sidebar-row]").first()).toBeVisible();
  await expect(list.getByRole("heading", { name: /^Pinned/ })).toHaveCount(0);
  await row(list, "Onboarding guide rewrite").focus();
  await page.keyboard.press("p");
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("fd.pins")));
  expect(keys.filter((k) => k !== "fd.pins")).toHaveLength(1);
  expect(keys.find((k) => k !== "fd.pins")).toMatch(/^fd\.pins@demo:/); // scoped by data source and person
  // Valid JSON of the wrong shape, in every sidebar key, used to take the whole shell down.
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^fd\.(pins|sidebar\.)/.test(k) && k !== "fd.pins") localStorage.setItem(k, k.includes("pins") ? "{}" : k.includes("groupBy") ? "\"folder\"" : k.includes("state") ? "\"sideways\"" : "42"); });
  await page.reload();
  ({ list } = await sidebar(page, info));
  await expect(list.locator("a[data-sidebar-row]").first()).toBeVisible();
  await expect(list.getByRole("heading", { name: /^Pinned/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Phone: Search from the drawer closes the drawer, opens the palette, and focus returns to the menu button", async ({ page }, info) => {
  test.skip(!isPhone(info), "the drawer is the phone sidebar");
  await gotoDemo(page, "/", info);
  const opener = page.getByRole("button", { name: "Open menu and sessions" }).first();
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "PilotSwarm" });
  await drawer.getByRole("button", { name: "Search", exact: true }).click();
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await expect(drawer).toBeHidden(); // it no longer covers where the search leads
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect(opener).toBeFocused();
  // And choosing a result lands on it, with nothing left open in front.
  await opener.click();
  await page.getByRole("dialog", { name: "PilotSwarm" }).getByRole("button", { name: "Search", exact: true }).click();
  await page.keyboard.type("Weekly dependency");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(IDS.deps));
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
