import { registerDemoOps } from "./registry";
import { createDemoGroup, deleteDemoGroup, demoGroupsWithCounts, placeDemoSessions, renameDemoGroup } from "../demo-groups";

registerDemoOps(import.meta.url, {
  listSessionGroups: () => demoGroupsWithCounts(),
  createSessionGroup: ({ input }) => createDemoGroup(String(input?.title || "")),
  updateSessionGroup: ({ groupId, patch }) => { renameDemoGroup(String(groupId), String(patch?.title || "")); return undefined; },
  deleteSessionGroup: ({ groupId }) => { deleteDemoGroup(String(groupId)); return undefined; },
  placeSessionsInGroup: ({ sessionIds, groupId }) => {
    placeDemoSessions(Array.isArray(sessionIds) ? sessionIds.map(String) : [], groupId == null ? null : String(groupId));
    return undefined;
  },
});
