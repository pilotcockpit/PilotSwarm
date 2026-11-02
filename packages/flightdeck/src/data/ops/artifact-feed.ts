import * as React from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useSource } from "@/data/source";
import type { Artifact, Session } from "@/data/types";

/**
 * The outputs list of each of these sessions, one query per session (shared by everything that reads them). Nothing polls
 * them: a session whose activity moved (the session list is polled) may have written something, so only its list is read
 * again. A new output shows within one poll without every session being asked every few seconds.
 */
export function useArtifactFeed(sessions: readonly Session[]) {
  const { source } = useSource();
  const client = useQueryClient();
  const results = useQueries({
    queries: sessions.map((s) => ({ queryKey: ["artifacts", s.sessionId], queryFn: (): Promise<Artifact[]> => source.listArtifacts(s.sessionId), staleTime: 10_000 })),
  });
  const activity = React.useRef(new Map<string, unknown>());
  React.useEffect(() => {
    for (const s of sessions) {
      const before = activity.current.get(s.sessionId);
      activity.current.set(s.sessionId, s.updatedAt);
      if (before !== undefined && before !== s.updatedAt) void client.invalidateQueries({ queryKey: ["artifacts", s.sessionId] });
    }
  }, [sessions, client]);
  return results;
}
