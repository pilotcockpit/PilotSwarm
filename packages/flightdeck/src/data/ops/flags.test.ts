import { describe, expect, it } from "vitest";
import { flagWriteCall, type Mutation } from "./flags";

const base = { featureKey: "sessions.steering", expectedRevision: "4" };

describe("flagWriteCall", () => {
  it("builds each layer's call from the mutation's own target", () => {
    expect(flagWriteCall({ ...base, target: { kind: "cluster" }, enabled: true, allowUserOverride: false }, "r1")).toEqual({ op: "setClusterFeatureFlag", params: { ...base, requestId: "r1", enabled: true, allowUserOverride: false } });
    expect(flagWriteCall({ ...base, target: { kind: "cluster" }, clear: true }, "r2").op).toBe("resetClusterFeatureFlag");
    expect(flagWriteCall({ ...base, target: { kind: "me" }, enabled: false }, "r3")).toEqual({ op: "setMyFeatureFlag", params: { ...base, requestId: "r3", enabled: false } });
    expect(flagWriteCall({ ...base, target: { kind: "me" }, clear: true }, "r4").op).toBe("unsetMyFeatureFlag");
  });
  it("Undo acts on the person the write was made for, whoever is selected now", () => {
    // Alice is changed, Bob is then selected, Alice's Undo is clicked: the Undo mutation carries Alice.
    const alice = { kind: "user", userId: 1 } as const;
    const write: Mutation = { ...base, target: alice, enabled: true };
    const undo: Mutation = { ...base, expectedRevision: "5", target: alice, clear: true };
    expect(flagWriteCall(write, "w").params.userId).toBe(1);
    const call = flagWriteCall(undo, "u");
    expect(call).toMatchObject({ op: "unsetUserFeatureFlag", params: { userId: 1, expectedRevision: "5" } });
    expect(flagWriteCall({ ...undo, target: { kind: "user", userId: 2 } }, "u").params.userId).toBe(2);
  });
});
