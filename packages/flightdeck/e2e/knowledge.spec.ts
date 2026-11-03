import { expect, test, type Page } from "@playwright/test";
import { demoCalls, expectNoSeriousAxe, gotoDemo, Sheet, shot, toastRegion, watchConsole } from "./helpers";

// Admin destructive confirmations: Knowledge (embedder, purge, namespaces), Maintenance (prune) and System
// sessions (restart modes). Demo data signs in as an admin.
//
// Every confirm is guarded two ways: the UI (the button stays disabled until the exact phrase) AND the
// execution boundary. The demo operations delete nothing, so a test that only looked at the screen would
// pass even if the operation ran early. Each test therefore counts the calls the demo registry answered:
// none before the confirmation and after Cancel, exactly one (with the right parameters) after it.

async function admin(page: Page, info: import("@playwright/test").TestInfo, tab: string, ready: string | RegExp) {
  await gotoDemo(page, `/admin?tab=${tab}`, info);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("main").getByText(ready).first()).toBeVisible();
}

test("Stop embedder asks first; no call until confirmed; Escape returns focus", async ({ page }, info) => {
  const errors = watchConsole(page);
  await admin(page, info, "knowledge", "Embedder is running");
  const opener = page.getByRole("button", { name: "Stop", exact: true });
  const sheet = await Sheet.open(page, opener, "Stop the embedder?");
  await expect(sheet.dialog).toContainText("Keyword search keeps working");
  expect(await demoCalls(page, "stopFactsEmbedder")).toHaveLength(0); // asking is not doing
  await shot(page, info, "stop-embedder");
  await expectNoSeriousAxe(page, sheet.dialog, "stop embedder dialog");
  await sheet.expectEscapeReturnsFocusTo(opener);
  expect(await demoCalls(page, "stopFactsEmbedder")).toHaveLength(0);
  await expect(page.getByText("Embedder is running")).toBeVisible(); // cancelling changed nothing

  const again = await Sheet.open(page, opener, "Stop the embedder?");
  await again.dialog.getByRole("button", { name: "Stop embedder" }).click();
  await expect(page.getByText("Embedder is stopped")).toBeVisible();
  const calls = await demoCalls(page, "stopFactsEmbedder");
  expect(calls).toHaveLength(1);
  expect(calls[0].params).toEqual({ reason: "Stopped from Flight Deck" });
  await expect(toastRegion(page)).toContainText("Embedder stopped");
  expect(errors).toEqual([]);
});

test("force purge: disabled until the exact phrase, no call until confirmed, then one call with the chosen scope", async ({ page }, info) => {
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
  expect(await demoCalls(page, "forcePurgeFacts")).toHaveLength(0); // typing the phrase is not confirming

  // Changing the scope changes what the button promises.
  await sheet.dialog.getByRole("radio", { name: /All deleted/ }).click();
  const all = sheet.dialog.getByRole("button", { name: /^Purge up to/ });
  await expect(all).toHaveText("Purge up to 14");
  await all.click();
  await expect(sheet.dialog).toBeHidden();
  await expect(toastRegion(page)).toContainText("Purged 14 facts"); // the result, in the toast region
  const calls = await demoCalls(page, "forcePurgeFacts");
  expect(calls).toHaveLength(1);
  expect(calls[0].params.input.onlyUnreconciled).toBe(false); // "All deleted", not "Not read by the graph"
  expect(Date.parse(calls[0].params.input.cutoff)).toBeLessThan(Date.now()); // a cutoff in the past
  expect(calls[0].params.input.keyPrefix).toBeUndefined();
});

test("purge: Escape cancels, nothing is called, focus returns", async ({ page }, info) => {
  await admin(page, info, "knowledge", "deleted facts waiting");
  const opener = page.getByRole("button", { name: "Purge…" });
  const sheet = await Sheet.open(page, opener, "Purge deleted facts now");
  await sheet.dialog.getByRole("textbox", { name: "Type purge to confirm" }).fill("purge");
  await sheet.expectEscapeReturnsFocusTo(opener);
  expect(await demoCalls(page, "forcePurgeFacts")).toHaveLength(0);
  await expect(page.getByText("14 deleted facts waiting")).toBeVisible();
});

test("deleting a graph namespace: exact name, no call until confirmed, then one call for that namespace only", async ({ page }, info) => {
  await admin(page, info, "knowledge", "Graph namespaces");
  await page.getByRole("button", { name: "Actions for acme/services" }).click();
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
  expect(await demoCalls(page, "deleteGraphNamespace")).toHaveLength(0);
  await shot(page, info, "namespace-delete");
  await expectNoSeriousAxe(page, dialog, "namespace delete dialog");

  // Cancel after typing the right name: still no call.
  await phrase.fill("acme/services");
  await expect(go).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await demoCalls(page, "deleteGraphNamespace")).toHaveLength(0);
  await expect(page.getByRole("button", { name: "Actions for acme/services" })).toBeVisible();

  await page.getByRole("button", { name: "Actions for acme/services" }).click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  const again = page.getByRole("dialog", { name: "Delete acme/services?" });
  await again.getByRole("textbox", { name: "Type acme/services to confirm" }).fill("acme/services");
  await again.getByRole("button", { name: "Delete namespace" }).click();
  await expect(again).toBeHidden();
  await expect(page.getByRole("button", { name: "Actions for acme/services" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Actions for pilotswarm/runbooks" })).toBeVisible();
  await expect(toastRegion(page)).toContainText("Deleted acme/services");
  const calls = await demoCalls(page, "deleteGraphNamespace");
  expect(calls).toHaveLength(1);
  expect(calls[0].params).toEqual({ namespace: "acme/services" });
});

test("Maintenance: clearing summaries needs the typed phrase, no call until confirmed, one call with the chosen age, result shown", async ({ page }, info) => {
  await admin(page, info, "maintenance", "Housekeeping you can run by hand");
  await page.getByRole("radiogroup", { name: "Deleted longer ago than" }).getByRole("radio", { name: "90 days" }).click();
  const opener = page.getByRole("button", { name: "Run" });
  const sheet = await Sheet.open(page, opener, "Clear old summaries?");
  await expect(sheet.dialog).toContainText("more than 90 days ago");
  const go = sheet.dialog.getByRole("button", { name: "Clear summaries" });
  await expect(go).toBeDisabled();
  const phrase = sheet.dialog.getByRole("textbox", { name: "Type clear summaries to confirm" });
  await phrase.fill("clear");
  await expect(go).toBeDisabled();
  await shot(page, info, "prune");
  await expectNoSeriousAxe(page, sheet.dialog, "prune dialog");
  await phrase.fill("clear summaries");
  await expect(go).toBeEnabled();
  expect(await demoCalls(page, "pruneDeletedSummaries")).toHaveLength(0);
  await sheet.expectEscapeReturnsFocusTo(opener); // Cancel after a correct phrase
  expect(await demoCalls(page, "pruneDeletedSummaries")).toHaveLength(0);
  await expect(page.getByText(/Last run: removed/)).toHaveCount(0);

  const again = await Sheet.open(page, opener, "Clear old summaries?");
  await again.dialog.getByRole("textbox", { name: "Type clear summaries to confirm" }).fill("clear summaries");
  await again.dialog.getByRole("button", { name: "Clear summaries" }).click();
  await expect(again.dialog).toBeHidden();
  // The 90 day fixture removes 17 summaries; the page says exactly that.
  await expect(page.getByText(/Last run: removed 17 summaries older than 90 days/)).toBeVisible();
  const calls = await demoCalls(page, "pruneDeletedSummaries");
  expect(calls).toHaveLength(1);
  const ageDays = (Date.now() - Date.parse(calls[0].params.olderThan)) / 86_400_000;
  expect(ageDays).toBeGreaterThan(89.9);
  expect(ageDays).toBeLessThan(90.1);
});

async function openRestart(page: Page, agent = "Sweeper Agent") {
  await page.getByRole("button", { name: `Actions for ${agent}` }).click();
  await page.getByRole("menuitem", { name: /Restart/ }).click();
  const dialog = page.getByRole("dialog", { name: `Restart ${agent}` });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("System sessions: Delete and restart needs the name; no restart call before it or after Cancel; exactly one after, with hard_delete", async ({ page }, info) => {
  await admin(page, info, "system", "Sweeper Agent");
  const actions = page.getByRole("button", { name: "Actions for Sweeper Agent" });
  const dialog = await openRestart(page);
  const modes = dialog.getByRole("radiogroup", { name: "How to restart" });
  await expect(modes.getByRole("radio")).toHaveCount(3);
  await expect(modes.getByRole("radio", { name: /Finish, then restart/ })).toBeChecked(); // gentlest first
  await expectNoSeriousAxe(page, dialog, "restart dialog");

  // Keyboard: the radio group is operable with arrow keys, and arrows select.
  await modes.getByRole("radio", { name: /Finish, then restart/ }).click();
  await page.keyboard.press("ArrowDown");
  await expect(modes.getByRole("radio", { name: /Stop now and restart/ })).toBeChecked();

  await modes.getByRole("radio", { name: /Delete and restart/ }).click();
  expect(await demoCalls(page, "restartSystemSession")).toHaveLength(0); // choosing a mode is not restarting
  // Erasing history is a second step: the first button only leads to a typed confirmation.
  await dialog.getByRole("button", { name: "Delete and restart…" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete Sweeper Agent and restart it?" });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("whole history are erased");
  expect(await demoCalls(page, "restartSystemSession")).toHaveLength(0); // the confirmation is showing: nothing has run
  const go = confirm.getByRole("button", { name: "Delete and restart", exact: true });
  const phrase = confirm.getByRole("textbox", { name: "Type sweeper to confirm" });
  await expect(go).toBeDisabled();
  await phrase.fill("Sweeper Agent"); // the display name is not the confirmation word
  await expect(go).toBeDisabled();
  await shot(page, info, "restart-delete");
  await expectNoSeriousAxe(page, confirm, "delete and restart confirm");
  await phrase.fill("sweeper");
  await expect(go).toBeEnabled();
  expect(await demoCalls(page, "restartSystemSession")).toHaveLength(0); // typing is not submitting

  // Cancel after typing the right word: still nothing ran.
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  expect(await demoCalls(page, "restartSystemSession")).toHaveLength(0);

  // Now do it: exactly one call, hard_delete, for this agent, with a replacement.
  await page.getByRole("dialog", { name: "Restart Sweeper Agent" }).getByRole("button", { name: "Delete and restart…" }).click();
  const again = page.getByRole("dialog", { name: "Delete Sweeper Agent and restart it?" });
  await again.getByRole("textbox", { name: "Type sweeper to confirm" }).fill("sweeper");
  await again.getByRole("button", { name: "Delete and restart", exact: true }).click();
  await expect(again).toBeHidden();
  await expect(toastRegion(page)).toContainText("Restarted. A fresh session is starting.");
  const calls = await demoCalls(page, "restartSystemSession");
  expect(calls).toHaveLength(1);
  expect(calls[0].params.agentIdOrSessionId).toBe("sweeper");
  expect(calls[0].params.options.disposition).toBe("hard_delete");
  expect(calls[0].params.options.startReplacement).not.toBe(false); // a replacement starts
  await expect(actions).toBeVisible();
});

test("System sessions: 'remove without a replacement' sends startReplacement false, once, only after the name is typed", async ({ page }, info) => {
  await admin(page, info, "system", "Sweeper Agent");
  const dialog = await openRestart(page);
  await dialog.getByRole("radio", { name: /Delete and restart/ }).click();
  await dialog.getByRole("button", { name: "More options" }).click();
  await dialog.getByRole("checkbox", { name: "Remove without starting a replacement" }).check();
  await dialog.getByRole("button", { name: /Delete and remove|Remove|Delete/ }).last().click();
  const confirm = page.getByRole("dialog").last();
  expect(await demoCalls(page, "restartSystemSession")).toHaveLength(0);
  const go = confirm.getByRole("button", { name: /^(Delete and remove|Remove|Delete)/ }).last();
  await expect(go).toBeDisabled();
  await confirm.getByRole("textbox").fill("sweeper");
  await go.click();
  await expect(toastRegion(page)).toContainText("Removed. Nothing was started in its place.");
  const calls = await demoCalls(page, "restartSystemSession");
  expect(calls).toHaveLength(1);
  expect(calls[0].params.options.disposition).toBe("hard_delete");
  expect(calls[0].params.options.startReplacement).toBe(false);
});

test("System sessions: the gentle restart reports the exact outcome, first busy then restarted", async ({ page }, info) => {
  await admin(page, info, "system", "Sweeper Agent");
  // The demo's Sweeper Agent is busy the first time (nothing restarted), free the second.
  let dialog = await openRestart(page);
  expect(await demoCalls(page, "restartSystemSession")).toHaveLength(0);
  await dialog.getByRole("button", { name: "Finish, then restart" }).click();
  await expect(dialog).toBeHidden();
  await expect(toastRegion(page)).toContainText("It is busy right now, so nothing was restarted. Try again in a moment.");
  await expect(toastRegion(page)).not.toContainText("A fresh session is starting");

  dialog = await openRestart(page);
  await dialog.getByRole("button", { name: "Finish, then restart" }).click();
  await expect(dialog).toBeHidden();
  await expect(toastRegion(page)).toContainText("Restarted. A fresh session is starting.");
  const calls = await demoCalls(page, "restartSystemSession");
  expect(calls).toHaveLength(2);
  for (const c of calls) {
    expect(c.params.options.disposition).toBe("complete"); // the gentle mode, never hard_delete
    expect(c.params.agentIdOrSessionId).toBe("sweeper");
  }
});
