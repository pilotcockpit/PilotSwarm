import { ApiClient } from "pilotswarm-sdk/api";
import type { Artifact, ConnectionState, DataSource, LogEntry, Session, SessionEvent } from "./types";

// The live data source: the SDK's ApiClient over the same-origin /api/v1 Web
// API and its WebSocket, which the dev server proxies to the classic portal's
// server. No second backend, no copied protocol.

function list<T>(value: unknown, key?: string): T[] {
  if (Array.isArray(value)) return value as T[];
  if (key && value && typeof value === "object" && Array.isArray((value as any)[key])) return (value as any)[key] as T[];
  return [];
}

/** The API's owner is an object; the screens compare against "me" and show a name. */
function ownerLabel(owner: any, me: { subject?: string; email?: string } | null): string | undefined {
  if (!owner) return undefined;
  if (typeof owner === "string") return owner;
  if (me && ((owner.subject && owner.subject === me.subject) || (owner.email && owner.email === me.email))) return "me";
  return owner.displayName || owner.email || owner.subject || undefined;
}

const isoOrNumber = (v: unknown) => (v instanceof Date ? v.getTime() : v);

/**
 * listProviders returns bare provider rows. Usage and limits live in getProviderUsageGrid: one row
 * per provider (scope "*") and one per model that has its own limit, each with day, week and month
 * cells. Join them so screens can read `usage.month` (the provider's tightest monthly limit, model-
 * scoped ones included, with which model) and `limits` (every capped period, with its model).
 */
function withUsage(provider: any, gridRows: any[]) {
  const rows = gridRows.filter((r) => r.providerName === provider.name);
  if (!rows.length) return provider;
  const limits: Array<{ period: "day" | "week" | "month"; tokens: number; model: string | null }> = [];
  let month: { used: number; limit: number | null; model: string | null } | null = null;
  let worst = -1;
  for (const r of rows) {
    const model = r.rowKind === "model" ? String(r.scope) : null;
    for (const period of ["day", "week", "month"] as const) {
      const c = r.periods?.[period];
      if (!c || c.quotaTokens == null) continue;
      limits.push({ period, tokens: c.quotaTokens, model });
      if (period === "month") {
        const ratio = c.quotaTokens ? c.usedTokens / c.quotaTokens : 0;
        if (ratio > worst) { worst = ratio; month = { used: c.usedTokens, limit: c.quotaTokens, model }; }
      }
    }
  }
  // No monthly limit anywhere: still report what was spent on the provider as a whole.
  if (!month) {
    const c = rows.find((r) => r.rowKind === "provider")?.periods?.month;
    if (c) month = { used: c.usedTokens, limit: null, model: null };
  }
  return { ...provider, ...(limits.length ? { limits } : {}), ...(month ? { usage: { month } } : {}) };
}

/** Counts of live children per parent, so a row can say "2 sub-agents" without a per-session read. */
function withChildCounts(rows: Session[]): Session[] {
  const live = new Map<string, number>();
  for (const s of rows) {
    if (s.parentSessionId && !["completed", "cancelled", "terminated", "failed", "error"].includes(String(s.status))) {
      live.set(s.parentSessionId, (live.get(s.parentSessionId) || 0) + 1);
    }
  }
  return rows.map((s) => (s.activeChildCount == null && live.has(s.sessionId) ? { ...s, activeChildCount: live.get(s.sessionId) } : s));
}

function requestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function createLiveSource(): DataSource {
  const api = new ApiClient({ apiUrl: window.location.origin });
  const connectionListeners = new Set<(s: ConnectionState) => void>();
  let connection: ConnectionState = "reconnecting";
  const setConnection = (next: ConnectionState) => {
    if (next === connection) return;
    connection = next;
    for (const l of connectionListeners) l(next);
  };
  // Health drives the rail's connection status. The socket reconnects on its
  // own; this only reports what the user can rely on.
  const probe = async () => {
    try {
      await api.health();
      setConnection("connected");
    } catch {
      setConnection(navigator.onLine ? "reconnecting" : "offline");
    }
  };
  void probe();
  window.setInterval(probe, 10_000);
  window.addEventListener("offline", () => setConnection("offline"));
  window.addEventListener("online", () => void probe());
  // Who "me" is, once: owner objects are compared against it.
  let mePromise: Promise<{ subject?: string; email?: string } | null> | null = null;
  const getMe = () =>
    (mePromise ||= api
      .getAuthContext()
      .then((auth: any) => ({ subject: auth?.principal?.subject, email: auth?.principal?.email }))
      .catch(() => null));
  const normalizeSession = (s: any, me: { subject?: string; email?: string } | null): Session => ({ ...s, owner: ownerLabel(s?.owner, me) });
  let started = false;
  const ensureStarted = () => {
    if (started) return;
    started = true;
    api.start().catch(() => setConnection("reconnecting"));
  };

  const source: DataSource = {
    kind: "live",
    label: window.location.host,
    async listSessions() {
      const [rows, me] = await Promise.all([api.call("listSessions"), getMe()]);
      return withChildCounts(list<any>(rows).map((s) => normalizeSession(s, me)));
    },
    async getSession(id) {
      const [s, me] = await Promise.all([api.call("getSession", { sessionId: id }), getMe()]);
      return s ? normalizeSession(s, me) : null;
    },
    async getEvents(id) {
      // The newest 400 events, oldest first: enough for the transcript and
      // the timeline; older history pages in on demand in the classic portal.
      return list<SessionEvent>(await api.call("getSessionEventsBefore", { sessionId: id, beforeSeq: Number.MAX_SAFE_INTEGER, limit: 400 }));
    },
    subscribe(id, onEvent) {
      ensureStarted();
      return api.subscribeSession(id, (message: any) => {
        const event = message?.event || message;
        if (event?.eventType) onEvent(event as SessionEvent);
      });
    },
    async sendMessage(id, prompt, opts) {
      await api.call("sendMessage", { sessionId: id, prompt, options: { clientMessageIds: [requestId()], ...(opts?.enqueueOnly ? { enqueueOnly: true } : {}) } });
    },
    async sendAnswer(id, answer, question) {
      await api.call("sendAnswer", { sessionId: id, answer, options: question ? { expectedQuestion: question } : {} });
    },
    async stopTurn(id) {
      const r = await api.call("stopSessionTurn", { sessionId: id, options: { reason: "Stopped from Flight Deck", requestId: requestId() } });
      return String(r?.outcome || "stopped");
    },
    async steerTurn(id, text) {
      const r = await api.call("steerSessionTurn", { sessionId: id, options: { text, requestId: requestId() } });
      return String(r?.outcome || "accepted");
    },
    async createSession(input) {
      const common = {
        ...(input.model ? { model: input.model } : {}),
        ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}),
        ...(input.groupId ? { groupId: input.groupId } : {}),
        ...(input.workspace ? { workspace: input.workspace } : {}),
      };
      const created = input.agentName
        ? await api.call("createSessionForAgent", { agentName: input.agentName, ...common })
        : await api.call("createSession", common);
      const id = String(created?.sessionId || "");
      if (!id) throw new Error("The server did not return a session id.");
      if (input.prompt.trim()) await source.sendMessage(id, input.prompt.trim());
      return id;
    },
    async setSessionModel(id, model) {
      await api.call("setSessionModel", { sessionId: id, options: { model } });
    },
    async renameSession(id, title) {
      await api.call("renameSession", { sessionId: id, title });
    },
    async completeSession(id) {
      await api.call("completeSession", { sessionId: id, reason: "Completed from Flight Deck" });
    },
    async cancelSession(id) {
      await api.call("cancelSession", { sessionId: id });
    },
    async deleteSession(id) {
      await api.call("deleteSession", { sessionId: id });
    },
    async listArtifacts(id) {
      // The API reports sizeBytes and uploadedAt; the screens read size and updatedAt.
      return list<Artifact>(await api.call("listArtifacts", { sessionId: id }), "artifacts").map((a: any) =>
        typeof a === "string" ? { filename: a } : { ...a, size: a.size ?? a.sizeBytes, updatedAt: a.updatedAt ?? isoOrNumber(a.uploadedAt) },
      );
    },
    async readArtifact(id, filename) {
      const r = await api.call("downloadArtifact", { sessionId: id, filename });
      return typeof r === "string" ? r : String(r?.content ?? r?.text ?? "");
    },
    artifactUrl(id, filename) {
      return `/api/v1/sessions/${encodeURIComponent(id)}/artifacts/${encodeURIComponent(filename)}/download`;
    },
    async listModels() {
      return list(await api.call("listModels"));
    },
    async listAgents() {
      // Package agents name their package in packageTitle / packageName; the library groups by `package`.
      return list<any>(await api.call("listCreatableAgents")).map((a) => (a.package ? a : { ...a, package: a.packageTitle || a.packageName || undefined }));
    },
    async listProviders() {
      const [providers, grid] = await Promise.all([api.call("listProviders"), api.call("getProviderUsageGrid").catch(() => null)]);
      const rows = list<any>(grid, "rows");
      return list<any>(providers, "providers").map((p) => withUsage(p, rows));
    },
    async usageSummary() {
      return (await api.call("getProviderUsageSummary").catch(() => null)) || null;
    },
    async listWorkers() {
      return list(await api.call("listWorkers"));
    },
    async listFlags() {
      const [catalog, cluster] = await Promise.all([
        api.call("listFeatureFlags").catch(() => []),
        api.call("getClusterFeatureFlags").catch(() => ({})),
      ]);
      const values = (cluster && typeof cluster === "object" ? (cluster.flags || cluster.values || cluster) : {}) as Record<string, unknown>;
      return list<any>(catalog, "flags").map((f) => ({ ...f, key: f.key || f.name, value: values[f.key || f.name] ?? f.value }));
    },
    async listGroups() {
      return list(await api.call("listSessionGroups").catch(() => []));
    },
    async profile() {
      const [profile, auth] = await Promise.all([
        api.call("getCurrentUserProfile").catch(() => ({})),
        api.getAuthContext().catch(() => null),
      ]);
      const principal = (auth as any)?.principal || {};
      const authz = (auth as any)?.authorization || {};
      // With authentication disabled the server admits everyone with full
      // access, so the operator sees the admin areas, as in the classic portal.
      const isAdmin = authz.role === "admin" || /disabled/i.test(String(authz.reason || "")) || (principal.roles || []).includes("admin");
      return {
        ...(profile || {}),
        // With authentication off the server reports a placeholder name; show none rather than "Unknown".
        displayName: [profile?.displayName, principal.displayName].find((n) => n && n !== "Unknown User") || "Local operator",
        anonymous: ![profile?.displayName, principal.displayName].some((n) => n && n !== "Unknown User"),
        email: profile?.email || principal.email || null,
        isAdmin,
      };
    },
    async authzAudit() {
      // API: occurredAt, actorDisplay, action, decision, reason. Admin access is the break-glass kind.
      return list<any>(await api.call("listAuthzAudit", { limit: 100 }).catch(() => []), "records").map((r) => ({
        ...r,
        actor: r.actor ?? r.actorDisplay ?? r.actorSubject,
        at: r.at ?? isoOrNumber(r.occurredAt),
        admin: r.admin ?? /admin|break.?glass/i.test(`${r.action} ${r.decision} ${r.reason ?? ""}`),
      }));
    },
    async fleetStats() {
      // Flatten totals into figures the cluster panel can show; keep byAgent and the window as objects.
      const f = await api.call("getFleetStats").catch(() => null);
      if (!f) return null;
      const t = f.totals || {};
      return {
        sessionCount: t.sessionCount,
        tokensIn: t.totalTokensInput,
        tokensOut: t.totalTokensOutput,
        tokensCacheRead: t.totalTokensCacheRead,
        cacheHitPct: t.cacheHitRatio == null ? undefined : Math.round(t.cacheHitRatio * 100),
        // byAgent is grouped by agent AND model; count the agents.
        agents: Array.isArray(f.byAgent) ? new Set(f.byAgent.map((a: any) => a.agentId ?? "(none)")).size : undefined,
        window: { since: f.windowStart, earliest: f.earliestSessionCreatedAt },
        byAgent: f.byAgent,
      };
    },
    async orchestrationStats(id) {
      return api.call("getOrchestrationStats", { sessionId: id }).catch(() => null);
    },
    async executionHistory(id) {
      return list(await api.call("getExecutionHistory", { sessionId: id }).catch(() => []), "events");
    },
    subscribeLogs(onEntry) {
      ensureStarted();
      return api.subscribeLogs((entry: unknown) => onEntry(entry as LogEntry));
    },
    connection(onChange) {
      connectionListeners.add(onChange);
      onChange(connection);
      return () => connectionListeners.delete(onChange);
    },
  };
  return source;
}
