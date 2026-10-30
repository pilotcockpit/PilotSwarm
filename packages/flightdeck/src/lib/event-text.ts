import { clock } from "@/lib/utils";

/** A raw durable event as a sentence an operator can scan: what happened, to what, how long. */
export interface EventLine {
  /** "Called kusto_query · 2.1s" */
  text: string;
  /** A quieter second part: a summary, a reason, an id. */
  detail?: string;
  tone: "neutral" | "ok" | "failed" | "wait";
}

const dur = (ms: unknown) => {
  const n = Number(ms) || 0;
  return n ? (n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s`) : "";
};

const clip = (v: unknown, n = 140) => {
  const t = typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export function describeEvent(type: string, data: Record<string, any> = {}): EventLine {
  const tool = data.toolName || data.name || data.tool;
  switch (type) {
    case "user.message": return { text: "You sent a message", detail: clip(data.content ?? data.text ?? data.prompt), tone: "neutral" };
    case "assistant.message": return { text: "The agent replied", detail: clip(data.content ?? data.text), tone: "neutral" };
    case "system.message": return { text: "System note", detail: clip(data.content ?? data.text), tone: "neutral" };
    case "tool.execution_start": return { text: `Calling ${tool || "a tool"}`, detail: clip(data.arguments ?? data.args), tone: "neutral" };
    case "tool.execution_complete": {
      const failed = data.success === false || data.error;
      const t = dur(data.durationMs);
      return { text: `${failed ? "Failed" : "Called"} ${tool || "a tool"}${t ? ` · ${t}` : ""}`, detail: failed ? clip(data.error?.message ?? data.error ?? data.result) : clip(data.result), tone: failed ? "failed" : "ok" };
    }
    case "session.agent_spawned": return { text: `Started sub-agent ${data.agentId || data.agentName || ""}`.trim(), detail: clip(data.task), tone: "neutral" };
    case "session.canvas_updated": return { text: `Drew canvas${data.slot ? ` ${data.slot}` : ""}`, detail: data.note ? clip(data.note) : data.rev ? `revision ${data.rev}` : undefined, tone: "neutral" };
    case "session.error": return { text: "Hit an error", detail: clip(data.message ?? data.error ?? data), tone: "failed" };
    case "session.wait_started": return { text: `Went to sleep${data.seconds ? ` for ${dur(Number(data.seconds) * 1000)}` : ""}`, detail: clip(data.reason), tone: "wait" };
    case "session.turn_started": return { text: "Started a turn", tone: "neutral" };
    case "session.turn_completed": return { text: "Finished a turn", tone: "ok" };
    case "session.turn_stopped": return { text: "Turn was stopped", tone: "wait" };
    case "session.answer_rejected": return { text: "Answer not sent: the question changed", detail: data.currentQuestion?.question ? `Now asking: ${clip(data.currentQuestion.question)}` : "No question is open now.", tone: "wait" };
    case "assistant.usage": {
      const inT = Number(data.inputTokens) || 0, outT = Number(data.outputTokens) || 0;
      return { text: "Model usage", detail: inT || outT ? `${inT.toLocaleString()} in · ${outT.toLocaleString()} out` : undefined, tone: "neutral" };
    }
  }
  const words = type.replace(/[._]/g, " ").replace(/\b\w/, (c) => c.toUpperCase());
  const failed = /error|fail/i.test(type);
  return { text: words, detail: Object.keys(data).length ? clip(data) : undefined, tone: failed ? "failed" : /wait|sleep|timer|cron|pause|affinity/i.test(type) ? "wait" : /complete|done/i.test(type) ? "ok" : "neutral" };
}

/** Readable labels for orchestration stats keys (historyEventCount → "History events"). */
const STAT_LABELS: Record<string, string> = {
  historyEventCount: "History events",
  historySizeBytes: "History size",
  queuePendingCount: "Messages queued",
  kvUserCount: "Stored values",
  kvSizeBytes: "Stored size",
};
export function statLabel(key: string) {
  if (STAT_LABELS[key]) return STAT_LABELS[key];
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_.]/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const eventTime = (at: unknown) => clock(at as any);
