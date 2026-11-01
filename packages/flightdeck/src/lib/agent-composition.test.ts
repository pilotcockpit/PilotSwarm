import { describe, expect, it } from "vitest";
import { composeAgents } from "./agent-composition";

const a = (name: string, extra: Record<string, unknown> = {}) => ({ name, ...extra }) as any;

describe("agent composition, as the shared picker orders it", () => {
  it("nests an agent under the one that starts it and marks it not startable", () => {
    const rows = composeAgents([a("test-runner", { startedBy: ["release-captain"] }), a("release-captain")]);
    expect(rows.map((r) => [r.name, r.depth, r.startable])).toEqual([["release-captain", 0, true], ["test-runner", 1, false]]);
    expect(rows[1].parentName).toBe("release-captain");
  });
  it("ignores a creator that is not in the set, so the agent stays an entry point", () => {
    const rows = composeAgents([a("lonely", { startedBy: ["somewhere-else"] })]);
    expect(rows[0]).toMatchObject({ depth: 0, startable: true });
  });
  it("lets an explicit supportsDirectStart win either way", () => {
    expect(composeAgents([a("x", { supportsDirectStart: false })])[0].startable).toBe(false);
    expect(composeAgents([a("p"), a("c", { startedBy: ["p"], supportsDirectStart: true })])[1].startable).toBe(true);
  });
  it("shows a cycle flat instead of losing it", () => {
    const rows = composeAgents([a("a", { startedBy: ["b"] }), a("b", { startedBy: ["a"] })]);
    expect(rows.map((r) => r.name).sort()).toEqual(["a", "b"]);
  });
});
