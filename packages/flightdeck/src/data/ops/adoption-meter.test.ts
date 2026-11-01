import { describe, expect, it } from "vitest";
import { adoption, WORKER_STALE_MS, type PackageSummary, type WorkerPackageState } from "./packages";

const now = Date.parse("2026-11-01T12:00:00Z");
const pkg: PackageSummary = { packageId: "p", name: "ops", scope: "shared", owner: null, enabled: true, canEdit: true, active: { versionId: "ops@2.0.0", semver: "2.0.0", sha256: "h2", sizeBytes: 1, createdAt: 0 } };
const w = (id: string, ageMs: number, installed: WorkerPackageState["installed"]): WorkerPackageState => ({ workerNodeId: id, updatedAt: new Date(now - ageMs).toISOString(), installed });

describe("the adoption meter", () => {
  it("counts only workers that reported recently: a retired worker is not 'behind'", () => {
    const states = [w("a", 1000, { ops: { semver: "2.0.0", sha256: "h2" } }), w("b", 1000, { ops: { semver: "2.0.0", sha256: "h2" } }), w("gone", WORKER_STALE_MS + 1000, { ops: { semver: "1.0.0", sha256: "h1" } })];
    expect(adoption(pkg, states, { now })).toMatchObject({ on: 2, total: 2, failed: 0 });
  });
  it("carries the install error of a worker that failed, with the worker's name", () => {
    const r = adoption(pkg, [w("a", 1000, { ops: { status: "error", error: "worker-module.js threw on import" } }), w("b", 1000, { ops: { semver: "2.0.0", sha256: "h2" } })], { now });
    expect(r).toMatchObject({ on: 1, failed: 1, total: 2 });
    expect(r?.errors).toEqual([{ worker: "a", message: "worker-module.js threw on import" }]);
  });
  it("says nothing when every row is stale or no live worker has the copy", () => {
    expect(adoption(pkg, [w("gone", WORKER_STALE_MS * 2, { ops: { semver: "2.0.0", sha256: "h2" } })], { now })).toBeNull();
    expect(adoption(pkg, [w("a", 1000, {})], { now })).toBeNull();
  });
});
