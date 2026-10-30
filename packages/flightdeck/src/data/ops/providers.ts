import { useQuery } from "@tanstack/react-query";
import { useSource } from "@/data/source";
import { useOpMutation, useOpQuery, useOpRequest, type OpRequest } from "@/data/ops/use-op";
import type { Model, Provider } from "@/data/types";
import { normalizeUsageReport, type UsageReport } from "./contracts";

// Providers, limits, defaults and paused work: typed wrappers over the Web API operations.
// Cache keys all start with "providers" so one invalidation refreshes the whole area.

export type Period = "day" | "week" | "month";
export const PERIODS: Period[] = ["day", "week", "month"];

export interface GridCell {
  quotaTokens: number | null;
  usedTokens: number;
  yourQuotaTokens?: number | null;
  yourUsedTokens?: number | null;
  windowStartUtc?: string;
  resetsAtUtc?: string | null;
}
export interface GridRow {
  providerName: string;
  rowKind: "provider" | "model";
  /** "*" on a provider row; the qualified model name on a model row. */
  scope: string;
  class: string;
  allowancePct: number;
  holdUntilUtc: string | null;
  holdIndefinite: boolean;
  ownedByMe?: boolean;
  manageable?: boolean;
  ownerLabel?: string | null;
  periods: Record<Period, GridCell>;
}

export interface TypeModel {
  qualifiedName: string;
  modelName: string;
  description?: string;
  supportedReasoningEfforts?: string[];
  defaultReasoningEffort?: string;
  supportedContextTiers?: string[];
  defaultContextTier?: string;
}
export interface ProviderType {
  id: string;
  type: string;
  usesWorkloadIdentity: boolean;
  models: TypeModel[];
}

export interface Tuple { provider: string | null; model: string | null; reasoning: string | null; context: string | null }
export interface Effective { provider: string; model: string; reasoningEffort: string | null; contextTier: string | null; source: "user_default" | "cluster_default" | "system_default" | "first_available" }
export interface DefaultsSlot { configured: Tuple; effective: Effective | null; error: string | null }
export interface DefaultsView {
  userSession: DefaultsSlot;
  clusterSession: DefaultsSlot;
  system: DefaultsSlot;
  systemOverrides: Array<Tuple & { agentId: string }>;
}

export interface PausedRow {
  sessionId: string;
  title: string | null;
  model: string | null;
  ownerEmail?: string | null;
  pause: { kind: "limit" | "allowance" | "hold" | "no_provider" | string; provider?: string | null; period?: Period | null; modelQualified?: string | null; limitTokens?: number | null; usedTokens?: number | null; ceilingTokens?: number | null; yourUsedTokens?: number | null; resetsAtUtc?: string | null } | null;
  updatedAt?: string | number;
}

const WORKLOAD_IDENTITY_TYPES = new Set(["anthropic-wif", "foundry-wif"]);

/** Providers the caller can see. Demo mode layers its in-memory edits over the fixtures. */
export function useProviderRows() {
  const { source } = useSource();
  return useQuery({
    queryKey: ["providers", "table"],
    queryFn: async (): Promise<Provider[]> => {
      const rows = await source.listProviders();
      return source.kind === "demo" ? await source.call("providers.rows", { base: rows }) : rows;
    },
  });
}

/** Models a person could pick: the viewer-usable provider instances. Demo adds the providers created in this tab. */
export function useUsableModels() {
  const { source } = useSource();
  return useQuery({
    queryKey: ["providers", "models"],
    queryFn: async (): Promise<Model[]> => {
      const base = await source.listModels();
      return source.kind === "demo" ? await source.call("providers.models", { base }) : base;
    },
    staleTime: 30_000,
  });
}

export const useUsageGrid = () =>
  useOpQuery<GridRow[]>(["providers", "grid"], "getProviderUsageGrid", undefined, { select: (raw) => (Array.isArray(raw) ? raw : raw?.rows) || [] });

export const useProviderTypes = () =>
  useOpQuery<ProviderType[]>(["providers", "types"], "getModelsByProvider", undefined, {
    staleTime: 5 * 60_000,
    select: (raw) =>
      (Array.isArray(raw) ? raw : []).map((g: any) => ({
        id: String(g.providerId),
        type: String(g.type || g.providerId),
        usesWorkloadIdentity: WORKLOAD_IDENTITY_TYPES.has(String(g.type || g.providerId)),
        models: g.models || [],
      })),
  });

export const useModelDefaults = () => useOpQuery<DefaultsView>(["providers", "defaults"], "getModelDefaults");

export const providerUsageRequest = (provider: string, days = 14): OpRequest<UsageReport> => ({
  key: ["providers", "usage", provider, days],
  op: "getProviderUsage",
  params: { provider, days, dimension: "model" },
  select: normalizeUsageReport,
});
export const useProviderUsage = (provider: string, days = 14) => useOpRequest(providerUsageRequest(provider, days), { staleTime: 30_000 });

/** Paused sessions with the exact reason. Live reads the API; demo reads the pauseState on its fixture sessions. */
export function usePausedSessions() {
  const { source } = useSource();
  return useQuery({
    queryKey: ["providers", "paused"],
    queryFn: async (): Promise<PausedRow[]> => {
      if (source.kind === "demo") {
        return (await source.listSessions())
          .filter((s) => s.pauseState)
          .map((s) => ({ sessionId: s.sessionId, title: s.title || null, model: s.model || null, ownerEmail: typeof s.owner === "string" ? s.owner : null, pause: s.pauseState as PausedRow["pause"] }));
      }
      const raw: any = await source.call("listPausedSessions");
      return (Array.isArray(raw) ? raw : raw?.sessions) || [];
    },
    refetchInterval: 30_000,
  });
}

// A provider change also changes which models a person can pick, so the model catalog refreshes with it.
const refresh = [["providers"], ["usage"], ["models"]];

export const useCreateProvider = () =>
  useOpMutation<{ name: string; type: string; apiKey?: string; baseUrl?: string | null; shared: boolean }, { name: string }>((v) => (v.shared ? "createProvider" : "createMyProvider"), {
    params: (v) => {
      const type = v.type;
      const credentials = WORKLOAD_IDENTITY_TYPES.has(type) ? { kind: "workloadIdentity" } : /github/i.test(type) ? { githubToken: v.apiKey } : { apiKey: v.apiKey };
      return { name: v.name, type, credentials, baseUrl: v.baseUrl || null };
    },
    invalidate: refresh,
    failure: "Couldn't add the provider",
  });

export const useRotateKey = () =>
  useOpMutation<{ name: string; type: string; shared: boolean; apiKey: string }>((v) => (v.shared ? "updateSharedProviderCredential" : "updateMyProviderCredential"), {
    params: (v) => ({ name: v.name, credentials: /github/i.test(v.type) ? { githubToken: v.apiKey } : { apiKey: v.apiKey } }),
    invalidate: refresh,
    success: "Key replaced. Name, defaults and usage history are unchanged.",
    failure: "Couldn't replace the key",
  });

export const useDeleteProvider = () =>
  useOpMutation<{ name: string; shared: boolean; clearRouting?: boolean }, { name: string; waitingSessions?: number }>((v) => (v.shared ? "deleteProvider" : "deleteMyProvider"), {
    params: (v) => ({ name: v.name }),
    invalidate: refresh,
    failure: "Couldn't remove the provider",
  });

export const useClearRouting = () => useOpMutation<{ name: string }>("clearProviderRoutingDependencies", { params: (v) => v, invalidate: refresh, failure: "Couldn't clear the defaults" });

export const useSetLimit = () =>
  useOpMutation<{ name: string; period: Period; model?: string | null; tokens: number }, { seededTokens?: number }>("setProviderLimit", {
    params: (v) => ({ name: v.name, period: v.period, model: v.model ?? null, tokens: v.tokens }),
    invalidate: refresh,
    failure: "Couldn't save the limit",
  });

export const useRemoveLimit = () =>
  useOpMutation<{ name: string; period: Period; model?: string | null }>("removeProviderLimit", {
    params: (v) => ({ name: v.name, period: v.period, model: v.model ?? null }),
    invalidate: refresh,
    failure: "Couldn't remove the limit",
  });

export const useSetAllowance = () =>
  useOpMutation<{ name: string; pct: number }>("setProviderAllowance", { params: (v) => v, invalidate: refresh, failure: "Couldn't change the allowance" });

export const useSetHold = () =>
  useOpMutation<{ name: string; untilUtc?: string | null; release?: boolean }>("setProviderHold", {
    params: (v) => ({ name: v.name, ...(v.release ? { release: true } : v.untilUtc ? { untilUtc: v.untilUtc } : {}) }),
    invalidate: refresh,
    failure: "Couldn't change the hold",
  });

export const useSetSystemUse = () =>
  useOpMutation<{ name: string; enabled: boolean }>("setProviderSystemUse", { params: (v) => v, invalidate: refresh, failure: "Couldn't change system use" });

/** One default for one scope. A null model clears it (inherit). */
export const useSetDefault = () =>
  useOpMutation<{ scope: "user" | "cluster" | "system"; provider: string | null; model: string | null; reasoningEffort?: string | null; contextTier?: string | null; restartSystemSessions?: boolean }>(
    (v) => (v.scope === "system" ? "setSystemModelDefault" : "setModelDefault"),
    {
      params: (v) => {
        const base = { provider: v.provider, model: v.model, reasoningEffort: v.reasoningEffort ?? null, contextTier: v.contextTier ?? null };
        if (v.scope === "system") return { ...base, restartExisting: v.restartSystemSessions ? { disposition: "complete" } : false };
        return { scope: v.scope, ...base };
      },
      invalidate: refresh,
      failure: "Couldn't save the default",
    },
  );

export const useSetSystemAgentModel = () =>
  useOpMutation<{ agentId: string; provider: string; model: string; reasoningEffort?: string | null; contextTier?: string | null }>("setSystemSessionModel", {
    params: (v) => ({ agentId: v.agentId, provider: v.provider, model: v.model, reasoningEffort: v.reasoningEffort ?? null, contextTier: v.contextTier ?? null }),
    invalidate: refresh,
    failure: "Couldn't set the model",
  });

export const useClearSystemAgentModel = () => useOpMutation<{ agentId: string }>("clearSystemSessionModel", { params: (v) => v, invalidate: refresh, failure: "Couldn't clear the override" });

// ── Pure helpers shared by the screens ──────────────────────────────────────────────────

export const providerQualified = (provider: string, model: string) => (model.includes(":") ? model : `${provider}:${model}`);

const UNITS: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };
/** "5M", "250k", "1.5m", "2,000,000" → whole tokens, or null when it is not a number. */
/** The exact integer for an edit box: never the rounded display form (1,234,567 is not 1.2M). */
export const editableTokens = (n: number): string => String(Math.trunc(n));
/** What the limit editor shows when it opens: the saved limit exactly, or nothing. */
export const initialLimitText = (quota: number | null | undefined): string => (quota != null ? editableTokens(quota) : "");

export function parseTokens(input: string): number | null {
  const m = input.trim().toLowerCase().replace(/[, _]/g, "").match(/^(\d+(?:\.\d+)?)([kmb])?(?:tokens?)?$/);
  if (!m) return null;
  const n = Math.round(Number(m[1]) * (m[2] ? UNITS[m[2]] : 1));
  return Number.isSafeInteger(n) ? n : null;
}

/** Time until an ISO instant, in words ("5h 12m", "2d"), or "" when absent or past. */
export function untilWords(iso?: string | null, now = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t) || t <= now) return "";
  const mins = Math.round((t - now) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h${mins % 60 ? ` ${mins % 60}m` : ""}`;
  return `${Math.round(h / 24)}d`;
}

export const PERIOD_WORD: Record<Period, string> = { day: "day", week: "week", month: "month" };
export const PERIOD_LABEL: Record<Period, string> = { day: "Today", week: "This week", month: "This month" };

/** The friendly name for a provider type id. Unknown ids show as they are. */
export function typeLabel(id: string): string {
  const known: Record<string, string> = {
    github: "GitHub Copilot",
    openai: "OpenAI",
    "openai-proxy": "OpenAI-compatible endpoint",
    azure: "Azure OpenAI",
    anthropic: "Anthropic",
    "anthropic-wif": "Anthropic (workload identity)",
    "foundry-wif": "Azure AI Foundry (workload identity)",
  };
  return known[id] || id;
}

/** Is a name acceptable as a provider name? Returns the reason it is not, or null. */
export function nameProblem(name: string, existing: string[]): string | null {
  const t = name.trim();
  if (!t) return null;
  if (t.length > 64) return `Too long: ${t.length} characters, and a name may be at most 64.`;
  if (!/^[A-Za-z0-9._-]+$/.test(t)) return 'Letters, numbers, dot, dash and underscore only. No spaces or colons: sessions refer to it as "name:model".';
  if (existing.some((n) => n.toLowerCase() === t.toLowerCase())) return "A provider with that name already exists. Names are unique across the cluster.";
  return null;
}

/** A suggested name that is free: type, then -2, -3 ... */
export function suggestName(base: string, existing: string[]): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; i < 100; i++) if (!taken.has(`${base}-${i}`.toLowerCase())) return `${base}-${i}`;
  return base;
}
