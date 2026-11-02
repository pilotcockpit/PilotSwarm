import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { newClient, Providers, stubSource } from "@/test/harness";

// The Projects page drawn for real, with the pieces the test renderer cannot draw (menus, dialogs, tooltips, the router)
// stood in for. What is checked is what a person reads: which projects and sessions are listed, and what search leaves.
const search: Record<string, unknown> = {};
vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { success: vi.fn(), error: vi.fn(), dismiss: () => undefined }) }));
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<any>()),
  getRouteApi: () => ({ useSearch: () => search, useNavigate: () => () => undefined }),
  Link: ({ children, to: _to, params: _params, search: _search, ...rest }: any) => React.createElement("a", rest, children),
  useRouterState: () => "/projects",
  useNavigate: () => () => undefined,
}));
vi.mock("@/router", () => ({ STATE_FILTERS: ["any", "attention", "running", "needs", "waiting", "scheduled", "failed", "idle", "closed"] }));
vi.mock("@/shell/AppShell", () => ({ TopBar: ({ crumbs }: any) => <h1>{crumbs[0].label}</h1> }));
vi.mock("@/components/ui/tooltip", () => ({ Tooltip: ({ children }: any) => children, TooltipProvider: ({ children }: any) => children }));
vi.mock("@/components/ui/menu", () => {
  const pass = ({ children }: any) => children ?? null;
  return { Menu: pass, MenuTrigger: pass, MenuContent: () => null, MenuItem: pass, MenuSeparator: () => null, MenuLabel: pass, MenuGroup: pass, MenuRadioGroup: pass, MenuRadioItem: pass };
});
vi.mock("@/components/ui/dialog", () => {
  const pass = ({ children }: any) => children ?? null;
  return { Dialog: ({ open, children }: any) => (open ? children : null), DialogContent: pass, DialogBody: pass, DialogFooter: pass, DialogTitle: pass, DialogDescription: pass };
});
vi.mock("@/components/project-dialogs", () => ({ NewProjectDialog: () => null, RenameProjectDialog: () => null, DeleteProjectDialog: () => null }));
(globalThis as any).window = globalThis;
(globalThis as any).CSS = { escape: (s: string) => s };
(globalThis as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

import { ProjectsPage } from "./projects";
import { UiStateProvider } from "@/shell/ui-state";

const NOW = Date.now();
const row = (id: string, extra: object = {}): any => ({ sessionId: id, title: `Session ${id}`, status: "idle", updatedAt: NOW - 60_000, createdAt: NOW - 3_600_000, owner: "me", canWrite: true, canManage: true, agentId: "ag", ...extra });
let serial = 0;

async function mount(sessions: any[], groups: any[] = [], query: Record<string, unknown> = {}) {
  for (const k of Object.keys(search)) delete search[k];
  Object.assign(search, query);
  const { source } = stubSource({ getCurrentUserProfile: () => ({ profileSettings: {} }) });
  source.listSessions = async () => sessions;
  source.listGroups = async () => groups;
  source.profile = async () => ({ displayName: "Me", provider: "p", subject: `u${++serial}`, isAdmin: false });
  (globalThis as any).document = { activeElement: null, body: {}, addEventListener() {}, removeEventListener() {}, querySelector: () => null };
  const r = await render(<Providers source={source} client={newClient()}><UiStateProvider><ProjectsPage /></UiStateProvider></Providers>);
  await r.flush(10);
  return r;
}
const titles = (r: Awaited<ReturnType<typeof mount>>) => r.findAll((n) => n.type === "a" && n.props["data-session-row"] !== undefined).map((n) => r.text(n));

describe("the Projects page", () => {
  const groups = [{ id: "g0", name: "Release" }, { id: "g1", name: "Research" }];
  const sessions = [
    row("a", { groupId: "g0", title: "Ship the build" }),
    row("kid", { parentSessionId: "a", title: "Check the changelog" }),
    row("b", { groupId: "g1", title: "Survey analysis" }),
    row("loose", { title: "Loose thoughts" }),
  ];

  it("lists each project with its sessions, a sub-agent under its parent, and the sessions in no project apart", async () => {
    const r = await mount(sessions, groups);
    const text = r.text();
    for (const heading of ["Release", "Research", "No project"]) expect(text).toContain(heading);
    const listed = titles(r).join("|");
    for (const t of ["Ship the build", "Check the changelog", "Survey analysis", "Loose thoughts"]) expect(listed).toContain(t);
    expect(listed.indexOf("Ship the build")).toBeLessThan(listed.indexOf("Check the changelog")); // the parent first
    await r.unmount();
  });
  it("search finds a session by its title and leaves the rest out", async () => {
    const r = await mount(sessions, groups, { q: "survey" });
    const listed = titles(r).join("|");
    expect(listed).toContain("Survey analysis");
    expect(listed).not.toContain("Ship the build");
    expect(listed).not.toContain("Loose thoughts");
    await r.unmount();
  });
  it("search by a project's name keeps that project", async () => {
    const r = await mount(sessions, groups, { q: "release" });
    expect(r.text()).toContain("Release");
    expect(titles(r).join("|")).toContain("Ship the build");
    await r.unmount();
  });
  it("an account with no sessions says so and offers a first one", async () => {
    const r = await mount([], []);
    expect(r.text()).toContain("No sessions yet");
    expect(r.findAll((n) => n.type === "button" && /New session/.test(r.text(n))).length).toBeGreaterThan(0);
    await r.unmount();
  });
  it("hides finished sessions until they are asked for, and says so", async () => {
    const done = [row("x", { groupId: "g0", title: "Live work" }), row("y", { groupId: "g0", status: "completed", title: "Finished work" })];
    const hidden = await mount(done, groups);
    expect(titles(hidden).join("|")).not.toContain("Finished work");
    expect(hidden.text()).toMatch(/completed|finished/i);
    await hidden.unmount();
    const shown = await mount(done, groups, { state: "closed" });
    expect(titles(shown).join("|")).toContain("Finished work");
    await shown.unmount();
  });
});
