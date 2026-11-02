// Demo-only group state shared by the typed demo source (which lists sessions and groups) and the
// group operations in ops/groups.demo.ts (which create groups and move sessions). One store, so a
// move made in the Move-to-group dialog shows in the Sessions list.

interface Row { sessionId: string; groupId?: string | null }

export const demoGroupList: Array<{ groupId: string; title: string }> = [
  { groupId: "g-release", title: "Release 0.8.8" },
  { groupId: "g-ops", title: "Ops" },
  { groupId: "g-research", title: "Research" },
  { groupId: "g-docs", title: "Docs" },
  { groupId: "g-experiments", title: "Experiments" },
  { groupId: "g-personal", title: "Personal" },
  { groupId: "g-infra", title: "Infra" },
];

const placements = new Map<string, string | null>();
let rows: () => Row[] = () => [];

/** The demo source says where its sessions live, so member counts can be counted. */
export function setDemoSessionRows(read: () => Row[]) { rows = read; }

export function effectiveGroupId(row: Row): string | null {
  return placements.has(row.sessionId) ? placements.get(row.sessionId)! : row.groupId ?? null;
}

export function demoGroupsWithCounts() {
  const all = rows();
  return demoGroupList.map((g) => ({ ...g, memberCount: all.filter((r) => effectiveGroupId(r) === g.groupId).length }));
}

export function createDemoGroup(title: string) {
  const g = { groupId: `g-${Math.random().toString(36).slice(2, 8)}`, title: title.trim() || "New project" };
  demoGroupList.push(g);
  return { ...g, memberCount: 0 };
}

export function renameDemoGroup(groupId: string, title: string) {
  const g = demoGroupList.find((x) => x.groupId === groupId);
  if (g) g.title = title.trim() || g.title;
}

export function deleteDemoGroup(groupId: string) {
  const at = demoGroupList.findIndex((x) => x.groupId === groupId);
  if (at >= 0) demoGroupList.splice(at, 1);
  for (const [id, to] of placements) if (to === groupId) placements.delete(id);
  // A session the fixtures filed in it, and any moved into it, fall back to no project.
  for (const r of rows()) if (r.groupId === groupId && !placements.has(r.sessionId)) placements.set(r.sessionId, null);
}

export function placeDemoSessions(sessionIds: string[], groupId: string | null) {
  for (const id of sessionIds) placements.set(id, groupId);
}
