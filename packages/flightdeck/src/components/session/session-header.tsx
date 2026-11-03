import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpLeft, Ban, CheckCircle2, ChevronDown, Clock, Copy, Download, Link2, Menu as MenuIcon, Pencil, Pin, PinOff, RotateCcw, Share2, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { notifyUndo } from "@/lib/undo";
import { useIntent } from "@/shell/intents";
import { useUi } from "@/shell/ui-state";
import { useMediaQuery } from "@/shell/prefs";
import { useGroups, useProfile, useRefresh, useSessions, useSource } from "@/data/source";
import { sessionState, STATE_TINT, type SessionState } from "@/data/state";
import type { Session } from "@/data/types";
import { StateGlyph, StatePill } from "@/components/state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Popover, PopoverContent, PopoverTrigger, Tag } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/tooltip";
import { ShareButton, ShareSheet } from "@/components/session/share-sheet";
import { ProjectIcon } from "@/components/project-icon";
import { sessionFacts } from "@/components/session/session-facts";
import { MoveToGroupDialog, useCurrentGroupId } from "@/components/session/move-to-group";
import { ScheduleActions } from "@/components/session/schedule-actions";
import { SessionCloseDialog, canManage, canModify, copySessionLink, type CloseKind } from "@/components/session/session-actions";
import { RestartDialog } from "@/components/admin/system-sessions-panel";
import { contextPercent, isStalled } from "@/components/session/session-meta";
import { usePins } from "@/components/sidebar/prefs";
import { sessionIsViewOnly } from "@/lib/session-access";
import { useRenameDraft } from "@/lib/rename-draft";
import { ago, cn } from "@/lib/utils";


// The session's identity lives in the top bar: its title is the page heading (the chevron beside it
// opens everything you can do to the session), then its state, then icon buttons for the views that
// belong to it. On a phone the bar keeps the menu button, the title, the state and one overflow menu.

export function TitleEditor({ session }: { session: Session }) {
  // The SDK refuses to rename a system session, so its title is text.
  const readOnly = sessionIsViewOnly(session) || session.canManage === false || Boolean(session.isSystem);
  const { source } = useSource();
  const refresh = useRefresh();
  const [editing, setEditing] = React.useState(false);
  const draft = useRenameDraft(session.title || "", editing);
  const saving = React.useRef(false);
  const cancelled = React.useRef(false);
  const begin = () => { cancelled.current = false; setEditing(true); };
  React.useEffect(() => {
    const open = () => { if (!readOnly) begin(); };
    window.addEventListener("fd:rename-session", open);
    return () => window.removeEventListener("fd:rename-session", open);
  }, [readOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (cancelled.current) { cancelled.current = false; return; }
    if (saving.current || readOnly) return;
    setEditing(false);
    const outcome = draft.outcome();
    if (outcome.kind === "noop") return draft.reset();
    saving.current = true;
    // Someone else renamed it while this edit was open: the draft wins, said out loud, with a way back.
    const theirs = outcome.replaced;
    try {
      await source.renameSession(session.sessionId, outcome.next);
      refresh(session.sessionId);
      if (theirs) notifyUndo("Renamed", () => { void source.renameSession(session.sessionId, theirs).then(() => refresh(session.sessionId)); }, { description: `Replaced “${theirs}”, set by someone else while you were typing.`, resource: `title:${session.sessionId}` });
      else toast.success("Renamed");
    }
    catch (e: any) { draft.reset(); toast.error("Couldn't rename", { description: e?.message }); }
    finally { saving.current = false; }
  };
  return readOnly ? <span className="max-w-full truncate">{session.title || "Untitled session"}</span> : editing ? (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <Input
        autoFocus
        value={draft.text}
        onChange={(e) => draft.setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") { cancelled.current = true; draft.reset(); setEditing(false); } }}
        className="h-8 max-w-130 text-lg font-semibold"
        aria-label="Session title"
      />
      {/* Said before saving, not after: someone else renamed it while this edit was open, and saving replaces their title. */}
      {draft.changedUnderneath ? (
        <span role="status" data-title-changed className="flex items-center gap-1.5 text-xs font-normal text-muted">
          Now “{session.title}” elsewhere. Saving replaces it.
          {/* mouse-down is cancelled so the input keeps focus: a blur would save the draft before this click lands */}
          <Button type="button" variant="link" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={draft.useTheirs}>Use theirs</Button>
        </span>
      ) : null}
    </span>
  ) : (
    <button type="button" className="max-w-full truncate rounded-chip text-left tracking-tight hover:bg-raised pointer-coarse:min-h-11" onClick={begin} title="Rename">{session.title || "Untitled session"}</button>
  );
}


/** When a session runs on a schedule, its state pill opens the schedule. */
function StatePillWithSchedule({ state, session, showReason, compact = false }: { state: SessionState; session: Session; showReason: boolean; compact?: boolean }) {
  // Phones: the glyph in its tint, so the title keeps its room. The word stays for screen readers.
  const pill = compact ? (
    <span className={cn("grid size-7 place-items-center rounded-full pointer-coarse:size-11", STATE_TINT[state.key])} title={state.word}>
      <StateGlyph state={state.key} />
      <span className="sr-only">{state.word}{state.reason ? `, ${state.reason}` : ""}</span>
    </span>
  ) : <StatePill state={state} size="sm" showReason={showReason} />;
  if (state.waitKind !== "schedule" && state.waitKind !== "timer") return pill;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-full" aria-label={`${state.word}, ${state.reason}. Show schedule`}>
          {pill}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <div className="text-sm font-semibold">{state.waitKind === "schedule" ? "Runs on a schedule" : "Waiting on a timer"}</div>
        <dl className="mt-2 grid grid-cols-[100px_1fr] gap-y-1 text-sm">
          <dt className="text-muted">Next run</dt><dd className="tabular-nums">{state.next || "—"}</dd>
          {state.waitKind === "schedule" ? <><dt className="text-muted">Interval</dt><dd>{state.reason?.replace(/^schedule · /, "")}</dd></> : null}
          <dt className="text-muted">Time zone</dt><dd>{Intl.DateTimeFormat().resolvedOptions().timeZone}</dd>
          <dt className="text-muted">Runs so far</dt><dd className="tabular-nums">{session.iterations ?? "—"}</dd>
        </dl>
        <ScheduleActions session={session} />
      </PopoverContent>
    </Popover>
  );
}


/**
 * The session's title, state and the actions that are about the session itself (share, rename, move, close). The model and
 * the working folder are changed from the chips in the composer, where they are shown; they are not repeated here.
 * Which view is showing (Chat, Context, Canvas, Files, Delegation, Activity) is chosen in the tab bar under it and
 * nowhere else, so there is one control for each view.
 */
export function SessionHeader({ session, parent, childCount }: { session: Session; parent?: Session; childCount: number }) {
  const st = sessionState(session);
  const phone = useMediaQuery("(max-width: 767px)");
  const wide = useMediaQuery("(min-width: 1536px)");
  const { setNavOpen } = useUi();
  const pins = usePins();
  const currentGroup = useCurrentGroupId(session);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [groupOpen, setGroupOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<CloseKind | null>(null);
  useIntent("share-session", `/s/${session.sessionId}`, () => setShareOpen(true));
  useIntent("move-to-group", `/s/${session.sessionId}`, () => setGroupOpen(true));
  const readOnly = !canManage(session);
  // The SDK refuses rename, complete, cancel and delete on a system session; an admin restarts it instead.
  const ordinary = canModify(session);
  const system = Boolean(session.isSystem);
  const { data: profile } = useProfile();
  const [restartOpen, setRestartOpen] = React.useState(false);
  const closed = st.key === "completed" || st.key === "cancelled";
  const ctx = contextPercent(session);
  const stalled = isStalled(session);
  const pinned = pins.isPinned(session.sessionId);
  // Where it is filed, shown in front of the title when it is in a project: the sidebar may be folded or hidden, and this is the way up.
  const { data: all } = useSessions();
  const { data: groups } = useGroups();
  const project = sessionFacts(session, all || [], groups || []).project;
  const { source } = useSource();
  const navigate = useNavigate();
  const [exporting, setExporting] = React.useState(false);
  const exportHistory = async () => {
    setExporting(true);
    try {
      const meta: any = await source.call("exportExecutionHistory", { sessionId: session.sessionId });
      const filename = String(meta?.filename || meta?.name || "");
      toast.success("History exported", {
        description: filename || "Saved to this session's files.",
        ...(filename ? { action: { label: "Open", onClick: () => void navigate({ to: "/s/$sessionId", params: { sessionId: session.sessionId }, search: { view: "files", files: "outputs", file: filename } as any }) } } : {}),
      });
    } catch (e: any) { toast.error("Couldn't export the history", { description: e?.message }); }
    finally { setExporting(false); }
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 md:px-5">
      {phone ? <Button variant="quiet" size="icon" aria-label="Open menu and sessions" aria-haspopup="dialog" onClick={() => setNavOpen("menu")}><MenuIcon /></Button> : null}
      {parent && !phone ? (
        <Tooltip content={`Part of: ${parent.title || "parent session"}`}>
          <Link to="/s/$sessionId" params={{ sessionId: parent.sessionId }} aria-label={`Parent session: ${parent.title || "parent"}`} className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-fg"><ArrowUpLeft className="size-4" aria-hidden /></Link>
        </Tooltip>
      ) : null}
      {project?.id && !phone ? (
        <nav aria-label="Project" className="hidden min-w-0 shrink items-center gap-1.5 lg:flex">
          <Link to="/projects" search={{ project: project.id }} className="inline-flex min-h-8 min-w-0 max-w-44 items-center gap-1.5 rounded-control px-1.5 text-sm text-muted hover:bg-raised hover:text-fg pointer-coarse:min-h-11"><ProjectIcon className="size-3.5 shrink-0" /><span className="truncate">{project.name}</span></Link>
          <span className="text-faint" aria-hidden>›</span>
        </nav>
      ) : null}
      <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight"><TitleEditor session={session} /></h1>
      <Menu>
        <Tooltip content="Session actions">
          <MenuTrigger asChild><Button variant="quiet" size="icon-sm" aria-label="Session actions" className="shrink-0"><ChevronDown /></Button></MenuTrigger>
        </Tooltip>
        <MenuContent align="start" className="w-65">
          <MenuItem disabled={!ordinary} icon={<Pencil />} onSelect={() => window.dispatchEvent(new Event("fd:rename-session"))}>Rename</MenuItem>
          <MenuItem icon={pinned ? <PinOff /> : <Pin />} onSelect={() => pins.toggle(session.sessionId)} hint="Keeps it at the top of your sidebar">{pinned ? "Unpin" : "Pin"}</MenuItem>
          <MenuItem icon={<ProjectIcon />} onSelect={() => setGroupOpen(true)} hint={currentGroup ? "In a project now" : undefined}>Move to project…</MenuItem>
          <MenuItem icon={<Share2 />} onSelect={() => setShareOpen(true)}>Share…</MenuItem>
          <MenuItem icon={<Link2 />} onSelect={() => copySessionLink(session.sessionId)}>Copy link</MenuItem>
          <MenuItem icon={<Copy />} onSelect={() => { void navigator.clipboard?.writeText(session.sessionId); toast.success("Session ID copied"); }}>Copy session ID</MenuItem>
          <MenuItem disabled={readOnly || exporting} icon={<Download />} onSelect={() => void exportHistory()} hint="Saves the full record to Files">Export history</MenuItem>
          <MenuSeparator />
          <MenuItem icon={<CheckCircle2 />} disabled={closed || !ordinary} onSelect={() => setConfirm("complete")} hint="Close as done">Complete session</MenuItem>
          <MenuItem icon={<Ban />} danger disabled={closed || !ordinary} onSelect={() => setConfirm("cancel")} hint={childCount ? `Also cancels ${childCount} sub-agent${childCount === 1 ? "" : "s"}` : "Close as abandoned"}>Cancel session</MenuItem>
          <MenuItem disabled={!ordinary} icon={<Trash2 />} danger onSelect={() => setConfirm("delete")} hint={childCount ? `Also deletes ${childCount} sub-agent${childCount === 1 ? "" : "s"}` : "Remove from every list"}>Delete</MenuItem>
        {system && profile?.isAdmin ? (<><MenuSeparator /><MenuItem icon={<RotateCcw />} onSelect={() => setRestartOpen(true)} hint="The way to reset a system session">Restart…</MenuItem></>) : null}
        </MenuContent>
      </Menu>
      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        <StatePillWithSchedule state={st} session={session} showReason={wide} compact={phone} />
        {stalled && !phone ? (
          <Tooltip content="This turn is marked running but nothing has been recorded for a while. It may be stuck on a slow tool, or the worker may have stopped.">
            <span><Tag tone="waiting"><Clock aria-hidden />No activity for {ago(session.updatedAt).replace(/ ago$/, "")}</Tag></span>
          </Tooltip>
        ) : null}
        {ctx != null && ctx >= 70 && !phone ? (
          <Tooltip content="How much of the model's context window this session has used. Near the limit the agent compacts earlier turns."><span><Tag tone={ctx >= 90 ? "failed" : "waiting"}>Context {ctx}%</Tag></span></Tooltip>
        ) : null}
      </div>
      <span className="flex-1" />
      {phone ? null : <ShareButton session={session} onOpen={() => setShareOpen(true)} />}
      <ShareSheet session={session} open={shareOpen} onOpenChange={setShareOpen} />
      <MoveToGroupDialog session={session} open={groupOpen} onOpenChange={setGroupOpen} />
      {restartOpen ? <RestartDialog session={session} onClose={() => setRestartOpen(false)} /> : null}
      <SessionCloseDialog session={session} kind={confirm} childCount={childCount} onOpenChange={(o) => !o && setConfirm(null)} />
    </header>
  );
}
