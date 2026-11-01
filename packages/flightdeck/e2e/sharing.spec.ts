import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { demoCalls, expectNoSeriousAxe, gotoDemo, IDS, isPhone, Sheet, shot, watchConsole } from "./helpers";

// Sharing a session, moving it between groups, sharing a canvas, and the working-folder dialog.

/** The session's own top bar (the phone's bottom tab bar also has a More button). */
const sessionHeader = (page: Page) => page.locator("main > header");

async function openSession(page: Page, info: TestInfo, id: string, titlePart: string, query = "") {
  await gotoDemo(page, `/s/${id}${query}`, info);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(titlePart);
  if (isPhone(info)) await expect(sessionHeader(page).getByRole("button", { name: "More", exact: true })).toBeVisible();
  else await expect(page.getByRole("button", { name: /^Share\./ })).toBeVisible();
}
/** The Share sheet: the header button on desktop, a session-menu item on a phone. */
async function openShare(page: Page, info: TestInfo) {
  if (!isPhone(info)) return Sheet.open(page, shareButton(page), /^Share /);
  await openMenu(page, "more");
  await page.getByRole("menuitem", { name: /^Share/ }).click();
  return Sheet.attach(page, /^Share /);
}
const shareButton = (page: Page) => page.getByRole("button", { name: /^Share\./ });
// The title's chevron opens the session actions; the More menu holds the rest (and Share on a phone).
async function openMenu(page: Page, which: "actions" | "more") {
  await sessionHeader(page).getByRole("button", { name: which === "actions" ? "Session actions" : "More", exact: true }).click();
  await expect(page.getByRole("menu")).toBeVisible();
}

test("Share: the button says who has access; adding a person changes it, with Undo", async ({ page }, info) => {
  const errors = watchConsole(page);
  await openSession(page, info, IDS.p95, "p95");
  if (!isPhone(info)) await expect(shareButton(page)).toHaveAttribute("aria-label", "Share. Now: 1 person");
  const sheet = await openShare(page, info);
  await expect(sheet.dialog.getByRole("region", { name: "People with access" })).toContainText("Sam Lee");
  await shot(page, info, "share-sheet");
  await expectNoSeriousAxe(page, sheet.dialog, "share sheet");

  // Autocomplete: type a few letters, choose a suggestion with the keyboard.
  const box = sheet.dialog.getByRole("combobox", { name: "Add people" });
  await box.fill("mo");
  await expect(page.getByRole("listbox", { name: "Suggestions" })).toBeVisible();
  await expect(page.getByRole("option", { name: /Mo Said/ })).toBeVisible();
  await page.keyboard.press("Enter");
  const people = sheet.dialog.getByRole("region", { name: "People with access" });
  await expect(people).toContainText("Mo Said");
  await expect(people.getByRole("button", { name: /^Mo Said: Can view/ })).toBeVisible();
  const granted = await demoCalls(page, "grantSessionShare");
  expect(granted).toHaveLength(1);
  expect(granted[0].params).toMatchObject({ access: "read" });
  expect(JSON.stringify(granted[0].params.user)).toContain("mo.said@example.com");

  // Undo (announced inside the sheet) removes them again.
  const status = sheet.dialog.getByRole("status").filter({ hasText: "Mo Said can view this session" });
  await expect(status).toBeVisible();
  await status.getByRole("button", { name: "Undo" }).click();
  // Undo first re-reads the shares (it refuses when they changed meanwhile), so the revoke follows a read.
  await expect.poll(async () => (await demoCalls(page, "revokeSessionShare")).length).toBe(1);
  await expect(people.getByRole("button", { name: /^Mo Said:/ })).toHaveCount(0);
  await sheet.close();
  if (!isPhone(info)) await expect(shareButton(page)).toHaveAttribute("aria-label", "Share. Now: 1 person");
  expect(errors).toEqual([]);
});

test("Share: change a person's role and the audience label follows", async ({ page }, info) => {
  await openSession(page, info, IDS.p95, "p95");
  const sheet = await openShare(page, info);
  const people = sheet.dialog.getByRole("region", { name: "People with access" });
  await people.getByRole("button", { name: /^Priya Raman: Can view/ }).click();
  const menu = page.getByRole("menu", { name: /Priya Raman/ });
  await expect(menu.getByRole("menuitem")).toHaveCount(3);
  await menu.getByRole("menuitem", { name: /Can reply/ }).click();
  await expect(people.getByRole("button", { name: /^Priya Raman: Can reply/ })).toBeVisible();
  let grants = await demoCalls(page, "grantSessionShare");
  expect(grants).toHaveLength(1);
  expect(grants[0].params).toMatchObject({ access: "write" });
  await sheet.dialog.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(people.getByRole("button", { name: /^Priya Raman: Can view/ })).toBeVisible();
  grants = await demoCalls(page, "grantSessionShare");
  expect(grants).toHaveLength(2);
  expect(grants[1].params).toMatchObject({ access: "read" }); // Undo sent the old role back
  // Remove access, then Undo brings her back.
  await people.getByRole("button", { name: /^Priya Raman/ }).click();
  await page.getByRole("menuitem", { name: "Remove access" }).click();
  await expect(people.getByRole("button", { name: /^Priya Raman:/ })).toHaveCount(0);
  expect(await demoCalls(page, "revokeSessionShare")).toHaveLength(1);
  await sheet.dialog.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(people.getByRole("button", { name: /^Priya Raman:/ })).toBeVisible();
});

test("Share: changing a role and Undo by keyboard alone (Enter to open, arrows, Tab to Undo, Enter)", async ({ page }, info) => {
  test.skip(isPhone(info), "keyboard path is the same on a phone; desktop is enough");
  await openSession(page, info, IDS.p95, "p95");
  const sheet = await openShare(page, info);
  const people = sheet.dialog.getByRole("region", { name: "People with access" });
  const role = people.getByRole("button", { name: /^Priya Raman: Can view/ });
  await role.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: /Priya Raman/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /^Can view/ })).toBeFocused(); // the menu took focus before we move in it
  await page.keyboard.press("ArrowDown"); // Can view -> Can reply
  await expect(page.getByRole("menuitem", { name: /^Can reply/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(people.getByRole("button", { name: /^Priya Raman: Can reply/ })).toBeVisible();
  const undo = sheet.dialog.getByRole("status").getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible();
  for (let i = 0; i < 80 && !(await undo.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(undo).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(people.getByRole("button", { name: /^Priya Raman: Can view/ })).toBeVisible();
  const grants = await demoCalls(page, "grantSessionShare");
  expect(grants.map((g) => g.params.access)).toEqual(["write", "read"]);
});

test("Share: widening to everyone asks first; narrowing applies at once with Undo", async ({ page }, info) => {
  await openSession(page, info, IDS.p95, "p95");
  const sheet = await openShare(page, info);
  const everyone = sheet.dialog.getByRole("radiogroup", { name: "Everyone else" });
  await expect(everyone.getByRole("radio", { name: /^Only people you add/ })).toBeChecked();

  await everyone.getByRole("radio", { name: /^Anyone can view and reply/ }).click();
  const confirm = page.getByRole("dialog", { name: "Let anyone view and reply?" });
  await expect(confirm).toBeVisible();
  expect(await demoCalls(page, "setSessionVisibility")).toHaveLength(0); // asking is not widening
  await expect(confirm).toContainText("sub-agents, canvases and files");
  await shot(page, info, "share-widen");
  await expectNoSeriousAxe(page, confirm, "widen confirm");
  // Cancel leaves it as it was.
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await expect(everyone.getByRole("radio", { name: /^Only people you add/ })).toBeChecked();
  expect(await demoCalls(page, "setSessionVisibility")).toHaveLength(0); // Cancel widened nothing

  await everyone.getByRole("radio", { name: /^Anyone can view and reply/ }).click();
  await page.getByRole("dialog", { name: "Let anyone view and reply?" }).getByRole("button", { name: "Allow replies" }).click();
  await expect(everyone.getByRole("radio", { name: /^Anyone can view and reply/ })).toBeChecked();
  let vis = await demoCalls(page, "setSessionVisibility");
  expect(vis).toHaveLength(1);
  expect(vis[0].params).toMatchObject({ visibility: "shared_write" });

  // Narrowing needs no confirmation: it applies, and Undo restores.
  await everyone.getByRole("radio", { name: /^Anyone can view\b(?! and reply)/ }).click();
  await expect(page.getByRole("dialog", { name: /Let anyone/ })).toHaveCount(0);
  await expect(everyone.getByRole("radio", { name: /^Anyone can view\b(?! and reply)/ })).toBeChecked();
  vis = await demoCalls(page, "setSessionVisibility");
  expect(vis).toHaveLength(2);
  expect(vis[1].params).toMatchObject({ visibility: "shared_read" });
  await sheet.dialog.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(everyone.getByRole("radio", { name: /^Anyone can view and reply/ })).toBeChecked();
  vis = await demoCalls(page, "setSessionVisibility");
  expect(vis.at(-1)!.params).toMatchObject({ visibility: "shared_write" }); // Undo sent the previous level back
});

test("Share: a view-only person sees why, not dead buttons", async ({ page }, info) => {
  await openSession(page, info, IDS.research, "research");
  if (!isPhone(info)) await expect(shareButton(page)).toHaveAttribute("aria-label", /Anyone can view/);
  const sheet = await openShare(page, info);
  await expect(sheet.dialog.getByRole("region", { name: "Your access" })).toContainText("You can view only");
  await expect(sheet.dialog.getByRole("region", { name: "Owner" })).toContainText("Riya Kapoor");
  // None of the owner's controls exist for a viewer.
  await expect(sheet.dialog.getByRole("combobox", { name: "Add people" })).toHaveCount(0);
  await expect(sheet.dialog.getByRole("radiogroup", { name: "Everyone else" })).toHaveCount(0);
  await expect(sheet.dialog).toContainText("Only the owner or an admin");
  await shot(page, info, "share-viewer");
  await expectNoSeriousAxe(page, sheet.dialog, "viewer share sheet");
});

test("Move to group: search, create-and-move, and Undo", async ({ page }, info) => {
  await openSession(page, info, IDS.p95, "p95");
  await openMenu(page, "actions");
  await page.getByRole("menuitem", { name: /Move to group/ }).click();
  const sheet = new Sheet(page, page.getByRole("dialog", { name: "Move to group" }));
  await expect(sheet.dialog).toBeVisible();
  const box = sheet.dialog.getByRole("combobox", { name: "Move to group" });
  await expect(sheet.dialog.getByRole("option", { name: /Current group/ })).toContainText("Ops");
  await shot(page, info, "move-to-group");
  await expectNoSeriousAxe(page, sheet.dialog, "move to group");

  // Search narrows the list; a new name offers "Create and move".
  await box.fill("Rel");
  await expect(sheet.dialog.getByRole("option", { name: /Release 0\.8\.8/ })).toBeVisible();
  await expect(sheet.dialog.getByRole("option", { name: /^Ops/ })).toHaveCount(0);
  await box.fill("E2E group");
  const create = sheet.dialog.getByRole("option", { name: /Create/ });
  await expect(create).toContainText("E2E group");
  await create.click();
  await expect(sheet.dialog).toBeHidden();
  const created = await demoCalls(page, "createSessionGroup");
  expect(created).toHaveLength(1);
  expect(JSON.stringify(created[0].params)).toContain("E2E group");
  const placed = await demoCalls(page, "placeSessionsInGroup");
  expect(placed).toHaveLength(1);
  expect(placed[0].params.sessionIds).toEqual([IDS.p95]);
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Moved to E2E group" })).toBeVisible(); // no modal is open: a normal toast

  await page.getByRole("button", { name: "Undo" }).click();
  expect((await demoCalls(page, "placeSessionsInGroup")).at(-1)!.params.groupId).toBe("g-ops"); // back where it was
  await openMenu(page, "actions");
  await page.getByRole("menuitem", { name: /Move to group/ }).click();
  await expect(page.getByRole("dialog", { name: "Move to group" }).getByRole("option", { name: /Current group/ })).toContainText("Ops"); // back where it was
});

test("canvas Share: the public link is shown once, rotate and remove ask first", async ({ page }, info) => {
  await openSession(page, info, IDS.release, "Release", "?view=canvas");
  await page.getByRole("button", { name: "Canvas options" }).click();
  await page.getByRole("menuitem", { name: /Share canvas/ }).click();
  const sheet = new Sheet(page, page.getByRole("dialog", { name: "Share this canvas" }));
  await expect(sheet.dialog).toBeVisible();
  const link = sheet.dialog.getByRole("region", { name: "Anyone with the link" });
  await expect(link).toContainText("Off");
  await shot(page, info, "canvas-share-off");
  await expectNoSeriousAxe(page, sheet.dialog, "canvas share (off)");

  await link.getByRole("button", { name: "Create public link" }).click();
  const url = link.getByRole("textbox", { name: "Public link" });
  await expect(url).toHaveValue(/canvasShare=/);
  await expect(link).toContainText("shown only once");
  const first = await url.inputValue();
  await shot(page, info, "canvas-share-created");
  await expectNoSeriousAxe(page, sheet.dialog, "canvas share (created)");

  // Close and reopen: the link exists but its address is never shown again.
  await sheet.close();
  await page.getByRole("button", { name: "Canvas options" }).click();
  await page.getByRole("menuitem", { name: /Share canvas/ }).click();
  const reopened = page.getByRole("dialog", { name: "Share this canvas" }).getByRole("region", { name: "Anyone with the link" });
  await expect(reopened).toContainText(/Link active/);
  await expect(reopened.getByRole("textbox", { name: "Public link" })).toHaveCount(0);
  expect(await page.evaluate((u) => document.body.innerHTML.includes(u), first)).toBe(false);

  // Rotate asks, names the consequence, and gives a different address once. Asking is not doing: the
  // demo operations change nothing visible when they run early, so count what was really sent.
  const pinDialog = async (pg: Page) => {
    const top = pg.getByRole("dialog").last();
    await expect(top).toBeVisible();
    const id = await top.getAttribute("id");
    return id ? pg.locator(`[id="${id}"]`) : top;
  };
  const resets = async () => await demoCalls(page, "resetCanvasShareLink");
  const removes = async () => await demoCalls(page, "removeCanvasShareLink");
  expect(await resets()).toHaveLength(1);               // the one that created the link
  expect(await removes()).toHaveLength(0);
  await reopened.getByRole("button", { name: "Rotate link" }).click();
  const rotate = await pinDialog(page);          // pinned by id: `.last()` would point at the sheet underneath once this closes
  await expect(rotate).toContainText(/stops working|old link/i);
  expect(await resets(), "nothing is rotated before the confirmation").toHaveLength(1);
  await rotate.getByRole("button", { name: "Cancel" }).click();
  await expect(rotate).toBeHidden();
  expect(await resets(), "nothing is rotated after Cancel").toHaveLength(1);
  await expect(reopened.getByRole("textbox", { name: "Public link" })).toHaveCount(0);   // and no new address was shown

  await reopened.getByRole("button", { name: "Rotate link" }).click();
  const confirmRotate = page.getByRole("dialog").last();
  await confirmRotate.getByRole("button", { name: /^Rotate/ }).click();
  const second = await reopened.getByRole("textbox", { name: "Public link" }).inputValue();
  expect(second).not.toBe(first);
  const afterRotate = await resets();
  expect(afterRotate, "exactly one rotation after the confirmation").toHaveLength(2);
  expect(afterRotate[1].params).toMatchObject({ sessionId: IDS.release, slot: 1 });

  // Remove asks, then the link is off.
  await reopened.getByRole("button", { name: "Remove link" }).click();
  const remove = await pinDialog(page);
  await expect(remove).toContainText(/stops working|no longer|removed/i);
  expect(await removes(), "nothing is removed before the confirmation").toHaveLength(0);
  await remove.getByRole("button", { name: "Cancel" }).click();
  await expect(remove).toBeHidden();
  expect(await removes(), "nothing is removed after Cancel").toHaveLength(0);
  await expect(reopened).toContainText(/Link active/);

  await reopened.getByRole("button", { name: "Remove link" }).click();
  const confirmRemove = page.getByRole("dialog").last();
  await confirmRemove.getByRole("button", { name: /^Remove/ }).click();
  await expect(reopened).toContainText("Off");
  const removed = await removes();
  expect(removed, "exactly one removal after the confirmation").toHaveLength(1);
  expect(removed[0].params).toMatchObject({ sessionId: IDS.release, slot: 1 });
});

test("Working folder: a save after someone else changed it offers Keep my edits or Take theirs", async ({ page }, info) => {
  await openSession(page, info, IDS.p95, "p95");
  await openMenu(page, "more");
  await page.getByRole("menuitem", { name: /Working folder/ }).click();
  const sheet = new Sheet(page, page.getByRole("dialog", { name: "Working folder" }));
  await expect(sheet.dialog).toBeVisible();
  const folder = sheet.dialog.getByRole("textbox", { name: "Folder inside the root" });
  await expect(folder).toHaveValue("projects/flight-deck");
  const save = sheet.dialog.getByRole("button", { name: "Save" });
  await expect(save).toBeDisabled();
  await shot(page, info, "working-folder");
  await expectNoSeriousAxe(page, sheet.dialog, "working folder dialog");

  await folder.fill("projects/mine");
  await expect(save).toBeEnabled();
  // Another admin changes the record behind our back.
  await page.evaluate(() => (window as any).__fdDemo.workspace.bumpRevision({ folder: "projects/theirs" }));
  await save.click();
  const keep = sheet.dialog.getByRole("button", { name: /Keep my edits/ });
  const theirs = sheet.dialog.getByRole("button", { name: /Take theirs/ });
  await expect(keep).toBeVisible();
  await expect(theirs).toBeVisible();
  await expect(folder).toHaveValue("projects/mine"); // the draft is kept while the choice is open
  await shot(page, info, "working-folder-conflict");
  await expectNoSeriousAxe(page, sheet.dialog, "working folder conflict");

  // The save the client sent carried the revision it had loaded (3): the server refused it, so the person chooses.
  const attempts = await demoCalls(page, "setSessionWorkspace");
  expect(attempts).toHaveLength(1);
  expect(attempts[0].params.expectedRevision).toBe(3);
  expect(attempts[0].params.workspace.folder).toBe("projects/mine");

  await theirs.click();
  await expect(folder).toHaveValue("projects/theirs");
  expect(await demoCalls(page, "setSessionWorkspace")).toHaveLength(1); // "Take theirs" writes nothing
});

test("Working folder: Keep my edits saves against the new revision", async ({ page }, info) => {
  await openSession(page, info, IDS.p95, "p95");
  await openMenu(page, "more");
  await page.getByRole("menuitem", { name: /Working folder/ }).click();
  const sheet = new Sheet(page, page.getByRole("dialog", { name: "Working folder" }));
  const folder = sheet.dialog.getByRole("textbox", { name: "Folder inside the root" });
  await folder.fill("projects/mine");
  await page.evaluate(() => (window as any).__fdDemo.workspace.bumpRevision({ folder: "projects/theirs" }));
  await sheet.dialog.getByRole("button", { name: "Save" }).click();
  await sheet.dialog.getByRole("button", { name: /Keep my edits/ }).click();
  await expect.poll(async () => (await demoCalls(page, "setSessionWorkspace")).length).toBe(2);
  const saves = await demoCalls(page, "setSessionWorkspace");
  expect(saves[0].params.expectedRevision).toBe(3); // the first try, refused
  expect(saves[1].params.expectedRevision).toBe(4); // Keep my edits: against the revision the server has NOW
  expect(saves[1].params.workspace.folder).toBe("projects/mine");
  // The choice is resolved: no more conflict buttons, nothing left to save, and the edit is the record now.
  await expect(sheet.dialog.getByRole("button", { name: /Keep my edits/ })).toHaveCount(0);
  await expect(sheet.dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  await sheet.close();
  await openMenu(page, "more");
  await page.getByRole("menuitem", { name: /Working folder/ }).click();
  await expect(page.getByRole("dialog", { name: "Working folder" }).getByRole("textbox", { name: "Folder inside the root" })).toHaveValue("projects/mine");
});

test("Working folder: when the page already knows the record moved, Save sends nothing and asks first", async ({ page }, info) => {
  await openSession(page, info, IDS.p95, "p95");
  await openMenu(page, "more");
  await page.getByRole("menuitem", { name: /Working folder/ }).click();
  const sheet = new Sheet(page, page.getByRole("dialog", { name: "Working folder" }));
  const folder = sheet.dialog.getByRole("textbox", { name: "Folder inside the root" });
  await folder.fill("projects/mine");
  await page.evaluate(() => (window as any).__fdDemo.workspace.bumpRevision({ folder: "projects/theirs" }));
  // Make the page re-read the record now (in real use: polling or returning to the tab).
  await page.evaluate(() => (window as any).__fdDemo.invalidate(["workspace"]));
  await expect(sheet.dialog.getByText("The working folder was changed elsewhere. Your edits here are kept.")).toBeVisible();
  expect(await folder.inputValue()).toBe("projects/mine"); // the edit survived the refresh

  await sheet.dialog.getByRole("button", { name: "Save" }).click();
  await expect(sheet.dialog.getByRole("button", { name: /Keep my edits/ })).toBeVisible();
  await expect(sheet.dialog.getByRole("button", { name: /Take theirs/ })).toBeVisible();
  // The client already knew: it sent nothing at all before the person chose.
  expect(await demoCalls(page, "setSessionWorkspace")).toHaveLength(0);
});
