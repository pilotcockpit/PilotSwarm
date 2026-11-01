import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoPackageAgents } from "./packages.demo";
import { callDemoOp } from "./registry";

beforeEach(() => vi.stubGlobal("window", { setTimeout }));
afterEach(() => vi.unstubAllGlobals());
describe("package catalog fixtures mirror SDK eligibility", () => {
  it("uses actual frontmatter names and active copy versions", () => {
    const agents = demoPackageAgents();
    expect(agents.find((a) => a.name === "test-runner")).toMatchObject({ packageName: "pilotswarm-release", packageSemver: "1.4.0", scope: "shared" });
    expect(agents.some((a) => a.scope === "user" && !a.mine)).toBe(false);
  });
  it("lists a name once, shared first, like the server catalog (so a private copy's same-named agent is dropped)", () => {
    const agents = demoPackageAgents();
    const sre = agents.filter((a) => a.name === "sre-investigator");
    expect(sre).toHaveLength(1);
    expect(sre[0]).toMatchObject({ packageName: "ops-toolkit", packageSemver: "0.9.2", scope: "shared", mine: false });
    expect(new Set(agents.map((a) => a.name.toLowerCase())).size).toBe(agents.length);
  });
  it("carries composition and never invents skills", () => {
    const agents = demoPackageAgents();
    expect(agents.find((a) => a.name === "test-runner")?.startedBy).toEqual(["release-captain"]);
    expect(agents.some((a) => "skills" in a)).toBe(false);
  });
  it("derives the stored manifest from the files", async () => {
    const detail = (await callDemoOp("getAgentPackage", { name: "pilotswarm-release", scope: "shared" })) as any;
    const manifest = (detail.package?.versions ?? detail.versions).find((v: any) => v.semver === "1.4.0").manifest;
    expect(manifest.agents.map((a: any) => a.name)).toEqual(expect.arrayContaining(["release-captain", "test-runner"]));
    expect(Array.isArray(manifest.skills)).toBe(true);
    expect(typeof manifest.hasTools).toBe("boolean");
  });
  it("makes the other copy available when the viewer's own copy is turned off", async () => {
    vi.stubGlobal("window", { setTimeout });
    try {
      await callDemoOp("setAgentPackageEnabled", { name: "ops-toolkit", scope: "user", enabled: false });
      expect(demoPackageAgents().find((a) => a.name === "sre-investigator")).toMatchObject({ scope: "shared", packageSemver: "0.9.2" });
    } finally {
      await callDemoOp("setAgentPackageEnabled", { name: "ops-toolkit", scope: "user", enabled: true });
    }
  });
  it("returns the server's name-collision warning on upload and refuses a changed re-publish of a version", async () => {
    const file = (path: string, text: string) => ({ path, contentBase64: btoa(text) });
    const plugin = (v: string) => file("plugin.json", JSON.stringify({ name: "dup-check", version: v }));
    const agent = file("agents/x.agent.md", "---\nname: release-captain\ndescription: dup\n---\nhi");
    const first = (await callDemoOp("uploadAgentPackage", { files: [plugin("1.0.0"), agent], scope: "user" })) as any;
    expect(first.status).toBe("published");
    expect(first.warnings.map((w: any) => w.code)).toContain("AGENT_NAME_COLLISION");
    await expect(callDemoOp("uploadAgentPackage", { files: [plugin("1.0.0"), agent, file("extra.txt", "changed")], scope: "user" })).rejects.toThrow(/different contents/);
    expect(((await callDemoOp("uploadAgentPackage", { files: [plugin("1.0.0"), agent], scope: "user" })) as any).status).toBe("noop");
  });
});
