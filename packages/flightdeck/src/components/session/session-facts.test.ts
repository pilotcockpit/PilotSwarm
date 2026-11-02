import { describe, expect, it } from "vitest";
import type { Session } from "@/data/types";
import { sessionFacts } from "./session-facts";

const s = (id: string, extra: Partial<Session> = {}): Session => ({ sessionId: id, title: id, status: "idle", ...extra }) as Session;
const groups = [{ id: "g0", name: "Work" }];

describe("session facts", () => {
  it("names the project the session's tree is filed in, even for a sub-agent", () => {
    const all = [s("root", { groupId: "g0" }), s("kid", { parentSessionId: "root", rootSessionId: "root" })];
    expect(sessionFacts(all[0], all, groups).project).toEqual({ id: "g0", name: "Work" });
    expect(sessionFacts(all[1], all, groups).project).toEqual({ id: "g0", name: "Work" });
  });
  it("says Default for a session in no project, or one that was deleted", () => {
    expect(sessionFacts(s("a"), [s("a")], groups).project).toEqual({ id: null, name: "No project" });
    expect(sessionFacts(s("a", { groupId: "gone" }), [s("a", { groupId: "gone" })], groups).project).toEqual({ id: null, name: "No project" });
  });
  it("shows no project at all for someone who has none, so nothing new appears for them", () => {
    expect(sessionFacts(s("a"), [s("a")], []).project).toBeNull();
  });
  it("links the parent when the parent is listed, and says nothing when it is not", () => {
    const all = [s("p", { title: "Release" }), s("c", { parentSessionId: "p" })];
    expect(sessionFacts(all[1], all, groups).parent).toEqual({ id: "p", title: "Release" });
    expect(sessionFacts(s("c", { parentSessionId: "gone" }), [s("c")], groups).parent).toBeNull();
    expect(sessionFacts(all[0], all, groups).parent).toBeNull();
  });
  it("reports the context tier only when the server sent one", () => {
    expect(sessionFacts(s("a", { contextTier: " long " }), [], groups).tier).toBe("long");
    expect(sessionFacts(s("a"), [], groups).tier).toBeNull();
    expect(sessionFacts(s("a", { contextTier: "" }), [], groups).tier).toBeNull();
  });
});
