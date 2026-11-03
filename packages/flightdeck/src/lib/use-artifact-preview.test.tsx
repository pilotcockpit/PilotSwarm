import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { Providers } from "@/test/harness";
import { CARD_PREVIEW_BYTES } from "./preview-limits";
import { useCanvasPreview } from "./use-artifact-preview";

// The REAL hook the Home output cards call, under real React, with a source that counts what it is asked
// to read. Making the hook ignore the size metadata, or read without a bound, fails these.

function source(answer: (id: string, filename: string, maxBytes: number) => { text: string; truncated: boolean }) {
  const reads: Array<{ id: string; filename: string; maxBytes: number }> = [];
  const full: string[] = [];
  return {
    reads, full,
    source: {
      kind: "demo", label: "stub",
      readArtifactPreview: async (id: string, filename: string, maxBytes: number) => { reads.push({ id, filename, maxBytes }); return answer(id, filename, maxBytes); },
      readArtifact: async (_id: string, filename: string) => { full.push(filename); return ""; },
    } as any,
  };
}
type Preview = ReturnType<typeof useCanvasPreview>;
async function run(size: unknown, answer: Parameters<typeof source>[0], canvas = true) {
  const s = source(answer);
  const out: { current?: Preview } = {};
  function Probe() { out.current = useCanvasPreview({ sessionId: "s1", filename: "canvas.html", updatedAt: 1, size, canvas }); return null; }
  const r = await render(<Providers source={s.source}><Probe /></Providers>);
  await r.flush();
  const result = { ...s, get now() { return out.current!; } };
  await r.unmount();
  return result;
}

describe("useCanvasPreview", () => {
  it("never downloads a document whose metadata says it is too large", async () => {
    const r = await run(5 * 1024 * 1024, () => ({ text: "<p>x</p>", truncated: false }));
    expect(r.reads).toEqual([]);
    expect(r.full).toEqual([]);                      // and never falls back to the unbounded read
    expect(r.now.fit).toBe("none");
    expect(r.now.html).toBeUndefined();
  });
  it("leaves a mid-size document to the inspector, with no card read", async () => {
    const r = await run(CARD_PREVIEW_BYTES + 10, () => ({ text: "<p>x</p>", truncated: false }));
    expect(r.reads).toEqual([]);
    expect(r.now.fit).toBe("inspector");
    expect(r.now.html).toBeUndefined();
  });
  it("reads a small document with the card bound and shows it", async () => {
    const r = await run(2_000, () => ({ text: "<h1>Report</h1>", truncated: false }));
    expect(r.reads).toEqual([{ id: "s1", filename: "canvas.html", maxBytes: CARD_PREVIEW_BYTES }]);
    expect(r.now).toMatchObject({ html: "<h1>Report</h1>", fit: "card", failed: false });
  });
  it("reads with the bound when the size is unknown, and a truncated read means it did not fit", async () => {
    const r = await run(undefined, () => ({ text: "<h1>Rep", truncated: true }));
    expect(r.reads[0].maxBytes).toBe(CARD_PREVIEW_BYTES);
    expect(r.now.html).toBeUndefined();              // never render half a document
    expect(r.now.fit).toBe("inspector");
  });
  it("does not read at all for a file that is not a canvas", async () => {
    const r = await run(100, () => ({ text: "x", truncated: false }), false);
    expect(r.reads).toEqual([]);
  });
});
