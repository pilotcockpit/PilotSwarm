import { registerDemoOps } from "./registry";
import { createDemoGroup, demoGroupsWithCounts, placeDemoSessions } from "../demo-groups";

registerDemoOps(import.meta.url, {
  listSessionGroups: () => demoGroupsWithCounts(),
  createSessionGroup: ({ input }) => createDemoGroup(String(input?.title || "")),
  placeSessionsInGroup: ({ sessionIds, groupId }) => {
    placeDemoSessions(Array.isArray(sessionIds) ? sessionIds.map(String) : [], groupId == null ? null : String(groupId));
    return undefined;
  },
});
