import { describe, expect, it } from "vitest";
import { canvasName } from "./CanvasFrame";

describe("a canvas's display name", () => {
  it("prefers the title, then the first heading, then the slot", () => {
    expect(canvasName("<title>Release checklist · 0.8.8</title><h1>Other</h1>", 1)).toBe("Release checklist");
    expect(canvasName("<h1>Test matrix</h1>", 2)).toBe("Test matrix");
    expect(canvasName("<p>nothing</p>", 3)).toBe("Canvas 3");
    expect(canvasName(undefined, 1)).toBe("Canvas 1");
  });
  it("keeps only the text of a heading", () => {
    expect(canvasName("<h1>Plan <b>A</b> <em>now</em></h1>", 1)).toBe("Plan A now");
  });
  it("never lets markup through, however it is broken up", () => {
    for (const html of ["<h1><scr<b>ipt>alert(1)</scr</b>ipt></h1>", "<h1>a<<b>script>b</h1>", "<h1>x<img src=y onerror=z</h1>", "<h1><</h1>"]) {
      const name = canvasName(html, 1);
      expect(name).not.toMatch(/[<>]/);
    }
  });
});
