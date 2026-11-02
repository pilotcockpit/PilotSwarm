import { afterEach, describe, expect, it } from "vitest";
import { act, render } from "@/test/render";
import { usePref } from "@/shell/prefs";
import { forgetOldSidebarKeys, prefKey, readStringSet } from "./prefs";

(globalThis as any).window = globalThis;

describe("stored sidebar preferences are untrusted", () => {
  // These shapes used to crash the shell: valid JSON of the wrong type reached .filter() and Object spread.
  it("reads pins only from an array of strings", () => {
    for (const raw of ["{}", "42", "false", "null", "\"x\"", "not json", ""]) expect([...readStringSet(raw)]).toEqual([]);
    expect([...readStringSet('["a",1,null,"b",{"c":1}]')]).toEqual(["a", "b"]);
  });
});

describe("preferences are scoped to the person and the data source", () => {
  it("gives two people on one browser different keys", () => {
    expect(prefKey("live:github:alice", "pins")).not.toBe(prefKey("live:github:bob", "pins"));
    expect(prefKey("live:github:alice", "pins")).not.toBe(prefKey("demo:github:alice", "pins"));
    expect(prefKey("live:github:alice", "pins")).not.toBe(prefKey("live:github:alice", "pins.projects"));
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

describe("the keys the old sidebar left behind", () => {
  it("removes the fold and open-project keys of every person, and nothing else", () => {
    const store = new Map<string, string>([
      ["fd.sidebar.collapsed@demo:p:a", "{}"], ["fd.sidebar.project@live:p:b", "x"], ["fd.sidebar.collapsed@pending", "{}"],
      ["fd.pins@demo:p:a", "[]"], ["fd.theme", "dark"], ["fd.sidebarWidth", "300"],
    ]);
    forgetOldSidebarKeys({ get length() { return store.size; }, key: (i) => [...store.keys()][i] ?? null, removeItem: (k) => void store.delete(k) });
    expect([...store.keys()].sort()).toEqual(["fd.pins@demo:p:a", "fd.sidebarWidth", "fd.theme"]);
  });
  it("does not throw when storage is refused", () => {
    expect(() => forgetOldSidebarKeys({ get length(): number { throw new Error("denied"); }, key: () => null, removeItem: () => undefined })).not.toThrow();
  });
});
