import { describe, expect, it } from "vitest";
import { createSettingsWriter, MAX_DISMISSED, readDismissed, readPinnedProjects, readPins, settingsOf, withDismissed, withoutDismissed, withPin, withPinnedProject, withPins } from "./roaming-settings";

describe("roaming settings", () => {
  it("reads pins in order, drops junk and repeats", () => {
    expect(readPins({ pinnedSessionIds: ["b", " a ", "", 7, "b", null] })).toEqual(["b", "a"]);
    expect(readPins({ pinnedSessionIds: "nope" })).toEqual([]);
    expect(readPins({})).toEqual([]);
  });
  it("pin appends and unpin removes, leaving every other key alone", () => {
    const base = { themeId: "dark", agentPickerUsage: { coder: 3 }, pinnedSessionIds: ["a", "b"] };
    expect(withPin(base, "c", true)).toEqual({ ...base, pinnedSessionIds: ["a", "b", "c"] });
    expect(withPin(base, "a", false)).toEqual({ ...base, pinnedSessionIds: ["b"] });
    expect(withPin(base, "a", true).pinnedSessionIds).toEqual(["b", "a"]);
  });
  it("keeps the pin list bounded", () => {
    expect(readPins(withPins({}, Array.from({ length: 150 }, (_, i) => `s${i}`)))).toHaveLength(100);
  });
  it("remembers dismissals under one key and keeps the newest when it is full", () => {
    let s: Record<string, unknown> = { themeId: "dark" };
    for (let i = 0; i < MAX_DISMISSED + 10; i++) s = withDismissed(s, `k${i}`, i);
    const kept = readDismissed(s);
    expect(Object.keys(kept)).toHaveLength(MAX_DISMISSED);
    expect(kept[`k${MAX_DISMISSED + 9}`]).toBe(MAX_DISMISSED + 9);
    expect(kept.k0).toBeUndefined();
    expect(s.themeId).toBe("dark");
  });
  it("takes a dismissal back without touching the others", () => {
    const s = withDismissed(withDismissed({ themeId: "dark" }, "a", 1), "b", 2);
    expect(readDismissed(withoutDismissed(s, "a"))).toEqual({ b: 2 });
    expect(withoutDismissed(s, "a").themeId).toBe("dark");
  });
  it("pins projects in their own list, apart from sessions, keeping dismissals and everything else", () => {
    let s: Record<string, unknown> = { themeId: "dark", pinnedSessionIds: ["a"] };
    s = withDismissed(s, "k", 1);
    s = withPinnedProject(withPinnedProject(s, "g1", true), "g2", true);
    expect(readPinnedProjects(s)).toEqual(["g1", "g2"]);
    expect(readPins(s)).toEqual(["a"]);
    expect(readDismissed(s)).toEqual({ k: 1 });
    expect(readPinnedProjects(withPinnedProject(s, "g1", false))).toEqual(["g2"]);
    expect(readPinnedProjects(withPinnedProject(s, "g1", true))).toEqual(["g2", "g1"]);
    expect(readDismissed(withDismissed(s, "k2", 2))).toEqual({ k: 1, k2: 2 });
    expect(readPinnedProjects(withDismissed(s, "k2", 2))).toEqual(["g1", "g2"]); // a dismissal does not drop the pinned projects
  });
  it("treats a malformed document as empty", () => {
    expect(settingsOf(null)).toEqual({});
    expect(settingsOf({ profileSettings: [1] })).toEqual({});
    expect(readDismissed({ flightdeck: { dismissed: { a: "x", b: 2 } } })).toEqual({ b: 2 });
  });
});

describe("settings writer", () => {
  function fakeServer(initial: Record<string, unknown>) {
    let doc = initial;
    const log: string[] = [];
    const call = async (op: string, params?: Record<string, unknown>) => {
      await new Promise((r) => setTimeout(r, op === "getCurrentUserProfile" ? 5 : 1));
      if (op === "getCurrentUserProfile") { log.push("read"); return { profileSettings: structuredClone(doc) }; }
      log.push("write"); doc = structuredClone(params!.settings as Record<string, unknown>); return {};
    };
    return { call, log, get doc() { return doc; } };
  }
  it("reads the document just before every write, so another device's keys survive", async () => {
    const server = fakeServer({ themeId: "dark", pinnedSessionIds: ["a"] });
    const write = createSettingsWriter(server.call);
    server.doc.touchScale = true; // changed elsewhere since this page last looked
    await write((s) => withPin(s, "b", true));
    expect(server.doc).toEqual({ themeId: "dark", pinnedSessionIds: ["a", "b"], touchScale: true });
  });
  it("applies quick successive changes in order without losing either", async () => {
    const server = fakeServer({});
    const write = createSettingsWriter(server.call);
    await Promise.all([write((s) => withPin(s, "a", true)), write((s) => withPin(s, "b", true)), write((s) => withDismissed(s, "k", 1))]);
    expect(readPins(server.doc)).toEqual(["a", "b"]);
    expect(readDismissed(server.doc)).toEqual({ k: 1 });
    expect(server.log).toEqual(["read", "write", "read", "write", "read", "write"]);
  });
  it("a failed write does not stop the ones queued after it", async () => {
    let fail = true;
    const server = fakeServer({});
    const call = async (op: string, p?: Record<string, unknown>) => { if (op === "setCurrentUserProfileSettings" && fail) { fail = false; throw new Error("down"); } return server.call(op, p); };
    const write = createSettingsWriter(call);
    const first = write((s) => withPin(s, "a", true));
    const second = write((s) => withPin(s, "b", true));
    await expect(first).rejects.toThrow("down");
    await second;
    expect(readPins(server.doc)).toEqual(["b"]);
  });
});
