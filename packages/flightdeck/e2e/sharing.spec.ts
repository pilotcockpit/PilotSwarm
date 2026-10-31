import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { expectNoSeriousAxe, gotoDemo, IDS, isPhone, Sheet, shot, watchConsole } from "./helpers";

// Sharing a session, moving it between groups, sharing a canvas, and the working-folder dialog.

async function openSession(page: Page, info: TestInfo, id: string, titlePart: string, query = "") {
  await gotoDemo(page, `/s/${id}${query}`, info);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(titlePart);
  if (isPhone(info)) await expect(page.getByRole("button", { name: "Session menu" })).toBeVisible();
  else await expect(page.getByRole("button", { name: /^Share\./ })).toBeVisible();
}
/** The Share sheet: the header button on desktop, a session-menu item on a phone. */
async function openShare(page: Page, info: TestInfo) {
  if (!isPhone(info)) return Sheet.open(page, shareButton(page), /^Share /);
  await openSessionMenu(page);
  await page.getByRole("menuitem", { name: /^Share/ }).click();
  return Sheet.attach(page, /^Share /);
}
const shareButton = (page: Page) => page.getByRole("button", { name: /^Share\./ });
// On a phone the header controls move into the session menu.
async function openSessionMenu(page: Page) {
  await page.getByRole("button", { name: "Session menu" }).click();
  await expect(page.getByRole("menu", { name: "Session menu" })).toBeVisible();
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

  // Undo removes them again.
  await page.getByRole("button", { name: "Undo" }).click();
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
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(people.getByRole("button", { name: /^Priya Raman: Can view/ })).toBeVisible();
  // Remove access, then Undo brings her back.
  await people.getByRole("button", { name: /^Priya Raman/ }).click();
  await page.getByRole("menuitem", { name: "Remove access" }).click();
  await expect(people.getByRole("button", { name: /^Priya Raman:/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(people.getByRole("button", { name: /^Priya Raman:/ })).toBeVisible();
});

test("Share: widening to everyone asks first; narrowing applies at once with Undo", async ({ page }, info) => {
  await openSession(page, info, IDS.p95, "p95");
  const sheet = await openShare(page, info);
  const everyone = sheet.dialog.getByRole("radiogroup", { name: "Everyone else" });
  await expect(everyone.getByRole("radio", { name: /^Only people you add/ })).toBeChecked();

  await everyone.getByRole("radio", { name: /^Anyone can view and reply/ }).click();
  const confirm = page.getByRole("dialog", { name: "Let anyone view and reply?" });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("sub-agents, canvases and files");
  await shot(page, info, "share-widen");
  await expectNoSeriousAxe(page, confirm, "widen confirm");
  // Cancel leaves it as it was.
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await expect(everyone.getByRole("radio", { name: /^Only people you add/ })).toBeChecked();

  await everyone.getByRole("radio", { name: /^Anyone can view and reply/ }).click();
  await page.getByRole("dialog", { name: "Let anyone view and reply?" }).getByRole("button", { name: "Allow replies" }).click();
  await expect(everyone.getByRole("radio", { name: /^Anyone can view and reply/ })).toBeChecked();

  // Narrowing needs no confirmation: it applies, and Undo restores.
  await everyone.getByRole("radio", { name: /^Anyone can view\b(?! and reply)/ }).click();
  await expect(page.getByRole("dialog", { name: /Let anyone/ })).toHaveCount(0);
  await expect(everyone.getByRole("radio", { name: /^Anyone can view\b(?! and reply)/ })).toBeChecked();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(everyone.getByRole("radio", { name: /^Anyone can view and reply/ })).toBeChecked();
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
  await openSessionMenu(page);
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
  await expect(page.getByText(/E2E group/).first()).toBeVisible(); // the confirmation names the group

  await page.getByRole("button", { name: "Undo" }).click();
  await openSessionMenu(page);
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

  // Rotate asks, names the consequence, and gives a different address once.
  await reopened.getByRole("button", { name: "Rotate link" }).click();
  const rotate = page.getByRole("dialog").last();
  await expect(rotate).toContainText(/stops working|old link/i);
  await rotate.getByRole("button", { name: /^Rotate/ }).click();
  const second = await reopened.getByRole("textbox", { name: "Public link" }).inputValue();
  expect(second).not.toBe(first);

  // Remove asks, then the link is off.
  await reopened.getByRole("button", { name: "Remove link" }).click();
  const remove = page.getByRole("dialog").last();
  await expect(remove).toContainText(/stops working|no longer|removed/i);
  await remove.getByRole("button", { name: /^Remove/ }).click();
  await expect(reopened).toContainText("Off");
});

test("Working folder: a save after someone else changed it offers Keep my edits or Take theirs", async ({ page }, info) => {
  await openSession(page, info, IDS.p95, "p95");
  await openSessionMenu(page);
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

  await theirs.click();
  await expect(folder).toHaveValue("projects/theirs");
});

test("Working folder: Keep my edits saves against the new revision", async ({ page }, info) => {
  await openSession(page, info, IDS.p95, "p95");
  await openSessionMenu(page);
  await page.getByRole("menuitem", { name: /Working folder/ }).click();
  const sheet = new Sheet(page, page.getByRole("dialog", { name: "Working folder" }));
  const folder = sheet.dialog.getByRole("textbox", { name: "Folder inside the root" });
  await folder.fill("projects/mine");
  await page.evaluate(() => (window as any).__fdDemo.workspace.bumpRevision({ folder: "projects/theirs" }));
  await sheet.dialog.getByRole("button", { name: "Save" }).click();
  await sheet.dialog.getByRole("button", { name: /Keep my edits/ }).click();
  // The choice is resolved: no more conflict buttons, nothing left to save, and the edit is the record now.
  await expect(sheet.dialog.getByRole("button", { name: /Keep my edits/ })).toHaveCount(0);
  await expect(sheet.dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  await sheet.close();
  await openSessionMenu(page);
  await page.getByRole("menuitem", { name: /Working folder/ }).click();
  await expect(page.getByRole("dialog", { name: "Working folder" }).getByRole("textbox", { name: "Folder inside the root" })).toHaveValue("projects/mine");
});
