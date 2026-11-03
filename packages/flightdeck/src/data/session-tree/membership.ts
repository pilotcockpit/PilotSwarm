import type { Group, Session } from "@/data/types";
import { sessionState } from "@/data/state";
import { TERMINAL, type TreeIndex } from "./derive";

// The two rules the sidebar and the Projects page must agree on, written once: which project a session belongs to,
// and which sessions are still live.

/** A finished session: completed or cancelled. It leaves the sidebar and the default view of the Projects page. */
export const isFinished = (s: Session) => TERMINAL.has(sessionState(s).key);

const homeOf = (s: Session | undefined) => String(s?.groupId ?? (s as { viewerGroupId?: unknown } | undefined)?.viewerGroupId ?? "") || null;

/**
 * Which of the person's projects a session's tree is filed in. A sub-agent follows its root. A session filed in a
 * project that no longer exists, or in none, belongs to no project (null): that is the "No project" group.
 */
export function projectMembership(index: TreeIndex, groups: readonly Group[]) {
  const known = new Set(groups.map((g) => g.id));
  return {
    known,
    of(s: Session): string | null {
      const home = homeOf(index.byId.get(index.rootOf(s.sessionId)));
      return home && known.has(home) ? home : null;
    },
  };
}
