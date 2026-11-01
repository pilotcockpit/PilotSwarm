import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe, gotoDemo, isPhone } from "./helpers";
import { sidebar } from "./sidebar-helpers";

// One theme control, set in three places (Settings, the account menu, the palette) and never as a toggle in
// the top bar. System is the default and follows the browser; a stored explicit choice always wins.

const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("dark"));
const stored = (page: Page) => page.evaluate(() => localStorage.getItem("fd.theme"));

/** A first visit: nothing stored for the theme, so the default applies. */
async function firstVisit(page: Page, path: string) {
  await page.addInitScript(() => { try { if (!localStorage.getItem("__fdSeeded")) { localStorage.setItem("__fdSeeded", "1"); localStorage.setItem("fd.data", "demo"); localStorage.removeItem("fd.theme"); } } catch { /* storage unavailable */ } });
  await page.goto(path.includes("?") ? `${path}&data=demo` : `${path}?data=demo`);
  await page.locator("#root *").first().waitFor();
}

test("Settings: the segmented control flips the theme and the choice survives a reload", async ({ page }, info) => {
  await gotoDemo(page, "/settings?tab=appearance", info);
  const group = page.getByRole("radiogroup", { name: "Theme" });
  await group.getByRole("radio", { name: "Dark" }).click();
  expect(await isDark(page)).toBe(true);
  expect(await stored(page)).toBe("dark");
  await page.reload();
  expect(await isDark(page)).toBe(true);
  await expect(page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Dark" })).toBeChecked();
  await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Light" }).click();
  expect(await isDark(page)).toBe(false);
  await page.reload();
  expect(await isDark(page)).toBe(false);
  expect(await stored(page)).toBe("light");
});

test("Account menu: a radio group with the current choice checked; choosing flips the theme", async ({ page }, info) => {
  await gotoDemo(page, "/", info);
  const { root } = await sidebar(page, info);
  const open = async () => { await root.getByRole("button", { name: /^Account and settings/ }).click(); return page.getByRole("menu"); };
  let menu = await open();
  const group = menu.getByRole("group", { name: "Theme" });
  await expect(group.getByRole("menuitemradio")).toHaveCount(3);
  const start = info.project.metadata?.theme === "dark" ? "Dark" : "Light";
  await expect(group.getByRole("menuitemradio", { name: start })).toHaveAttribute("aria-checked", "true");
  await expect(group.getByRole("menuitemradio", { name: "System" })).toHaveAttribute("aria-checked", "false");
  await expectNoSeriousAxe(page, menu, "account menu with the theme radio group");
  const next = start === "Dark" ? "Light" : "Dark";
  await group.getByRole("menuitemradio", { name: next }).click();
  expect(await isDark(page)).toBe(next === "Dark");
  if (isPhone(info)) await page.keyboard.press("Escape"); // the drawer
  const again = await sidebar(page, info);
  await again.root.getByRole("button", { name: /^Account and settings/ }).click();
  menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitemradio", { name: next })).toHaveAttribute("aria-checked", "true");
});

test("Palette: Theme: System, Light and Dark are three fixed commands, found by 'dark mode'", async ({ page }, info) => {
  await gotoDemo(page, "/", info);
  const palette = page.getByRole("dialog", { name: "Command palette" });
  const search = async (text: string) => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette).toBeVisible();
    await page.keyboard.type(text);
  };
  await search("dark mode");
  for (const label of ["Theme: System", "Theme: Light", "Theme: Dark"]) await expect(palette.getByRole("option", { name: label })).toBeVisible();
  await palette.getByRole("option", { name: "Theme: Dark" }).click();
  await expect(palette).toBeHidden();
  expect(await isDark(page)).toBe(true);
  expect(await stored(page)).toBe("dark");
  await search("Theme: Light");
  await page.keyboard.press("Enter");
  expect(await isDark(page)).toBe(false);
  await search("appearance");
  await palette.getByRole("option", { name: "Theme: System" }).click();
  expect(await stored(page)).toBe("system");
  // The commands do not depend on the current theme: there is no "Change theme" that flips.
  await search("Change theme");
  await expect(palette.getByRole("option", { name: /Change theme/ })).toHaveCount(0);
});

test("System is the default and follows the browser; an explicit choice does not", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await firstVisit(page, "/");
  expect(await stored(page)).toBeNull(); // nothing chosen yet
  expect(await isDark(page)).toBe(false); // and no dark flash for a light computer
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => isDark(page)).toBe(true); // follows the browser live
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => isDark(page)).toBe(false);
  // Pick Light explicitly: a dark computer no longer changes it.
  await page.goto("/settings?tab=appearance&data=demo");
  await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Light" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(300);
  expect(await isDark(page)).toBe(false);
  // And back to System: it follows the (dark) computer again.
  await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "System" }).click();
  await expect.poll(() => isDark(page)).toBe(true);
});

test("A dark computer gets a dark first paint, with no light flash", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => { try { localStorage.removeItem("fd.theme"); localStorage.setItem("fd.data", "demo"); } catch { /* ignore */ } });
  await page.goto("/?data=demo", { waitUntil: "domcontentloaded" });
  // The pre-paint script has run before the app mounts.
  expect(await isDark(page)).toBe(true);
});

test("There is no theme toggle in the top bar", async ({ page }, info) => {
  for (const path of ["/", "/sessions", "/boards", "/library", "/settings", `/s/a1f0c2d4-0005-4c00-9000-000000000005`]) {
    await gotoDemo(page, path, info);
    await expect(page.getByRole("button", { name: /toggle .*theme/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /switch to (dark|light)/i })).toHaveCount(0);
  }
});

test("Phone: the More sheet carries the same System | Light | Dark control", async ({ page }, info) => {
  test.skip(!isPhone(info), "the More sheet is the phone's menu");
  await gotoDemo(page, "/", info);
  await page.getByRole("button", { name: /^More/ }).click();
  const sheet = page.getByRole("dialog", { name: "More" });
  await sheet.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Dark" }).click();
  expect(await isDark(page)).toBe(true);
  await sheet.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Light" }).click();
  expect(await isDark(page)).toBe(false);
});
