/**
 * Stale bound answers fail closed (orchestration 1.0.83).
 *
 * An answer carries the question it was written for (`expectedQuestion`).
 * Through 1.0.82 an answer whose question was no longer pending was kept as
 * ordinary input, so an old "Delete old files" ran as a prompt while a newer
 * question waited. A caller that opts in with `requireQuestionMatch` now gets
 * the opposite from 1.0.83: no turn runs, the open question stays open, and
 * `session.answer_rejected` says why. Callers that do not opt in, and
 * sessions still on 1.0.82, keep the lenient behavior.
 *
 * Drives the real drain/decide generators against a fake durable context, as
 * fifo-queue-drain.test.js does.
 */
import { describe, expect, it, vi } from "vitest";
import * as live from "../../src/orchestration/runtime.ts";
import * as liveQueue from "../../src/orchestration/queue.ts";
import * as frozenRuntime from "../../src/orchestration_1_0_82/runtime.ts";
import * as frozenQueue from "../../src/orchestration_1_0_82/queue.ts";
import { FIFO_BUCKET_COUNT } from "../../src/orchestration/state.ts";

vi.mock("../../src/session-proxy.js", () => ({
    createSessionProxy: (ctx, sessionId, affinity, config, contract) => ctx.proxy("session", contract),
    createSessionManagerProxy: (ctx, contract) => ctx.proxy("manager", contract),
}));

const LIVE = { runtime: live, queue: liveQueue, version: "1.0.83" };
const FROZEN_1_0_82 = { runtime: frozenRuntime, queue: frozenQueue, version: "1.0.82" };

function harness(mods, overrides = {}) {
    const calls = [];
    const turns = [];
    const results = [];
    const messages = [];
    const kv = new Map();
    const clock = { now: 1_750_000_000_000 };
    let guid = 0;
    const ctx = {
        traceInfo() {},
        traceWarn() {},
        traceError() {},
        setCustomStatus() {},
        getValue: key => kv.get(key) ?? null,
        setValue: (key, value) => { kv.set(key, value); },
        clearValue: key => kv.delete(key),
        utcNow: () => ({ effect: "now" }),
        newGuid: () => ({ effect: "guid" }),
        scheduleTimer: ms => ({ effect: "timer", ms }),
        dequeueEvent: name => ({ effect: "dequeue", name }),
        race: (left, right) => ({ effect: "race", left, right }),
        continueAsNewVersioned: (input, version) => ({ effect: "can", input, version }),
        proxy(prefix) {
            return new Proxy({}, { get: (_, name) => (...args) => ({ effect: `${prefix}.${String(name)}`, args }) });
        },
    };
    function resolve(effect) {
        if (effect == null) return undefined;
        calls.push(effect);
        switch (effect.effect) {
            case "now": return clock.now;
            case "guid": return `guid-${++guid}`;
            case "timer": clock.now += effect.ms; return undefined;
            case "dequeue":
                if (!messages.length) throw new Error("unexpected blocking dequeue");
                return JSON.stringify(messages.shift());
            case "race":
                if (effect.left?.effect === "session.runTurn") return { index: 0, value: resolve(effect.left) };
                if (effect.left?.effect === "dequeue") {
                    if (messages.length) return { index: 0, value: JSON.stringify(messages.shift()) };
                    clock.now += effect.right.ms;
                    return { index: 1 };
                }
                throw new Error(`unexpected race: ${JSON.stringify(effect)}`);
            case "session.runTurn": {
                turns.push(effect.args);
                if (!results.length) throw new Error("unexpected turn");
                return results.shift();
            }
            case "manager.getWorkerSessionPolicy": return { policy: null, allowedAgentNames: [] };
            case "manager.resolveAgentConfig": return null;
            case "manager.getOrchestrationStats": return { historySizeBytes: 0 };
            case "manager.listChildSessions": return "[]";
            default: return undefined;
        }
    }
    function drive(gen) {
        let value;
        let failure;
        for (let step = 0; step < 2000; step++) {
            const next = failure ? gen.throw(failure) : gen.next(value);
            failure = undefined;
            if (next.done) return next.value;
            try { value = resolve(next.value); } catch (error) { failure = error; }
        }
        throw new Error("generator exceeded bound");
    }
    const runtime = drive(mods.runtime.createRuntime(ctx, {
        sessionId: "answer-binding-fixture",
        config: {},
        iteration: 4,
        isSystem: true,
        blobEnabled: false,
        ...overrides,
    }, { currentVersion: mods.version, latestVersion: mods.version }));
    const events = () => calls.flatMap(c => (c.effect === "manager.recordSessionEvent" ? c.args[1] : []));
    const fifo = () => {
        const out = [];
        for (let i = 0; i < FIFO_BUCKET_COUNT; i++) {
            const raw = kv.get(`fifo.${i}`);
            if (raw) out.push(...JSON.parse(raw));
        }
        return out;
    };
    const step = () => {
        drive(mods.queue.drain(runtime));
        const before = mods.queue.turnsStarted ? mods.queue.turnsStarted(runtime) : 0;
        const didWork = drive(mods.queue.decide(runtime));
        if (mods.queue.settleQueuedWorkAfterDecide) mods.queue.settleQueuedWorkAfterDecide(runtime, before);
        return didWork;
    };
    return { runtime, messages, results, turns, events, fifo, step };
}

const OPEN = { question: "second?", iteration: 4 };
const first = { question: "first?", iteration: 3 };
const rejected = h => h.events().filter(e => e.eventType === "session.answer_rejected");

describe("bound answers, orchestration 1.0.83", () => {
    it("an answer bound to the open question runs as an answer and closes the question", () => {
        const h = harness(LIVE, { pendingInputQuestion: { ...OPEN } });
        h.messages.push({ answer: "left", expectedQuestion: { ...OPEN }, requireQuestionMatch: true, wasFreeform: true });
        h.results.push({ type: "completed", content: "done" });
        h.step();
        expect(h.turns).toHaveLength(1);
        expect(h.turns[0][0]).toMatch(/The user was asked: "second\?"/);
        expect(h.turns[0][0]).toMatch(/The user responded: "left"/);
        expect(h.runtime.state.pendingInputQuestion).toBeNull();
        expect(rejected(h)).toEqual([]);
    });

    it("a stale bound answer runs no turn, keeps the open question and records why", () => {
        const h = harness(LIVE, { pendingInputQuestion: { ...OPEN } });
        h.messages.push({ answer: "Delete old files", expectedQuestion: first, requireQuestionMatch: true, wasFreeform: true });
        h.step();
        expect(h.turns).toEqual([]);
        expect(h.runtime.state.pendingInputQuestion?.question).toBe("second?");
        expect(h.fifo().some(item => item.kind === "answer")).toBe(false);
        expect(rejected(h)).toEqual([
            expect.objectContaining({
                data: expect.objectContaining({
                    reason: "stale-question",
                    expectedQuestion: first,
                    currentQuestion: expect.objectContaining({ question: "second?" }),
                }),
            }),
        ]);
    });

    it("a bound answer to a different iteration of the same text is stale", () => {
        const h = harness(LIVE, { pendingInputQuestion: { ...OPEN } });
        h.messages.push({ answer: "left", expectedQuestion: { question: "second?", iteration: 3 }, requireQuestionMatch: true });
        h.step();
        expect(h.turns).toEqual([]);
        expect(rejected(h)).toHaveLength(1);
    });

    it("a bound answer with no question open is rejected and names no current question", () => {
        const h = harness(LIVE);
        h.messages.push({ answer: "Delete old files", expectedQuestion: first, requireQuestionMatch: true });
        h.step();
        expect(h.turns).toEqual([]);
        expect(rejected(h)[0].data).toEqual(expect.objectContaining({ reason: "no-open-question", currentQuestion: null }));
    });

    it("requireQuestionMatch with no expected question is rejected, never guessed", () => {
        const h = harness(LIVE, { pendingInputQuestion: { ...OPEN } });
        h.messages.push({ answer: "left", expectedQuestion: null, requireQuestionMatch: true });
        h.step();
        expect(h.turns).toEqual([]);
        expect(h.runtime.state.pendingInputQuestion?.question).toBe("second?");
        expect(rejected(h)).toEqual([expect.objectContaining({ data: expect.objectContaining({ reason: "invalid-binding" }) })]);
    });

    it("a rejected answer leaves the question's hold timer running", () => {
        const h = harness(LIVE, { pendingInputQuestion: { ...OPEN } });
        h.runtime.state.activeTimer = { deadlineMs: 1_750_000_000_000 + 60_000, originalDurationMs: 60_000, reason: "input grace", type: "input-grace" };
        h.messages.push({ answer: "Delete old files", expectedQuestion: first, requireQuestionMatch: true });
        h.step();
        expect(h.turns).toEqual([]);
        expect(h.runtime.state.pendingInputQuestion?.question).toBe("second?");
        expect(h.runtime.state.activeTimer?.type).toBe("input-grace");
        expect(rejected(h)).toHaveLength(1);
    });

    it("an answer that does not opt in stays lenient: a stale one is kept as ordinary input", () => {
        const h = harness(LIVE, { pendingInputQuestion: { ...OPEN } });
        h.messages.push({ answer: "Delete old files", expectedQuestion: first, wasFreeform: true });
        h.results.push({ type: "completed", content: "done" });
        h.step();
        expect(h.turns).toHaveLength(1);
        expect(h.turns[0][0]).toBe("Delete old files");
        expect(h.runtime.state.pendingInputQuestion?.question).toBe("second?");
        expect(rejected(h)).toEqual([]);
    });

    it("the flag is carried only when set, so queued answers stay byte-identical otherwise", () => {
        const h = harness(LIVE, { pendingInputQuestion: { ...OPEN } });
        h.messages.push({ answer: "left", expectedQuestion: { ...OPEN } });
        h.results.push({ type: "completed", content: "done" });
        h.step();
        expect(JSON.stringify(h.fifo())).not.toMatch(/requireQuestionMatch/);
    });
});

describe("a strict answer never runs without a valid binding", () => {
    const run = (overrides, message) => {
        const h = harness(LIVE, overrides);
        h.messages.push(message);
        h.results.push({ type: "completed", content: "done" });
        h.step();
        return h;
    };
    const expectRejected = (h, reason) => {
        expect(h.turns).toEqual([]);
        expect(rejected(h).map(e => e.data.reason)).toEqual([reason]);
    };

    it("an empty {} binding with no question open is invalid, not a match of undefined with undefined", () => {
        expectRejected(run({}, { answer: "Delete old files", expectedQuestion: {}, requireQuestionMatch: true }), "invalid-binding");
    });

    it("an empty {} binding with a question open is invalid", () => {
        const h = run({ pendingInputQuestion: { ...OPEN } }, { answer: "Delete old files", expectedQuestion: {}, requireQuestionMatch: true });
        expectRejected(h, "invalid-binding");
        expect(h.runtime.state.pendingInputQuestion?.question).toBe("second?");
    });

    it("an omitted binding is never guessed from the question that happens to be open", () => {
        const h = run({ pendingInputQuestion: { ...OPEN } }, { answer: "Delete old files", requireQuestionMatch: true });
        expectRejected(h, "invalid-binding");
        expect(h.runtime.state.pendingInputQuestion?.question).toBe("second?");
    });

    it("a null binding is invalid", () => {
        expectRejected(run({ pendingInputQuestion: { ...OPEN } }, { answer: "x", expectedQuestion: null, requireQuestionMatch: true }), "invalid-binding");
    });

    it("an empty or non-string question text is invalid", () => {
        expectRejected(run({}, { answer: "x", expectedQuestion: { question: "" }, requireQuestionMatch: true }), "invalid-binding");
        expectRejected(run({ pendingInputQuestion: { ...OPEN } }, { answer: "x", expectedQuestion: { question: 7 }, requireQuestionMatch: true }), "invalid-binding");
    });

    it("a valid binding with no question open is no-open-question", () => {
        expectRejected(run({}, { answer: "x", expectedQuestion: { question: "second?" }, requireQuestionMatch: true }), "no-open-question");
    });

    it("a valid binding to another question or iteration is stale-question", () => {
        expectRejected(run({ pendingInputQuestion: { ...OPEN } }, { answer: "x", expectedQuestion: first, requireQuestionMatch: true }), "stale-question");
        expectRejected(run({ pendingInputQuestion: { ...OPEN } }, { answer: "x", expectedQuestion: { question: "second?", iteration: 9 }, requireQuestionMatch: true }), "stale-question");
    });

    it("a valid binding without an iteration matches by text", () => {
        const h = run({ pendingInputQuestion: { ...OPEN } }, { answer: "left", expectedQuestion: { question: "second?" }, requireQuestionMatch: true });
        expect(h.turns).toHaveLength(1);
        expect(rejected(h)).toEqual([]);
    });

    it("a persisted strict FIFO entry is re-checked after serialisation", () => {
        for (const item of [
            { kind: "answer", answer: "Delete old files", requireQuestionMatch: true },
            { kind: "answer", answer: "Delete old files", expectedQuestion: {}, requireQuestionMatch: true },
            { kind: "answer", answer: "Delete old files", expectedQuestion: first, requireQuestionMatch: true },
        ]) {
            const h = harness(LIVE, { pendingInputQuestion: { ...OPEN } });
            liveQueue.appendToFifo(h.runtime, [JSON.parse(JSON.stringify(item))]);
            h.results.push({ type: "completed", content: "done" });
            h.step();
            expect(h.turns).toEqual([]);
            expect(rejected(h)).toHaveLength(1);
            expect(h.runtime.state.pendingInputQuestion?.question).toBe("second?");
        }
    });

    it("lenient callers are unchanged, including an empty binding", () => {
        const h = run({}, { answer: "Delete old files", expectedQuestion: {} });
        expect(h.turns).toHaveLength(1);
        expect(h.turns[0][0]).toBe("Delete old files");
        expect(rejected(h)).toEqual([]);
        const g = run({ pendingInputQuestion: { ...OPEN } }, { answer: "left" });
        expect(g.turns[0][0]).toMatch(/The user was asked: "second\?"/);
    });
});

describe("the frozen 1.0.82 handler stays lenient", () => {
    it("ignores requireQuestionMatch: a stale bound answer still runs as a prompt", () => {
        const h = harness(FROZEN_1_0_82, { pendingInputQuestion: { ...OPEN } });
        h.messages.push({ answer: "Delete old files", expectedQuestion: first, requireQuestionMatch: true, wasFreeform: true });
        h.results.push({ type: "completed", content: "done" });
        h.step();
        expect(h.turns).toHaveLength(1);
        expect(h.turns[0][0]).toBe("Delete old files");
        expect(rejected(h)).toEqual([]);
    });

    it("ignores a strict answer with an empty or omitted binding too", () => {
        for (const message of [{ answer: "Delete old files", expectedQuestion: {}, requireQuestionMatch: true }, { answer: "Delete old files", requireQuestionMatch: true }]) {
            const h = harness(FROZEN_1_0_82, {});
            h.messages.push(message);
            h.results.push({ type: "completed", content: "done" });
            h.step();
            expect(h.turns).toHaveLength(1);
            expect(rejected(h)).toEqual([]);
        }
    });
});
