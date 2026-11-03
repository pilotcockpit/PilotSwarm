import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { newClient, Providers, stubSource } from "@/test/harness";

const navigated: unknown[] = [];
vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { success: vi.fn(), error: vi.fn(), dismiss: () => undefined }) }));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<any>()), useNavigate: () => (o: unknown) => { navigated.push(o); } }));
vi.mock("@/components/project-picker", () => ({ ProjectPicker: ({ value, onChange, projects }: any) => <button type="button" aria-label="project picker" data-value={value} onClick={() => onChange(projects[0]?.id ?? "")}>{value || "none"}</button> }));
(globalThis as any).window = globalThis;
(globalThis as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

import { OverviewStart } from "./overview-start";
import { UiStateProvider, useUi } from "@/shell/ui-state";

function Probe() { (globalThis as any).__asked = useUi().newSession; return null; }

async function mount(o: { providers?: unknown[]; models?: unknown[]; createFails?: boolean } = {}) {
  navigated.length = 0;
  (globalThis as any).__asked = undefined;
  const created: any[] = [];
  const { source } = stubSource({});
  source.listGroups = async () => [{ id: "g0", name: "Work" }];
  source.profile = async () => ({ displayName: "Me", provider: "p", subject: "u1", isAdmin: false });
  source.call = async (op: string) => (op === "listProviders" ? o.providers ?? [{ name: "p", usableByMe: true }] : op === "listModels" ? o.models ?? [{ qualifiedName: "p:m", credentialAvailable: true }] : undefined);
  source.listProviders = async () => o.providers ?? [{ name: "p", usableByMe: true }];
  source.listModels = async () => o.models ?? [{ qualifiedName: "p:m", credentialAvailable: true }];
  source.createSession = async (input: any) => { created.push(input); if (o.createFails) throw new Error("no worker"); return "new-1"; };
  (globalThis as any).document = { activeElement: null, body: {}, addEventListener() {}, removeEventListener() {}, querySelector: () => null };
  const r = await render(<Providers source={source} client={newClient()}><UiStateProvider><OverviewStart /><Probe /></UiStateProvider></Providers>);
  await r.flush(8);
  const type = async (text: string) => { await r.fire(r.find((n) => n.type === "textarea"), "onChange", { target: { value: text } }); await r.flush(2); };
  const submit = async () => { await r.fire(r.find((n) => n.type === "form"), "onSubmit"); await r.flush(8); };
  return { r, created, type, submit };
}

describe("the Overview start box", () => {
  it("starts a generic session with what was typed, and goes to it", async () => {
    const t = await mount();
    await t.type("  check the failed runs ");
    await t.submit();
    expect(t.created).toEqual([{ prompt: "check the failed runs", agentName: null, model: null, reasoningEffort: null, groupId: null, workspace: null }]);
    expect(navigated).toEqual([{ to: "/s/$sessionId", params: { sessionId: "new-1" } }]);
    await t.r.unmount();
  });
  it("files the session in the chosen project", async () => {
    const t = await mount();
    await t.r.fire(t.r.find((n) => n.props["aria-label"] === "project picker"), "onClick");
    await t.type("go");
    await t.submit();
    expect(t.created[0].groupId).toBe("g0");
    await t.r.unmount();
  });
  it("with nothing typed, opens the full New session dialog instead of making an empty session", async () => {
    const t = await mount();
    await t.submit();
    expect(t.created).toEqual([]);
    expect((globalThis as any).__asked.open).toBe(true);
    await t.r.unmount();
  });
  it("with no provider to run on, opens the dialog, which explains how to add one, and keeps the text", async () => {
    const t = await mount({ providers: [{ name: "p", usableByMe: false }], models: [] });
    await t.type("hello");
    await t.submit();
    expect(t.created).toEqual([]);
    expect((globalThis as any).__asked).toMatchObject({ open: true, prompt: "hello" });
    await t.r.unmount();
  });
  it("More options opens the dialog holding the text and the project", async () => {
    const t = await mount();
    await t.type("draft");
    await t.r.fire(t.r.find((n) => n.props["aria-label"] === "project picker"), "onClick");
    await t.r.fire(t.r.find((n) => n.type === "button" && n.props["aria-label"] === "More options"), "onClick");
    expect((globalThis as any).__asked).toMatchObject({ open: true, prompt: "draft", group: "g0" });
    await t.r.unmount();
  });
  it("keeps the text when the server cannot start the session, and does not navigate", async () => {
    const t = await mount({ createFails: true });
    await t.type("keep me");
    await t.submit();
    expect(navigated).toEqual([]);
    expect(t.r.find((n) => n.type === "textarea").props.value).toBe("keep me");
    await t.r.unmount();
  });
});
