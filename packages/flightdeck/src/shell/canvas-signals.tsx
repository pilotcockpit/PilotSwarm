import * as React from "react";
import { useServerSessions } from "@/data/source";
import { useArtifactFeed } from "@/data/ops/artifact-feed";
import { latestCanvasTime, reportCanvasTimes, useCanvasSeenScope } from "@/data/canvas-signals";
import { usePrefsScope } from "@/components/sidebar/prefs";

/** How many of the most recently active sessions are watched for new canvases. */
const WATCHED = 20;

/**
 * Renders nothing. Reads the outputs of the sessions a person is most likely to be waiting on and tells the canvas-signal
 * store when each one's newest canvas was written, so "Canvas updated" works on a live server (open item G20). The lists it
 * reads are the ones Overview and Outputs use, so they share the cache.
 */
export function CanvasSignals() {
  const scope = usePrefsScope();
  useCanvasSeenScope(scope);
  const { data: sessions } = useServerSessions();
  const watched = React.useMemo(
    () => (scope ? (sessions || []).filter((s) => !s.isSystem).sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0)).slice(0, WATCHED) : []),
    [sessions, scope],
  );
  const results = useArtifactFeed(watched);
  const times = React.useMemo(() => new Map(watched.map((s, i) => [s.sessionId, latestCanvasTime(results[i]?.data)] as const)), [watched, results]);
  React.useEffect(() => { reportCanvasTimes(times); }, [times]);
  return null;
}
