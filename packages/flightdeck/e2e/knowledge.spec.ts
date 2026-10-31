import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe, gotoDemo, Sheet, shot, watchConsole } from "./helpers";

// Admin destructive confirmations: Knowledge (embedder, purge, namespaces), Maintenance (prune)
// and System sessions (restart modes). Demo data signs in as an admin.

async function admin(page: Page, info: import("@playwright/test").TestInfo, tab: string, ready: string | RegExp) {
  await gotoDemo(page, `/admin?tab=${tab}`, info);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("main").getByText(ready).first()).toBeVisible();
}

test("Stop embedder asks first and names what changes; Escape returns focus", async ({ page }, info) => {
  const errors = watchConsole(page);
  await admin(page, info, "knowledge", "Embedder is running");
  const opener = page.getByRole("button", { name: "Stop", exact: true });
  const sheet = await Sheet.open(page, opener, "Stop the embedder?");
  await expect(sheet.dialog).toContainText("Keyword search keeps working");
  await shot(page, info, "stop-embedder");
  await expectNoSeriousAxe(page, sheet.dialog, "stop embedder dialog");
  await sheet.expectEscapeReturnsFocusTo(opener);
  await expect(page.getByText("Embedder is running")).toBeVisible(); // cancelling changed nothing

  const again = await Sheet.open(page, opener, "Stop the embedder?");
  await again.dialog.getByRole("button", { name: "Stop embedder" }).click();
  await expect(page.getByText("Embedder is stopped")).toBeVisible();
  expect(errors).toEqual([]);
});

test("force purge: typed confirm stays disabled until the exact phrase; shows the count and reports the result", async ({ page }, info) => {
  await admin(page, info, "knowledge", "deleted facts waiting");
  const opener = page.getByRole("button", { name: "Purge…" });
  const sheet = await Sheet.open(page, opener, "Purge deleted facts now");
  const go = sheet.dialog.getByRole("button", { name: /^Purge up to/ });
  await expect(go).toHaveText("Purge up to 6");
  await expect(go).toBeDisabled();
  await expect(sheet.dialog).toContainText("Removes up to 6 facts");
  await expect(sheet.dialog).toContainText("can't be undone");
  await shot(page, info, "purge");
  await expectNoSeriousAxe(page, sheet.dialog, "purge dialog");

  const phrase = sheet.dialog.getByRole("textbox", { name: "Type purge to confirm" });
  await phrase.fill("purg");
  await expect(go).toBeDisabled();
  await phrase.fill("PURGE ");
  await expect(go).toBeDisabled(); // the phrase is exact, not fuzzy
  await phrase.fill("purge");
  await expect(go).toBeEnabled();

  // Changing the scope changes the count the button promises.
  await sheet.dialog.getByRole("radio", { name: /All deleted/ }).click();
  await expect(sheet.dialog.getByRole("button", { name: /^Purge up to/ })).toHaveText("Purge up to 14");
  await sheet.dialog.getByRole("button", { name: /^Purge up to/ }).click();
  await expect(sheet.dialog).toBeHidden();
  await expect(page.getByText(/purged/i).first()).toBeVisible(); // the result is reported
});

test("purge: Escape cancels, nothing is purged, focus returns", async ({ page }, info) => {
  await admin(page, info, "knowledge", "deleted facts waiting");
  const opener = page.getByRole("button", { name: "Purge…" });
  const sheet = await Sheet.open(page, opener, "Purge deleted facts now");
  await sheet.dialog.getByRole("textbox", { name: "Type purge to confirm" }).fill("purge");
  await sheet.expectEscapeReturnsFocusTo(opener);
  await expect(page.getByText("14 deleted facts waiting")).toBeVisible();
});

test("deleting a graph namespace names the data removed and needs its exact name", async ({ page }, info) => {
  await admin(page, info, "knowledge", "Graph namespaces");
  const opener = page.getByRole("button", { name: "Actions for acme/services" });
  await opener.click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete acme/services?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("128 nodes and 420 edges");
  await expect(dialog).toContainText("can't be undone");
  const go = dialog.getByRole("button", { name: "Delete namespace" });
  const phrase = dialog.getByRole("textbox", { name: "Type acme/services to confirm" });
  await expect(go).toBeDisabled();
  await phrase.fill("acme");
  await expect(go).toBeDisabled();
  await phrase.fill("pilotswarm/runbooks"); // another namespace's name does not count
  await expect(go).toBeDisabled();
  await shot(page, info, "namespace-delete");
  await expectNoSeriousAxe(page, dialog, "namespace delete dialog");
  await phrase.fill("acme/services");
  await expect(go).toBeEnabled();
  await go.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Actions for acme/services" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Actions for pilotswarm/runbooks" })).toBeVisible();
});

test("Maintenance: clearing summaries needs the typed phrase and reports a count", async ({ page }, info) => {
  await admin(page, info, "maintenance", "Housekeeping you can run by hand");
  await page.getByRole("radiogroup", { name: "Deleted longer ago than" }).getByRole("radio", { name: "90 days" }).click();
  const opener = page.getByRole("button", { name: "Run" });
  const sheet = await Sheet.open(page, opener, "Clear old summaries?");
  await expect(sheet.dialog).toContainText("more than 90 days ago");
  const go = sheet.dialog.getByRole("button", { name: "Clear summaries" });
  await expect(go).toBeDisabled();
  await sheet.dialog.getByRole("textbox", { name: "Type clear summaries to confirm" }).fill("clear");
  await expect(go).toBeDisabled();
  await shot(page, info, "prune");
  await expectNoSeriousAxe(page, sheet.dialog, "prune dialog");
  await sheet.dialog.getByRole("textbox", { name: "Type clear summaries to confirm" }).fill("clear summaries");
  await expect(go).toBeEnabled();
  await go.click();
  await expect(sheet.dialog).toBeHidden();
  await expect(page.getByText(/cleared|removed|\d+ summar/i).first()).toBeVisible();
});

test("System sessions: restart modes are explained; Delete and restart needs the agent's name", async ({ page }, info) => {
  await admin(page, info, "system", "Sweeper Agent");
  const actions = page.getByRole("button", { name: "Actions for Sweeper Agent" });
  await actions.click();
  await page.getByRole("menuitem", { name: /Restart/ }).click();
  const dialog = page.getByRole("dialog", { name: "Restart Sweeper Agent" });
  await expect(dialog).toBeVisible();
  const modes = dialog.getByRole("radiogroup", { name: "How to restart" });
  await expect(modes.getByRole("radio")).toHaveCount(3);
  await expect(modes.getByRole("radio", { name: /Finish, then restart/ })).toBeChecked(); // gentlest first
  await expectNoSeriousAxe(page, dialog, "restart dialog");

  // Keyboard: the radio group is operable with arrow keys.
  await modes.getByRole("radio", { name: /Finish, then restart/ }).click();
  await page.keyboard.press("ArrowDown");
  await expect(modes.getByRole("radio", { name: /Stop now and restart/ })).toBeChecked();

  await modes.getByRole("radio", { name: /Delete and restart/ }).click();
  // Erasing history is a second step: the first button only leads to a typed confirmation.
  await dialog.getByRole("button", { name: "Delete and restart…" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete Sweeper Agent and restart it?" });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("whole history are erased");
  const go = confirm.getByRole("button", { name: "Delete and restart", exact: true });
  const phrase = confirm.getByRole("textbox", { name: "Type sweeper to confirm" });
  await expect(go).toBeDisabled();
  await phrase.fill("Sweeper Agent"); // the display name is not the confirmation word
  await expect(go).toBeDisabled();
  await shot(page, info, "restart-delete");
  await expectNoSeriousAxe(page, confirm, "delete and restart confirm");
  await phrase.fill("sweeper");
  await expect(go).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
});

test("System sessions: the gentle restart reports its outcome", async ({ page }, info) => {
  await admin(page, info, "system", "Sweeper Agent");
  await page.getByRole("button", { name: "Actions for Sweeper Agent" }).click();
  await page.getByRole("menuitem", { name: /Restart/ }).click();
  const dialog = page.getByRole("dialog", { name: "Restart Sweeper Agent" });
  await dialog.getByRole("button", { name: "Finish, then restart" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/restart/i).first()).toBeVisible();
});
