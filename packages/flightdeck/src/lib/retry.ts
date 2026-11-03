import * as React from "react";
import { toast } from "sonner";
import { useRefresh, useSource } from "@/data/source";
import { newId } from "@/lib/utils";

/**
 * "Ask the agent to retry" with two guarantees: a second click while the first is in flight does
 * nothing (the guard is a ref, set synchronously, so a double click cannot slip through a render),
 * and an attempt keeps one client message id until it is known to have been delivered, so resending
 * after an uncertain failure cannot post the request twice.
 */
export function useRetry(sessionId: string, message: () => string, title?: string) {
  const { source } = useSource();
  const refresh = useRefresh();
  const inFlight = React.useRef(false);
  const attempt = React.useRef<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const retry = React.useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    attempt.current ||= newId();
    try {
      await source.sendMessage(sessionId, message(), { clientMessageId: attempt.current });
      attempt.current = null;
      refresh(sessionId);
      toast.success("Asked to retry", title ? { description: title } : undefined);
    } catch (e: any) {
      toast.error("Couldn't send the retry request", { description: e?.message });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [source, sessionId, message, refresh, title]);
  return { retry, busy };
}
