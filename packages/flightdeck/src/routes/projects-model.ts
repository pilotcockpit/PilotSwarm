import type { Group, Session } from "@/data/types";
import { sessionState } from "@/data/state";
import { buildIndex, DEFAULT_PROJECT_ID, isFinished, projectMembership } from "@/data/session-tree";
import { matchesSessionOwner } from "@/lib/session-access";

// What the Projects page lists. One pass over the sessions and the person's projects, pure so the rules can be tested:
// search finds projects (by name) and sessions (by title, agent or id); filters narrow sessions; a project with
// nothing in it still shows when nothing is being filtered, because this is where projects are managed.

export type PageSort = "activity" | "created" | "title";

export interface PageQuery {
  who: string;
  state?: string;
  /** A project id, or DEFAULT_PROJECT_ID for the sessions in none. */
  project?: string;
  agent: string | null;
  /** Lower-cased search text, trimmed. */
  q: string;
  sort: PageSort;
  /** Sessions that ask for the viewer (the shared derivation). */
  attention: ReadonlySet<string>;
  /** Pinned session ids in pin order. */
  pins: readonly string[];
}

export interface ProjectGroup { group: Group; rows: Session[]; /** The search matched this project's name. */ nameMatch: boolean }

export function matchesState(s: Session, f: string | undefined, attention?: ReadonlySet<string>) {
  if (!f || f === "any") return true;
  if (f === "attention") return Boolean(attention?.has(s.sessionId));
  const st = sessionState(s);
  if (f === "scheduled") return st.waitKind === "schedule";
  if (f === "closed") return st.key === "completed" || st.key === "cancelled";
  return st.key === f;
}

export function buildProjectsPage(sessions: readonly Session[], groups: readonly Group[], query: PageQuery) {
  const index = buildIndex(sessions);
  // Which project a session is in, and which sessions are finished, are decided by the same functions the sidebar uses.
  const member = projectMembership(index, groups);
  const projectOf = member.of;
  const nameMatches = new Set(query.q ? groups.filter((g) => g.name.toLowerCase().includes(query.q)).map((g) => g.id) : []);

  const filtered = sessions.filter((s) => {
    if (!matchesSessionOwner(s, query.who)) return false;
    if (!matchesState(s, query.state, query.attention)) return false;
    if (query.project && (projectOf(s) ?? DEFAULT_PROJECT_ID) !== query.project) return false;
    if (query.agent && (s.agentId || "generic") !== query.agent) return false;
    if (query.q) {
      const home = projectOf(s);
      const text = `${s.title} ${s.agentId} ${s.sessionId}`.toLowerCase().includes(query.q);
      if (!text && !(home && nameMatches.has(home))) return false;
    }
    return true;
  });
  const ids = new Set(filtered.map((s) => s.sessionId));
  const childrenOf = new Map<string, Session[]>();
  for (const s of sessions) if (s.parentSessionId) childrenOf.set(s.parentSessionId, [...(childrenOf.get(s.parentSessionId) || []), s]);
  const cmp = (a: Session, b: Session) =>
    query.sort === "title" ? String(a.title).localeCompare(String(b.title)) : query.sort === "created" ? (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0) : (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0);
  // A child shows under its parent when the parent is listed; otherwise at top level so filters never hide it.
  const roots = filtered.filter((s) => !s.parentSessionId || !ids.has(s.parentSessionId)).sort(cmp);
  const regularAll = roots.filter((s) => !s.isSystem);
  // Finished work leaves the list, as it leaves the sidebar, unless it was asked for (the Completed filter) or searched for.
  const showFinished = Boolean(query.state) || Boolean(query.q);
  const regular = showFinished ? regularAll : regularAll.filter((s) => !isFinished(s));

  const filtering = Boolean(query.q || query.state || query.agent || query.project || query.who !== "all");
  const pinned = new Set(query.pins);
  const projects: ProjectGroup[] = groups
    .map((group) => ({ group, rows: regular.filter((s) => projectOf(s) === group.id), nameMatch: nameMatches.has(group.id) }))
    // Nothing filtered: every project, empty ones too. Filtered: the projects with something to show, the one asked for, and any whose name matched.
    .filter((p) => !filtering || p.rows.length > 0 || p.nameMatch || query.project === p.group.id);
  const rest = regular.filter((s) => !projectOf(s));
  return {
    // A pin is a watchlist, not a move: a pinned session is listed here and still under its project, as in the sidebar.
    // Any session can be pinned, a sub-agent too, so this reads the whole filtered list, not just the roots.
    pinned: filtered.filter((s) => !s.isSystem && pinned.has(s.sessionId) && (showFinished || !isFinished(s))).sort((a, b) => query.pins.indexOf(a.sessionId) - query.pins.indexOf(b.sessionId)),
    projects,
    rest,
    system: roots.filter((s) => s.isSystem),
    childrenOf: (id: string) => (childrenOf.get(id) || []).filter((c) => ids.has(c.sessionId)).sort(cmp),
    /** Every session that passed the filters, sub-agents included. */
    matches: filtered.filter((s) => !s.isSystem),
    count: regular.length,
    /** Completed or cancelled roots left out of the lists, so the page can say so. */
    finishedHidden: regularAll.length - regular.length,
    filtering,
    /** Projects that matched the search by name, for saying what was found. */
    matchedProjects: projects.filter((p) => p.nameMatch).length,
  };
}
