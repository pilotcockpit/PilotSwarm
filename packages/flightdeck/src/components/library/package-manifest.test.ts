import { describe, expect, it } from "vitest";
import { describeManifest } from "./package-manifest";

describe("what a package contains, from its manifest", () => {
  it("reads agent names from the manifest, not from file names", () => {
    const c = describeManifest({ agents: [{ name: "release-captain", title: "Release captain" }, { name: "test-runner", startedBy: ["release-captain"] }], skills: [{ name: "changelog" }], mcpServers: ["kusto"], hasTools: true });
    expect(c.agents.map((a) => a.name)).toEqual(["release-captain", "test-runner"]);
    expect(c.skills).toEqual(["changelog"]);
    expect(c.mcpServers).toEqual(["kusto"]);
    expect(c.tools).toBe(true);
    expect(c.zeroAgent).toBe(false);
  });
  it("calls a package with only skills, tools or MCP zero-agent, not empty", () => {
    expect(describeManifest({ agents: [], skills: [{ name: "tone" }], mcpServers: [], hasTools: false })).toMatchObject({ known: true, zeroAgent: true });
  });
  it("says 'not reported' for a manifest with no content detail instead of 'nothing'", () => {
    expect(describeManifest({ name: "x", version: "1.0.0" })).toMatchObject({ known: false, zeroAgent: false });
    expect(describeManifest(null).known).toBe(false);
  });
});
