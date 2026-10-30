/**
 * sendAnswer can bind an answer strictly to the question it was written for.
 *
 * `requireQuestionMatch: true` asks the orchestration to run NO turn if the
 * question is no longer the one that is open (orchestration 1.0.83). The
 * client side of that contract: the option must travel on the wire, an answer
 * with no question to bind to must fail closed here instead of being guessed
 * from whatever is open now, and an answer that does not opt in must be
 * byte-identical to what older clients sent.
 *
 * Run: node --test test/unit/answer-binding-client.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

import { PilotSwarmManagementClient } from "../../dist/management-client.js";
import { WebPilotSwarmManagementClient } from "../../dist/web/web-management-client.js";
import { OPERATIONS } from "../../api/src/protocol.js";

function makeClient({ pending = null } = {}) {
    const enqueued = [];
    const client = Object.create(PilotSwarmManagementClient.prototype);
    client._ensureStarted = () => {};
    client._assertOrchestrationLive = async () => {};
    client.getSession = async () => ({ pendingQuestion: pending });
    client._duroxideClient = { enqueueEvent: async (orchId, queue, payload) => { enqueued.push({ orchId, queue, body: JSON.parse(payload) }); } };
    return { client, enqueued };
}

const asked = { question: "first?", iteration: 3 };

test("a bound answer carries requireQuestionMatch and the question it is bound to", async () => {
    const { client, enqueued } = makeClient();
    await client.sendAnswer("s-1", "left", { expectedQuestion: asked, requireQuestionMatch: true });
    assert.equal(enqueued.length, 1);
    assert.equal(enqueued[0].orchId, "session-s-1");
    assert.deepEqual(enqueued[0].body.expectedQuestion, asked);
    assert.equal(enqueued[0].body.requireQuestionMatch, true);
});

test("requireQuestionMatch without an expected question fails closed and enqueues nothing", async () => {
    const { client, enqueued } = makeClient({ pending: { question: "whatever is open now", iteration: 9 } });
    await assert.rejects(() => client.sendAnswer("s-1", "left", { requireQuestionMatch: true }), /requireQuestionMatch.*expectedQuestion/s);
    await assert.rejects(() => client.sendAnswer("s-1", "left", { expectedQuestion: null, requireQuestionMatch: true }), /requireQuestionMatch.*expectedQuestion/s);
    assert.deepEqual(enqueued, []);
});

test("a strict binding must be an object with a non-empty question text and a numeric iteration, if any", async () => {
    const { client, enqueued } = makeClient({ pending: asked });
    for (const bad of [{}, { question: "" }, { question: 5 }, { question: "q", iteration: "3" }, { iteration: 3 }, "first?", [], 0]) {
        await assert.rejects(() => client.sendAnswer("s-1", "left", { expectedQuestion: bad, requireQuestionMatch: true }), /non-empty text/, JSON.stringify(bad));
    }
    assert.deepEqual(enqueued, []);
    await client.sendAnswer("s-1", "left", { expectedQuestion: { question: "first?" }, requireQuestionMatch: true });
    assert.equal(enqueued.length, 1, "an iteration is optional");
});

test("an answer that does not opt in is byte-identical to what older clients sent", async () => {
    const { client, enqueued } = makeClient({ pending: asked });
    await client.sendAnswer("s-1", "left", { expectedQuestion: asked });
    await client.sendAnswer("s-1", "left");
    assert.equal(enqueued.length, 2);
    for (const e of enqueued) assert.ok(!("requireQuestionMatch" in e.body), JSON.stringify(e.body));
    assert.deepEqual(enqueued[1].body.expectedQuestion, asked, "an unbound answer still reads the open question, as before");
});

test("requireQuestionMatch: false is the same as not asking", async () => {
    const { client, enqueued } = makeClient();
    await client.sendAnswer("s-1", "left", { expectedQuestion: asked, requireQuestionMatch: false });
    assert.ok(!("requireQuestionMatch" in enqueued[0].body));
});

test("the web client sends the option to the API", async () => {
    const calls = [];
    const client = Object.create(WebPilotSwarmManagementClient.prototype);
    client._api = { call: async (name, params) => { calls.push({ name, params }); } };
    await client.sendAnswer("s-1", "left", { expectedQuestion: asked, requireQuestionMatch: true });
    assert.deepEqual(calls, [{ name: "sendAnswer", params: { sessionId: "s-1", answer: "left", options: { expectedQuestion: asked, requireQuestionMatch: true } } }]);
});

test("the web client validates a strict binding before any API request", async () => {
    const calls = [];
    const client = Object.create(WebPilotSwarmManagementClient.prototype);
    client._api = { call: async (name, params) => { calls.push({ name, params }); } };
    for (const bad of [undefined, null, {}, { question: "" }, { question: "q", iteration: "x" }]) {
        await assert.rejects(() => client.sendAnswer("s-1", "left", { expectedQuestion: bad, requireQuestionMatch: true }), /non-empty text/);
    }
    await assert.rejects(() => client.sendAnswer("s-1", "left", { requireQuestionMatch: true }), /non-empty text/);
    assert.deepEqual(calls, [], "no request was made");
    await client.sendAnswer("s-1", "left", { expectedQuestion: asked });
    assert.equal(calls.length, 1, "an answer that does not opt in is not validated here");
});

test("the sendAnswer operation documents the option", () => {
    const op = OPERATIONS.find((o) => o.name === "sendAnswer");
    assert.match(op.summary, /requireQuestionMatch/);
});
