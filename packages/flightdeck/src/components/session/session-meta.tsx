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

/** Context-window fill as a percentage, from either a 0–1 or a 0–100 utilization. */
export function contextPercent(session: Session): number | null {
  const u = (session as any).contextUsage?.utilization;
  if (typeof u !== "number" || !Number.isFinite(u)) return null;
  return Math.round(u <= 1 ? u * 100 : u);
}

export const STALL_MS = 10 * 60_000;
export const isStalled = (session: Session) => sessionState(session).key === "running" && Boolean(session.updatedAt) && Date.now() - Number(session.updatedAt) > STALL_MS;


export function VisibilityLabel({ visibility }: { visibility?: string }) {
  const v = visibility || "private";
  const Icon = v === "private" ? Lock : v === "shared_write" ? Users : Globe;
  const label = v === "private" ? "Private" : v === "shared_write" ? "Shared · can reply" : "Shared · view only";
  return <span className="inline-flex items-center gap-1 text-sm"><Icon className="size-3.5" aria-hidden />{label}</span>;
}

