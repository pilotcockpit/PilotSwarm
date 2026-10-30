// Reading a package on the user's machine: a dropped folder, a chosen folder, or a .zip, turned into
// the [{path, contentBase64}] list the Web API takes. Nothing here talks to the server; the preview
// is computed from the files themselves so a mistake shows before anything is published.

export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_FILES = 2000;

export interface LocalFile { path: string; bytes: Uint8Array }
export interface ReadResult { files: LocalFile[]; skipped: number }
export interface PackageIssue { level: "error" | "warning"; message: string; file?: string }
export interface PackageAnalysis {
  name: string | null;
  version: string | null;
  description: string | null;
  agents: string[];
  skills: string[];
  tools: boolean;
  mcp: boolean;
  fileCount: number;
  totalBytes: number;
  issues: PackageIssue[];
}

const SKIP = [/(^|\/)\.git(\/|$)/, /(^|\/)node_modules(\/|$)/, /(^|\/)\.DS_Store$/, /(^|\/)__MACOSX(\/|$)/, /(^|\/)Thumbs\.db$/];
const skipped = (path: string) => SKIP.some((re) => re.test(path));

/** Drop what never belongs in a package, then lift a single wrapping folder (my-kit/plugin.json) to the root. */
export function normalizeFiles(input: LocalFile[]): ReadResult {
  const kept = input.filter((f) => !skipped(f.path));
  let files = kept;
  if (!kept.some((f) => f.path === "plugin.json")) {
    const tops = new Set(kept.map((f) => f.path.split("/")[0]));
    if (tops.size === 1 && kept.every((f) => f.path.includes("/"))) {
      const top = [...tops][0];
      files = kept.map((f) => ({ ...f, path: f.path.slice(top.length + 1) }));
    }
  }
  return { files, skipped: input.length - kept.length };
}

const decoder = new TextDecoder();

/** Name, version and contents from the files, plus everything the server is known to refuse, said plainly. */
export function analyzePackage(files: LocalFile[]): PackageAnalysis {
  const issues: PackageIssue[] = [];
  const paths = files.map((f) => f.path);
  const totalBytes = files.reduce((n, f) => n + f.bytes.length, 0);
  let manifest: any = null;
  const pj = files.find((f) => f.path === "plugin.json");
  if (!pj) issues.push({ level: "error", message: "There is no plugin.json at the top of the package. It names the package and its version.", file: "plugin.json" });
  else {
    try { manifest = JSON.parse(decoder.decode(pj.bytes)); } catch { issues.push({ level: "error", message: "plugin.json is not valid JSON.", file: "plugin.json" }); }
  }
  const name = typeof manifest?.name === "string" && manifest.name.trim() ? manifest.name.trim() : null;
  const version = typeof manifest?.version === "string" && manifest.version.trim() ? manifest.version.trim() : null;
  if (manifest && !name) issues.push({ level: "error", message: "plugin.json needs a name.", file: "plugin.json" });
  if (manifest && !version) issues.push({ level: "error", message: "plugin.json needs a version, for example 1.0.0.", file: "plugin.json" });
  if (version && !/^\d+\.\d+\.\d+([-+].+)?$/.test(version)) issues.push({ level: "warning", message: `"${version}" is not a three-part version (1.2.3). The server may refuse it.`, file: "plugin.json" });
  if (files.length > MAX_FILES) issues.push({ level: "error", message: `${files.length} files is over the limit of ${MAX_FILES}.` });
  if (totalBytes > MAX_BYTES) issues.push({ level: "error", message: `${(totalBytes / 1048576).toFixed(1)} MB is over the 2 MB limit. Remove build output, images or data files that agents do not read.` });
  for (const p of paths) if (p.startsWith("/") || p.includes("\\") || p.split("/").includes("..")) issues.push({ level: "error", message: "This path is not allowed in a package.", file: p });
  const agents = [...new Set(paths.filter((p) => /\.agent\.md$/i.test(p)).map((p) => p.split("/").pop()!.replace(/\.agent\.md$/i, "")))].sort();
  const skills = [...new Set(paths.filter((p) => /(^|\/)SKILL\.md$/i.test(p)).map((p) => p.split("/").slice(-2, -1)[0] || "skill"))].sort();
  const tools = paths.some((p) => /(^|\/)worker-module\.js$/.test(p));
  const mcp = paths.some((p) => /(^|\/)\.mcp\.json$/.test(p));
  if (pj && !agents.length && !skills.length && !tools && !mcp) issues.push({ level: "warning", message: "No agents, skills, tools or MCP servers found. The package would be empty." });
  return { name, version, description: typeof manifest?.description === "string" ? manifest.description : null, agents, skills, tools, mcp, fileCount: files.length, totalBytes, issues };
}

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export const toUploadFiles = (files: LocalFile[]) => files.map((f) => ({ path: f.path, contentBase64: toBase64(f.bytes) }));

// ── Folders ──────────────────────────────────────────────────────────────

/** From <input type="file" webkitdirectory> or a multi-select. */
export async function readFileList(list: FileList | File[]): Promise<ReadResult> {
  const out: LocalFile[] = [];
  for (const f of Array.from(list)) {
    const path = (f as any).webkitRelativePath || f.name;
    out.push({ path, bytes: new Uint8Array(await f.arrayBuffer()) });
  }
  return normalizeFiles(out);
}

const entryFile = (e: any) => new Promise<File>((res, rej) => e.file(res, rej));
const entryKids = (e: any) =>
  new Promise<any[]>((res, rej) => {
    const reader = e.createReader();
    const all: any[] = [];
    const next = () => reader.readEntries((batch: any[]) => (batch.length ? (all.push(...batch), next()) : res(all)), rej);
    next();
  });

async function walk(entry: any, prefix: string, out: LocalFile[]) {
  const path = prefix ? `${prefix}/${entry.name}` : entry.name;
  if (skipped(path)) return;
  if (entry.isFile) out.push({ path, bytes: new Uint8Array(await (await entryFile(entry)).arrayBuffer()) });
  else if (entry.isDirectory) for (const kid of await entryKids(entry)) await walk(kid, path, out);
}

/** A drag-and-drop: one or more folders, or a single .zip. */
export async function readDropped(items: DataTransferItemList, files: FileList): Promise<ReadResult> {
  const entries = Array.from(items).map((i) => (i as any).webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length === 1 && entries[0].isFile && /\.zip$/i.test(entries[0].name)) return readZip(files[0]);
  if (!entries.length) return readFileList(files);
  const out: LocalFile[] = [];
  for (const e of entries) await walk(e, "", out);
  return normalizeFiles(out);
}

// ── Zip ──────────────────────────────────────────────────────────────────
// A small reader for the common case (stored or deflated entries, no encryption, no zip64), so no
// dependency is needed. Deflate goes through the browser's DecompressionStream.

const u16 = (d: DataView, o: number) => d.getUint16(o, true);
const u32 = (d: DataView, o: number) => d.getUint32(o, true);

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unzip packages. Choose the folder instead.");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZip(file: Blob): Promise<ReadResult> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) if (u32(view, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("That file is not a valid .zip.");
  const count = u16(view, eocd + 10);
  let p = u32(view, eocd + 16);
  const out: LocalFile[] = [];
  for (let n = 0; n < count; n++) {
    if (u32(view, p) !== 0x02014b50) throw new Error("The .zip is damaged.");
    const flags = u16(view, p + 8), method = u16(view, p + 10), csize = u32(view, p + 20);
    const nameLen = u16(view, p + 28), extraLen = u16(view, p + 30), commentLen = u16(view, p + 32), local = u32(view, p + 42);
    const name = decoder.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    if (flags & 1) throw new Error("Encrypted .zip files are not supported.");
    const start = local + 30 + u16(view, local + 26) + u16(view, local + 28);
    const raw = buf.subarray(start, start + csize);
    if (method === 0) out.push({ path: name, bytes: raw.slice() });
    else if (method === 8) out.push({ path: name, bytes: await inflateRaw(raw) });
    else throw new Error("This .zip uses a compression method that is not supported. Re-create it with a standard zip tool.");
  }
  return normalizeFiles(out);
}
