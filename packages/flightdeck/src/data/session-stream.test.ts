import { describe, expect, it, vi } from "vitest";
import { subscribeToSession, type SessionStreamApi } from "./session-stream";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

function fakeApi(rows: Record<string, any[]> = {}) {
  let handler: (m: any) => void = () => {};
  let resubscribe: () => void = () => {};
  const calls: Array<{ name: string; params: any }> = [];
  const api: SessionStreamApi = {
    subscribeSession: (_id, h, r) => { handler = h; resubscribe = r || (() => {}); return () => { handler = () => {}; }; },
    call: async (name, params) => { calls.push({ name, params }); return rows[name] ?? []; },
  };
  return { api, calls, push: (e: any) => handler(e), reconnect: async () => { resubscribe(); await new Promise((r) => setTimeout(r, 0)); } };
}
const ev = (seq: number, eventType = "assistant.message", data: any = {}) => ({ seq, sessionId: "s", eventType, data, createdAt: Date.now() });

describe("subscribeToSession", () => {
  it("delivers live events once, in order, and ignores a repeat", () => {
    const f = fakeApi();
    const got: number[] = [];
    subscribeToSession(f.api, "s", (e) => got.push(e.seq));
    f.push(ev(5)); f.push(ev(6)); f.push({ event: ev(6) }); f.push(ev(7));
    expect(got).toEqual([5, 6, 7]);
  });

  it("after a reconnect, an answer rejected during the outage is delivered from the last seen sequence", async () => {
    const f = fakeApi({ getSessionEvents: [ev(7, "session.answer_rejected"), ev(6), ev(8)] });
    const got: Array<[number, string]> = [];
    subscribeToSession(f.api, "s", (e) => got.push([e.seq, e.eventType]));
    f.push(ev(5)); f.push(ev(6));
    await f.reconnect();
    expect(f.calls[0]).toEqual({ name: "getSessionEvents", params: { sessionId: "s", afterSeq: 6, limit: 200 } });
    expect(got).toEqual([[5, "assistant.message"], [6, "assistant.message"], [7, "session.answer_rejected"], [8, "assistant.message"]]);
  });

  it("with no live event seen yet, a reconnect reads the newest events instead of nothing", async () => {
    const f = fakeApi({ getSessionEventsBefore: [ev(3, "session.answer_rejected"), ev(2)] });
    const got: number[] = [];
    subscribeToSession(f.api, "s", (e) => got.push(e.seq));
    await f.reconnect();
    expect(f.calls[0].name).toBe("getSessionEventsBefore");
    expect(got).toEqual([2, 3]);
  });

  it("a failed catch-up does not break the live stream", async () => {
    const f = fakeApi();
    f.api.call = async () => { throw new Error("offline"); };
    const got: number[] = [];
    subscribeToSession(f.api, "s", (e) => got.push(e.seq));
    f.push(ev(1));
    await f.reconnect();
    f.push(ev(2));
    expect(got).toEqual([1, 2]);
  });

  it("nothing is delivered after unsubscribe, even from a catch-up still in flight", async () => {
    const f = fakeApi({ getSessionEvents: [ev(9)] });
    const got: number[] = [];
    const off = subscribeToSession(f.api, "s", (e) => got.push(e.seq));
    f.push(ev(1));
    const pending = f.reconnect();
    off();
    await pending;
    expect(got).toEqual([1]);
  });
});

describe("the rejection notice", () => {
  it("is shown once per event wherever it is first seen, never for old history", async () => {
    const { toast } = await import("sonner");
    const { announceAnswerRejected } = await import("@/lib/answer-rejection");
    const e = ev(41, "session.answer_rejected");
    expect(announceAnswerRejected("s", e)).toBe(true);
    expect(announceAnswerRejected("s", e)).toBe(false);
    expect(announceAnswerRejected("s", { ...ev(42, "session.answer_rejected"), createdAt: Date.now() - 10 * 60_000 })).toBe(false);
    expect(announceAnswerRejected("s", ev(43))).toBe(false);
    expect((toast.error as any).mock.calls).toHaveLength(1);
  });
});
