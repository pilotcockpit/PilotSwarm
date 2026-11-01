import indexHtml from "../../index.html?raw";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { normaliseTheme, resolveDark } from "./theme-pref";
import { applyTheme, useTheme } from "./prefs";

// One table, two implementations: the rule in React and the inline script in index.html that runs before first paint.
const stored = [null, "", "system", "light", "dark", "bogus", "DARK", " dark", "true", "0"];
const prepaint = indexHtml.match(/<script>([\s\S]*?)<\/script>/)![1];

function runPrepaint(value: string | null, osDark: boolean): boolean {
  let dark = false;
  const classList = { toggle: (_: string, on: boolean) => { dark = on; } };
  new Function("localStorage", "matchMedia", "document", prepaint)(
    { getItem: () => value },
    () => ({ matches: osDark }),
    { documentElement: { classList } },
  );
  return dark;
}

describe("the stored theme", () => {
  it("only light and dark pin a theme; everything else is System", () => {
    expect(stored.map(normaliseTheme)).toEqual(["system", "system", "system", "light", "dark", "system", "system", "system", "system", "system"]);
  });
  it("the pre-paint script and the React rule agree on every stored value and both OS settings", () => {
    for (const value of stored) for (const osDark of [true, false]) {
      expect(runPrepaint(value, osDark), `${JSON.stringify(value)} osDark=${osDark}`).toBe(resolveDark(normaliseTheme(value), osDark));
    }
  });

  it("the React side (applyTheme) lands on the same answer as the pre-paint script for every stored value", () => {
    for (const value of stored) for (const osDark of [true, false]) {
      let dark = false;
      const g: any = globalThis;
      g.matchMedia = () => ({ matches: osDark });
      g.document = { documentElement: { classList: { toggle: (_: string, on: boolean) => { dark = on; } } } };
      applyTheme(value as any);
      expect(dark, `${JSON.stringify(value)} osDark=${osDark}`).toBe(runPrepaint(value, osDark));
    }
  });

  it("a stored bogus value follows the operating system: the listener is installed, as for System", async () => {
    const g: any = globalThis;
    let listeners = 0;
    g.window = g;
    g.matchMedia = () => ({ matches: true, addEventListener: () => { listeners += 1; }, removeEventListener: () => undefined });
    g.document = { documentElement: { classList: { toggle: () => undefined } } };
    g.localStorage = { getItem: () => "bogus", setItem: () => undefined, removeItem: () => undefined };
    function Probe() { useTheme(); return null; }
    const r = await render(React.createElement(Probe));
    expect(listeners).toBeGreaterThan(0);
    await r.unmount();
  });
});
