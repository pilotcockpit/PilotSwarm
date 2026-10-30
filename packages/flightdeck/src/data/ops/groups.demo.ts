import { registerDemoOps } from "./registry";

const groups = [
  { groupId: "g-release", title: "Release 0.8.8", memberCount: 2 },
  { groupId: "g-ops", title: "Ops", memberCount: 3 },
];

registerDemoOps({
  listSessionGroups: () => groups.map((g) => ({ ...g })),
  createSessionGroup: ({ input }) => {
    const g = { groupId: `g-${Math.random().toString(36).slice(2, 8)}`, title: String(input?.title || "New group").trim(), memberCount: 0 };
    groups.push(g);
    return { ...g };
  },
  placeSessionsInGroup: () => undefined,
});
