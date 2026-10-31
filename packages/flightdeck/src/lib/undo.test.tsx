import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, act, type Rendered } from "@/test/render";

// The REAL Undo (lib/undo.tsx), mounted the way a dialog mounts it, with sonner replaced by a recorder.
const toasts = vi.hoisted(() => ({ calls: [] as Array<{ kind: string; arg: any }>, next: 0 }));
vi.mock("sonner", () => ({
  toast: {
    success: (message: string, opts: any) => { const id = ++toasts.next; toasts.calls.push({ kind: "success", arg: { id, message, opts } }); return id; },
    error: (message: string) => { toasts.calls.push({ kind: "error", arg: { message } }); },
    dismiss: (id: unknown) => { toasts.calls.push({ kind: "dismiss", arg: id }); },
  },
}));

import { DialogUndoHost, notifyUndo, STALE_UNDO_MESSAGE } from "./undo";

(globalThis as any).window = globalThis; // lib/undo.tsx uses window.setTimeout

// Outstanding long timers (the 8 second Undo windows), counted by wrapping the real ones.
let outstanding = new Set<unknown>();
const real = { set: globalThis.setTimeout, clear: globalThis.clearTimeout };
beforeEach(() => {
  toasts.calls.length = 0;
  outstanding = new Set();
  globalThis.setTimeout = ((fn: any, ms?: number, ...a: any[]) => {
    const id = real.set(() => { outstanding.delete(id); fn(...a); }, ms, ...a);
    if ((ms ?? 0) >= 1000) outstanding.add(id);
    return id;
  }) as any;
  globalThis.clearTimeout = ((id: any) => { outstanding.delete(id); real.clear(id); }) as any;
});
afterEach(() => { globalThis.setTimeout = real.set; globalThis.clearTimeout = real.clear; });

const undoButtons = (r: Rendered) => r.findAll((n) => n.type === "button" && r.text(n).trim() === "Undo");
const click = async (r: Rendered, i = 0) => { await r.fire(undoButtons(r)[i], "onClick"); await r.flush(); };

describe("Undo inside a dialog", () => {
  it("retires an older undo for the same resource: the older notice can no longer restore", async () => {
    const r = await render(<DialogUndoHost />);
    const a = vi.fn(), b = vi.fn();
    await act(() => notifyUndo("Pinned 1.3.2", a, { resource: "pin:ops" }));
    await act(() => notifyUndo("Pinned 1.3.0", b, { resource: "pin:ops" }));
    expect(undoButtons(r)).toHaveLength(1);
    expect(r.text()).toContain("Pinned 1.3.0");
    expect(r.text()).not.toContain("Pinned 1.3.2");
    await click(r);
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
    await r.unmount();
  });

  it("keeps undos for different resources side by side", async () => {
    const r = await render(<DialogUndoHost />);
    await act(() => notifyUndo("One", vi.fn(), { resource: "a" }));
    await act(() => notifyUndo("Two", vi.fn(), { resource: "b" }));
    expect(undoButtons(r)).toHaveLength(2);
    await r.unmount();
  });

  it("refuses to restore when the guard says the state moved on, and says why", async () => {
    const r = await render(<DialogUndoHost />);
    const undo = vi.fn();
    await act(() => notifyUndo("Changed", undo, { resource: "x", guard: async () => false }));
    await click(r);
    expect(undo).not.toHaveBeenCalled();
    expect(toasts.calls.find((c) => c.kind === "error")?.arg.message).toBe(STALE_UNDO_MESSAGE);
    await r.unmount();
  });

  it("restores when the guard confirms the state is still what the change produced", async () => {
    const r = await render(<DialogUndoHost />);
    const undo = vi.fn();
    await act(() => notifyUndo("Changed", undo, { resource: "x", guard: async () => true }));
    await click(r);
    expect(undo).toHaveBeenCalledTimes(1);
    await r.unmount();
  });

  it("leaves no timer behind when a third notice evicts the first and the dialog unmounts", async () => {
    const r = await render(<DialogUndoHost />);
    for (const name of ["one", "two", "three"]) await act(() => notifyUndo(name, vi.fn(), { resource: name }));
    expect(undoButtons(r)).toHaveLength(2);          // the first fell off the row
    await r.unmount();
    expect(outstanding.size).toBe(0);                // and its timer went with it
  });
});

describe("Undo in a toast (no dialog open)", () => {
  it("dismisses the older toast when a newer undo for the same resource arrives", async () => {
    notifyUndo("First", vi.fn(), { resource: "same" });
    const first = toasts.calls.find((c) => c.kind === "success")!.arg.id;
    notifyUndo("Second", vi.fn(), { resource: "same" });
    expect(toasts.calls.some((c) => c.kind === "dismiss" && c.arg === first)).toBe(true);
  });

  it("runs the guard from the toast's Undo action too", async () => {
    const undo = vi.fn();
    notifyUndo("Changed", undo, { resource: "g", guard: async () => false });
    const opts = toasts.calls.find((c) => c.kind === "success")!.arg.opts;
    opts.action.onClick();
    await new Promise((r) => real.set(r, 0));
    expect(undo).not.toHaveBeenCalled();
    expect(toasts.calls.some((c) => c.kind === "error")).toBe(true);
  });
});

describe("Undo races", () => {
  it("abandons an older restore whose guard was still reading when a newer action registered", async () => {
    const r = await render(<DialogUndoHost />);
    const a = vi.fn(), b = vi.fn();
    let release!: (ok: boolean) => void;
    const slowGuard = () => new Promise<boolean>((res) => { release = res; });
    await act(() => notifyUndo("Pinned 1.3.2", a, { resource: "pin:race", guard: slowGuard }));
    await click(r); // the guard is now waiting on its read
    await act(() => notifyUndo("Pinned 1.3.0", b, { resource: "pin:race" }));
    release(true); // the older read answers "still fresh", too late
    await r.flush();
    expect(a).not.toHaveBeenCalled();
    expect(toasts.calls.some((c) => c.kind === "error" && c.arg.message === STALE_UNDO_MESSAGE)).toBe(true);
    await r.unmount();
  });
});
