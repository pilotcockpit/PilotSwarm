import { describe, expect, it } from "vitest";
import type { Session } from "@/data/types";
import { describeError, sessionState } from "@/data/state";
import { attentionItems, attentionOf, buildIndex, holdReason, rollup } from "./derive";
import { buildSidebarModel, DEFAULT_PROJECT_ID, inSettledOrder, NEEDS_CAP, settleOrder } from "./model";
import { focusAfterChange, isRoot } from "./focus";

const s = (id: string, extra: Partial<Session> = {}): Session => ({ sessionId: id, title: id, status: "idle", updatedAt: 1_000, owner: "me", ...extra }) as Session;
const viewer = { isAdmin: false };
const build = (sessions: Session[], o: Partial<Parameters<typeof buildSidebarModel>[0]> = {}) =>
  buildSidebarModel({ sessions, groups: [], pins: [], dismissed: new Set(), viewer, ...o });
const asks = (id: string, extra: Partial<Session> = {}) => s(id, { status: "input_required", pendingQuestion: { question: "Roll back?" }, ...extra });
const fails = (id: string, extra: Partial<Session> = {}) => s(id, { status: "error", error: "Failed after 3 attempts: HTTP 429 rate limit", iterations: 3, ...extra });

describe("state: pending", () => {
  it("a session queued for a worker reads as running, not idle", () => {
    expect(sessionState(s("a", { status: "pending" })).key).toBe("running");
  });
});

describe("Needs you", () => {
  it("lists questions first, then holds, then failures, longest wait first within each", () => {
    const hold = s("h", { status: "waiting", pauseState: { kind: "allowance", provider: "p", period: "month" }, updatedAt: 2_000 });
    const m = build([fails("f2", { updatedAt: 2_000 }), fails("f1", { updatedAt: 1_000 }), hold, asks("q", { updatedAt: 9_000 }), s("idle")]);
    expect(m.needs.all.map((a) => [a.sessionId, a.kind])).toEqual([["q", "question"], ["h", "hold"], ["f1", "failed"], ["f2", "failed"]]);
  });
  it("a question is never pushed behind failures by the display cap", () => {
    const m = build([...Array.from({ length: 8 }, (_, i) => fails(`f${i}`, { updatedAt: i + 1 })), asks("q", { updatedAt: 99_000 })]);
    expect(m.needs.shown[0].sessionId).toBe("q");
  });
  it("shows the question as the reason, from the list row's waitReason when the full question is not loaded", () => {
    const row = s("q", { status: "input_required", waitReason: "Which region should I deploy to?" });
    expect(attentionOf(row, buildIndex([row]), viewer)?.reason).toBe("Which region should I deploy to?");
  });
  it("only counts the viewer's own sessions: an admin never sees someone else's failure", () => {
    const m = build([fails("mine"), fails("theirs", { owner: "Riya Kapoor" })], { viewer: { isAdmin: true } });
    expect(m.needs.all.map((a) => a.sessionId)).toEqual(["mine"]);
  });
  it("leaves system sessions to the admin pages", () => {
    expect(build([fails("sys", { isSystem: true })]).needs.all).toEqual([]);
  });
  it("a hold appears only when the viewer can lift it", () => {
    const held = s("h", { status: "waiting", pauseState: { kind: "hold", provider: "anthropic", resetsAtUtc: null } });
    expect(build([held]).needs.all).toEqual([]);
    expect(build([held], { viewer: { isAdmin: true } }).needs.all.map((a) => a.kind)).toEqual(["hold"]);
    const allowance = s("a", { status: "waiting", pauseState: { kind: "allowance", provider: "anthropic", period: "month" } });
    expect(build([allowance]).needs.all.map((a) => a.kind)).toEqual(["hold"]);
  });
  it("a failed child of a healthy parent surfaces with the path to it", () => {
    const m = build([s("root", { title: "Release build", status: "running" }), s("mid", { title: "Research", parentSessionId: "root", status: "running" }), fails("kid", { title: "Child", parentSessionId: "mid" })]);
    expect(m.needs.all).toHaveLength(1);
    expect(m.needs.all[0]).toMatchObject({ sessionId: "kid", rootId: "root", path: ["Release build", "Research"] });
  });
  it("is capped for display, with the rest counted and still in the complete list", () => {
    const many = Array.from({ length: 9 }, (_, i) => fails(`f${i}`, { updatedAt: i + 1 }));
    const m = build(many);
    expect(m.needs.shown).toHaveLength(NEEDS_CAP);
    expect(m.needs.hidden).toBe(4);
    expect(m.needs.all).toHaveLength(9);
  });
  it("a dismissed failure stays out until it fails again, a question cannot be dismissed", () => {
    const f = fails("f");
    const key = attentionOf(f, buildIndex([f]), viewer)!.key;
    expect(build([f], { dismissed: new Set([key]) }).needs.all).toEqual([]);
    expect(build([fails("f", { iterations: 4 })], { dismissed: new Set([key]) }).needs.all).toHaveLength(1);
    const q = asks("q");
    const qkey = attentionOf(q, buildIndex([q]), viewer)!.key;
    expect(build([q], { dismissed: new Set([qkey]) }).needs.all).toHaveLength(1);
  });
  it("two failures with the same wording but different ids share one key shape, a different error does not", () => {
    const a = failure("HTTP 429 after 3 attempts, request 1a2b3c4d5e6f");
    const b = failure("HTTP 429 after 5 attempts, request 9f8e7d6c5b4a");
    expect(a).toBe(b);
    expect(failure("HTTP 500 internal")).not.toBe(a);
    function failure(error: string) { const x = fails("x", { error }); return attentionOf(x, buildIndex([x]), viewer)!.key; }
  });
});

describe("what a row says about a failure or a hold", () => {
  it("a rate limit that says 'limit exceeded' is a rate limit, not a spent budget", () => {
    expect(describeError("registry returned HTTP 429, rate limit exceeded for ghcr.io").code).toBe("rate-limit");
    expect(describeError("Provider token limit exceeded for this month").code).toBe("usage-limit");
  });
  it("names the hold and when it lifts", () => {
    const at = new Date(Date.now() + 3_600_000).toISOString();
    expect(holdReason(s("h", { pauseState: { kind: "hold", provider: "anthropic", resetsAtUtc: at } }))).toMatch(/^anthropic on hold · resumes \d\d:\d\d$/);
    expect(holdReason(s("h", { pauseState: { kind: "hold", provider: "anthropic" } }))).toBe("anthropic on hold · until someone lifts it");
    expect(holdReason(s("h", { pauseState: { kind: "allowance", provider: "anthropic", period: "month" } }))).toBe("Your month allowance on anthropic is used · until someone lifts it");
    expect(holdReason(s("h", { pauseState: { kind: "no_provider" } }))).toBe("No provider you can use for its model");
  });
});

describe("Pinned, Recent and the rest", () => {
  it("keeps pins in the order the person set and never moves a session out of a project", () => {
    const m = build([s("a", { groupId: "g" }), s("b")], { pins: ["b", "a"], groups: [{ id: "g", name: "G" }] });
    expect(m.pinned.map((x) => x.sessionId)).toEqual(["b", "a"]);
    expect(m.projects.all[0].trees.map((x) => x.sessionId)).toEqual(["a"]);
  });
  it("ignores a pin for a session that no longer exists", () => {
    expect(build([s("a")], { pins: ["gone", "a"] }).pinned.map((x) => x.sessionId)).toEqual(["a"]);
  });
  it("Recent leaves out what Pinned and Needs you already show, and finished work", () => {
    const m = build([s("p"), asks("q"), s("r", { updatedAt: 5_000 }), s("done", { status: "completed" })], { pins: ["p"] });
    expect(m.recent.map((x) => x.sessionId)).toEqual(["r"]);
    expect(m.completed).toBe(1);
  });
  it("a needs-you session beyond the display cap stays in Recent so it can still be reached", () => {
    const many = Array.from({ length: NEEDS_CAP + 1 }, (_, i) => fails(`f${i}`, { updatedAt: i + 1 }));
    expect(build(many).recent.map((x) => x.sessionId)).toEqual([`f${NEEDS_CAP}`]);
  });
  it("lists sub-agents only under their parent; an orphan whose parent is not loaded is a root", () => {
    const m = build([s("p"), s("c", { parentSessionId: "p" }), s("o", { parentSessionId: "gone" })]);
    expect(m.recent.map((x) => x.sessionId).sort()).toEqual(["o", "p"]);
    expect(isRoot(s("c", { parentSessionId: "p" }), new Set(["p", "c"]))).toBe(false);
  });
  it("counts what is live, so projects plus unfiled can be reconciled with the total", () => {
    const m = build([s("a", { groupId: "g" }), s("b"), s("c", { status: "completed", groupId: "g" })], { groups: [{ id: "g", name: "G" }] });
    expect(m.total).toBe(2);
    expect(m.projects.all[0].trees).toHaveLength(1);
    expect(m.completed).toBe(1);
  });
});

describe("Pinned projects", () => {
  const groups = [{ id: "g0", name: "Work" }, { id: "g1", name: "Play" }];
  it("lists pinned projects in the order they were pinned", () => {
    const m = build([s("a", { groupId: "g0" }), s("loose")], { groups, pinnedProjects: ["g1", "g0"] });
    expect(m.pinnedProjects.map((p) => p.group.id)).toEqual(["g1", "g0"]);
  });
  it("does not pin No project: it is a section of its own, not a project", () => {
    expect(build([s("loose")], { groups, pinnedProjects: [DEFAULT_PROJECT_ID, "g0"] }).pinnedProjects.map((p) => p.group.id)).toEqual(["g0"]);
  });
  it("drops a pinned project that no longer exists", () => {
    expect(build([s("a")], { groups, pinnedProjects: ["gone", "g0"] }).pinnedProjects.map((p) => p.group.id)).toEqual(["g0"]);
  });
  it("pinning a project does not move it or its sessions anywhere", () => {
    const m = build([s("a", { groupId: "g0" })], { groups, pinnedProjects: ["g0"] });
    expect(m.projects.all.map((p) => p.group.id)).toEqual(["g0", "g1"]);
    expect(m.projects.all[0].trees.map((x) => x.sessionId)).toEqual(["a"]);
  });
});

describe("Projects", () => {
  const groups = Array.from({ length: 7 }, (_, i) => ({ id: `g${i}`, name: `Project ${i}` }));
  it("shows the first five and says how many more there are", () => {
    const m = build([], { groups });
    expect(m.projects.shown).toHaveLength(5);
    expect(m.projects.hidden).toBe(2);
  });
  it("lists the open project even when it is past the first five, so what was just opened or made is never hidden", () => {
    const m = build([], { groups, keep: ["g6"] });
    expect(m.projects.shown.map((p) => p.group.id)).toEqual(["g0", "g1", "g2", "g3", "g4", "g6"]);
    expect(m.projects.hidden).toBe(1);
  });
  it("counts trees, and an attention chip covers the whole tree even when the project is collapsed", () => {
    const m = build([s("root", { groupId: "g0", status: "running" }), fails("kid", { parentSessionId: "root" }), s("calm", { groupId: "g0" })], { groups });
    expect(m.projects.all[0].trees.map((x) => x.sessionId).sort()).toEqual(["calm", "root"]);
    expect(m.projects.all[0].attention).toBe(1);
  });
  it("a project with nothing live reads as zero trees, never as the wrong number", () => {
    expect(build([s("x", { groupId: "g1", status: "completed" })], { groups }).projects.all[1].trees).toEqual([]);
  });
});

describe("Default project", () => {
  const groups = [{ id: "g0", name: "Work" }];
  it("holds every live root that is in no project, including one in a project that no longer exists", () => {
    const m = build([s("in", { groupId: "g0" }), s("loose"), s("orphaned", { groupId: "deleted" }), s("done", { status: "completed" })], { groups });
    expect(m.projects.fallback?.trees.map((x) => x.sessionId).sort()).toEqual(["loose", "orphaned"]);
    expect(m.projects.fallback?.group.id).toBe(DEFAULT_PROJECT_ID);
    expect(m.projects.all.map((p) => p.group.id)).toEqual(["g0"]); // it is not one of the person's own projects
  });
  it("carries the attention chip for unfiled sessions that need you", () => {
    expect(build([fails("f"), s("in", { groupId: "g0" })], { groups }).projects.fallback?.attention).toBe(1);
  });
  it("does not exist until the person has a project, so people who never file see nothing new", () => {
    expect(build([s("a")]).projects.fallback).toBeNull();
  });
  it("every live root is in exactly one project or in Default", () => {
    const rows = [s("a", { groupId: "g0" }), s("b"), s("c", { groupId: "gone" })];
    const m = build(rows, { groups });
    const homes = [...m.projects.all, m.projects.fallback!].flatMap((p) => p.trees.map((x) => x.sessionId));
    expect(homes.sort()).toEqual(["a", "b", "c"]);
  });
});

describe("roll-up", () => {
  it("counts what is running, asking and failed under a session", () => {
    const ix = buildIndex([s("p", { status: "waiting" }), s("a", { parentSessionId: "p", status: "running" }), asks("b", { parentSessionId: "p" }), fails("c", { parentSessionId: "p" }), s("d", { parentSessionId: "c", status: "running" })]);
    expect(rollup(ix, "p")).toEqual({ total: 4, running: 2, needs: 1, failed: 1 });
  });
  it("survives a parent loop in bad data", () => {
    const ix = buildIndex([s("a", { parentSessionId: "b" }), s("b", { parentSessionId: "a" })]);
    expect(rollup(ix, "a").total).toBeLessThan(5);
    expect(ix.ancestorsOf("a").length).toBeLessThan(9);
  });
});

describe("settled order", () => {
  const live = (...ids: string[]) => ids.map((id) => s(id));
  it("a first draw takes the live order", () => {
    expect(settleOrder(null, live("a", "b", "c")).settled.ids).toEqual(["a", "b", "c"]);
  });
  it("an update does not move a row; it is counted so the person can re-sort", () => {
    const first = settleOrder(null, live("a", "b", "c")).settled;
    const next = settleOrder(first, live("c", "a", "b"));
    expect(next.settled.ids).toEqual(["a", "b", "c"]);
    expect(next.pending).toBe(1);
    expect(settleOrder(next.settled, live("c", "a", "b"), true).settled.ids).toEqual(["c", "a", "b"]);
  });
  it("a new session goes to the top and a departed one drops out", () => {
    const first = settleOrder(null, live("a", "b")).settled;
    const next = settleOrder(first, live("n", "b"));
    expect(next.settled.ids).toEqual(["n", "b"]);
    expect(next.pending).toBe(0);
  });
  it("draws rows in the settled order", () => {
    expect(inSettledOrder({ ids: ["a", "b", "c"] }, live("c", "a", "b")).map((x) => x.sessionId)).toEqual(["a", "b", "c"]);
  });
});

describe("keyboard focus after a change", () => {
  it("follows the session if it moved, else the neighbour", () => {
    expect(focusAfterChange(["a", "b", "c"], ["b", "a", "c"], "a")).toBe("a");
    expect(focusAfterChange(["a", "b", "c"], ["a", "c"], "b")).toBe("c");
    expect(focusAfterChange(["a", "b", "c"], ["a", "b"], "c")).toBe("b");
    expect(focusAfterChange(["a"], [], "a")).toBeNull();
  });
});

describe("attentionItems", () => {
  it("is the same list the sidebar shows (one derivation)", () => {
    const rows = [asks("q"), fails("f"), s("i")];
    const ix = buildIndex(rows);
    expect(attentionItems(ix, rows, viewer, new Set()).map((a) => a.sessionId)).toEqual(build(rows).needs.all.map((a) => a.sessionId));
  });
});
