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
