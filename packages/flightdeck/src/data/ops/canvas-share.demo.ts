import { registerDemoOps } from "./registry";

const links = new Map<string, { createdAt: string; createdBy: string }>();
const policies = new Map<string, string>();
const k = (p: any) => `${p.sessionId}:${p.slot}`;
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 43);

registerDemoOps(import.meta.url, {
  getCanvasShareLink: (p) => (links.has(k(p)) ? { exists: true, ...links.get(k(p)) } : { exists: false }),
  resetCanvasShareLink: (p) => { links.set(k(p), { createdAt: new Date().toISOString(), createdBy: "Sam Lee" }); return { token: token() }; },
  removeCanvasShareLink: (p) => { links.delete(k(p)); return { ok: true }; },
  readCanvasKv: (p) => ({ entries: [], nextAfter: null, policy: policies.get(k(p)) || "owner", me: { relation: "owner", canWrite: true }, manifestKv: null }),
  setCanvasKvAccess: (p) => { policies.set(k(p), p.access); return { ok: true }; },
});
