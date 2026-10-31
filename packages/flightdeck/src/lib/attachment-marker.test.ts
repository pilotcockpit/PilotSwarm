import { describe, expect, it } from "vitest";
import { splitAttachmentMarkers } from "./attachment-marker";

describe("splitAttachmentMarkers", () => {
  it("returns plain text untouched", () => {
    expect(splitAttachmentMarkers("hello\nworld")).toEqual({ markers: [], rest: "hello\nworld" });
  });

  it("lifts marker lines out and keeps the words", () => {
    const out = splitAttachmentMarkers("[Attached file: report.csv — artifact://s1/report-3f9a1c2e.csv]\n[Attached file: shot.png — artifact://s1/shot.png]\n\nSee the attached files.");
    expect(out.rest).toBe("See the attached files.");
    expect(out.markers).toEqual([
      { name: "report.csv", sessionId: "s1", artifact: "report-3f9a1c2e.csv", isImage: false },
      { name: "shot.png", sessionId: "s1", artifact: "shot.png", isImage: true },
    ]);
  });

  it("accepts a hyphen where an em dash was typed and names with spaces and dashes", () => {
    const out = splitAttachmentMarkers("[Attached file: Q3 plan - final.pdf - artifact://abc-1/Q3 plan - final.pdf]\n\nThanks");
    expect(out.markers[0]).toMatchObject({ name: "Q3 plan - final.pdf", artifact: "Q3 plan - final.pdf" });
    expect(out.rest).toBe("Thanks");
  });

  it("leaves a similar-looking sentence alone", () => {
    const text = "I [Attached file: not at line start] and wrote artifact://x/y";
    expect(splitAttachmentMarkers(text)).toEqual({ markers: [], rest: text });
  });

  it("keeps an empty message when only markers were sent", () => {
    expect(splitAttachmentMarkers("[Attached file: a.txt — artifact://s/a.txt]").rest).toBe("");
  });
});

import { chipModel, displayFileName, isSafeArtifactName } from "./attachment-marker";

const marker = (over: Partial<{ name: string; sessionId: string; artifact: string; isImage: boolean }> = {}) => ({ name: "shot.png", sessionId: "mine", artifact: "shot.png", isImage: true, ...over });

describe("chipModel confinement", () => {
  it("lets an image from the session on screen load a thumbnail", () => {
    expect(chipModel(marker(), "mine").thumbnailArtifact).toBe("shot.png");
  });

  it("never loads a thumbnail named for another session", () => {
    const chip = chipModel(marker({ sessionId: "foreign" }), "mine");
    expect(chip.thumbnailArtifact).toBeNull();
    expect(chip.label).toBe("shot.png");
  });

  it("never loads without a trusted session id", () => {
    expect(chipModel(marker(), null).thumbnailArtifact).toBeNull();
    expect(chipModel(marker({ sessionId: "" }), "").thumbnailArtifact).toBeNull();
  });

  it.each(["..", ".", "../x.png", "a/../b.png", "%2e%2e", "%2E%2e/x.png", "a%2fb.png", "a\\b.png", "x\u0000.png", "x\n.png", "%00.png", ""])("rejects the unsafe artifact name %j", (artifact) => {
    expect(isSafeArtifactName(artifact)).toBe(false);
    expect(chipModel(marker({ artifact }), "mine").thumbnailArtifact).toBeNull();
  });

  it("accepts ordinary names, including spaces, unicode and dots inside a name", () => {
    for (const ok of ["report-3f9a1c2e.png", "Q3 plan (final).png", "scréenshot.v2.png", "a..b.png"]) expect(isSafeArtifactName(ok)).toBe(true);
  });

  it("bounds a 100,000 character name and loads nothing for it", () => {
    const long = `${"a".repeat(100_000)}.png`;
    const chip = chipModel(marker({ name: long, artifact: long }), "mine");
    expect(chip.thumbnailArtifact).toBeNull();
    expect(chip.label.length).toBeLessThanOrEqual(120);
    expect((chip.title ?? "").length).toBeLessThanOrEqual(300);
  });

  it("strips control and direction-override characters from what people see", () => {
    expect(displayFileName("pa‮ng.exe\u0007").label).toBe("pang.exe");
  });
});
