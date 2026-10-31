// A dev-only hook for end-to-end tests: `window.__fdDemo`. It exists only when BOTH are true:
//   - this is the Vite dev server (import.meta.env.DEV), and
//   - the active data source is the demo source.
// A production build contains none of it (every body below sits inside a DEV check, which the bundler
// removes), and it is deleted again when the live source takes over. See README, "End-to-end tests".

type Call = { op: string; params: unknown };
const calls: Call[] = [];
const areas: Record<string, unknown> = {};

/** Every operation answered by the demo registry is recorded, so a test can count what a click really sent. */
export function recordDemoCall(op: string, params: unknown) {
  if (import.meta.env.DEV) calls.push({ op, params: JSON.parse(JSON.stringify(params ?? {})) });
}

/** An area's own test helpers, e.g. `extendDemoHook("workspace", { writeBehind })`. */
export function extendDemoHook(area: string, api: Record<string, unknown>) {
  if (!import.meta.env.DEV) return;
  areas[area] = api;
  // A source that is already running (its helpers are created with its data) attaches at once.
  const hook = typeof window !== "undefined" ? (window as any).__fdDemo : undefined;
  if (hook) hook[area] = api;
}

const failing = new Set<string>();
/** True while a test has asked this typed source method to fail (see `failOps`). Dev server only. */
export const demoShouldFail = (op: string) => Boolean(import.meta.env.DEV) && failing.has(op);

export function installDemoHook() {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    calls.length = 0;
    failing.clear();
    (window as any).__fdDemo = {
      ...areas,
      /** Operation calls since the demo source started or `clearCalls()`: [{ op, params }]. */
      calls: () => calls.map((c) => ({ ...c })),
      clearCalls: () => { calls.length = 0; },
      /** Make typed demo reads fail until `clearFailures()`: `failOps(["listFlags"])`, then `invalidate(["flags"])`. */
      failOps: (ops: string[]) => { for (const op of ops) failing.add(op); },
      clearFailures: () => { failing.clear(); },
    };
  }
}

/** Lets a test re-read server data on demand: `window.__fdDemo.invalidate(["workspace"])`. Demo source only. */
export function attachDemoQueryClient(client: { invalidateQueries: (o: { queryKey: unknown[] }) => unknown }) {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const hook = (window as any).__fdDemo;
    if (hook) hook.invalidate = (queryKey: unknown[]) => client.invalidateQueries({ queryKey });
  }
}

export function removeDemoHook() {
  if (import.meta.env.DEV && typeof window !== "undefined") delete (window as any).__fdDemo;
}
