import type { SessionEvent } from "./types";

/** What the stream needs from the API client: a subscription that reports reconnects, and plain calls. */
export interface SessionStreamApi {
  subscribeSession(sessionId: string, handler: (message: any) => void, onResubscribe?: () => void): () => void;
  call(name: string, params: Record<string, unknown>): Promise<any>;
}

const PAGE = 200;
const NEWEST = 50;
const RETRY_MS = 2_000;
const asList = <T,>(v: any): T[] => (Array.isArray(v) ? v : Array.isArray(v?.events) ? v.events : Array.isArray(v?.items) ? v.items : []);
const seqOf = (e: SessionEvent) => Number(e?.seq) || 0;

/**
 * A session's live events, with the gap after a reconnect filled in, in order and without loss.
 *
 * The socket only delivers what happens while it is open, so an event recorded during an outage
 * (a `session.answer_rejected`, a question, a failure) would never arrive on its own. Consumers
 * also drop any event whose sequence is not above the last one they saw, so order matters.
 *
 * - After a resubscribe the stream is "behind": live arrivals are held, and the events after the
 *   replay cursor are read, page by page, until a short page says nothing is left.
 * - When the read completes, what was fetched and what was held are merged by sequence,
 *   de-duplicated, delivered in order, and only then does the cursor advance.
 * - If the read fails the cursor stays where it was, the held events stay held, and the read is
 *   retried on the next live event, the next resubscribe, or after a short delay. A gap is never
 *   skipped.
 * - Before any event has been seen there is no cursor, so a catch-up reads the newest few; consumers
 *   de-duplicate by sequence and the rejection notice ignores anything old.
 */
export function subscribeToSession(api: SessionStreamApi, sessionId: string, onEvent: (e: SessionEvent) => void): () => void {
  let cursor = 0;
  let behind = false;
  let reading = false;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | null = null;
  const held = new Map<number, SessionEvent>();
  const seen = new Set<number>();

  const deliver = (event: SessionEvent) => {
    const seq = seqOf(event);
    if (seq) {
      if (seen.has(seq)) return;
      seen.add(seq);
    }
    onEvent(event);
  };

  const readGap = async (): Promise<SessionEvent[]> => {
    if (!cursor) return asList<SessionEvent>(await api.call("getSessionEventsBefore", { sessionId, beforeSeq: Number.MAX_SAFE_INTEGER, limit: NEWEST }));
    const out: SessionEvent[] = [];
    let after = cursor;
    for (;;) {
      const page = asList<SessionEvent>(await api.call("getSessionEvents", { sessionId, afterSeq: after, limit: PAGE }));
      out.push(...page);
      const top = page.reduce((m, e) => Math.max(m, seqOf(e)), after);
      // A short page (or one that moved nothing) means the end of the history.
      if (page.length < PAGE || top <= after) return out;
      after = top;
    }
  };

  const catchUp = async () => {
    if (reading || closed || !behind) return;
    reading = true;
    try {
      const fetched = await readGap();
      if (closed) return;
      const merged = new Map<number, SessionEvent>();
      let unnumbered: SessionEvent[] = [];
      for (const e of [...fetched, ...held.values()]) {
        const s = seqOf(e);
        if (s) merged.set(s, e);
        else unnumbered = [...unnumbered, e];
      }
      const ordered = [...merged.entries()].sort((a, b) => a[0] - b[0]).map(([, e]) => e);
      for (const e of ordered) deliver(e);
      for (const e of unnumbered) deliver(e);
      cursor = ordered.reduce((m, e) => Math.max(m, seqOf(e)), cursor);
      held.clear();
      behind = false;
    } catch {
      // Keep the cursor and what is held. Try again on the next arrival or after a pause.
      if (!closed && !retry) retry = setTimeout(() => { retry = null; void catchUp(); }, RETRY_MS);
    } finally {
      reading = false;
    }
  };

  const onLive = (message: any) => {
    const event = (message?.event || message) as SessionEvent;
    if (closed || !event?.eventType) return;
    const seq = seqOf(event);
    if (behind) {
      if (seq) held.set(seq, event); else deliver(event);
      void catchUp();
      return;
    }
    deliver(event);
    if (seq > cursor) cursor = seq;
  };

  const off = api.subscribeSession(sessionId, onLive, () => {
    behind = true;
    void catchUp();
  });
  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    off();
  };
}
