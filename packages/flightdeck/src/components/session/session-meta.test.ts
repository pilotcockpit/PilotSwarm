import { describe, expect, it } from "vitest";
import { contextFill, contextPercent } from "./session-meta";

// The SDK sends utilization as currentTokens / tokenLimit: a ratio, never a percentage.
describe("context window fill", () => {
  it("reads a ratio as a percentage", () => {
    expect(contextFill(0.38)).toEqual({ percent: 38, meter: 38, over: false });
    expect(contextFill(0)).toEqual({ percent: 0, meter: 0, over: false });
    expect(contextFill(1)).toEqual({ percent: 100, meter: 100, over: false });
  });
  it("does not mistake a ratio above 1 for a percentage: 1.2 is 120%, over the limit", () => {
    expect(contextFill(1.2)).toEqual({ percent: 120, meter: 100, over: true });
    expect(contextFill(40)).toMatchObject({ percent: 4000, meter: 100, over: true });
  });
  it("shows nothing for a value that cannot be a fill", () => {
    for (const v of [-0.1, -1, Number.NaN, Infinity, null, undefined, "0.5", {}]) expect(contextFill(v)).toBeNull();
  });
  it("the meter value is always a valid 0–100", () => {
    for (const v of [0, 0.004, 0.5, 0.995, 1, 1.0001, 3, 99]) {
      const f = contextFill(v)!;
      expect(f.meter).toBeGreaterThanOrEqual(0);
      expect(f.meter).toBeLessThanOrEqual(100);
    }
  });
  it("contextPercent keeps the honest number", () => {
    expect(contextPercent({ contextUsage: { utilization: 1.2 } } as any)).toBe(120);
    expect(contextPercent({ contextUsage: { utilization: -0.1 } } as any)).toBeNull();
    expect(contextPercent({} as any)).toBeNull();
  });
});
