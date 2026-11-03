import { normalizeSessionPause } from "@ps/state";
import type { Session } from "@/data/types";
import { describeError, maskVolatile, sessionState, type StateKey } from "@/data/state";
import { clock, toMs } from "@/lib/utils";

// One definition of "who needs you" and "what is under what", read by the sidebar and by /sessions so the
// two never disagree. Pure functions of the loaded sessions: no component filters rows or counts states
// on its own.

export type AttentionKind = "question" | "failed" | "hold";

export interface Attention {
  /** Identity of this occurrence. A dismissal remembers it; a new failing turn has a new key. */
  key: string;
  kind: AttentionKind;
  sessionId: string;
  /** The root of the tree it sits in, for the home project and the "Parent › Child" path. */
  rootId: string;
  title: string;
  /** Titles of the ancestors, root first, not including the session itself. */
  path: string[];
  /** Why, in a few words: the question, the failure headline, the hold. */
  reason: string;
  /** When it started waiting for you (the session's last update, the best the list rows carry). */
  since: number;
  /** Only failures can be dismissed; a question clears when answered and a hold when it lifts. */
  dismissible: boolean;
}

export interface Viewer {
  isAdmin: boolean;
}

export interface TreeIndex {
  byId: ReadonlyMap<string, Session>;
  childrenOf: ReadonlyMap<string, readonly Session[]>;
  /** Roots of everything loaded, system sessions included. A session whose parent is not loaded is a root. */
  roots: readonly Session[];
  rootOf(id: string): string;
  /** Ancestor ids, root first, not including the session itself. */
  ancestorsOf(id: string): string[];
}

const MAX_DEPTH = 8;

export const TERMINAL: ReadonlySet<StateKey> = new Set<StateKey>(["completed", "cancelled"]);

export function buildIndex(sessions: readonly Session[]): TreeIndex {
  const byId = new Map(sessions.map((s) => [s.sessionId, s] as const));
  const kids = new Map<string, Session[]>();
  for (const s of sessions) {
    if (s.parentSessionId && byId.has(s.parentSessionId)) {
      const list = kids.get(s.parentSessionId);
      if (list) list.push(s); else kids.set(s.parentSessionId, [s]);
    }
  }
  const parentOf = (id: string) => {
    const p = byId.get(id)?.parentSessionId;
    return p && byId.has(p) ? p : null;
  };
  const ancestorsOf = (id: string) => {
    const out: string[] = [];
    let at = parentOf(id);
    while (at && out.length < MAX_DEPTH && !out.includes(at) && at !== id) { out.unshift(at); at = parentOf(at); }
    return out;
  };
  return {
    byId,
    childrenOf: kids,
    roots: sessions.filter((s) => !parentOf(s.sessionId)),
    rootOf: (id) => ancestorsOf(id)[0] ?? id,
    ancestorsOf,
  };
}

/** Every session under `id`, any depth. */
export function descendantsOf(index: TreeIndex, id: string): Session[] {
  const out: Session[] = [];
  const seen = new Set([id]);
  const queue = [id];
  while (queue.length && out.length < 500) {
    for (const c of index.childrenOf.get(queue.shift()!) || []) {
      if (seen.has(c.sessionId)) continue;
      seen.add(c.sessionId);
      out.push(c);
      queue.push(c.sessionId);
    }
  }
  return out;
}

/** The viewer's own sessions. The list is already scoped to what they can see; an unknown owner counts as theirs. */
export const isMine = (s: Pick<Session, "owner">) => !s.owner || s.owner === "me";

/** A provider hold or limit the viewer can lift: an admin always can, anyone can for their own allowance or a missing provider. */
function canActOnHold(s: Session, viewer: Viewer): boolean {
  if (viewer.isAdmin) return true;
  const kind = normalizeSessionPause(s)?.kind;
  return kind === "allowance" || kind === "no_provider";
}

const oneLine = (text: string, max = 140) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Identity of a failure: the session, how many turns it had run, and the error with volatile parts masked. */
export const failureAttentionKey = (s: Session) => `fail:${s.sessionId}:${s.iterations ?? 0}:${hash(maskVolatile(String(s.error || "")))}`;

/** One line naming the hold and when it lifts: "anthropic on hold · resumes 14:20". */
export function holdReason(s: Session): string {
  const pause = normalizeSessionPause(s);
  if (!pause) return "On hold";
  const who = pause.provider || "The provider";
  const lifts = pause.resetsAtUtc ? `resumes ${clock(pause.resetsAtUtc)}` : "until someone lifts it";
  if (pause.kind === "no_provider") return "No provider you can use for its model";
  if (pause.kind === "hold") return `${who} on hold · ${lifts}`;
  const what = pause.kind === "allowance" ? `Your ${pause.period || ""} allowance on ${who} is used`.replace(/\s+/g, " ") : `${who} ${pause.period || ""} limit reached`.replace(/\s+/g, " ");
  return `${what} · ${lifts}`;
}

/** What, if anything, this session asks of the viewer. Null for sessions that are not theirs. */
export function attentionOf(s: Session, index: TreeIndex, viewer: Viewer): Attention | null {
  if (s.isSystem || !isMine(s)) return null;
  const st = sessionState(s);
  const base = { sessionId: s.sessionId, rootId: index.rootOf(s.sessionId), title: s.title || "Untitled session", path: index.ancestorsOf(s.sessionId).map((id) => index.byId.get(id)?.title || "Untitled session"), since: toMs(s.updatedAt) };
  if (st.key === "needs") {
    // List rows carry the question in waitReason; the full question (with choices) needs the session itself.
    const q = s.pendingQuestion?.question || (typeof s.waitReason === "string" ? s.waitReason : "");
    return { ...base, kind: "question", key: `ask:${s.sessionId}:${s.pendingQuestion?.iteration ?? s.iterations ?? 0}:${hash(q)}`, reason: q ? oneLine(q) : "Asked a question", dismissible: false };
  }
  if (st.key === "failed") {
    return { ...base, kind: "failed", key: failureAttentionKey(s), reason: describeError(s.error).headline, dismissible: true };
  }
  if (st.waitKind === "hold" && canActOnHold(s, viewer)) {
    const pause = normalizeSessionPause(s);
    return { ...base, kind: "hold", key: `hold:${s.sessionId}:${pause?.kind}:${pause?.provider ?? ""}`, reason: holdReason(s), dismissible: false };
  }
  return null;
}

const KIND_RANK: Record<AttentionKind, number> = { question: 0, hold: 1, failed: 2 };

/**
 * Everything asking for the viewer: questions first (an agent is blocked on you), then holds, then failures;
 * within a kind the longest wait first, so the order is steady and arrivals join the end of their kind.
 * A dismissed failure stays out until it fails again.
 */
export function attentionItems(index: TreeIndex, sessions: readonly Session[], viewer: Viewer, dismissed: ReadonlySet<string>): Attention[] {
  const out: Attention[] = [];
  for (const s of sessions) {
    const a = attentionOf(s, index, viewer);
    if (a && !(a.dismissible && dismissed.has(a.key))) out.push(a);
  }
  return out.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.since - b.since || a.sessionId.localeCompare(b.sessionId));
}

export interface Rollup { total: number; running: number; needs: number; failed: number }

/** What is going on under a session, for the sub-agent chip. */
export function rollup(index: TreeIndex, id: string): Rollup {
  const r: Rollup = { total: 0, running: 0, needs: 0, failed: 0 };
  for (const c of descendantsOf(index, id)) {
    r.total++;
    const k = sessionState(c).key;
    if (k === "running") r.running++;
    else if (k === "needs") r.needs++;
    else if (k === "failed") r.failed++;
  }
  return r;
}
