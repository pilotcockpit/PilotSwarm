import * as React from "react";
import { currentSelection, sameTuple, type ModelSelection } from "@/lib/model-options";
import type { Session } from "@/data/types";

// A model change is a command the session adopts later: setSessionModel returns once it is queued, and a running
// turn finishes on the old model first. Until the session reports the new tuple the change is PENDING, and the
// composer says so. Held here (not in a component) so closing the picker does not forget it.

export interface PendingModel { want: ModelSelection; prev: ModelSelection; at: number }
export const PENDING_MS = 10 * 60_000;

const store = new Map<string, PendingModel>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function markPending(sessionId: string, want: ModelSelection, prev: ModelSelection, at = Date.now()) { store.set(sessionId, { want, prev, at }); emit(); }
export function clearPending(sessionId: string) { if (store.delete(sessionId)) emit(); }
export const resetPending = () => { store.clear(); emit(); };

/** The pending change for a session, or null once the session reports it (or after it has been pending too long to believe). */
export function pendingFor(session: Pick<Session, "sessionId" | "model" | "reasoningEffort" | "contextTier">, now = Date.now()): PendingModel | null {
  const p = store.get(session.sessionId);
  if (!p) return null;
  if (sameTuple(currentSelection(session), p.want)) return null;
  if (now - p.at > PENDING_MS) return null;
  return p;
}

export function usePendingModel(session: Pick<Session, "sessionId" | "model" | "reasoningEffort" | "contextTier">): PendingModel | null {
  const snap = React.useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => store.get(session.sessionId) ?? null);
  // Adopted: forget it, so a later poll that shows an older tuple does not resurrect a stale "pending".
  React.useEffect(() => { if (snap && sameTuple(currentSelection(session), snap.want)) clearPending(session.sessionId); });
  return snap && pendingFor(session) ? snap : null;
}
