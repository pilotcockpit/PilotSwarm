import { afterEach, describe, expect, it } from "vitest";
import { act, render } from "@/test/render";
import { usePref } from "@/shell/prefs";
import { prefKey, readBooleanRecord, readGroupBy, readStateFilter, readStringSet } from "./prefs";

(globalThis as any).window = globalThis;

describe("stored sidebar preferences are untrusted", () => {
  // These shapes used to crash the shell: valid JSON of the wrong type reached .filter() and Object spread.
  it("reads pins only from an array of strings", () => {
    for (const raw of ["{}", "42", "false", "null", "\"x\"", "not json", ""]) expect([...readStringSet(raw)]).toEqual([]);
    expect([...readStringSet('["a",1,null,"b",{"c":1}]')]).toEqual(["a", "b"]);
  });
  it("reads collapsed sections only from a record of booleans", () => {
    for (const raw of ["[]", "42", "false", "null", "not json", ""]) expect(readBooleanRecord(raw)).toEqual({});
    expect(readBooleanRecord('{"a":true,"b":"yes","c":false,"d":1}')).toEqual({ a: true, c: false });
  });
  it("accepts only known group-by and state values", () => {
    expect(readGroupBy("agent")).toBe("agent");
    expect(readGroupBy("folder")).toBe("groups");
    expect(readGroupBy("")).toBe("groups");
    expect(readStateFilter("needs")).toBe("needs");
    expect(readStateFilter("__proto__")).toBeNull();
    expect(readStateFilter("toString")).toBeNull();
    expect(readStateFilter("sideways")).toBeNull();
    expect(readStateFilter("")).toBeNull();
  });
});

describe("preferences are scoped to the person and the data source", () => {
  it("gives two people on one browser different keys", () => {
    expect(prefKey("live:github:alice", "pins")).not.toBe(prefKey("live:github:bob", "pins"));
    expect(prefKey("live:github:alice", "pins")).not.toBe(prefKey("demo:github:alice", "pins"));
    expect(prefKey("live:github:alice", "pins")).not.toBe(prefKey("live:github:alice", "sidebar.collapsed"));
  });
  it("never uses the old shared key", () => {
    expect(prefKey("live:github:alice", "pins")).not.toBe("fd.pins");
    expect(prefKey(null, "pins")).not.toBe("fd.pins");
  });
});

describe("a preference still changes when the browser refuses storage", () => {
  const original = (globalThis as any).localStorage;
  afterEach(() => { (globalThis as any).localStorage = original; });
  it("holds the new value in memory for this page", async () => {
    (globalThis as any).localStorage = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); }, removeItem: () => {} };
    const out: { value?: string; set?: (v: string) => void } = {};
    function Probe() { const [v, set] = usePref<string>("fd.test.quota", "a"); out.value = v; out.set = set; return null; }
    const r = await render(<Probe />);
    expect(out.value).toBe("a");
    await act(() => out.set!("b"));
    expect(out.value).toBe("b");
    await r.unmount();
  });
});
