import * as React from "react";
import { CalendarClock, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { useRefresh, useSource } from "@/data/source";
import type { Session } from "@/data/types";
import { sessionIsViewOnly } from "@/lib/session-access";
import { newId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";

// A schedule belongs to the agent: it sets, changes and ends its own cron or timer from inside a
// turn. The Web API has no "pause schedule" or "wake now" operation, so these controls are honest
// about it: they ask the agent, in plain words, and say so. (Missing operation: a session command
// that pauses, resumes or fires a cron from outside the turn.)
const RUN_NOW = "Please run your scheduled work now, then carry on with your normal schedule.";
const PAUSE = "Please pause your schedule until I ask you to resume it, and confirm once it is paused.";

export function ScheduleActions({ session }: { session: Session }) {
  const { source } = useSource();
  const refresh = useRefresh();
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "run" | "pause">(null);
  const inFlight = React.useRef(false);
  const blocked = sessionIsViewOnly(session);
  const ask = async (kind: "run" | "pause") => {
    if (inFlight.current || blocked) return;
    inFlight.current = true;
    setBusy(kind);
    try {
      await source.sendMessage(session.sessionId, kind === "run" ? RUN_NOW : PAUSE, { clientMessageId: newId() });
      refresh(session.sessionId);
      toast.success(kind === "run" ? "Asked it to run now" : "Asked it to pause the schedule", { description: "Its answer appears in the chat." });
    } catch (e: any) {
      toast.error("Couldn't send that", { description: e?.message });
      throw e;
    } finally { inFlight.current = false; setBusy(null); }
  };
  if (blocked) return <p className="mt-3 text-xs text-muted">Only people who can reply can change when this runs.</p>;
  return (
    <div className="mt-3 border-t border-line-subtle pt-3">
      <p className="mb-2 flex items-start gap-1.5 text-xs text-muted"><CalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> The agent owns its schedule, so these ask it in the chat.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy != null} onClick={() => void ask("run").catch(() => undefined)}><PlayCircle /> {busy === "run" ? "Asking…" : "Run it now"}</Button>
        <Button size="sm" disabled={busy != null} onClick={() => setConfirm(true)}><PauseCircle /> Pause schedule</Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Ask the agent to pause its schedule?"
        description={`“${session.title}” will stop its scheduled runs once it agrees.`}
        consequences={["Nothing runs on its own until you ask it to resume.", "Check the chat for its confirmation: it decides how to pause."]}
        confirmLabel="Ask it to pause"
        onConfirm={() => ask("pause")}
      />
    </div>
  );
}
