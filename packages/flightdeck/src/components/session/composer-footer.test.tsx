import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, type Rendered } from "@/test/render";
import { Providers, stubSource } from "@/test/harness";

vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { success: () => 0, error: vi.fn(), dismiss: () => undefined }) }));
// Radix radios need a real DOM (form lookup, event listeners). They are not ours: the test stands in a plain radio group
// with the same contract (onValueChange(value) on click), so what is tested is the picker's own logic.
vi.mock("@/components/ui/radio", async () => {
  const React = await import("react");
  const Ctx = React.createContext<(v: string) => void>(() => undefined);
  return {
    RadioCards: ({ onValueChange, children, label }: any) => React.createElement(Ctx.Provider, { value: onValueChange }, React.createElement("div", { role: "radiogroup", "aria-label": label }, children)),
    RadioCard: ({ value, children, disabled }: any) => { const pick = React.useContext(Ctx); return React.createElement("button", { type: "button", role: "radio", disabled, onClick: () => pick(value) }, children); },
  };
});
// Tooltips and the working-folder dialog are portals over a real DOM; they are plain pass-throughs here.
vi.mock("@/components/ui/tooltip", () => ({ Tooltip: ({ children }: any) => children, TooltipProvider: ({ children }: any) => children }));
vi.mock("@/components/session/working-folder-dialog", () => ({ WorkingFolderDialog: () => null }));
const undoCalls: Array<{ message: string; undo: () => unknown; opts: any }> = [];
vi.mock("@/lib/undo", () => ({ notifyUndo: (message: string, undo: () => unknown, opts: any) => { undoCalls.push({ message, undo, opts }); } }));
(globalThis as any).window = globalThis;
(globalThis as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

import { AgentLabel, ComposerSettings, ContextMeter, FolderChip, ModelChip } from "./composer-footer";
import { markPending, resetPending } from "@/lib/pending-model";
import { ModelPicker } from "@/components/model-picker";

// The REAL composer footer parts and the REAL model picker, against a stub server that answers with wire shapes.

const models = [
  { qualifiedName: "a:claude-sonnet-5", providerId: "a", modelName: "claude-sonnet-5", credentialAvailable: true, supportedReasoningEfforts: ["low", "high"], supportedContextTiers: ["standard", "extended"], description: "Fast." },
  { qualifiedName: "b:gpt-5.6", providerId: "b", modelName: "gpt-5.6", credentialAvailable: true, description: "Plain." },
];
const session: any = { sessionId: "s1", title: "S", agentId: "sre-investigator", model: "a:claude-sonnet-5", reasoningEffort: "high", contextTier: "standard", status: "idle", workspace: { root: "/repos", folder: "pilotswarm/dev" } };

function setup(answers: Record<string, unknown> = {}) {
  const { source, calls } = stubSource({ getSessionWorkspace: { workspace: { root: "/repos", folder: "pilotswarm/dev" }, revision: 1, path: "/repos/pilotswarm/dev", status: "ready", lastError: null, heldPrompts: 0, adopted: null }, ...answers });
  const changes: Array<{ id: string; model: string; opts: any }> = [];
  source.listModels = async () => models;
  source.setSessionModel = async (id: string, model: string, opts: any) => { changes.push({ id, model, opts }); };
  source.getSession = async () => session;
  return { source, calls, changes, mount: (el: React.ReactElement) => render(<Providers source={source}>{el}</Providers>) };
}
const radio = (r: Rendered, label: string) => r.find((n) => n.props.role === "radio" && r.text(n).trim().startsWith(label));
const buttons = (r: Rendered) => r.findAll((n) => n.type === "button");

describe("what is fixed and what can change", () => {
  it("shows the agent as plain text: nothing to click, with the reason in a tooltip", async () => {
    const t = setup();
    const r = await t.mount(<AgentLabel agent="sre-investigator" />);
    expect(buttons(r)).toHaveLength(0);
    expect(r.find((n) => n.props.title === "The agent is set when a session is created")).toBeTruthy();
    await r.unmount();
  });

  it("shows nothing for a session without an agent", async () => {
    const t = setup();
    const r = await t.mount(<AgentLabel />);
    expect(r.text()).toBe("");
    await r.unmount();
  });

  it("turns the model into plain text, with the reason, when the person cannot change it", async () => {
    const t = setup();
    const r = await t.mount(<ModelChip session={session} locked="View-only access: you can read this session but not change it" onApplied={() => undefined} />);
    expect(buttons(r)).toHaveLength(0);
    expect(r.text()).toContain("sonnet-5 · high");
    expect(r.text()).toContain("View-only access");
    await r.unmount();
  });

  it("makes the working folder a button that names the folder, and plain text when locked", async () => {
    const t = setup();
    const open = await t.mount(<FolderChip session={session} locked={null} />); await open.flush(8);
    expect(buttons(open).some((b) => b.props["aria-label"]?.startsWith("Working folder: dev"))).toBe(true);
    await open.unmount();
    const fixed = await t.mount(<FolderChip session={session} locked="System sessions use the models set in Models & spend" />); await fixed.flush(8);
    expect(buttons(fixed)).toHaveLength(0);
    expect(fixed.text()).toContain("dev");
    await fixed.unmount();
  });

  it("flags a folder that is unavailable", async () => {
    const t = setup({ getSessionWorkspace: { workspace: { root: "/repos" }, revision: 2, path: "/repos", status: "unavailable", lastError: { code: "E", message: "disk gone" }, heldPrompts: 3, adopted: null } });
    const r = await t.mount(<FolderChip session={session} locked={null} />); await r.flush(8);
    expect(buttons(r).some((b) => String(b.props["aria-label"]).includes("Folder unavailable: disk gone"))).toBe(true);
    await r.unmount();
  });
});

describe("the context meter", () => {
  const meter = async (utilization: unknown) => {
    const t = setup();
    return t.mount(<ContextMeter session={{ ...session, contextUsage: utilization === undefined ? undefined : { utilization } }} />);
  };
  it("is hidden when the server reported nothing usable", async () => {
    for (const u of [undefined, null, NaN, -0.2, "x"]) { const r = await meter(u); expect(r.findAll((n) => n.props.role === "meter")).toHaveLength(0); await r.unmount(); }
  });
  it("reports a ratio as a percentage", async () => {
    const r = await meter(0.38);
    const m = r.find((n) => n.props.role === "meter");
    expect(m.props["aria-valuenow"]).toBe(38);
    expect(m.props["aria-valuetext"]).toBe("Context 38% used");
    await r.unmount();
  });
  it("clamps the bar but says the limit was passed", async () => {
    const r = await meter(1.2);
    const m = r.find((n) => n.props.role === "meter");
    expect(m.props["aria-valuenow"]).toBe(100);
    expect(m.props["aria-valuetext"]).toBe("Context over the limit (120%)");
    await r.unmount();
  });
});

describe("the model picker", () => {
  it("sends only what the person changed: the effort, not the context tier", async () => {
    const t = setup();
    const r = await t.mount(<ModelPicker session={session} />); await r.flush(8);
    await r.fire(radio(r, "low"), "onClick"); await r.flush(4);
    await r.fire(buttons(r).find((b) => r.text(b).includes("Apply"))!, "onClick"); await r.flush(8);
    expect(t.changes).toEqual([{ id: "s1", model: "a:claude-sonnet-5", opts: { reasoningEffort: "low" } }]);
    expect("contextTier" in t.changes[0].opts).toBe(false);
    await r.unmount();
  });

  it("clears an effort and tier the new model does not offer, and keeps Apply off until something changed", async () => {
    const t = setup();
    const r = await t.mount(<ModelPicker session={session} />); await r.flush(8);
    const apply = () => buttons(r).find((b) => r.text(b).includes("Apply"))!;
    expect(apply().props.disabled).toBe(true);
    await r.fire(radio(r, "gpt-5.6"), "onClick"); await r.flush(4);
    expect(r.findAll((n) => n.props.role === "radio" && r.text(n).trim() === "low")).toHaveLength(0); // the effort choices are gone
    await r.fire(apply(), "onClick"); await r.flush(8);
    expect(t.changes).toEqual([{ id: "s1", model: "b:gpt-5.6", opts: { reasoningEffort: null, contextTier: null } }]);
    await r.unmount();
  });
});


// ── A poll must not turn an untouched field into a write ─────────────────────────────────────────────────────
describe("the model picker against polling", () => {
  const swap = (t: ReturnType<typeof setup>, next: any) => <Providers source={t.source}><ModelPicker session={next} /></Providers>;
  const apply = (r: Rendered) => buttons(r).find((b) => r.text(b).includes("Apply"))!;

  it("a poll alone does not enable Apply", async () => {
    const t = setup();
    const r = await t.mount(<ModelPicker session={session} />); await r.flush(8);
    await r.rerender(swap(t, { ...session, contextTier: "extended" })); await r.flush(4);
    expect(apply(r).props.disabled).toBe(true);
    await r.unmount();
  });

  it("an untouched context tier follows the server and is never sent, even after it changed underneath", async () => {
    const t = setup();
    const r = await t.mount(<ModelPicker session={session} />); await r.flush(8);
    await r.fire(radio(r, "low"), "onClick"); await r.flush(4);
    await r.rerender(swap(t, { ...session, contextTier: "extended" })); await r.flush(4); // another tab changed the tier
    await r.fire(apply(r), "onClick"); await r.flush(8);
    expect(t.changes).toEqual([{ id: "s1", model: "a:claude-sonnet-5", opts: { reasoningEffort: "low" } }]);
    expect("contextTier" in t.changes[0].opts).toBe(false);
    await r.unmount();
  });

  it("says when a field the person changed was changed elsewhere too, and still applies their choice", async () => {
    const t = setup();
    const r = await t.mount(<ModelPicker session={session} />); await r.flush(8);
    await r.fire(radio(r, "low"), "onClick"); await r.flush(4);
    expect(r.findAll((n: any) => n.props["data-changed-elsewhere"] !== undefined)).toHaveLength(0);
    await r.rerender(swap(t, { ...session, reasoningEffort: null })); await r.flush(4); // elsewhere: effort cleared
    expect(r.findAll((n: any) => n.props["data-changed-elsewhere"] !== undefined)).toHaveLength(1);
    expect(r.text()).toContain("reasoning effort changed elsewhere");
    await r.fire(apply(r), "onClick"); await r.flush(8);
    expect(t.changes[0].opts).toEqual({ reasoningEffort: "low" });
    await r.unmount();
  });
});

// ── Undo restores the complete previous setting, and refuses when any dimension moved ─────────────────────────
describe("the model change's Undo", () => {
  const apply = (r: Rendered) => buttons(r).find((b) => r.text(b).includes("Apply"))!;
  async function change() {
    undoCalls.length = 0; resetPending();
    const t = setup();
    const r = await t.mount(<ModelPicker session={session} />); await r.flush(8);
    await r.fire(radio(r, "low"), "onClick"); await r.flush(4);
    await r.fire(apply(r), "onClick"); await r.flush(8);
    return { t, r, undo: undoCalls[0] };
  }

  it("restores the whole previous tuple, every key, so a newer effort cannot be kept", async () => {
    const { t, r, undo } = await change();
    t.changes.length = 0;
    await undo.undo();
    expect(t.changes).toEqual([{ id: "s1", model: "a:claude-sonnet-5", opts: { reasoningEffort: "high", contextTier: "standard" } }]);
    await r.unmount();
  });

  it("allows Undo while the change is still pending (the session still shows the old setting) and when it was adopted", async () => {
    const { t, r, undo } = await change();
    t.source.getSession = async () => ({ ...session }); // still the old tuple: not adopted yet
    expect(await undo.opts.guard()).toBe(true);
    t.source.getSession = async () => ({ ...session, reasoningEffort: "low" }); // adopted
    expect(await undo.opts.guard()).toBe(true);
    await r.unmount();
  });

  it("refuses when ANY of model, effort or tier moved to something else since", async () => {
    const { t, r, undo } = await change();
    for (const other of [{ reasoningEffort: "medium" }, { reasoningEffort: "low", contextTier: "extended" }, { model: "b:gpt-5.6", reasoningEffort: "low" }, { reasoningEffort: null }]) {
      t.source.getSession = async () => ({ ...session, ...other });
      expect(await undo.opts.guard(), JSON.stringify(other)).toBe(false);
    }
    await r.unmount();
  });
});

// ── Pending: queued is not adopted ───────────────────────────────────────────────────────────────────────────
describe("a model change is pending until the session reports it", () => {
  const settings = (s: any, running = true) => <ComposerSettings session={s} running={running} />;
  it("says so in the composer, then stops saying it once the session shows the new setting", async () => {
    resetPending();
    const t = setup();
    const r = await t.mount(settings(session)); await r.flush(4);
    expect(r.findAll((n: any) => n.props["data-model-pending"] !== undefined)).toHaveLength(0);
    await act(() => markPending("s1", { model: "a:claude-sonnet-5", effort: "low", tier: "standard" }, { model: "a:claude-sonnet-5", effort: "high", tier: "standard" }));
    await r.flush(2);
    expect(r.findAll((n: any) => n.props["data-model-pending"] !== undefined)).toHaveLength(1);
    expect(r.text()).toContain("after the current turn");
    await r.rerender(<Providers source={t.source}>{settings({ ...session, reasoningEffort: "low" })}</Providers>); await r.flush(4);
    expect(r.findAll((n: any) => n.props["data-model-pending"] !== undefined)).toHaveLength(0);
    resetPending();
    await r.unmount();
  });
});

// ── The folder chip ──────────────────────────────────────────────────────────────────────────────────────────
describe("the folder chip", () => {
  const empty = { workspace: null, revision: 3, path: null, status: "none", lastError: null, heldPrompts: 0, adopted: null };
  it("names the deployment's default folder when the session has none of its own", async () => {
    const t = setup({ getSessionWorkspace: { ...empty, defaults: { workingFolder: { root: "/srv", folder: "team" } } } });
    const r = await t.mount(<FolderChip session={{ ...session, workspace: undefined }} locked={null} />); await r.flush(8);
    expect(buttons(r).some((b) => String(b.props["aria-label"]).startsWith("Working folder: Default: team"))).toBe(true);
    await r.unmount();
  });
  it("after an authoritative 'no folder' it does not bring back the session row's old one", async () => {
    const t = setup({ getSessionWorkspace: empty });
    const r = await t.mount(<FolderChip session={{ ...session, workspace: { root: "/old", folder: "gone" } }} locked={null} />); await r.flush(8);
    expect(buttons(r).some((b) => String(b.props["aria-label"]).startsWith("Working folder: No folder"))).toBe(true);
    expect(r.text()).not.toContain("gone");
    await r.unmount();
  });
});

// ── What the picker says about the provider ──────────────────────────────────────────────────────────────────
describe("the model picker's provider note", () => {
  it("keeps the model selectable but says holds and limits still apply, naming the provider's condition", async () => {
    const t = setup();
    t.source.listProviders = async () => [{ name: "a", hasCredential: true, usableByMe: true, holdIndefinite: true, holdUntilUtc: null }];
    const r = await t.mount(<ModelPicker session={session} />); await r.flush(10);
    expect(r.text()).toContain("Provider holds and token limits still apply");
    const note = r.findAll((n: any) => n.props["data-provider-condition"] !== undefined);
    expect(note).toHaveLength(1);
    expect(r.text(note[0])).toContain("On hold");
    expect(radio(r, "claude-sonnet-5").props.disabled).not.toBe(true);
    await r.unmount();
  });
});
