import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { demoCalls, expectNoSeriousAxe, gotoDemo, Sheet, shot, toastRegion, watchConsole } from "./helpers";

// Providers (Models & spend): hold, allowance, limits, remove, add, paused work. Demo data signs in as admin.

async function providers(page: Page, info: TestInfo) {
  await gotoDemo(page, "/providers", info);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Models");
  await expect(providerRow(page, "anthropic-wif")).toBeVisible();
}
/** A provider's row opener: a named button on desktop, and a button whose name also lists its status on a phone. */
const providerRow = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}\\b`) }).first();
async function openSheet(page: Page, name = "anthropic-wif") {
  const opener = providerRow(page, name);
  const sheet = await Sheet.open(page, opener, name);
  return { opener, sheet };
}
async function tab(sheet: Sheet, name: string) {
  await sheet.dialog.getByRole("radiogroup", { name: "Provider" }).getByRole("radio", { name }).click();
}

test("hold: presets, the confirm names affected sessions, the hold shows its release and Release removes it", async ({ page }, info) => {
  const errors = watchConsole(page);
  await providers(page, info);
  const { sheet } = await openSheet(page, "azure-foundry-wif");
  await tab(sheet, "Limits & access");
  const hold = sheet.dialog.getByRole("region", { name: "Hold" });
  const how = hold.getByRole("group", { name: "How long" });
  for (const name of ["1 hour", "Until tomorrow", "Until released", "Choose a time"]) await expect(how.getByRole("button", { name })).toBeVisible();
  await expect(how.getByRole("button", { name: "1 hour" })).toHaveAttribute("aria-pressed", "true");
  await how.getByRole("button", { name: "Until tomorrow" }).click();
  await expect(how.getByRole("button", { name: "Until tomorrow" })).toHaveAttribute("aria-pressed", "true");
  await expect(how.getByRole("button", { name: "1 hour" })).toHaveAttribute("aria-pressed", "false");
  await shot(page, info, "hold-presets");
  await expectNoSeriousAxe(page, sheet.dialog, "provider sheet, limits and hold");

  const opener = hold.getByRole("button", { name: "Pause new turns…" });
  const confirm = await Sheet.open(page, opener, "Pause azure-foundry-wif?");
  await expect(confirm.dialog).toContainText(/sessions? using it will pause at their next turn/);
  await expect(confirm.dialog).toContainText("Nothing is cancelled");
  await shot(page, info, "hold-confirm");
  await expectNoSeriousAxe(page, confirm.dialog, "hold confirm");
  await confirm.expectEscapeReturnsFocusTo(opener);

  const again = await Sheet.open(page, opener, "Pause azure-foundry-wif?");
  await again.dialog.getByRole("button", { name: "Pause new turns" }).click();
  await expect(again.dialog).toBeHidden();
  // The hold now reads as a hold, says when it ends, and offers Release.
  const status = hold.getByRole("status");
  await expect(status).toContainText(/New turns are paused until/);
  const release = status.getByRole("button", { name: "Release hold" });
  await expect(release).toBeVisible();
  await shot(page, info, "hold-active");
  // The provider list shows it too, once the sheet is closed.
  await sheet.close();
  await expect(page.getByText("On hold").filter({ visible: true }).first()).toBeVisible();
  await providerRow(page, "azure-foundry-wif").click();
  await page.getByRole("dialog").last().getByRole("radiogroup", { name: "Provider" }).getByRole("radio", { name: "Limits & access" }).click();
  const hold2 = page.getByRole("dialog").last().getByRole("region", { name: "Hold" });
  await hold2.getByRole("button", { name: "Release hold" }).click();
  await expect(hold2.getByRole("button", { name: "Release hold" })).toHaveCount(0);
  await expect(hold2.getByRole("button", { name: "Pause new turns…" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("hold: custom time and 'until released' say how long", async ({ page }, info) => {
  await providers(page, info);
  const { sheet } = await openSheet(page);
  await tab(sheet, "Limits & access");
  const hold = sheet.dialog.getByRole("region", { name: "Hold" });
  await hold.getByRole("button", { name: "Until released" }).click();
  await hold.getByRole("button", { name: "Pause new turns…" }).click();
  const confirm = page.getByRole("dialog", { name: "Pause anthropic-wif?" });
  await expect(confirm).toContainText(/until (you )?release/i);
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await hold.getByRole("button", { name: "Choose a time" }).click();
  await expect(hold.locator("input[type=datetime-local], input[type=time], input[type=date]").first()).toBeVisible();
});

test("allowance: the slider changes the sentence; saving sends one call; Undo (pointer) sends the old value back", async ({ page }, info) => {
  await providers(page, info);
  const { sheet } = await openSheet(page);
  await tab(sheet, "Limits & access");
  const region = sheet.dialog.getByRole("region", { name: "Per-person allowance" });
  const slider = region.getByRole("slider", { name: /Per-person allowance/ });
  const save = region.getByRole("button", { name: "Save allowance" });
  await expect(slider).toHaveValue("40");
  await expect(save).toBeDisabled();
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(slider).not.toHaveValue("40");
  await expect(save).toBeEnabled();
  const now = await slider.inputValue();
  await expect(region).toContainText(`up to ${now}%`);
  expect(await demoCalls(page, "setProviderAllowance")).toHaveLength(0); // moving the slider saves nothing
  await save.click();
  // The result is announced inside the open sheet (a modal traps focus, so a toast outside would be out of reach).
  const status = sheet.dialog.getByRole("status").filter({ hasText: "Each person may now use up to" });
  await expect(status).toContainText(`up to ${now}%`);
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Each person may now use" })).toHaveCount(0); // announced once, not twice
  let calls = await demoCalls(page, "setProviderAllowance");
  expect(calls).toHaveLength(1);
  expect(calls[0].params).toEqual({ name: "anthropic-wif", pct: Number(now) });
  await status.getByRole("button", { name: "Undo" }).click();
  await expect(slider).toHaveValue("40");
  calls = await demoCalls(page, "setProviderAllowance");
  expect(calls).toHaveLength(2);
  expect(calls[1].params).toEqual({ name: "anthropic-wif", pct: 40 }); // Undo restored the previous value
});

test("allowance: Undo is reachable by keyboard while the sheet is open (Tab to it, Enter)", async ({ page }, info) => {
  test.skip(info.project.metadata?.phone === true, "keyboard path is the same on a phone; desktop is enough");
  await providers(page, info);
  const { sheet } = await openSheet(page);
  await tab(sheet, "Limits & access");
  const region = sheet.dialog.getByRole("region", { name: "Per-person allowance" });
  const slider = region.getByRole("slider", { name: /Per-person allowance/ });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  const save = region.getByRole("button", { name: "Save allowance" });
  await save.focus();
  await page.keyboard.press("Enter"); // save with the keyboard too
  const undo = sheet.dialog.getByRole("status").getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible();
  // Tab from the Save button until the Undo button has focus: it is inside the dialog's focus scope.
  for (let i = 0; i < 40 && !(await undo.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(undo).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(slider).toHaveValue("40");
  const calls = await demoCalls(page, "setProviderAllowance");
  expect(calls).toHaveLength(2);
  expect(calls[1].params.pct).toBe(40);
});

test("limits: an exact integer stays exact; removing a limit offers Undo", async ({ page }, info) => {
  await providers(page, info);
  const { sheet } = await openSheet(page);
  await tab(sheet, "Limits & access");
  const limits = sheet.dialog.getByRole("region", { name: "Limits" });
  const today = limits.getByRole("listitem").filter({ hasText: "Today" });
  await today.getByRole("button", { name: "Set a limit" }).click();
  const tokens = limits.getByRole("textbox", { name: /Tokens per day/ });
  await tokens.fill("1234567");
  await limits.getByRole("button", { name: /^Save/ }).first().click();
  await expect(today).toContainText(/1\.2M|1,234,567/);
  // What was SENT is the exact integer, whatever the screen rounds it to.
  const sent = await demoCalls(page, "setProviderLimit");
  expect(sent).toHaveLength(1);
  expect(sent[0].params).toMatchObject({ name: "anthropic-wif", period: "day", tokens: 1234567 });

  // Opening it again must not round the stored value.
  await today.getByRole("button", { name: "Change" }).click();
  await expect(limits.getByRole("textbox", { name: /Tokens per day/ })).toHaveValue("1234567");
  await shot(page, info, "limit-exact");

  // Remove the monthly limit; Undo brings it back.
  const month = limits.getByRole("listitem").filter({ hasText: "This month" });
  await month.getByRole("button", { name: "Change" }).click();
  await month.getByRole("button", { name: "Remove limit" }).click();
  await expect(month.getByRole("button", { name: "Set a limit" })).toBeVisible();
  const removed = await demoCalls(page, "removeProviderLimit");
  expect(removed).toHaveLength(1);
  expect(removed[0].params).toMatchObject({ name: "anthropic-wif", period: "month" });
  // The Undo is in the sheet, and it sends the old limit back.
  await sheet.dialog.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(month).toContainText("9.7M of 10M");
  const restored = (await demoCalls(page, "setProviderLimit")).at(-1)!;
  expect(restored.params).toMatchObject({ name: "anthropic-wif", period: "month", tokens: 10_000_000 });
});

test("limits: removing a limit, Undo by keyboard (Tab to it, Enter)", async ({ page }, info) => {
  test.skip(info.project.metadata?.phone === true, "keyboard path is the same on a phone; desktop is enough");
  await providers(page, info);
  const { sheet } = await openSheet(page);
  await tab(sheet, "Limits & access");
  const limits = sheet.dialog.getByRole("region", { name: "Limits" });
  const month = limits.getByRole("listitem").filter({ hasText: "This month" });
  await month.getByRole("button", { name: "Change" }).click();
  const remove = month.getByRole("button", { name: "Remove limit" });
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(month.getByRole("button", { name: "Set a limit" })).toBeVisible();
  const undo = sheet.dialog.getByRole("status").getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible();
  for (let i = 0; i < 60 && !(await undo.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(undo).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(month).toContainText("9.7M of 10M");
});

test("Remove provider: the confirm states the exact number of waiting sessions; nothing is called before Remove; one call after", async ({ page }, info) => {
  await providers(page, info);
  const { sheet } = await openSheet(page);
  const opener = sheet.dialog.getByRole("button", { name: "Remove provider…" });
  const confirm = await Sheet.open(page, opener);
  // The demo has 12 live sessions on anthropic-wif (its sub-agents and projects included); the dialog says exactly that, and what happens to them.
  await expect(confirm.dialog).toContainText("12 sessions using it will pause until the name is provided again.");
  await expect(confirm.dialog).toContainText("The stored key is deleted.");
  await shot(page, info, "remove-provider");
  await expectNoSeriousAxe(page, confirm.dialog, "remove provider confirm");
  expect(await demoCalls(page, "deleteProvider")).toHaveLength(0);
  await confirm.expectEscapeReturnsFocusTo(opener);
  expect(await demoCalls(page, "deleteProvider")).toHaveLength(0);

  const again = await Sheet.open(page, opener);
  await again.dialog.getByRole("button", { name: "Remove provider" }).click();
  await expect(again.dialog).toBeHidden();
  const calls = await demoCalls(page, "deleteProvider");
  expect(calls).toHaveLength(1);
  expect(calls[0].params.name).toBe("anthropic-wif");
});

test("add provider: only the chosen type's fields, a password key that is cleared after saving", async ({ page }, info) => {
  await providers(page, info);
  const opener = page.getByRole("button", { name: "Add provider" });
  const sheet = await Sheet.open(page, opener, /Add a provider/i);
  await shot(page, info, "add-provider");
  await expectNoSeriousAxe(page, sheet.dialog, "add provider sheet");

  // Pick a keyed type: a key field appears and is a password input.
  const types = sheet.dialog.getByRole("radiogroup").first();
  await types.getByRole("radio", { name: /OpenAI/ }).first().click();
  const key = sheet.dialog.locator("input[type=password]");
  await expect(key).toHaveCount(1);
  await expect(key).toHaveAttribute("autocomplete", "off");
  const typedFields = await sheet.dialog.locator("input:not([type=radio]), select, textarea").count();

  // A workload-identity type has no key at all.
  await types.getByRole("radio", { name: /workload identity/i }).first().click();
  await expect(sheet.dialog.locator("input[type=password]")).toHaveCount(0);

  // Back to a keyed type, fill and save.
  await types.getByRole("radio", { name: /OpenAI/ }).first().click();
  expect(typedFields).toBeGreaterThan(0);
  await sheet.dialog.locator("input[type=password]").fill("sk-e2e-not-a-real-key");
  await sheet.dialog.getByRole("textbox", { name: "Name", exact: true }).fill("e2e-openai");
  await sheet.dialog.getByRole("button", { name: "Add provider" }).click();

  // The confirmation never repeats the key, and the key is gone from the DOM.
  const added = page.getByRole("dialog", { name: "Provider added" });
  await expect(added).toBeVisible();
  await expect(added).toContainText("e2e-openai is ready");
  const created = await demoCalls(page, "createMyProvider");
  expect(created).toHaveLength(1); // "Just me" is the default: a personal provider, not a shared one
  expect(created[0].params).toMatchObject({ name: "e2e-openai" });
  expect(await demoCalls(page, "createProvider")).toHaveLength(0);
  await expect(page.locator("input[type=password]")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.innerHTML.includes("sk-e2e-not-a-real-key"))).toBe(false);
  await added.getByRole("button", { name: "Done" }).click();
  await expect(providerRow(page, "e2e-openai")).toBeVisible();
  expect(await page.evaluate(() => document.body.innerHTML.includes("sk-e2e-not-a-real-key"))).toBe(false);
});

test("paused work: the banner names the reason and its action opens the provider", async ({ page }, info) => {
  await providers(page, info);
  const banner = page.getByRole("status", { name: "Paused work" });
  await expect(banner).toContainText("1 session waiting");
  await expect(banner).toContainText("monthly limit");
  await shot(page, info, "paused-banner");
  await expectNoSeriousAxe(page, banner, "paused banner");
  // One toggle per reason (the monthly limit and the hold both wait on one session each).
  await banner.getByRole("button", { name: "Show 1 session" }).first().click();
  await expect(banner.getByRole("link").first()).toBeVisible();
  await banner.getByRole("button", { name: "Raise the limit" }).click();
  await expect(page.getByRole("dialog").last()).toBeVisible();
  await expect(page.getByRole("dialog").last()).toContainText("anthropic-wif");
});

test("default models: the sentence names model, provider and source, and follows a change; Undo restores", async ({ page }, info) => {
  await providers(page, info);
  await page.getByRole("radiogroup", { name: "Models and spend" }).getByRole("radio", { name: "Default models" }).click();
  const mine = page.getByRole("heading", { name: "Your default model" }).locator("xpath=..");
  const system = page.getByRole("heading", { name: "System default" }).locator("xpath=..");
  // Each card states its own effective model, provider and where it comes from, together.
  await expect(mine).toContainText("Right now: claude-sonnet-5 on anthropic-wif, from the cluster default.");
  await expect(system).toContainText("Right now: gpt-5.6 on azure-foundry-wif, from the system default.");
  await shot(page, info, "defaults");
  await expectNoSeriousAxe(page, page.getByRole("main"), "default models");

  // Choosing a model of your own changes the source of the sentence, not just the words around it.
  await mine.getByRole("combobox", { name: "Model" }).selectOption({ label: "claude-opus-5 · high cost" });
  await expect(mine).toContainText("Right now: claude-opus-5 on anthropic-wif, from your default.");
  await expect(system).toContainText("from the system default."); // the other cards did not move
  await expect(toastRegion(page)).toContainText("Your default model is claude-opus-5.");
  const set = (await demoCalls(page)).filter((c) => /^set(My|Model)Default$/.test(c.op));
  expect(set).toHaveLength(1);
  expect(JSON.stringify(set[0].params)).toContain("claude-opus-5");

  await toastRegion(page).getByRole("button", { name: "Undo" }).click();
  await expect(mine).toContainText("Right now: claude-sonnet-5 on anthropic-wif, from the cluster default.");
});
