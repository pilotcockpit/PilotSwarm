import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity, ArrowUpLeft, Ban, CheckCircle2, ChevronDown, Clock, Copy, Download, Files, FolderGit2, FolderInput, GitBranch, LayoutPanelLeft, Link2, Menu as MenuIcon, MoreHorizontal, PanelRight, Pencil, Pin, PinOff, Share2, Shuffle, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useIntent } from "@/shell/intents";
import { useUi } from "@/shell/ui-state";
import { useMediaQuery } from "@/shell/prefs";
import { useRefresh, useSource } from "@/data/source";
import { modelShort, sessionState, STATE_TINT, type SessionState } from "@/data/state";
import type { Session } from "@/data/types";
import { StateGlyph, StatePill } from "@/components/state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Popover, PopoverContent, PopoverTrigger, Tag } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/tooltip";
import { ChangeModelDialog } from "@/components/model-switch";
import { ShareButton, ShareSheet } from "@/components/session/share-sheet";
import { MoveToGroupDialog, useCurrentGroupId } from "@/components/session/move-to-group";
import { ScheduleActions } from "@/components/session/schedule-actions";
import { WorkingFolderDialog } from "@/components/session/working-folder-dialog";
import { SessionCloseDialog, canManage, copySessionLink, type CloseKind } from "@/components/session/session-actions";
import { contextPercent, isStalled } from "@/components/session/session-meta";
import { usePins } from "@/components/sidebar/prefs";
import { sessionIsViewOnly } from "@/lib/session-access";
import { ago, cn } from "@/lib/utils";
import type { SessionView } from "@/router";


// The session's identity lives in the top bar: its title is the page heading (the chevron beside it
// opens everything you can do to the session), then its state, then icon buttons for the views that
// belong to it. On a phone the bar keeps the menu button, the title, the state and one overflow menu.

function TitleEditor({ session }: { session: Session }) {
  const readOnly = sessionIsViewOnly(session) || session.canManage === false;
  const { source } = useSource();
  const refresh = useRefresh();
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(session.title || "");
  const saving = React.useRef(false);
  const cancelled = React.useRef(false);
  React.useEffect(() => setTitle(session.title || ""), [session.title]);
  React.useEffect(() => {
    const open = () => { if (!readOnly) { cancelled.current = false; setEditing(true); } };
    window.addEventListener("fd:rename-session", open);
    return () => window.removeEventListener("fd:rename-session", open);
  }, [readOnly]);
  const save = async () => {
    if (cancelled.current) { cancelled.current = false; return; }
    if (saving.current || readOnly) return;
    setEditing(false);
    const next = title.trim();
    if (!next || next === session.title) return setTitle(session.title || "");
    saving.current = true;
    try { await source.renameSession(session.sessionId, next); refresh(session.sessionId); toast.success("Renamed"); }
    catch (e: any) { setTitle(session.title || ""); toast.error("Couldn't rename", { description: e?.message }); }
    finally { saving.current = false; }
  };
  return readOnly ? <span className="max-w-full truncate">{session.title || "Untitled session"}</span> : editing ? (
    <Input
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") { cancelled.current = true; setTitle(session.title || ""); setEditing(false); } }}
      className="h-8 max-w-130 text-lg font-semibold"
      aria-label="Session title"
    />
  ) : (
    <button type="button" className="max-w-full truncate rounded-chip text-left tracking-tight hover:bg-raised pointer-coarse:min-h-11" onClick={() => { cancelled.current = false; setEditing(true); }} title="Rename">{session.title || "Untitled session"}</button>
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


const PANE_ICONS: Array<{ view: Exclude<SessionView, "chat">; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { view: "canvas", label: "Canvas", icon: LayoutPanelLeft },
  { view: "files", label: "Files", icon: Files },
  { view: "activity", label: "Activity", icon: Activity },
  { view: "delegation", label: "Delegation", icon: GitBranch },
];

export function SessionHeader({ session, parent, childCount, view, paneOpen, counts, onView }: {
  session: Session; parent?: Session; childCount: number; view: SessionView; paneOpen: boolean; counts: Partial<Record<SessionView, number>>;
  onView: (v: SessionView) => void;
}) {
  const st = sessionState(session);
  const phone = useMediaQuery("(max-width: 767px)");
  const wide = useMediaQuery("(min-width: 1536px)");
  const { setNavOpen } = useUi();
  const pins = usePins();
  const currentGroup = useCurrentGroupId(session);
  const [modelOpen, setModelOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [groupOpen, setGroupOpen] = React.useState(false);
  const [folderOpen, setFolderOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<CloseKind | null>(null);
  useIntent("share-session", `/s/${session.sessionId}`, () => setShareOpen(true));
  useIntent("move-to-group", `/s/${session.sessionId}`, () => setGroupOpen(true));
  const readOnly = !canManage(session);
  const closed = st.key === "completed" || st.key === "cancelled";
  const ctx = contextPercent(session);
  const stalled = isStalled(session);
  const pinned = pins.isPinned(session.sessionId);
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
      <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight"><TitleEditor session={session} /></h1>
      <Menu>
        <Tooltip content="Session actions">
          <MenuTrigger asChild><Button variant="quiet" size="icon-sm" aria-label="Session actions" className="shrink-0"><ChevronDown /></Button></MenuTrigger>
        </Tooltip>
        <MenuContent align="start" className="w-65">
          <MenuItem disabled={readOnly} icon={<Pencil />} onSelect={() => window.dispatchEvent(new Event("fd:rename-session"))}>Rename</MenuItem>
          <MenuItem icon={pinned ? <PinOff /> : <Pin />} onSelect={() => pins.toggle(session.sessionId)} hint="Keeps it at the top of your sidebar">{pinned ? "Unpin" : "Pin"}</MenuItem>
          <MenuItem icon={<FolderInput />} onSelect={() => setGroupOpen(true)} hint={currentGroup ? "In a group now" : undefined}>Move to group…</MenuItem>
          <MenuItem icon={<Share2 />} onSelect={() => setShareOpen(true)}>Share…</MenuItem>
          <MenuItem icon={<Link2 />} onSelect={() => copySessionLink(session.sessionId)}>Copy link</MenuItem>
          <MenuItem disabled={readOnly || exporting} icon={<Download />} onSelect={() => void exportHistory()} hint="Saves the full record to Files">Export history</MenuItem>
          <MenuSeparator />
          <MenuItem icon={<CheckCircle2 />} disabled={closed || readOnly} onSelect={() => setConfirm("complete")} hint="Close as done">Complete session</MenuItem>
          <MenuItem icon={<Ban />} danger disabled={closed || readOnly} onSelect={() => setConfirm("cancel")} hint={childCount ? `Also cancels ${childCount} sub-agent${childCount === 1 ? "" : "s"}` : "Close as abandoned"}>Cancel session</MenuItem>
          <MenuItem disabled={readOnly} icon={<Trash2 />} danger onSelect={() => setConfirm("delete")} hint={childCount ? `Also deletes ${childCount} sub-agent${childCount === 1 ? "" : "s"}` : "Remove from every list"}>Delete</MenuItem>
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
      {phone ? null : (
        <div className="flex shrink-0 items-center gap-0.5" role="toolbar" aria-label="Session views">
          <ShareButton session={session} onOpen={() => setShareOpen(true)} />
          {PANE_ICONS.map(({ view: v, label, icon: Icon }) => (
            <Tooltip key={v} content={label}>
              <Button variant="quiet" size="icon" aria-label={label} aria-pressed={paneOpen && view === v} onClick={() => onView(paneOpen && view === v ? "chat" : v)} className={cn("relative", paneOpen && view === v && "bg-raised text-fg")}>
                <Icon />
                {counts[v] ? <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-raised px-1 text-xs tabular-nums text-muted">{counts[v]}</span> : null}
                {v === "canvas" && session.unseenCanvas && !(paneOpen && view === v) ? <span className="absolute right-1 top-1 size-1.5 rounded-full bg-accent" aria-hidden /> : null}
              </Button>
            </Tooltip>
          ))}
          <Tooltip content={paneOpen ? "Hide context" : "Show context"}>
            <Button variant="quiet" size="icon" aria-label="Context" aria-pressed={paneOpen && view === "context"} onClick={() => (paneOpen && view === "context" ? onView("chat") : onView("context"))} className={cn(paneOpen && view === "context" && "bg-raised text-fg")}><PanelRight /></Button>
          </Tooltip>
        </div>
      )}
      <Menu>
        <MenuTrigger asChild><Button variant="quiet" size="icon" aria-label="More" className="shrink-0"><MoreHorizontal /></Button></MenuTrigger>
        <MenuContent className="w-65">
          {phone ? <MenuItem icon={<Share2 />} onSelect={() => setShareOpen(true)}>Share…</MenuItem> : null}
          {phone ? <MenuItem icon={<PanelRight />} onSelect={() => onView("context")}>Context and details</MenuItem> : null}
          <MenuItem disabled={readOnly} icon={<Shuffle />} onSelect={() => setModelOpen(true)} hint={modelShort(session.model)}>Change model</MenuItem>
          <MenuItem disabled={readOnly} icon={<FolderGit2 />} onSelect={() => setFolderOpen(true)} hint={session.workspace?.repo ? String(session.workspace.repo) : "Where the agent reads and writes files"}>Working folder…</MenuItem>
          <MenuItem icon={<Copy />} onSelect={() => { void navigator.clipboard?.writeText(session.sessionId); toast.success("Session ID copied"); }}>Copy session ID</MenuItem>
        </MenuContent>
      </Menu>
      <ShareSheet session={session} open={shareOpen} onOpenChange={setShareOpen} />
      <MoveToGroupDialog session={session} open={groupOpen} onOpenChange={setGroupOpen} />
      <WorkingFolderDialog sessionId={session.sessionId} open={folderOpen} onOpenChange={setFolderOpen} />
      <ChangeModelDialog open={modelOpen} onOpenChange={setModelOpen} session={session} />
      <SessionCloseDialog session={session} kind={confirm} childCount={childCount} onOpenChange={(o) => !o && setConfirm(null)} />
    </header>
  );
}
