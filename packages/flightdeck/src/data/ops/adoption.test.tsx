import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// TanStack Query decides at import time whether it is "server side" (no window) and, if so, never starts
// refetch intervals. These tests are about polling, so the window must exist before it is imported.
vi.hoisted(() => { (globalThis as any).window = globalThis; });

import { render, act } from "@/test/render";
import { Providers, newClient, stubSource } from "@/test/harness";
import { ADOPTION_POLL_MS, PENDING_TIMEOUT_MS, evaluatePending, markPending, pendingList, pollInterval, resetPending } from "./adoption";
import { useWorkerPackageState, type PackageSummary, type WorkerPackageState } from "./packages";

const T0 = 1_000_000;
const pkg = { packageId: "p1", name: "ops-toolkit", scope: "shared", owner: null, enabled: true, canEdit: true, active: { semver: "1.0.0", sha256: "sha-1.0.0" } } as unknown as PackageSummary;
const worker = (id: string, installed: WorkerPackageState["installed"] = {}): WorkerPackageState => ({ workerNodeId: id, installed });
const has = (semver = "1.0.0") => ({ "ops-toolkit": { semver, sha256: `sha-${semver}`, status: "ok" } });
const waitingFor = () => markPending({ name: "ops-toolkit", scope: "shared", semver: "1.0.0" }, T0);

beforeEach(() => resetPending());

describe("waiting for workers to pick up a package", () => {
  it("first publication: polls even though no worker lists the package yet", () => {
    waitingFor();
    const states = [worker("w1"), worker("w2")];                      // installed: {} everywhere
    expect(pollInterval(pendingList(), states, [pkg], false, T0 + 1_000)).toBe(ADOPTION_POLL_MS);
    expect(evaluatePending(pendingList(), states, [pkg], T0 + 1_000)).toMatchObject({ done: [], expired: [], waiting: [expect.anything()] });
  });
  it("stays waiting until EVERY worker has the version, then is done", () => {
    waitingFor();
    const half = [worker("w1", has()), worker("w2")];
    expect(evaluatePending(pendingList(), half, [pkg], T0 + 5_000).done).toHaveLength(0);
    const all = [worker("w1", has()), worker("w2", has())];
    expect(evaluatePending(pendingList(), all, [pkg], T0 + 10_000).done).toHaveLength(1);
    expect(pollInterval(pendingList(), all, [pkg], false, T0 + 10_000)).toBe(false);
  });
  it("a worker that reports the package as failed counts as settled", () => {
    waitingFor();
    const states = [worker("w1", has()), worker("w2", { "ops-toolkit": { semver: "0.9.0", status: "error", error: "bad" } })];
    expect(evaluatePending(pendingList(), states, [pkg], T0 + 2_000).done).toHaveLength(1);
  });
  it("completion already present on the first read after publishing is recognised at once", () => {
    waitingFor();
    const states = [worker("w1", has()), worker("w2", has())];
    const r = evaluatePending(pendingList(), states, [pkg], T0 + 100);
    expect(r.done).toHaveLength(1);
    expect(r.waiting).toHaveLength(0);
  });
  it("a pending 'whatever is active' (enable) resolves against the package's active version", () => {
    markPending({ name: "ops-toolkit", scope: "shared", semver: null }, T0);
    expect(evaluatePending(pendingList(), [worker("w1", has("1.0.0"))], [pkg], T0 + 100).done).toHaveLength(1);
    expect(evaluatePending(pendingList(), [worker("w1", has("0.9.0"))], [pkg], T0 + 100).done).toHaveLength(0);
  });
  it("gives up after the timeout and stops polling, without ever completing", () => {
    waitingFor();
    const states = [worker("w1")];
    const late = T0 + PENDING_TIMEOUT_MS;
    expect(pollInterval(pendingList(), states, [pkg], false, late - 1)).toBe(ADOPTION_POLL_MS);
    expect(pollInterval(pendingList(), states, [pkg], false, late)).toBe(false);
    const r = evaluatePending(pendingList(), states, [pkg], late);
    expect(r.expired).toHaveLength(1);
    expect(r.done).toHaveLength(0);
  });
  it("does not poll when nothing is pending, and no update is in flight", () => {
    expect(pollInterval([], [worker("w1", has())], [pkg], false, T0)).toBe(false);
    expect(pollInterval([], undefined, undefined, false, T0)).toBe(false);
  });
  it("still polls while workers disagree about a version that was not published from here", () => {
    expect(pollInterval([], [worker("w1", has()), worker("w2", has("0.9.0"))], [pkg], true, T0)).toBe(ADOPTION_POLL_MS);
  });
});

// ── the real hook, over time ────────────────────────────────────────────────────────────────────
describe("useWorkerPackageState", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] }); vi.setSystemTime(T0); });
  afterEach(() => { vi.useRealTimers(); });
  const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

  it("first publication: keeps looking until workers have it, refreshes agents once, then stops looking", async () => {
    let reads = 0;
    const { source, calls } = stubSource({ listAgentWorkerState: () => (++reads < 3 ? [worker("w1"), worker("w2")] : [worker("w1", has()), worker("w2", has())]) });
    const client = newClient();
    const invalidated: unknown[] = [];
    const real = client.invalidateQueries.bind(client);
    client.invalidateQueries = ((f: any, o?: any) => { invalidated.push(f?.queryKey); return real(f, o); }) as typeof client.invalidateQueries;
    waitingFor();                                                       // the page just published ops-toolkit 1.0.0
    const out: { current?: ReturnType<typeof useWorkerPackageState> } = {};
    function Probe() { out.current = useWorkerPackageState(true, [pkg]); return null; }
    const r = await render(<Providers source={source} client={client}><Probe /></Providers>);
    await advance(10);
    expect(calls.filter((c) => c.op === "listAgentWorkerState")).toHaveLength(1);
    expect(pendingList()).toHaveLength(1);                              // nothing installed yet: still waiting
    await advance(ADOPTION_POLL_MS);                                    // second read: still nothing
    expect(pendingList()).toHaveLength(1);
    await advance(ADOPTION_POLL_MS);                                    // third read: every worker has it
    expect(pendingList()).toHaveLength(0);
    expect(invalidated.some((k) => JSON.stringify(k) === JSON.stringify(["agents"]))).toBe(true);
    const settled = calls.filter((c) => c.op === "listAgentWorkerState").length;
    await advance(ADOPTION_POLL_MS * 6);                                // nothing pending: no more polling
    expect(calls.filter((c) => c.op === "listAgentWorkerState")).toHaveLength(settled);
    await r.unmount();
  });

  it("completion already present on the first read: settles at once and refreshes agents, with no further polling", async () => {
    const { source, calls } = stubSource({ listAgentWorkerState: [worker("w1", has()), worker("w2", has())] });
    const client = newClient();
    const invalidated: unknown[] = [];
    const real = client.invalidateQueries.bind(client);
    client.invalidateQueries = ((f: any, o?: any) => { invalidated.push(f?.queryKey); return real(f, o); }) as typeof client.invalidateQueries;
    waitingFor();
    function Probe() { useWorkerPackageState(true, [pkg]); return null; }
    const r = await render(<Providers source={source} client={client}><Probe /></Providers>);
    await advance(10);
    expect(pendingList()).toHaveLength(0);
    // The installed state never changed between reads, so only the settle path can have refreshed the agents.
    expect(invalidated.some((k) => JSON.stringify(k) === JSON.stringify(["agents"]))).toBe(true);
    const n = calls.length;
    await advance(ADOPTION_POLL_MS * 6);
    expect(calls.length).toBe(n);
    await r.unmount();
  });

  it("a wait that never completes times out, refreshes agents once and stops polling", async () => {
    const { source, calls } = stubSource({ listAgentWorkerState: [worker("w1")] });
    const client = newClient();
    waitingFor();
    function Probe() { useWorkerPackageState(true, [pkg]); return null; }
    const r = await render(<Providers source={source} client={client}><Probe /></Providers>);
    await advance(PENDING_TIMEOUT_MS + ADOPTION_POLL_MS);
    expect(pendingList()).toHaveLength(0);
    const after = calls.length;
    await advance(ADOPTION_POLL_MS * 6);
    expect(calls.length).toBe(after);
    await r.unmount();
  });
});
