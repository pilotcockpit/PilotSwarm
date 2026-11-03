import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { failedMutationIds, matchesSessionOwner, sessionIsViewOnly } from "./session-access.ts";

describe("session ownership filters", () => {
  it("keeps my shared sessions in Mine and out of Others", () => {
    for (const visibility of ["private", "shared_read", "shared_write"]) {
      const session = { owner: "me", visibility };
      assert.equal(matchesSessionOwner(session, "mine"), true);
      assert.equal(matchesSessionOwner(session, "shared"), false);
    }
  });

  it("places another owner's visible shared sessions outside Mine", () => {
    const session = { owner: "Alice", visibility: "shared_read" };
    assert.equal(matchesSessionOwner(session, "mine"), false);
    assert.equal(matchesSessionOwner(session, "shared"), true);
  });

  it("does not invent ownership from visibility when the owner is unknown", () => {
    for (const owner of [undefined, null, "", {}]) {
      for (const visibility of ["private", "shared_read", "shared_write"]) {
        const session = { owner, visibility };
        assert.equal(matchesSessionOwner(session, "mine"), false);
        assert.equal(matchesSessionOwner(session, "shared"), false);
        assert.equal(matchesSessionOwner(session, "all"), true);
      }
    }
  });
});

describe("read-only affordances", () => {
  it("uses authoritative write capability before visibility hints", () => {
    assert.equal(sessionIsViewOnly({ canWrite: true, owner: "Alice", visibility: "shared_read" }), false);
    assert.equal(sessionIsViewOnly({ canWrite: false, owner: "me", visibility: "private" }), true);
  });

  it("keeps another viewer's read-only share read-only without blocking its owner", () => {
    assert.equal(sessionIsViewOnly({ owner: "Alice", visibility: "shared_read" }), true);
    assert.equal(sessionIsViewOnly({ owner: "me", visibility: "shared_read" }), false);
    assert.equal(sessionIsViewOnly({ owner: "me", readOnly: true }), true);
  });
});

describe("partial bulk results", () => {
  it("retains exactly the failed IDs in original selection order", () => {
    const result = failedMutationIds(["a", "b", "c", "d"], [
      { status: "fulfilled", value: undefined },
      { status: "rejected", reason: new Error("Access denied") },
      { status: "fulfilled", value: undefined },
      { status: "rejected", reason: new Error("Offline") },
    ]);
    assert.deepEqual(result, ["b", "d"]);
  });

  it("clears successful selections and retains unconfirmed results", () => {
    assert.deepEqual(failedMutationIds(["a"], [{ status: "fulfilled", value: undefined }]), []);
    assert.deepEqual(failedMutationIds(["a"], []), ["a"]);
  });
});
