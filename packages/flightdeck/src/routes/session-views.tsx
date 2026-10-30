import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, FileText, Folder, GitBranch, Lock, Maximize2, Minimize2, MoreHorizontal, Square, ZoomIn, ZoomOut } from "lucide-react";
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
import { Chip, Skeleton } from "@/components/ui/misc";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { ClassicLink } from "@/shell/AppShell";
import { ago, bytes, clock, cn, plural, shortId } from "@/lib/utils";
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

export function CanvasView({ session, slot, focus, onSlot, onFocus, phone }: { session: Session; slot?: number; focus: boolean; onSlot: (slot: number) => void; onFocus: (v: boolean) => void; phone?: boolean }) {
  const { canvases, loading } = useCanvases(session.sessionId);
  const [zoom, setZoom] = React.useState(1);
  const current = canvases.find((c) => c.slot === slot) || canvases[0];
  if (loading) return <div className="p-4"><Skeleton className="h-full min-h-[300px] w-full" /></div>;
  if (!current) {
    return (
      <EmptyState icon={<Square />} title="No canvas yet" className="h-full">
        Agents draw live pages here: checklists, charts, dashboards. Ask for one in the chat, for example
        <span className="mt-2 flex flex-wrap justify-center gap-1.5">
          {["Put a checklist of the remaining work on a canvas", "Chart the results on a canvas"].map((p) => <span key={p} className="rounded-control border border-line px-2 py-0.5 text-xs text-fg">“{p}”</span>)}
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
              className={cn("focus-inset inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-control px-2.5 text-sm font-medium", c.slot === current.slot ? "bg-raised text-fg shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-muted hover:text-fg")}
            >
              {c.name}
              {session.unseenCanvas && c.slot === 1 ? <span className="size-1.5 rounded-full bg-accent" aria-label="updated" /> : null}
            </button>
          ))}
        </div>
        {phone ? null : <span className="hidden shrink-0 text-xs text-faint xl:inline">Updated {ago(current.updatedAt as any)}</span>}
        <Tooltip content="Runs in a sandbox: no network, no popups, links ask first">
          <span className="hidden shrink-0 items-center gap-1 px-1.5 text-xs text-faint sm:inline-flex"><Lock className="size-3.5" aria-hidden /> Sandboxed</span>
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
            <MenuItem icon={<ExternalLink />} onSelect={() => window.open(`${import.meta.env.VITE_CLASSIC_URL || "http://localhost:3001"}`, "_blank", "noopener")} hint="Public share links live there for now">Share link in classic portal</MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div id="canvas-panel" role="tabpanel" aria-labelledby={`canvas-tab-${current.slot}`} className="min-h-0 flex-1">
        <CanvasFrame key={`${current.slot}`} html={current.html} title={`${current.name} (canvas ${current.slot})`} zoom={zoom} />
      </div>
    </div>
  );
}

// ── Files ────────────────────────────────────────────────────────────────

export function FilesView({ session, tab, file, onTab, onFile }: { session: Session; tab: "outputs" | "folders"; file?: string; onTab: (t: "outputs" | "folders") => void; onFile: (f?: string) => void }) {
  const { data: artifacts, isLoading } = useArtifacts(session.sessionId);
  const outputs = (artifacts || []).filter((a) => !isCanvasFile(a.filename));
  const selected = outputs.find((a) => a.filename === file) || null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-[44px] shrink-0 items-center gap-2 border-b border-line px-3">
        <Segmented label="Files" value={tab} onChange={onTab} options={[{ value: "outputs", label: `Outputs${outputs.length ? ` ${outputs.length}` : ""}` }, { value: "folders", label: "Folders" }]} />
        <span className="ml-auto hidden text-xs text-faint sm:inline">Files shared with this session: your attachments and what the agent publishes</span>
      </div>
      {tab === "folders" ? (
        <EmptyState icon={<Folder />} title="Working folders open in the classic portal for now" className="h-full" action={<ClassicLink>Open working folders</ClassicLink>}>
          The tree, editor, find, upload and git changes for main, home and shared folders are not ported to Flight Deck yet. A working-folder file reaches Outputs only when you publish it.
        </EmptyState>
      ) : isLoading ? (
        <div className="flex flex-col gap-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}</div>
      ) : outputs.length === 0 ? (
        <EmptyState icon={<FileText />} title="No outputs yet" className="h-full">Files you attach and files the agent publishes appear here, ready to preview and download.</EmptyState>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <ul className={cn("shrink-0 overflow-y-auto", selected ? "max-h-[40%] border-b border-line" : "flex-1")}>
            {outputs.map((a) => (
              <li key={a.filename}>
                <button type="button" onClick={() => onFile(selected?.filename === a.filename ? undefined : a.filename)} aria-pressed={selected?.filename === a.filename} className={cn("flex h-[38px] w-full items-center gap-2.5 border-b border-line-subtle px-3 text-left hover:bg-raised/70", selected?.filename === a.filename && "bg-raised")}>
                  <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{a.filename}</span>
                  <span className="shrink-0 text-xs tabular-nums text-faint">{a.size ? bytes(a.size) : ""}</span>
                  <span className="w-14 shrink-0 text-right text-xs text-faint">{ago(a.updatedAt as any)}</span>
                </button>
              </li>
            ))}
          </ul>
          {selected ? <FilePreview session={session} file={selected} /> : null}
        </div>
      )}
    </div>
  );
}

function FilePreview({ session, file }: { session: Session; file: Artifact }) {
  const { source } = useSource();
  const { data, isLoading, error } = useQuery({ queryKey: ["artifact-text", session.sessionId, file.filename, file.updatedAt], queryFn: () => source.readArtifact(session.sessionId, file.filename) });
  const url = source.artifactUrl(session.sessionId, file.filename);
  const isMd = /\.(md|markdown)$/i.test(file.filename);
  const isHtml = /\.html?$/i.test(file.filename);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium">{file.filename}</span>
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
      <div className="mb-2 flex items-center gap-3 text-xs text-faint">
        <span className="flex items-center gap-1"><GitBranch className="size-3.5" aria-hidden /> Sub-agent</span>
        <span>{plural(tree.length, "item")}</span>
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

type ActivityTab = "timeline" | "logs" | "nodes" | "history" | "stats";

export function ActivityView({ session, history, tab, onTab }: { session: Session; history: HistoryModel | null; tab: ActivityTab; onTab: (t: ActivityTab) => void }) {
  const st = sessionState(session);
  const [filter, setFilter] = React.useState<string | null>(null);
  const questions = [
    st.key === "waiting" ? { id: "wait", label: "Why is it waiting?", go: () => { onTab("timeline"); setFilter("wait"); } } : null,
    st.key === "failed" ? { id: "fail", label: "Why did it fail?", go: () => { onTab("timeline"); setFilter("error"); } } : null,
    { id: "where", label: "Where is it running?", go: () => onTab("nodes") },
  ].filter(Boolean) as Array<{ id: string; label: string; go: () => void }>;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-[44px] shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-1.5">
        <Segmented label="Activity" value={tab} onChange={(t) => { setFilter(null); onTab(t); }} options={[
          { value: "timeline", label: "Timeline" }, { value: "logs", label: "Logs" }, { value: "nodes", label: "Nodes" }, { value: "history", label: "History" }, { value: "stats", label: "Stats" },
        ]} />
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-line-subtle px-3 py-2">
        {questions.map((q) => <Chip key={q.id} active={filter === q.id || (q.id === "fail" && filter === "error")} onClick={q.go}>{q.label}</Chip>)}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "timeline" ? <Timeline history={history} filter={filter} session={session} /> : null}
        {tab === "logs" ? <Logs /> : null}
        {tab === "nodes" ? <Nodes /> : null}
        {tab === "history" ? <ExecHistory session={session} /> : null}
        {tab === "stats" ? <Stats session={session} history={history} /> : null}
      </div>
    </div>
  );
}

function Timeline({ history, filter, session }: { history: HistoryModel | null; filter: string | null; session: Session }) {
  if (!history) return <div className="p-3"><Skeleton className="h-40" /></div>;
  let events = history.events.slice().reverse();
  if (filter === "error") events = events.filter((e) => /error|fail/i.test(`${e.eventType} ${JSON.stringify(e.data || {})}`));
  if (filter === "wait") events = events.filter((e) => /wait|sleep|timer|cron|spawn|child|pause|affinity/i.test(e.eventType));
  return (
    <div className="p-3">
      {filter === "wait" ? <p className="mb-3 rounded-pane border border-line bg-surface px-3 py-2 text-sm"><StatePill state={sessionState(session)} size="sm" className="mr-2" />{sessionState(session).next || "It resumes when its wait ends."}</p> : null}
      {filter === "error" && session.error ? <p className="mb-3 rounded-pane border border-failed/35 bg-failed-tint px-3 py-2 text-sm">{describeError(session.error).detail || describeError(session.error).headline}</p> : null}
      {events.length === 0 ? <p className="text-sm text-muted">No events{filter ? " match this question" : ""}.</p> : (
        <ol className="relative border-l border-line pl-4">
          {events.slice(0, 200).map((e) => (
            <li key={e.seq} className="mb-2.5">
              <span className={cn("absolute -left-[4.5px] mt-1.5 size-2 rounded-full", /error|fail/.test(e.eventType) ? "bg-failed" : /complete|done/.test(e.eventType) ? "bg-ok" : "bg-line-strong")} aria-hidden />
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-fg">{e.eventType}</span>
                <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-faint">#{e.seq} · {clock(e.createdAt)}</span>
              </div>
              {e.data && Object.keys(e.data).length ? <p className="truncate font-mono text-[11px] text-muted">{summarize(e.data)}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function summarize(data: Record<string, unknown>) {
  const text = JSON.stringify(data);
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

function Logs() {
  const { source } = useSource();
  const [lines, setLines] = React.useState<LogEntry[]>([]);
  React.useEffect(() => source.subscribeLogs((e) => setLines((prev) => [...prev.slice(-299), e])), [source]);
  return (
    <div className="p-3">
      {lines.length === 0 ? (
        <p className="text-sm text-muted">Waiting for worker logs… If nothing arrives, log tailing is off for this deployment (it needs Kubernetes access).</p>
      ) : (
        <pre className="font-mono text-xs leading-5" aria-live="off">
          {lines.map((l, i) => (
            <div key={i} className={cn(l.level === "warn" && "text-waiting", l.level === "error" && "text-failed")}>
              <span className="text-faint">{clock(l.at as any)} {l.workerNodeId || ""}</span> {String(l.message ?? JSON.stringify(l))}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}

function Nodes() {
  const { data: workers, isLoading } = useWorkers();
  if (isLoading) return <div className="p-3"><Skeleton className="h-24" /></div>;
  return (
    <div className="p-3">
      <Panel>
        {(workers || []).map((w) => (
          <div key={w.workerNodeId} className="flex items-center gap-3 border-t border-line-subtle px-3 py-2 first:border-t-0 text-sm">
            <span className={cn("size-2 rounded-full", w.phase === "ready" ? "bg-live" : "bg-waiting")} aria-hidden />
            <span className="font-mono">{w.workerNodeId}</span>
            <span className="text-muted">{w.phase}</span>
            <span className="ml-auto font-mono text-xs text-faint">v{w.info?.sdkVersion} · {w.health?.activeSessions ?? 0} active</span>
          </div>
        ))}
      </Panel>
      <p className="mt-2 text-xs text-faint">Which worker holds this session's turn is not exposed per session yet; the fleet is shown.</p>
    </div>
  );
}

function ExecHistory({ session }: { session: Session }) {
  const { source } = useSource();
  const { data, isLoading } = useQuery({ queryKey: ["exec-history", session.sessionId], queryFn: () => source.executionHistory(session.sessionId) });
  if (isLoading) return <div className="p-3"><Skeleton className="h-40" /></div>;
  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-2"><span className="text-sm text-muted">{plural((data || []).length, "durable history event")}</span><span className="ml-auto"><ClassicLink>Export history</ClassicLink></span></div>
      <pre className="max-h-[60vh] overflow-auto rounded-pane border border-line bg-bg p-3 font-mono text-xs leading-5">{JSON.stringify((data || []).slice(-80), null, 2)}</pre>
    </div>
  );
}

function Stats({ session, history }: { session: Session; history: HistoryModel | null }) {
  const { source } = useSource();
  const { data } = useQuery({ queryKey: ["orch-stats", session.sessionId], queryFn: () => source.orchestrationStats(session.sessionId) });
  const rows: Array<[string, React.ReactNode]> = [
    ["Session", <span className="font-mono">{shortId(session.sessionId)}</span>],
    ["Turns", session.iterations ?? "—"],
    ["Events loaded", history?.events.length ?? "—"],
    ["Model", <span className="font-mono">{session.model || "default"}</span>],
    ...Object.entries(data && typeof data === "object" ? data : {}).slice(0, 12).map(([k, v]) => [k, <span className="font-mono">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>] as [string, React.ReactNode]),
  ];
  return (
    <div className="p-3">
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
      <p className="mt-2 text-xs text-faint">Memory (retrieval and graph use, session facts) shows here when the deployment's store supports it.</p>
    </div>
  );
}

export function useOpenSession() {
  const navigate = useNavigate();
  return (id: string) => navigate({ to: "/s/$sessionId", params: { sessionId: id } });
}
