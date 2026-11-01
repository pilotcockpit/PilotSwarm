import { describe, expect, it } from "vitest";
import { composerRows } from "./composer-layout";

describe("composer layout", () => {
  it("opens at one line on a phone so the composer stays short above the keyboard", () => {
    expect(composerRows(true)).toBe(1);
  });
  it("opens at two lines on a wider screen", () => {
    expect(composerRows(false)).toBe(2);
  });
});
