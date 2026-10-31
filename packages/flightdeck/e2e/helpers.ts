import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

export const IDS = {
  release: "a1f0c2d4-0001-4c00-9000-000000000001",
  p95: "a1f0c2d4-0005-4c00-9000-000000000005",
  deps: "a1f0c2d4-0006-4c00-9000-000000000006",
  research: "a1f0c2d4-0007-4c00-9000-000000000007", // owned by someone else, viewer cannot write
  canvasPort: "a1f0c2d4-0008-4c00-9000-000000000008",
  cost: "a1f0c2d4-0009-4c00-9000-000000000009",
} as const;

export const isPhone = (info: TestInfo) => Boolean(info.project.metadata?.phone);
export const themeOf = (info: TestInfo): "light" | "dark" => (info.project.metadata?.theme === "dark" ? "dark" : "light");

/** Demo data and the project's theme, set before the app reads them. */
export async function setTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("fd.theme", t);
      localStorage.setItem("fd.data", "demo");
    } catch { /* storage unavailable */ }
  }, theme);
}

/** Open a path on demo data. Always lands with the app mounted and animations finished. */
export async function gotoDemo(page: Page, path: string, info: TestInfo) {
  await setTheme(page, themeOf(info));
  const url = path.includes("?") ? `${path}&data=demo` : `${path}?data=demo`;
  await page.goto(url);
  await page.locator("#root *").first().waitFor();
  await finishAnimations(page);
}

/** Finite animations jump to their end; infinite ones (pulses) are left alone. */
export async function finishAnimations(page: Page) {
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));
}

/** A person-readable picture for review. Not diffed. */
export async function shot(page: Page, info: TestInfo, state: string) {
  const spec = info.file.split("/").pop()!.replace(".spec.ts", "");
  await finishAnimations(page);
  await page.screenshot({ path: `e2e/__screenshots__/${info.project.name}/${spec}-${state}.png`, animations: "disabled" });
}

/** Fail on serious or critical axe violations inside `scope` (default the whole page). */
export async function expectNoSeriousAxe(page: Page, scope?: Locator | string, label = "page") {
  await finishAnimations(page);
  let builder = new AxeBuilder({ page })
    // The sandboxed canvas frame renders agent-drawn documents, not Flight Deck's own UI.
    .exclude("iframe")
    // Resize separators are decorative drag handles with their own keyboard path.
    .exclude("[data-resize-handle]");
  if (typeof scope === "string") builder = builder.include(scope);
  else if (scope) {
    const handle = await scope.elementHandle();
    if (handle) {
      const sel = await handle.evaluate((el) => {
        const id = el.getAttribute("data-e2e-scope") || `e2e-${Math.random().toString(36).slice(2, 8)}`;
        el.setAttribute("data-e2e-scope", id);
        return `[data-e2e-scope="${id}"]`;
      });
      builder = builder.include(sel);
    }
  }
  const { violations } = await builder.analyze();
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`),
    `axe on ${label}`,
  ).toEqual([]);
}

/** The Radix dialog/sheet pattern: labelled, focus moves in, Escape closes, focus returns to the opener. */
export class Sheet {
  constructor(readonly page: Page, readonly dialog: Locator) {}

  /** Click `opener`, then expect a labelled dialog and focus inside it. */
  static async open(page: Page, opener: Locator, name?: string | RegExp) {
    await opener.click();
    const found = page.getByRole("dialog", name ? { name } : undefined).last();
    await expect(found).toBeVisible();
    // Pin THIS dialog by its id: `.last()` would point at a different dialog once this one closes.
    const id = await found.getAttribute("id");
    const dialog = id ? page.locator(`[id="${id}"]`) : found;
    await expect(dialog).toHaveAccessibleName(/.+/);
    await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    return new Sheet(page, dialog);
  }

  /** A dialog that is already open (opened by a menu item, say): pin it by id and check the pattern. */
  static async attach(page: Page, name: string | RegExp) {
    const found = page.getByRole("dialog", { name }).last();
    await expect(found).toBeVisible();
    await expect(found).toHaveAccessibleName(/.+/);
    const id = await found.getAttribute("id");
    return new Sheet(page, id ? page.locator(`[id="${id}"]`) : found);
  }

  /** Escape closes it and focus is back on the element that opened it. */
  async expectEscapeReturnsFocusTo(opener: Locator) {
    await this.page.keyboard.press("Escape");
    await expect(this.dialog).toBeHidden();
    await expect(opener).toBeFocused();
  }

  async close() {
    await this.page.keyboard.press("Escape");
    await expect(this.dialog).toBeHidden();
  }
}

/** Collect console errors and uncaught page errors for the whole test. */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // The dev server's own websocket and the favicon are not app errors.
    if (/favicon|\[vite\]|WebSocket/i.test(text)) return;
    errors.push(text);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}
