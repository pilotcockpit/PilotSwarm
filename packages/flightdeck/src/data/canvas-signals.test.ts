import { beforeEach, describe, expect, it } from "vitest";
import { canvasUnseenNow, latestCanvasTime, markCanvasSeen, reconcile, reportCanvasTimes, setCanvasSeenScope } from "./canvas-signals";

const disk = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => void disk.set(k, v), removeItem: (k: string) => void disk.delete(k) };

describe("the newest canvas in a session's outputs", () => {
  it("counts only canvas files, from numbers or dates", () => {
    expect(latestCanvasTime(undefined)).toBe(0);
    expect(latestCanvasTime([{ filename: "notes.md", updatedAt: 900 }])).toBe(0);
    expect(latestCanvasTime([{ filename: "canvas.html", updatedAt: 100 }, { filename: "canvas3.html", updatedAt: 300 }, { filename: "report.html", updatedAt: 900 }])).toBe(300);
    expect(latestCanvasTime([{ filename: "canvas2.html", updatedAt: "2026-11-01T10:00:00Z" }])).toBe(Date.parse("2026-11-01T10:00:00Z"));
  });
});

describe("what is unseen", () => {
  it("takes a session met for the first time as seen", () => {
    const r = reconcile({}, {}, new Map([["a", 100]]));
    expect(r.unseen.size).toBe(0);
    expect(r.seen).toEqual({ a: 100 });
    expect(r.changed).toBe(true);
  });
  it("marks a session unseen when a newer canvas arrives, and not before", () => {
    const first = reconcile({}, {}, new Map([["a", 100]]));
    expect(reconcile(first.known, first.seen, new Map([["a", 100]])).unseen.size).toBe(0);
    expect([...reconcile(first.known, first.seen, new Map([["a", 250]])).unseen]).toEqual(["a"]);
  });
  it("lights the first canvas of a session that had none", () => {
    const met = reconcile({}, {}, new Map([["a", 0]]));
    expect(met.seen).toEqual({ a: 0 });
    expect([...reconcile(met.known, met.seen, new Map([["a", 400]])).unseen]).toEqual(["a"]);
  });
});

describe("the store", () => {
  beforeEach(() => { disk.clear(); setCanvasSeenScope(null); });
  it("lights a session when its canvas is rewritten, and puts the light out when it is looked at", () => {
    setCanvasSeenScope("demo:p:me");
    reportCanvasTimes(new Map([["a", 100], ["b", 100]]));
    expect(canvasUnseenNow().size).toBe(0);
    reportCanvasTimes(new Map([["a", 200], ["b", 100]]));
    expect([...canvasUnseenNow()]).toEqual(["a"]);
    markCanvasSeen("a", 200);
    expect(canvasUnseenNow().size).toBe(0);
  });
  it("keeps the light on for a session that has dropped out of the watched list", () => {
    setCanvasSeenScope("demo:p:me");
    reportCanvasTimes(new Map([["a", 100]]));
    reportCanvasTimes(new Map([["a", 200]]));
    reportCanvasTimes(new Map([["z", 50]]));
    expect(canvasUnseenNow().has("a")).toBe(true);
  });
  it("remembers what was seen for the same person, and not for another", () => {
    setCanvasSeenScope("demo:p:me");
    reportCanvasTimes(new Map([["a", 100]]));
    setCanvasSeenScope(null);
    setCanvasSeenScope("demo:p:me");
    reportCanvasTimes(new Map([["a", 300]]));
    expect(canvasUnseenNow().has("a")).toBe(true); // 100 was remembered, 300 is newer
    setCanvasSeenScope("demo:p:someone-else");
    reportCanvasTimes(new Map([["a", 300]]));
    expect(canvasUnseenNow().size).toBe(0); // their first sight
  });
  it("reads stored values of the wrong shape as nothing seen", () => {
    for (const bad of ["[]", "42", "\"x\"", "null", "not json", "{\"a\":\"late\"}"]) {
      disk.set("fd.canvasSeen@demo:p:me", bad);
      setCanvasSeenScope(null);
      setCanvasSeenScope("demo:p:me");
      reportCanvasTimes(new Map([["a", 100]]));
      expect(canvasUnseenNow().size).toBe(0);
    }
  });
  it("does nothing before there is a person to remember things for", () => {
    reportCanvasTimes(new Map([["a", 100]]));
    markCanvasSeen("a", 100);
    expect(canvasUnseenNow().size).toBe(0);
  });
});
