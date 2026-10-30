// Demo-mode handlers for Web API operations that have no typed method on DataSource.
// An area registers its own fixtures from a `<area>.demo.ts` file in this folder; index.ts
// loads every one, so areas never edit a shared list.

type Handler = (params: any) => unknown | Promise<unknown>;
const handlers = new Map<string, Handler>();

export function registerDemoOps(ops: Record<string, Handler>) {
  for (const [name, fn] of Object.entries(ops)) {
    if (import.meta.env.DEV && handlers.has(name)) console.warn(`demo op ${name} is registered twice; the later file wins`);
    handlers.set(name, fn);
  }
}

export async function callDemoOp(op: string, params?: Record<string, unknown>) {
  const fn = handlers.get(op);
  await new Promise((r) => window.setTimeout(r, 120));
  if (!fn) throw new Error(`${op} is not part of the demo data. Switch to live data to use it.`);
  return fn(params || {});
}
