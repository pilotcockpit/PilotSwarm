import { describe, expect, it, vi } from "vitest";
import { subscribeToSession, type SessionStreamApi } from "./session-stream";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

function fakeApi(rows: Record<string, any[]> = {}) {
  let handler: (m: any) => void = () => {};
  let resubscribe: () => void = () => {};
  const calls: Array<{ name: string; params: any }> = [];
  const api: SessionStreamApi = {
    subscribeSession: (_id, h, r) => { handler = h; resubscribe = r || (() => {}); return () => { handler = () => {}; }; },
    call: async (name, params) => {
      calls.push({ name, params });
      const all = rows[name] ?? [];
      if (name === "getSessionEvents") return all.filter((e: any) => e.seq > (params.afterSeq as number)).slice(0, params.limit as number);
      return all;
    },
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

  it("a failed catch-up does not break the stream: held events are delivered once a read succeeds", async () => {
    const f = fakeApi();
    const ok = f.api.call;
    const got: number[] = [];
    subscribeToSession(f.api, "s", (e) => got.push(e.seq));
    f.push(ev(1));
    f.api.call = async () => { throw new Error("offline"); };
    await f.reconnect();
    f.push(ev(2));
    await new Promise((r) => setTimeout(r, 0));
    expect(got).toEqual([1]);
    f.api.call = ok;
    f.push(ev(3));
    await new Promise((r) => setTimeout(r, 0));
    expect(got).toEqual([1, 2, 3]);
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

describe("catch-up never loses an event", () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const make = (rows: Record<string, any[]>) => {
    const f = fakeApi(rows);
    const got: Array<[number, string]> = [];
    const off = subscribeToSession(f.api, "s", (e) => got.push([e.seq, e.eventType]));
    return { f, got, off };
  };

  it("(a) a live event that lands while catching up does not swallow the missed ones", async () => {
    const { f, got } = make({ getSessionEvents: [ev(7, "session.answer_rejected"), ev(8)] });
    f.push(ev(5)); f.push(ev(6));
    let release: () => void = () => {};
    const slow = f.api.call;
    f.api.call = (name, params) => new Promise((resolve) => { release = () => resolve(slow(name, params)); });
    f.reconnect();              // catch-up starts and waits
    f.push(ev(9));              // a live event arrives meanwhile
    expect(got.map(([s]) => s)).toEqual([5, 6]);
    release(); await tick();
    expect(got.map(([s]) => s)).toEqual([5, 6, 7, 8, 9]);
    expect(got[2]).toEqual([7, "session.answer_rejected"]);
    f.push(ev(10));             // and the stream carries on live
    expect(got.map(([s]) => s)).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it("(b) a gap of more than one page is read to the end before live delivery moves on", async () => {
    const missed = Array.from({ length: 450 }, (_, i) => ev(7 + i));        // 7 .. 456
    const { f, got } = make({ getSessionEvents: missed });
    f.push(ev(6));
    await f.reconnect(); await tick();
    expect(f.calls.filter((c) => c.name === "getSessionEvents").map((c) => c.params.afterSeq)).toEqual([6, 206, 406]);
    expect(got.map(([s]) => s)).toEqual([6, ...missed.map((e) => e.seq)]);
    f.push(ev(457));
    expect(got.at(-1)![0]).toBe(457);
  });

  it("(c) a failed catch-up holds live events and never advances the cursor past the gap", async () => {
    const rows: Record<string, any[]> = { getSessionEvents: [ev(7, "session.answer_rejected"), ev(8)] };
    const { f, got, off } = make(rows);
    f.push(ev(6));
    const ok = f.api.call;
    f.api.call = async () => { throw new Error("offline"); };
    await f.reconnect(); await tick();
    f.push(ev(12));             // live resumes before the gap was read
    await tick();
    expect(got.map(([s]) => s)).toEqual([6]);
    f.api.call = ok;            // the network is back; the next live event retries
    f.push(ev(13));
    await tick();
    expect(got.map(([s]) => s)).toEqual([6, 7, 8, 12, 13]);
    expect(got[1]).toEqual([7, "session.answer_rejected"]);
    off();
  });

  it("a failure with no further live event is retried after a pause", async () => {
    vi.useFakeTimers();
    try {
      const { f, got, off } = make({ getSessionEvents: [ev(7, "session.answer_rejected")] });
      f.push(ev(6));
      const ok = f.api.call;
      f.api.call = async () => { throw new Error("offline"); };
      f.reconnect();
      await vi.advanceTimersByTimeAsync(0);
      f.api.call = ok;
      await vi.advanceTimersByTimeAsync(2_100);
      expect(got.map(([s]) => s)).toEqual([6, 7]);
      off();
    } finally { vi.useRealTimers(); }
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
