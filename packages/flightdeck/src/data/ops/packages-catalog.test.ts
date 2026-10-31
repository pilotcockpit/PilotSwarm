import { afterEach, describe, expect, it, vi } from "vitest";
import { demoPackageAgents } from "./packages.demo";
import { callDemoOp } from "./registry";

afterEach(() => vi.unstubAllGlobals());
describe("package catalog fixtures mirror SDK eligibility", () => {
  it("uses actual frontmatter names and active copy versions", () => {
    const agents = demoPackageAgents();
    expect(agents.find((a) => a.name === "test-runner")).toMatchObject({ packageName: "pilotswarm-release", packageSemver: "1.4.0", scope: "shared" });
    expect(agents.find((a) => a.name === "sre-investigator")).toMatchObject({ packageName: "ops-toolkit", packageSemver: "0.9.3-sam.1", scope: "user", mine: true });
    expect(agents.some((a) => a.scope === "user" && !a.mine)).toBe(false);
  });
  it("makes the shared copy available when the viewer turns their override off", async () => {
    vi.stubGlobal("window", { setTimeout });
    try {
      await callDemoOp("setAgentPackageEnabled", { name: "ops-toolkit", scope: "user", enabled: false });
      expect(demoPackageAgents().find((a) => a.name === "sre-investigator")).toMatchObject({ scope: "shared", packageSemver: "0.9.2" });
    } finally {
      await callDemoOp("setAgentPackageEnabled", { name: "ops-toolkit", scope: "user", enabled: true });
    }
  });
});
