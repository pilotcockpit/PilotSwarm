import * as React from "react";
import { ChevronDown, Folder, SlidersHorizontal } from "lucide-react";
import { ModelPicker } from "@/components/model-picker";
import { WorkingFolderDialog } from "@/components/session/working-folder-dialog";
import { contextFill } from "@/components/session/session-meta";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/tooltip";
import { useWorkspaceView } from "@/data/ops/workspace";
import type { Session } from "@/data/types";
import { AGENT_FIXED_NOTE, folderChip, folderWarning, modelChipLabel, settingsLockedReason } from "@/lib/model-options";
import { usePendingModel } from "@/lib/pending-model";
import { useMediaQuery } from "@/shell/prefs";
import { cn } from "@/lib/utils";

/**
 * What sits under the message box. Fixed things look fixed: the agent is plain text, with no chevron and no
 * hover, because a session's agent cannot change after it is created. Changeable things are chips that open
 * a picker: the model (with its reasoning effort and context window) and the working folder. The context
 * meter says how full the window is. On a phone the chips fold into one Session settings button.
 */
export function ComposerSettings({ session, running }: { session: Session; running: boolean }) {
  const phone = useMediaQuery("(max-width: 639px)");
  const locked = settingsLockedReason(session);
  // A model change is queued, not instant: say so until the session reports the new setting.
  const pending = usePendingModel(session);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      {phone ? <PhoneSettings session={session} locked={locked} /> : (
        <>
          <AgentLabel agent={session.agentId} />
          <ModelChip session={session} locked={locked} />
          <FolderChip session={session} locked={locked} />
        </>
      )}
      <ContextMeter session={session} />
      {pending ? (
        <span className="text-xs text-waiting" role="status" data-model-pending>
          Switching to {modelChipLabel({ model: pending.want.model, reasoningEffort: pending.want.effort ?? undefined })}: applies {running ? "after the current turn" : "from the next turn"}
        </span>
      ) : null}
    </div>
  );
}

/** The agent: a fixed fact, shown as text. No chevron, no hover. */
export function AgentLabel({ agent }: { agent?: string }) {
  if (!agent) return null;
  const initials = agent.split(/[-_\s]+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <span className="inline-flex min-w-0 max-w-44 items-center gap-1.5 px-1 text-xs text-muted" title={AGENT_FIXED_NOTE}>
      <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-chip bg-raised text-xs font-medium">{initials}</span>
      <span className="truncate">{agent}</span>
      <span className="sr-only">. {AGENT_FIXED_NOTE}.</span>
    </span>
  );
}

const chip = "max-w-48 gap-1 px-2 text-xs";

export function ModelChip({ session, locked, onApplied }: { session: Session; locked: string | null; onApplied?: () => void }) {
  const [open, setOpen] = React.useState(false);
  const label = modelChipLabel(session);
  if (locked) return <span className="inline-flex max-w-48 items-center truncate px-2 text-xs text-muted" title={locked}>{label}<span className="sr-only">. {locked}.</span></span>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="quiet" size="sm" className={chip} aria-label={`Model: ${label}. Change it`}>
          <span className="truncate">{label}</span><ChevronDown className="!size-3 shrink-0" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[70vh] w-96 overflow-y-auto">
        {open ? <ModelPicker session={session} onApplied={() => { setOpen(false); onApplied?.(); }} /> : null}
      </PopoverContent>
    </Popover>
  );
}

export function FolderChip({ session, locked }: { session: Session; locked: string | null }) {
  const { data: view } = useWorkspaceView(session.sessionId);
  const [open, setOpen] = React.useState(false);
  // Not loaded yet: the session row's own record. Loaded: the server's answer, including "none" and the default folder.
  const { label } = folderChip(view, session.workspace);
  const warning = folderWarning(view);
  const body = (
    <>
      <Folder className="!size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
      {warning ? <span className="size-1.5 shrink-0 rounded-full bg-waiting" aria-hidden /> : null}
      {locked ? null : <ChevronDown className="!size-3 shrink-0" aria-hidden />}
    </>
  );
  if (locked) return <span className="inline-flex max-w-44 items-center gap-1 px-2 text-xs text-muted" title={warning ?? locked}>{body}<span className="sr-only">. {warning ?? locked}.</span></span>;
  return (
    <>
      <Tooltip content={warning ?? "Where the agent reads and writes files"}>
        <Button variant="quiet" size="sm" className={chip} aria-label={`Working folder: ${label}${warning ? `. ${warning}` : ""}. Change it`} onClick={() => setOpen(true)}>{body}</Button>
      </Tooltip>
      <WorkingFolderDialog sessionId={session.sessionId} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** How full the context window is: a short bar and a number; red once the limit is passed. */
export function ContextMeter({ session }: { session: Session }) {
  const fill = contextFill((session as any).contextUsage?.utilization);
  if (!fill) return null;
  const text = fill.over ? `Context over the limit (${fill.percent}%)` : `Context ${fill.percent}% used`;
  return (
    <span className="inline-flex items-center gap-1.5 px-1.5 text-xs tabular-nums text-muted" title={text}>
      <span role="meter" aria-label="Context used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill.meter} aria-valuetext={text} className="h-1 w-9 shrink-0 overflow-hidden rounded-full bg-line">
        <span className={cn("block h-full rounded-full", fill.over ? "bg-failed" : fill.meter >= 80 ? "bg-waiting" : "bg-accent")} style={{ width: `${fill.meter}%` }} />
      </span>
      <span aria-hidden>{fill.percent}%</span>
    </span>
  );
}

/** Phones: one button, and a bottom sheet holding the same controls. */
function PhoneSettings({ session, locked }: { session: Session; locked: string | null }) {
  const [open, setOpen] = React.useState(false);
  const label = modelChipLabel(session);
  return (
    <>
      <Button variant="quiet" size="sm" className={chip} aria-label={`Session settings. Model ${label}`} onClick={() => setOpen(true)}>
        <SlidersHorizontal className="!size-3.5 shrink-0" aria-hidden /><span className="truncate">{label}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Session settings" description="Changes apply from the next turn." className="top-auto bottom-0 left-0 w-full max-w-none translate-x-0 rounded-b-none rounded-t-dialog max-h-[85dvh]">
          <DialogBody className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted">Agent</span><AgentLabel agent={session.agentId} /></div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">Working folder</span>
              <FolderChip session={session} locked={locked} />
            </div>
            {locked ? <p className="text-sm text-muted">{label}. {locked}.</p> : <ModelPicker session={session} onApplied={() => setOpen(false)} />}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
