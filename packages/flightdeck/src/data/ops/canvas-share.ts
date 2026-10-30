import { useOpMutation, useOpQuery } from "./use-op";

// Who can see and use one canvas: a public view link (one at a time), and who may write inside the app.

export type KvAccess = "owner" | "readers" | "link";

export interface ShareLinkInfo { exists: boolean; createdAt?: string; createdBy?: string }
export interface KvInfo { policy: KvAccess; me: { relation?: string; canWrite?: boolean } | null }

const key = (sessionId: string, slot: number) => ["canvas-share", sessionId, slot] as const;

export const useShareLink = (sessionId: string, slot: number, enabled = true) =>
  useOpQuery<ShareLinkInfo>([...key(sessionId, slot), "link"], "getCanvasShareLink", { sessionId, slot }, { enabled, staleTime: 0 });

export const useKvAccess = (sessionId: string, slot: number, enabled = true) =>
  useOpQuery<KvInfo>([...key(sessionId, slot), "kv"], "readCanvasKv", { sessionId, slot, limit: 1 }, {
    enabled,
    staleTime: 0,
    select: (raw) => ({ policy: (raw?.policy as KvAccess) || "owner", me: raw?.me ?? null }),
  });

/** Mint a link, or rotate the existing one: the old link stops working at once. The token is returned this one time only. */
export const useMintShareLink = (sessionId: string, slot: number) =>
  useOpMutation<void, { token: string }>("resetCanvasShareLink", {
    params: () => ({ sessionId, slot }),
    invalidate: [[...key(sessionId, slot), "link"]],
    failure: "Couldn't create the link",
  });

export const useRemoveShareLink = (sessionId: string, slot: number) =>
  useOpMutation<void, unknown>("removeCanvasShareLink", {
    params: () => ({ sessionId, slot }),
    invalidate: [[...key(sessionId, slot), "link"]],
    success: "Public link removed",
    failure: "Couldn't remove the link",
  });

export const useSetKvAccess = (sessionId: string, slot: number) =>
  useOpMutation<KvAccess, unknown>("setCanvasKvAccess", {
    params: (access) => ({ sessionId, slot, access }),
    invalidate: [[...key(sessionId, slot), "kv"]],
    failure: "Couldn't change who can edit",
  });
