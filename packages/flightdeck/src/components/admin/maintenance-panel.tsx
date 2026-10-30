import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Eraser } from "lucide-react";
import { Panel } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Segmented } from "@/components/ui/tabs";
import { StatusRow } from "@/components/admin/status-row";
import { usePruneSummaries } from "@/data/ops/admin";
import { ago, plural } from "@/lib/utils";

/**
 * Admin > Maintenance: the housekeeping an admin can run by hand, each one saying what it does, what it
 * touches and whether it can be undone, and reporting what it did. Anything that deserves a longer
 * explanation lives with its subject (knowledge clean-up is on the Knowledge page); this page points there.
 */
export function Maintenance() {
  return (
    <Panel enter>
      <PruneSummaries />
      <StatusRow
        state="completed"
        title="Clean up deleted knowledge"
        detail="Removes facts that were deleted but not yet swept. It has its own page because it has options and a count first."
        action={<Button size="sm" asChild><Link to="/admin" search={{ tab: "knowledge" }}>Open Knowledge</Link></Button>}
      />
      <StatusRow
        state="completed"
        title="Restart a stuck system session"
        detail="Housekeeping agents are restarted from System sessions, where you can see which one failed and why."
        action={<Button size="sm" asChild><Link to="/admin" search={{ tab: "system" }}>Open System sessions</Link></Button>}
      />
    </Panel>
  );
}

function PruneSummaries() {
  const prune = usePruneSummaries();
  const [days, setDays] = React.useState("30");
  const [open, setOpen] = React.useState(false);
  const [last, setLast] = React.useState<{ count: number; days: number; at: number } | null>(null);
  return (
    <>
      <StatusRow
        state={last ? "running" : "completed"}
        title="Clear summaries of deleted sessions"
        detail={
          <>
            When a session is deleted, a short summary stays behind so lists and reports still make sense. This removes the summaries of sessions deleted longer ago than the period you pick. Only those summaries go: sessions, messages and files are not touched. This is permanent.
            {last ? <span className="mt-1 block text-fg">Last run: removed {plural(last.count, "summary", "summaries")} older than {last.days} days · {ago(last.at)}.</span> : null}
          </>
        }
        action={
          <>
            <Segmented label="Deleted longer ago than" value={days} onChange={setDays} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />
            <Button size="sm" onClick={() => setOpen(true)} disabled={prune.isPending}><Eraser /> Run</Button>
          </>
        }
      />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Clear old summaries?"
        description={`Removes the summaries of sessions deleted more than ${days} days ago.`}
        consequences={["Only the summaries are removed. Sessions, messages and files stay as they are.", "This can't be undone."]}
        confirmLabel="Clear summaries"
        tone="danger"
        onConfirm={async () => {
          const n = await prune.mutateAsync({ olderThanDays: Number(days) });
          setLast({ count: Number(n) || 0, days: Number(days), at: Date.now() });
        }}
      />
    </>
  );
}
