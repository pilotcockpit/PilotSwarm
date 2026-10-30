import * as React from "react";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { Group, Panel as SplitPanel, Separator, useDefaultLayout } from "react-resizable-panels";
import {
  Activity, ArrowUp, Ban, Download, FolderInput, PanelRightClose, CheckCircle2, Clock, Copy, FolderGit2, Files, GitBranch, Globe, Info, LayoutPanelLeft, ListPlus, Lock, MoreHorizontal, Navigation, Paperclip, Pencil, Share2, Shuffle, Square, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/shell/AppShell";
import { useMediaQuery } from "@/shell/prefs";
import { useArtifacts, useRefresh, useSession, useSessions, useSource, useTranscript } from "@/data/source";
import { describeError, modelShort, questionKey, sessionState, STATE_TINT, type SessionState } from "@/data/state";
import type { PendingQuestion, Session } from "@/data/types";
import { StateGlyph, StatePill } from "@/components/state";
import { QuestionCard, Transcript } from "@/components/chat";
import { useRetry } from "@/lib/retry";
import { StructuredErrorCard } from "@/components/structured-error";
import { EmptyState } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton, Popover, PopoverContent, PopoverTrigger, Tag } from "@/components/ui/misc";
import { ChangeModelDialog } from "@/components/model-switch";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { ActivityView, CanvasView, DelegationView, FilesView, useCanvases } from "./session-views";
import { ago, cn, plural, shortId } from "@/lib/utils";
import type { SessionView } from "@/router";
import { isCanvasFile } from "./home";
import { rovingKeyDown } from "@/lib/roving";
import { sessionIsViewOnly } from "@/lib/session-access";
import { createSessionComposerMemory } from "@/lib/session-composer";
import { fillComposer } from "@/lib/composer";
import { ShareButton, ShareSheet } from "@/components/session/share-sheet";
import { MoveToGroupDialog, useCurrentGroupId } from "@/components/session/move-to-group";
import { AttachmentTray } from "@/components/session/attachment-tray";
import { ScheduleActions } from "@/components/session/schedule-actions";
import { WorkingFolderDialog } from "@/components/session/working-folder-dialog";
import { buildAttachedMessage, sendWithAttachments, useAttachments } from "@/data/ops/attachments";

const route = getRouteApi("/s/$sessionId");

type Companion = Exclude<SessionView, "chat">;

const VIEW_META: Record<SessionView, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  chat: { label: "Chat", icon: Navigation },
  canvas: { label: "Canvas", icon: LayoutPanelLeft },
  files: { label: "Files", icon: Files },
  delegation: { label: "Delegation", icon: GitBranch },
  activity: { label: "Activity", icon: Activity },
};

/** Container width, not device name, decides the layout (chat 360 + companion 400). */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = React.useState(1200);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export function SessionPage() {
  const { sessionId } = route.useParams();
  return <SessionPageContent key={sessionId} />;
}

function SessionPageContent() {
  const { sessionId } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { session, missing, error: detailError, isError: detailFailed, retry: retryDetail, refreshing: refreshingDetail } = useSession(sessionId);
  const { history, error: transcriptError, retry: retryTranscript } = useTranscript(sessionId);
  const { data: all } = useSessions();
  const { canvases } = useCanvases(sessionId);
  const { data: artifacts } = useArtifacts(sessionId);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const width = useWidth(bodyRef);
  const phone = useMediaQuery("(max-width: 767px)");
  const tabsMode = phone || width < 780;

  const parent = all?.find((s) => s.sessionId === session?.parentSessionId);
  const children = (all || []).filter((s) => s.parentSessionId === sessionId);
  const outputCount = (artifacts || []).filter((a) => !isCanvasFile(a.filename)).length;
  const counts: Partial<Record<SessionView, number>> = { canvas: canvases.length, files: outputCount, delegation: children.length };

  // The companion opens by itself only when the session has a canvas.
  const view: SessionView = search.view || (canvases.length && !tabsMode ? "canvas" : "chat");
  const companion: Companion | null = view === "chat" ? null : view;
  const setSearch = React.useCallback((patch: Record<string, unknown>, replace = false) => navigate({ search: (prev: any) => ({ ...prev, ...patch }), replace }), [navigate]);
  const setView = (v: SessionView) => setSearch({ view: v, focus: undefined });

  React.useEffect(() => {
    if (!search.focus) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("[role=dialog]")) setSearch({ focus: undefined }); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [search.focus, setSearch]);

  if (detailFailed && !session) {
    return (
      <>
        <TopBar crumbs={[{ label: "Sessions", to: "/sessions" }, { label: "Connection problem" }]} />
        <EmptyState
          title="Couldn't load this session"
          className="flex-1"
          action={<Button disabled={refreshingDetail} onClick={() => void retryDetail()}>{refreshingDetail ? "Retrying…" : "Try again"}</Button>}
        >
          Your session may still be running. {detailError instanceof Error ? detailError.message : "Check your connection and try again."}
        </EmptyState>
      </>
    );
  }

  if (missing) {
    return (
      <>
        <TopBar crumbs={[{ label: "Sessions", to: "/sessions" }, { label: "Not found" }]} />
        <EmptyState title="This session isn't here" className="flex-1" action={<Button asChild><Link to="/sessions">Back to Sessions</Link></Button>}>
          It may have been deleted, or you may not have access. Session <span className="font-mono">{shortId(sessionId)}</span>.
        </EmptyState>
      </>
    );
  }

  // One row: the session's own title is the page heading (rename in place), its state,
  // details and actions sit on the same bar, so the conversation starts right under it.
  const crumbs = [
    { label: "Sessions", to: "/sessions" },
    ...(parent ? [{ label: parent.title || "Parent", to: "/s/$sessionId", params: { sessionId: parent.sessionId } }] : []),
    { label: session ? <TitleEditor session={session} /> : <Skeleton className="h-6 w-48" /> },
  ];

  const chat = <ChatPane key={sessionId} session={session} sessionId={sessionId} history={history} transcriptError={transcriptError} onRetryTranscript={retryTranscript} onOpenCanvas={(slot) => setSearch({ view: "canvas", slot })} />;
  const companionNode = companion ? (
    <CompanionPane
      view={companion}
      session={session}
      history={history}
      search={search}
      setSearch={setSearch}
      tabsMode={tabsMode}
      phone={phone}
    />
  ) : null;

  return (
    <>
      <TopBar crumbs={crumbs} actions={session ? <SessionBarActions session={session} childCount={children.length} /> : null} />
      {detailFailed && session ? <div role="status" className="flex flex-wrap items-center gap-2 border-b border-line bg-raised px-4 py-2 text-sm"><span className="min-w-0 flex-1 text-muted">Session details could not refresh. Showing the last available state.</span><Button size="sm" disabled={refreshingDetail} onClick={() => void retryDetail()}>Try again</Button></div> : null}
      <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col">
        {tabsMode ? (
          <>
            <ViewTabs view={view} counts={counts} onView={setView} includeChat canvasUpdated={Boolean(session?.unseenCanvas)} attention={sessionState(session).key === "needs" ? "needs" : sessionState(session).key === "failed" ? "failed" : null} />
            <div id="session-view-panel" role="tabpanel" aria-labelledby={`view-tab-${view}`} className="min-h-0 flex-1">{view === "chat" ? chat : companionNode}</div>
          </>
        ) : companion ? (
          search.focus ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <ViewTabs view={view} counts={counts} onView={setView} />
              <div id="session-view-panel" role="tabpanel" aria-labelledby={`view-tab-${view}`} className="min-h-0 flex-1">{companionNode}</div>
            </div>
          ) : (
            <SplitLayout chat={chat} companion={<div className="flex h-full min-h-0 flex-col"><ViewTabs view={view} counts={counts} onView={setView} closable onClose={() => setView("chat")} /><div id="session-view-panel" role="tabpanel" aria-labelledby={`view-tab-${view}`} className="min-h-0 flex-1">{companionNode}</div></div>} />
          )
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <ViewTabs view={view} counts={counts} onView={setView} includeChat canvasUpdated={Boolean(session?.unseenCanvas)} />
            <div id="session-view-panel" role="tabpanel" aria-labelledby="view-tab-chat" className="min-h-0 flex-1">{chat}</div>
          </div>
        )}
      </div>
    </>
  );
}

function SplitLayout({ chat, companion }: { chat: React.ReactNode; companion: React.ReactNode }) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "fd-session-split", storage: localStorage });
  return (
    <Group orientation="horizontal" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged} className="min-h-0 flex-1">
      <SplitPanel id="chat" minSize="360px" defaultSize="46%">{chat}</SplitPanel>
      <Separator className="group relative w-px bg-line outline-none data-[separator=hover]:bg-accent/60 data-[separator=active]:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-accent" aria-label="Resize chat and companion">
        <span className="absolute inset-y-0 -left-1.5 -right-1.5" aria-hidden />
      </Separator>
      <SplitPanel id="companion" minSize="400px">{companion}</SplitPanel>
    </Group>
  );
}

function ViewTabs({ view, counts, onView, includeChat = false, closable = false, onClose, attention = null, canvasUpdated = false }: { view: SessionView; counts: Partial<Record<SessionView, number>>; onView: (v: SessionView) => void; includeChat?: boolean; closable?: boolean; onClose?: () => void; attention?: "needs" | "failed" | null; canvasUpdated?: boolean }) {
  const views: SessionView[] = includeChat ? ["chat", "canvas", "files", "delegation", "activity"] : ["canvas", "files", "delegation", "activity"];
  return (
    <div role="tablist" aria-label="Session views" onKeyDown={rovingKeyDown("tab")} className={cn("flex h-10 shrink-0 items-center gap-0.5 border-b border-line px-2", includeChat && "max-sm:grid max-sm:h-12 max-sm:grid-cols-5 max-sm:gap-0 max-sm:px-0")}>
      {views.map((v) => {
        const Icon = VIEW_META[v].icon;
        const active = v === view;
        return (
          <button
            key={v}
            role="tab"
            id={`view-tab-${v}`}
            aria-selected={active}
            aria-controls="session-view-panel"
            tabIndex={active ? 0 : -1}
            onClick={() => onView(v)}
            className={cn(
              "focus-inset relative inline-flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-sm font-medium",
              // Phones: five equal columns, icon over a short label, so every view fits without scrolling.
              includeChat && "max-sm:h-12 max-sm:flex-col max-sm:justify-center max-sm:gap-0.5 max-sm:px-0 max-sm:text-xs",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="size-4" />
            {VIEW_META[v].label}
            {counts[v] ? <span className={cn("text-xs tabular-nums text-muted", includeChat && "max-sm:absolute max-sm:right-2 max-sm:top-1 max-sm:text-xs")}>{counts[v]}</span> : null}
            {v === "chat" && attention && view !== "chat" ? <span className={cn("size-1.5 rounded-full max-sm:absolute max-sm:left-[calc(50%+10px)] max-sm:top-2", attention === "failed" ? "bg-failed" : "bg-needs")} aria-label={attention === "failed" ? "failed" : "needs you"} /> : null}
            {v === "canvas" && canvasUpdated && view !== "canvas" ? <span className="size-1.5 rounded-full bg-accent max-sm:absolute max-sm:left-[calc(50%+10px)] max-sm:top-2" aria-label="updated" /> : null}
            {active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t bg-accent" aria-hidden /> : null}
          </button>
        );
      })}
      {closable ? (
        <Tooltip content="Close the side pane">
          <Button variant="quiet" size="icon-sm" className="ml-auto" aria-label="Close the side pane" onClick={onClose}><PanelRightClose /></Button>
        </Tooltip>
      ) : null}
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────
// The session's identity lives in the top bar: its title is the page heading (click to
// rename), its state, stall and context flags and its actions share the same row.

/** A session owner is an object on the API and a plain name in fixtures. */
function ownerName(owner: unknown): string {
  if (!owner) return "";
  if (typeof owner === "string") return owner;
  const o = owner as Record<string, unknown>;
  return String(o.displayName || o.email || o.subject || "");
}

/** Context-window fill as a percentage, from either a 0–1 or a 0–100 utilization. */
function contextPercent(session: Session): number | null {
  const u = (session as any).contextUsage?.utilization;
  if (typeof u !== "number" || !Number.isFinite(u)) return null;
  return Math.round(u <= 1 ? u * 100 : u);
}

const STALL_MS = 10 * 60_000;
const isStalled = (session: Session) => sessionState(session).key === "running" && Boolean(session.updatedAt) && Date.now() - Number(session.updatedAt) > STALL_MS;

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
      className="h-8 max-w-[520px] text-lg font-semibold"
      aria-label="Session title"
    />
  ) : (
    <button type="button" className="max-w-full truncate rounded-chip text-left tracking-tight hover:bg-raised pointer-coarse:min-h-11" onClick={() => { cancelled.current = false; setEditing(true); }} title="Rename">{session.title || "Untitled session"}</button>
  );
}

function VisibilityLabel({ visibility }: { visibility?: string }) {
  const v = visibility || "private";
  const Icon = v === "private" ? Lock : v === "shared_write" ? Users : Globe;
  const label = v === "private" ? "Private" : v === "shared_write" ? "Shared · can reply" : "Shared · view only";
  return <span className="inline-flex items-center gap-1 text-sm"><Icon className="size-3.5" aria-hidden />{label}</span>;
}

function SessionBarActions({ session, childCount }: { session: Session; childCount: number }) {
  const st = sessionState(session);
  const phone = useMediaQuery("(max-width: 767px)");
  const wide = useMediaQuery("(min-width: 1536px)");
  const [modelOpen, setModelOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [groupOpen, setGroupOpen] = React.useState(false);
  const [folderOpen, setFolderOpen] = React.useState(false);
  const ctx = contextPercent(session);
  const stalled = isStalled(session);
  return (
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
      {phone ? null : (
        <>
          <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
            <PopoverTrigger asChild>
              <Button variant="quiet" aria-label="Session details"><Info /> <span className="max-2xl:hidden">Details</span></Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <SessionDetails session={session} onChangeModel={() => { setDetailsOpen(false); setModelOpen(true); }} />
            </PopoverContent>
          </Popover>
          <ShareButton session={session} onOpen={() => setShareOpen(true)} />
        </>
      )}
      <SessionMenu session={session} childCount={childCount} onChangeModel={() => setModelOpen(true)} onDetails={() => setDetailsOpen(true)} onShare={() => setShareOpen(true)} onMoveToGroup={() => setGroupOpen(true)} onWorkingFolder={() => setFolderOpen(true)} phone={phone} />
      {phone ? (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent title="Session details"><DialogBody><SessionDetails session={session} onChangeModel={() => { setDetailsOpen(false); setModelOpen(true); }} /></DialogBody></DialogContent>
        </Dialog>
      ) : null}
      <ShareSheet session={session} open={shareOpen} onOpenChange={setShareOpen} />
      <MoveToGroupDialog session={session} open={groupOpen} onOpenChange={setGroupOpen} />
      <WorkingFolderDialog sessionId={session.sessionId} open={folderOpen} onOpenChange={setFolderOpen} />
      <ChangeModelDialog open={modelOpen} onOpenChange={setModelOpen} session={session} />
    </div>
  );
}

/** Everything that identifies a session but does not need to be on screen all the time. */
function SessionDetails({ session, onChangeModel }: { session: Session; onChangeModel: () => void }) {
  const ctx = (session as any).contextUsage;
  const ctxPct = contextPercent(session);
  const owner = ownerName(session.owner);
  const rows: Array<[string, React.ReactNode]> = [
    ["Agent", <span className="font-mono">{session.agentId || "generic"}</span>],
    ["Model", (
      <span className="flex items-center gap-2">
        <span className="min-w-0 truncate">{modelShort(session.model)}{session.reasoningEffort ? <span className="text-muted"> · {String(session.reasoningEffort)} effort</span> : null}</span>
        <Button variant="link" size="sm" disabled={sessionIsViewOnly(session) || session.canManage === false} className="ml-auto shrink-0" onClick={onChangeModel}>Change</Button>
      </span>
    )],
    ...(session.workspace?.repo ? [["Repository", <span className="inline-flex min-w-0 items-center gap-1"><FolderGit2 className="size-3.5 shrink-0" aria-hidden /><span className="truncate font-mono">{session.workspace.repo}{session.workspace.branch ? ` @ ${session.workspace.branch}` : ""}</span></span>] as [string, React.ReactNode]] : session.workspace?.folder ? [["Folder", <span className="truncate font-mono">{session.workspace.folder}</span>] as [string, React.ReactNode]] : []),
    ["Access", <VisibilityLabel visibility={session.visibility} />],
    ...(owner ? [["Owner", owner] as [string, React.ReactNode]] : []),
    ["Turns", <span className="tabular-nums">{session.iterations ?? "—"}</span>],
    ...(ctxPct != null ? [["Context window", <span className="tabular-nums">{ctxPct}% used{ctx?.tokenLimit ? ` of ${Number(ctx.tokenLimit).toLocaleString()} tokens` : ""}</span>] as [string, React.ReactNode]] : []),
    ["Started", <span className="tabular-nums">{session.createdAt ? `${ago(session.createdAt)}` : "—"}</span>],
    ["Last activity", <span className="tabular-nums">{session.updatedAt ? ago(session.updatedAt) : "—"}</span>],
    ["Session ID", (
      <span className="flex items-center gap-1.5">
        <span className="min-w-0 truncate font-mono text-xs">{session.sessionId}</span>
        <Button variant="quiet" size="icon-sm" className="shrink-0" aria-label="Copy session ID" onClick={() => { void navigator.clipboard?.writeText(session.sessionId); toast.success("Session ID copied"); }}><Copy /></Button>
      </span>
    )],
  ];
  return (
    <dl className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
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

function SessionMenu({ session, childCount, onChangeModel, onDetails, onShare, onMoveToGroup, onWorkingFolder, phone }: { session: Session; childCount: number; onChangeModel: () => void; onDetails: () => void; onShare: () => void; onMoveToGroup: () => void; onWorkingFolder: () => void; phone: boolean }) {
  const { source } = useSource();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [confirm, setConfirm] = React.useState<null | "complete" | "cancel" | "delete">(null);
  const [busy, setBusy] = React.useState(false);
  const inFlight = React.useRef(false);
  const readOnly = sessionIsViewOnly(session) || session.canManage === false;
  const cascade = childCount ? `Also ${confirm === "delete" ? "deletes" : "cancels"} ${plural(childCount, "sub-agent")}.` : "";
  const run = async (kind: "complete" | "cancel" | "delete") => {
    if (inFlight.current || readOnly) return;
    inFlight.current = true;
    setBusy(true);
    try {
      if (kind === "complete") await source.completeSession(session.sessionId);
      if (kind === "cancel") await source.cancelSession(session.sessionId);
      if (kind === "delete") await source.deleteSession(session.sessionId);
      refresh(session.sessionId);
      setConfirm(null);
      toast.success(kind === "complete" ? "Session completed" : kind === "cancel" ? "Session cancelled" : "Session deleted", { description: session.title });
      if (kind === "delete") void navigate({ to: "/sessions" });
    } catch (e: any) {
      toast.error("That didn't work", { description: e?.message });
    } finally { inFlight.current = false; setBusy(false); }
  };
  const closed = ["completed", "cancelled"].includes(sessionState(session).key);
  const currentGroup = useCurrentGroupId(session);
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
    <>
      <Menu>
        <MenuTrigger asChild><Button variant="quiet" size="icon" aria-label="Session menu"><MoreHorizontal /></Button></MenuTrigger>
        <MenuContent className="w-[260px]">
          {phone ? <MenuItem icon={<Info />} onSelect={onDetails}>Details</MenuItem> : null}
          {phone ? <MenuItem icon={<Share2 />} onSelect={onShare}>Share</MenuItem> : null}
          <MenuItem disabled={readOnly} icon={<Pencil />} onSelect={() => window.dispatchEvent(new Event("fd:rename-session"))}>Rename</MenuItem>
          <MenuItem icon={<Copy />} onSelect={() => { void navigator.clipboard?.writeText(window.location.href); toast.success("Link copied"); }}>Copy link</MenuItem>
          <MenuItem disabled={readOnly} icon={<Shuffle />} onSelect={onChangeModel} hint={modelShort(session.model)}>Change model</MenuItem>
          <MenuItem icon={<FolderInput />} onSelect={onMoveToGroup} hint={currentGroup ? "In a group now" : undefined}>Move to group…</MenuItem>
          <MenuItem disabled={readOnly} icon={<FolderGit2 />} onSelect={onWorkingFolder} hint={session.workspace?.repo ? String(session.workspace.repo) : "Where the agent reads and writes files"}>Working folder…</MenuItem>
          <MenuItem disabled={readOnly || exporting} icon={<Download />} onSelect={() => void exportHistory()} hint="Saves the full record to Files">Export history</MenuItem>
          <MenuSeparator />
          <MenuLabel>{readOnly ? "Management requires owner access" : "Close the session"}</MenuLabel>
          <MenuItem icon={<CheckCircle2 />} disabled={closed || readOnly} onSelect={() => setConfirm("complete")} hint="Close as done">Complete</MenuItem>
          <MenuItem icon={<Ban />} danger disabled={closed || readOnly} onSelect={() => setConfirm("cancel")} hint={childCount ? `Also cancels ${plural(childCount, "sub-agent")}` : "Close as abandoned"}>Cancel</MenuItem>
          <MenuItem disabled={readOnly} icon={<Trash2 />} danger onSelect={() => setConfirm("delete")} hint={childCount ? `Also deletes ${plural(childCount, "sub-agent")}` : "Remove from every list"}>Delete</MenuItem>
        </MenuContent>
      </Menu>
      <Dialog open={Boolean(confirm)} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        {confirm ? (
          <DialogContent title={confirm === "complete" ? "Complete this session?" : confirm === "cancel" ? "Cancel this session?" : "Delete this session?"}>
            <DialogBody>
              <p className="text-sm text-muted">
                {confirm === "complete" && "It closes as done. The transcript, canvases and outputs stay. "}
                {confirm === "cancel" && "It closes as abandoned and stops any running turn. "}
                {confirm === "delete" && "It disappears from every list and stops. Session facts are removed; a deleted summary is kept until an admin prunes it. "}
                {cascade ? <strong className="font-semibold text-fg">{cascade}</strong> : null}
              </p>
            </DialogBody>
            <DialogFooter>
              <Button disabled={busy} onClick={() => setConfirm(null)}>Keep it</Button>
              <Button disabled={busy} variant={confirm === "complete" ? "primary" : "danger"} onClick={() => run(confirm)}>
                {busy ? "Updating session…" : confirm === "complete" ? "Complete" : confirm === "cancel" ? "Cancel session" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

// ── Chat ─────────────────────────────────────────────────────────────────

function ChatPane({ session, sessionId, history, transcriptError, onRetryTranscript, onOpenCanvas }: { session?: Session; sessionId: string; history: ReturnType<typeof useTranscript>["history"]; transcriptError: string | null; onRetryTranscript: () => void; onOpenCanvas: (slot?: number) => void }) {
  const { source } = useSource();
  const refresh = useRefresh();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [answering, setAnswering] = React.useState(false);
  // Hide the question as soon as the answer is accepted; the session poll catches up after.
  const [answered, setAnswered] = React.useState<string | null>(null);
  const [modelOpen, setModelOpen] = React.useState(false);
  const st = sessionState(session);
  const items = history?.chat || [];
  // "New since you were here": remember when this reader last left this session.
  const lastSeenAt = React.useMemo(() => readLastSeen(sessionId), [sessionId]);
  React.useEffect(() => {
    const mark = () => writeLastSeen(sessionId);
    const onVis = () => { if (document.visibilityState === "hidden") mark(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); mark(); };
  }, [sessionId]);
  const hasWarning = items.some((i) => i.kind === "session-warning");
  const agent = session?.agentId || "agent";

  // Follow the bottom while the reader is at the bottom; never yank them back up.
  const atBottom = React.useRef(true);
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [items.length, session?.pendingQuestion?.question]);

  // Announce only what is new: the latest agent reply or question, never the whole transcript.
  const lastAgent = [...items].reverse().find((i) => i.role === "assistant");
  const announcement = st.key === "needs" && session?.pendingQuestion && answered !== session.pendingQuestion.question
    ? `${agent} is asking: ${session.pendingQuestion.question}`
    : lastAgent ? `${agent}: ${String(lastAgent.text || "").slice(0, 300)}` : "";
  const [spoken, setSpoken] = React.useState("");
  const firstLoad = React.useRef(true);
  React.useEffect(() => {
    if (!history) return;
    // Don't read out the backlog when the page opens; only changes after that.
    if (firstLoad.current) { firstLoad.current = false; return; }
    setSpoken(announcement);
  }, [announcement, history]);

  // The answer carries the question it was given for, so a question that changed meanwhile is never answered by mistake.
  // Failures throw: the answer controls report them.
  const answer = async (text: string, q: PendingQuestion) => {
    setAnswering(true);
    try {
      await source.sendAnswer(sessionId, text, q);
      setAnswered(questionKey(sessionId, q));
      refresh(sessionId);
      // The card unmounts; put focus somewhere useful instead of <body>.
      window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(".fd-composer textarea")?.focus(), 0);
    } finally { setAnswering(false); }
  };
  // There is no "restart this turn" operation in the API. Asking the agent to retry is the honest
  // equivalent, so the message says what it is instead of replaying the user's last message.
  const retryMessage = React.useCallback(
    () => `[Sent from Flight Deck] The last turn failed (${describeError(session?.error).headline.toLowerCase()}). Please retry from where you left off.`,
    [session?.error],
  );
  const { retry } = useRetry(sessionId, retryMessage);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="status" aria-live="polite" className="sr-only">{spoken}</div>
      <div
        ref={scrollRef}
        onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto max-w-[760px] px-4 py-5 md:px-5">
          {transcriptError ? (
            <Card role="alert" className="p-4">
              <h2 className="text-sm font-semibold">Couldn't load the conversation</h2>
              <p className="mt-1 text-sm text-muted">{transcriptError}</p>
              <p className="mt-1 text-xs text-muted">The session may still be working. Try loading the conversation again; your draft stays here.</p>
              <Button className="mt-3" size="sm" onClick={onRetryTranscript}>Try again</Button>
            </Card>
          ) : !history ? (
            <div className="flex flex-col gap-4"><Skeleton className="ml-auto h-16 w-3/4" /><Skeleton className="h-20 w-5/6" /><Skeleton className="h-9 w-2/3" /></div>
          ) : items.length === 0 && !session?.error ? (
            <EmptyState title="Nothing here yet" className="py-16">Send the first message below. The agent replies here; anything it draws or writes shows up in Canvas and Files.</EmptyState>
          ) : (
            <Transcript items={items} sessionId={sessionId} agentName={agent} onOpenCanvas={onOpenCanvas} errorActions={st.key === "failed" && session && !sessionIsViewOnly(session) ? { onRetry: retry, onSwitchModel: () => setModelOpen(true) } : undefined} lastSeenAt={lastSeenAt} />
          )}
          {st.key === "failed" && session?.error && !hasWarning ? (
            <div className="mt-4"><StructuredErrorCard raw={session.error} onRetry={sessionIsViewOnly(session) ? undefined : retry} onSwitchModel={sessionIsViewOnly(session) || session.canManage === false ? undefined : () => setModelOpen(true)} /></div>
          ) : null}
          {st.key === "needs" && session?.pendingQuestion && sessionIsViewOnly(session) ? (
            <Card className="mt-4 p-4">
              <h2 className="text-sm font-semibold">The agent is waiting for an answer</h2>
              <p className="mt-2 text-sm">{session.pendingQuestion.question}</p>
              <p className="mt-2 text-sm text-muted">You have view-only access. A writer needs to answer this question.</p>
            </Card>
          ) : null}
          {st.key === "needs" && session?.pendingQuestion && !sessionIsViewOnly(session) && answered !== questionKey(sessionId, session.pendingQuestion) ? (
            <div className="mt-4"><QuestionCard sessionId={sessionId} question={session.pendingQuestion} agentName={agent} onAnswer={answer} busy={answering} /></div>
          ) : null}
          {st.key === "running" ? (
            <p className="mt-4 flex items-center gap-2 pl-9 text-sm text-muted" aria-live="polite"><span className="size-1.5 rounded-full bg-live motion-safe:animate-pulse-live" aria-hidden />{session?.step || "Working"}…</p>
          ) : null}
        </div>
      </div>
      {session ? <Composer key={session.sessionId} session={session} /> : null}
      {session ? <ChangeModelDialog open={modelOpen} onOpenChange={setModelOpen} session={session} /> : null}
    </div>
  );
}

const SEEN_KEY = (id: string) => `fd.lastSeen.${id}`;
function readLastSeen(id: string): number {
  try { return Number(localStorage.getItem(SEEN_KEY(id))) || 0; } catch { return 0; }
}
function writeLastSeen(id: string) {
  try { localStorage.setItem(SEEN_KEY(id), String(Date.now())); } catch { /* storage can be blocked; the divider just won't show */ }
}

// A data-source identity separates demo/live data and never persists message drafts to disk.
const composerMemories = new WeakMap<object, ReturnType<typeof createSessionComposerMemory>>();
function sessionComposer(source: object, sessionId: string) {
  let memory = composerMemories.get(source);
  if (!memory) { memory = createSessionComposerMemory(); composerMemories.set(source, memory); }
  return memory.session(sessionId);
}

function Composer({ session }: { session: Session }) {
  const { source } = useSource();
  const refresh = useRefresh();
  const composer = React.useMemo(() => sessionComposer(source, session.sessionId), [source, session.sessionId]);
  const { text, queued, sending: busy, stopping } = React.useSyncExternalStore(composer.subscribe, composer.getSnapshot, composer.getSnapshot);
  const st = sessionState(session);
  const running = st.key === "running";
  const closed = st.key === "completed" || st.key === "cancelled";
  const readOnly = sessionIsViewOnly(session);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const att = useAttachments(session.sessionId);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const hasAttachments = att.ready.length > 0;
  const canSend = (Boolean(text.trim()) || hasAttachments) && !att.uploading;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(220, el.scrollHeight)}px`;
  }, [text]);

  const send = async (mode: "send" | "queue" | "steer") => {
    if (readOnly || att.uploading) return;
    // Pictures and files can be sent on their own: give the message the words the tray implies.
    if (!composer.getSnapshot().text.trim() && hasAttachments) composer.setText(buildAttachedMessage(session.sessionId, "", att.ready).prompt.split("\n\n").pop() || "See the attached file.");
    const request = composer.beginSend();
    if (!request) return;
    const prompt = request.text;
    let result: "sent" | "queued" | "failed" = "failed";
    try {
      if (mode === "steer") {
        const outcome = await source.steerTurn(session.sessionId, prompt);
        if (outcome !== "accepted") throw new Error(outcome === "steering_disabled" ? "Steering is turned off for this deployment (feature flag sessions.steering)." : `The turn did not accept it (${outcome}).`);
        toast.success("Guidance added to the running turn");
      } else if (hasAttachments) {
        await sendWithAttachments(source, session.sessionId, buildAttachedMessage(session.sessionId, prompt, att.ready), mode === "queue" ? { enqueueOnly: true } : undefined);
      } else if (mode === "queue") {
        await source.sendMessage(session.sessionId, prompt, { enqueueOnly: true });
      } else {
        await source.sendMessage(session.sessionId, prompt);
      }
      if (mode !== "steer") att.clear();
      result = mode === "queue" ? "queued" : "sent";
      refresh(session.sessionId);
    } catch (e: any) {
      toast.error(mode === "steer" ? "Couldn't steer" : "Couldn't send", { description: `${session.title || "Session"}: ${e?.message || "Please try again."}` });
    } finally {
      composer.finishSend(request, result);
    }
  };

  const stop = async () => {
    if (readOnly || !composer.beginStop()) return;
    try {
      const outcome = await source.stopTurn(session.sessionId);
      if (outcome === "stopped" || outcome === "stop_forced") toast.success("Stopped this turn", { description: "Its unfinished work was discarded." });
      else if (outcome === "no_active_turn") toast.info("Nothing was running");
      else if (outcome === "too_late") toast.info("The turn finished before it could be stopped");
      else toast.warning("Stop has not been confirmed", { description: "Check the session's state before trying again." });
      refresh(session.sessionId);
    } catch (e: any) { toast.error("Couldn't stop", { description: e?.message }); }
    finally { composer.finishStop(); }
  };

  if (closed) {
    return (
      <div className="shrink-0 border-t border-line px-4 py-3 text-center text-sm text-muted md:px-5">
        This session is {st.word.toLowerCase()}. Its transcript and outputs stay here.
      </div>
    );
  }

  return (
    <div className="fd-composer shrink-0 border-t border-line bg-bg px-3 pb-3 pt-2 md:px-5">
      <div className="mx-auto max-w-[760px]">
        {queued.length ? <p className="mb-2 text-xs text-muted">Messages below are already queued. Dismissing a notice does not cancel delivery.</p> : null}
        {queued.map((q, i) => (
          <div key={i} className="mb-2 flex items-center gap-2 rounded-control border border-dashed border-line-strong px-3 py-1.5 text-sm">
            <ListPlus className="size-4 shrink-0 text-muted" aria-hidden />
            <span className="shrink-0 text-xs text-muted">Queued</span>
            <span className="min-w-0 flex-1 truncate">{q}</span>
            <Button size="sm" variant="quiet" onClick={() => composer.dismissNotice(i)} title="Dismisses this notice. The queued message will still run.">Dismiss notice</Button>
          </div>
        ))}
        {readOnly ? <p className="mb-2 flex items-center gap-1.5 text-sm text-muted"><Lock className="size-3.5" aria-hidden /> View-only access: you can read this session but not reply.</p> : null}
        <div
          className={cn("relative rounded-pane border border-line-strong bg-surface transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent", readOnly && "bg-raised", dragging && "border-accent bg-accent-tint")}
          onDragOver={(e) => { if (!readOnly && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
          onDrop={(e) => { setDragging(false); if (readOnly || !e.dataTransfer.files.length) return; e.preventDefault(); void att.add(Array.from(e.dataTransfer.files)); }}
        >
          {dragging ? <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-pane text-sm font-medium text-accent">Drop to attach</div> : null}
          <AttachmentTray items={att.items} onRemove={att.remove} />
          <Textarea
            ref={ref}
            rows={2}
            value={text}
            disabled={Boolean(readOnly)}
            onChange={(e) => composer.setText(e.target.value)}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files || []);
              if (!files.length || readOnly) return;
              e.preventDefault();
              void att.add(files);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (canSend && !busy) void send(running ? "queue" : "send");
              }
            }}
            placeholder={readOnly ? "Replies are off for you" : running ? `Add to the queue, or steer ${session.agentId || "the agent"}…` : `Message ${session.agentId || "the agent"}…`}
            aria-label="Message"
            className="min-h-[52px] border-0 bg-transparent focus-visible:ring-0"
          />
          <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
            <span className="hidden text-xs text-muted sm:inline">{running ? "Enter queues it · Steer adds it to this turn" : "Enter to send · Shift+Enter for a new line"}</span>
            <input ref={fileInput} type="file" multiple hidden tabIndex={-1} aria-hidden onChange={(e) => { void att.add(Array.from(e.target.files || [])); e.target.value = ""; }} />
            <Tooltip content="Attach images or files. You can also drop or paste them here.">
              <span className="ml-auto"><Button size="icon-sm" variant="quiet" disabled={Boolean(readOnly)} aria-label="Attach images or files" onClick={() => fileInput.current?.click()}><Paperclip /></Button></span>
            </Tooltip>
            {running ? (
              <>
                <Tooltip content="Ends this turn now and discards its unfinished work">
                  <Button size="sm" variant="danger" disabled={readOnly || stopping} onClick={stop}><Square className="!size-3 fill-current" /> {stopping ? "Stopping…" : "Stop"}</Button>
                </Tooltip>
                <Tooltip content={session.acceptsTurnControl === false ? "This turn can't be steered (older runtime)" : att.items.length ? "Steering takes text only. Remove the attachments, or queue this message instead." : "Adds your message as guidance to the running turn"}>
                  <span><Button size="sm" disabled={!text.trim() || busy || readOnly || session.acceptsTurnControl === false || att.items.length > 0} onClick={() => send("steer")}><Navigation /> Steer</Button></span>
                </Tooltip>
                <Button size="sm" variant="primary" disabled={!canSend || busy || readOnly} onClick={() => send("queue")}><ListPlus /> Queue</Button>
              </>
            ) : (
              <Button size="sm" variant="primary" disabled={!canSend || busy || Boolean(readOnly)} onClick={() => send("send")}><ArrowUp /> {att.uploading ? "Uploading…" : "Send"}</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Companion ───────────────────────────────────────────────────────────

function CompanionPane({ view, session, history, search, setSearch, tabsMode, phone }: { view: Companion; session?: Session; history: ReturnType<typeof useTranscript>["history"]; search: ReturnType<typeof route.useSearch>; setSearch: (p: Record<string, unknown>, replace?: boolean) => void; tabsMode: boolean; phone: boolean }) {
  if (!session) return <div className="p-4"><Skeleton className="h-64" /></div>;
  switch (view) {
    case "canvas":
      return <CanvasView session={session} slot={search.slot} focus={Boolean(search.focus)} phone={phone} onSlot={(slot) => setSearch({ slot }, true)} onFocus={(v) => setSearch({ focus: v || undefined })} onUsePrompt={(prompt) => { if (tabsMode) { setSearch({ view: "chat", focus: undefined }); window.setTimeout(() => fillComposer(prompt), 80); } else fillComposer(prompt); }} />;
    case "files":
      return <FilesView session={session} tab={search.files || "outputs"} file={search.file} onTab={(t) => setSearch({ files: t, file: undefined }, true)} onFile={(f) => setSearch({ file: f }, true)} />;
    case "delegation":
      return <DelegationView session={session} />;
    case "activity":
      return <ActivityView session={session} history={history} tab={search.activity || "timeline"} onTab={(t) => setSearch({ activity: t }, true)} />;
  }
}

