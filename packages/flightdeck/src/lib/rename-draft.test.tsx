import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, type HostNode, type Rendered } from "@/test/render";
import { Providers } from "@/test/harness";
import { beginDraft, changedUnderneath, saveOutcome, useRenameDraft } from "./rename-draft";

// Radix dialogs need a real DOM. They are not ours: stand-ins render their children so the REAL rename dialog,
// the REAL header title editor and the REAL draft hook are what is under test.
vi.mock("@/components/ui/dialog", () => {
  const pass = ({ children }: any) => children ?? null;
  return { Dialog: ({ open, children }: any) => (open ? children : null), DialogContent: pass, DialogBody: pass, DialogFooter: pass, DialogTrigger: pass, DialogClose: pass };
});
vi.mock("@/components/ui/field", () => ({ Field: ({ children }: any) => children }));
vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { success: vi.fn(), error: vi.fn(), dismiss: () => undefined }) }));
const notifyUndo = vi.fn();
vi.mock("@/lib/undo", async (orig) => ({ ...(await orig<any>()), notifyUndo: (...a: unknown[]) => notifyUndo(...a) }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => undefined, useRouterState: () => "/", Link: ({ children }: any) => children }));
(globalThis as any).window = globalThis;
(globalThis as any).addEventListener ??= () => undefined;
(globalThis as any).removeEventListener ??= () => undefined;
(globalThis as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

import { SessionRenameDialog } from "@/components/session/session-actions";
import { TitleEditor } from "@/components/session/session-header";

describe("the draft rules", () => {
  it("a draft starts from the server title and notices when the server moves on", () => {
    const d = beginDraft("Alpha");
    expect(changedUnderneath(d, "Alpha")).toBe(false);
    expect(changedUnderneath(d, "Beta")).toBe(true);
  });

  it("saving means what was typed, and says whose title it replaces", () => {
    expect(saveOutcome({ baseline: "Alpha", text: "Mine" }, "Alpha")).toEqual({ kind: "rename", next: "Mine", replaced: null });
    expect(saveOutcome({ baseline: "Alpha", text: "Mine" }, "Theirs")).toEqual({ kind: "rename", next: "Mine", replaced: "Theirs" });
  });

  it("does nothing when the title is empty or unchanged", () => {
    expect(saveOutcome({ baseline: "A", text: "  " }, "A")).toEqual({ kind: "noop" });
    expect(saveOutcome({ baseline: "A", text: "A" }, "A")).toEqual({ kind: "noop" });
  });
});

function Probe({ title, active, out }: { title: string; active: boolean; out: { current?: ReturnType<typeof useRenameDraft> } }) {
  out.current = useRenameDraft(title, active);
  return null;
}

describe("the draft hook", () => {
  it("keeps what is being typed when a poll brings a different title, and offers theirs", async () => {
    const out: any = {};
    const r = await render(<Probe title="Alpha" active out={out} />);
    await act(() => out.current.setText("Mine"));
    await r.rerender(<Probe title="Theirs" active out={out} />);
    expect(out.current.text).toBe("Mine");
    expect(out.current.changedUnderneath).toBe(true);
    await act(() => out.current.useTheirs());
    expect(out.current.text).toBe("Theirs");
    expect(out.current.changedUnderneath).toBe(false);
    await r.unmount();
  });

  it("follows the server title while it is not being edited", async () => {
    const out: any = {};
    const r = await render(<Probe title="Alpha" active={false} out={out} />);
    await r.rerender(<Probe title="Beta" active={false} out={out} />);
    expect(out.current.text).toBe("Beta");
    await r.unmount();
  });
});

const input = (r: Rendered) => r.find((n) => n.type === "input");
const typeInto = (r: Rendered, text: string) => r.fire(input(r), "onChange", { target: { value: text } });
const session = (title: string): any => ({ sessionId: "s1", title, status: "idle", canManage: true });
function mountWith(el: (title: string) => React.ReactElement) {
  const renames: Array<{ id: string; title: string }> = [];
  const source = { kind: "live", label: "stub", renameSession: async (id: string, title: string) => { renames.push({ id, title }); }, call: async () => undefined, getSession: async () => null } as any;
  const wrap = (title: string) => <Providers source={source}>{el(title)}</Providers>;
  return { renames, mount: (title: string) => render(wrap(title)), wrap };
}

describe("rename dialog against polling", () => {
  it("keeps the draft when the session is renamed meanwhile, says so, and saves what was typed", async () => {
    const t = mountWith((title) => <SessionRenameDialog session={session(title)} open onOpenChange={() => undefined} />);
    const r = await t.mount("Alpha");
    await typeInto(r, "Mine");
    await r.rerender(t.wrap("Theirs"));
    expect((input(r).props as any).value).toBe("Mine");
    expect(r.findAll((n: HostNode) => n.props["data-title-changed"] !== undefined)).toHaveLength(1);
    expect(r.text()).toContain("“Theirs”");
    await r.fire(r.find((n) => n.type === "form"), "onSubmit");
    await r.flush();
    expect(t.renames).toEqual([{ id: "s1", title: "Mine" }]);
    await r.unmount();
  });

  it("'Use theirs' takes their title as the new starting point", async () => {
    const t = mountWith((title) => <SessionRenameDialog session={session(title)} open onOpenChange={() => undefined} />);
    const r = await t.mount("Alpha");
    await typeInto(r, "Mine");
    await r.rerender(t.wrap("Theirs"));
    await r.fire(r.find((n) => n.type === "button" && r.text(n).trim() === "Use theirs"), "onClick");
    expect((input(r).props as any).value).toBe("Theirs");
    expect(r.findAll((n: HostNode) => n.props["data-title-changed"] !== undefined)).toHaveLength(0);
    await r.unmount();
  });
});

describe("inline title editor against polling", () => {
  it("keeps the draft while editing and saves it, with a way back to their title", async () => {
    notifyUndo.mockClear();
    const t = mountWith((title) => <TitleEditor session={session(title)} />);
    const r = await t.mount("Alpha");
    await r.fire(r.find((n) => n.type === "button" && r.text(n).includes("Alpha")), "onClick"); // begin editing
    await typeInto(r, "Mine");
    await r.rerender(t.wrap("Theirs")); // a poll brings someone else's title
    expect((input(r).props as any).value).toBe("Mine");
    await r.fire(input(r), "onKeyDown", { key: "Enter" });
    await r.flush();
    expect(t.renames).toEqual([{ id: "s1", title: "Mine" }]);
    expect(notifyUndo).toHaveBeenCalledTimes(1);
    expect(String((notifyUndo.mock.calls[0][2] as any).description)).toContain("Theirs");
    await r.unmount();
  });

  it("Escape drops the draft without saving", async () => {
    const t = mountWith((title) => <TitleEditor session={session(title)} />);
    const r = await t.mount("Alpha");
    await r.fire(r.find((n) => n.type === "button" && r.text(n).includes("Alpha")), "onClick");
    await typeInto(r, "Nope");
    await r.fire(input(r), "onKeyDown", { key: "Escape" });
    await r.flush();
    expect(t.renames).toEqual([]);
    await r.unmount();
  });
});
