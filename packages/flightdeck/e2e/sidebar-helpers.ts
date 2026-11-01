import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { isPhone } from "./helpers";

/** The sidebar as a locator: the page's own aside on a desktop, the open drawer on a phone. */
export async function sidebar(page: Page, info: TestInfo): Promise<{ root: Locator; list: Locator }> {
  if (isPhone(info)) {
    await page.getByRole("button", { name: "Open menu and sessions" }).first().click();
    const drawer = page.getByRole("dialog", { name: "PilotSwarm" });
    await expect(drawer).toBeVisible();
    return { root: drawer, list: drawer.getByRole("navigation", { name: "Sessions" }) };
  }
  const root = page.getByRole("complementary", { name: "Sidebar" });
  await expect(root).toBeVisible();
  return { root, list: root.getByRole("navigation", { name: "Sessions" }) };
}
export const row = (list: Locator, title: string | RegExp) => list.getByRole("link", { name: title }).first();

