import { registerDemoOps } from "./registry";

// Demo feature flags: the four real flags, one cluster policy per flag, a few people, and an audit trail
// that grows as you change things, so every flow in Admin and Settings can be tried without a server.

interface Def { featureKey: string; displayName: string; description: string; defaultEnabled: boolean; defaultAllowUserOverride: boolean }
const defs: Def[] = [
  { featureKey: "copilot.native_tasks", displayName: "Native Copilot tasks", description: "Allow Copilot to delegate local work to native tasks on the same worker.", defaultEnabled: false, defaultAllowUserOverride: true },
  { featureKey: "agents.base_v2", displayName: "Base Agent V2", description: "Use the discovery-first base instructions with native tasks. Requires Native Copilot tasks; package tools remain available in either mode.", defaultEnabled: false, defaultAllowUserOverride: true },
  { featureKey: "sessions.steering", displayName: "Steer running turns", description: "Let people add guidance to a running turn that the model receives at its next model call. Stop does not depend on this flag.", defaultEnabled: false, defaultAllowUserOverride: false },
  { featureKey: "debug.enable_model_event_logging", displayName: "Model event logging", description: "Record the Copilot CLI's model trace events in the session event log. They repeat the whole prompt, so logs grow quickly.", defaultEnabled: false, defaultAllowUserOverride: true },
];
const revisions = new Map<string, number>(defs.map((d) => [d.featureKey, 1]));
const cluster = new Map<string, { enabled: boolean; allowUserOverride: boolean; revision: string }>([
  ["copilot.native_tasks", { enabled: true, allowUserOverride: true, revision: "2" }],
  ["sessions.steering", { enabled: true, allowUserOverride: false, revision: "2" }],
]);
for (const [k] of cluster) revisions.set(k, 2);
const users: Array<{ userId: number; displayName: string; email: string; subject: string; provider: string }> = [
  { userId: 1, displayName: "Sam Lee", email: "sam@example.test", subject: "sam", provider: "demo" },
  { userId: 2, displayName: "Priya Nair", email: "priya@example.test", subject: "priya", provider: "demo" },
  { userId: 3, displayName: "Jordan Cho", email: "jordan@example.test", subject: "jordan", provider: "demo" },
];
const personal = new Map<string, { enabled: boolean; revision: string }>([["1:debug.enable_model_event_logging", { enabled: true, revision: "2" }]]);
for (const k of personal.keys()) revisions.set(k, 2);
/**
 * The setting snapshot the server writes into the audit row: cms_feature_setting_json
 * (migrations/feature-flags-0077.ts), field for field.
 */
const settingJson = (featureKey: string, scope: "cluster" | "user", userId: number | null, s: { enabled: boolean; allowUserOverride?: boolean | null; revision: string }, by = "demo:sam", settingId = "1") => ({
  settingId, featureKey, scope, userId, enabled: s.enabled, allowUserOverride: s.allowUserOverride ?? null, revision: s.revision, updatedBy: by, updatedAt: new Date().toISOString(),
});
/** The audit row as cms_feature_changes returns it: identity and time at the top, the write in details. */
const auditRow = (id: string, action: string, featureKey: string, actorSubject: string, at: string, d: { scope: "cluster" | "user"; userId: number | null; before: any; after: any; revision: string }) => ({
  audit_id: id, occurred_at: at, actor_provider: "demo", actor_subject: actorSubject, action, target: featureKey, decision: "allow",
  details: { actorKey: `demo:${actorSubject}`, requestId: `req-${id}`, requestHash: `hash-${id}`, scope: d.scope, userId: d.userId, featureKey, before: d.before, after: d.after, revision: d.revision, result: { featureKey, scope: d.scope, userId: d.userId, revision: d.revision, setting: d.after } },
});
const changes: any[] = [
  auditRow("3", "feature_flag.set", "sessions.steering", "Sam Lee", new Date(Date.now() - 3 * 3600_000).toISOString(), { scope: "cluster", userId: null, before: null, after: settingJson("sessions.steering", "cluster", null, { enabled: true, allowUserOverride: false, revision: "2" }), revision: "2" }),
  auditRow("2", "feature_flag.set", "copilot.native_tasks", "Priya Nair", new Date(Date.now() - 26 * 3600_000).toISOString(), { scope: "cluster", userId: null, before: null, after: settingJson("copilot.native_tasks", "cluster", null, { enabled: true, allowUserOverride: true, revision: "2" }, "demo:priya", "2"), revision: "2" }),
];
let audit = 3;

const conflict = () => Object.assign(new Error("The setting changed since you opened it."), { status: 409, code: "FEATURE_CONFLICT" });
const next = (key: string) => { const n = (revisions.get(key) || 1) + 1; revisions.set(key, n); return String(n); };
const current = (key: string) => String(revisions.get(key) || 1);

function view(userId: number | null, forUser: boolean) {
  const decided = defs.map((d) => {
    const c = cluster.get(d.featureKey) || null;
    const u = forUser ? personal.get(`${userId}:${d.featureKey}`) || null : null;
    const allow = c?.allowUserOverride ?? d.defaultAllowUserOverride;
    const configured = allow && u ? u.enabled : c?.enabled ?? d.defaultEnabled;
    return { d, c, u, allow, configured };
  });
  const nativeOn = decided.find((x) => x.d.featureKey === "copilot.native_tasks")?.configured === true;
  return {
    userId,
    flags: decided.map(({ d, c, u, allow, configured }) => {
      const blocked = d.featureKey === "agents.base_v2" && configured && !nativeOn;
      return {
        ...d,
        revision: current(d.featureKey),
        cluster: c ? { enabled: c.enabled, allowUserOverride: c.allowUserOverride, revision: c.revision } : null,
        user: u ? { enabled: u.enabled, allowUserOverride: null, revision: u.revision } : null,
        effective: configured && !blocked,
        source: allow && u ? "user" : c ? "cluster" : "default",
        userOverrideIgnored: Boolean(u && !allow),
        supported: true,
        ...(blocked ? { reason: "requires_native_tasks" } : {}),
      };
    }),
  };
}

const record = (action: string, featureKey: string, d: { scope: "cluster" | "user"; userId: number | null; before: any; after: any; revision: string }, actor = "Sam Lee") => {
  audit += 1;
  changes.unshift(auditRow(String(audit), action, featureKey, actor, new Date().toISOString(), d));
};

registerDemoOps(import.meta.url, {
  listFeatureFlags: () => view(null, false),
  getClusterFeatureFlags: () => view(null, false),
  getMyFeatureFlags: () => view(1, true),
  getUserFeatureFlags: ({ userId }) => view(Number(userId), true),
  listFeatureFlagUsers: ({ query }) => {
    const q = String(query || "").toLowerCase();
    return users.filter((u) => !q || `${u.displayName} ${u.email}`.toLowerCase().includes(q));
  },
  listFeatureFlagChanges: ({ limit }) => changes.slice(0, Number(limit) || 50),
  setClusterFeatureFlag: ({ featureKey, enabled, allowUserOverride, expectedRevision }) => {
    if (expectedRevision !== current(featureKey)) throw conflict();
    const before = cluster.get(featureKey) || null;
    const revision = next(featureKey);
    const setting = { enabled: Boolean(enabled), allowUserOverride: Boolean(allowUserOverride), revision };
    cluster.set(featureKey, setting);
    record("feature_flag.set", featureKey, { scope: "cluster", userId: null, before: before && settingJson(featureKey, "cluster", null, before), after: settingJson(featureKey, "cluster", null, setting), revision });
    return { featureKey, scope: "cluster", userId: null, revision, setting };
  },
  resetClusterFeatureFlag: ({ featureKey, expectedRevision }) => {
    if (expectedRevision !== current(featureKey)) throw conflict();
    const before = cluster.get(featureKey) || null;
    const revision = next(featureKey);
    cluster.delete(featureKey);
    record("feature_flag.unset", featureKey, { scope: "cluster", userId: null, before: before && settingJson(featureKey, "cluster", null, before), after: null, revision });
    return { featureKey, scope: "cluster", userId: null, revision, setting: null };
  },
  setMyFeatureFlag: ({ featureKey, enabled, expectedRevision }) => setPersonal(1, featureKey, enabled, expectedRevision),
  unsetMyFeatureFlag: ({ featureKey, expectedRevision }) => unsetPersonal(1, featureKey, expectedRevision),
  setUserFeatureFlag: ({ userId, featureKey, enabled, expectedRevision }) => setPersonal(Number(userId), featureKey, enabled, expectedRevision),
  unsetUserFeatureFlag: ({ userId, featureKey, expectedRevision }) => unsetPersonal(Number(userId), featureKey, expectedRevision),
});

function setPersonal(userId: number, featureKey: string, enabled: unknown, expectedRevision: unknown) {
  if (expectedRevision !== current(featureKey)) throw conflict();
  const before = personal.get(`${userId}:${featureKey}`) || null;
  const revision = next(featureKey);
  const setting = { enabled: Boolean(enabled), revision };
  personal.set(`${userId}:${featureKey}`, setting);
  record("feature_flag.set", featureKey, { scope: "user", userId, before: before && settingJson(featureKey, "user", userId, before), after: settingJson(featureKey, "user", userId, setting), revision });
  return { featureKey, scope: "user", userId, revision, setting: { ...setting, allowUserOverride: null } };
}
function unsetPersonal(userId: number, featureKey: string, expectedRevision: unknown) {
  if (expectedRevision !== current(featureKey)) throw conflict();
  const before = personal.get(`${userId}:${featureKey}`) || null;
  const revision = next(featureKey);
  personal.delete(`${userId}:${featureKey}`);
  record("feature_flag.unset", featureKey, { scope: "user", userId, before: before && settingJson(featureKey, "user", userId, before), after: null, revision });
  return { featureKey, scope: "user", userId, revision, setting: null };
}
