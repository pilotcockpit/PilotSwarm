import { useOpMutation, useOpQuery } from "./use-op";

// Session groups are the caller's own folders for session trees. The API rows are
// { groupId, title, memberCount, ... }; screens use { id, name }.

export interface GroupOption { id: string; name: string; count?: number }

const rows = (raw: unknown): any[] => (Array.isArray(raw) ? raw : Array.isArray((raw as any)?.groups) ? (raw as any).groups : []);

export function useGroupOptions(enabled = true) {
  return useOpQuery<GroupOption[]>(["groups", "options"], "listSessionGroups", undefined, {
    enabled,
    staleTime: 30_000,
    select: (raw) => rows(raw).map((g) => ({ id: String(g.groupId ?? g.id), name: String(g.title ?? g.name ?? "Untitled project"), count: typeof g.memberCount === "number" ? g.memberCount : undefined })),
  });
}

export function useCreateGroup() {
  return useOpMutation<{ title: string }, any>("createSessionGroup", {
    params: ({ title }) => ({ input: { title } }),
    invalidate: [["groups"]],
  });
}

export function useRenameGroup() {
  return useOpMutation<{ groupId: string; title: string }>("updateSessionGroup", {
    params: ({ groupId, title }) => ({ groupId, patch: { title } }),
    invalidate: [["groups"]],
  });
}

/** Deleting a project clears the person's placements in it; the sessions themselves are untouched and fall back to No project. */
export function useDeleteGroup() {
  return useOpMutation<{ groupId: string }>("deleteSessionGroup", {
    params: ({ groupId }) => ({ groupId }),
    invalidate: [["groups"], ["sessions"]],
  });
}

/** groupId null puts the sessions back in the ungrouped list. */
export function usePlaceInGroup() {
  return useOpMutation<{ groupId: string | null; sessionIds: string[] }>("placeSessionsInGroup", {
    params: ({ groupId, sessionIds }) => ({ groupId, sessionIds }),
    invalidate: [["groups"], ["sessions"]],
  });
}
