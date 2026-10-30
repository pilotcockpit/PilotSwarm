import { registerDemoOps } from "./registry";

// A small working folder to browse, edit and compare, shared by every demo session.

type Node = { kind: "dir" } | { kind: "file"; text: string; mtimeMs: number };
const now = Date.now();
const ago = (m: number) => now - m * 60_000;
const enc = new TextEncoder();
const toB64 = (text: string) => { const b = enc.encode(text); let s = ""; for (const c of b) s += String.fromCharCode(c); return btoa(s); };
const fromB64 = (b64: string) => { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return new TextDecoder().decode(out); };
const etagOf = (text: string) => { let h = 5381; for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0; return `e${(h >>> 0).toString(16)}`; };

const files = (entries: Record<string, string>, base = 120): Map<string, Node> => {
  const fs = new Map<string, Node>([["", { kind: "dir" }]]);
  let i = 0;
  for (const [path, text] of Object.entries(entries)) {
    const parts = path.split("/");
    for (let k = 1; k < parts.length; k++) fs.set(parts.slice(0, k).join("/"), { kind: "dir" });
    fs.set(path, { kind: "file", text, mtimeMs: ago(base + i++ * 37) });
  }
  return fs;
};

const WORKING = files({
  "README.md": "# Flight Deck\n\nThe operator console for PilotSwarm sessions.\n\n## Develop\n\n```bash\nnpm run dev --workspace=pilotswarm-flightdeck\n```\n\n- Tokens live in `src/styles.css`.\n- One `Card` primitive for every boxed surface.\n- `npm run tokens:check` guards raw colours.\n",
  "package.json": '{\n  "name": "pilotswarm-flightdeck",\n  "private": true,\n  "scripts": {\n    "dev": "vite",\n    "build": "tsc --noEmit && vite build"\n  }\n}\n',
  "src/main.tsx": 'import { createRoot } from "react-dom/client";\nimport { App } from "./App";\n\ncreateRoot(document.getElementById("root")!).render(<App />);\n',
  "src/App.tsx": 'export function App() {\n  return <main className="p-4">Flight Deck</main>;\n}\n',
  "src/styles.css": ":root {\n  --bg: #f6f7f8;\n  --surface: #ffffff;\n  --accent: #1a5fcc;\n}\n",
  "docs/plan.md": "# Plan\n\n1. Port working folders\n2. Share canvases\n3. Provider management\n\n| Area | Status |\n| --- | --- |\n| Files | in progress |\n| Providers | queued |\n",
  "docs/notes.txt": "Remember to rotate the share link after the review.\n",
  "assets/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#1a5fcc"/><path d="M12 40l20-20 20 20" stroke="#fff" stroke-width="6" fill="none"/></svg>',
  "scripts/release.sh": "#!/usr/bin/env bash\nset -euo pipefail\nnpm run build\n",
});
const NOTES = files({ "decisions.md": "# Decisions\n\n- Work in the open.\n- Prefer rows over cards.\n", "ideas.md": "- Fleet wall peek drawer\n- Saved views\n" }, 600);
const HEAD_TEXT: Record<string, string> = {
  "src/App.tsx": 'export function App() {\n  return <main>Flight Deck</main>;\n}\n',
  "README.md": "# Flight Deck\n\nThe operator console for PilotSwarm sessions.\n",
};

const fsByFolder = (id: string) => (id === "working" ? WORKING : id === "extra:notes" ? NOTES : null);

const fail = (code: string, message: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(message), { code, ...extra });
const childrenOf = (fs: Map<string, Node>, dir: string) => [...fs.keys()].filter((p) => p && (dir ? p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes("/") : !p.includes("/")));

let revision = 3;
let record: any = { root: "work", folder: "projects/flight-deck", extra: { notes: { root: "shared", folder: "notes" } } };

registerDemoOps({
  exportExecutionHistory: () => ({ filename: "execution-history.json" }),
  getSessionWorkspace: () => ({
    workspace: record, revision, turnRevision: revision, path: record ? `/srv/${record.root}/${record.folder || ""}` : null,
    extraPaths: record?.extra ? { notes: "/srv/shared/notes" } : {}, status: record ? "ready" : "none", lastError: null, heldPrompts: 0,
    adopted: { agents: ["code-reviewer"], skills: ["release-notes"], skipped: [] },
    defaults: { workingFolder: { root: "home", folder: "" }, extra: [] },
  }),
  setSessionWorkspace: ({ expectedRevision, workspace }: any) => {
    if (expectedRevision !== revision) throw fail("WORKSPACE_REVISION_CONFLICT", "revision changed");
    record = workspace ? { ...workspace, extra: workspace.extra ?? record?.extra } : null;
    revision += 1;
    return { revision };
  },
  retrySessionWorkspace: () => ({ ok: true }),
  listSessionWorkspaceFolders: () => ({
    enabled: true, maxBytes: 2 * 1024 * 1024, git: true, roots: ["work", "shared", "home"],
    folders: [
      { id: "working", name: record?.folder ? record.folder.split("/").pop() : "home", role: "working", home: !record, root: record?.root ?? "home", folder: record?.folder ?? "", opened: true, available: true },
      ...(record?.extra ? Object.entries(record.extra).map(([name, e]: any) => ({ id: `extra:${name}`, name, role: "extra", home: false, root: e.root, folder: e.folder ?? "", opened: true, available: true })) : []),
    ],
  }),
  sessionWorkspaceFiles: ({ call }: any) => {
    const fs = fsByFolder(call.folder);
    if (!fs) throw fail("WORKSPACE_FILES_NOT_FOUND", "no such folder");
    const path: string = (call.path || "").replace(/\/+$/, "");
    const node = fs.get(path);
    switch (call.op) {
      case "list": {
        if (!node) throw fail("WORKSPACE_FILES_NOT_FOUND", "not found");
        const entries = childrenOf(fs, path).map((p) => {
          const n = fs.get(p)!;
          return { name: p.split("/").pop()!, kind: n.kind, size: n.kind === "file" ? enc.encode(n.text).length : 0, mtimeMs: n.kind === "file" ? n.mtimeMs : ago(300) };
        }).sort((a, b) => Number(b.kind === "dir") - Number(a.kind === "dir") || a.name.localeCompare(b.name));
        return { ok: true, entries, truncated: false, readOnly: false };
      }
      case "stat": case "read": {
        if (!node) throw fail("WORKSPACE_FILES_NOT_FOUND", "not found");
        if (node.kind === "dir") return { ok: true, kind: "dir", size: 0, mtimeMs: ago(300) };
        const out: any = { ok: true, kind: "file", size: enc.encode(node.text).length, mtimeMs: node.mtimeMs, etag: etagOf(node.text), readOnly: false };
        if (call.op === "read") out.contentBase64 = toB64(node.text);
        return out;
      }
      case "write": {
        const text = fromB64(call.contentBase64);
        if (node?.kind === "dir") throw fail("WORKSPACE_FILES_NOT_A_FILE", "that is a folder");
        if (call.ifMatch === null && node) throw fail("WORKSPACE_FILES_EXISTS", "exists");
        if (typeof call.ifMatch === "string" && node?.kind === "file" && etagOf(node.text) !== call.ifMatch) throw fail("WORKSPACE_FILES_CONFLICT", "changed", { etag: etagOf(node.text) });
        const parts = path.split("/");
        for (let k = 1; k < parts.length; k++) if (!fs.has(parts.slice(0, k).join("/"))) fs.set(parts.slice(0, k).join("/"), { kind: "dir" });
        fs.set(path, { kind: "file", text, mtimeMs: Date.now() });
        return { ok: true, etag: etagOf(text), size: enc.encode(text).length, mtimeMs: Date.now(), created: !node };
      }
      case "mkdir": {
        if (node) throw fail("WORKSPACE_FILES_EXISTS", "exists");
        fs.set(path, { kind: "dir" });
        return { ok: true };
      }
      case "move": {
        if (!node) throw fail("WORKSPACE_FILES_NOT_FOUND", "not found");
        const to = String(call.toPath).replace(/\/+$/, "");
        if (fs.has(to)) throw fail("WORKSPACE_FILES_EXISTS", "exists");
        for (const key of [...fs.keys()]) if (key === path || key.startsWith(`${path}/`)) { fs.set(to + key.slice(path.length), fs.get(key)!); fs.delete(key); }
        return { ok: true };
      }
      case "delete": {
        if (!node) throw fail("WORKSPACE_FILES_NOT_FOUND", "not found");
        if (node.kind === "dir" && !call.recursive && childrenOf(fs, path).length) throw fail("WORKSPACE_FILES_NOT_EMPTY", "not empty");
        for (const key of [...fs.keys()]) if (key === path || key.startsWith(`${path}/`)) fs.delete(key);
        return { ok: true };
      }
      case "find": {
        const words = String(call.query || "").toLowerCase().split(/\s+/).filter(Boolean);
        const matches = [...fs.entries()].filter(([p]) => p && words.every((w) => p.toLowerCase().includes(w))).slice(0, 200).map(([p, n]) => ({ path: p, kind: n.kind === "dir" ? "dir" : "file" }));
        return { ok: true, matches, truncated: false };
      }
      case "zip": return { ok: true, contentBase64: toB64("PK demo archive"), size: 15, files: fs.size - 1 };
      case "git": {
        if (call.folder !== "working") return { repo: false };
        switch (call.what) {
          case "repos": return { top: true, repos: [], truncated: false };
          case "status": return {
            repo: true, available: true, head: "9f2c1ab7", branch: "feature/files", upstream: "origin/feature/files", ahead: 2, behind: 0, previousBranch: null, stash: null, since: null, state: null, truncated: false,
            files: [
              { path: "src/App.tsx", letter: "M", staged: false, unstaged: true, added: 1, removed: 1, staged_counts: null, unstaged_counts: { added: 1, removed: 1 } },
              { path: "README.md", letter: "M", staged: true, unstaged: false, added: 12, removed: 0, staged_counts: { added: 12, removed: 0 }, unstaged_counts: null },
              { path: "docs/notes.txt", letter: "U", staged: false, unstaged: true, added: null, removed: null, staged_counts: null, unstaged_counts: null },
            ],
          };
          case "log": return { repo: true, available: true, more: false, commits: [
            { sha: "9f2c1ab7e0d54a21aa", short: "9f2c1ab", author: "Sam Lee", email: "sam@example.com", time: Math.floor(ago(90) / 1000), parents: ["3c0d"], refs: ["HEAD -> feature/files"], subject: "Add the Files view" },
            { sha: "3c0d77ab12e98b4c11", short: "3c0d77a", author: "Riya K.", email: "riya@example.com", time: Math.floor(ago(60 * 26) / 1000), parents: [], refs: ["origin/main"], subject: "Scaffold Flight Deck" },
          ] };
          case "file": return HEAD_TEXT[call.path] != null ? { repo: true, available: true, exists: true, text: HEAD_TEXT[call.path] } : { repo: true, available: true, exists: false };
          default: return { repo: true, available: false, reason: "not in the demo" };
        }
      }
      default: throw fail("WORKSPACE_FILES_PATH_INVALID", `unknown call ${call.op}`);
    }
  },
});
