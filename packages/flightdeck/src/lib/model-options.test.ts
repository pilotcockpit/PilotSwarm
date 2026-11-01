import { describe, expect, it } from "vitest";
import type { Model } from "@/data/types";
import { changeRequest, currentSelection, folderChipLabel, folderWarning, groupModels, modelChipLabel, normaliseSelection, settingsLockedReason } from "./model-options";

const sonnet: Model = { qualifiedName: "a:claude-sonnet-5", providerId: "a", modelName: "claude-sonnet-5", supportedReasoningEfforts: ["low", "high"], supportedContextTiers: ["standard", "extended"], credentialAvailable: true };
const plain: Model = { qualifiedName: "b:gpt-5.6", providerId: "b", modelName: "gpt-5.6", credentialAvailable: true };
const blocked: Model = { qualifiedName: "c:opus", providerId: "c", modelName: "opus", credentialAvailable: false };
const session = { model: "a:claude-sonnet-5", reasoningEffort: "high", contextTier: "standard" };

describe("what a model change sends", () => {
  it("leaves out an option the person did not change, so the server keeps it", () => {
    const req = changeRequest(session, { model: "a:claude-sonnet-5", effort: "high", tier: "standard" });
    expect(req.changed).toBe(false);
    expect(req.options).toEqual({});
  });
  it("sends only the effort when only the effort changed", () => {
    const req = changeRequest(session, { model: "a:claude-sonnet-5", effort: "low", tier: "standard" });
    expect(req).toEqual({ model: "a:claude-sonnet-5", options: { reasoningEffort: "low" }, changed: true });
    expect("contextTier" in req.options).toBe(false);
  });
  it("sends null to clear an effort the new model does not offer", () => {
    const sel = normaliseSelection({ model: "b:gpt-5.6", effort: "high", tier: "standard" }, plain);
    expect(sel).toEqual({ model: "b:gpt-5.6", effort: null, tier: null });
    expect(changeRequest(session, sel).options).toEqual({ reasoningEffort: null, contextTier: null });
  });
  it("switching to a model with the same settings sends just the model", () => {
    const sel = normaliseSelection({ model: "a:claude-sonnet-5", effort: "high", tier: "standard" }, sonnet);
    expect(changeRequest({ ...session, model: "x:other" }, sel)).toEqual({ model: "a:claude-sonnet-5", options: {}, changed: true });
  });
  it("reads the session's current selection, with none as null", () => {
    expect(currentSelection({ model: "a:m" })).toEqual({ model: "a:m", effort: null, tier: null });
  });
});

describe("the model list", () => {
  it("groups by provider with usable models first", () => {
    const groups = groupModels([blocked, plain, sonnet, { ...plain, qualifiedName: "b:x", modelName: "x", credentialAvailable: false }]);
    expect(groups.map((g) => g.providerId)).toEqual(["b", "a", "c"]);
    expect(groups[0].models.map((m) => m.modelName)).toEqual(["gpt-5.6", "x"]);
  });
});

describe("chip labels and warnings", () => {
  it("drops the vendor prefix and appends the effort", () => {
    expect(modelChipLabel({ model: "a:claude-sonnet-5", reasoningEffort: "high" })).toBe("sonnet-5 · high");
    expect(modelChipLabel({ model: "b:gpt-5.6" })).toBe("gpt-5.6");
  });
  it("uses the last segment of the working folder", () => {
    expect(folderChipLabel({ root: "/repos", folder: "pilotswarm/dev" })).toBe("dev");
    expect(folderChipLabel(null, "/Users/me/code/app/")).toBe("app");
    expect(folderChipLabel(null)).toBeNull();
  });
  it("warns when the folder is unavailable or prompts are held", () => {
    expect(folderWarning({ status: "ready", heldPrompts: 0 })).toBeNull();
    expect(folderWarning({ status: "unavailable", lastError: { message: "disk gone" } })).toContain("disk gone");
    expect(folderWarning({ status: "ready", heldPrompts: 2 })).toBe("2 messages are waiting for the folder");
    expect(folderWarning({ status: "ready", heldPrompts: 1 })).toBe("1 message is waiting for the folder");
  });
});

describe("who can change the settings", () => {
  it("locks them for system sessions, view-only people and non-managers", () => {
    expect(settingsLockedReason({ isSystem: true })).toMatch(/System sessions/);
    expect(settingsLockedReason({ canWrite: false })).toMatch(/View-only/);
    expect(settingsLockedReason({ canManage: false })).toMatch(/owner or an admin/);
    expect(settingsLockedReason({ canWrite: true, owner: "me" })).toBeNull();
  });
});
