import { beforeEach, describe, expect, it } from "vitest";
import { clearAllDrafts, clearDraft, dirtyDrafts, draftKey, getDraft, isDirty, setDraft, type Draft } from "./drafts";
import { isEditable } from "./keys";

const draft = (over: Partial<Draft> = {}): Draft => ({ sessionId: "s1", folderId: "working", path: "notes.md", text: "base", baseText: "base", etag: "e1", bom: false, crlf: false, ...over });

describe("drafts", () => {
  beforeEach(() => clearAllDrafts());

  it("survives the editor unmounting and carries the etag it started from", () => {
    setDraft(draft({ text: "my words" }));
    const d = getDraft(draftKey("s1", "working", "notes.md"))!;
    expect(d.text).toBe("my words");
    expect(d.etag).toBe("e1");
    expect(isDirty(d)).toBe(true);
  });
  it("lists only drafts with real changes, per session and folder", () => {
    setDraft(draft({ text: "changed" }));
    setDraft(draft({ path: "same.md", text: "base" }));
    setDraft(draft({ sessionId: "s2", text: "other session" }));
    setDraft(draft({ folderId: "extra", path: "x.md", text: "other folder" }));
    expect(dirtyDrafts("s1").map((d) => d.path).sort()).toEqual(["notes.md", "x.md"]);
    expect(dirtyDrafts("s1", "working").map((d) => d.path)).toEqual(["notes.md"]);
    expect(dirtyDrafts("s2")).toHaveLength(1);
  });
  it("clears one draft on save or discard", () => {
    setDraft(draft({ text: "changed" }));
    clearDraft(draftKey("s1", "working", "notes.md"));
    expect(dirtyDrafts("s1")).toHaveLength(0);
  });
  it("does not mix paths that only look alike", () => {
    expect(draftKey("a", "b", "c")).not.toBe(draftKey("a", "bc", ""));
  });
});

describe("isEditable", () => {
  const el = (matches: boolean) => ({ closest: () => (matches ? {} : null) }) as unknown as EventTarget;
  it("is true inside a field or the editor, so list keys leave them alone", () => {
    expect(isEditable(el(true))).toBe(true);
    expect(isEditable(el(false))).toBe(false);
    expect(isEditable(null)).toBe(false);
    expect(isEditable({} as EventTarget)).toBe(false);
  });
});
