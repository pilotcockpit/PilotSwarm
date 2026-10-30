import { registerDemoOps } from "./registry";

// Demo knowledge: a healthy enhanced store with some soft-deleted facts waiting to be cleaned up.

const hours = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
let embedderRunning = true;
let tomb: { pendingTotal: number; unreconciled: number; ttlBlocked: number; oldestUnreconciledAgeSeconds: number | null; reconciledUnswept: number } = { pendingTotal: 14, unreconciled: 6, ttlBlocked: 3, oldestUnreconciledAgeSeconds: 5400, reconciledUnswept: 8 };
const namespaces: Array<{ namespace: string; archived: boolean; frontmatter: { name?: string; description: string }; createdAt: string; updatedAt: string; nodes: number; edges: number }> = [
  { namespace: "pilotswarm/runbooks", archived: false, frontmatter: { name: "Runbooks", description: "Operational runbooks and incident write-ups agents consult before acting." }, createdAt: hours(900), updatedAt: hours(30), nodes: 312, edges: 1180 },
  { namespace: "acme/services", archived: false, frontmatter: { name: "Services map", description: "Which service owns what, who is on call, and how they depend on each other." }, createdAt: hours(600), updatedAt: hours(6), nodes: 128, edges: 420 },
  { namespace: "scratch/experiments", archived: true, frontmatter: { name: "Experiments", description: "Throwaway corpus from the retrieval tuning week." }, createdAt: hours(1500), updatedAt: hours(700), nodes: 9, edges: 14 },
];
const facts = [
  { scopeKey: "shared:skills/kusto/slow-queries", key: "skills/kusto/slow-queries", value: { summary: "When p95 doubles after a rollout, compare the worker image digest first, then query the slow-path histogram." }, tags: ["runbook", "latency"], shared: true, agentId: "sre-investigator", sessionId: null, updatedAt: hours(30) },
  { scopeKey: "shared:skills/release/rollback", key: "skills/release/rollback", value: { steps: ["Pause the rollout", "Roll back one worker at a time", "Confirm sessions resumed"], owner: "release-captain" }, tags: ["release"], shared: true, agentId: "release-captain", sessionId: null, updatedAt: hours(80) },
  { scopeKey: "shared:asks/billing/limits", key: "asks/billing/limits", value: "Which provider has the tightest monthly limit this week?", tags: ["billing"], shared: true, agentId: "researcher", sessionId: null, updatedAt: hours(12) },
  { scopeKey: "shared:config/crawler/schedule", key: "config/crawler/schedule", value: { every: "15m", namespaces: ["pilotswarm/runbooks"] }, tags: ["crawler"], shared: true, agentId: null, sessionId: null, updatedAt: hours(200) },
];

registerDemoOps(import.meta.url, {
  factsCapabilities: () => ({ search: true, embedder: true, graph: true }),
  getSharedFactsStats: () => [
    { namespace: "skills", factCount: 184, totalValueBytes: 612_000, oldestCreatedAt: hours(2200), newestUpdatedAt: hours(2) },
    { namespace: "asks", factCount: 97, totalValueBytes: 88_000, oldestCreatedAt: hours(1400), newestUpdatedAt: hours(12) },
    { namespace: "intake", factCount: 41, totalValueBytes: 1_940_000, oldestCreatedAt: hours(300), newestUpdatedAt: hours(1) },
    { namespace: "config", factCount: 12, totalValueBytes: 9_200, oldestCreatedAt: hours(3000), newestUpdatedAt: hours(200) },
  ],
  getFactsTombstoneStats: () => ({ ...tomb }),
  getEmbedderStatus: () => ({ supported: true, running: embedderRunning, status: embedderRunning ? "Running" : "Stopped", instanceId: "embedder-7f3a" }),
  startFactsEmbedder: () => { embedderRunning = true; return { started: true }; },
  stopFactsEmbedder: () => { embedderRunning = false; return { stopped: true }; },
  listGraphNamespaces: () => namespaces.map(({ nodes: _n, edges: _e, ...rest }) => rest),
  graphStats: ({ namespace }) => {
    const n = namespaces.find((x) => x.namespace === namespace);
    return { nodeCount: n?.nodes ?? 0, edgeCount: n?.edges ?? 0 };
  },
  upsertGraphNamespace: ({ input }) => {
    const i = namespaces.findIndex((x) => x.namespace === input.namespace);
    const row = { namespace: input.namespace, archived: false, frontmatter: input.frontmatter, createdAt: hours(0), updatedAt: hours(0), nodes: 0, edges: 0 };
    if (i >= 0) namespaces[i] = { ...namespaces[i], frontmatter: input.frontmatter, updatedAt: hours(0) };
    else namespaces.unshift(row);
    return row;
  },
  deleteGraphNamespace: ({ namespace }) => {
    const i = namespaces.findIndex((x) => x.namespace === namespace);
    if (i >= 0) namespaces.splice(i, 1);
    return { deleted: true };
  },
  forcePurgeFacts: ({ input }) => {
    const n = input?.onlyUnreconciled ? tomb.unreconciled : tomb.pendingTotal;
    tomb = { pendingTotal: tomb.pendingTotal - n, unreconciled: input?.onlyUnreconciled ? 0 : 0, ttlBlocked: 0, oldestUnreconciledAgeSeconds: null, reconciledUnswept: input?.onlyUnreconciled ? tomb.reconciledUnswept : 0 };
    return n;
  },
  searchFacts: ({ query, opts }) => {
    const q = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
    const scored = facts.map((f) => {
      const hay = `${f.key} ${JSON.stringify(f.value)} ${f.tags.join(" ")}`.toLowerCase();
      const hits = q.filter((w) => hay.includes(w)).length;
      return { ...f, score: hits / Math.max(1, q.length) };
    }).filter((f) => f.score > 0).sort((a, b) => b.score - a.score);
    return { count: scored.length, mode: opts?.mode || "hybrid", facts: scored };
  },
  readFacts: () => ({ count: facts.length, facts }),
});
