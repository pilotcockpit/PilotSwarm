import { describe, expect, it, vi } from "vitest";
import { render, type Rendered } from "@/test/render";
import { Providers, stubSource } from "@/test/harness";

vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { success: vi.fn(), error: vi.fn(), dismiss: () => undefined }) }));
(globalThis as any).window = globalThis;
(globalThis as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

import { AgentRows } from "./agent-rows";
import { UiStateProvider } from "@/shell/ui-state";

// The REAL Agents tab on the catalog the server sends: an agent that another agent starts is shown under it
// and offers no Start button (the shared picker refuses it too), and nothing claims skills the catalog never reports.
const catalog = [
  { name: "release-captain", title: "Release captain", description: "Coordinates a release.", tools: ["git"], source: "package", packageName: "pilotswarm-release", packageSemver: "1.4.0", scope: "shared" },
  { name: "test-runner", title: "Test runner", description: "Runs the suites.", tools: [], source: "package", packageName: "pilotswarm-release", packageSemver: "1.4.0", scope: "shared", startedBy: ["release-captain"] },
  { name: "helper", title: "Direct helper", description: "Started by captain but also usable alone.", tools: [], source: "package", packageName: "pilotswarm-release", packageSemver: "1.4.0", scope: "shared", startedBy: ["release-captain"], supportsDirectStart: true },
];

async function mount(query = "") {
  const { source } = stubSource({});
  source.listAgents = async () => catalog;
  source.listSessions = async () => [];
  const r = await render(<Providers source={source}><UiStateProvider><AgentRows query={query} packages={[]} onOpenPackage={() => undefined} onClear={() => undefined} /></UiStateProvider></Providers>);
  await r.flush(8);
  return r;
}
const startButtons = (r: Rendered) => r.findAll((n) => n.type === "button" && r.text(n).includes("Start session"));

describe("Agents tab composition", () => {
  it("offers Start only for entry points and explicitly direct agents", async () => {
    const r = await mount();
    expect(startButtons(r)).toHaveLength(2);
    const text = r.text(r.root);
    expect(text).toContain("Started by release-captain. It cannot be started on its own.");
    await r.unmount();
  });
  it("does not claim skills the catalog never reports", async () => {
    const r = await mount();
    expect(r.text(r.root)).not.toMatch(/skill/i);
    await r.unmount();
  });
  it("searches names, descriptions and tools, not skills", async () => {
    const r = await mount("skill");
    expect(startButtons(r)).toHaveLength(0);
    await r.unmount();
    const git = await mount("git");
    expect(startButtons(git)).toHaveLength(1);
    await git.unmount();
  });
});
