import { describe, expect, it } from "vitest";
import { baselineOf, isDirty, planSave } from "./working-folder-form";

describe("working-folder form baseline", () => {
  it("saves under the revision the form was loaded from, not the refreshed one", () => {
    const loaded = baselineOf(1, "projects", "api");        // the person opens the form at revision 1 and edits
    // A refresh brings revision 2 (someone else changed it). A plain save must NOT carry the old draft under revision 2.
    expect(planSave(loaded, 2)).toEqual({ action: "conflict" });
    // With no newer revision the save carries the loaded one.
    expect(planSave(loaded, 1)).toEqual({ action: "save", expectedRevision: 1 });
  });
  it("lets the person keep their edits on purpose, against the newer revision", () => {
    expect(planSave(baselineOf(1, "projects", "api"), 2, "keep")).toEqual({ action: "save", expectedRevision: 2 });
  });
  it("never asks to resolve anything when nothing moved, even with Keep chosen", () => {
    expect(planSave(baselineOf(3, "r", ""), 3, "keep")).toEqual({ action: "save", expectedRevision: 3 });
  });
  it("judges 'edited' against the frozen values, not the refreshed record", () => {
    const loaded = baselineOf(1, "projects", "api");
    expect(isDirty({ root: "projects", folder: "api", extrasTouched: false }, loaded)).toBe(false);
    expect(isDirty({ root: "projects", folder: "web", extrasTouched: false }, loaded)).toBe(true);
    expect(isDirty({ root: " projects ", folder: " api ", extrasTouched: false }, loaded)).toBe(false);
    expect(isDirty({ root: "projects", folder: "api", extrasTouched: true }, loaded)).toBe(true);
    // No record yet: anything typed in the root is an edit.
    expect(isDirty({ root: "", folder: "", extrasTouched: false }, null)).toBe(false);
    expect(isDirty({ root: "shared", folder: "", extrasTouched: false }, null)).toBe(true);
  });
});
