import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { demoCalls, expectNoSeriousAxe, gotoDemo, Sheet, shot } from "./helpers";

// Library packages: rolling back a version is one click with an Undo, and the Undo lives INSIDE the
// open package panel (a modal sheet traps focus, so a toast outside it cannot be reached by keyboard).

async function openPackage(page: Page, info: TestInfo) {
  await gotoDemo(page, "/library?tab=packages", info);
  const opener = page.getByRole("button", { name: /^pilotswarm-release/ }).first();
  const sheet = await Sheet.open(page, opener, /^pilotswarm-release/);
  const versions = sheet.dialog.getByRole("region", { name: "Versions" });
  await expect(versions.getByRole("listitem").filter({ hasText: "1.4.0" })).toContainText("Active");
  return { sheet, versions };
}
const row = (versions: ReturnType<Page["locator"]>, v: string) => versions.getByRole("listitem").filter({ hasText: v });

test("roll back: one call, the panel says so, Undo (pointer) pins the old version again", async ({ page }, info) => {
  const { sheet, versions } = await openPackage(page, info);
  await shot(page, info, "package-versions");
  await expectNoSeriousAxe(page, sheet.dialog, "package panel");
  expect(await demoCalls(page, "pinAgentPackageVersion")).toHaveLength(0);

  await row(versions, "1.3.2").getByRole("button", { name: "Roll back to this" }).click();
  await expect(row(versions, "1.3.2")).toContainText("Active");
  await expect(row(versions, "1.4.0")).not.toContainText("Active");
  let calls = await demoCalls(page, "pinAgentPackageVersion");
  expect(calls).toHaveLength(1);
  expect(calls[0].params).toMatchObject({ name: "pilotswarm-release", semver: "1.3.2" });

  // Announced inside the sheet, once.
  const status = sheet.dialog.getByRole("status").filter({ hasText: "now uses 1.3.2" });
  await expect(status).toContainText("pilotswarm-release now uses 1.3.2");
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "now uses 1.3.2" })).toHaveCount(0);

  await status.getByRole("button", { name: "Undo" }).click();
  await expect(row(versions, "1.4.0")).toContainText("Active");
  calls = await demoCalls(page, "pinAgentPackageVersion");
  expect(calls).toHaveLength(2);
  expect(calls[1].params).toMatchObject({ name: "pilotswarm-release", semver: "1.4.0" });
});

test("roll back: Undo is reachable by keyboard (Tab to it, Enter)", async ({ page }, info) => {
  test.skip(info.project.metadata?.phone === true, "keyboard path is the same on a phone; desktop is enough");
  const { sheet, versions } = await openPackage(page, info);
  const button = row(versions, "1.3.2").getByRole("button", { name: "Roll back to this" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(row(versions, "1.3.2")).toContainText("Active");
  const undo = sheet.dialog.getByRole("status").getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible();
  for (let i = 0; i < 60 && !(await undo.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(undo).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(row(versions, "1.4.0")).toContainText("Active");
});

test("an Undo still pending when the panel closes moves to a toast instead of vanishing", async ({ page }, info) => {
  const { sheet, versions } = await openPackage(page, info);
  await row(versions, "1.3.2").getByRole("button", { name: "Roll back to this" }).click();
  await expect(sheet.dialog.getByRole("status").getByRole("button", { name: "Undo" })).toBeVisible();
  await sheet.close();
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "now uses 1.3.2" });
  await expect(toast).toBeVisible(); // handed over with the time it had left
  await toast.getByRole("button", { name: "Undo" }).click();
  const calls = await demoCalls(page, "pinAgentPackageVersion");
  expect(calls.at(-1)!.params).toMatchObject({ semver: "1.4.0" });
});
