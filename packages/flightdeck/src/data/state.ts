import { normalizeSessionPause } from "@ps/state";
import type { PendingQuestion, Session } from "./types";
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
  // Queued for a worker: it is about to run, not sitting idle.
  if (status === "pending") return { key: "running", word: "Running", reason: s.step || "starting" };
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
  // Child count is metadata. A parent waits on sub-agents only when the server says so: the SDK's agent
  // wait reads "waiting for N agent(s)". A timer, schedule or workspace wait keeps its own reason.
  const agentWait = /^waiting for \d+ agent\(s\)/i.test(String(s.waitReason || ""));
  if (children > 0 && status === "waiting" && agentWait) {
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
  /** Which known cause this is; failures only group when this and the provider match. */
  code?: "wif-missing" | "no-key" | "usage-limit" | "rate-limit" | "workspace";
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
      code: "wif-missing",
      headline: "Can't reach its model",
      detail: `The ${wif[1]} provider isn't set up on the worker: its workload identity settings are missing.`,
      provider: wif[1],
      fixes: ["open-provider", "switch-model", "retry"],
      raw: text,
    };
  }
  const noKey = text.match(/(?:no|missing) (?:api )?(?:key|credential)s? for (?:provider )?"?([\w.-]+)"?/i);
  if (noKey) {
    return { code: "no-key", headline: "Can't reach its model", detail: `The ${noKey[1]} provider has no key.`, provider: noKey[1], fixes: ["open-provider", "switch-model"], raw: text };
  }
  // "rate limit exceeded" is the provider slowing us down (retry), not a token budget being used up.
  if (/budget|quota|(?<!rate[ -]?)limit exceeded/i.test(text)) {
    return { code: "usage-limit", headline: "Paused by a usage limit", detail: "This provider's token limit was reached.", fixes: ["open-provider"], raw: text };
  }
  if (/rate.?limit|429/i.test(text)) {
    return { code: "rate-limit", headline: "The model is rate limiting", detail: "The provider asked us to slow down. Retrying usually works.", fixes: ["retry"], raw: text };
  }
  if (/clone|git|workspace/i.test(text)) {
    return { code: "workspace", headline: "Its working folder failed", detail: "The repository could not be prepared.", fixes: ["retry"], raw: text };
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

/**
 * Two failures with the same key have the same cause and one fix. A known provider cause groups by
 * its code and provider (a missing credential and a missing workload identity are different fixes).
 * Anything else groups only when the error text is the same: HTTP status, error class and message
 * all count. Only fields that change on every occurrence are masked: ids, timestamps, durations
 * and attempt counts.
 */
export function failureKey(s: Session): string {
  const text = String(s.error || "").trim();
  const e = describeError(text);
  if (e.provider && e.code) return `${e.code}:${e.provider}`;
  return `raw:${maskVolatile(text)}`;
}

export function maskVolatile(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
    .replace(/\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:z|[+-]\d{2}:?\d{2})?/g, "<time>")
    .replace(/\b\d{1,2}:\d{2}:\d{2}(?:\.\d+)?\b/g, "<time>")
    .replace(/\b\d+(?:\.\d+)?\s?(?:ms|msec|millis|seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/g, "<dur>")
    .replace(/\b\d+(?:\.\d+)?\s?s\b/g, "<dur>")
    .replace(/\bafter \d+ attempts?\b/g, "after <n> attempts")
    .replace(/\b(\w*id|\w*token|trace|span|session|request|run|turn)([\s:=#"']+)(?=[\w.-]*\d)[0-9a-z][\w.-]{5,}/g, "$1$2<id>")
    .replace(/\b[0-9a-f]{7,}\b/g, "<id>")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * One policy for every surface that answers a question (Home, Boards, chat): a choice whose
 * wording changes or removes something asks once more before it is sent.
 */
export const DESTRUCTIVE_CHOICE = /\b(roll\s?back|rollback|revert|delete|drop|force|kill|purge|reset|overwrite|wipe|destroy|discard|terminate|remove)\b/i;
export const isDestructiveChoice = (choice: string) => DESTRUCTIVE_CHOICE.test(choice);

/** The choice an agent marked as its default, if it marked one. Nothing is primary otherwise. */
export function recommendedChoice(question: PendingQuestion, choices: string[]): string | null {
  const mark = question.recommended ?? question.recommendedChoice ?? question.defaultChoice ?? question.default;
  if (typeof mark === "string") return choices.find((c) => c === mark) ?? null;
  if (typeof mark === "number") return choices[mark] ?? null;
  return null;
}

/** Identity of a question: session, iteration, wording and choices. A new one is a new key. */
export function questionKey(sessionId: string, q: PendingQuestion | null | undefined): string {
  if (!q) return `${sessionId}|none`;
  return `${sessionId}|${q.iteration ?? ""}|${q.question}|${(q.choices || []).join("\u001f")}`;
}
