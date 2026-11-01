import { describe, expect, it } from "vitest";
import type { Session } from "@/data/types";
import { buildSections, focusAfterChange, isRoot, visibleRowIds } from "./tree";

const s = (id: string, extra: Partial<Session> = {}): Session => ({ sessionId: id, title: id, status: "idle", updatedAt: 1_000, ...extra }) as Session;
const build = (sessions: Session[], o: Partial<Parameters<typeof buildSections>[0]> = {}) =>
  buildSections({ sessions, groups: [], pinned: new Set(), groupBy: "groups", state: null, showSystem: false, ...o });
const idsOf = (sections: ReturnType<typeof build>) => sections.flatMap((x) => x.sessions.map((y) => y.sessionId));

describe("sidebar tree: children and orphans", () => {
  it("keeps a sub-agent under its parent while the parent is listed", () => {
    const rows = idsOf(build([s("parent"), s("child", { parentSessionId: "parent" })]));
    expect(rows).toEqual(["parent"]);
  });
  it("promotes a sub-agent whose parent is not in the list to a root, so it can still be reached", () => {
    const rows = idsOf(build([s("orphan", { parentSessionId: "gone" }), s("other")]));
    expect(rows.sort()).toEqual(["orphan", "other"]);
  });
  it("isRoot reads the parent from the full list, not from what the filters left", () => {
    expect(isRoot(s("c", { parentSessionId: "p" }), new Set(["p", "c"]))).toBe(false);
    expect(isRoot(s("c", { parentSessionId: "p" }), new Set(["c"]))).toBe(true);
    expect(isRoot(s("c"), new Set(["c"]))).toBe(true);
  });
  it("a state filter that hides the parent does not resurface its child", () => {
    const sessions = [s("parent", { status: "running" }), s("child", { parentSessionId: "parent", status: "completed" })];
    expect(idsOf(build(sessions, { state: "completed" }))).toEqual([]);
  });
});

describe("sidebar tree: each session once", () => {
  it("a pinned session in a group is listed once, under Pinned", () => {
    const sections = build([s("a", { groupId: "g" } as any), s("b", { groupId: "g" } as any)], { groups: [{ id: "g", name: "Group" }], pinned: new Set(["a"]) });
    const all = idsOf(sections);
    expect(all.filter((x) => x === "a")).toHaveLength(1);
    expect(sections[0].kind).toBe("pinned");
  });
  it("a session in an unknown group falls through to Recent", () => {
    const sections = build([s("a", { groupId: "deleted" } as any)], { groups: [{ id: "g", name: "Group" }] });
    expect(sections.find((x) => x.kind === "recent")?.sessions.map((x) => x.sessionId)).toEqual(["a"]);
  });
  it("hides system sessions unless asked", () => {
    expect(idsOf(build([s("sys", { isSystem: true }), s("a")]))).toEqual(["a"]);
    expect(idsOf(build([s("sys", { isSystem: true }), s("a")], { showSystem: true })).sort()).toEqual(["a", "sys"]);
  });
  it("visibleRowIds honours collapsed sections", () => {
    const sections = build([s("a", { groupId: "g" } as any), s("b")], { groups: [{ id: "g", name: "G" }] });
    expect(visibleRowIds(sections, { "group:g": true }, 12)).toEqual(["b"]);
  });
});

describe("focusAfterChange: where keyboard focus goes when its row moves or goes away", () => {
  const before = ["a", "b", "c", "d"];
  it("stays on the same session when it only moved to another section", () => {
    expect(focusAfterChange(before, ["b", "a", "c", "d"], "a")).toBe("a");
  });
  it("goes to the row that took its place when the row is deleted", () => {
    expect(focusAfterChange(before, ["a", "c", "d"], "b")).toBe("c");
  });
  it("goes to the row before it when the deleted row was last", () => {
    expect(focusAfterChange(before, ["a", "b", "c"], "d")).toBe("c");
  });
  it("skips neighbours that also disappeared", () => {
    expect(focusAfterChange(before, ["a", "d"], "b")).toBe("d");
    expect(focusAfterChange(before, ["a"], "c")).toBe("a");
  });
  it("is null when nothing is left, and the first row when the old position is unknown", () => {
    expect(focusAfterChange(before, [], "a")).toBeNull();
    expect(focusAfterChange(before, ["x", "y"], "zzz")).toBe("x");
  });
});
