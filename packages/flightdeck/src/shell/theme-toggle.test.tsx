import { beforeEach, describe, expect, it, vi } from "vitest";

const preference = vi.hoisted(() => ({
  theme: "dark" as "dark" | "light" | "system",
  systemDark: false,
  selected: [] as string[],
}));

vi.mock("@/shell/prefs", () => ({
  CLASSIC_PORTAL_URL: "http://localhost:3001",
  useTheme: () => [preference.theme, (next: typeof preference.theme) => {
    preference.theme = next;
    preference.selected.push(next);
  }],
  useMediaQuery: (query: string) => query.includes("prefers-color-scheme") && preference.systemDark,
  useDensity: () => ["compact", vi.fn()],
}));
vi.mock("@/shell/ui-state", () => ({ useUi: () => ({ setPaletteOpen: vi.fn() }) }));

import { TopBar } from "./AppShell";

function findToggle(node: any): any {
  if (!node || typeof node !== "object") return undefined;
  if (node.props?.["aria-label"] === "Toggle light and dark theme") return node;
  return [node.props?.children].flat(Infinity).map(findToggle).find(Boolean);
}

function clickRenderedToggle() {
  const tree = TopBar({ crumbs: [{ label: "Overview" }] });
  const toggle = findToggle(tree);
  expect(toggle).toBeDefined();
  toggle.props.onClick();
}

describe("theme toggle intent", () => {
  beforeEach(() => {
    preference.theme = "dark";
    preference.systemDark = false;
    preference.selected = [];
    // React renders the new preference before the effect updates this class.
    vi.stubGlobal("document", { documentElement: { classList: { contains: () => true } } });
  });

  it("alternates on every click even when the DOM class is from the previous commit", () => {
    for (let i = 0; i < 4; i++) clickRenderedToggle();
    expect(preference.selected).toEqual(["light", "dark", "light", "dark"]);
  });

  it("switches away from the resolved system theme, ignoring a stale page class", () => {
    preference.theme = "system";
    preference.systemDark = false;
    clickRenderedToggle();
    expect(preference.selected).toEqual(["dark"]);
  });
});
