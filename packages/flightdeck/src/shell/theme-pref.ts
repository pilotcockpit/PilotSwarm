// The theme preference's one rule, shared by React and (as the same table in a test) the pre-paint script in index.html.
export type Theme = "dark" | "light" | "system";

/** Anything stored that is not exactly "light" or "dark" means System: an old, hand-edited or corrupt value never pins a theme. */
export const normaliseTheme = (raw: unknown): Theme => (raw === "light" || raw === "dark" ? raw : "system");

/** Whether the page is dark for a preference and the operating system's current setting. */
export const resolveDark = (theme: Theme, osDark: boolean): boolean => theme === "dark" || (theme === "system" && osDark);
