import { useOpMutation, useOpQuery } from "./use-op";

// Housekeeping and fleet operations that only an admin can run.

export type Disposition = "complete" | "terminate" | "hard_delete";
export interface RestartResult { agentId: string; agentName?: string; sessionId: string; disposition: Disposition; previousSessionExisted?: boolean; skippedReason?: "busy" | "complete"; retired?: boolean; startResults?: Array<{ status?: string; error?: string }> }

/**
 * The three ways to restart a system session, in plain words, least to most destructive. "Complete" lets
 * the agent finish its current turn; "terminate" stops it now and keeps its history; "hard_delete" erases
 * the session and its history and starts a clean one.
 */
export const RESTART_MODES: Array<{ value: Disposition; label: string; promise: string; consequence: string; danger: boolean }> = [
  { value: "complete", label: "Finish, then restart", promise: "Waits for the current turn to end, then starts a fresh session.", consequence: "Nothing is lost. If it is busy right now, the restart is skipped and you can try again.", danger: false },
  { value: "terminate", label: "Stop now and restart", promise: "Stops the session immediately and starts a fresh one.", consequence: "Work in the current turn is cut off. The old session and its history stay readable.", danger: true },
  { value: "hard_delete", label: "Delete and restart", promise: "Erases the session and its history, then starts a clean one.", consequence: "The history cannot be recovered.", danger: true },
];

export function useRestartSystemSession() {
  return useOpMutation<{ agentIdOrSessionId: string; disposition: Disposition; startReplacement?: boolean }, RestartResult>("restartSystemSession", {
    params: (v) => ({ agentIdOrSessionId: v.agentIdOrSessionId, options: { disposition: v.disposition, ...(v.startReplacement === false ? { startReplacement: false } : {}), reason: "Restarted from Flight Deck" } }),
    invalidate: [["sessions"]],
  });
}

export function restartOutcome(r: RestartResult | undefined) {
  if (!r) return "Restarted.";
  if (r.skippedReason === "busy") return "It is busy right now, so nothing was restarted. Try again in a moment.";
  if (r.skippedReason === "complete") return "It had already finished, so nothing was restarted.";
  if (r.retired) return "Removed. Nothing was started in its place.";
  const failed = (r.startResults || []).find((s) => s.error);
  return failed ? `The old session was handled, but the new one did not start: ${failed.error}` : "Restarted. A fresh session is starting.";
}

export function usePruneSummaries() {
  return useOpMutation<{ olderThanDays: number }, number>("pruneDeletedSummaries", {
    params: (v) => ({ olderThan: new Date(Date.now() - v.olderThanDays * 86_400_000).toISOString() }),
  });
}

export interface AgentWorkerState { workerNodeId: string; epoch: number; installed: Record<string, unknown>; updatedAt: string }
export const useAgentWorkerState = (enabled = true) => useOpQuery<AgentWorkerState[]>(["admin", "agentWorkerState"], "listAgentWorkerState", undefined, { enabled, staleTime: 15_000, select: (r) => (Array.isArray(r) ? r : r?.workers || []) });

/** installed[key] is `{ semver, sha256, status: "ready" | "error", error? }`; older servers may send a bare version string. The key is the package name, plus `#scope` for a shared copy. */
export function installedVersion(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const s = o.semver ?? o.version ?? o.activeVersion;
    return typeof s === "string" ? s : null;
  }
  return null;
}

export function installedStatus(v: unknown): { ok: boolean; error?: string } {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.status === "error") return { ok: false, error: typeof o.error === "string" ? o.error : "failed to load" };
  }
  return { ok: true };
}

export function splitInstalledKey(key: string) {
  const [name, scope] = key.split("#");
  return { name, scope: scope || null };
}
