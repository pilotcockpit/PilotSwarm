import { describe, expect, it } from "vitest";
import { canManage, canModify } from "./session-actions";
import { canvasSlot, isCanvasFile } from "@/routes/home";

const s = (extra: Record<string, unknown> = {}) => ({ sessionId: "s1", title: "t", status: "idle", ...extra }) as any;

// The SDK refuses rename, complete, cancel and delete on a system session, so none of them is offered.
describe("what can be done to a session", () => {
  it("an ordinary session you may manage can be changed", () => {
    expect(canManage(s())).toBe(true);
    expect(canModify(s())).toBe(true);
  });
  it("a system session cannot be renamed, completed, cancelled or deleted, even by someone who may manage it", () => {
    expect(canManage(s({ isSystem: true }))).toBe(true);
    expect(canModify(s({ isSystem: true }))).toBe(false);
  });
  it("a session you may not manage cannot be changed", () => {
    expect(canModify(s({ canManage: false }))).toBe(false);
  });
});

// The Context panel opens the canvas the person clicked, so the slot has to come from the file name.
describe("canvas outputs map to their slot", () => {
  it("canvas.html is slot 1 and canvasN.html is slot N", () => {
    expect(canvasSlot("canvas.html")).toBe(1);
    expect(canvasSlot("canvas2.html")).toBe(2);
    expect(canvasSlot("canvas5.html")).toBe(5);
  });
  it("other files are not canvases", () => {
    expect(isCanvasFile("canvas6.html")).toBe(false);
    expect(isCanvasFile("notes.md")).toBe(false);
    expect(canvasSlot("notes.md")).toBe(0);
  });
});
