import { toast } from "sonner";
import type { SessionEvent } from "@/data/types";
import { toMs } from "@/lib/utils";

export const ANSWER_REJECTED = "session.answer_rejected";

const announced = new Set<string>();
// An event older than this was already history when the page opened, not news.
const FRESH_MS = 2 * 60_000;

/**
 * The orchestration refuses a stale bound answer and says so with `session.answer_rejected`.
 * Tell the person once, wherever the event is first seen (the transcript stream or the control
 * that sent the answer). Returns true when this call showed the notice.
 */
export function announceAnswerRejected(sessionId: string, event: Pick<SessionEvent, "eventType" | "seq" | "createdAt">): boolean {
  if (event.eventType !== ANSWER_REJECTED) return false;
  const at = toMs(event.createdAt as any);
  if (at && Date.now() - at > FRESH_MS) return false;
  const key = `${sessionId}:${event.seq ?? at}`;
  if (announced.has(key)) return false;
  announced.add(key);
  toast.error("Your answer wasn't sent because the question changed. Review it and answer again.");
  return true;
}
