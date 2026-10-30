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
      return list<Session>(await api.call("listSessions"));
    },
    async getSession(id) {
      return (await api.call("getSession", { sessionId: id })) as Session | null;
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
      return list<Artifact>(await api.call("listArtifacts", { sessionId: id }), "artifacts").map((a: any) =>
        typeof a === "string" ? { filename: a } : a,
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
      return list(await api.call("listCreatableAgents"));
    },
    async listProviders() {
      return list(await api.call("listProviders"), "providers");
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
      return list(await api.call("listAuthzAudit", { limit: 100 }).catch(() => []), "records");
    },
    async fleetStats() {
      return api.call("getFleetStats").catch(() => null);
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
