import * as React from "react";
import { useIntent } from "@/shell/intents";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Download, FileText, Folder, GitBranch, Lock, Maximize2, Minimize2, MoreHorizontal, Settings2, Share2, Square, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import type { HistoryModel } from "@ps/history";
import { useArtifacts, useRefresh, useSessions, useSource, useWorkers } from "@/data/source";
import { describeError, sessionState } from "@/data/state";
import type { Artifact, LogEntry, Session } from "@/data/types";
import { CanvasFrame, canvasName } from "@/canvas/CanvasFrame";
import { StateGlyph, StatePill } from "@/components/state";
import { EmptyState, Panel } from "@/components/empty";
import { Markdown } from "@/components/chat";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/tabs";
import { Chip, Skeleton, Tag } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/confirm";
import { dirtyDrafts, useDirtyDrafts } from "@/components/session/files/drafts";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { FolderPane } from "@/components/session/files/folder-pane";
import { ShareCanvasDialog } from "@/components/session/share-canvas-dialog";
import { WorkingFolderDialog } from "@/components/session/working-folder-dialog";
import { errorCode, useWorkspaceFolders } from "@/data/ops/workspace";
import { useOpMutation } from "@/data/ops/use-op";
import { ago, bytes, clock, cn, plural, shortId } from "@/lib/utils";
import { describeEvent, eventTime, statLabel } from "@/lib/event-text";
import { fillComposer } from "@/lib/composer";
import { cardVariants } from "@/components/ui/card";
import { canvasSlot, isCanvasFile } from "./home";
import { rovingKeyDown } from "@/lib/roving";

// ── Canvas ───────────────────────────────────────────────────────────────

export function useCanvases(sessionId: string) {
  const { data: artifacts, isLoading } = useArtifacts(sessionId);
  const { source } = useSource();
  const files = React.useMemo(
    () => (artifacts || []).filter((a) => isCanvasFile(a.filename)).sort((a, b) => canvasSlot(a.filename) - canvasSlot(b.filename)),
    [artifacts],
  );
  const contents = useQuery({
    queryKey: ["canvas-html", sessionId, files.map((f) => `${f.filename}@${f.updatedAt}`).join(",")],
    queryFn: async () => Object.fromEntries(await Promise.all(files.map(async (f) => [f.filename, await source.readArtifact(sessionId, f.filename)] as const))),
    enabled: files.length > 0,
    staleTime: 5_000,
  });
  return {
    loading: isLoading || (files.length > 0 && contents.isLoading),
    canvases: files.map((f) => ({ ...f, slot: canvasSlot(f.filename), html: contents.data?.[f.filename] || "", name: canvasName(contents.data?.[f.filename], canvasSlot(f.filename)) })),
  };
}

export function CanvasView({ session, slot, focus, onSlot, onFocus, phone, onUsePrompt }: { session: Session; slot?: number; focus: boolean; onSlot: (slot: number) => void; onFocus: (v: boolean) => void; phone?: boolean; onUsePrompt?: (prompt: string) => void }) {
  const { canvases, loading } = useCanvases(session.sessionId);
  const [zoom, setZoom] = React.useState(1);
  const [shareOpen, setShareOpen] = React.useState(false);
  useIntent("share-canvas", `/s/${session.sessionId}`, () => setShareOpen(true));
  const current = canvases.find((c) => c.slot === slot) || canvases[0];
  if (loading) return <div className="p-4"><Skeleton className="h-full min-h-[300px] w-full" /></div>;
  if (!current) {
    return (
      <EmptyState icon={<Square />} title="No canvas yet" className="h-full">
        Agents draw live pages here: checklists, charts, dashboards. Ask for one in the chat, for example
        <span className="mt-2 flex flex-wrap justify-center gap-1.5">
          {["Put a checklist of the remaining work on a canvas", "Chart the results on a canvas"].map((p) => (
            <Chip key={p} onClick={() => (onUsePrompt ? onUsePrompt(p) : fillComposer(p))} title="Put this in the message box">“{p}”</Chip>
          ))}
        </span>
      </EmptyState>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-[44px] shrink-0 items-center gap-1 border-b border-line px-2">
        <div role="tablist" aria-label="Canvases" onKeyDown={rovingKeyDown("tab")} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {canvases.map((c) => (
            <button
              key={c.slot}
              role="tab"
              id={`canvas-tab-${c.slot}`}
              aria-selected={c.slot === current.slot}
              aria-controls="canvas-panel"
              tabIndex={c.slot === current.slot ? 0 : -1}
              onClick={() => onSlot(c.slot)}
              className={cn("focus-inset inline-flex h-control shrink-0 items-center gap-1.5 rounded-control px-2.5 text-sm font-medium", c.slot === current.slot ? "bg-raised text-fg shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-muted hover:text-fg")}
            >
              {c.name}
              {session.unseenCanvas && c.slot === 1 ? <span className="size-1.5 rounded-full bg-accent" role="img" aria-label="updated" /> : null}
            </button>
          ))}
        </div>
        {phone ? null : <span className="hidden shrink-0 text-xs text-muted xl:inline">Updated {ago(current.updatedAt as any)}</span>}
        <Tooltip content="Runs in a sandbox: no network, no popups, links ask first">
          <span className="hidden shrink-0 items-center gap-1 px-1.5 text-xs text-muted sm:inline-flex"><Lock className="size-3.5" aria-hidden /> Sandboxed</span>
        </Tooltip>
        <Tooltip content={focus ? "Exit full width (Esc)" : "Full width"}>
          <Button variant="quiet" size="icon-sm" aria-label={focus ? "Exit full width" : "Full width"} onClick={() => onFocus(!focus)}>{focus ? <Minimize2 /> : <Maximize2 />}</Button>
        </Tooltip>
        <Menu>
          <MenuTrigger asChild><Button variant="quiet" size="icon-sm" aria-label="Canvas options"><MoreHorizontal /></Button></MenuTrigger>
          <MenuContent>
            <MenuItem icon={<ZoomIn />} onSelect={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>Zoom in</MenuItem>
            <MenuItem icon={<ZoomOut />} onSelect={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}>Zoom out</MenuItem>
            <MenuItem icon={<Square />} onSelect={() => setZoom(1)} hint={`Now ${Math.round(zoom * 100)}%`}>Actual size</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Share2 />} onSelect={() => setShareOpen(true)} hint="Links and who can edit">Share canvas…</MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div id="canvas-panel" role="tabpanel" aria-labelledby={`canvas-tab-${current.slot}`} className="min-h-0 flex-1">
        <CanvasFrame key={`${current.slot}`} html={current.html} title={`${current.name} (canvas ${current.slot})`} zoom={zoom} />
      </div>
      <ShareCanvasDialog sessionId={session.sessionId} slot={current.slot} name={current.name} open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}

// ── Files ────────────────────────────────────────────────────────────────

export function FilesView({ session, tab, file, onTab, onFile }: { session: Session; tab: "outputs" | "folders"; file?: string; onTab: (t: "outputs" | "folders") => void; onFile: (f?: string) => void }) {
  const { data: artifacts, isLoading } = useArtifacts(session.sessionId);
  const outputs = (artifacts || []).filter((a) => !isCanvasFile(a.filename));
  const selected = outputs.find((a) => a.filename === file) || null;
  const info = useWorkspaceFolders(session.sessionId);
  const [folderId, setFolderId] = React.useState("working");
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const folders = info.data?.folders ?? [];
  const folder = folders.find((f) => f.id === folderId) ?? folders[0];
  const drafts = useDirtyDrafts(session.sessionId);
  const draftsRef = React.useRef(drafts);
  draftsRef.current = drafts;
  const [leaving, setLeaving] = React.useState<null | (() => void)>(null);
  const go = (v: string) => { if (v === "outputs") onTab("outputs"); else { if (v !== "folders") setFolderId(v); onTab("folders"); } };
  // Switching folders (or to Outputs) leaves the editor behind: ask first, and say what happens to the edits.
  const choose = (v: string) => {
    const here = tab === "outputs" ? "outputs" : folder?.id ?? "folders";
    if (v === here) return;
    // Ask only about the folder being left: a draft kept from an earlier "Leave" is not asked about again.
    if (tab === "folders" && dirtyDrafts(session.sessionId, folder?.id).length) setLeaving(() => () => go(v)); else go(v);
  };
  // Leaving the Files view or the session with unsaved edits asks too; closing the tab uses the browser's own prompt.
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => draftsRef.current.length > 0 && (next.pathname !== current.pathname || (next.search as any)?.view !== (current.search as any)?.view),
    enableBeforeUnload: () => draftsRef.current.length > 0,
    withResolver: true,
  });
  const options = [
    { value: "outputs", label: `Outputs${outputs.length ? ` ${outputs.length}` : ""}` },
    ...(folders.length ? folders.map((f) => ({ value: f.id, label: f.role === "working" && f.home ? "Home" : f.name })) : [{ value: "folders", label: "Folders" }]),
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-[44px] shrink-0 items-center gap-2 border-b border-line px-3">
        {drafts.length ? <Tag tone="waiting">{drafts.length} unsaved</Tag> : null}
        <div className="min-w-0 overflow-x-auto"><Segmented label="Files" value={tab === "outputs" ? "outputs" : folder?.id ?? "folders"} onChange={choose} options={options} /></div>
        {tab === "folders" ? (
          <Tooltip content="Working folder settings"><Button variant="quiet" size="icon-sm" className="ml-auto" aria-label="Working folder settings" onClick={() => setSettingsOpen(true)}><Settings2 /></Button></Tooltip>
        ) : <span className="ml-auto hidden text-xs text-muted sm:inline">Your attachments and what the agent publishes</span>}
      </div>
      {tab === "folders" ? (
        info.isLoading ? <div className="flex flex-col gap-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}</div>
        : info.error ? (
          <EmptyState icon={<Folder />} title={["WORKSPACE_FILES_READ_ONLY", "FORBIDDEN"].includes(errorCode(info.error)) || /owner|forbidden|403/i.test((info.error as Error).message) ? "Only the session's owner can browse its folders" : "Couldn't read this session's folders"} className="h-full" action={<Button onClick={() => void info.refetch()}>Try again</Button>}>
            {(info.error as Error).message}
          </EmptyState>
        ) : !info.data?.enabled ? (
          <EmptyState icon={<Folder />} title="Working folders aren't set up on this server" className="h-full">
            An administrator turns them on by giving the portal a list of folder roots. Until then, files the agent publishes appear under Outputs.
          </EmptyState>
        ) : !folder ? (
          <EmptyState icon={<Folder />} title="This session has no working folder yet" className="h-full" action={<Button variant="primary" onClick={() => setSettingsOpen(true)}>Choose a working folder</Button>}>
            Point the session at a project folder and the agent reads and writes there. You can browse and edit those files here.
          </EmptyState>
        ) : (
          <FolderPane session={session} info={info.data} folder={folder} openWorkingFolder={() => setSettingsOpen(true)} />
        )
      ) : isLoading ? (
        <div className="flex flex-col gap-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}</div>
      ) : outputs.length === 0 ? (
        <EmptyState icon={<FileText />} title="No outputs yet" className="h-full">Files you attach and files the agent publishes appear here, ready to preview and download.</EmptyState>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <ul className={cn("shrink-0 overflow-y-auto", selected ? "max-h-[40%] border-b border-line" : "flex-1")}>
            {outputs.map((a) => (
              <li key={a.filename}>
                <button type="button" onClick={() => onFile(selected?.filename === a.filename ? undefined : a.filename)} aria-pressed={selected?.filename === a.filename} className={cn("flex min-h-9 w-full items-center gap-2.5 border-b border-line-subtle px-3 text-left hover:bg-raised/70 pointer-coarse:min-h-11", selected?.filename === a.filename && "bg-raised")}>
                  <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-mono text-sm">{a.filename}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{fileSize(a) ? bytes(fileSize(a)) : ""}</span>
                  <span className="w-14 shrink-0 text-right text-xs text-muted">{ago(fileTime(a) as any)}</span>
                </button>
              </li>
            ))}
          </ul>
          {selected ? <FilePreview session={session} file={selected} /> : null}
        </div>
      )}
      <WorkingFolderDialog sessionId={session.sessionId} open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ConfirmDialog
        open={Boolean(leaving) || blocker.status === "blocked"}
        onOpenChange={(v) => { if (!v) { setLeaving(null); if (blocker.status === "blocked") blocker.reset(); } }}
        title="Leave without saving?"
        description={`You have unsaved edits to ${plural(drafts.length, "file")}. They stay on this device as a draft and come back when you return to the file. Nothing is written to the folder until you press Save.`}
        confirmLabel="Leave, keep my draft"
        onConfirm={() => { const next = leaving; setLeaving(null); if (blocker.status === "blocked") blocker.proceed(); else next?.(); }}
      />
    </div>
  );
}

// The API names these sizeBytes and uploadedAt; fixtures use size and updatedAt.
const fileSize = (a: Artifact) => Number((a as any).sizeBytes ?? a.size) || 0;
const fileTime = (a: Artifact) => (a as any).uploadedAt ?? a.updatedAt;

function FilePreview({ session, file }: { session: Session; file: Artifact }) {
  const { source } = useSource();
  const { data, isLoading, error } = useQuery({ queryKey: ["artifact-text", session.sessionId, file.filename, file.updatedAt], queryFn: () => source.readArtifact(session.sessionId, file.filename) });
  const url = source.artifactUrl(session.sessionId, file.filename);
  const isMd = /\.(md|markdown)$/i.test(file.filename);
  const isHtml = /\.html?$/i.test(file.filename);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium">{file.filename}</span>
        {url ? <Button asChild size="sm"><a href={url} download={file.filename}><Download /> Download</a></Button> : <Tooltip content="Demo files have no download"><span><Button size="sm" disabled><Download /> Download</Button></span></Tooltip>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? <div className="p-3"><Skeleton className="h-40" /></div> : error ? (
          <p className="p-3 text-sm text-failed">Couldn't read this file. {(error as Error).message}</p>
        ) : isHtml ? (
          <CanvasFrame html={data || ""} title={file.filename} />
        ) : isMd ? (
          <div className="p-4"><Markdown text={data || ""} /></div>
        ) : (
          <pre className="whitespace-pre-wrap p-3 font-mono text-xs leading-5 text-fg">{data}</pre>
        )}
      </div>
    </div>
  );
}

// ── Delegation ───────────────────────────────────────────────────────────

export function DelegationView({ session }: { session: Session }) {
  const { data: sessions } = useSessions();
  const { source } = useSource();
  const refresh = useRefresh();
  const tree = React.useMemo(() => {
    const all = sessions || [];
    const out: Array<{ s: Session; depth: number }> = [];
    const walk = (id: string, depth: number) => {
      for (const c of all.filter((x) => x.parentSessionId === id).sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0))) {
        out.push({ s: c, depth });
        walk(c.sessionId, depth + 1);
      }
    };
    walk(session.sessionId, 0);
    return out;
  }, [sessions, session.sessionId]);
  if (!tree.length) {
    return (
      <EmptyState icon={<GitBranch />} title="No sub-agents or tasks" className="h-full">
        When this session's agent hands work to sub-agents or runs in-session tasks, they appear here with their state and results.
      </EmptyState>
    );
  }
  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted">
        <GitBranch className="size-3.5" aria-hidden /> {plural(tree.length, "sub-agent")}
      </div>
      <Panel>
        {tree.map(({ s, depth }) => {
          const st = sessionState(s);
          return (
            <div key={s.sessionId} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-subtle px-3 py-2.5 first:border-t-0" style={{ paddingLeft: 12 + depth * 20 }}>
              <StateGlyph state={st.key} />
              <div className="min-w-0 flex-1">
                <Link to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="block truncate text-sm font-medium hover:underline">{s.title}</Link>
                <div className="truncate text-xs text-muted"><span className="font-mono">{s.agentId}</span> · {st.word}{st.reason ? ` · ${st.reason}` : ""} · {ago(s.updatedAt)}</div>
                {st.key === "completed" ? <div className="mt-1 text-xs text-ok">Result ready · open it to read the verdict and summary</div> : null}
                {st.key === "failed" ? <div className="mt-1 text-xs text-failed">{describeError(s.error).headline}</div> : null}
              </div>
              <div className="flex shrink-0 gap-1.5">
                {st.key === "running" ? (
                  <Button size="sm" variant="quiet" onClick={async () => { try { await source.stopTurn(s.sessionId); toast.success("Stopped the turn", { description: s.title }); refresh(s.sessionId); } catch (e: any) { toast.error("Couldn't stop", { description: e?.message }); } }}>Stop turn</Button>
                ) : null}
                <Button size="sm" asChild><Link to="/s/$sessionId" params={{ sessionId: s.sessionId }}>Open</Link></Button>
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

// ── Activity ─────────────────────────────────────────────────────────────
// One tab level: Timeline (what happened), Logs (what the workers said) and Details
// (numbers, where it runs, durable history). The route keeps five values for old links;
// nodes, history and stats all open Details.

type ActivityTab = "timeline" | "logs" | "nodes" | "history" | "stats";
type Face = "timeline" | "logs" | "details";
const faceOf = (t: ActivityTab): Face => (t === "timeline" ? "timeline" : t === "logs" ? "logs" : "details");

export function ActivityView({ session, history, tab, onTab }: { session: Session; history: HistoryModel | null; tab: ActivityTab; onTab: (t: ActivityTab) => void }) {
  const st = sessionState(session);
  const face = faceOf(tab);
  const [filter, setFilter] = React.useState<"problems" | "waits" | null>(null);
  const events = history?.events || [];
  const hasProblems = st.key === "failed" || events.some((e) => /error|fail/i.test(e.eventType));
  const hasWaits = st.key === "waiting" || events.some((e) => /wait|sleep|timer|cron|pause|affinity/i.test(e.eventType));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-[44px] shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-1.5">
        <Segmented label="Activity" value={face} onChange={(f) => { setFilter(null); onTab(f === "details" ? "stats" : f); }} options={[
          { value: "timeline", label: "Timeline" }, { value: "logs", label: "Logs" }, { value: "details", label: "Details" },
        ]} />
        {face === "timeline" ? (
          <span className="ml-auto flex flex-wrap gap-1.5">
            {hasProblems ? <Chip active={filter === "problems"} onClick={() => setFilter(filter === "problems" ? null : "problems")}>Problems only</Chip> : null}
            {hasWaits ? <Chip active={filter === "waits"} onClick={() => setFilter(filter === "waits" ? null : "waits")}>Waits and sleeps</Chip> : null}
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {face === "timeline" ? <Timeline history={history} filter={filter} session={session} /> : null}
        {face === "logs" ? <Logs /> : null}
        {face === "details" ? <Details session={session} history={history} /> : null}
      </div>
    </div>
  );
}

const TONE_DOT = { neutral: "bg-line-strong", ok: "bg-ok", failed: "bg-failed", wait: "bg-waiting" } as const;

function Timeline({ history, filter, session }: { history: HistoryModel | null; filter: "problems" | "waits" | null; session: Session }) {
  const st = sessionState(session);
  if (!history) return <div className="p-3"><Skeleton className="h-40" /></div>;
  // A finished call already says what was called; its "Calling…" twin is noise once it has finished.
  const key = (e: any) => String(e.data?.toolCallId ?? e.data?.callId ?? e.data?.toolName ?? e.data?.name ?? "");
  const finished = new Set(history.events.filter((e) => e.eventType === "tool.execution_complete").map(key));
  let events = history.events.filter((e) => !(e.eventType === "tool.execution_start" && finished.has(key(e)))).reverse();
  if (filter === "problems") events = events.filter((e) => /error|fail/i.test(`${e.eventType} ${e.data?.success === false ? "fail" : ""}`));
  if (filter === "waits") events = events.filter((e) => /wait|sleep|timer|cron|spawn|child|pause|affinity/i.test(e.eventType));
  return (
    <div className="p-3">
      {st.key === "waiting" ? <p className={cn(cardVariants(), "mb-3 px-3 py-2 text-sm")}><StatePill state={st} size="sm" className="mr-2" />{st.next || "It resumes when its wait ends."}</p> : null}
      {st.key === "failed" && session.error ? <p className={cn(cardVariants({ tone: "failed" }), "mb-3 px-3 py-2 text-sm")}>{describeError(session.error).detail || describeError(session.error).headline}</p> : null}
      {events.length === 0 ? <p className="text-sm text-muted">No events{filter ? " match this filter" : " yet"}.</p> : (
        <ol className="flex flex-col">
          {events.slice(0, 200).map((e) => {
            const line = describeEvent(e.eventType, e.data);
            return (
              <li key={e.seq} title={`${e.eventType} · #${e.seq}`} className="grid grid-cols-[3rem_0.5rem_minmax(0,1fr)] items-baseline gap-x-2 py-1.5 text-sm">
                <time className="text-right text-xs tabular-nums text-muted">{eventTime(e.createdAt)}</time>
                <span className={cn("size-1.5 self-center rounded-full", TONE_DOT[line.tone])} aria-hidden />
                <div className="min-w-0">
                  <div className={cn("truncate", line.tone === "failed" && "font-medium text-failed")}>{line.text}</div>
                  {line.detail ? <div className="truncate text-xs text-muted">{line.detail}</div> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function Logs() {
  const { source } = useSource();
  const [lines, setLines] = React.useState<LogEntry[]>([]);
  React.useEffect(() => source.subscribeLogs((e) => setLines((prev) => [...prev.slice(-299), e])), [source]);
  return (
    <div className="p-3">
      <p className="mb-2 text-xs text-muted">Live logs from every worker in the cluster, not only this session's.</p>
      {lines.length === 0 ? (
        <p className="text-sm text-muted">Waiting for worker logs… If nothing arrives, log tailing is off for this deployment (it needs Kubernetes access).</p>
      ) : (
        <pre className="font-mono text-xs leading-5" aria-live="off">
          {lines.map((l, i) => (
            <div key={i} className={cn(l.level === "warn" && "text-waiting", l.level === "error" && "text-failed")}>
              <span className="text-muted">{clock(l.at as any)} {l.workerNodeId || ""}</span> {String(l.message ?? JSON.stringify(l))}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}

/** A heading that opens and closes its section; the heading is the control. */
function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();
  return (
    <section className="mb-3">
      <h3>
        <Button variant="quiet" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className="-ml-2 font-semibold text-fg hover:text-accent">
          <ChevronRight className={cn("text-muted transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden /> {title}
        </Button>
      </h3>
      {open ? <div id={id} className="mt-1 animate-fade">{children}</div> : null}
    </section>
  );
}

function Details({ session, history }: { session: Session; history: HistoryModel | null }) {
  return (
    <div className="p-3">
      <Section title="Numbers" defaultOpen><Stats session={session} history={history} /></Section>
      <Section title="Where it runs"><Nodes /></Section>
      <Section title="Durable history"><ExecHistory session={session} /></Section>
    </div>
  );
}

function Nodes() {
  const { data: workers, isLoading } = useWorkers();
  if (isLoading) return <Skeleton className="h-24" />;
  return (
    <>
      <Panel>
        {(workers || []).map((w) => (
          <div key={w.workerNodeId} className="flex items-center gap-3 border-t border-line-subtle px-3 py-2 text-sm first:border-t-0">
            <span className={cn("size-2 rounded-full", w.phase === "ready" ? "bg-live" : "bg-waiting")} aria-hidden />
            <span className="font-mono">{w.workerNodeId}</span>
            <span className="text-muted">{w.phase}</span>
            <span className="ml-auto text-xs tabular-nums text-muted">v{w.info?.sdkVersion} · {w.health?.activeSessions ?? 0} active</span>
          </div>
        ))}
      </Panel>
      <p className="mt-2 text-xs text-muted">This is the whole fleet. The API doesn't say which worker holds this session's turn yet.</p>
    </>
  );
}

function ExecHistory({ session }: { session: Session }) {
  const { source } = useSource();
  const { data, isLoading } = useQuery({ queryKey: ["exec-history", session.sessionId], queryFn: () => source.executionHistory(session.sessionId) });
  // The whole history goes to a file in Outputs, where it can be previewed and downloaded.
  const exporter = useOpMutation<void, { filename?: string }>("exportExecutionHistory", {
    params: () => ({ sessionId: session.sessionId }),
    invalidate: [["artifacts", session.sessionId]],
    success: (r) => `History exported${r?.filename ? ` to ${r.filename}` : ""}. Find it under Files, Outputs.`,
    failure: "Couldn't export the history",
  });
  if (isLoading) return <Skeleton className="h-40" />;
  return (
    <>
      <div className="mb-2 flex items-center gap-2"><span className="text-sm text-muted">{plural((data || []).length, "durable history event")} · showing the last 80</span><Button size="sm" className="ml-auto" disabled={exporter.isPending} onClick={() => exporter.mutate()}>{exporter.isPending ? "Exporting…" : "Export history"}</Button></div>
      <pre className="max-h-[60vh] overflow-auto rounded-pane border border-line bg-bg p-3 font-mono text-xs leading-5">{JSON.stringify((data || []).slice(-80), null, 2)}</pre>
    </>
  );
}

function Stats({ session, history }: { session: Session; history: HistoryModel | null }) {
  const { source } = useSource();
  const { data } = useQuery({ queryKey: ["orch-stats", session.sessionId], queryFn: () => source.orchestrationStats(session.sessionId) });
  const show = (k: string, v: unknown): React.ReactNode => {
    if (v == null || v === "") return "—";
    if (typeof v === "number" && /bytes$/i.test(k)) return bytes(v);
    if (typeof v === "number") return v.toLocaleString();
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  };
  const rows: Array<[string, React.ReactNode]> = [
    ["Session", <span className="font-mono">{shortId(session.sessionId)}</span>],
    ["Turns", session.iterations ?? "—"],
    ["Events loaded", history?.events.length ?? "—"],
    ["Model", <span className="font-mono">{session.model || "default"}</span>],
    ...Object.entries(data && typeof data === "object" ? data : {}).slice(0, 12).map(([k, v]) => [statLabel(k), show(k, v)] as [string, React.ReactNode]),
  ];
  return (
    <Panel>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center gap-3 border-t border-line-subtle px-3 py-2 text-sm first:border-t-0">
            <dt className="w-40 shrink-0 text-muted">{k}</dt>
            <dd className="min-w-0 flex-1 truncate tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

export function useOpenSession() {
  const navigate = useNavigate();
  return (id: string) => navigate({ to: "/s/$sessionId", params: { sessionId: id } });
}
