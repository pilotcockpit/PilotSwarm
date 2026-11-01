import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, type HostNode, type Rendered } from "@/test/render";
import { newClient, Providers, stubSource } from "@/test/harness";

vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { success: vi.fn(), error: vi.fn(), dismiss: () => undefined }) }));
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<any>()),
  Link: ({ children, to: _to, params: _params, search: _search, ...rest }: any) => React.createElement("a", rest, children),
  useRouterState: () => "/",
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
vi.mock("@/components/session/share-sheet", () => ({ ShareSheet: () => null }));
vi.mock("@/components/session/move-to-group", () => ({ MoveToGroupDialog: () => null }));
vi.mock("@/components/session/session-actions", async (orig) => ({ ...(await orig<any>()), SessionCloseDialog: () => null, SessionRenameDialog: () => null }));
vi.mock("@/components/admin/system-sessions-panel", () => ({ RestartDialog: () => null }));
(globalThis as any).window = globalThis;
(globalThis as any).CSS = { escape: (s: string) => s };
(globalThis as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

import { SessionsSidebar } from "./sessions-sidebar";
import { UiStateProvider } from "@/shell/ui-state";

// The REAL sidebar list, kept alive across a data change: a row that moves to another section is unmounted and
// mounted again, which in a browser drops keyboard focus to the page. The sidebar must hand it back.
const row = (id: string, status = "idle", extra: object = {}): any => ({ sessionId: id, title: `Session ${id}`, status, updatedAt: Date.now(), canWrite: true, canManage: true, agentId: "ag", ...extra });
const rowFor = (r: Rendered, id: string): HostNode => r.find((n) => n.type === "a" && n.props["data-session-id"] === id);
const body = { tagName: "BODY" } as any;

async function mount(initial: any[]) {
  let sessions = initial;
  const { source } = stubSource({ listGroups: [], getProfile: {} });
  source.listSessions = async () => sessions;
  source.listGroups = async () => [];
  source.profile = async () => ({ displayName: "Me", provider: "p", subject: "u1", isAdmin: false });
  const client = newClient();
  const doc: any = { activeElement: body, body, addEventListener() {}, removeEventListener() {} };
  (globalThis as any).document = doc;
  const r = await render(<Providers source={source} client={client}><UiStateProvider><SessionsSidebar /></UiStateProvider></Providers>);
  await r.flush(8);
  const change = async (next: any[]) => { sessions = next; await act(() => client.invalidateQueries({ queryKey: ["sessions"] })); await r.flush(8); };
  return { r, doc, change };
}
const focusRowOf = async (r: Rendered, id: string) => { const el = rowFor(r, id); el.focus(); await r.fire(el, "onFocus"); return el; };

describe("keyboard focus when a row changes section", () => {
  it("follows the same session into its new section", async () => {
    const t = await mount([row("a"), row("b"), row("c")]);
    const before = await focusRowOf(t.r, "b");
    expect(t.doc.activeElement).toBe(before);
    await t.change([row("a"), row("b", "input_required", { pendingQuestion: { question: "?", choices: ["y"] } }), row("c")]); // b now needs you: it moves to the first section
    const after = rowFor(t.r, "b");
    expect(after).not.toBe(before); // a new row in a new place
    expect(t.doc.activeElement).toBe(after);
    await t.r.unmount();
  });

  it("goes to the neighbouring row when the focused session is gone", async () => {
    const t = await mount([row("a"), row("b"), row("c")]);
    await focusRowOf(t.r, "b");
    await t.change([row("a"), row("c")]);
    const next = t.doc.activeElement as HostNode;
    expect(next?.props?.["data-session-id"]).toMatch(/^(a|c)$/);
    expect(next.parent).not.toBeNull(); // attached to the live tree
    await t.r.unmount();
  });

  it("leaves focus alone when it was never in the list", async () => {
    const t = await mount([row("a"), row("b")]);
    await t.change([row("a", "input_required", { pendingQuestion: { question: "?" } }), row("b")]);
    expect(t.doc.activeElement).toBe(body);
    await t.r.unmount();
  });
});
