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

import { buildSave, deriveExtraName, MAX_EXTRAS } from "./working-folder-form";

describe("buildSave: the request a Save makes", () => {
  const form = { root: "projects", folder: "api/", extrasTouched: false, extras: [] };
  it("with no refresh in between, sends exactly the baseline revision it was loaded from", () => {
    const loaded = baselineOf(4, "projects", "web");           // opened at revision 4, then edited the folder
    const req = buildSave(form, loaded, 4);                    // the server is still at revision 4
    expect(req).toEqual({ action: "save", expectedRevision: 4, workspace: { root: "projects", folder: "api" } });
  });
  it("sends nothing when the record moved on, until the person chooses", () => {
    const loaded = baselineOf(4, "projects", "web");
    expect(buildSave(form, loaded, 5)).toEqual({ action: "conflict" });                           // refresh brought revision 5: no request
    expect(buildSave(form, loaded, 5, "keep")).toMatchObject({ action: "save", expectedRevision: 5 }); // "Keep my edits": against what they just saw
  });
  it("carries edited extra folders and leaves them out when untouched", () => {
    const loaded = baselineOf(1, "projects", "");
    const touched = buildSave({ ...form, extrasTouched: true, extras: [{ name: "notes", root: " shared ", folder: "n/" }, { name: "", root: "x", folder: "" }] }, loaded, 1);
    expect(touched).toMatchObject({ action: "save", workspace: { extra: { notes: { root: "shared", folder: "n" } } } });
    expect((buildSave(form, loaded, 1) as any).workspace.extra).toBeUndefined();
  });
});

describe("optional extra folders", () => {
  const loaded = baselineOf(1, "projects", "");
  const base = { root: "projects", folder: "", extrasTouched: true };
  it("keeps an extra optional when it was optional, and leaves the flag out when it is required", () => {
    const req = buildSave({ ...base, extras: [{ name: "notes", root: "shared", folder: "n", required: false }, { name: "ref", root: "shared", folder: "r" }, { name: "lib", root: "shared", folder: "l", required: true }] }, loaded, 1) as any;
    expect(req.workspace.extra).toEqual({ notes: { root: "shared", folder: "n", required: false }, ref: { root: "shared", folder: "r" }, lib: { root: "shared", folder: "l" } });
  });
});

describe("naming an additional folder", () => {
  it("takes the last part of the path, or the root when there is no path", () => {
    expect(deriveExtraName("shared", "team/notes/", [])).toBe("notes");
    expect(deriveExtraName("shared", "", [])).toBe("shared");
  });
  it("cleans it to what the server accepts", () => {
    expect(deriveExtraName("r", "My Docs & Stuff!", [])).toBe("my-docs-stuff");
    expect(deriveExtraName("r", "api.v2", [])).toBe("api-v2");
    expect(deriveExtraName("r", "_hidden", [])).toBe("hidden");
    expect(deriveExtraName("r", "a".repeat(80), []).length).toBeLessThanOrEqual(32);
    expect(deriveExtraName("", "", [])).toBe("");
  });
  it("never makes a name the SDK reserves", () => {
    expect(deriveExtraName("r", "work", [])).toBe("work-2");
    expect(deriveExtraName("r", "constructor", [])).toBe("constructor-2");
    expect(deriveExtraName("work", "", [])).toBe("work-2");
  });
  it("never repeats a name already taken", () => {
    expect(deriveExtraName("r", "notes", ["notes"])).toBe("notes-2");
    expect(deriveExtraName("r", "notes", ["notes", "notes-2"])).toBe("notes-3");
  });
  it("allows four additional folders", () => { expect(MAX_EXTRAS).toBe(4); });
});
