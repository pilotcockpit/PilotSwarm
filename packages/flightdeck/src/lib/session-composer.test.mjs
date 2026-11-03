import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSessionComposerMemory } from "./session-composer.ts";

describe("session composer ownership", () => {
  it("keeps A's pending send and completion isolated from B's draft and queue", async () => {
    const memory = createSessionComposerMemory();
    const a = memory.session("A");
    a.setText("Task for A");
    const requestA = a.beginSend();
    assert.ok(requestA);
    let resolveSend;
    const pendingSend = new Promise((resolve) => { resolveSend = resolve; });
    const completeA = pendingSend.then(() => a.finishSend(requestA, "queued"));

    const b = memory.session("B");
    b.setText("Private draft for B");
    const beforeB = b.getSnapshot();
    let bNotifications = 0;
    const unsubscribe = b.subscribe(() => bNotifications++);
    resolveSend();
    await completeA;

    assert.equal(b.getSnapshot(), beforeB);
    assert.equal(b.getSnapshot().text, "Private draft for B");
    assert.deepEqual(b.getSnapshot().queued, []);
    assert.equal(bNotifications, 0);
    assert.equal(a.getSnapshot().text, "");
    assert.deepEqual(a.getSnapshot().queued, ["Task for A"]);
    unsubscribe();
  });

  it("retains the outgoing draft and pending latch when A is revisited", () => {
    const memory = createSessionComposerMemory();
    const a = memory.session("A");
    a.setText("Task for A");
    const request = a.beginSend();
    assert.ok(request);
    const b = memory.session("B");
    assert.equal(b.getSnapshot().text, "");
    assert.equal(b.getSnapshot().sending, false);
    const revisitedA = memory.session("A");
    assert.equal(revisitedA, a);
    assert.equal(revisitedA.getSnapshot().text, "Task for A");
    assert.equal(revisitedA.getSnapshot().sending, true);
    assert.equal(revisitedA.beginSend(), null);
    a.finishSend(request, "failed");
    assert.equal(a.getSnapshot().text, "Task for A");
    assert.equal(a.getSnapshot().sending, false);
  });

  it("preserves a newer draft revision even if the user retypes the same text", () => {
    const a = createSessionComposerMemory().session("A");
    a.setText("Repeat this");
    const request = a.beginSend();
    a.setText("Another thought");
    a.setText("Repeat this");
    a.finishSend(request, "sent");
    assert.equal(a.getSnapshot().text, "Repeat this");
  });

  it("ignores duplicate completion and isolates stop state and data-source memories", () => {
    const memory = createSessionComposerMemory();
    const a = memory.session("A");
    a.setText("A queued message");
    const request = a.beginSend();
    a.finishSend(request, "queued");
    a.finishSend(request, "queued");
    assert.deepEqual(a.getSnapshot().queued, ["A queued message"]);
    assert.equal(a.beginStop(), true);
    assert.equal(a.beginStop(), false);
    assert.equal(memory.session("B").getSnapshot().stopping, false);
    assert.equal(createSessionComposerMemory().session("A").getSnapshot().text, "");
    a.finishStop();
    assert.equal(a.getSnapshot().stopping, false);
  });
});
