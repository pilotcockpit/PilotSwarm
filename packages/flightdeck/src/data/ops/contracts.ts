// Response contracts for operations whose server shape differs from what a screen wants to read.
// Each normaliser is pure and takes the wire shape documented in the SDK, so the demo fixtures can
// (and must) return the same wire shape: a demo that invents a field would hide a live defect.

// ── getProviderUsage ── packages/sdk/src/management-client.ts: ProviderUsageReport ──────────────
export interface UsageReport {
  totals: { total: number; turns: number; sessions: number };
  daily: Array<{ day: string; total: number; turns: number }>;
  breakdown: Array<{ key: string; label: string; total: number; turns: number }>;
}
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function normalizeUsageReport(raw: any): UsageReport {
  const t = raw?.totals || {};
  return {
    totals: { total: num(t.tokensTotal), turns: num(t.turns), sessions: num(t.sessions) },
    daily: (Array.isArray(raw?.daily) ? raw.daily : []).map((d: any) => ({ day: String(d?.dayUtc ?? ""), total: num(d?.tokensTotal), turns: num(d?.turns) })),
    breakdown: (Array.isArray(raw?.breakdown) ? raw.breakdown : []).map((b: any) => ({ key: String(b?.key ?? ""), label: String(b?.label ?? b?.key ?? ""), total: num(b?.tokensTotal), turns: num(b?.turns) })),
  };
}

// ── getAgentPackageFile ── management-client.ts getAgentPackageFile: { content, encoding } ──────
export interface PackageFileView { path?: string; text: string; binary: boolean; truncated: boolean; size?: number }

export function normalizePackageFile(raw: any): PackageFileView {
  const binary = Boolean(raw?.binary) || raw?.encoding === "base64";
  return {
    path: raw?.path,
    text: binary ? "" : typeof raw?.content === "string" ? raw.content : "",
    binary,
    truncated: Boolean(raw?.truncated),
    size: Number.isFinite(Number(raw?.size)) ? Number(raw.size) : undefined,
  };
}

// ── listFeatureFlagChanges ── migrations/feature-flags-0077.ts: audit rows with details.before/after
export interface FlagChangeView {
  auditId?: string; at?: string; actor: string; action: string; featureKey: string;
  scope: string;
  /** The person a personal change was for, when the change names one. */
  userId: number | null;
  /** The audit row's own name for that person, if it carried one. */
  person: string | null;
  /** What changed, without the person: "turned off", "reset to the default". */
  summary: string;
}

/** Who a personal change was for: the row's own name, else a name from a user list, else a short id. */
export function personLabel(c: Pick<FlagChangeView, "userId" | "person">, nameOf?: (userId: number) => string | null | undefined): string {
  if (c.person) return c.person;
  if (c.userId != null) return nameOf?.(c.userId) || `user ${c.userId}`;
  return "one person";
}

/** The change as one sentence, naming the person for a personal change. */
export const changeSentence = (c: FlagChangeView, nameOf?: (userId: number) => string | null | undefined) => (c.scope === "user" ? `${c.summary} for ${personLabel(c, nameOf)}` : c.summary);

export function describeFlagChange(row: any): FlagChangeView {
  const d = row?.details && typeof row.details === "object" ? row.details : {};
  const action = String(row?.action || "");
  const featureKey = String(d.featureKey || String(row?.target || "").replace(/^feature[:/]/, "") || "");
  const scope = String(d.scope || (action === "feature_flag.user_adopt" ? "user" : "cluster"));
  const before = d.before && typeof d.before === "object" ? d.before : null;
  const after = d.after && typeof d.after === "object" ? d.after : null;
  const userId = Number.isFinite(Number(d.userId)) && d.userId != null ? Number(d.userId) : null;
  let summary: string;
  if (action === "feature_flag.user_adopt") summary = "adopted a personal choice";
  else if (action === "feature_flag.unset") summary = scope === "cluster" ? "reset to the default" : "removed a personal choice";
  else {
    const parts: string[] = [];
    if (after && after.enabled !== (before ? before.enabled : undefined) && typeof after.enabled === "boolean") parts.push(after.enabled ? "turned on" : "turned off");
    else if (after && typeof after.enabled === "boolean" && !before) parts.push(after.enabled ? "turned on" : "turned off");
    if (scope === "cluster" && after && typeof after.allowUserOverride === "boolean" && (!before || before.allowUserOverride !== after.allowUserOverride)) {
      parts.push(after.allowUserOverride ? "people can choose" : "locked for everyone");
    }
    summary = parts.length ? parts.join(", ") : "changed";
  }
  const owner = d.owner ?? after?.owner ?? before?.owner ?? null;
  const person = typeof owner?.displayName === "string" && owner.displayName ? owner.displayName : typeof owner?.email === "string" && owner.email ? owner.email : null;
  return { auditId: row?.audit_id ?? row?.auditId, at: row?.occurred_at ?? row?.occurredAt, actor: String(row?.actor_subject ?? row?.actorSubject ?? "An admin"), action, featureKey, scope, userId, person, summary };
}

// ── readArtifactBase64 ── packages/app/tui/src/node-sdk-transport.js: { ...meta, base64, truncated } ──────
// The server caps `maxBytes` at 1 MiB and reports `truncated` when the document was longer.
export function normalizeArtifactPreview(raw: any): { text: string; truncated: boolean } {
  const b64 = typeof raw?.base64 === "string" ? raw.base64 : "";
  let text = "";
  if (b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  return { text, truncated: Boolean(raw?.truncated) };
}
