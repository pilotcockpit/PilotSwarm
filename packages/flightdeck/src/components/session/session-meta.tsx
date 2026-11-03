import { Globe, Lock, Users } from "lucide-react";
import { sessionState } from "@/data/state";
import type { Session } from "@/data/types";

// Small facts about a session that more than one surface shows: the header, the Context panel.

/** A session owner is an object on the API and a plain name in fixtures. */
export function ownerName(owner: unknown): string {
  if (!owner) return "";
  if (typeof owner === "string") return owner;
  const o = owner as Record<string, unknown>;
  return String(o.displayName || o.email || o.subject || "");
}

/**
 * How full the context window is. The SDK reports `utilization` as currentTokens / tokenLimit, a plain
 * ratio: 0.38 is 38%, and 1.2 is a session 20% over its limit. It is never a percentage. `percent` is the
 * honest number (may exceed 100); `meter` is that clamped to 0–100 for a bar and aria-valuenow; `over` says
 * the limit has been passed. Null when there is nothing usable to show (absent, NaN, or negative).
 */
export interface ContextFill { percent: number; meter: number; over: boolean }
export function contextFill(utilization: unknown): ContextFill | null {
  if (typeof utilization !== "number" || !Number.isFinite(utilization) || utilization < 0) return null;
  const percent = Math.round(utilization * 100);
  // `over` comes from the ratio, not the rounded number: 1.0001 is over the limit even though it rounds to 100.
  return { percent, meter: Math.min(100, percent), over: utilization > 1 };
}
export function contextPercent(session: Session): number | null {
  return contextFill((session as any).contextUsage?.utilization)?.percent ?? null;
}

export const STALL_MS = 10 * 60_000;
export const isStalled = (session: Session) => sessionState(session).key === "running" && Boolean(session.updatedAt) && Date.now() - Number(session.updatedAt) > STALL_MS;

/** Who can see a session. Renders nothing when the server did not say: an unknown access is not "Private". */
export function VisibilityLabel({ visibility }: { visibility?: string }) {
  if (!visibility) return null;
  const v = visibility;
  const Icon = v === "private" ? Lock : v === "shared_write" ? Users : Globe;
  const label = v === "private" ? "Private" : v === "shared_write" ? "Shared · can reply" : "Shared · view only";
  return <span className="inline-flex items-center gap-1 text-sm"><Icon className="size-3.5" aria-hidden />{label}</span>;
}
