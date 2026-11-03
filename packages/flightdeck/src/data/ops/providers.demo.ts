import { registerDemoOps } from "./registry";

// Stateful demo fixtures for Models & spend. The provider list itself comes from the shared demo
// source; this file layers the edits a person makes (limits, holds, keys, defaults, new providers)
// over it, so every flow works end to end with ?data=demo and resets on reload.

type Period = "day" | "week" | "month";
const PERIODS: Period[] = ["day", "week", "month"];

interface P {
  name: string; typeId: string; class: "shared" | "personal"; baseUrl?: string; owner?: string | null;
  hasCredential: boolean; usableByMe: boolean; allowancePct: number; holdUntilUtc: string | null; holdIndefinite: boolean; systemUse: boolean;
  keyChangedAt?: string;
}

const providers: P[] = [
  { name: "anthropic-wif", typeId: "anthropic-wif", class: "shared", baseUrl: "https://api.anthropic.com", hasCredential: true, usableByMe: true, allowancePct: 40, holdUntilUtc: null, holdIndefinite: false, systemUse: true },
  { name: "azure-foundry-wif", typeId: "foundry-wif", class: "shared", baseUrl: "https://example-foundry.cognitiveservices.azure.com/openai/v1", hasCredential: true, usableByMe: true, allowancePct: 100, holdUntilUtc: null, holdIndefinite: false, systemUse: true },
  { name: "my-openai", typeId: "openai", class: "personal", baseUrl: "https://api.openai.com/v1", owner: "Sam Lee", hasCredential: true, usableByMe: false, allowancePct: 100, holdUntilUtc: null, holdIndefinite: false, systemUse: false },
];
const removed = new Set<string>();

// Limits by provider|period|model ("*" for all models).
const limits = new Map<string, number>([
  ["anthropic-wif|month|*", 10_000_000],
  ["anthropic-wif|day|anthropic-wif:claude-opus-5", 900_000],
  ["azure-foundry-wif|month|*", 40_000_000],
]);
const used: Record<string, Record<Period, number>> = {
  "anthropic-wif": { day: 1_100_000, week: 5_100_000, month: 9_700_000 },
  "azure-foundry-wif": { day: 800_000, week: 3_900_000, month: 12_000_000 },
  "my-openai": { day: 0, week: 0, month: 0 },
};
const modelUsed: Record<string, Record<Period, number>> = {
  "anthropic-wif:claude-opus-5": { day: 612_000, week: 2_400_000, month: 4_300_000 },
};

interface Tup { provider: string | null; model: string | null; reasoning: string | null; context: string | null }
const tup = (provider: string | null, model: string | null): Tup => ({ provider, model, reasoning: null, context: null });
const defaults = { mine: tup(null, null), cluster: tup("anthropic-wif", "anthropic-wif:claude-sonnet-5"), system: tup("azure-foundry-wif", "azure-foundry-wif:gpt-5.6") };
const overrides = new Map<string, Tup>([["sweeper", tup("anthropic-wif", "anthropic-wif:claude-sonnet-5")]]);

const TYPE_MODELS: Record<string, Array<{ modelName: string; description: string; supportedReasoningEfforts?: string[]; defaultReasoningEffort?: string }>> = {
  github: [{ modelName: "claude-sonnet-5", description: "Balanced Claude model through Copilot." }, { modelName: "gpt-5.6", description: "OpenAI flagship through Copilot.", supportedReasoningEfforts: ["low", "medium", "high"], defaultReasoningEffort: "medium" }],
  openai: [{ modelName: "gpt-5.6", description: "OpenAI flagship.", supportedReasoningEfforts: ["low", "medium", "high"], defaultReasoningEffort: "medium" }, { modelName: "gpt-5.6-mini", description: "Fast and inexpensive." }],
  anthropic: [{ modelName: "claude-sonnet-5", description: "Balanced." }, { modelName: "claude-opus-5", description: "Most capable." }],
  azure: [{ modelName: "gpt-5.6", description: "Azure OpenAI deployment." }],
  "anthropic-wif": [{ modelName: "claude-sonnet-5", description: "Balanced." }, { modelName: "claude-opus-5", description: "Most capable." }],
  "foundry-wif": [{ modelName: "gpt-5.6", description: "Azure AI Foundry deployment." }],
};

const live = () => providers.filter((p) => !removed.has(p.name));
const find = (name: string) => {
  const p = providers.find((x) => x.name === name && !removed.has(x.name));
  if (!p) throw new Error(`There is no provider named "${name}".`);
  return p;
};
const modelsOf = (p: P) => (TYPE_MODELS[p.typeId] || []).map((m) => ({ ...m, qualifiedName: `${p.name}:${m.modelName}`, providerId: p.name, providerType: p.typeId, credentialAvailable: p.hasCredential }));

const nextReset = (period: Period) => {
  const d = new Date();
  if (period === "day") return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString();
  if (period === "week") return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7))).toISOString();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
};
const limitOf = (name: string, period: Period, model: string) => limits.get(`${name}|${period}|${model}`) ?? null;

function row(p: P, scope: string) {
  const model = scope !== "*";
  return {
    providerName: p.name, rowKind: model ? "model" : "provider", scope, class: p.class, allowancePct: p.allowancePct,
    holdUntilUtc: p.holdUntilUtc, holdIndefinite: p.holdIndefinite, modelRowCount: 0, ownedByMe: p.usableByMe, manageable: p.class === "shared" || p.owner == null, ownerLabel: p.owner ?? null,
    periods: Object.fromEntries(PERIODS.map((period) => {
      const u = (model ? modelUsed[scope]?.[period] : used[p.name]?.[period]) ?? 0;
      const q = limitOf(p.name, period, scope);
      return [period, { ruleId: q == null ? null : `${p.name}-${period}-${scope}`, quotaTokens: q, usedTokens: u, yourQuotaTokens: q == null ? null : Math.round((q * p.allowancePct) / 100), yourUsedTokens: Math.round(u * 0.35), windowStartUtc: new Date().toISOString(), resetsAtUtc: nextReset(period) }];
    })),
  };
}

function gridRows() {
  return live().flatMap((p) => {
    const scopes = [...new Set([...limits.keys()].filter((k) => k.startsWith(`${p.name}|`)).map((k) => k.split("|")[2]).filter((s) => s !== "*"))];
    return [{ ...row(p, "*"), modelRowCount: scopes.length }, ...scopes.map((s) => row(p, s))];
  });
}

const tightestMonth = (p: P) => {
  const cands = [...limits.entries()].filter(([k]) => k.startsWith(`${p.name}|month|`));
  let best: { used: number; limit: number | null; model: string | null } = { used: used[p.name]?.month ?? 0, limit: null, model: null };
  let worst = -1;
  for (const [k, q] of cands) {
    const scope = k.split("|")[2];
    const u = scope === "*" ? used[p.name]?.month ?? 0 : modelUsed[scope]?.month ?? 0;
    if (q > 0 && u / q > worst) { worst = u / q; best = { used: u, limit: q, model: scope === "*" ? null : scope }; }
  }
  return best;
};

const slot = (configured: Tup, fallbackChain: Array<[Tup, "cluster_default" | "user_default" | "system_default"]>) => {
  for (const [t, source] of fallbackChain) {
    if (t.model) return { configured, effective: { provider: t.provider!, model: t.model, reasoningEffort: t.reasoning, contextTier: t.context, source }, error: null };
  }
  return { configured, effective: { provider: "anthropic-wif", model: "anthropic-wif:claude-sonnet-5", reasoningEffort: null, contextTier: null, source: "first_available" as const }, error: null };
};

const need = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };

registerDemoOps(import.meta.url, {
  "providers.rows": ({ base }) => {
    const baseRows: any[] = base || [];
    const out = live().map((p) => {
      const b = baseRows.find((r) => r.name === p.name) || {};
      const month = tightestMonth(p);
      const ls = [...limits.entries()].filter(([k]) => k.startsWith(`${p.name}|`)).map(([k, tokens]) => { const [, period, scope] = k.split("|"); return { period: period as Period, tokens, model: scope === "*" ? null : scope }; });
      return {
        ...b, name: p.name, typeId: p.typeId, class: p.class, baseUrl: p.baseUrl, ownerDisplayName: p.owner ?? null, hasCredential: p.hasCredential, usableByMe: p.usableByMe,
        allowancePct: p.allowancePct, holdUntilUtc: p.holdUntilUtc, holdIndefinite: p.holdIndefinite, systemUseEnabled: p.systemUse, keyChangedAt: p.keyChangedAt,
        ruleCount: ls.length, limits: ls, usage: { month },
        isClusterDefault: defaults.cluster.provider === p.name, isMyDefault: defaults.mine.provider === p.name, isSystemDefault: defaults.system.provider === p.name,
      };
    });
    return out;
  },
  getProviderUsageGrid: () => ({ rows: gridRows() }),
  getModelsByProvider: () => Object.entries(TYPE_MODELS).map(([id, models]) => ({ catalogKind: "provider_type", providerId: id, type: id, models: models.map((m) => ({ ...m, qualifiedName: `${id}:${m.modelName}`, providerId: id })) })),
  "providers.models": ({ base }) => {
    const known = new Set((base || []).map((m: any) => m.qualifiedName));
    return [...(base || []), ...live().flatMap(modelsOf).filter((m) => !known.has(m.qualifiedName))].filter((m: any) => live().some((p) => p.name === m.providerId));
  },
  getModelDefaults: () => ({
    userSession: slot(defaults.mine, [[defaults.mine, "user_default"], [defaults.cluster, "cluster_default"]]),
    clusterSession: slot(defaults.cluster, [[defaults.cluster, "cluster_default"]]),
    system: slot(defaults.system, [[defaults.system, "system_default"]]),
    systemOverrides: [...overrides].map(([agentId, t]) => ({ agentId, ...t })),
  }),
  getProviderUsage: ({ provider, days = 14 }) => {
    const scale = (used[provider]?.month ?? 1_000_000) / 14;
    const models = limits.size ? modelsOf(find(provider)) : [];
    return {
      totals: { tokensTotal: Math.round(scale * days), turns: Math.round(scale / 9000 * days), sessions: 9 },
      daily: Array.from({ length: days }, (_, i) => {
        const tokensTotal = Math.round(scale * (0.7 + 0.5 * Math.abs(Math.sin(i / 2))));
        return { dayUtc: new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10), tokensTotal, turns: Math.round(tokensTotal / 9000), tokensInput: Math.round(tokensTotal * 0.7), tokensOutput: Math.round(tokensTotal * 0.2), tokensCacheRead: Math.round(tokensTotal * 0.1), tokensCacheWrite: 0 };
      }),
      breakdown: models.map((m, i) => ({ key: m.qualifiedName, label: m.qualifiedName, tokensTotal: Math.round(scale * days * (i === 0 ? 0.7 : 0.3)), turns: 120 - i * 40 })),
      dimension: "model",
      truncated: false,
    };
  },

  createMyProvider: (v) => create(v, "personal"),
  createProvider: (v) => create(v, "shared"),
  updateMyProviderCredential: (v) => rotate(v),
  updateSharedProviderCredential: (v) => rotate(v),
  deleteMyProvider: (v) => remove(v),
  deleteProvider: (v) => remove(v),
  clearProviderRoutingDependencies: ({ name }) => {
    if (defaults.cluster.provider === name) defaults.cluster = tup(null, null);
    if (defaults.mine.provider === name) defaults.mine = tup(null, null);
    if (defaults.system.provider === name) defaults.system = tup(null, null);
    for (const [k, t] of overrides) if (t.provider === name) overrides.delete(k);
    return { name };
  },
  setProviderLimit: ({ name, period, model, tokens }) => {
    const p = find(name);
    need(Number.isSafeInteger(tokens) && tokens >= 0, "A limit is a whole number of tokens, zero or more.");
    limits.set(`${name}|${period}|${model || "*"}`, tokens);
    return { ruleId: `${name}-${period}`, seededTokens: model ? modelUsed[model]?.[period as Period] ?? 0 : used[p.name]?.[period as Period] ?? 0 };
  },
  removeProviderLimit: ({ name, period, model }) => ({ removed: limits.delete(`${name}|${period}|${model || "*"}`) }),
  setProviderAllowance: ({ name, pct }) => { const p = find(name); need(pct >= 1 && pct <= 100, "An allowance is between 1 and 100."); p.allowancePct = Math.round(pct); return { name, allowancePct: p.allowancePct }; },
  setProviderHold: ({ name, untilUtc, release }) => {
    const p = find(name);
    if (release) { p.holdUntilUtc = null; p.holdIndefinite = false; }
    else if (untilUtc) { need(Date.parse(untilUtc) > Date.now(), "A hold must end in the future."); p.holdUntilUtc = untilUtc; p.holdIndefinite = false; }
    else { p.holdUntilUtc = null; p.holdIndefinite = true; }
    return { name, holdUntilUtc: p.holdUntilUtc, holdIndefinite: p.holdIndefinite };
  },
  setProviderSystemUse: ({ name, enabled }) => { find(name).systemUse = Boolean(enabled); return { provider: name, systemUseEnabled: Boolean(enabled) }; },
  setModelDefault: ({ scope, provider, model, reasoningEffort, contextTier }) => {
    const t = provider && model ? { provider, model, reasoning: reasoningEffort ?? null, context: contextTier ?? null } : tup(null, null);
    if (scope === "cluster") defaults.cluster = t; else defaults.mine = t;
    return t;
  },
  setSystemModelDefault: ({ provider, model }) => { defaults.system = provider && model ? tup(provider, model) : tup(null, null); return defaults.system; },
  setSystemSessionModel: ({ agentId, provider, model }) => { overrides.set(agentId, tup(provider, model)); return { agentId, provider, model }; },
  clearSystemSessionModel: ({ agentId }) => { overrides.delete(agentId); return { agentId }; },
  getLegacyProviderMigrationStatus: () => ({ regularKeys: 0, migratedRegularKeys: 0, systemKeyPresent: false, systemKeyAdopted: false }),
});

function create(v: { name: string; type: string; credentials?: any; baseUrl?: string | null }, cls: "shared" | "personal") {
  need(!providers.some((p) => p.name.toLowerCase() === String(v.name).toLowerCase() && !removed.has(p.name)), "A provider with that name already exists.");
  need(TYPE_MODELS[v.type], `No provider type named "${v.type}" on this deployment.`);
  const wi = v.type.endsWith("-wif");
  need(!(wi && cls === "personal"), `Provider type "${v.type}" authenticates with the worker's own identity, so it cannot be a personal provider.`);
  const p: P = { name: v.name, typeId: v.type, class: cls, baseUrl: v.baseUrl || undefined, owner: null, hasCredential: true, usableByMe: true, allowancePct: 100, holdUntilUtc: null, holdIndefinite: false, systemUse: false, keyChangedAt: new Date().toISOString() };
  providers.push(p); used[p.name] = { day: 0, week: 0, month: 0 };
  return { name: p.name, typeId: p.typeId, class: p.class };
}
function rotate(v: { name: string; credentials?: any }) {
  const p = find(v.name);
  need(!p.typeId.endsWith("-wif"), `Provider "${v.name}" authenticates with the worker's workload identity and has no key to update.`);
  p.hasCredential = true; p.keyChangedAt = new Date().toISOString();
  return { name: p.name, typeId: p.typeId, class: p.class };
}
function remove({ name }: { name: string }) {
  find(name);
  removed.add(name);
  return { name, waitingSessions: name === "anthropic-wif" ? 3 : 0 };
}
