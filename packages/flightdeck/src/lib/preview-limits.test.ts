import { describe, expect, it } from "vitest";
import { CARD_PREVIEW_BYTES, INSPECTOR_PREVIEW_BYTES, previewFit } from "./preview-limits";

describe("previewFit", () => {
  it("previews on the card up to the card limit, in the inspector up to the inspector limit, never beyond", () => {
    expect(previewFit(0)).toBe("card");
    expect(previewFit(CARD_PREVIEW_BYTES)).toBe("card");
    expect(previewFit(CARD_PREVIEW_BYTES + 1)).toBe("inspector");
    expect(previewFit(INSPECTOR_PREVIEW_BYTES)).toBe("inspector");
    expect(previewFit(INSPECTOR_PREVIEW_BYTES + 1)).toBe("none");
    expect(previewFit(50 * 1024 * 1024)).toBe("none");
  });
  it("lets the bounded read decide when the size is unknown or odd", () => {
    for (const v of [undefined, null, NaN, -1, "big", Infinity]) expect(previewFit(v)).toBe("card");
  });
  it("never promises more than the server reads: the inspector limit is the server's 1 MiB cap", () => {
    expect(INSPECTOR_PREVIEW_BYTES).toBe(1024 * 1024);
  });
});
