import test from "node:test";
import assert from "node:assert/strict";
import {
    appReducer,
    buildSessionSearchDocument,
    buildSessionTree,
    createInitialState,
    parseSessionSearchQuery,
    scoreSessionSearchDocument,
    selectSessionRows,
} from "../src/index.js";

import { normalizeSessionSearchText } from "../src/session-search.js";

const owner = (displayName, email) => ({ provider: "entra", subject: email, displayName, email });

function loadedState(sessions) {
    let state = createInitialState();
    state = appReducer(state, { type: "sessions/loaded", sessions });
    return state;
}

function search(state, query) {
    const next = appReducer(state, { type: "sessions/filterQuery", query });
    return { state: next, rows: selectSessionRows(next) };
}

test("session search combines topic, summary, author, agent and structured fields", () => {
    const ada = owner("Ada Lovelace", "ada@example.com");
    const document = buildSessionSearchDocument({
        sessionId: "session-42",
        title: "PostgreSQL failover review",
        shortSummary: "Investigating replica promotion latency",
        summaryState: { intent: "Prepare the incident report" },
        agentId: "database-reviewer",
        status: "running",
        model: "github-copilot:gpt-5.6-terra",
    }, { owner: ada, groupTitle: "R2D Sessions" });

    for (const query of [
        "replica promotion",
        "author:ada",
        "agent:database-reviewer status:running",
        'group:"R2D Sessions" model:terra',
        "id:session-42",
        "topic:failover",
        "summary:incident",
    ]) {
        assert.ok(scoreSessionSearchDocument(document, parseSessionSearchQuery(query)) > 0, query);
    }
    assert.equal(scoreSessionSearchDocument(document, parseSessionSearchQuery("author:grace")), 0);
});

test("free text tolerates bounded typos while requiring every term", () => {
    const document = buildSessionSearchDocument({
        sessionId: "s1",
        title: "Postgres migration readiness",
        shortSummary: "Validates extension compatibility",
    });
    assert.ok(scoreSessionSearchDocument(document, "postgress migratoin") > 0);
    assert.equal(scoreSessionSearchDocument(document, "postgress billing"), 0);
});

test("exact title results rank ahead of summary-only and fuzzy results", () => {
    const state = loadedState([
        { sessionId: "summary", title: "Database work", shortSummary: "Postgres migration", status: "idle", createdAt: 1 },
        { sessionId: "fuzzy", title: "Postgress migratoin", status: "idle", createdAt: 2 },
        { sessionId: "title", title: "Postgres migration", status: "idle", createdAt: 3 },
    ]);
    const { rows } = search(state, "postgres migration");
    assert.deepEqual(rows.map((row) => row.sessionId), ["title", "summary", "fuzzy"]);
    assert.ok(rows[0].searchScore > rows[1].searchScore);
    assert.ok(rows[1].searchScore > rows[2].searchScore);
});

test("search reveals matching descendants without changing stored collapse state", () => {
    const sessions = [
        { sessionId: "group:g", groupId: "g", isGroup: true, title: "Incidents", status: "group", createdAt: 1 },
        { sessionId: "parent", groupId: "g", title: "Primary investigation", status: "idle", createdAt: 2 },
        { sessionId: "child", parentSessionId: "parent", title: "Replica promotion latency", status: "idle", createdAt: 3 },
        { sessionId: "other", title: "Unrelated", status: "idle", createdAt: 4 },
    ];
    let state = createInitialState();
    state = {
        ...state,
        sessions: {
            ...state.sessions,
            byId: Object.fromEntries(sessions.map((session) => [session.sessionId, session])),
            flat: buildSessionTree(sessions, new Set(["group:g", "parent"])),
            collapsedIds: new Set(["group:g", "parent"]),
            activeSessionId: "other",
        },
    };

    const result = search(state, "promotion latency");
    assert.deepEqual(result.rows.map((row) => [row.sessionId, row.depth]), [
        ["group:g", 0],
        ["parent", 1],
        ["child", 2],
    ]);
    assert.equal(result.rows.find((row) => row.sessionId === "child")?.searchMatch, true);
    assert.deepEqual([...result.state.sessions.collapsedIds].sort(), ["group:g", "parent"]);
    assert.equal(result.state.sessions.activeSessionId, "other", "filtering does not replace the attached chat");

    const cleared = search(result.state, "");
    assert.deepEqual(cleared.rows.map((row) => row.sessionId), ["group:g", "other"]);
});

test("selector searches effective parent ownership and live summaries", () => {
    const affan = owner("Affan Dar", "daraffan@microsoft.com");
    const state = loadedState([
        { sessionId: "parent", title: "Coordinator", owner: affan, status: "idle", createdAt: 1 },
        {
            sessionId: "child",
            parentSessionId: "parent",
            title: "Worker",
            shortSummary: "Auditing native task filesystem sharing",
            status: "idle",
            createdAt: 2,
        },
    ]);
    assert.deepEqual(search(state, "author:affan filesystem").rows.map((row) => row.sessionId), ["parent", "child"]);
});

test("large-list search does not enumerate the catalog for every rendered row", () => {
    const sessions = Array.from({ length: 1500 }, (_, i) => ({ sessionId: `large-${i}`, title: `Project ${i}`,
        status: "idle", owner: owner("Ada", "ada@example.com") }));
    const state = loadedState(sessions);
    let enumerations = 0;
    state.sessions.byId = new Proxy(state.sessions.byId, { ownKeys(target) { enumerations++; return Reflect.ownKeys(target); } });
    assert.equal(search(state, "project").rows.length, 1500);
    assert.ok(enumerations < 20, `catalog enumerated ${enumerations} times`);
    enumerations = 0;
    assert.equal(search(state, "proj").rows.length, 1500);
    assert.ok(enumerations < 5, `unchanged catalog enumerated ${enumerations} times`);
});

test("search cache invalidates when a catalog entry changes without a new flat list", () => {
    const state = loadedState([{ sessionId: "one", title: "Alpha project", status: "idle" }]);
    assert.equal(search(state, "alpha").rows.length, 1);
    const changed = { ...state, sessions: { ...state.sessions,
        byId: { ...state.sessions.byId, one: { ...state.sessions.byId.one, title: "Beta project" } } } };
    assert.equal(search(changed, "alpha").rows.length, 0);
    assert.equal(search(changed, "beta").rows.length, 1);
});


test("query tokenization preserves quoted values, aliases and incomplete input", () => {
    assert.deepEqual(parseSessionSearchQuery(' OWNER:"Áda Lovelace" folder:Incidents unknown:value topic: "one""two" "" "unfinished '), {
        source: 'OWNER:"Áda Lovelace" folder:Incidents unknown:value topic: "one""two" "" "unfinished',
        terms: ["unknown value", "topic", "one", "two", "unfinished"],
        filters: [{ field: "author", value: "ada lovelace" }, { field: "group", value: "incidents" }],
    });
    assert.deepEqual(parseSessionSearchQuery("author:"), { source: "author:", terms: ["author"], filters: [] });
});

test("query scanning stays compatible with the previous tokenizer on bounded generated inputs", () => {
    // Keep the old grammar as a bounded compatibility oracle, never on long input.
    const aliases = { author: "author", owner: "author", agent: "agent", status: "status", group: "group",
        folder: "group", model: "model", id: "id", topic: "topic", summary: "summary" };
    function previous(value) {
        const source = String(value || "").trim();
        const terms = [], filters = [];
        const pattern = /(?:(\w+):)?(?:"([^"]+)"|(\S+))/g;
        for (const match of source.matchAll(pattern)) {
            const rawField = String(match[1] || "").toLowerCase();
            const rawValue = match[2] ?? match[3] ?? "";
            const normalized = normalizeSessionSearchText(rawValue);
            if (!normalized) continue;
            const field = aliases[rawField];
            if (field) filters.push({ field, value: normalized });
            else terms.push(normalizeSessionSearchText(rawField ? `${rawField} ${rawValue}` : rawValue));
        }
        return { source, terms: terms.filter(Boolean), filters };
    }
    const pieces = ['a', '0', '_', ':', '"', ' ', '\t', '\n', '\u00a0', 'é', '-', '.',
        'author:', 'OWNER:', 'group:', 'model:', 'unknown:', 'constructor:', '__proto__:'];
    let seed = 0x12345678;
    for (let i = 0; i < 10000; i += 1) {
        let query = "";
        for (let j = 0; j < 12; j += 1) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            query += pieces[seed % pieces.length];
        }
        assert.deepEqual(parseSessionSearchQuery(query), previous(query), JSON.stringify(query));
    }
});

test("query scanning handles long unbroken and quoted search text", () => {
    const value = "0".repeat(150000);
    assert.deepEqual(parseSessionSearchQuery(value).terms, [value]);
    assert.deepEqual(parseSessionSearchQuery(`topic:"${value}"`).filters, [{ field: "topic", value }]);
    assert.deepEqual(parseSessionSearchQuery(`"${value}`).terms, [value]);
});
