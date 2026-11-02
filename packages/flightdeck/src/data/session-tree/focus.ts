import type { Session } from "@/data/types";

/**
 * A sub-agent lives under its parent's Delegation, so it is not listed on its own. When its parent is not
 * in the list (deleted, hidden from this person, or not returned), nothing else leads to it: it is a root.
 */
export const isRoot = (s: Pick<Session, "parentSessionId">, present: ReadonlySet<string>) => !s.parentSessionId || !present.has(s.parentSessionId);

/**
 * Where keyboard focus goes when the focused row is no longer where it was. The same session if it is
 * still listed (it moved between sections); otherwise the row that took its place, or the one before it
 * when it was last; null when the list is now empty.
 */
export function focusAfterChange(prev: readonly string[], next: readonly string[], id: string): string | null {
  if (next.includes(id)) return id;
  if (!next.length) return null;
  const at = prev.indexOf(id);
  if (at < 0) return next[0];
  // The nearest later row that survives is the neighbour the person was just above; failing that, the nearest earlier one.
  for (let i = at + 1; i < prev.length; i++) if (next.includes(prev[i])) return prev[i];
  for (let i = at - 1; i >= 0; i--) if (next.includes(prev[i])) return prev[i];
  return next[Math.min(at, next.length - 1)];
}
