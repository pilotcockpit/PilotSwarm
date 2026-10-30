import * as React from "react";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, Panel } from "@/components/empty";
import { StateLine } from "@/components/state";
import { Button, DisclosureButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/misc";
import { RadioCard, RadioCards } from "@/components/ui/radio";
import { TypedConfirmDialog } from "@/components/admin/typed-confirm";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Loader2 } from "lucide-react";
import { cardVariants } from "@/components/ui/card";
import { RESTART_MODES, restartOutcome, useRestartSystemSession, type Disposition } from "@/data/ops/admin";
import { useSessions } from "@/data/source";
import { describeError, sessionState } from "@/data/state";
import type { Session } from "@/data/types";
import { ago, cn, plural } from "@/lib/utils";

/**
 * Admin > System sessions. The agents that keep the platform tidy, with the one thing an admin comes here
 * to do: restart one that is stuck. The restart dialog explains each way in plain words, starts on the
 * gentlest, and tells you what happened. Several failures at once get a single gentle "restart all".
 */
export function SystemSessions() {
  const { data: sessions, isLoading } = useSessions();
  const [restarting, setRestarting] = React.useState<Session | null>(null);
  const [all, setAll] = React.useState(false);
  const restart = useRestartSystemSession();
  const system = (sessions || []).filter((s) => s.isSystem);
  const failed = system.filter((s) => sessionState(s).key === "failed");
  const causes = new Set(failed.map((s) => describeError(s.error).headline));

  const restartFailed = async () => {
    let restarted = 0;
    let skipped = 0;
    for (const s of failed) {
      const r = await restart.mutateAsync({ agentIdOrSessionId: s.agentId || s.sessionId, disposition: "complete" });
      if (r?.skippedReason) skipped += 1; else restarted += 1;
    }
    toast(`Restarted ${plural(restarted, "system session")}${skipped ? `; ${skipped} skipped because ${skipped === 1 ? "it was" : "they were"} busy or finished` : ""}.`);
  };

  if (isLoading) return null;
  return (
    <>
      {failed.length ? (
        <div role="alert" className={cn(cardVariants({ tone: "failed", enter: true }), "mb-4 flex flex-wrap items-center gap-3 p-3 text-sm")}>
          <div className="min-w-0 flex-1 basis-60">
            <p className="font-semibold">{failed.length} of {system.length} system sessions failed{causes.size === 1 ? " for the same reason" : ""}.</p>
            <p className="mt-0.5 text-fg/85">{describeError(failed[0].error).detail || describeError(failed[0].error).headline}</p>
          </div>
          {failed.length > 1 ? <Button onClick={() => setAll(true)}><RotateCcw /> Restart all {failed.length}</Button> : null}
        </div>
      ) : null}
      <Panel enter>
        {system.length ? system.map((s) => (
          <div key={s.sessionId} className="flex items-center gap-2 border-t border-line-subtle first:border-t-0">
            <Link to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="focus-inset flex min-h-13 min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-2 transition-colors duration-(--duration-fast) hover:bg-raised/70">
              <span className="truncate text-sm font-medium">{s.title}</span>
              <span className="flex min-w-0 items-center gap-2"><StateLine session={s} /><span className="shrink-0 text-xs text-faint">{ago(s.updatedAt)}</span></span>
            </Link>
            <Menu>
              <MenuTrigger asChild><Button variant="quiet" size="icon-sm" className="mr-2" aria-label={`Actions for ${s.title}`}><MoreHorizontal /></Button></MenuTrigger>
              <MenuContent>
                <MenuItem icon={<RotateCcw />} onSelect={() => setRestarting(s)}>Restart…</MenuItem>
              </MenuContent>
            </Menu>
          </div>
        )) : <EmptyState title="No system sessions">Housekeeping agents appear here once a worker loads them.</EmptyState>}
      </Panel>
      {restarting ? <RestartDialog session={restarting} onClose={() => setRestarting(null)} /> : null}
      <ConfirmDialog
        open={all}
        onOpenChange={setAll}
        title={`Restart ${failed.length} failed system sessions?`}
        description="Each one finishes what it is doing, then starts fresh."
        consequences={["Nothing is deleted and no history is lost.", "A session that is busy or already finished is skipped."]}
        confirmLabel={`Restart ${failed.length}`}
        onConfirm={restartFailed}
      />
    </>
  );
}

function RestartDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const restart = useRestartSystemSession();
  const [mode, setMode] = React.useState<Disposition>("complete");
  const [advanced, setAdvanced] = React.useState(false);
  const [replace, setReplace] = React.useState(true);
  const picked = RESTART_MODES.find((m) => m.value === mode)!;
  // Erasing history, or removing with no replacement, cannot be undone: the person types the agent's name first.
  const irreversible = mode === "hard_delete" || !replace;
  const [typing, setTyping] = React.useState(false);
  const phrase = session.agentId || session.title || session.sessionId.slice(0, 8);
  const err = sessionState(session).key === "failed" ? describeError(session.error) : null;
  const go = async () => {
    const r = await restart.mutateAsync({ agentIdOrSessionId: session.agentId || session.sessionId, disposition: mode, startReplacement: replace });
    const text = restartOutcome(r);
    if (r?.skippedReason) toast.warning(text); else toast.success(text);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !restart.isPending && onClose()}>
      <DialogContent title={`Restart ${session.title}`} description={err ? `${err.headline}. ${err.detail || ""}` : "Pick how it should stop. You'll see what happened afterwards."}>
        <DialogBody className="flex flex-col gap-3">
          <RadioCards value={mode} onValueChange={(v) => setMode(v as Disposition)} label="How to restart" className="flex flex-col gap-2">
            {RESTART_MODES.map((m) => (
              <RadioCard key={m.value} value={m.value} className="flex min-h-11 flex-col items-start gap-0.5 p-3">
                <span className="text-sm font-semibold">{m.label}</span>
                <span className="text-sm text-muted">{m.promise}</span>
              </RadioCard>
            ))}
          </RadioCards>
          <p className={cn("text-sm", picked.danger ? "text-waiting" : "text-muted")}>{picked.consequence}</p>
          <div>
            <DisclosureButton aria-expanded={advanced} onClick={() => setAdvanced((v) => !v)} className="text-xs text-muted">{advanced ? "Fewer options" : "More options"}</DisclosureButton>
            {advanced ? (
              <label className="mt-2 flex items-start gap-2 text-sm">
                <Checkbox className="mt-0.5" aria-label="Remove without starting a replacement" checked={!replace} onCheckedChange={(v) => setReplace(v !== true)} />
                <span>Remove it without starting a replacement<span className="block text-xs text-muted">For an agent no worker loads any more. Refused while a live worker still loads it.</span></span>
              </label>
            ) : null}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose} disabled={restart.isPending}>Cancel</Button>
          <Button variant={picked.danger ? "danger" : "primary"} onClick={() => (irreversible ? setTyping(true) : void go().catch(() => undefined))} disabled={restart.isPending}>{restart.isPending ? <Loader2 className="animate-spin" /> : null} {replace ? picked.label : "Remove"}{irreversible ? "…" : ""}</Button>
        </DialogFooter>
      </DialogContent>
      <TypedConfirmDialog
        open={typing}
        onOpenChange={setTyping}
        title={replace ? `Delete ${session.title} and restart it?` : `Remove ${session.title}?`}
        description="This cannot be undone."
        consequences={[mode === "hard_delete" ? "The session and its whole history are erased." : "The session is removed.", replace ? "A clean session starts in its place." : "No replacement is started."]}
        phrase={phrase}
        confirmLabel={replace ? "Delete and restart" : "Remove"}
        onConfirm={go}
      />
    </Dialog>
  );
}
