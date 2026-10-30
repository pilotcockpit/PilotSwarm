import { describe, expect, it } from "vitest";
import { createFocusReturn } from "./focus-return";

const el = (name: string, log: string[], connected = true) => ({ isConnected: connected, focus: () => log.push(name) });

describe("focus return", () => {
  it("returns focus to whichever invoker opened THIS dialog, one open after another", () => {
    const log: string[] = [];
    let active: unknown = el("body-at-load", log);   // what had focus when the page first rendered
    const t = createFocusReturn(() => active);
    // The component rendered long ago (closed). Nothing is captured until the dialog opens.
    active = el("invoker A", log);
    t.capture();
    expect(t.restore()).toBe(true);
    active = el("invoker B", log);
    t.capture();
    expect(t.restore()).toBe(true);
    expect(log).toEqual(["invoker A", "invoker B"]);
  });
  it("keeps the first capture while the dialog stays open", () => {
    const log: string[] = [];
    let active: unknown = el("A", log);
    const t = createFocusReturn(() => active);
    t.capture();
    active = el("something inside the dialog", log);
    t.capture();
    t.restore();
    expect(log).toEqual(["A"]);
  });
  it("lets Radix decide when the invoker is gone or was the page body", () => {
    const log: string[] = [];
    const t = createFocusReturn(() => el("gone", log, false));
    t.capture();
    expect(t.restore()).toBe(false);
    const body = el("body", log);
    const t2 = createFocusReturn(() => body);
    t2.capture();
    expect(t2.restore((x) => x === body)).toBe(false);
    expect(log).toEqual([]);
  });
});
