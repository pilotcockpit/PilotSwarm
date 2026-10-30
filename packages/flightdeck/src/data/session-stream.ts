import type { SessionEvent } from "./types";

/** What the stream needs from the API client: a subscription that reports reconnects, and plain calls. */
export interface SessionStreamApi {
  subscribeSession(sessionId: string, handler: (message: any) => void, onResubscribe?: () => void): () => void;
  call(name: string, params: Record<string, unknown>): Promise<any>;
}

const asList = <T,>(v: any): T[] => (Array.isArray(v) ? v : Array.isArray(v?.events) ? v.events : Array.isArray(v?.items) ? v.items : []);

/**
 * A session's live events, with the gap after a reconnect filled in.
 *
 * The socket only delivers what happens while it is open, so an event recorded during an outage
 * (a `session.answer_rejected`, a question, a failure) would never arrive. On every resubscribe we
 * ask for what came after the last event seen and deliver it in order, once. Before any live event
 * has been seen there is no cursor, so we read the newest few: consumers de-duplicate by sequence,
 * and the answer-rejection notice ignores anything old.
 */
export function subscribeToSession(api: SessionStreamApi, sessionId: string, onEvent: (e: SessionEvent) => void): () => void {
  let lastSeq = 0;
  let closed = false;
  const deliver = (event: SessionEvent) => {
    if (closed || !event?.eventType) return;
    const seq = Number(event.seq) || 0;
    if (seq && seq <= lastSeq) return;
    if (seq > lastSeq) lastSeq = seq;
    onEvent(event);
  };
  const catchUp = async () => {
    try {
      const rows = lastSeq
        ? asList<SessionEvent>(await api.call("getSessionEvents", { sessionId, afterSeq: lastSeq, limit: 200 }))
        : asList<SessionEvent>(await api.call("getSessionEventsBefore", { sessionId, beforeSeq: Number.MAX_SAFE_INTEGER, limit: 50 }));
      for (const e of rows.slice().sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0))) deliver(e);
    } catch {
      // The next reconnect or the next poll catches up; a failed read must not break the live stream.
    }
  };
  const off = api.subscribeSession(
    sessionId,
    (message: any) => deliver((message?.event || message) as SessionEvent),
    () => { void catchUp(); },
  );
  return () => { closed = true; off(); };
}
