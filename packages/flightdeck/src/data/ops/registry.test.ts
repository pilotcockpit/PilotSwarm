import { beforeEach, describe, expect, it } from "vitest";
import { callDemoOp, registerDemoOps, resetDemoOps } from "./registry";

describe("demo op registry", () => {
  beforeEach(() => { resetDemoOps(); (globalThis as any).window = { setTimeout: (fn: () => void) => setTimeout(fn, 0) }; });

  it("answers a registered op and refuses an unknown one", async () => {
    registerDemoOps("file:///a.demo.ts", { ping: () => "pong" });
    await expect(callDemoOp("ping")).resolves.toBe("pong");
    await expect(callDemoOp("nope")).rejects.toThrow(/not part of the demo data/);
  });
  it("lets one file register again (hot reload), even with a cache-busting query", () => {
    registerDemoOps("file:///a.demo.ts", { ping: () => 1 });
    expect(() => registerDemoOps("file:///a.demo.ts?t=123", { ping: () => 2 })).not.toThrow();
  });
  it("throws when a second file claims an operation", () => {
    registerDemoOps("file:///a.demo.ts", { exportExecutionHistory: () => 1 });
    expect(() => registerDemoOps("file:///b.demo.ts", { exportExecutionHistory: () => 2 })).toThrow(/registered by both/);
  });
});
