import * as React from "react";

// Unsaved edits to workspace files, kept above the components that edit them. Leaving the file, the
// folder, the Files tab or the session unmounts the editor; the text must survive that and be there
// when the person comes back. Each draft remembers the file version (etag) and encoding it was started
// from, so saving later is checked against what was really edited, not against whatever is on disk now.

export interface Draft {
  sessionId: string;
  folderId: string;
  path: string;
  /** What is in the box now. */
  text: string;
  /** The text the edit started from. */
  baseText: string;
  /** The file version the edit started from: saves are checked against this, never against a refetch. */
  etag: string;
  bom: boolean;
  crlf: boolean;
}

const drafts = new Map<string, Draft>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => { version += 1; for (const l of listeners) l(); };

export const draftKey = (sessionId: string, folderId: string, path: string) => `${sessionId}\u0000${folderId}\u0000${path}`;
export const isDirty = (d: Draft) => d.text !== d.baseText;

export const getDraft = (key: string) => drafts.get(key);
export function setDraft(d: Draft) { drafts.set(draftKey(d.sessionId, d.folderId, d.path), d); emit(); }
export function clearDraft(key: string) { if (drafts.delete(key)) emit(); }
export function clearAllDrafts() { if (drafts.size) { drafts.clear(); emit(); } }

/** The drafts with real changes in them, for one session (and optionally one folder). */
export function dirtyDrafts(sessionId: string, folderId?: string): Draft[] {
  return [...drafts.values()].filter((d) => d.sessionId === sessionId && (folderId == null || d.folderId === folderId) && isDirty(d));
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Re-render when any draft changes; returns the dirty drafts for the session. */
export function useDirtyDrafts(sessionId: string, folderId?: string): Draft[] {
  const v = React.useSyncExternalStore(subscribe, () => version, () => 0);
  return React.useMemo(() => dirtyDrafts(sessionId, folderId), [sessionId, folderId, v]);
}
