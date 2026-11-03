import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { isPhone } from "./helpers";

/** Unfolds every section heading. The sidebar loads fully folded, and what a test looks for is inside the sections. */
export async function openAllSections(list: Locator) {
  await expect(list.getByRole("heading").first()).toBeVisible(); // the sections appear once the sessions have loaded
  const closed = list.locator("h2 button[aria-expanded='false']");
  // A section can appear after the first ones (Pinned arrives with the account's settings): keep unfolding until nothing
  // new has turned up for a few looks in a row.
  let calm = 0;
  for (let i = 0; i < 60 && calm < 4; i++) {
    if ((await closed.count()) > 0) { await closed.first().click(); calm = 0; } else { calm++; await list.page().waitForTimeout(120); }
  }
}

/**
 * The sidebar as a locator: the page's own aside on a desktop, the open drawer on a phone. It loads with every section
 * folded; unless `folded` is asked for, the sections are opened so a test can reach the rows.
 */
export async function sidebar(page: Page, info: TestInfo, o: { folded?: boolean } = {}): Promise<{ root: Locator; list: Locator }> {
  const found = await locate(page, info);
  if (!o.folded) await openAllSections(found.list);
  return found;
}

async function locate(page: Page, info: TestInfo): Promise<{ root: Locator; list: Locator }> {
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

