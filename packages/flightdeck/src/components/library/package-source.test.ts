import { describe, expect, it } from "vitest";
import { analyzePackage, assertSafePath, normalizeFiles, readFileList, readZip, IntakeError, MAX_BYTES, MAX_FILES, MAX_ZIP_BYTES, type LocalFile } from "./package-source";

const enc = new TextEncoder();
const f = (path: string, text = ""): LocalFile => ({ path, bytes: enc.encode(text) });
const manifest = (o: object) => f("plugin.json", JSON.stringify(o));

describe("normalizeFiles", () => {
  it("lifts a single wrapping folder and drops only OS and git leftovers", () => {
    const r = normalizeFiles([f("kit/plugin.json", "{}"), f("kit/skills/a/SKILL.md"), f("kit/.git/HEAD"), f("kit/.DS_Store"), f("kit/__MACOSX/x")]);
    expect(r.files.map((x) => x.path)).toEqual(["plugin.json", "skills/a/SKILL.md"]);
    expect(r.skipped).toBe(3);
  });
  it("ships node_modules: a package that vendors its dependencies needs them", () => {
    const r = normalizeFiles([f("kit/plugin.json", "{}"), f("kit/node_modules/left-pad/index.js")]);
    expect(r.files.map((x) => x.path)).toEqual(["plugin.json", "node_modules/left-pad/index.js"]);
    expect(r.skipped).toBe(0);
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
  it("warns about an empty package", () => {
    const w = analyzePackage([manifest({ name: "k", version: "1.0.0" })]).issues;
    expect(w.find((i) => /would be empty/.test(i.message))?.level).toBe("warning");
  });
});

describe("analyzePackage: the rules the server enforces that can be checked here", () => {
  const errors = (files: LocalFile[]) => analyzePackage(files).issues.filter((i) => i.level === "error").map((i) => i.message).join(" | ");
  const ok = (extra: Record<string, unknown> = {}) => manifest({ name: "kit", version: "1.0.0", ...extra });
  it("refuses a name that is not a DNS label", () => {
    for (const bad of ["Kit", "my_kit", "my.kit", "-kit", "kit-", "a".repeat(65)]) expect(errors([manifest({ name: bad, version: "1.0.0" }), f("skills/a/SKILL.md")]), bad).toMatch(/lowercase letters, digits and hyphens/);
    expect(errors([ok(), f("skills/a/SKILL.md")])).toBe("");
  });
  it("refuses reserved names", () => {
    for (const bad of ["sources", "upload", "worker-state", "__platform"]) expect(errors([manifest({ name: bad, version: "1.0.0" }), f("skills/a/SKILL.md")]), bad).toMatch(/reserved|lowercase/);
  });
  it("refuses a version that is not a concrete semver, as an error, not a warning", () => {
    for (const bad of ["v1.0.0", "1.0", "^1.0.0", "1.0.0.0"]) expect(errors([manifest({ name: "kit", version: bad }), f("skills/a/SKILL.md")]), bad).toMatch(/concrete version/);
    expect(errors([manifest({ name: "kit", version: "1.2.3-dev.1" }), f("skills/a/SKILL.md")])).toBe("");
  });
  it("refuses non-ASCII paths and session-policy.json", () => {
    expect(errors([ok(), f("skills/a/SKILL.md"), f("docs/résumé.md")])).toMatch(/plain ASCII/);
    expect(errors([ok(), f("skills/a/SKILL.md"), f("session-policy.json", "{}")])).toMatch(/session-policy\.json is not allowed/);
  });
  it("reads agent, skill and MCP server names from the files' own frontmatter and config, not their file names", () => {
    const a = analyzePackage([ok(), f("agents/x1.agent.md", "---\nname: release-captain\ndescription: d\n---\nbody"), f("skills/dir/SKILL.md", "---\nname: changelog\n---\n"), f(".mcp.json", JSON.stringify({ mcpServers: { kusto: {}, github: {} } }))]);
    expect(a.agents).toEqual(["release-captain"]);
    expect(a.skills).toEqual(["changelog"]);
    expect(a.mcpServers).toEqual(["github", "kusto"]);
    expect(a.mcp).toBe(true);
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

// ── hostile or oversized input ──────────────────────────────────────────────────────────────────

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

interface Entry { name: string; data: Uint8Array; method?: 0 | 8; /** What the header CLAIMS the file inflates to. */ claimed?: number }

/** A zip with any entries, any compression and any claimed size, built by hand. */
async function zipOf(entries: Entry[]): Promise<Blob> {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const method = e.method ?? 0;
    const body = method === 8 ? await deflateRaw(e.data) : e.data;
    const local = new Uint8Array(30 + name.length + body.length), lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(8, method, true); lv.setUint32(18, body.length, true); lv.setUint32(22, e.claimed ?? e.data.length, true); lv.setUint16(26, name.length, true);
    local.set(name, 30); local.set(body, 30 + name.length);
    const c = new Uint8Array(46 + name.length), cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(10, method, true); cv.setUint32(20, body.length, true); cv.setUint32(24, e.claimed ?? e.data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
    c.set(name, 46);
    parts.push(local); central.push(c); offset += local.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true); ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end] as BlobPart[]);
}

const zeros = (n: number) => new Uint8Array(n);

describe("assertSafePath", () => {
  it("refuses traversal, absolute and backslash paths instead of normalising them", () => {
    for (const bad of ["../plugin.json", "a/../../b", "/etc/passwd", "\\\\server\\share", "C:\\x", "a\\b", "./x", ""]) expect(() => assertSafePath(bad)).toThrow(IntakeError);
    for (const ok of ["plugin.json", "agents/a.agent.md", "skills/s/SKILL.md", ".mcp.json"]) expect(() => assertSafePath(ok)).not.toThrow();
  });
});

describe("readZip limits", () => {
  it("STOPS inflating at the cap when the header lies about the size", async () => {
    // 64 MB of zeros deflates to a few hundred KB: well under the 4 MB input cap, far over the 2 MB output
    // cap, and the header claims 10 bytes, so only the streaming cap can stop it. Count what the inflater
    // actually produced: a cap applied after the fact (reject the finished result) would let all 64 MB through.
    const bomb = await zipOf([{ name: "plugin.json", data: zeros(64 * 1024 * 1024), method: 8, claimed: 10 }]);
    expect(bomb.size).toBeLessThan(MAX_ZIP_BYTES);
    const Real = globalThis.DecompressionStream;
    let produced = 0;
    (globalThis as any).DecompressionStream = class {
      readable: ReadableStream<Uint8Array>;
      writable: WritableStream<Uint8Array>;
      constructor(format: string) {
        const real = new Real(format as any);
        this.writable = real.writable as WritableStream<Uint8Array>;
        this.readable = (real.readable as ReadableStream<Uint8Array>).pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) { produced += chunk.length; controller.enqueue(chunk); } }));
      }
    };
    try {
      await expect(readZip(bomb)).rejects.toThrow(/2 MB limit/);
    } finally {
      (globalThis as any).DecompressionStream = Real;
    }
    expect(produced).toBeGreaterThan(MAX_BYTES);              // it did hit the cap...
    expect(produced).toBeLessThan(MAX_BYTES + 2 * 1024 * 1024); // ...and stopped there, nowhere near 64 MB
  });
  it("refuses an entry whose header declares more than the limit, without reading it", async () => {
    await expect(readZip(await zipOf([{ name: "big.bin", data: zeros(10), claimed: MAX_BYTES + 1 }]))).rejects.toThrow(/2 MB limit/);
  });
  it("counts bytes across entries, not per entry", async () => {
    const half = MAX_BYTES / 2 + 1;
    await expect(readZip(await zipOf([{ name: "a.bin", data: zeros(half) }, { name: "b.bin", data: zeros(half) }]))).rejects.toThrow(/2 MB limit/);
  });
  it("refuses a zip over the input size cap before reading it", async () => {
    await expect(readZip(new Blob([zeros(MAX_ZIP_BYTES + 1)]))).rejects.toThrow(/over 4 MB/);
  });
  it("refuses too many entries before looping on them", async () => {
    const many = Array.from({ length: MAX_FILES * 2 + 1 }, (_, i) => ({ name: `f${i}`, data: zeros(1) }));
    await expect(readZip(await zipOf(many))).rejects.toThrow(/more than/);
  });
  it("stops counting files at the file limit", async () => {
    const many = Array.from({ length: MAX_FILES + 1 }, (_, i) => ({ name: `f${i}`, data: zeros(1) }));
    await expect(readZip(await zipOf(many))).rejects.toThrow(/more than/);
  });
  it("rejects ../ and absolute entry names instead of lifting them to plugin.json", async () => {
    await expect(readZip(await zipOf([{ name: "../plugin.json", data: enc.encode("{}") }]))).rejects.toThrow(/path that is not allowed/);
    await expect(readZip(await zipOf([{ name: "/plugin.json", data: enc.encode("{}") }]))).rejects.toThrow(/path that is not allowed/);
  });
  it("reads a deflated entry within the limits", async () => {
    const r = await readZip(await zipOf([{ name: "plugin.json", data: enc.encode('{"name":"k","version":"1.0.0"}'), method: 8 }]));
    expect(new TextDecoder().decode(r.files[0].bytes)).toBe('{"name":"k","version":"1.0.0"}');
  });
  it("skips .git without inflating or counting it, but counts node_modules like any other file", async () => {
    const r = await readZip(await zipOf([{ name: "plugin.json", data: enc.encode("{}") }, { name: ".git/big.pack", data: zeros(1), claimed: MAX_BYTES * 10 }]));
    expect(r.files.map((f) => f.path)).toEqual(["plugin.json"]);
    await expect(readZip(await zipOf([{ name: "plugin.json", data: enc.encode("{}") }, { name: "node_modules/x/big.js", data: zeros(1), claimed: MAX_BYTES * 10 }]))).rejects.toThrow(/2 MB limit/);
  });
});

describe("readFileList limits", () => {
  const f = (path: string, size: number) => ({ name: path.split("/").pop(), size, webkitRelativePath: path, arrayBuffer: async () => new ArrayBuffer(size) }) as unknown as File;
  it("checks the size from File.size before reading any bytes", async () => {
    let read = 0;
    const big = { ...f("kit/big.bin", MAX_BYTES + 1), arrayBuffer: async () => { read++; return new ArrayBuffer(0); } } as unknown as File;
    await expect(readFileList([f("kit/plugin.json", 10), big])).rejects.toThrow(/2 MB limit/);
    expect(read).toBe(0);
  });
  it("refuses a traversal path from a folder pick", async () => {
    await expect(readFileList([f("../escape.txt", 3)])).rejects.toThrow(/path that is not allowed/);
  });
  it("does not count skipped junk against the limits, and does count vendored dependencies", async () => {
    const r = await readFileList([f("kit/plugin.json", 10), f("kit/.git/objects.pack", MAX_BYTES * 5)]);
    expect(r.files.map((x) => x.path)).toEqual(["plugin.json"]);
    await expect(readFileList([f("kit/plugin.json", 10), f("kit/node_modules/x.js", MAX_BYTES * 5)])).rejects.toThrow(/2 MB limit/);
  });
});
