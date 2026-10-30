// Reading a package on the user's machine: a dropped folder, a chosen folder, or a .zip, turned into
// the [{path, contentBase64}] list the Web API takes. Nothing here talks to the server; the preview
// is computed from the files themselves so a mistake shows before anything is published.

export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_FILES = 2000;
/** A .zip bigger than this is refused before it is read: a 2 MB package never needs more. */
export const MAX_ZIP_BYTES = 4 * 1024 * 1024;

/** A package that cannot be read at all, with the reason in words a person can act on. */
export class IntakeError extends Error {}

/**
 * The paths a package may contain, checked on the ORIGINAL names (before any folder is lifted or
 * junk dropped), so "../plugin.json" is refused instead of quietly becoming "plugin.json".
 */
export function assertSafePath(path: string): void {
  const bad = !path || path.startsWith("/") || path.startsWith("\\") || /^[a-zA-Z]:/.test(path) || path.includes("\\") || path.includes("\0") || path.split("/").some((seg) => seg === ".." || seg === ".");
  if (bad) throw new IntakeError(`This package contains a path that is not allowed (${path.slice(0, 80) || "empty name"}). Paths must be relative and stay inside the package.`);
}

const tooBig = () => new IntakeError(`This package is over the ${MAX_BYTES / 1048576} MB limit. Remove build output, images or data files that agents do not read.`);
const tooMany = () => new IntakeError(`This package has more than ${MAX_FILES} files. Remove what agents do not read.`);

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

/** Running totals for one intake: every limit is checked before bytes are read, not after. */
class Budget {
  files = 0;
  bytes = 0;
  take(size: number) {
    if (++this.files > MAX_FILES) throw tooMany();
    this.bytes += size;
    if (this.bytes > MAX_BYTES) throw tooBig();
  }
}

/** From <input type="file" webkitdirectory> or a multi-select. */
export async function readFileList(list: FileList | File[]): Promise<ReadResult> {
  const out: LocalFile[] = [];
  const budget = new Budget();
  const all = Array.from(list);
  for (const f of all) assertSafePath((f as any).webkitRelativePath || f.name);
  for (const f of all) {
    const path = (f as any).webkitRelativePath || f.name;
    if (skipped(path)) continue;
    budget.take(f.size);
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

async function walk(entry: any, prefix: string, out: LocalFile[], budget: Budget) {
  const path = prefix ? `${prefix}/${entry.name}` : entry.name;
  assertSafePath(path);
  if (skipped(path)) return;
  if (entry.isFile) {
    const file = await entryFile(entry);
    budget.take(file.size);
    out.push({ path, bytes: new Uint8Array(await file.arrayBuffer()) });
  } else if (entry.isDirectory) for (const kid of await entryKids(entry)) await walk(kid, path, out, budget);
}

/** A drag-and-drop: one or more folders, or a single .zip. */
export async function readDropped(items: DataTransferItemList, files: FileList): Promise<ReadResult> {
  const entries = Array.from(items).map((i) => (i as any).webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length === 1 && entries[0].isFile && /\.zip$/i.test(entries[0].name)) return readZip(files[0]);
  if (!entries.length) return readFileList(files);
  const out: LocalFile[] = [];
  const budget = new Budget();
  for (const e of entries) await walk(e, "", out, budget);
  return normalizeFiles(out);
}

// ── Zip ──────────────────────────────────────────────────────────────────
// A small reader for the common case (stored or deflated entries, no encryption, no zip64), so no
// dependency is needed. Deflate goes through the browser's DecompressionStream.

const u16 = (d: DataView, o: number) => d.getUint16(o, true);
const u32 = (d: DataView, o: number) => d.getUint32(o, true);

/** Inflate one entry, stopping the moment its output would pass `limit` (a zip can claim any size). */
async function inflateRaw(bytes: Uint8Array, limit: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new IntakeError("This browser cannot unzip packages. Choose the folder instead.");
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) { await reader.cancel().catch(() => undefined); throw tooBig(); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

export async function readZip(file: Blob): Promise<ReadResult> {
  if (file.size > MAX_ZIP_BYTES) throw new IntakeError(`That .zip is over ${MAX_ZIP_BYTES / 1048576} MB. A package is limited to ${MAX_BYTES / 1048576} MB of files; remove what agents do not read.`);
  const buf = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) if (u32(view, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new IntakeError("That file is not a valid .zip.");
  const count = u16(view, eocd + 10);
  if (count === 0xffff || u32(view, eocd + 16) === 0xffffffff) throw new IntakeError("Zip64 archives are not supported.");
  // Entry count is a claim in the header; bound it before looping on it. Folders and skipped junk still count here.
  if (count > MAX_FILES * 2) throw tooMany();
  let p = u32(view, eocd + 16);
  const out: LocalFile[] = [];
  const budget = new Budget();
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || u32(view, p) !== 0x02014b50) throw new IntakeError("The .zip is damaged.");
    const flags = u16(view, p + 8), method = u16(view, p + 10), csize = u32(view, p + 20), usize = u32(view, p + 24);
    const nameLen = u16(view, p + 28), extraLen = u16(view, p + 30), commentLen = u16(view, p + 32), local = u32(view, p + 42);
    if (p + 46 + nameLen > buf.length) throw new IntakeError("The .zip is damaged.");
    const name = decoder.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    assertSafePath(name.endsWith("/") ? name.slice(0, -1) : name);
    if (name.endsWith("/") || skipped(name)) continue;
    if (flags & 1) throw new IntakeError("Encrypted .zip files are not supported.");
    if (csize === 0xffffffff || usize === 0xffffffff) throw new IntakeError("Zip64 archives are not supported.");
    // The declared size is checked first; the inflate below enforces it whatever the header claims.
    if (budget.bytes + usize > MAX_BYTES) throw tooBig();
    if (local + 30 > buf.length) throw new IntakeError("The .zip is damaged.");
    const start = local + 30 + u16(view, local + 26) + u16(view, local + 28);
    if (start + csize > buf.length) throw new IntakeError("The .zip is damaged.");
    const raw = buf.subarray(start, start + csize);
    let bytes: Uint8Array;
    if (method === 0) bytes = raw.slice();
    else if (method === 8) bytes = await inflateRaw(raw, MAX_BYTES - budget.bytes);
    else throw new IntakeError("This .zip uses a compression method that is not supported. Re-create it with a standard zip tool.");
    budget.take(bytes.length);
    out.push({ path: name, bytes });
  }
  return normalizeFiles(out);
}
