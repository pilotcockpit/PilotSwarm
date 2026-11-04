import test from "node:test";
import assert from "node:assert/strict";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { MotdStore } from "../../dist/motd-store.js";

function offlineStore() {
    let connections = 0;
    const store = new MotdStore({ connect: async () => {
        connections++;
        throw Object.assign(new Error("Validation reached the offline connection sentinel"), { code: "VALIDATED" });
    } }, "test_only");
    return { store, connections: () => connections };
}
const request = { bodyMd: "Hello", requestId: "timestamp-validation" };

if (!isMainThread) {
    const probe = offlineStore();
    for (const field of ["startsAt", "endsAt", "fromAt", "toAt"]) {
        for (const suffix of ["!", "Z"]) {
            await assert.rejects(probe.store.create(null, { ...request, [field]: "t".repeat(150_000) + suffix }), { code: "MOTD_INVALID" });
        }
    }
    assert.equal(probe.connections(), 0);
    parentPort.postMessage("rejected");
    parentPort.close();
} else {
    for (const [field, value] of [
        ["startsAt", "2026-11-03T12:00:00Z"],
        ["endsAt", "2026-11-03T12:00:00+01:00"],
        ["fromAt", "2026-11-03t12:00:00z"],
        ["toAt", "2026-11-03T12:00:00-05:00"],
    ]) test(`${field} retains valid timezone-bearing timestamps`, async () => {
        const probe = offlineStore();
        await assert.rejects(probe.store.create(null, { ...request, [field]: value }), { code: "VALIDATED" });
        assert.equal(probe.connections(), 1);
    });
    test("a timestamp without a timezone is rejected before connecting", async () => {
        const probe = offlineStore();
        await assert.rejects(probe.store.create(null, { ...request, startsAt: "2026-11-03T12:00:00" }), { code: "MOTD_INVALID" });
        assert.equal(probe.connections(), 0);
    });
    test("adversarial timestamps cannot monopolize the validator", { timeout: 10_000 }, async t => {
        const worker = new Worker(new URL(import.meta.url));
        t.after(() => worker.terminate());
        const result = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("Timestamp validation exceeded its 3-second worker budget")), 3_000);
            t.after(() => clearTimeout(timer));
            worker.once("message", resolve);
            worker.once("error", reject);
            worker.once("exit", code => reject(new Error(`Timestamp probe exited with ${code} without a result`)));
        });
        assert.equal(result, "rejected");
    });
}
