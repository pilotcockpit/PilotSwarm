import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, type Rendered } from "@/test/render";
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
(globalThis as any).window = globalThis;
(globalThis as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

import { AgentLabel, ContextMeter, FolderChip, ModelChip } from "./composer-footer";
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
