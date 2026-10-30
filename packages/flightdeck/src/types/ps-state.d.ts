export interface SessionPause {
  kind: "limit" | "allowance" | "hold" | "no_provider";
  provider: string | null;
  period: "day" | "week" | "month" | null;
  modelQualified: string | null;
  limitTokens: number | null;
  usedTokens: number | null;
  ceilingTokens: number | null;
  yourUsedTokens: number | null;
  resetsAtUtc: string | null;
}
export declare function normalizeSessionPause(session: unknown): SessionPause | null;
