import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSource } from "@/data/source";
import type { DataSource } from "@/data/types";
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

/**
 * The mutation that mints (or rotates) the public link. The raw token is returned by the server exactly
 * once and must live nowhere but the component that shows it: it is handed to `onToken` and NEVER returned,
 * so it is not in the mutation's data; and gcTime 0 drops the mutation from TanStack's cache the moment
 * nothing observes it. Variables hold only the callback, not the token.
 */
export function mintLinkOptions(source: Pick<DataSource, "call">, sessionId: string, slot: number) {
  return {
    gcTime: 0,
    mutationFn: async (v: { onToken: (token: string) => void }) => {
      const r = await source.call("resetCanvasShareLink", { sessionId, slot });
      const token = typeof r?.token === "string" ? r.token : "";
      if (!token) throw new Error("The server didn't return a link.");
      v.onToken(token);
      return { minted: true as const };
    },
  };
}

export function useMintShareLink(sessionId: string, slot: number) {
  const { source } = useSource();
  const qc = useQueryClient();
  return useMutation({
    ...mintLinkOptions(source, sessionId, slot),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...key(sessionId, slot), "link"] }),
    onError: (e: any) => toast.error("Couldn't create the link", { description: e?.message }),
  });
}

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
