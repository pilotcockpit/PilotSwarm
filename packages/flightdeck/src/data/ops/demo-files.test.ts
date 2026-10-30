import { describe, expect, it } from "vitest";
import { registerDemoOps, resetDemoOps } from "./registry";

// Every <area>.demo.ts file registers on import. Loading them all in one process is the real test
// that no two files claim the same operation: a duplicate throws from registerDemoOps.
describe("demo fixtures", () => {
  it("never register the same operation from two files", async () => {
    resetDemoOps();
    (globalThis as any).window = { setTimeout };
    const files = import.meta.glob("./*.demo.ts");
    expect(Object.keys(files).length).toBeGreaterThan(5);
    for (const load of Object.values(files)) await load();
    expect(typeof registerDemoOps).toBe("function");
  });
});
