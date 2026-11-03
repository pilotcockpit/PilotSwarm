import { describe, expect, it } from "vitest";
import type { Session } from "@/data/types";
import { buildSidebarModel, DEFAULT_PROJECT_ID } from "@/data/session-tree";
import { buildProjectsPage, type PageQuery } from "./projects-model";

const s = (id: string, extra: Partial<Session> = {}): Session => ({ sessionId: id, title: id, status: "idle", updatedAt: 1, owner: "me", ...extra }) as Session;
const groups = [{ id: "g0", name: "Release" }, { id: "g1", name: "Research" }, { id: "g2", name: "Empty" }];
const base: PageQuery = { who: "all", agent: null, q: "", sort: "activity", attention: new Set(), pins: [] };
const page = (sessions: Session[], q: Partial<PageQuery> = {}) => buildProjectsPage(sessions, groups, { ...base, ...q });
const ids = (rows: Session[]) => rows.map((r) => r.sessionId);

describe("the Projects page and the sidebar agree", () => {
  const rows = [s("live", { groupId: "g0" }), s("done", { groupId: "g0", status: "completed" }), s("loose"), s("looseDone", { status: "cancelled" }), s("kid", { parentSessionId: "live" })];
  it("list the same live sessions in every project and in No project", () => {
    const model = buildSidebarModel({ sessions: rows, groups, pins: [], dismissed: new Set(), viewer: { isAdmin: false } });
    const p = page(rows);
    for (const project of model.projects.all) expect(ids(p.projects.find((x) => x.group.id === project.group.id)!.rows)).toEqual(ids(project.trees));
    expect(ids(p.rest)).toEqual(ids(model.projects.fallback!.trees));
  });
  it("keep finished sessions out of the lists, and say how many", () => {
    const p = page(rows);
    expect(p.finishedHidden).toBe(2);
    expect(ids(p.projects[0].rows)).toEqual(["live"]);
    expect(ids(p.childrenOf("live"))).toEqual(["kid"]);
  });
  it("show them when the Completed filter is on, or when searching for one", () => {
    expect(ids(page(rows, { state: "closed" }).projects[0].rows)).toEqual(["done"]);
    expect(ids(page(rows, { q: "done" }).projects[0].rows)).toEqual(["done"]);
    expect(page(rows, { state: "closed" }).finishedHidden).toBe(0);
  });
});

describe("the Projects page", () => {
  const sessions = [s("a", { groupId: "g0" }), s("b", { groupId: "g1", title: "Survey analysis" }), s("c")];
  it("lists every project, an empty one too, when nothing is filtered: this is where projects are managed", () => {
    const p = page(sessions);
    expect(p.projects.map((x) => x.group.id)).toEqual(["g0", "g1", "g2"]);
    expect(ids(p.rest)).toEqual(["c"]);
  });
  it("search finds a session by its title", () => {
    const p = page(sessions, { q: "survey" });
    expect(p.projects.map((x) => [x.group.id, ids(x.rows)])).toEqual([["g1", ["b"]]]);
    expect(p.rest).toEqual([]);
  });
  it("search finds a project by its name and shows everything in it", () => {
    const p = page([...sessions, s("d", { groupId: "g0", title: "Other" })], { q: "release" });
    expect(p.projects.map((x) => [x.group.id, ids(x.rows).sort()])).toEqual([["g0", ["a", "d"]]]);
    expect(p.matchedProjects).toBe(1);
  });
  it("a project whose name matches shows even when it holds nothing", () => {
    expect(page(sessions, { q: "empt" }).projects.map((x) => x.group.id)).toEqual(["g2"]);
  });
  it("one search can find both projects and sessions", () => {
    const p = page([s("r1", { groupId: "g1", title: "x" }), s("res", { title: "Research notes" })], { q: "research" });
    expect(p.projects.map((x) => x.group.id)).toEqual(["g1"]);
    expect(ids(p.rest)).toEqual(["res"]);
  });
  it("a filter hides projects with nothing to show, and the Default project is the sessions in none", () => {
    expect(page(sessions, { agent: "nobody" }).projects).toEqual([]);
    const p = page(sessions, { project: DEFAULT_PROJECT_ID });
    expect(ids(p.rest)).toEqual(["c"]);
    expect(p.projects.every((x) => x.rows.length === 0)).toBe(true);
  });
  it("opening one project shows it even when it is empty", () => {
    expect(page(sessions, { project: "g2" }).projects.map((x) => x.group.id)).toEqual(["g2"]);
  });
  it("reports every match, so the state counts agree with the list", () => {
    const p = page([s("a", { groupId: "g0", status: "running" }), s("b", { status: "error", error: "x" })], { q: "release" });
    expect(ids(p.matches)).toEqual(["a"]);
  });
  it("a sub-agent follows its parent's project and does not become a row of its own", () => {
    const p = page([s("root", { groupId: "g0" }), s("kid", { parentSessionId: "root" })]);
    expect(ids(p.projects[0].rows)).toEqual(["root"]);
    expect(ids(p.childrenOf("root"))).toEqual(["kid"]);
  });
  it("pins list sessions in pin order and leave them in their project", () => {
    const p = page([s("a", { groupId: "g0" }), s("b", { groupId: "g0" })], { pins: ["b", "a"] });
    expect(ids(p.pinned)).toEqual(["b", "a"]);
    expect(ids(p.projects[0].rows).sort()).toEqual(["a", "b"]);
  });
  it("a pinned sub-agent is listed under Pinned even though its parent is the row in the project", () => {
    const p = page([s("root", { groupId: "g0" }), s("kid", { parentSessionId: "root" })], { pins: ["kid"] });
    expect(ids(p.pinned)).toEqual(["kid"]);
    expect(ids(p.projects[0].rows)).toEqual(["root"]);
  });
  it("a session in a project that was deleted shows under Default", () => {
    expect(ids(page([s("x", { groupId: "gone" })]).rest)).toEqual(["x"]);
  });
});
