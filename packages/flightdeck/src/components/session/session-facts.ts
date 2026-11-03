import type { Group, Session } from "@/data/types";
import { buildIndex, DEFAULT_PROJECT_NAME } from "@/data/session-tree";

export interface SessionFacts {
  /** The project this session's tree is filed in; "No project" when it is in none. Null until the person has any project. */
  project: { id: string | null; name: string } | null;
  /** The session this one was started by, when that session is in the list. */
  parent: { id: string; title: string } | null;
  /** Standard or a longer context window. */
  tier: string | null;
}

const groupOf = (s: Session | undefined) => String(s?.groupId ?? (s as { viewerGroupId?: unknown } | undefined)?.viewerGroupId ?? "") || null;

/** The facts the Context panel shows that come straight from the session list and the person's projects. */
export function sessionFacts(session: Session, all: readonly Session[], groups: readonly Group[]): SessionFacts {
  const index = buildIndex(all.some((s) => s.sessionId === session.sessionId) ? all : [...all, session]);
  const root = index.byId.get(index.rootOf(session.sessionId));
  const home = groupOf(root);
  const group = groups.find((g) => g.id === home);
  const parent = session.parentSessionId ? index.byId.get(session.parentSessionId) : undefined;
  const tier = typeof session.contextTier === "string" && session.contextTier.trim() ? session.contextTier.trim() : null;
  return {
    project: groups.length ? (group ? { id: group.id, name: group.name } : { id: null, name: DEFAULT_PROJECT_NAME }) : null,
    parent: parent ? { id: parent.sessionId, title: parent.title || "Untitled session" } : null,
    tier,
  };
}
