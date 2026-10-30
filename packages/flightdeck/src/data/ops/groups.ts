import { useOpMutation, useOpQuery } from "./use-op";

// Session groups are the caller's own folders for session trees. The API rows are
// { groupId, title, memberCount, ... }; screens use { id, name }.

export interface GroupOption { id: string; name: string; count?: number }

const rows = (raw: unknown): any[] => (Array.isArray(raw) ? raw : Array.isArray((raw as any)?.groups) ? (raw as any).groups : []);

export function useGroupOptions(enabled = true) {
  return useOpQuery<GroupOption[]>(["groups", "options"], "listSessionGroups", undefined, {
    enabled,
    staleTime: 30_000,
    select: (raw) => rows(raw).map((g) => ({ id: String(g.groupId ?? g.id), name: String(g.title ?? g.name ?? "Untitled group"), count: typeof g.memberCount === "number" ? g.memberCount : undefined })),
  });
}

export function useCreateGroup() {
  return useOpMutation<{ title: string }, any>("createSessionGroup", {
    params: ({ title }) => ({ input: { title } }),
    invalidate: [["groups"]],
  });
}

/** groupId null puts the sessions back in the ungrouped list. */
export function usePlaceInGroup() {
  return useOpMutation<{ groupId: string | null; sessionIds: string[] }>("placeSessionsInGroup", {
    params: ({ groupId, sessionIds }) => ({ groupId, sessionIds }),
    invalidate: [["groups"], ["sessions"]],
  });
}
