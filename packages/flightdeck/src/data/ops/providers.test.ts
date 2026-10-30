import { describe, expect, it } from "vitest";
import { editableTokens, parseTokens } from "./providers";

describe("limit editor", () => {
  it("keeps the exact integer when a limit is opened and saved without edits", () => {
    const quota = 1_234_567;
    expect(parseTokens(editableTokens(quota))).toBe(quota);
  });
  it("still takes compact input", () => {
    expect(parseTokens("1.5M")).toBe(1_500_000);
    expect(parseTokens("250k")).toBe(250_000);
    expect(parseTokens("1,234,567")).toBe(1_234_567);
    expect(parseTokens("lots")).toBeNull();
  });
});
