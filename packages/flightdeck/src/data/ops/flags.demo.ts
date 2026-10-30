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
const changes: any[] = [
  { audit_id: "3", occurred_at: new Date(Date.now() - 3 * 3600_000).toISOString(), actor_subject: "Sam Lee", action: "feature_flag.set", target: "feature:sessions.steering", details: { featureKey: "sessions.steering", scope: "cluster", enabled: true, allowUserOverride: false } },
  { audit_id: "2", occurred_at: new Date(Date.now() - 26 * 3600_000).toISOString(), actor_subject: "Priya Nair", action: "feature_flag.set", target: "feature:copilot.native_tasks", details: { featureKey: "copilot.native_tasks", scope: "cluster", enabled: true, allowUserOverride: true } },
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

const record = (action: string, featureKey: string, details: Record<string, unknown>, actor = "Sam Lee") => {
  audit += 1;
  changes.unshift({ audit_id: String(audit), occurred_at: new Date().toISOString(), actor_subject: actor, action, target: `feature:${featureKey}`, details: { featureKey, ...details } });
};

registerDemoOps({
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
    const revision = next(featureKey);
    const setting = { enabled: Boolean(enabled), allowUserOverride: Boolean(allowUserOverride), revision };
    cluster.set(featureKey, setting);
    record("feature_flag.set", featureKey, { scope: "cluster", enabled: setting.enabled, allowUserOverride: setting.allowUserOverride });
    return { featureKey, scope: "cluster", userId: null, revision, setting };
  },
  resetClusterFeatureFlag: ({ featureKey, expectedRevision }) => {
    if (expectedRevision !== current(featureKey)) throw conflict();
    const revision = next(featureKey);
    cluster.delete(featureKey);
    record("feature_flag.unset", featureKey, { scope: "cluster" });
    return { featureKey, scope: "cluster", userId: null, revision, setting: null };
  },
  setMyFeatureFlag: ({ featureKey, enabled, expectedRevision }) => setPersonal(1, featureKey, enabled, expectedRevision),
  unsetMyFeatureFlag: ({ featureKey, expectedRevision }) => unsetPersonal(1, featureKey, expectedRevision),
  setUserFeatureFlag: ({ userId, featureKey, enabled, expectedRevision }) => setPersonal(Number(userId), featureKey, enabled, expectedRevision),
  unsetUserFeatureFlag: ({ userId, featureKey, expectedRevision }) => unsetPersonal(Number(userId), featureKey, expectedRevision),
});

function setPersonal(userId: number, featureKey: string, enabled: unknown, expectedRevision: unknown) {
  if (expectedRevision !== current(featureKey)) throw conflict();
  const revision = next(featureKey);
  const setting = { enabled: Boolean(enabled), revision };
  personal.set(`${userId}:${featureKey}`, setting);
  record("feature_flag.set", featureKey, { scope: "user", enabled: setting.enabled });
  return { featureKey, scope: "user", userId, revision, setting: { ...setting, allowUserOverride: null } };
}
function unsetPersonal(userId: number, featureKey: string, expectedRevision: unknown) {
  if (expectedRevision !== current(featureKey)) throw conflict();
  const revision = next(featureKey);
  personal.delete(`${userId}:${featureKey}`);
  record("feature_flag.unset", featureKey, { scope: "user" });
  return { featureKey, scope: "user", userId, revision, setting: null };
}
