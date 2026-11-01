import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@/test/render";

// The REAL theme hooks and components under real React, with the preference store in memory.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as any).window = globalThis;
  (globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  (globalThis as any).document = { documentElement: { classList: { toggle: vi.fn(), contains: () => false }, dataset: {} } };
});
afterEach(() => { vi.restoreAllMocks(); });

const { THEME_OPTIONS, useThemeCommands } = await import("./theme-setting");

describe("one theme control", () => {
  it("offers exactly System, Light and Dark, in that order, from one list", () => {
    expect(THEME_OPTIONS.map((o) => o.label)).toEqual(["System", "Light", "Dark"]);
  });
  it("the palette commands are three fixed ones, found by dark mode, light mode, theme and appearance", async () => {
    const out: { current?: ReturnType<typeof useThemeCommands> } = {};
    function Probe() { out.current = useThemeCommands(); return null; }
    const r = await render(<Probe />);
    expect(out.current!.map((c) => c.label)).toEqual(["Theme: System", "Theme: Light", "Theme: Dark"]);
    for (const c of out.current!) expect(c.keywords).toEqual(expect.arrayContaining(["theme", "dark mode", "light mode", "appearance"]));
    await r.unmount();
  });
  it("running a palette command stores that choice, whatever the current theme is", async () => {
    const out: { current?: ReturnType<typeof useThemeCommands> } = {};
    function Probe() { out.current = useThemeCommands(); return null; }
    const r = await render(<Probe />);
    await act(() => out.current!.find((c) => c.value === "dark")!.run());
    expect(store.get("fd.theme")).toBe("dark");
    await act(() => out.current!.find((c) => c.value === "dark")!.run());
    expect(store.get("fd.theme")).toBe("dark"); // choosing Dark twice stays Dark: it never flips
    await act(() => out.current!.find((c) => c.value === "system")!.run());
    expect(store.get("fd.theme")).toBe("system");
    await r.unmount();
  });
  it("nothing stored means System, and a stored explicit choice is left alone", async () => {
    const { useTheme } = await import("@/shell/prefs");
    const out: { theme?: string } = {};
    function Probe() { out.theme = useTheme()[0]; return null; }
    let r = await render(<Probe />);
    expect(out.theme).toBe("system");
    await r.unmount();
    store.set("fd.theme", "light");
    r = await render(<Probe />);
    expect(out.theme).toBe("light");
    await r.unmount();
  });
});
