import { recordDemoCall } from "./demo-hook";
// Demo-mode handlers for Web API operations that have no typed method on DataSource.
// An area registers its own fixtures from a `<area>.demo.ts` file in this folder; index.ts
// loads every one, so areas never edit a shared list. One file owns each operation: a second
// file claiming the same name is a bug (the later import would silently win), so it throws in
// development. Re-running the same file (hot reload) is fine.

type Handler = (params: any) => unknown | Promise<unknown>;
const handlers = new Map<string, { owner: string; fn: Handler }>();

const ownerOf = (url: string) => url.split("?")[0];

export function registerDemoOps(owner: string, ops: Record<string, Handler>) {
  const id = ownerOf(owner);
  for (const [name, fn] of Object.entries(ops)) {
    const existing = handlers.get(name);
    if (existing && existing.owner !== id) throw new Error(`Demo op ${name} is registered by both ${existing.owner} and ${id}. One file owns each operation.`);
    handlers.set(name, { owner: id, fn });
  }
}

export async function callDemoOp(op: string, params?: Record<string, unknown>) {
  recordDemoCall(op, params);
  const entry = handlers.get(op);
  await new Promise((r) => window.setTimeout(r, 120));
  if (!entry) throw new Error(`${op} is not part of the demo data. Switch to live data to use it.`);
  return entry.fn(params || {});
}

/** For tests: forget every registration. */
export function resetDemoOps() { handlers.clear(); }
