import * as React from "react";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { Group, Panel as SplitPanel, Separator, useDefaultLayout } from "react-resizable-panels";
import {
  Activity, ArrowUp, Ban, PanelRightClose, Check, CheckCircle2, Copy, ExternalLink, FolderGit2, Files, GitBranch, Globe, LayoutPanelLeft, ListPlus, Lock, MoreHorizontal, Navigation, Paperclip, Pencil, Share2, Square, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { TopBar, ClassicLink } from "@/shell/AppShell";
import { useMediaQuery } from "@/shell/prefs";
import { useArtifacts, useModels, useRefresh, useSession, useSessions, useSource, useTranscript } from "@/data/source";
import { modelShort, sessionState, type SessionState } from "@/data/state";
import type { Session } from "@/data/types";
import { StatePill } from "@/components/state";
import { QuestionCard, Transcript } from "@/components/chat";
import { StructuredErrorCard } from "@/components/structured-error";
import { EmptyState } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/misc";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { ActivityView, CanvasView, DelegationView, FilesView, useCanvases } from "./session-views";
import { cn, plural, shortId } from "@/lib/utils";
import type { SessionView } from "@/router";
import { isCanvasFile } from "./home";
import { rovingKeyDown } from "@/lib/roving";

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
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { session, missing } = useSession(sessionId);
  const { history } = useTranscript(sessionId);
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

  const crumbs = [
    { label: "Sessions", to: "/sessions" },
    ...(parent ? [{ label: parent.title || "Parent", to: "/s/$sessionId", params: { sessionId: parent.sessionId } }] : []),
    { label: session?.title || "Session" },
  ];

  const chat = <ChatPane session={session} sessionId={sessionId} history={history} onOpenCanvas={(slot) => setSearch({ view: "canvas", slot })} />;
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
      <TopBar crumbs={crumbs} titleIsHeading={false} />
      {session ? <SessionHeader session={session} childCount={children.length} /> : <HeaderSkeleton />}
      <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col">
        {tabsMode ? (
          <>
            <ViewTabs view={view} counts={counts} onView={setView} includeChat canvasUpdated={Boolean(session?.unseenCanvas)} needsBadge={sessionState(session).key === "needs" || sessionState(session).key === "failed"} />
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
      <Separator className="group relative w-px bg-line outline-none data-[separator=hover]:bg-accent/60 data-[separator=active]:bg-accent focus-visible:bg-accent" aria-label="Resize chat and companion">
        <span className="absolute inset-y-0 -left-1.5 -right-1.5" aria-hidden />
      </Separator>
      <SplitPanel id="companion" minSize="400px">{companion}</SplitPanel>
    </Group>
  );
}

function ViewTabs({ view, counts, onView, includeChat = false, closable = false, onClose, needsBadge = false, canvasUpdated = false }: { view: SessionView; counts: Partial<Record<SessionView, number>>; onView: (v: SessionView) => void; includeChat?: boolean; closable?: boolean; onClose?: () => void; needsBadge?: boolean; canvasUpdated?: boolean }) {
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
            {counts[v] ? <span className={cn("font-mono text-xs tabular-nums text-faint", includeChat && "max-sm:absolute max-sm:right-2 max-sm:top-1 max-sm:text-xs")}>{counts[v]}</span> : null}
            {v === "chat" && needsBadge && view !== "chat" ? <span className="size-1.5 rounded-full bg-accent max-sm:absolute max-sm:left-[calc(50%+10px)] max-sm:top-2" aria-label="needs attention" /> : null}
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

function HeaderSkeleton() {
  return (
    <div className="border-b border-line px-5 py-3">
      <Skeleton className="h-6 w-64" />
      <Skeleton className="mt-2 h-5 w-96 max-w-full" />
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────

function SessionHeader({ session, childCount }: { session: Session; childCount: number }) {
  const st = sessionState(session);
  const { source } = useSource();
  const refresh = useRefresh();
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(session.title || "");
  React.useEffect(() => setTitle(session.title || ""), [session.title]);
  const save = async () => {
    setEditing(false);
    const next = title.trim();
    if (!next || next === session.title) return setTitle(session.title || "");
    try { await source.renameSession(session.sessionId, next); refresh(session.sessionId); toast.success("Renamed"); }
    catch (e: any) { setTitle(session.title || ""); toast.error("Couldn't rename", { description: e?.message }); }
  };
  return (
    <div className="flex shrink-0 flex-wrap items-start gap-x-4 gap-y-2 border-b border-line px-4 py-3 md:px-5">
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") { setTitle(session.title || ""); setEditing(false); } }}
            className="h-8 max-w-[520px] text-lg font-semibold"
            aria-label="Session title"
          />
        ) : (
          <h1 className="truncate text-lg font-semibold tracking-tight">
            <button type="button" className="max-w-full truncate rounded-chip text-left hover:bg-raised pointer-coarse:min-h-11" onClick={() => setEditing(true)} title="Rename">{session.title || "Untitled session"}</button>
          </h1>
        )}
        <div className="fd-session-meta mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted">
          <StatePillWithSchedule state={st} session={session} />
          <span className="font-mono text-sm">{session.agentId || "generic"}</span>
          {/* Phones keep the state and the agent; the rest is one tap away in the ⋯ menu. */}
          <span className="hidden items-center gap-x-2.5 sm:inline-flex">
            <span aria-hidden className="text-faint">·</span>
            <span className="font-mono text-sm">{modelShort(session.model)}</span>
            {session.workspace?.repo ? (
              <>
                <span aria-hidden className="text-faint">·</span>
                <span className="inline-flex items-center gap-1 font-mono text-sm"><FolderGit2 className="size-3.5" aria-hidden />{session.workspace.repo}{session.workspace.branch ? ` @ ${session.workspace.branch}` : ""}</span>
              </>
            ) : null}
            <span aria-hidden className="text-faint">·</span>
            <VisibilityLabel visibility={session.visibility} />
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <ShareDialog session={session} />
        <SessionMenu session={session} childCount={childCount} onRename={() => setEditing(true)} />
      </div>
    </div>
  );
}

function VisibilityLabel({ visibility }: { visibility?: string }) {
  const v = visibility || "private";
  const Icon = v === "private" ? Lock : v === "shared_write" ? Users : Globe;
  const label = v === "private" ? "Private" : v === "shared_write" ? "Shared · can reply" : "Shared · view only";
  return <span className="inline-flex items-center gap-1 text-sm"><Icon className="size-3.5" aria-hidden />{label}</span>;
}

/** When a session runs on a schedule, its state pill opens the schedule. */
function StatePillWithSchedule({ state, session }: { state: SessionState; session: Session }) {
  if (state.waitKind !== "schedule" && state.waitKind !== "timer") return <StatePill state={state} size="sm" />;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-full" aria-label={`${state.word}, ${state.reason}. Show schedule`}>
          <StatePill state={state} size="sm" />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="text-sm font-semibold">{state.waitKind === "schedule" ? "Runs on a schedule" : "Waiting on a timer"}</div>
        <dl className="mt-2 grid grid-cols-[100px_1fr] gap-y-1 text-sm">
          <dt className="text-muted">Next run</dt><dd className="font-mono tabular-nums">{state.next || "—"}</dd>
          {state.waitKind === "schedule" ? <><dt className="text-muted">Interval</dt><dd>{state.reason?.replace(/^schedule · /, "")}</dd></> : null}
          <dt className="text-muted">Time zone</dt><dd>{Intl.DateTimeFormat().resolvedOptions().timeZone}</dd>
          <dt className="text-muted">Runs so far</dt><dd className="tabular-nums">{session.iterations ?? "—"}</dd>
        </dl>
        <p className="mt-3 text-xs text-faint">Pause, Cancel schedule and Wake now arrive when the API supports them.</p>
      </PopoverContent>
    </Popover>
  );
}

function ShareDialog({ session }: { session: Session }) {
  const link = `${window.location.origin}/s/${session.sessionId}`;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="md" aria-label="Share"><Share2 /> <span className="hidden sm:inline">Share</span></Button>
      </DialogTrigger>
      <DialogContent title={`Share “${session.title}”`} description="Who can open this session and its sub-agents.">
        <DialogBody className="flex flex-col gap-4">
          <div>
            <div className="mb-1.5 text-sm font-medium">General access</div>
            <div className="flex items-center gap-2 rounded-control border border-line px-3 py-2"><VisibilityLabel visibility={session.visibility} /></div>
            <p className="mt-1.5 text-xs text-muted">Changing access and adding people is not ported yet: <ClassicLink>use the classic portal</ClassicLink>. When the deployment does not enforce ownership, everyone signed in can open every session.</p>
          </div>
          <div>
            <div className="mb-1.5 text-sm font-medium">Link</div>
            <div className="flex gap-2">
              <Input readOnly value={link} aria-label="Session link" className="font-mono text-xs" />
              <Button onClick={() => { void navigator.clipboard?.writeText(link); toast.success("Link copied"); }}><Copy /> Copy</Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}


function SessionMenu({ session, childCount, onRename }: { session: Session; childCount: number; onRename: () => void }) {
  const { source } = useSource();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [confirm, setConfirm] = React.useState<null | "complete" | "cancel" | "delete">(null);
  const [model, setModel] = React.useState(false);
  const cascade = childCount ? `Also ${confirm === "delete" ? "deletes" : "cancels"} ${plural(childCount, "sub-agent")}.` : "";
  const run = async (kind: "complete" | "cancel" | "delete") => {
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
    }
  };
  const closed = ["completed", "cancelled"].includes(sessionState(session).key);
  return (
    <>
      <Menu>
        <MenuTrigger asChild><Button variant="quiet" size="icon" aria-label="Session menu"><MoreHorizontal /></Button></MenuTrigger>
        <MenuContent className="w-[260px]">
          <MenuItem icon={<Pencil />} onSelect={onRename}>Rename</MenuItem>
          <MenuItem icon={<Copy />} onSelect={() => { void navigator.clipboard?.writeText(window.location.href); toast.success("Link copied"); }}>Copy link</MenuItem>
          <MenuItem icon={<ArrowUp className="rotate-45" />} onSelect={() => setModel(true)} hint={modelShort(session.model)}>Change model</MenuItem>
          <MenuItem icon={<ExternalLink />} onSelect={() => window.open(import.meta.env.VITE_CLASSIC_URL || "http://localhost:3001", "_blank", "noopener")} hint="Group, working folder, export history">More in classic portal</MenuItem>
          <MenuSeparator />
          <MenuLabel>Close the session</MenuLabel>
          <MenuItem icon={<CheckCircle2 />} disabled={closed} onSelect={() => setConfirm("complete")} hint="Close as done">Complete</MenuItem>
          <MenuItem icon={<Ban />} danger disabled={closed} onSelect={() => setConfirm("cancel")} hint={childCount ? `Also cancels ${plural(childCount, "sub-agent")}` : "Close as abandoned"}>Cancel</MenuItem>
          <MenuItem icon={<Trash2 />} danger onSelect={() => setConfirm("delete")} hint={childCount ? `Also deletes ${plural(childCount, "sub-agent")}` : "Remove from every list"}>Delete</MenuItem>
        </MenuContent>
      </Menu>
      <Dialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
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
              <Button onClick={() => setConfirm(null)}>Keep it</Button>
              <Button variant={confirm === "complete" ? "primary" : "danger"} onClick={() => run(confirm)}>
                {confirm === "complete" ? "Complete" : confirm === "cancel" ? "Cancel session" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
      <ChangeModelDialog open={model} onOpenChange={setModel} session={session} />
    </>
  );
}

export function ChangeModelDialog({ open, onOpenChange, session }: { open: boolean; onOpenChange: (v: boolean) => void; session: Session }) {
  const { data: models } = useModels();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Change model" description="The next turn uses the new model. Only models the workers can run are offered.">
        <DialogBody className="flex flex-col gap-1.5">
          {(models || []).map((m) => (
            <div key={m.qualifiedName} className={cn("flex items-center gap-3 rounded-control border px-3 py-2", m.qualifiedName === session.model ? "border-accent bg-accent-tint" : "border-line")}>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-sm">{m.modelName} <span className="text-faint">· {m.providerId}</span></div>
                <div className="truncate text-xs text-muted">{m.credentialAvailable === false ? m.unavailableReason || "Unavailable: no credential" : m.description}</div>
              </div>
              {m.qualifiedName === session.model ? <Check className="size-4 text-accent" aria-label="Current" /> : null}
            </div>
          ))}
          <p className="mt-2 text-xs text-muted">Switching is not wired in this preview build; <ClassicLink>change the model in the classic portal</ClassicLink>.</p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

// ── Chat ─────────────────────────────────────────────────────────────────

function ChatPane({ session, sessionId, history, onOpenCanvas }: { session?: Session; sessionId: string; history: ReturnType<typeof useTranscript>["history"]; onOpenCanvas: (slot?: number) => void }) {
  const { source } = useSource();
  const refresh = useRefresh();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [answering, setAnswering] = React.useState(false);
  // Hide the question as soon as the answer is accepted; the session poll catches up after.
  const [answered, setAnswered] = React.useState<string | null>(null);
  const [modelOpen, setModelOpen] = React.useState(false);
  const st = sessionState(session);
  const items = history?.chat || [];
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

  const answer = async (text: string) => {
    if (!session) return;
    setAnswering(true);
    try {
      await source.sendAnswer(sessionId, text, session.pendingQuestion);
      setAnswered(session.pendingQuestion?.question || "");
      refresh(sessionId);
      // The card unmounts; put focus somewhere useful instead of <body>.
      window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(".fd-composer textarea")?.focus(), 0);
    }
    catch (e: any) { toast.error("Couldn't send your answer", { description: e?.message }); }
    finally { setAnswering(false); }
  };
  const retry = async () => {
    const lastUser = [...items].reverse().find((i) => i.role === "user");
    try { await source.sendMessage(sessionId, String(lastUser?.text || "Please retry the last step.")); refresh(sessionId); toast.success("Retry sent"); }
    catch (e: any) { toast.error("Couldn't retry", { description: e?.message }); }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="status" aria-live="polite" className="sr-only">{spoken}</div>
      <div
        ref={scrollRef}
        onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto max-w-[760px] px-4 py-5 md:px-5">
          {!history ? (
            <div className="flex flex-col gap-4"><Skeleton className="ml-auto h-16 w-3/4" /><Skeleton className="h-20 w-5/6" /><Skeleton className="h-9 w-2/3" /></div>
          ) : items.length === 0 && !session?.error ? (
            <EmptyState title="Nothing here yet" className="py-16">Send the first message below. The agent replies here; anything it draws or writes shows up in Canvas and Files.</EmptyState>
          ) : (
            <Transcript items={items} sessionId={sessionId} agentName={agent} onOpenCanvas={onOpenCanvas} errorActions={st.key === "failed" ? { onRetry: retry, onSwitchModel: () => setModelOpen(true) } : undefined} />
          )}
          {st.key === "failed" && session?.error && !hasWarning ? (
            <div className="mt-4"><StructuredErrorCard raw={session.error} onRetry={retry} onSwitchModel={() => setModelOpen(true)} /></div>
          ) : null}
          {st.key === "needs" && session?.pendingQuestion && answered !== session.pendingQuestion.question ? (
            <div className="mt-4"><QuestionCard question={session.pendingQuestion} agentName={agent} onAnswer={answer} busy={answering} /></div>
          ) : null}
          {st.key === "running" ? (
            <p className="mt-4 flex items-center gap-2 pl-9 text-sm text-muted" aria-live="polite"><span className="size-1.5 animate-pulse-live rounded-full bg-live" aria-hidden />{session?.step || "Working"}…</p>
          ) : null}
        </div>
      </div>
      {session ? <Composer session={session} /> : null}
      {session ? <ChangeModelDialog open={modelOpen} onOpenChange={setModelOpen} session={session} /> : null}
    </div>
  );
}

function Composer({ session }: { session: Session }) {
  const { source } = useSource();
  const refresh = useRefresh();
  const [text, setText] = React.useState("");
  const [queued, setQueued] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const st = sessionState(session);
  const running = st.key === "running";
  const closed = st.key === "completed" || st.key === "cancelled";
  const readOnly = session.visibility === "shared_read" && session.owner && session.owner !== "me";
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(220, el.scrollHeight)}px`;
  }, [text]);

  const send = async (mode: "send" | "queue" | "steer") => {
    const prompt = text.trim();
    if (!prompt) return;
    setBusy(true);
    try {
      if (mode === "steer") {
        const outcome = await source.steerTurn(session.sessionId, prompt);
        if (outcome !== "accepted") throw new Error(outcome === "steering_disabled" ? "Steering is turned off for this deployment (feature flag sessions.steering)." : `The turn did not accept it (${outcome}).`);
        toast.success("Guidance added to the running turn");
      } else if (mode === "queue") {
        await source.sendMessage(session.sessionId, prompt, { enqueueOnly: true });
        setQueued((q) => [...q, prompt]);
      } else {
        await source.sendMessage(session.sessionId, prompt);
      }
      setText("");
      refresh(session.sessionId);
    } catch (e: any) {
      toast.error(mode === "steer" ? "Couldn't steer" : "Couldn't send", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    try {
      const outcome = await source.stopTurn(session.sessionId);
      toast.success(outcome === "no_active_turn" ? "Nothing was running" : "Stopped this turn", { description: "Its unfinished work was discarded." });
      refresh(session.sessionId);
    } catch (e: any) { toast.error("Couldn't stop", { description: e?.message }); }
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
        {queued.map((q, i) => (
          <div key={i} className="mb-2 flex items-center gap-2 rounded-control border border-dashed border-line-strong px-3 py-1.5 text-sm">
            <ListPlus className="size-4 shrink-0 text-muted" aria-hidden />
            <span className="shrink-0 text-xs text-muted">Queued</span>
            <span className="min-w-0 flex-1 truncate">{q}</span>
            <Button size="sm" variant="quiet" onClick={() => setQueued((list) => list.filter((_, j) => j !== i))}>Remove</Button>
          </div>
        ))}
        {readOnly ? <p className="mb-2 flex items-center gap-1.5 text-sm text-muted"><Lock className="size-3.5" aria-hidden /> View-only access: you can read this session but not reply.</p> : null}
        <div className={cn("rounded-pane border border-line-strong bg-surface transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent", readOnly && "bg-raised")}>
          <Textarea
            ref={ref}
            rows={2}
            value={text}
            disabled={Boolean(readOnly)}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(running ? "queue" : "send");
              }
            }}
            placeholder={readOnly ? "Replies are off for you" : running ? `Add to the queue, or steer ${session.agentId || "the agent"}…` : `Message ${session.agentId || "the agent"}…`}
            aria-label="Message"
            className="min-h-[52px] border-0 bg-transparent focus-visible:ring-0"
          />
          <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
            <span className="hidden text-xs text-faint sm:inline">{running ? "Enter queues it · Steer adds it to this turn" : "Enter to send · Shift+Enter for a new line"}</span>
            <Tooltip content="Attaching files is in the classic portal for now">
              <span className="ml-auto"><Button size="icon-sm" variant="quiet" disabled aria-label="Attach a file"><Paperclip /></Button></span>
            </Tooltip>
            {running ? (
              <>
                <Tooltip content="Ends this turn now and discards its unfinished work">
                  <Button size="sm" variant="danger" onClick={stop}><Square className="!size-3 fill-current" /> Stop</Button>
                </Tooltip>
                <Tooltip content={session.acceptsTurnControl === false ? "This turn can't be steered (older runtime)" : "Adds your message as guidance to the running turn"}>
                  <span><Button size="sm" disabled={!text.trim() || busy || session.acceptsTurnControl === false} onClick={() => send("steer")}><Navigation /> Steer</Button></span>
                </Tooltip>
                <Button size="sm" variant="primary" disabled={!text.trim() || busy} onClick={() => send("queue")}><ListPlus /> Queue</Button>
              </>
            ) : (
              <Button size="sm" variant="primary" disabled={!text.trim() || busy || Boolean(readOnly)} onClick={() => send("send")}><ArrowUp /> Send</Button>
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
  void tabsMode;
  switch (view) {
    case "canvas":
      return <CanvasView session={session} slot={search.slot} focus={Boolean(search.focus)} phone={phone} onSlot={(slot) => setSearch({ slot }, true)} onFocus={(v) => setSearch({ focus: v || undefined })} />;
    case "files":
      return <FilesView session={session} tab={search.files || "outputs"} file={search.file} onTab={(t) => setSearch({ files: t, file: undefined }, true)} onFile={(f) => setSearch({ file: f }, true)} />;
    case "delegation":
      return <DelegationView session={session} />;
    case "activity":
      return <ActivityView session={session} history={history} tab={search.activity || "timeline"} onTab={(t) => setSearch({ activity: t }, true)} />;
  }
}

