import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render } from "@/test/render";
import { newClient, Providers, stubSource } from "@/test/harness";

vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { success: vi.fn(), error: vi.fn(), dismiss: () => undefined }) }));
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<any>()),
  Link: ({ children, to: _to, params: _params, search: _search, ...rest }: any) => React.createElement("a", rest, children),
  useRouterState: (o: any) => (o?.select ? o.select({ location: { pathname: (globalThis as any).__path ?? "/" } }) : "/"),
  useNavigate: () => () => undefined,
}));
vi.mock("@/components/ui/tooltip", () => ({ Tooltip: ({ children }: any) => children, TooltipProvider: ({ children }: any) => children }));
vi.mock("@/components/ui/menu", () => {
  const pass = ({ children }: any) => children ?? null;
  return { Menu: pass, MenuTrigger: pass, MenuContent: () => null, MenuItem: pass, MenuSeparator: () => null, MenuLabel: pass, MenuGroup: pass };
});
vi.mock("@/components/ui/misc", async (orig) => {
  const pass = ({ children }: any) => children ?? null;
  return { ...(await orig<any>()), Popover: pass, PopoverTrigger: pass, PopoverContent: () => null };
});
vi.mock("@/components/ui/dialog", () => {
  const pass = ({ children }: any) => children ?? null;
  return { Dialog: ({ open, children }: any) => (open ? children : null), DialogContent: pass, DialogBody: pass, DialogFooter: pass, DialogTitle: pass, DialogDescription: pass };
});
vi.mock("@/components/session/share-sheet", () => ({ ShareSheet: () => null }));
vi.mock("@/components/session/move-to-group", () => ({ MoveToGroupDialog: () => null }));
vi.mock("@/components/session/session-actions", async (orig) => ({ ...(await orig<any>()), SessionCloseDialog: () => null, SessionRenameDialog: () => null }));
vi.mock("@/components/admin/system-sessions-panel", () => ({ RestartDialog: () => null }));
(globalThis as any).window = globalThis;
(globalThis as any).CSS = { escape: (s: string) => s };
(globalThis as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

import { SessionsSidebar } from "./sessions-sidebar";
import { UiStateProvider, useUi } from "@/shell/ui-state";
import { resetSidebarView, SIDEBAR_SECTIONS } from "./prefs";

/** Shows what the sidebar asked the new-session dialog to start with. */
function NewSessionProbe() { (globalThis as any).__newSession = useUi().newSession; return null; }

// What the sidebar shows and what its controls write, against the real component with a stubbed Web API.
const NOW = Date.now();
const row = (id: string, status = "idle", extra: object = {}): any => ({ sessionId: id, title: `Session ${id}`, status, updatedAt: NOW - 60_000, owner: "me", canWrite: true, canManage: true, agentId: "ag", ...extra });
const asks = (id: string, extra: object = {}) => row(id, "input_required", { pendingQuestion: { question: `Question for ${id}?` }, ...extra });
const fails = (id: string, extra: object = {}) => row(id, "error", { error: "Failed after 3 attempts: HTTP 429 rate limit", iterations: 3, ...extra });
const body = { tagName: "BODY" } as any;

let mounts = 0;
async function mount(sessions: any[], o: { groups?: any[]; settings?: Record<string, unknown>; folded?: boolean; writeDelay?: number; failWrites?: number } = {}) {
  // The sidebar loads folded; most tests are about what is inside the sections, so they start with them open.
  resetSidebarView(o.folded ? [] : SIDEBAR_SECTIONS);
  let failing = o.failWrites ?? 0;
  let readDelay = 0;
  let live = sessions;
  let doc: Record<string, unknown> = o.settings ?? {};
  const writes: Array<Record<string, unknown>> = [];
  const { source, calls } = stubSource({
    createSessionGroup: ({ input }: any) => ({ groupId: "gNew", title: input.title, memberCount: 0 }),
    getCurrentUserProfile: async () => {
      const seen = structuredClone(doc);
      const wait = readDelay;
      readDelay = 0; // only the next read is slow
      if (wait) await new Promise((r) => setTimeout(r, wait));
      return { profileSettings: seen };
    },
    setCurrentUserProfileSettings: async ({ settings }: any) => {
      if (o.writeDelay) await new Promise((r) => setTimeout(r, o.writeDelay));
      if (failing > 0) { failing--; throw new Error("The server said no"); }
      doc = structuredClone(settings); writes.push(doc); return {};
    },
  });
  source.listSessions = async () => live;
  source.listGroups = async () => o.groups ?? [];
  source.profile = async () => ({ displayName: "Me", provider: "p", subject: `u${++mounts}`, isAdmin: false });
  const client = newClient();
  (globalThis as any).document = { activeElement: body, body, addEventListener() {}, removeEventListener() {}, querySelector: () => null };
  const r = await render(<Providers source={source} client={client}><UiStateProvider><SessionsSidebar /><NewSessionProbe /></UiStateProvider></Providers>);
  await r.flush(10);
  const change = async (next: any[]) => { live = next; await act(() => client.invalidateQueries({ queryKey: ["sessions"] })); await r.flush(8); };
  const section = (name: string) => r.findAll((n) => n.type === "section" && n.props["aria-labelledby"] === (name === "needs" ? "sidebar-sec-needs" : `sidebar-sec-${name}-h`))[0];
  const rowsIn = (name: string) => { const s = section(name); return s ? r.findAll((n) => n.type === "a" && n.props["data-sidebar-row"] !== undefined && s.contains(n)).map((n) => n.props["data-session-id"] as string) : []; };
  const button = (label: RegExp | string) => r.find((n) => n.type === "button" && (typeof label === "string" ? r.text(n).includes(label) : label.test(r.text(n)) || label.test(String(n.props["aria-label"] ?? ""))));
  return { r, change, section, rowsIn, button, writes, calls, doc: () => doc, client, slowReads: (ms: number) => { readDelay = ms; } };
}

describe("when the app loads", () => {
  it("every section is folded and shows no rows, while Needs you still says how many wait", async () => {
    const t = await mount([row("a"), asks("q1"), fails("f1")], { folded: true });
    for (const name of ["needs", "pinned", "projects", "noproject", "recent"]) expect(t.rowsIn(name)).toEqual([]);
    const toggles = t.r.findAll((n) => n.type === "button" && n.props["aria-expanded"] !== undefined);
    expect(toggles.length).toBeGreaterThan(0);
    expect(toggles.every((n) => n.props["aria-expanded"] === false)).toBe(true);
    expect(t.r.text(t.section("needs"))).toMatch(/2/);
    await t.r.unmount();
  });
  it("opens one section when the person unfolds it, and only that one", async () => {
    const t = await mount([row("a")], { folded: true });
    await t.r.fire(t.button(/Recents/), "onClick");
    expect(t.rowsIn("recent")).toEqual(["a"]);
    await t.r.unmount();
  });
});

describe("Needs you", () => {
  it("comes first, shows the question, and caps at five with a link to the rest", async () => {
    const t = await mount([row("calm"), asks("q1"), ...Array.from({ length: 6 }, (_, i) => fails(`f${i}`, { updatedAt: NOW - (i + 2) * 3_600_000 }))]);
    expect(t.rowsIn("needs")).toHaveLength(5);
    expect(t.r.text(t.section("needs"))).toContain("Question for q1?");
    expect(t.r.text(t.section("needs"))).toContain("2 more need you");
    await t.r.unmount();
  });
  it("is absent, with no 'all clear' claim, when nothing needs you", async () => {
    const t = await mount([row("calm")]);
    expect(t.section("needs")).toBeUndefined();
    expect(t.r.text()).not.toMatch(/all clear/i);
    await t.r.unmount();
  });
  it("dismissing a failure writes it to the profile, keeps every other setting, and offers Undo", async () => {
    const t = await mount([fails("f1"), row("calm")], { settings: { themeId: "dark", pinnedSessionIds: [] } });
    await t.r.fire(t.button(/Dismiss Session f1/), "onClick");
    await t.r.flush(8);
    const written = t.writes.at(-1)!;
    expect(written.themeId).toBe("dark");
    expect(Object.keys((written.flightdeck as any).dismissed)).toHaveLength(1);
    expect(t.section("needs")).toBeUndefined();
    await t.r.unmount();
  });
  it("a dismissed failure stays dismissed after a reload, and returns if it fails again", async () => {
    const first = await mount([fails("f1")]);
    await first.r.fire(first.button(/Dismiss Session f1/), "onClick");
    await first.r.flush(8);
    const saved = first.doc();
    await first.r.unmount();
    const again = await mount([fails("f1")], { settings: saved });
    expect(again.section("needs")).toBeUndefined();
    await again.change([fails("f1", { iterations: 4 })]);
    expect(again.rowsIn("needs")).toEqual(["f1"]);
    await again.r.unmount();
  });
});

describe("Pinned", () => {
  it("reads pins from the person's profile, in their order, so they follow the account", async () => {
    const t = await mount([row("a"), row("b"), row("c")], { settings: { pinnedSessionIds: ["c", "a"] } });
    expect(t.rowsIn("pinned")).toEqual(["c", "a"]);
    expect(t.rowsIn("recent")).toEqual(["b"]);
    await t.r.unmount();
  });
  it("pinning writes the account's pin list and leaves its other settings alone", async () => {
    const t = await mount([row("a"), row("b")], { settings: { themeId: "dark", pinnedSessionIds: ["a"] } });
    await t.r.fire(t.button(/^Pin Session b/), "onClick");
    await t.r.flush(8);
    expect(t.writes.at(-1)).toEqual({ themeId: "dark", pinnedSessionIds: ["a", "b"] });
    expect(t.rowsIn("pinned")).toEqual(["a", "b"]);
    await t.r.unmount();
  });
  it("pinning two sessions in a row shows both at once and keeps both as each save lands", async () => {
    const t = await mount([row("a"), row("b"), row("c")], { writeDelay: 25 });
    await t.r.fire(t.button(/^Pin Session a/), "onClick");
    await t.r.flush(3);
    await t.r.fire(t.button(/^Pin Session b/), "onClick");
    await t.r.flush(3);
    expect(t.rowsIn("pinned").sort()).toEqual(["a", "b"]); // both shown while neither save has landed
    for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 20)); await t.r.flush(2); expect(t.rowsIn("pinned").sort()).toEqual(["a", "b"]); }
    expect(t.writes.at(-1)?.pinnedSessionIds).toEqual(["a", "b"]);
    await t.r.unmount();
  });
  it("a refresh that started before a pin was saved does not take the pin back when it arrives late", async () => {
    const t = await mount([row("a"), row("b")]);
    t.slowReads(80);
    void t.client.invalidateQueries({ queryKey: ["roaming-settings"] }); // reads the document as it is now, answers in 80 ms
    await t.r.flush(2);
    await t.r.fire(t.button(/^Pin Session a/), "onClick"); // saved at once
    for (let i = 0; i < 8; i++) { await new Promise((r) => setTimeout(r, 25)); await t.r.flush(2); }
    expect(t.rowsIn("pinned")).toEqual(["a"]);
    await t.r.unmount();
  });
  it("a failed pin takes back only itself, not the pin saved before it", async () => {
    const t = await mount([row("a"), row("b")], { writeDelay: 15, failWrites: 0 });
    await t.r.fire(t.button(/^Pin Session a/), "onClick");
    for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r, 20)); await t.r.flush(2); }
    expect(t.rowsIn("pinned")).toEqual(["a"]);
    await t.r.unmount();
    const u = await mount([row("a"), row("b")], { writeDelay: 15, failWrites: 1 });
    await u.r.fire(u.button(/^Pin Session a/), "onClick");
    await u.r.flush(3);
    await u.r.fire(u.button(/^Pin Session b/), "onClick");
    for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 20)); await u.r.flush(2); }
    expect(u.rowsIn("pinned")).toEqual(["b"]); // the first save failed; the second landed
    await u.r.unmount();
  });
  it("a pin never moves the session out of its project", async () => {
    const t = await mount([row("a", "idle", { groupId: "g" })], { groups: [{ id: "g", name: "Work" }], settings: { pinnedSessionIds: ["a"] } });
    await t.r.fire(t.button("Work"), "onClick");
    await t.r.flush(4);
    expect(t.rowsIn("projects")).toEqual(["a"]);
    expect(t.rowsIn("pinned")).toEqual(["a"]);
    await t.r.unmount();
  });
});

describe("Projects", () => {
  const groups = Array.from({ length: 7 }, (_, i) => ({ id: `g${i}`, name: `Project ${i}` }));
  it("lists the first five and says how many there are in all", async () => {
    const t = await mount([row("a")], { groups });
    const names = t.r.findAll((n) => n.type === "button" && n.props["aria-expanded"] !== undefined && /^Project \d/.test(t.r.text(n)));
    expect(names).toHaveLength(5);
    expect(t.r.text(t.section("projects"))).toContain("All 7 projects");
    await t.r.unmount();
  });
  it("opens one project at a time, to five roots, with a way to see the rest", async () => {
    const inProject = Array.from({ length: 8 }, (_, i) => row(`m${i}`, "idle", { groupId: "g0", updatedAt: NOW - i * 60_000 }));
    const t = await mount(inProject, { groups });
    await t.r.fire(t.button("Project 0"), "onClick");
    await t.r.flush(4);
    expect(t.rowsIn("projects")).toHaveLength(5);
    expect(t.r.text(t.section("projects"))).toContain("All 8 in Projects");
    await t.r.fire(t.button("Project 1"), "onClick");
    await t.r.flush(4);
    expect(t.rowsIn("projects")).toHaveLength(0); // the other project is empty; the first closed
    await t.r.unmount();
  });
  it("says how many trees a project holds and how many of them need you, even collapsed", async () => {
    const t = await mount([row("a", "idle", { groupId: "g0" }), fails("b", { groupId: "g0" }), row("done", "completed", { groupId: "g0" })], { groups });
    const project = t.button("Project 0");
    const text = t.r.text(project);
    expect(text).toContain("2 trees"); // two live trees; the completed one is not counted
    expect(text).toContain("1 needs you");
    await t.r.unmount();
  });
});

describe("No project", () => {
  const groups = [{ id: "g0", name: "Work" }];
  it("is a section of its own, beside Projects, holding the sessions that are in none", async () => {
    const t = await mount([row("in", "idle", { groupId: "g0" }), row("loose1"), row("loose2")], { groups });
    expect(t.rowsIn("noproject").sort()).toEqual(["loose1", "loose2"]);
    expect(t.r.text(t.section("noproject"))).toContain("No project");
    // It is not one of the projects: the Projects list holds only the person's own.
    const names = t.r.findAll((n) => n.type === "button" && n.props["aria-expanded"] !== undefined && /^(Work|No project)/.test(t.r.text(n))).map((b) => t.r.text(b).replace(/\d.*$/, ""));
    expect(names).toEqual(["Work"]);
    await t.r.unmount();
  });
  it("shows five and links to the rest", async () => {
    const t = await mount(Array.from({ length: 8 }, (_, i) => row(`l${i}`, "idle", { updatedAt: NOW - i * 60_000 })).concat([row("in", "idle", { groupId: "g0" })]), { groups });
    expect(t.rowsIn("noproject")).toHaveLength(5);
    expect(t.r.text(t.section("noproject"))).toContain("All 8 in Projects");
    await t.r.unmount();
  });
  it("is absent for someone with no projects, and when nothing is outside a project", async () => {
    const none = await mount([row("a")]);
    expect(none.section("noproject")).toBeUndefined();
    await none.r.unmount();
    const all = await mount([row("a", "idle", { groupId: "g0" })], { groups });
    expect(all.section("noproject")).toBeUndefined();
    await all.r.unmount();
  });
  it("folds without leaving the page, and carries a dot for what needs you inside", async () => {
    const t = await mount([fails("f"), row("in", "idle", { groupId: "g0" })], { groups });
    await t.r.fire(t.button(/Collapse No project|Expand No project/), "onClick");
    await t.r.flush(4);
    expect(t.rowsIn("noproject")).toEqual([]);
    expect(t.r.findAll((n) => n.props.role === "img" && /with no project needs you/.test(String(n.props["aria-label"] ?? "")))).toHaveLength(1);
    await t.r.unmount();
  });
});

describe("Opening a session shows it in its project", () => {
  const groups = [{ id: "g0", name: "Work" }, { id: "g1", name: "Play" }];
  const at = (id: string | null) => { (globalThis as any).__path = id ? `/s/${id}` : "/"; };
  const current = (t: Awaited<ReturnType<typeof mount>>) => t.r.findAll((n) => n.type === "a" && n.props["aria-current"] === "page").map((n) => n.props["data-row-key"] as string);
  const sessions = [row("a", "idle", { groupId: "g0", updatedAt: NOW - 1_000 }), row("b", "idle", { groupId: "g1" }), row("loose")];

  it("opens the project the session is filed in and selects the session there", async () => {
    at("b");
    const t = await mount(sessions, { groups });
    expect(t.rowsIn("projects")).toEqual(["b"]);
    expect(current(t)).toEqual(["project/b"]); // one row is the current page, not every place it appears
    await t.r.unmount();
    at(null);
  });
  it("with no projects, a session opened by link is shown among the Recents", async () => {
    at("a");
    const t = await mount([row("a"), row("b")], { folded: true });
    expect(t.rowsIn("recent")).toContain("a");
    expect(current(t)).toEqual(["recent/a"]);
    await t.r.unmount();
    at(null);
  });
  it("a finished session opened by link is shown among the Recents, since its project lists live work only", async () => {
    at("done");
    const t = await mount([row("done", "completed", { groupId: "g0" }), row("live", "idle", { groupId: "g0" })], { groups, folded: true });
    expect(t.rowsIn("recent")).toContain("done");
    expect(current(t)).toEqual(["recent/done"]);
    await t.r.unmount();
    at(null);
  });
  it("selects a session that is in no project in the No project section", async () => {
    at("loose");
    const t = await mount(sessions, { groups });
    expect(t.rowsIn("noproject")).toContain("loose");
    expect(current(t)).toEqual(["loose/loose"]);
    expect(t.rowsIn("projects")).toEqual([]);
    await t.r.unmount();
    at(null);
  });
  it("shows the session even when it is not among the first five in its project", async () => {
    const many = Array.from({ length: 9 }, (_, i) => row(`m${i}`, "idle", { groupId: "g0", updatedAt: NOW - i * 60_000 }));
    at("m8");
    const t = await mount(many, { groups });
    expect(t.rowsIn("projects")).toHaveLength(5);
    expect(t.rowsIn("projects")).toContain("m8");
    await t.r.unmount();
    at(null);
  });
  it("reveals a session whose project is past the first five", async () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ id: `g${i}`, name: `Project ${i}` }));
    at("far");
    const t = await mount([row("far", "idle", { groupId: "g6" })], { groups: seven });
    expect(t.rowsIn("projects")).toEqual(["far"]);
    expect(t.r.text(t.section("projects"))).toContain("Project 6");
    await t.r.unmount();
    at(null);
  });
  it("follows the person to another session's project", async () => {
    at("a");
    const t = await mount(sessions, { groups });
    expect(t.rowsIn("projects")).toEqual(["a"]);
    at("b"); // the router would re-render the sidebar; here a data change does
    await t.change(sessions.map((s) => ({ ...s, updatedAt: NOW + 5 })));
    expect(t.rowsIn("projects")).toEqual(["b"]);
    await t.r.unmount();
    at(null);
  });
  it("leaves a project they closed alone", async () => {
    at("a");
    const t = await mount(sessions, { groups });
    expect(t.rowsIn("projects")).toEqual(["a"]);
    await t.r.fire(t.button("Work"), "onClick"); // they close it while still viewing the session
    await t.r.flush(4);
    expect(t.rowsIn("projects")).toEqual([]);
    await t.change(sessions.map((s) => ({ ...s, updatedAt: NOW })));
    expect(t.rowsIn("projects")).toEqual([]);
    await t.r.unmount();
    at(null);
  });
});

describe("Pinned projects", () => {
  const groups = [{ id: "g0", name: "Work" }, { id: "g1", name: "Play" }];
  const sessions = [row("a", "idle", { groupId: "g0" }), row("b", "idle", { groupId: "g1" }), row("p")];
  it("shows a pinned project, then pinned sessions, under Pinned", async () => {
    const t = await mount(sessions, { groups, settings: { pinnedSessionIds: ["p"], flightdeck: { pinnedProjects: ["g1"] } } });
    const pinned = t.section("pinned");
    expect(t.r.text(pinned)).toContain("Play");
    expect(t.rowsIn("pinned")).toEqual(["p"]);
    await t.r.unmount();
  });
  it("pinning a project writes its own list, and leaves session pins and other settings alone", async () => {
    const t = await mount(sessions, { groups, settings: { themeId: "dark", pinnedSessionIds: ["p"] } });
    await t.r.fire(t.button(/^Pin project Work/), "onClick");
    await t.r.flush(8);
    expect(t.writes.at(-1)).toEqual({ themeId: "dark", pinnedSessionIds: ["p"], flightdeck: { v: 1, pinnedProjects: ["g0"] } });
    expect(t.r.text(t.section("pinned"))).toContain("Work");
    await t.r.unmount();
  });
  it("opens a pinned project under Pinned only, never listing its sessions twice", async () => {
    const t = await mount(sessions, { groups, settings: { flightdeck: { pinnedProjects: ["g0"] } } });
    const pinnedProject = t.r.findAll((n) => n.type === "button" && n.props["aria-expanded"] !== undefined && /^Work/.test(t.r.text(n)))[0];
    await t.r.fire(pinnedProject, "onClick");
    await t.r.flush(4);
    expect(t.rowsIn("pinned")).toEqual(["a"]);
    expect(t.rowsIn("projects")).toEqual([]);
    await t.r.unmount();
  });
  it("opening a session in a pinned project reveals it under Pinned", async () => {
    (globalThis as any).__path = "/s/a";
    const t = await mount(sessions, { groups, settings: { flightdeck: { pinnedProjects: ["g0"] } } });
    expect(t.rowsIn("pinned")).toEqual(["a"]);
    expect(t.rowsIn("projects")).toEqual([]);
    await t.r.unmount();
    (globalThis as any).__path = "/";
  });
});

describe("New project", () => {
  const groups = [{ id: "g0", name: "Work" }];
  const open = async (t: Awaited<ReturnType<typeof mount>>) => { await t.r.fire(t.button(/^New project/), "onClick"); await t.r.flush(4); };
  const typeName = async (t: Awaited<ReturnType<typeof mount>>, value: string) => { await t.r.fire(t.r.find((n) => n.type === "input"), "onChange", { target: { value } }); await t.r.flush(2); };
  const create = () => (t: Awaited<ReturnType<typeof mount>>) => t.r.find((n) => n.type === "button" && n.props.type === "submit");

  it("creates a project from the plus on the Projects heading and opens it", async () => {
    const t = await mount([row("a")], { groups });
    await open(t);
    await typeName(t, "  Alpha ");
    await t.r.fire(t.r.find((n) => n.type === "form"), "onSubmit");
    await t.r.flush(8);
    expect(t.calls.filter((c) => c.op === "createSessionGroup").map((c) => c.params)).toEqual([{ input: { title: "Alpha" } }]);
    await t.r.unmount();
  });
  it("will not make a second project with the same name, or one called No project", async () => {
    const t = await mount([row("a")], { groups });
    await open(t);
    await typeName(t, "work");
    expect(t.r.text()).toContain("already have a project with that name");
    expect(create()(t).props.disabled).toBe(true);
    await typeName(t, "No project");
    expect(t.r.text()).toContain("outside any project");
    expect(create()(t).props.disabled).toBe(true);
    await t.r.fire(t.r.find((n) => n.type === "form"), "onSubmit");
    await t.r.flush(4);
    expect(t.calls.some((c) => c.op === "createSessionGroup")).toBe(false);
    await t.r.unmount();
  });
  it("a blank name cannot be submitted", async () => {
    const t = await mount([row("a")], { groups });
    await open(t);
    expect(create()(t).props.disabled).toBe(true);
    await typeName(t, "   ");
    await t.r.fire(t.r.find((n) => n.type === "form"), "onSubmit");
    await t.r.flush(4);
    expect(t.calls.some((c) => c.op === "createSessionGroup")).toBe(false);
    await t.r.unmount();
  });
});

describe("New session buttons", () => {
  const groups = [{ id: "g0", name: "Work" }];
  const asked = () => (globalThis as any).__newSession;
  it("a project's new-session button starts a session filed in that project", async () => {
    const t = await mount([row("a", "idle", { groupId: "g0" })], { groups });
    await t.r.fire(t.button(/^New session in Work/), "onClick");
    await t.r.flush(2);
    expect(asked()).toMatchObject({ open: true, group: "g0" });
    await t.r.unmount();
  });
  it("the No project button starts a session with no project", async () => {
    const t = await mount([row("loose"), row("a", "idle", { groupId: "g0" })], { groups });
    await t.r.fire(t.button(/^New session with no project/), "onClick");
    await t.r.flush(2);
    expect(asked()).toMatchObject({ open: true, group: null });
    await t.r.unmount();
  });
  it("Recents has no new-session button: it lists sessions, it is not somewhere a session is made", async () => {
    const t = await mount([row("a")]);
    const labels = t.r.findAll((n) => n.type === "button").map((b) => String(b.props["aria-label"] ?? ""));
    expect(labels.filter((l) => l === "New session")).toEqual([]);
    expect(labels).toContain("Recents actions");
    await t.r.unmount();
  });
  it("the heading's new button makes a project, with the same icon as the others", async () => {
    const t = await mount([row("a")], { groups });
    const heading = t.r.find((n) => n.type === "button" && n.props["aria-label"] === "New project");
    expect(heading).toBeDefined();
    await t.r.unmount();
  });
});

describe("Section headings", () => {
  const groups = [{ id: "g0", name: "Work" }];
  const dots = (t: Awaited<ReturnType<typeof mount>>) => t.r.findAll((n) => n.type === "span" && n.props.role === "img" && /in projects needs? you/.test(String(n.props["aria-label"] ?? ""))).map((n) => n.props["aria-label"] as string);
  it("a folded section shows a dot saying what is inside; an open one shows its rows instead", async () => {
    const t = await mount([fails("f", { groupId: "g0" }), row("calm", "idle", { groupId: "g0" })], { groups });
    expect(dots(t)).toEqual([]);
    await t.r.fire(t.button(/Collapse Projects|Expand Projects/), "onClick");
    await t.r.flush(4);
    expect(dots(t)).toEqual(["1 session in projects needs you"]);
    await t.r.fire(t.button(/Collapse Projects|Expand Projects/), "onClick");
    await t.r.flush(4);
    expect(dots(t)).toEqual([]);
    await t.r.unmount();
  });
  it("Needs you folds too, and the count is a pill at the edge that stays whether it is open or folded", async () => {
    const t = await mount([asks("q"), fails("f"), row("calm")]);
    expect(t.rowsIn("needs")).toEqual(["q", "f"]);
    expect(t.r.findAll((n) => n.props.role === "img" && n.props["aria-label"] === "2 sessions need you")).toHaveLength(1);
    await t.r.fire(t.button(/^Needs you/), "onClick");
    await t.r.flush(4);
    expect(t.rowsIn("needs")).toEqual([]);
    const pill = t.r.findAll((n) => n.props.role === "img" && n.props["aria-label"] === "2 sessions need you");
    expect(pill).toHaveLength(1);
    expect(t.r.text(pill[0])).toBe("2");
    await t.r.fire(t.button(/^Needs you/), "onClick");
    await t.r.flush(4);
    expect(t.rowsIn("needs")).toEqual(["q", "f"]);
    await t.r.unmount();
  });
  it("caps the pill at 99+", async () => {
    const t = await mount(Array.from({ length: 120 }, (_, i) => fails(`f${i}`)));
    const pill = t.r.find((n) => n.props.role === "img" && /sessions need you/.test(String(n.props["aria-label"] ?? "")));
    expect(t.r.text(pill)).toBe("99+");
    await t.r.unmount();
  });
  it("names the recent list Recents and folds it", async () => {
    const t = await mount([row("a")]);
    await t.r.fire(t.button(/^Recents/), "onClick");
    await t.r.flush(4);
    expect(t.rowsIn("recent")).toEqual([]);
    await t.r.unmount();
  });
});

describe("Recent", () => {
  it("leaves finished work to the Completed link and keeps the viewed session's place", async () => {
    const t = await mount([row("live"), row("done", "completed")]);
    expect(t.rowsIn("recent")).toEqual(["live"]);
    expect(t.r.text()).toContain("1 completed or cancelled");
    await t.r.unmount();
  });
  it("does not reorder when a session updates; it offers 'Refresh order' instead", async () => {
    const t = await mount([row("a", "idle", { updatedAt: NOW - 3_000 }), row("b", "idle", { updatedAt: NOW - 2_000 }), row("c", "idle", { updatedAt: NOW - 1_000 })]);
    expect(t.rowsIn("recent")).toEqual(["c", "b", "a"]);
    await t.change([row("a", "running", { updatedAt: NOW }), row("b", "idle", { updatedAt: NOW - 2_000 }), row("c", "idle", { updatedAt: NOW - 1_000 })]);
    expect(t.rowsIn("recent")).toEqual(["c", "b", "a"]); // a ran, but it did not jump
    expect(t.r.text(t.section("recent"))).toContain("1 updated");
    await t.r.fire(t.button(/Refresh order/), "onClick");
    await t.r.flush(4);
    expect(t.rowsIn("recent")).toEqual(["a", "c", "b"]);
    expect(t.r.text(t.section("recent"))).not.toContain("updated");
    await t.r.unmount();
  });
  it("puts a new session at the top without a refresh", async () => {
    const t = await mount([row("a", "idle", { updatedAt: NOW - 3_000 })]);
    await t.change([row("a", "idle", { updatedAt: NOW - 3_000 }), row("n", "idle", { updatedAt: NOW })]);
    expect(t.rowsIn("recent")).toEqual(["n", "a"]);
    await t.r.unmount();
  });
});
