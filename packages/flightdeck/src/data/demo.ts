import type { Agent, Artifact, ConnectionState, DataSource, FeatureFlag, LogEntry, Model, Provider, Session, SessionEvent, UsageSummary, Worker } from "./types";
import { P95_HTML, RELEASE_CHECKLIST_HTML, TEST_MATRIX_HTML } from "@/canvas/demo-canvases";
import { demoPackageAgents } from "./ops/packages.demo";

// Demo data: fixtures shaped exactly like the Web API's payloads, so every
// screen can be judged with realistic content when the local deployment has
// no working model provider. Nothing here talks to a server.

const now = Date.now();
const m = (mins: number) => now - mins * 60_000;
const ahead = (mins: number) => now + mins * 60_000;

const RELEASE = "a1f0c2d4-0001-4c00-9000-000000000001";
const TESTS = "a1f0c2d4-0002-4c00-9000-000000000002";
const CHANGELOG = "a1f0c2d4-0003-4c00-9000-000000000003";
const IMAGE = "a1f0c2d4-0004-4c00-9000-000000000004";
const P95 = "a1f0c2d4-0005-4c00-9000-000000000005";
const DEPS = "a1f0c2d4-0006-4c00-9000-000000000006";
const RESEARCH = "a1f0c2d4-0007-4c00-9000-000000000007";
const CANVAS_PORT = "a1f0c2d4-0008-4c00-9000-000000000008";
const COST = "a1f0c2d4-0009-4c00-9000-000000000009";
const ONBOARD = "a1f0c2d4-0010-4c00-9000-000000000010";
const SWEEPER = "a1f0c2d4-0011-4c00-9000-000000000011";
const RESMGR = "a1f0c2d4-0012-4c00-9000-000000000012";
const WIKI = "a1f0c2d4-0013-4c00-9000-000000000013";

const WIF_ERROR =
  'Failed after 3 attempts: Activity \'runTurnV4\' JS execution failed: GenericFailure, Error: Provider "anthropic-wif" authenticates with workload identity, but the worker is missing ANTHROPIC_FEDERATION_RULE_ID, ANTHROPIC_ORGANIZATION_ID, ANTHROPIC_SERVICE_ACCOUNT_ID, ANTHROPIC_IDENTITY_TOKEN_FILE (or ANTHROPIC_IDENTITY_TOKEN, or AZURE_FEDERATED_TOKEN_FILE with AZURE_TENANT_ID).';

const sessions: Session[] = [
  {
    sessionId: P95, owner: "me", canWrite: true, title: "Investigate p95 spike on chk", agentId: "sre-investigator", status: "input_required", groupId: "g-ops",
    createdAt: m(52), updatedAt: m(4), model: "anthropic-wif:claude-sonnet-5", visibility: "private", iterations: 6,
    pendingQuestion: {
      question: "Roll back the chk worker image from v0.8.6 to v0.8.5? p95 latency doubled after the rollout at 13:20.",
      choices: ["Roll back now", "Wait 30 minutes", "Keep v0.8.6"], allowFreeform: true, iteration: 6,
    },
    spine: ["run", "run", "sleep", "run", "run", "run", "wait"], unseenCanvas: true,
  },
  {
    sessionId: DEPS, owner: "me", canWrite: true, title: "Weekly dependency bumps", agentId: "deps-bot", status: "error", groupId: "g-ops", createdAt: m(300), updatedAt: m(31),
    model: "anthropic-wif:claude-sonnet-5", error: WIF_ERROR, visibility: "private", iterations: 3, spine: ["run", "done", "sleep", "run", "fail"],
  },
  {
    sessionId: RESEARCH, owner: "Riya Kapoor", canWrite: false, title: "Customer research digest", agentId: "researcher", status: "waiting", createdAt: m(240), updatedAt: m(60),
    model: "anthropic-wif:claude-opus-5", visibility: "shared_read", iterations: 11,
    pauseState: { kind: "allowance", provider: "anthropic-wif", period: "month", yourUsedTokens: 9_700_000, ceilingTokens: 10_000_000, resetsAtUtc: null },
    spine: ["run", "run", "sleep", "run", "run", "wait"],
  },
  {
    sessionId: RELEASE, owner: "me", canWrite: true, title: "Release readiness 0.8.8", agentId: "release-captain", status: "waiting", createdAt: m(110), updatedAt: m(2),
    model: "anthropic-wif:claude-sonnet-5", activeChildCount: 2, waitReason: "waiting for 2 agent(s)", visibility: "shared_write", iterations: 9, pinned: true,
    workspace: { repo: "pilotswarm", branch: "dev", root: "main" }, unseenCanvas: true,
    spine: ["run", "run", "sleep", "run", "done", "run", "wait", "wait"],
  },
  {
    sessionId: TESTS, owner: "me", canWrite: true, title: "Run test campaign", agentId: "test-runner", status: "running", parentSessionId: RELEASE, rootSessionId: RELEASE,
    createdAt: m(96), updatedAt: m(0), model: "anthropic-wif:claude-sonnet-5", step: "Running suite 6 of 9", iterations: 14,
    spine: ["run", "run", "run", "run", "run", "run", "run", "run", "run"],
  },
  {
    sessionId: IMAGE, owner: "me", canWrite: true, title: "Verify Azure Linux 3 image", agentId: "image-verifier", status: "running", parentSessionId: RELEASE, rootSessionId: RELEASE,
    createdAt: m(96), updatedAt: m(0), model: "anthropic-wif:claude-sonnet-5", step: "Booting test VM", iterations: 5,
    spine: ["run", "sleep", "sleep", "run", "run", "run"],
  },
  {
    sessionId: CHANGELOG, owner: "me", canWrite: true, title: "Check changelog", agentId: "doc-checker", status: "completed", parentSessionId: RELEASE, rootSessionId: RELEASE,
    createdAt: m(96), updatedAt: m(43), model: "anthropic-wif:claude-sonnet-5", iterations: 3, spine: ["run", "run", "done"],
  },
  {
    sessionId: CANVAS_PORT, owner: "Mo Said", canWrite: true, title: "Port canvas host to TSX", agentId: "coder", status: "running", groupId: "g-release", contextUsage: { utilization: 0.38, tokenLimit: 200000, currentTokens: 76000 }, createdAt: m(70), updatedAt: m(0),
    model: "anthropic-wif:claude-opus-5", step: "Editing CanvasFrame.tsx", iterations: 22, workspace: { repo: "pilotswarm", branch: "canvas-host", root: "main" },
    spine: ["run", "run", "run", "sleep", "run", "run", "run", "run"],
  },
  {
    sessionId: COST, owner: "me", canWrite: true, title: "Nightly cost report", agentId: "finops", status: "waiting", groupId: "g-ops", cronActive: true, cronInterval: 86400, cronNextFireAt: ahead(11 * 60 + 45),
    createdAt: m(60 * 24 * 9), updatedAt: m(60 * 14), model: "azure-foundry-wif:gpt-5.6", iterations: 9, spine: ["run", "sleep", "run", "sleep", "run", "sleep"],
  },
  {
    sessionId: ONBOARD, owner: "me", canWrite: true, title: "Onboarding guide rewrite", agentId: "pilotswarm", status: "idle", createdAt: m(60 * 27), updatedAt: m(60 * 20),
    model: "anthropic-wif:claude-sonnet-5", iterations: 4, spine: ["run", "run", "done"],
  },
  {
    sessionId: WIKI, owner: "me", canWrite: true, title: "How does duroxide replay work?", agentId: "deepwiki", status: "completed", createdAt: m(60 * 50), updatedAt: m(60 * 49),
    model: "anthropic-wif:claude-sonnet-5", iterations: 2, spine: ["run", "done"],
  },
  {
    sessionId: SWEEPER, owner: "me", canWrite: true, title: "Sweeper Agent", agentId: "sweeper", status: "waiting", isSystem: true, cronActive: true, cronInterval: 900, cronNextFireAt: ahead(15),
    createdAt: m(60 * 24 * 30), updatedAt: m(1), model: "anthropic-wif:claude-sonnet-5", spine: ["run", "sleep", "run", "sleep", "run", "sleep"],
  },
  {
    sessionId: RESMGR, owner: "me", canWrite: true, title: "Resource Manager Agent", agentId: "resourcemgr", status: "running", isSystem: true, step: "Rebalancing 2 sessions",
    createdAt: m(60 * 24 * 30), updatedAt: m(0), model: "anthropic-wif:claude-sonnet-5", spine: ["run", "run", "sleep", "run", "run"],
  },
];

type DemoEvent = Omit<SessionEvent, "seq" | "sessionId"> & { at: number };

const user = (at: number, content: string): DemoEvent => ({ eventType: "user.message", at, data: { content } });
const assistant = (at: number, content: string): DemoEvent => ({ eventType: "assistant.message", at, data: { content } });
const tool = (at: number, id: string, toolName: string, args: unknown, result: unknown, ok = true): DemoEvent[] => [
  { eventType: "tool.execution_start", at, data: { toolCallId: id, toolName, arguments: args } },
  { eventType: "tool.execution_complete", at: at + 1800, data: { toolCallId: id, toolName, success: ok, result, ...(ok ? {} : { error: String(result) }) } },
];
const spawn = (at: number, childSessionId: string, agentId: string, task: string): DemoEvent => ({
  eventType: "session.agent_spawned", at, data: { childSessionId, agentId, task },
});

const timelines: Record<string, DemoEvent[]> = {
  [RELEASE]: [
    user(m(110), "Get 0.8.8 ready to ship. Run the test campaign, check the changelog, and verify the Azure Linux 3 image. Put the sign-off checklist on a canvas so the approvers can tick it off."),
    assistant(m(109), "I'll split this into three sub-agents and track the 41 sign-off items on a canvas. I'll come back when the test campaign and the image check finish."),
    spawn(m(108), TESTS, "test-runner", "Run test campaign"),
    spawn(m(108), CHANGELOG, "doc-checker", "Check changelog"),
    spawn(m(108), IMAGE, "image-verifier", "Verify Azure Linux 3 image"),
    ...tool(m(107), "c1", "write_canvas", { slot: 1, title: "Release checklist" }, { rev: 1 }),
    { eventType: "session.canvas_updated", at: m(107), data: { rev: 1, note: "Release checklist" } },
    ...tool(m(106), "c2", "write_canvas", { slot: 2, title: "Test matrix" }, { rev: 1 }),
    assistant(m(43), "The changelog check finished. Two entries were missing pull-request links, and I added them. **33 of 41** sign-off items are done; the rest wait on the test campaign and the image check."),
    ...tool(m(42), "c3", "wait_for_agents", { agents: ["test-runner", "image-verifier"] }, "waiting"),
  ],
  [P95]: [
    user(m(52), "p95 latency on chk looks bad since lunch. Find out why."),
    ...tool(m(51), "p1", "kusto_query", { cluster: "chk", query: "requests | summarize p95=percentile(duration,95) by bin(timestamp,5m), image" }, "rows: 48"),
    ...tool(m(49), "p2", "list_deployments", { cluster: "chk", since: "12:00" }, ["13:20 worker image v0.8.5 → v0.8.6"]),
    ...tool(m(47), "p3", "write_canvas", { slot: 1, title: "p95 by worker image" }, { rev: 1 }),
    assistant(m(46), "p95 doubled from **318 ms to 702 ms** right after the 13:20 rollout of worker image v0.8.6. Error rate barely moved, so this looks like a slower code path, not failures. I drew the comparison on a canvas."),
    assistant(m(4), "I can roll back the chk worker image to v0.8.5 now. That restarts 4 workers, one at a time; sessions resume on the others."),
  ],
  [DEPS]: [
    user(m(300), "Every Monday: bump patch versions of our npm dependencies, run the unit tests, and open a PR if they pass."),
    assistant(m(298), "Bumped 14 packages, tests passed, PR #241 opened. Next run is next Monday."),
    user(m(32), "Also bump @types/react to the latest 19.2."),
    { eventType: "session.error", at: m(31), data: { message: WIF_ERROR, fatal: true } },
  ],
  [RESEARCH]: [
    user(m(240), "Summarize the last two weeks of customer interviews into themes with quotes."),
    assistant(m(200), "I've read 18 of 26 transcripts. Three themes so far: durable sessions are trusted, canvas sharing is confusing, and budgets are hard to find."),
    { eventType: "system.message", at: m(60), data: { content: "Paused: monthly allowance for anthropic-wif reached." } },
  ],
  [TESTS]: [
    user(m(96), "Run the full local test campaign for 0.8.8 and report failures."),
    ...tool(m(95), "t1", "bash", { command: "npm run test:campaign" }, "suite 1..5 passed"),
    assistant(m(20), "Suites 1–5 passed. Running durability and multi-worker suites now."),
  ],
  [IMAGE]: [user(m(96), "Verify the Azure Linux 3 starter image boots and runs the smoke test."), assistant(m(30), "Image pulled and signed. Booting the test VM.")],
  [CHANGELOG]: [
    user(m(96), "Check CHANGELOG.md for 0.8.8: every entry needs a PR link."),
    assistant(m(43), "Done. Two entries were missing links; I added #229 and #230. **Verdict: pass.**"),
  ],
  [CANVAS_PORT]: [
    user(m(70), "Port the canvas host component to TypeScript without changing the postMessage protocol."),
    ...tool(m(60), "k1", "read_file", { path: "packages/app/ui/react/src/web-app.js", range: "8700-8900" }, "200 lines"),
    ...tool(m(20), "k2", "edit_file", { path: "packages/flightdeck/src/canvas/CanvasFrame.tsx" }, "ok"),
    assistant(m(1), "The frame, the link guard and the visibility receipts are ported. Running the canvas conformance cases next."),
  ],
  [COST]: [user(m(60 * 24 * 9), "Every night at 02:00, write yesterday's model cost by team to a CSV."), assistant(m(60 * 14), "Wrote cost-2026-10-29.csv. Total 41.2M tokens, up 8% on the week.")],
  [ONBOARD]: [user(m(60 * 27), "Rewrite the onboarding guide for the new portal."), assistant(m(60 * 20), "Draft is in onboarding.md. I left questions for you at the top.")],
  [WIKI]: [user(m(60 * 50), "How does duroxide replay work?"), assistant(m(60 * 49), "Replay re-runs the orchestration function against its recorded history. Each `await` on an activity returns the recorded result instead of running it again, so the code must be deterministic.")],
  [SWEEPER]: [assistant(m(1), "Swept 3 idle sessions.")],
  [RESMGR]: [assistant(m(0), "Rebalancing 2 sessions from worker chk-w3.")],
};

/** Test-published documents (dev only, see the `artifacts` demo hook), shared by every copy of the demo source. */
const published = new Map<string, Array<Artifact & { content?: string }>>();
/** Server-side changes a test makes behind the page's back. Held outside the source, which the app may build twice. */
const serverEdits = new Map<string, Record<string, unknown>>();

const artifacts: Record<string, Array<Artifact & { content?: string }>> = {
  [RELEASE]: [
    { filename: "canvas.html", size: 6100, contentType: "text/html", updatedAt: m(2), content: RELEASE_CHECKLIST_HTML },
    { filename: "canvas2.html", size: 3200, contentType: "text/html", updatedAt: m(9), content: TEST_MATRIX_HTML },
    { filename: "CHANGELOG.md", size: 18_400, contentType: "text/markdown", updatedAt: m(43), content: "# Changelog\n\n## 0.8.8\n\n- sdk: adopt duroxide 0.2.4 (#230)\n- app: restore Azure Linux 3 native compatibility (#219)\n" },
    { filename: "release-notes-draft.md", size: 4200, contentType: "text/markdown", updatedAt: m(30), content: "# PilotSwarm 0.8.8\n\nDraft notes." },
    { filename: "approvers.json", size: 380, contentType: "application/json", updatedAt: m(100), content: '{ "approvers": ["MS", "RK", "SL"] }' },
  ],
  [P95]: [{ filename: "canvas.html", size: 4100, contentType: "text/html", updatedAt: m(4), content: P95_HTML }, { filename: "p95-by-image.csv", size: 2600, contentType: "text/csv", updatedAt: m(46), content: "image,p50,p95\nv0.8.5,112,318\nv0.8.6,131,702\n" }],
  [COST]: [{ filename: "cost-2026-10-29.csv", size: 12_800, contentType: "text/csv", updatedAt: m(60 * 14), content: "team,tokens\nplatform,18.2M\nresearch,9.9M\n" }],
  [ONBOARD]: [{ filename: "onboarding.md", size: 9_100, contentType: "text/markdown", updatedAt: m(60 * 20), content: "# Onboarding\n\nQuestions for you first…" }],
  [CHANGELOG]: [{ filename: "CHANGELOG.md", size: 18_400, contentType: "text/markdown", updatedAt: m(43), content: "# Changelog" }],
};

const models: Model[] = [
  { qualifiedName: "anthropic-wif:claude-sonnet-5", providerId: "anthropic-wif", modelName: "claude-sonnet-5", description: "Fast, capable all-rounder.", cost: "medium", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max"], defaultReasoningEffort: "medium", credentialAvailable: true },
  { qualifiedName: "anthropic-wif:claude-opus-5", providerId: "anthropic-wif", modelName: "claude-opus-5", description: "Deepest reasoning, for the hardest and longest-horizon tasks.", cost: "high", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max"], defaultReasoningEffort: "medium", credentialAvailable: true },
  { qualifiedName: "azure-foundry-wif:gpt-5.6", providerId: "azure-foundry-wif", modelName: "gpt-5.6", description: "Azure AI Foundry GPT-5.6 through the worker's managed identity.", cost: "high", credentialAvailable: true },
  { qualifiedName: "github-copilot:claude-opus-5", providerId: "github-copilot", modelName: "claude-opus-5", description: "Claude Opus 5 through GitHub Copilot.", cost: "high", credentialAvailable: false, unavailableReason: "Add your GitHub Copilot key in Providers to use it." },
];

const agents: Agent[] = [
  { name: "pilotswarm", title: "PilotSwarm Agent", description: "General-purpose agent with sub-agents, canvases and working folders.", tools: ["bash", "write_canvas", "spawn_agent"], skills: ["html-visuals"], source: "builtin", package: "Built in" },
  { name: "release-captain", title: "Release captain", description: "Coordinates a release: tests, changelog, images, sign-off canvas.", tools: ["spawn_agent", "write_canvas", "git"], skills: ["release"], source: "package", package: "pilotswarm-release 1.4.0" },
  { name: "sre-investigator", title: "SRE investigator", description: "Finds the cause of latency and error spikes from metrics and deploys.", tools: ["kusto_query", "list_deployments", "write_canvas"], skills: ["incident"], source: "package", package: "ops-toolkit 0.9.2" },
  { name: "deepwiki", title: "DeepWiki Code Explorer", description: "Answers questions about any public GitHub repository using DeepWiki.", tools: ["deepwiki"], source: "builtin", package: "Built in" },
  { name: "generic-crawler", title: "Generic Crawler", description: "Scopes a source, designs the fact and graph schema, then runs and refreshes the crawl.", tools: ["fetch", "store_fact"], source: "builtin", package: "Built in" },
];

const providers: Provider[] = [
  { name: "anthropic-wif", typeId: "anthropic-wif", class: "shared", baseUrl: "https://api.anthropic.com", allowancePct: 40, hasCredential: true, usableByMe: true, isClusterDefault: true, ruleCount: 2,
    usage: { month: { used: 9_700_000, limit: 10_000_000 } }, limits: [{ period: "month", tokens: 10_000_000 }, { period: "day", tokens: 900_000, model: "anthropic-wif:claude-opus-5" }] },
  { name: "azure-foundry-wif", typeId: "azure-foundry-wif", class: "shared", baseUrl: "https://example-foundry.cognitiveservices.azure.com/openai/v1", allowancePct: 100, hasCredential: true, usableByMe: true, isSystemDefault: true, ruleCount: 1,
    usage: { month: { used: 12_000_000, limit: 40_000_000 } }, limits: [{ period: "month", tokens: 40_000_000 }] },
  { name: "my-openai", typeId: "openai", class: "personal", baseUrl: "https://api.openai.com/v1", allowancePct: 100, hasCredential: false, usableByMe: false, ownerDisplayName: "Sam Lee", ruleCount: 0, usage: { month: { used: 0, limit: null } } },
];

const usage: UsageSummary = {
  days: 14,
  daily: Array.from({ length: 14 }, (_, i) => ({ day: new Date(now - (13 - i) * 86400000).toISOString().slice(0, 10), total: Math.round(2_400_000 + Math.sin(i / 2) * 900_000 + i * 120_000) })),
  windows: {
    day: { input: 3_100_000, output: 1_100_000, total: 4_200_000, turns: 212, sessions: 11 },
    week: { input: 19_000_000, output: 6_400_000, total: 25_400_000, turns: 1290, sessions: 34 },
    month: { input: 71_000_000, output: 23_000_000, total: 94_000_000, turns: 5120, sessions: 96 },
  },
  models: [{ model: "anthropic-wif:claude-sonnet-5", total: 61_000_000 }, { model: "anthropic-wif:claude-opus-5", total: 21_000_000 }, { model: "azure-foundry-wif:gpt-5.6", total: 12_000_000 }],
};

const workers: Worker[] = ["chk-w1", "chk-w2", "chk-w3", "chk-w4"].map((id, i) => ({
  workerNodeId: id, pool: "default", phase: i === 2 ? "draining" : "ready", updatedAt: new Date(m(0)).toISOString(), registeredAt: new Date(m(60 * 30)).toISOString(),
  info: { sdkVersion: i === 3 ? "0.8.6" : "0.8.7", runtime: { hostname: `${id}.chk.internal`, substrate: "kubernetes" }, capabilities: { graph: true, blobStore: true, enhancedFacts: i !== 3 } },
  health: { uptimeS: 3600 * (30 - i * 4), rssBytes: (310 + i * 22) * 1048576, activeSessions: [3, 2, 1, 2][i], workerSlots: { total: 4 } },
}));

const flags: FeatureFlag[] = [
  { key: "sessions.steering", description: "Let people add guidance to a running turn (Steer).", type: "boolean", default: false, value: true, scope: "cluster" },
  { key: "copilot.native_tasks", description: "In-session Explore and Task cards.", type: "boolean", default: true, value: true, scope: "cluster" },
  { key: "canvas.share_links", description: "Public read-only links to a canvas.", type: "boolean", default: false, value: true, scope: "cluster" },
  { key: "portal.v2", description: "Serve Flight Deck at /next.", type: "boolean", default: false, value: false, scope: "cluster" },
  { key: "facts.enhanced", description: "Embedding-backed fact search.", type: "boolean", default: false, value: false, scope: "cluster" },
];

import { callDemoOp } from "./ops";
import { demoShouldFail, extendDemoHook, installDemoHook, recordDemoCall } from "./ops/demo-hook";
import { demoGroupList, effectiveGroupId, setDemoSessionRows } from "./demo-groups";
export function createDemoSource(): DataSource {
  installDemoHook();
  const byId = new Map(sessions.map((s) => [s.sessionId, { ...s }]));
  const events = new Map<string, SessionEvent[]>();
  for (const [id, list] of Object.entries(timelines)) {
    events.set(id, list.map((e, i) => ({ seq: i + 1, sessionId: id, eventType: e.eventType, data: e.data, createdAt: new Date(e.at).toISOString() })));
  }
  const files = new Map(Object.entries(artifacts).map(([id, list]) => [id, list.map((a) => ({ ...a }))]));
  const listeners = new Map<string, Set<(e: SessionEvent) => void>>();
  published.clear();
  serverEdits.clear();
  extendDemoHook("sessions", {
    /** Someone else renames a session: the next read of the list shows the new title. */
    setTitle(id: string, title: string) { serverEdits.set(id, { ...serverEdits.get(id), title }); },
    /** Report how full the context window is, as the SDK does: currentTokens / tokenLimit. */
    setContextUtilization(id: string, utilization: number) { serverEdits.set(id, { ...serverEdits.get(id), contextUsage: { utilization, tokenLimit: 200000, currentTokens: Math.round(utilization * 200000) } }); },
  });
  extendDemoHook("artifacts", {
    /** Publish a document into a session as its newest output. `size` overrides the metadata (null: unknown). */
    publishArtifact(sessionId: string, doc: { filename: string; content: string; size?: number | null }) {
      const list = (published.get(sessionId) || []).filter((f) => f.filename !== doc.filename);
      const size = doc.size === null ? undefined : doc.size ?? new TextEncoder().encode(doc.content).length;
      list.push({ filename: doc.filename, contentType: "text/html", updatedAt: Date.now() + 60_000, content: doc.content, ...(size === undefined ? {} : { size }) });
      published.set(sessionId, list);
    },
  });
  // Documents published by a test sit over the fixtures, whichever copy of this source the app kept.
  const filesOf = (id: string) => {
    const extra = published.get(id) || [];
    return [...(files.get(id) || []).filter((f) => !extra.some((e) => e.filename === f.filename)), ...extra];
  };

  const push = (id: string, eventType: string, data: Record<string, any>) => {
    const list = events.get(id) || [];
    const event: SessionEvent = { seq: (list.at(-1)?.seq || 0) + 1, sessionId: id, eventType, data, createdAt: new Date().toISOString() };
    list.push(event);
    events.set(id, list);
    const s = byId.get(id);
    if (s) s.updatedAt = Date.now();
    for (const l of listeners.get(id) || []) l(event);
  };
  const reply = (id: string, text: string, delay = 1100) => {
    const s = byId.get(id);
    if (s) s.status = "running";
    window.setTimeout(() => {
      push(id, "assistant.message", { content: text });
      const cur = byId.get(id);
      if (cur && cur.status === "running") cur.status = "idle";
    }, delay);
  };
  setDemoSessionRows(() => [...byId.values()]);
  const wait = <T,>(value: T, ms = 120) => new Promise<T>((r) => window.setTimeout(() => r(value), ms));

  return {
    kind: "demo",
    label: "Demo data",
    listSessions: () => wait([...byId.values()].filter((s) => s.status !== "deleted").map((s) => ({ ...s, groupId: effectiveGroupId(s), ...serverEdits.get(s.sessionId) }))),
    getSession: (id) => wait(byId.get(id) ? { ...byId.get(id)!, groupId: effectiveGroupId(byId.get(id)!), ...serverEdits.get(id) } : null),
    getEvents: (id) => wait([...(events.get(id) || [])], 160),
    subscribe(id, onEvent) {
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id)!.add(onEvent);
      return () => listeners.get(id)?.delete(onEvent);
    },
    async sendMessage(id, prompt, opts) {
      push(id, "user.message", { content: prompt, ...(opts?.enqueueOnly ? { enqueued: true } : {}) });
      reply(id, "This is demo data, so no agent is running. In a live deployment the agent would pick this up now and stream its reply here.");
    },
    async sendAnswer(id, answer, question) {
      const s = byId.get(id);
      // Mimic a strictly bound answer: a question that is no longer the open one is refused, as live does.
      if (question && (s?.pendingQuestion?.question !== question.question || (question.iteration !== undefined && s?.pendingQuestion?.iteration !== undefined && s.pendingQuestion.iteration !== question.iteration))) {
        push(id, "session.answer_rejected", { reason: "stale-question", expectedQuestion: { question: question.question, iteration: question.iteration }, currentQuestion: s?.pendingQuestion ? { question: s.pendingQuestion.question, iteration: s.pendingQuestion.iteration } : null });
        return;
      }
      if (s) { s.pendingQuestion = null; s.status = "running"; s.step = "Acting on your answer"; }
      push(id, "user.message", { content: answer });
      reply(id, `Understood: “${answer}”. (Demo data: in a live deployment the agent would carry this out now.)`, 1400);
    },
    async stopTurn(id) {
      const s = byId.get(id);
      if (s) s.status = "idle";
      push(id, "user.stop", { reason: "Stopped from Flight Deck" });
      return "stopped";
    },
    async steerTurn(id, text) {
      push(id, "user.steer", { text });
      return "accepted";
    },
    async createSession(input) {
      const id = (crypto.randomUUID?.() || `demo-${Date.now()}`) as string;
      const agent = input.agentName || "pilotswarm";
      byId.set(id, {
        sessionId: id, owner: "me", canWrite: true, title: input.prompt.trim() ? input.prompt.trim().split(/\s+/).slice(0, 6).join(" ") : "New session", agentId: agent,
        status: input.prompt.trim() ? "running" : "idle", createdAt: Date.now(), updatedAt: Date.now(),
        model: input.model || "anthropic-wif:claude-sonnet-5", visibility: "private", iterations: 0, step: "Reading your request", spine: ["run"],
      });
      events.set(id, []);
      if (input.prompt.trim()) {
        window.setTimeout(() => {
          push(id, "user.message", { content: input.prompt.trim() });
          reply(id, "This is demo data, so no agent is running. In a live deployment the agent would start on your task here.", 900);
        }, 50);
      }
      return wait(id, 250);
    },
    async renameSession(id, title) { recordDemoCall("renameSession", { id, title }); if (demoShouldFail("renameSession")) throw new Error("The server refused that."); const s = byId.get(id); if (s) s.title = title; const e = serverEdits.get(id); if (e) delete e.title; },
    async setSessionModel(id, model) { const s = byId.get(id); if (s) { s.model = model; if (s.status === "failed") s.error = undefined; } },
    async completeSession(id) { recordDemoCall("completeSession", { id }); if (demoShouldFail("completeSession")) throw new Error("The server refused that."); const s = byId.get(id); if (s) { s.status = "completed"; s.pendingQuestion = null; } },
    async cancelSession(id) { recordDemoCall("cancelSession", { id }); if (demoShouldFail("cancelSession")) throw new Error("The server refused that."); const s = byId.get(id); if (s) { s.status = "cancelled"; s.pendingQuestion = null; } },
    async deleteSession(id) { recordDemoCall("deleteSession", { id }); if (demoShouldFail("deleteSession")) throw new Error("The server refused that."); byId.delete(id); for (const s of byId.values()) if (s.parentSessionId === id) byId.delete(s.sessionId); },
    listArtifacts: (id) => wait(filesOf(id).map(({ content: _c, ...a }) => ({ ...a, sessionId: id }))),
    readArtifact: (id, filename) => (recordDemoCall("readArtifact", { id, filename }), wait(filesOf(id).find((f) => f.filename === filename)?.content || "", 140)),
    readArtifactPreview: async (id, filename, maxBytes) => {
      recordDemoCall("readArtifactPreview", { id, filename, maxBytes });
      const content = filesOf(id).find((f) => f.filename === filename)?.content || "";
      const bytes = new TextEncoder().encode(content);
      return wait({ text: bytes.length > maxBytes ? new TextDecoder().decode(bytes.subarray(0, maxBytes)) : content, truncated: bytes.length > maxBytes }, 140);
    },
    artifactUrl: () => null,
    listModels: () => wait(models),
    listAgents: () => wait([...agents.filter((a) => a.source !== "package"), ...demoPackageAgents().map((a) => ({ ...agents.find((prior) => prior.name === a.name), ...a }))]),
    listProviders: () => wait(providers),
    usageSummary: () => wait(usage),
    listWorkers: () => wait(workers),
    listFlags: () => (demoShouldFail("listFlags") ? Promise.reject(new Error("Feature flags are unavailable")) : wait(flags)),
    listGroups: () => wait(demoGroupList.map((g) => ({ id: g.groupId, name: g.title }))),
    profile: () => wait({ displayName: "Sam Lee", email: "sam.lee@contoso.com", isAdmin: true, provider: "entra" }),
    authzAudit: () =>
      wait([
        { at: new Date(m(3)).toISOString(), actor: "Riya Kapoor", action: "session.read", sessionId: RELEASE, admin: false },
        { at: new Date(m(18)).toISOString(), actor: "Sam Lee (admin)", action: "session.read", sessionId: RESEARCH, admin: true },
        { at: new Date(m(64)).toISOString(), actor: "Mo Said", action: "feature.set sessions.steering=true", admin: true },
      ]),
    fleetStats: () => wait({ sessions: 96, running: 4, waiting: 5, failed: 1, tokensToday: 4_200_000, noisiest: [{ title: "Run test campaign", events: 1840 }, { title: "Port canvas host to TSX", events: 1320 }] }),
    orchestrationStats: () => wait({ executions: 9, historyEvents: 412, replays: 3, lastReplayMs: 41, kvKeys: 12 }),
    executionHistory: (id) => wait((events.get(id) || []).map((e) => ({ seq: e.seq, kind: e.eventType, at: e.createdAt }))),
    subscribeLogs(onEntry: (e: LogEntry) => void) {
      const lines = ["turn started", "activity runTurnV4 scheduled", "canvas write rev 7", "child digest received", "turn completed in 41s"];
      let i = 0;
      const t = window.setInterval(() => onEntry({ at: new Date().toISOString(), level: i % 7 === 6 ? "warn" : "info", workerNodeId: `chk-w${(i % 4) + 1}`, message: lines[i++ % lines.length] }), 1600);
      return () => window.clearInterval(t);
    },
    call: ((op: string, params?: Record<string, unknown>) => callDemoOp(op, params)) as DataSource["call"],
    connection(onChange: (s: ConnectionState) => void) {
      onChange("connected");
      return () => {};
    },
  };
}
