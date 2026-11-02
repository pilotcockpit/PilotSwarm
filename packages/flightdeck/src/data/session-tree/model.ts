import type { Group, Session } from "@/data/types";
import { toMs } from "@/lib/utils";
import { attentionItems, buildIndex, type Attention, type TreeIndex, type Viewer } from "./derive";
import { isFinished, projectMembership } from "./membership";

/** Rows the sidebar shows before it links out. Each is a cap on display, never on what exists. */
export const NEEDS_CAP = 5;
export const PROJECTS_CAP = 5;
export const PROJECT_PREVIEW = 5;
export const RECENT_PAGE = 12;

/**
 * The "No project" group: every root that is not in one of the person's projects. It is derived, never stored, so
 * it cannot be renamed or deleted; putting a session there is taking it out of its project. (The code calls it the
 * default project; people see "No project".)
 */
export const DEFAULT_PROJECT_ID = "__default";
export const DEFAULT_PROJECT_NAME = "No project";

export interface ProjectRow {
  group: Group;
  /** Live trees (non-system roots that are not completed or cancelled) filed in this project. */
  trees: Session[];
  /** Sessions in these trees, at any depth, that ask for the viewer. */
  attention: number;
}

export interface SidebarModel {
  index: TreeIndex;
  needs: { all: Attention[]; shown: Attention[]; hidden: number };
  pinned: Session[];
  /** Pinned projects (the No-project group included), in the order they were pinned. A pinned project that no longer exists is dropped. */
  pinnedProjects: ProjectRow[];
  /** The person's own projects, and the No-project group that holds everything else (null until they have a project). */
  projects: { all: ProjectRow[]; shown: ProjectRow[]; hidden: number; fallback: ProjectRow | null };
  /** The project each root is filed in (the No-project group for unfiled ones). Empty until the person has a project. */
  projectOf: ReadonlyMap<string, string>;
  /** Live roots not already shown above, most recently updated first. Settle this before drawing it. */
  recent: Session[];
  /** Roots that are completed or cancelled: they live behind the Completed lens, not in the sidebar. */
  completed: number;
  /** Live roots. */
  total: number;
}

const updated = (s: Session) => toMs(s.updatedAt);
const byUpdated = (a: Session, b: Session) => updated(b) - updated(a) || a.sessionId.localeCompare(b.sessionId);
const isTerminal = isFinished;

export function buildSidebarModel(o: {
  sessions: readonly Session[];
  groups: readonly Group[];
  /** Pinned session ids in the order the person set. */
  pins: readonly string[];
  /** Pinned project ids in the order the person set. */
  pinnedProjects?: readonly string[];
  /** Projects that must be listed even beyond the display cap: the one that is open, so what the person just opened or made is never hidden. */
  keep?: readonly string[];
  dismissed: ReadonlySet<string>;
  viewer: Viewer;
}): SidebarModel {
  const index = buildIndex(o.sessions);
  const member = projectMembership(index, o.groups);
  const userSessions = o.sessions.filter((s) => !s.isSystem);
  const roots = index.roots.filter((s) => !s.isSystem);
  const live = roots.filter((s) => !isTerminal(s));

  const all = attentionItems(index, userSessions, o.viewer, o.dismissed);
  const shown = all.slice(0, NEEDS_CAP);
  const shownIds = new Set(shown.map((a) => a.sessionId));

  const pinned = o.pins.map((id) => index.byId.get(id)).filter((s): s is Session => Boolean(s) && !s!.isSystem);
  const pinnedIds = new Set(pinned.map((s) => s.sessionId));

  const attentionByRoot = new Map<string, number>();
  for (const a of all) attentionByRoot.set(a.rootId, (attentionByRoot.get(a.rootId) || 0) + 1);
  const projectRows: ProjectRow[] = o.groups.map((group) => {
    const members = roots.filter((s) => member.of(s) === group.id);
    return {
      group,
      trees: members.filter((s) => !isTerminal(s)).sort(byUpdated),
      attention: members.reduce((n, s) => n + (attentionByRoot.get(s.sessionId) || 0), 0),
    };
  });

  // Everything not in one of the person's projects, including a session in a project that no longer exists.
  const loose = roots.filter((s) => member.of(s) === null);
  const fallback: ProjectRow | null = o.groups.length
    ? { group: { id: DEFAULT_PROJECT_ID, name: DEFAULT_PROJECT_NAME }, trees: loose.filter((s) => !isTerminal(s)).sort(byUpdated), attention: loose.reduce((n, s) => n + (attentionByRoot.get(s.sessionId) || 0), 0) }
    : null;

  const projectOf = new Map<string, string>();
  if (fallback) for (const s of roots) projectOf.set(s.sessionId, member.of(s) ?? DEFAULT_PROJECT_ID);

  const keep = new Set(o.keep || []);
  const shownProjects = projectRows.filter((p, i) => i < PROJECTS_CAP || keep.has(p.group.id));

  const recent = live.filter((s) => !pinnedIds.has(s.sessionId) && !shownIds.has(s.sessionId)).sort(byUpdated);

  return {
    index,
    needs: { all, shown, hidden: all.length - shown.length },
    pinned,
    // "No project" is a section of its own, not a project, so it is not pinned.
    pinnedProjects: (o.pinnedProjects || []).map((id) => projectRows.find((p) => p.group.id === id) ?? null).filter((p): p is ProjectRow => Boolean(p)),
    projects: { all: projectRows, shown: shownProjects, hidden: projectRows.length - shownProjects.length, fallback },
    projectOf,
    recent,
    completed: roots.length - live.length,
    total: live.length,
  };
}

// ── Settled order ────────────────────────────────────────────────────────
// A list that re-sorts while you reach for a row is a list you cannot trust. Recent keeps its order once
// drawn: a session that arrives goes to the top, one that leaves drops out, and one that merely updates
// stays where it is (its state still updates in place). The person decides when to re-sort.

export interface Settled { ids: string[] }

/** `live` is in live order (most recently updated first). `force` re-sorts everything. */
export function settleOrder(prev: Settled | null, live: readonly Session[], force = false): { settled: Settled; pending: number } {
  const liveIds = live.map((s) => s.sessionId);
  if (!prev || force) return { settled: { ids: liveIds }, pending: 0 };
  const present = new Set(liveIds);
  const known = new Set(prev.ids);
  const arrivals = liveIds.filter((id) => !known.has(id));
  const ids = [...arrivals, ...prev.ids.filter((id) => present.has(id))];
  // How many rows live order would lift above where they sit now.
  const liveOnly = liveIds.filter((id) => known.has(id));
  const settledOnly = ids.filter((id) => known.has(id));
  const pending = liveOnly.reduce((n, id, i) => n + (i < settledOnly.indexOf(id) ? 1 : 0), 0);
  return { settled: { ids }, pending };
}

/** Put `live` rows in settled order; rows the settled list does not know yet come first. */
export function inSettledOrder<T extends { sessionId: string }>(settled: Settled, live: readonly T[]): T[] {
  const at = new Map(settled.ids.map((id, i) => [id, i] as const));
  return [...live].sort((a, b) => (at.get(a.sessionId) ?? -1) - (at.get(b.sessionId) ?? -1));
}

export { isRoot, focusAfterChange } from "./focus";
