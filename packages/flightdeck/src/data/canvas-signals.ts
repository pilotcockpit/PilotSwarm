import * as React from "react";
import type { Artifact } from "@/data/types";
import { isCanvasFile } from "@/lib/canvas-files";

// "Canvas updated": the server's session rows do not say whether a canvas changed since this person looked (open item G20), so
// the browser works it out. It remembers, per person and data source, the time of the newest canvas it has shown each session
// to them, and a session is unseen when its newest canvas is later than that. A session met for the first time is taken as seen (a session with no canvas, as
// seen at none): nobody wants a dot on everything they already had, and everyone wants one on the first canvas that is new. The record is held in this browser (a person's other browsers keep their own).

const toTime = (v: unknown) => (typeof v === "number" ? v : new Date(String(v || 0)).getTime() || 0);

/** When the newest canvas in a session's outputs was written; 0 when there is none. */
export function latestCanvasTime(artifacts: readonly Artifact[] | undefined): number {
  let latest = 0;
  for (const a of artifacts || []) if (isCanvasFile(a.filename)) latest = Math.max(latest, toTime(a.updatedAt ?? a.createdAt));
  return latest;
}

/** Fold what was just read into what is known and what has been seen. Pure: returns the new records and the unseen ids. */
export function reconcile(known: Readonly<Record<string, number>>, seen: Readonly<Record<string, number>>, read: ReadonlyMap<string, number>) {
  const nextKnown = { ...known };
  const nextSeen = { ...seen };
  let changed = false;
  for (const [id, t] of read) {
    if (t > (nextKnown[id] ?? 0)) nextKnown[id] = t;
    // First sight: seen, whatever it holds. A session with no canvas is met at 0, so its first canvas is news.
    if (!(id in nextSeen)) { nextSeen[id] = t; changed = true; }
  }
  const unseen = new Set(Object.keys(nextKnown).filter((id) => nextKnown[id] > (nextSeen[id] ?? 0)));
  return { known: nextKnown, seen: nextSeen, unseen, changed };
}

type Records = Record<string, number>;
const state = { scope: null as string | null, known: {} as Records, seen: {} as Records, unseen: new Set<string>() };
const listeners = new Set<() => void>();
const key = (scope: string) => `fd.canvasSeen@${scope}`;
const emit = () => listeners.forEach((l) => l());

function load(scope: string): Records {
  try {
    const v = JSON.parse(localStorage.getItem(key(scope)) || "{}");
    const out: Records = {};
    if (v && typeof v === "object" && !Array.isArray(v)) for (const [k, n] of Object.entries(v)) if (typeof n === "number" && Number.isFinite(n)) out[k] = n;
    return out;
  } catch { return {}; }
}
function persist() {
  if (!state.scope) return;
  try {
    // Only the most recent few hundred: a person does not need the record of sessions they stopped using.
    const entries = Object.entries(state.seen).sort((a, b) => b[1] - a[1]).slice(0, 400);
    localStorage.setItem(key(state.scope), JSON.stringify(Object.fromEntries(entries)));
  } catch { /* storage unavailable: the dots then last for this page */ }
}

/** Point the store at a person and source (or at nobody, with null). */
export function setCanvasSeenScope(scope: string | null) {
  if (state.scope === scope) return;
  state.scope = scope;
  state.seen = scope ? load(scope) : {};
  state.known = {};
  state.unseen = new Set();
  emit();
}
export function useCanvasSeenScope(scope: string | null) {
  React.useEffect(() => { setCanvasSeenScope(scope); }, [scope]);
}

/** Report the newest canvas time per session, as read from the outputs lists. */
export function reportCanvasTimes(read: ReadonlyMap<string, number>) {
  if (!state.scope) return;
  const r = reconcile(state.known, state.seen, read);
  state.known = r.known;
  state.seen = r.seen;
  if (r.changed) persist();
  if (r.unseen.size !== state.unseen.size || [...r.unseen].some((id) => !state.unseen.has(id))) { state.unseen = r.unseen; emit(); }
}

/** The person has looked at this session's canvases as they are now (or as of `time`). */
export function markCanvasSeen(sessionId: string, time?: number) {
  if (!state.scope) return;
  const t = time ?? state.known[sessionId] ?? 0;
  if (t <= (state.seen[sessionId] ?? 0)) return;
  state.seen = { ...state.seen, [sessionId]: t };
  persist();
  const r = reconcile(state.known, state.seen, new Map());
  state.unseen = r.unseen;
  emit();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => state.unseen;
/** The sessions whose newest canvas this person has not looked at. */
export const useUnseenCanvases = () => React.useSyncExternalStore(subscribe, snapshot, snapshot);

/** For tests. */
export const canvasUnseenNow = () => new Set(state.unseen);
