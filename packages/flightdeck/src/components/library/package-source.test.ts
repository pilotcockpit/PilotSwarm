import { describe, expect, it } from "vitest";
import { analyzePackage, normalizeFiles, readZip, MAX_BYTES, type LocalFile } from "./package-source";

const enc = new TextEncoder();
const f = (path: string, text = ""): LocalFile => ({ path, bytes: enc.encode(text) });
const manifest = (o: object) => f("plugin.json", JSON.stringify(o));

describe("normalizeFiles", () => {
  it("lifts a single wrapping folder and drops junk", () => {
    const r = normalizeFiles([f("kit/plugin.json", "{}"), f("kit/skills/a/SKILL.md"), f("kit/.git/HEAD"), f("kit/node_modules/x/index.js"), f("kit/.DS_Store")]);
    expect(r.files.map((x) => x.path)).toEqual(["plugin.json", "skills/a/SKILL.md"]);
    expect(r.skipped).toBe(3);
  });
  it("keeps paths when plugin.json is already at the root", () => {
    expect(normalizeFiles([f("plugin.json", "{}"), f("agents/x.agent.md")]).files.map((x) => x.path)).toEqual(["plugin.json", "agents/x.agent.md"]);
  });
});

describe("analyzePackage", () => {
  it("reads identity and contents", () => {
    const a = analyzePackage([manifest({ name: "kit", version: "1.2.3", description: "d" }), f("agents/triager.agent.md"), f("skills/style/SKILL.md"), f("worker-module.js")]);
    expect(a).toMatchObject({ name: "kit", version: "1.2.3", description: "d", agents: ["triager"], skills: ["style"], tools: true, mcp: false });
    expect(a.issues.filter((i) => i.level === "error")).toEqual([]);
  });
  it("explains what is wrong in plain words", () => {
    expect(analyzePackage([f("skills/a/SKILL.md")]).issues[0].message).toMatch(/no plugin\.json/i);
    expect(analyzePackage([f("plugin.json", "{")]).issues[0].message).toMatch(/not valid JSON/);
    const e = analyzePackage([manifest({ description: "x" }), f("skills/a/SKILL.md")]).issues.map((i) => i.message).join(" ");
    expect(e).toMatch(/needs a name/);
    expect(e).toMatch(/needs a version/);
  });
  it("enforces the 2 MB limit", () => {
    const big: LocalFile = { path: "data.bin", bytes: new Uint8Array(MAX_BYTES + 1) };
    expect(analyzePackage([manifest({ name: "k", version: "1.0.0" }), big]).issues.some((i) => i.level === "error" && /2 MB/.test(i.message))).toBe(true);
  });
  it("warns about an empty package and an odd version", () => {
    const w = analyzePackage([manifest({ name: "k", version: "v1" })]).issues.map((i) => i.message).join(" ");
    expect(w).toMatch(/would be empty/);
    expect(w).toMatch(/three-part version/);
  });
});

/** A one-entry stored zip, built by hand: local header, data, central directory, end record. */
function storedZip(name: string, text: string): Blob {
  const n = enc.encode(name), d = enc.encode(text);
  const local = new Uint8Array(30 + n.length + d.length), lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true); lv.setUint16(26, n.length, true); lv.setUint32(18, d.length, true); lv.setUint32(22, d.length, true);
  local.set(n, 30); local.set(d, 30 + n.length);
  const central = new Uint8Array(46 + n.length), cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true); cv.setUint32(20, d.length, true); cv.setUint32(24, d.length, true); cv.setUint16(28, n.length, true); cv.setUint32(42, 0, true);
  central.set(n, 46);
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, 1, true); ev.setUint16(10, 1, true); ev.setUint32(12, central.length, true); ev.setUint32(16, local.length, true);
  return new Blob([local, central, end]);
}

describe("readZip", () => {
  it("reads a stored entry", async () => {
    const r = await readZip(storedZip("plugin.json", '{"name":"k"}'));
    expect(r.files).toHaveLength(1);
    expect(new TextDecoder().decode(r.files[0].bytes)).toBe('{"name":"k"}');
  });
  it("rejects a file that is not a zip", async () => {
    await expect(readZip(new Blob(["nope"]))).rejects.toThrow(/not a valid \.zip/);
  });
});
