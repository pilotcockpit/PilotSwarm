import { describe, expect, it, vi } from "vitest";
import { act, render } from "@/test/render";
import { newClient, Providers, stubSource } from "@/test/harness";

vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { success: vi.fn(), error: vi.fn(), dismiss: () => undefined }) }));
(globalThis as any).window = globalThis;
(globalThis as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

import { useRecentOutputs } from "./home";

const session = (id: string, updatedAt: number): any => ({ sessionId: id, title: id, updatedAt, owner: "me", status: "idle" });

describe("recent outputs follow session activity", () => {
  it("reads one session's outputs again when its activity moves, and no other's", async () => {
    const reads: Record<string, number> = {};
    const { source } = stubSource({});
    source.listArtifacts = async (id: string) => { reads[id] = (reads[id] ?? 0) + 1; return []; };
    let current: any[] = [session("a", 100), session("b", 100)];
    function Probe() { (globalThis as any).__out = useRecentOutputs(current); return null; }
    const client = newClient();
    const view = () => <Providers source={source} client={client}><Probe /></Providers>;
    const r = await render(view());
    await r.flush(6);
    expect(reads).toEqual({ a: 1, b: 1 });
    current = [session("a", 100), session("b", 100)]; // a poll with nothing new reads nothing
    await act(async () => { await client.invalidateQueries({ queryKey: ["nothing"] }); });
    await r.rerender(view());
    await r.flush(6);
    expect(reads).toEqual({ a: 1, b: 1 });
    current = [session("a", 100), session("b", 250)]; // b did something
    await r.rerender(view());
    await r.flush(8);
    expect(reads).toEqual({ a: 1, b: 2 });
    await r.unmount();
  });
});
