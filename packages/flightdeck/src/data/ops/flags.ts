import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSource } from "@/data/source";
import { useOpQuery, useOpRequest, type OpRequest } from "./use-op";
import type { Worker } from "@/data/types";
import { describeFlagChange, type FlagChangeView } from "./contracts";
export { changeSentence } from "./contracts";

// Feature flags have three layers: the code-defined default, the cluster policy an admin sets
// (on/off, and whether people may choose for themselves), and each person's own choice. The API
// answers one view per layer; every write carries the revision it was based on, so two people
// editing the same flag cannot silently overwrite each other.

export interface FlagSetting { enabled: boolean; allowUserOverride: boolean | null; revision: string; updatedAt?: string }
export interface FlagView {
  featureKey: string;
  displayName: string;
  description: string;
  defaultEnabled: boolean;
  defaultAllowUserOverride: boolean;
  revision: string;
  cluster: FlagSetting | null;
  user: FlagSetting | null;
  /** The value that actually applies, after cluster policy and personal choice. */
  effective: boolean;
  source?: "cluster" | "user" | "default" | "fallback" | string;
  reason?: string;
  userOverrideIgnored?: boolean;
  supported: boolean;
}
export interface FlagsData { userId: number | null; flags: FlagView[] }
export interface FlagUser { userId: number; displayName: string | null; email: string | null; subject?: string; provider?: string }
export type FlagChange = FlagChangeView;

export type Policy = { enabled: boolean; allowUserOverride: boolean };
export const clusterPolicy = (f: FlagView): Policy => ({ enabled: f.cluster?.enabled ?? f.defaultEnabled, allowUserOverride: f.cluster?.allowUserOverride ?? f.defaultAllowUserOverride });
export const defaultPolicy = (f: FlagView): Policy => ({ enabled: f.defaultEnabled, allowUserOverride: f.defaultAllowUserOverride });
export const samePolicy = (a: Policy, b: Policy) => a.enabled === b.enabled && a.allowUserOverride === b.allowUserOverride;

/** "On for everyone", "Off by default; people can turn it on for themselves". */
export function policySentence(p: Policy) {
  const state = p.enabled ? "On" : "Off";
  return p.allowUserOverride ? `${state} by default; people can turn it ${p.enabled ? "off" : "on"} for themselves` : `${state} for everyone`;
}

const GROUP_LABEL: Record<string, string> = { copilot: "Copilot", agents: "Agents", sessions: "Sessions", debug: "Diagnostics", canvas: "Canvas", facts: "Knowledge" };
export function flagGroup(key: string) {
  const head = key.split(".")[0] || "other";
  return GROUP_LABEL[head] || head.charAt(0).toUpperCase() + head.slice(1);
}
export function groupFlags(flags: FlagView[]) {
  const groups = new Map<string, FlagView[]>();
  for (const f of flags) groups.set(flagGroup(f.featureKey), [...(groups.get(flagGroup(f.featureKey)) || []), f]);
  return [...groups].map(([label, items]) => ({ label, items }));
}

const requestId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const isConflict = (e: any) => e?.status === 409 || e?.code === "FEATURE_CONFLICT" || /conflict|revision/i.test(String(e?.message || ""));

export const flagKeys = {
  cluster: ["featureFlags", "cluster"] as const,
  me: ["featureFlags", "me"] as const,
  user: (id: number | null) => ["featureFlags", "user", id] as const,
  changes: ["featureFlags", "changes"] as const,
};

export const useClusterFlags = () => useOpQuery<FlagsData>(flagKeys.cluster, "getClusterFeatureFlags", undefined, { staleTime: 5_000 });
export const useMyFlags = () => useOpQuery<FlagsData>(flagKeys.me, "getMyFeatureFlags", undefined, { staleTime: 5_000 });
export const useUserFlags = (userId: number | null) => useOpQuery<FlagsData>(flagKeys.user(userId), "getUserFeatureFlags", { userId }, { enabled: userId != null });

export function useFeatureUsers(query: string) {
  return useOpQuery<FlagUser[]>(["featureFlags", "users", query], "listFeatureFlagUsers", { query }, { select: (raw) => (Array.isArray(raw) ? raw : raw?.users || []) });
}

/** Recent changes, newest first, read from the authz audit. Rows are normalised into one sentence each. */
export const flagChangesRequest: OpRequest<FlagChange[]> = {
  key: flagKeys.changes,
  op: "listFeatureFlagChanges",
  params: { limit: 100 },
  select: (raw) => (Array.isArray(raw) ? raw : raw?.changes || []).map(describeFlagChange),
};
export function useFlagChanges(enabled = true) {
  return useOpRequest(flagChangesRequest, { enabled, staleTime: 10_000 });
}

export type FlagTarget = { kind: "cluster" } | { kind: "me" } | { kind: "user"; userId: number };
/** `target` travels with the write (and with its Undo), so a late click can never act on whoever is selected now. */
export interface Mutation { target: FlagTarget; featureKey: string; expectedRevision: string; enabled?: boolean; allowUserOverride?: boolean; /** unset/reset instead of set */ clear?: boolean }
export interface MutationResult { featureKey: string; revision: string; setting: FlagSetting | null }

/**
 * One write path for all three layers. The revision the caller read goes with the write; if someone
 * else changed the flag meanwhile the server refuses it, we refresh, and the person sees the new
 * state instead of losing their edit silently. A retry of the same write reuses its request id.
 */
export function useFlagMutation() {
  const { source } = useSource();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["featureFlags"] });
    void qc.invalidateQueries({ queryKey: ["flags"] });
  };
  return useMutation({
    mutationFn: async (m: Mutation): Promise<MutationResult> => {
      const { op, params } = flagWriteCall(m, requestId());
      return source.call(op, params);
    },
    onSuccess: refresh,
    onError: (e: any) => {
      refresh();
      if (isConflict(e)) toast.error("Someone changed this setting first", { description: "It has been refreshed. Review it and try again." });
      else toast.error("That didn't save", { description: e?.message });
    },
  });
}

// ── Worker delivery ─────────────────────────────────────────────────────────────────────────
// Workers pick up a flag change within about 20 seconds and report which revision they applied.
// Show "3 of 4 workers have it" so an admin can tell a saved setting from one that is live.

const validRevision = (v: unknown): v is string => typeof v === "string" && /^[1-9]\d{0,18}$/.test(v);

export function flagDelivery(flag: FlagView, workers: Worker[] = [], now = Date.now()) {
  let eligible = 0;
  let updated = 0;
  for (const w of workers as any[]) {
    const age = now - new Date(w.updatedAt).getTime();
    const state = w.state?.["feature-flags"];
    if (w.phase !== "ready" || !(Number.isFinite(age) && age >= -5_000 && age < 90_000)) continue;
    if (!state || state.protocolVersion !== 1 || !state.appliedRevisions || !validRevision(flag.revision)) continue;
    eligible += 1;
    const applied = state.appliedRevisions[flag.featureKey];
    if (validRevision(applied) && BigInt(applied) >= BigInt(flag.revision)) updated += 1;
  }
  return { eligible, updated };
}

/** The operation and parameters one flag write sends. Pure, so the target binding can be tested. */
export function flagWriteCall(m: Mutation, id: string): { op: string; params: Record<string, unknown> } {
  const { target } = m;
  const base = { featureKey: m.featureKey, expectedRevision: m.expectedRevision, requestId: id };
  if (target.kind === "cluster") return m.clear ? { op: "resetClusterFeatureFlag", params: base } : { op: "setClusterFeatureFlag", params: { ...base, enabled: m.enabled, allowUserOverride: m.allowUserOverride } };
  if (target.kind === "me") return m.clear ? { op: "unsetMyFeatureFlag", params: base } : { op: "setMyFeatureFlag", params: { ...base, enabled: m.enabled } };
  return m.clear ? { op: "unsetUserFeatureFlag", params: { ...base, userId: target.userId } } : { op: "setUserFeatureFlag", params: { ...base, userId: target.userId, enabled: m.enabled } };
}

/** A lookup from user id to a display name, from the people the admin has already looked up plus the directory. */
export function usePersonNames(): (userId: number) => string | null {
  const qc = useQueryClient();
  const directory = useFeatureUsers("");
  return (userId) => {
    const lists = [directory.data, ...qc.getQueriesData<FlagUser[]>({ queryKey: ["featureFlags", "users"] }).map(([, v]) => v)];
    for (const list of lists) {
      const u = (list || []).find((x) => x.userId === userId);
      if (u) return u.displayName || u.email || null;
    }
    return null;
  };
}
