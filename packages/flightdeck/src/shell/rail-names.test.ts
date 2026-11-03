import { describe, expect, it } from "vitest";

// Source guards for two things the 2026-11-01 audit found in the shell. A rendered check needs Radix tooltips and
// the router, which the test renderer does not provide, so these read the file.
const shell = import.meta.glob<string>("/src/shell/AppShell.tsx", { query: "?raw", import: "default", eager: true })["/src/shell/AppShell.tsx"];

describe("the shell's navigation names", () => {
  it("names a rail link that is folded to an icon, since the tooltip is not an accessible name", () => {
    const rail = shell.slice(shell.indexOf("function RailLink"), shell.indexOf("export function NavTop"));
    expect(rail).toMatch(/aria-label=\{collapsed \?/);
  });
  it("marks the current page once: on the link, not also on the page heading", () => {
    expect(shell).not.toMatch(/<h1[^>]*aria-current/);
  });
});
