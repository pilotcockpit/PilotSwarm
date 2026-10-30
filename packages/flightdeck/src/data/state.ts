import { normalizeSessionPause } from "@ps/state";
import type { Session } from "./types";
import { clock, toMs, tokens, until } from "@/lib/utils";

// One state map drives every surface (header, list row, board tile,
// Delegation view): a session can never read Failed in one place and Idle in
// another. State = glyph + word + colour, then the reason.

export type StateKey = "running" | "needs" | "waiting" | "failed" | "idle" | "completed" | "cancelled";

export interface SessionState {
  key: StateKey;
  word: string;
  /** Why, in a few words: "on 2 sub-agents", "schedule · every 15 min". */
  reason?: string;
  /** When something will change: "14:21 · in 6m". */
  next?: string;
  nextAt?: number;
  waitKind?: "timer" | "schedule" | "sub-agents" | "hold" | "folder";
}

export const STATE_WORD: Record<StateKey, string> = {
  running: "Running",
  needs: "Needs you",
  waiting: "Waiting",
  failed: "Failed",
  idle: "Idle",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function sessionState(s: Session | null | undefined, now = Date.now()): SessionState {
  if (!s) return { key: "idle", word: "Idle" };
  const status = String(s.status || "unknown");
  if (status === "completed") return { key: "completed", word: "Completed" };
  if (status === "cancelled" || status === "terminated") return { key: "cancelled", word: "Cancelled" };
  if (status === "input_required" || s.pendingQuestion?.question) {
    return { key: "needs", word: "Needs you", reason: "asked a question" };
  }
  if (status === "running") return { key: "running", word: "Running", reason: s.step || undefined };
  if (status === "error" || status === "failed" || (s.error && status !== "running")) {
    return { key: "failed", word: "Failed", reason: describeError(s.error).headline };
  }
  const pause = normalizeSessionPause(s);
  if (pause) {
    const what = pause.kind === "hold" ? "budget hold" : pause.kind === "no_provider" ? "no provider" : `${pause.period || ""} limit`.trim();
    return {
      key: "waiting",
      word: "Waiting",
      waitKind: "hold",
      reason: `${what}${pause.provider ? ` · ${pause.provider}` : ""}`,
      next: pause.resetsAtUtc ? `resets ${clock(pause.resetsAtUtc)}` : "until someone acts",
      nextAt: toMs(pause.resetsAtUtc) || undefined,
    };
  }
  if (s.cronActive) {
    const at = toMs(s.cronNextFireAt);
    return {
      key: "waiting",
      word: "Waiting",
      waitKind: "schedule",
      reason: `schedule${s.cronInterval ? ` · ${cronLabel(s.cronInterval)}` : ""}`,
      next: at ? `${clock(at)} · ${until(at, now)}` : undefined,
      nextAt: at || undefined,
    };
  }
  const children = Number(s.activeChildCount) || 0;
  if (children > 0) {
    return { key: "waiting", word: "Waiting", waitKind: "sub-agents", reason: `on ${children} sub-agent${children === 1 ? "" : "s"}`, next: "resumes when they finish" };
  }
  if (status === "waiting") {
    const at = toMs(s.waitUntil);
    return {
      key: "waiting",
      word: "Waiting",
      waitKind: "timer",
      reason: s.waitReason ? String(s.waitReason) : "timer",
      next: at ? `${clock(at)} · ${until(at, now)}` : undefined,
      nextAt: at || undefined,
    };
  }
  return { key: "idle", word: "Idle" };
}

function cronLabel(interval: number | string) {
  if (typeof interval === "string") return interval;
  const s = Number(interval);
  if (s % 86400 === 0) return s === 86400 ? "daily" : `every ${s / 86400} days`;
  if (s % 3600 === 0) return s === 3600 ? "hourly" : `every ${s / 3600}h`;
  if (s % 60 === 0) return `every ${s / 60} min`;
  return `every ${s}s`;
}

/** Text tone for each state: colour means state and nothing else. */
export const STATE_TONE: Record<StateKey, string> = {
  running: "text-live",
  needs: "text-needs",
  waiting: "text-waiting",
  failed: "text-failed",
  idle: "text-faint",
  completed: "text-faint",
  cancelled: "text-faint",
};

export const STATE_TINT: Record<StateKey, string> = {
  running: "bg-live-tint text-live",
  needs: "bg-needs-tint text-needs",
  waiting: "bg-waiting-tint text-waiting",
  failed: "bg-failed-tint text-failed",
  idle: "bg-raised text-muted",
  completed: "bg-raised text-muted",
  cancelled: "bg-raised text-muted",
};

// ── Structured errors ────────────────────────────────────────────────────
// One sentence naming the cause, the fixes as buttons, the raw message behind
// "Show details". Never a raw stack in the chat.

export interface StructuredError {
  headline: string;
  detail?: string;
  provider?: string;
  fixes: Array<"open-provider" | "switch-model" | "retry" | "open-admin" | "add-provider">;
  raw: string;
}

export function describeError(raw: unknown): StructuredError {
  const text = String(raw || "").trim();
  if (!text) return { headline: "Something went wrong", fixes: ["retry"], raw: "" };
  const wif = text.match(/Provider "([^"]+)" authenticates with workload identity, but the worker is missing ([^.]+?)(?: \(|\.|$)/);
  if (wif) {
    return {
      headline: "Can't reach its model",
      detail: `The ${wif[1]} provider isn't set up on the worker: its workload identity settings are missing.`,
      provider: wif[1],
      fixes: ["open-provider", "switch-model", "retry"],
      raw: text,
    };
  }
  const noKey = text.match(/(?:no|missing) (?:api )?(?:key|credential)s? for (?:provider )?"?([\w.-]+)"?/i);
  if (noKey) {
    return { headline: "Can't reach its model", detail: `The ${noKey[1]} provider has no key.`, provider: noKey[1], fixes: ["open-provider", "switch-model"], raw: text };
  }
  if (/budget|limit exceeded|quota/i.test(text)) {
    return { headline: "Paused by a usage limit", detail: "This provider's token limit was reached.", fixes: ["open-provider"], raw: text };
  }
  if (/rate.?limit|429/i.test(text)) {
    return { headline: "The model is rate limiting", detail: "The provider asked us to slow down. Retrying usually works.", fixes: ["retry"], raw: text };
  }
  if (/clone|git|workspace/i.test(text)) {
    return { headline: "Its working folder failed", detail: "The repository could not be prepared.", fixes: ["retry"], raw: text };
  }
  const first = text.replace(/^Failed after \d+ attempts?:\s*/i, "").replace(/^Activity '[^']+' JS execution failed:\s*(GenericFailure,\s*)?(Error:\s*)?/i, "");
  return { headline: "The last turn failed", detail: first.length > 180 ? `${first.slice(0, 177)}…` : first, fixes: ["retry"], raw: text };
}

export function pauseSentence(s: Session): string | null {
  const pause = normalizeSessionPause(s);
  if (!pause) return null;
  if (pause.kind === "no_provider") return "Paused: this session's model has no provider you can use.";
  if (pause.kind === "hold") return `Paused: ${pause.provider || "the provider"} is on hold${pause.resetsAtUtc ? ` until ${clock(pause.resetsAtUtc)}` : ""}.`;
  const used = pause.yourUsedTokens ?? pause.usedTokens;
  const cap = pause.ceilingTokens ?? pause.limitTokens;
  const whose = pause.kind === "allowance" ? "your share of" : "";
  return `Paused: you have used ${whose} ${pause.provider || "the provider"}'s ${pause.period || ""} limit${used != null && cap != null ? ` (${tokens(used)} of ${tokens(cap)} tokens)` : ""}.`.replace(/\s+/g, " ");
}

export function agentLabel(s: Session) {
  return s.agentId || "generic";
}

export function modelShort(qualified?: string | null) {
  const q = String(qualified || "");
  return q.includes(":") ? q.split(":").slice(1).join(":") : q || "default model";
}
