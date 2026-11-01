import type { Group, Session } from "@/data/types";
import { needsYou, sessionState, type StateKey } from "@/data/state";
import type { GroupBy } from "./prefs";

export interface Section {
  key: string;
  title: string;
  kind: "needs" | "pinned" | "group" | "agent" | "recent";
  groupId?: string;
  sessions: Session[];
}

export const RECENT_PAGE = 12;

const byUpdated = (a: Session, b: Session) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0);
const groupOf = (s: Session) => String(s.groupId ?? (s as any).viewerGroupId ?? "") || null;

/** Does this session belong under a state filter? Completed also covers cancelled. */
export function matchesStateFilter(s: Session, state: StateKey | null): boolean {
  if (!state) return true;
  const k = sessionState(s).key;
  return state === "completed" ? k === "completed" || k === "cancelled" : k === state;
}

/**
 * The sessions list in the sidebar, as sections. Each session appears once, in the first place that
 * claims it: Needs you, then Pinned, then its group (or agent), then Recent. Sub-agents are not listed
 * (they live under their parent's Delegation) unless one needs you. Empty sections are dropped while a
 * filter is on; with no filter every group stays so it can be a target for a new session.
 */
export function buildSections(o: { sessions: Session[]; groups: Group[]; pinned: ReadonlySet<string>; groupBy: GroupBy; state: StateKey | null; showSystem: boolean }): Section[] {
  const visible = o.sessions.filter((s) => (o.showSystem || !s.isSystem) && matchesStateFilter(s, o.state));
  const taken = new Set<string>();
  const take = (list: Session[]) => { for (const s of list) taken.add(s.sessionId); return list; };
  const sections: Section[] = [];

  const needs = take(visible.filter((s) => needsYou(s)).sort(byUpdated));
  if (needs.length) sections.push({ key: "needs", title: "Needs you", kind: "needs", sessions: needs });

  const roots = visible.filter((s) => !taken.has(s.sessionId) && !s.parentSessionId).sort(byUpdated);
  const pinned = take(roots.filter((s) => o.pinned.has(s.sessionId)));
  if (pinned.length) sections.push({ key: "pinned", title: "Pinned", kind: "pinned", sessions: pinned });

  const rest = roots.filter((s) => !taken.has(s.sessionId));
  if (o.groupBy === "agent") {
    const agents = [...new Set(rest.map((s) => s.agentId || "generic"))].sort();
    for (const agent of agents) sections.push({ key: `agent:${agent}`, title: agent, kind: "agent", sessions: take(rest.filter((s) => (s.agentId || "generic") === agent)) });
    return sections;
  }
  const known = new Set(o.groups.map((g) => g.id));
  for (const g of o.groups) {
    const members = take(rest.filter((s) => groupOf(s) === g.id));
    if (members.length || !o.state) sections.push({ key: `group:${g.id}`, title: g.name, kind: "group", groupId: g.id, sessions: members });
  }
  const recent = rest.filter((s) => !taken.has(s.sessionId) && !(groupOf(s) && known.has(groupOf(s)!)));
  if (recent.length) sections.push({ key: "recent", title: "Recent", kind: "recent", sessions: recent });
  return sections;
}

/** The sessions as the keyboard sees them: every visible row, in order, honouring collapsed sections. */
export function visibleRowIds(sections: Section[], collapsed: Record<string, boolean>, recentShown: number): string[] {
  const ids: string[] = [];
  for (const sec of sections) {
    if (collapsed[sec.key] && sec.kind !== "needs") continue;
    const list = sec.kind === "recent" ? sec.sessions.slice(0, recentShown) : sec.sessions;
    for (const s of list) ids.push(s.sessionId);
  }
  return ids;
}
