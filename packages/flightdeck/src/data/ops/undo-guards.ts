// Freshness checks for Undo (see lib/undo.tsx). Each re-reads the CURRENT state from the server and answers
// "is it still what the change produced?". Undo runs only when it is: otherwise it would overwrite a newer
// change made by someone else, or by this person in another tab.
import type { DataSource } from "@/data/types";

type Src = Pick<DataSource, "call">;
const arr = (raw: any, key: string): any[] => (Array.isArray(raw) ? raw : Array.isArray(raw?.[key]) ? raw[key] : []);
const same = (a: any, b: any) => a?.provider === b?.provider && a?.subject === b?.subject;

/** The person still has exactly this access on the session. */
export const sharedAs = (src: Src, sessionId: string, user: { provider: string; subject: string }, access: string) => async () =>
  arr(await src.call("listSessionShares", { sessionId }), "shares").some((s) => same(s, user) && s.access === access);

/** The person has no targeted share on the session. */
export const notShared = (src: Src, sessionId: string, user: { provider: string; subject: string }) => async () =>
  !arr(await src.call("listSessionShares", { sessionId }), "shares").some((s) => same(s, user));

export const visibilityIs = (src: Src, sessionId: string, visibility: string) => async () =>
  (await src.call("getSessionAccess", { sessionId }))?.visibility === visibility;

/** One cell of the usage grid: a provider's limit for a period, for all models or one model. */
export const limitIs = (src: Src, provider: string, period: "day" | "week" | "month", model: string | null, tokens: number | null) => async () => {
  const rows = arr(await src.call("getProviderUsageGrid"), "rows");
  const row = rows.find((r) => r.providerName === provider && (model ? r.rowKind === "model" && r.scope === model : r.rowKind === "provider"));
  const quota = row?.periods?.[period]?.quotaTokens;
  return (quota == null ? null : Number(quota)) === tokens;
};

/** The configured default in one slot (userSession | clusterSession | system) is this model. */
export const defaultIs = (src: Src, slot: "userSession" | "clusterSession" | "system", model: string | null) => async () => {
  const view = await src.call("getModelDefaults");
  return (view?.[slot]?.configured?.model ?? null) === (model || null);
};

/** The package's active version is this one. */
export const activeVersionIs = (src: Src, selector: Record<string, unknown>, semver: string) => async () => {
  const raw = await src.call("getAgentPackage", selector);
  const pkg = raw?.package ?? raw;
  const active = pkg?.active ?? (pkg?.versions || raw?.versions || []).find((v: any) => v.versionId === (raw?.activeVersionId ?? pkg?.activeVersionId));
  return active?.semver === semver;
};

/** The provider's per-person allowance is this percentage. */
export const allowanceIs = (src: Src, provider: string, pct: number) => async () => {
  const rows = arr(await src.call("getProviderUsageGrid"), "rows");
  return Number(rows.find((r) => r.providerName === provider && r.rowKind === "provider")?.allowancePct) === pct;
};
