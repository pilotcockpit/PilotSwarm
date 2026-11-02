import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { canvasName } from "@/canvas/CanvasFrame";
import { ArrowRight, ArrowUpRight, CheckCheck, FileText, LayoutPanelLeft, Plus, ServerCrash } from "lucide-react";
import { TopBar } from "@/shell/AppShell";
import { useUi } from "@/shell/ui-state";
import { useProfile, useSessions, useSource } from "@/data/source";
import { describeError, failureKey, sessionState } from "@/data/state";
import { useAttention } from "@/components/sidebar/use-attention";
import type { Artifact, Session } from "@/data/types";
import { StateGlyph } from "@/components/state";
import { DataReadNotice, Panel, SectionTitle } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { ago, bytes, clock, cn, plural, until } from "@/lib/utils";
import { cardVariants } from "@/components/ui/card";
import { CapacityLine } from "@/components/capacity-line";
import { AttentionRow, FailureGroup, NeedsRow } from "@/components/needs-row";
import { CountPill } from "@/components/count-pill";
import { ProjectIcon } from "@/components/project-icon";
import { OverviewStart } from "@/components/overview-start";
import { SessionRow } from "@/components/session-row";
import { useDismissAttention } from "@/components/sidebar/use-attention";
import { useGroups } from "@/data/source";
import { buildIndex, projectMembership } from "@/data/session-tree";
import { SinceLeft } from "@/components/since-left";
import { OverviewWelcome } from "@/components/overview-welcome";
import { WorkCard, WorkCardBody, WorkCardFooter } from "@/components/ui/work-card";
import { ArtifactPreview } from "@/components/artifact-preview";
import { ArtifactInspector } from "@/components/artifact-inspector";
import { useCanvasPreview } from "@/lib/use-artifact-preview";

type AttentionItem = { kind: "row"; session: Session } | { kind: "group"; key: string; sessions: Session[] };

/** Overview puts decisions before monitoring, and monitoring before browsing. */
export function HomePage() {
  const catalog = useSessions();
  const { data: sessions, isLoading } = catalog;
  const { data: profile } = useProfile();
  const { openNewSession } = useUi();
  const admin = Boolean(profile?.isAdmin);
  const attention = useAttention();
  const dismiss = useDismissAttention();
  const { data: projectList } = useGroups();
  // The project a session is filed in, for the rows that say where they live. Nothing is said to someone with no projects.
  const projectOf = React.useMemo(() => {
    const projects = projectList || [];
    if (!projects.length) return () => null;
    const member = projectMembership(buildIndex(sessions || []), projects);
    return (s: Session): string | null => { const id = member.of(s); return id ? projects.find((g) => g.id === id)?.name ?? null : null; };
  }, [sessions, projectList]);
  const dismissible = React.useMemo(() => new Map(attention.items.filter((a) => a.dismissible).map((a) => [a.sessionId, () => dismiss(a)] as const)), [attention.items, dismiss]);

  const groups = React.useMemo(() => {
    const all = sessions || [];
    const mine = all.filter((s) => !s.isSystem);
    const needs = mine.filter((s) => attention.ids.has(s.sessionId)).sort(byNeedsPriority);
    const running = mine.filter((s) => sessionState(s).key === "running").sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
    const waiting = mine.filter((s) => sessionState(s).key === "waiting" && sessionState(s).waitKind !== "hold")
      .sort((a, b) => (sessionState(a).nextAt || Infinity) - (sessionState(b).nextAt || Infinity));
    const systemFailed = all.filter((s) => s.isSystem && sessionState(s).key === "failed");
    const items: AttentionItem[] = [];
    const seen = new Set<string>();
    for (const s of needs) {
      if (sessionState(s).key !== "failed") { items.push({ kind: "row", session: s }); continue; }
      const key = failureKey(s);
      if (seen.has(key)) continue;
      seen.add(key);
      const same = needs.filter((n) => sessionState(n).key === "failed" && failureKey(n) === key);
      items.push(same.length > 1 ? { kind: "group", key, sessions: same } : { kind: "row", session: s });
    }
    return { mine, needs, items, running, waiting, systemFailed };
  }, [sessions, attention.ids]);

  const nothingYet = !isLoading && !catalog.isError && groups.mine.length === 0;
  const recentOutputs = useRecentOutputs(groups.mine);
  const canvases = React.useMemo(() => recentOutputs.data.filter((o) => isCanvasFile(o.filename)).slice(0, 3), [recentOutputs.data]);
  const files = React.useMemo(() => recentOutputs.data.filter((o) => !isCanvasFile(o.filename)).slice(0, 5), [recentOutputs.data]);
  const n = groups.needs.length;
  const name = profile?.anonymous ? "" : (profile?.displayName || "").split(" ")[0];
  const unavailable = catalog.isError && !sessions;
  return (
    <>
      <TopBar crumbs={[{ label: "Overview" }]} titleIsHeading={false} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-295 flex-col gap-8 px-4 py-5 md:px-7 md:py-7 [&_h2]:text-lg">
          <OverviewWelcome name={name} firstVisit={nothingYet} unavailable={unavailable}><OverviewStart /></OverviewWelcome>

          {catalog.isError ? <DataReadNotice title={sessions ? "Session updates are unavailable" : "Couldn't load your workspace"} partial={Boolean(sessions)} busy={catalog.isFetching} onRetry={() => void catalog.refetch()}>{sessions ? "Showing the last available sessions. States may have changed; refresh before making a decision." : "We couldn't read the session list. Try again to see what needs your attention."}</DataReadNotice> : null}
          {!unavailable ? <SinceLeft sessions={sessions || []} /> : null}
          {groups.systemFailed.length && admin ? <FleetNotice failed={groups.systemFailed} /> : null}

          {isLoading ? <div role="status" aria-label="Loading workspace"><LoadingList /></div> : null}
          {!nothingYet && !isLoading && !unavailable ? <>
            <div className="grid items-start gap-6 lg:grid-cols-12">
              <section className="min-w-0 lg:col-span-7" aria-labelledby="needs-h">
                <SectionTitle id="needs-h" badge={<CountPill count={n} label={`${plural(n, "session")} ${n === 1 ? "needs" : "need"} you`} className="self-center" />}>Needs you</SectionTitle>
                {groups.items[0] ? renderAttention(groups.items[0], 0, true) : <WorkCard><WorkCardBody className="flex min-h-64 flex-col justify-center"><CheckCheck className="mb-4 size-7 text-muted" aria-hidden /><h3 className="text-xl font-semibold">{catalog.isError ? "Your last available work list" : "Room to keep creating."}</h3><p className="mt-3 max-w-prose text-base text-muted">{catalog.isError ? "Refresh to check for new questions, failures or usage holds." : "No questions, failures or usage holds in your latest work list. Pick up a session or start something new."}</p><Button className="mt-5 w-fit" onClick={() => openNewSession()}><Plus /> Start a session</Button></WorkCardBody></WorkCard>}
                {groups.items.length > 1 ? (
                  <Panel className="mt-3">
                    {groups.items.slice(1).map((it) => it.kind === "group"
                      ? <FailureGroup key={it.key} sessions={it.sessions} compact />
                      : <AttentionRow key={it.session.sessionId} session={it.session} project={projectOf(it.session)} onDismiss={dismissible.get(it.session.sessionId)} />)}
                  </Panel>
                ) : null}
              </section>
              <div className="flex min-w-0 flex-col gap-6 lg:col-span-5">
              <section className="min-w-0" aria-labelledby="canvases-h">
                <SectionTitle id="canvases-h" action={<Link to="/outputs" search={{ tab: "canvases" }} className="text-sm text-accent hover:underline">All canvases <ArrowUpRight className="ml-1 size-3.5" aria-hidden /></Link>}>Canvases</SectionTitle>
                {canvases.length ? (
                  <Panel>{canvases.map((o) => <CanvasTile key={`${o.session.sessionId}/${o.filename}`} output={o} project={projectOf(o.session)} />)}</Panel>
                ) : recentOutputs.isLoading ? <Skeleton className="h-72 w-full rounded-work" /> : (
                  <WorkCard><WorkCardBody className="flex min-h-48 flex-col justify-center"><LayoutPanelLeft className="mb-3 size-6 text-muted" aria-hidden /><h3 className="text-lg font-semibold">{recentOutputs.errorCount ? "Canvases couldn't be loaded" : "Canvases show up here"}</h3><p className="mt-2 text-sm text-muted">{recentOutputs.errorCount ? "Try again, or open a session to see its work." : "When an agent draws a checklist, chart or dashboard, the newest ones are listed here."}</p></WorkCardBody></WorkCard>
                )}
              </section>
              <section className="min-w-0" aria-labelledby="outputs-h">
                <SectionTitle id="outputs-h" action={<Link to="/outputs" search={{ tab: "files" }} className="text-sm text-accent hover:underline">All outputs <ArrowUpRight className="ml-1 size-3.5" aria-hidden /></Link>}>Outputs</SectionTitle>
                {files.length ? (
                  <Panel>{files.map((o) => <FileRow key={`${o.session.sessionId}/${o.filename}`} output={o} project={projectOf(o.session)} />)}</Panel>
                ) : recentOutputs.isLoading ? <Skeleton className="h-60 w-full rounded-work" /> : (
                  <p className="rounded-work border border-line bg-surface px-4 py-5 text-sm text-muted">{recentOutputs.errorCount ? "Outputs couldn't be loaded. Open a session to see its work." : "Files you attach and files agents publish show up here, newest first."}</p>
                )}
              </section>
              </div>
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-2">
            <section aria-labelledby="running-h" className="min-w-0">
              <SectionTitle id="running-h" count={groups.running.length}>Running now</SectionTitle>
              {groups.running.length ? <Panel>{groups.running.slice(0, 5).map((s) => <SessionRow key={s.sessionId} session={s} />)}</Panel> : <p className="py-3 text-base text-muted">Nothing is running. Sessions that are working show up here.</p>}
              {groups.running.length > 5 ? <Link to="/projects" search={{ state: "running" }} className="mt-3 inline-flex min-h-8 items-center text-sm text-accent hover:underline pointer-coarse:min-h-11">View all {groups.running.length} running sessions <ArrowRight className="ml-2 size-4" aria-hidden /></Link> : null}
            </section>
            <section className="min-w-0" aria-labelledby="sched-h">
              <SectionTitle id="sched-h" count={groups.waiting.length}>Coming next</SectionTitle>
              <Panel>{groups.waiting.length ? groups.waiting.slice(0, 5).map((s) => <WaitingRow key={s.sessionId} session={s} />) : <p className="px-4 py-5 text-sm text-muted">No scheduled wake-ups or agent handoffs in this work list. Usage holds appear in your review cards.</p>}
                {groups.waiting.length > 5 ? <Link to="/projects" search={{ state: "waiting" }} className="focus-inset block border-t border-line px-4 py-3 text-sm text-accent hover:bg-raised">View all waiting sessions</Link> : null}
              </Panel>
            </section>
            </div>
          </> : null}
          {!unavailable && !isLoading ? <aside aria-label="Workspace capacity" className="border-t border-line pt-3"><CapacityLine /></aside> : null}
        </div>
      </div>
    </>
  );
}

function renderAttention(item: AttentionItem, index: number, featured = false) {
  return item.kind === "row" ? <NeedsRow key={item.session.sessionId} session={item.session} index={index} featured={featured} /> : <FailureGroup key={item.key} sessions={item.sessions} index={index} />;
}

function byNeedsPriority(a: Session, b: Session) {
  const rank = (s: Session) => ({ needs: 0, failed: 1, waiting: 2 } as Record<string, number>)[sessionState(s).key] ?? 3;
  return rank(a) - rank(b) || (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0);
}

function scheduledTime(at: number) {
  const date = new Date(at);
  const now = new Date();
  return date.toDateString() === now.toDateString() ? clock(at) : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + clock(at);
}

function WaitingRow({ session: s }: { session: Session }) {
  const st = sessionState(s);
  const at = st.nextAt;
  return (
    <Link to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="focus-inset flex min-h-16 items-center gap-3 border-t border-line-subtle px-4 py-2.5 first:border-t-0 hover:bg-raised/70">
      <span className="w-20 shrink-0 leading-tight">
        {at ? (
          <>
            <span className="block text-sm font-medium tabular-nums text-fg">{scheduledTime(at)}</span>
            <span className="block text-xs text-faint">{until(at)}</span>
          </>
        ) : <StateGlyph state="waiting" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{s.title}</span>
        <span className="block truncate text-xs text-muted">
          {st.waitKind === "schedule" ? `Schedule · ${st.reason?.replace(/^schedule · /, "")}` : st.waitKind === "sub-agents" ? `Waiting ${st.reason} · resumes when they finish` : st.reason}
        </span>
      </span>
      {s.isSystem ? <span className="shrink-0 text-xs text-faint">System</span> : null}
    </Link>
  );
}

/** Admins: one line for a fleet-wide failure instead of one row per system session. */
function FleetNotice({ failed }: { failed: Session[] }) {
  const err = describeError(failed[0]?.error);
  const navigate = useNavigate();
  return (
    <div role="alert" className={cn(cardVariants({ tone: "failed", enter: true }), "mb-6 flex flex-wrap items-center gap-3 px-4 py-3")}>
      <ServerCrash className="size-4 shrink-0 text-failed" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{plural(failed.length, "system session")} failed.</span>{" "}
        <span className="text-fg/85">{err.detail || err.headline}</span>
      </div>
      <div className="flex gap-2">
        {err.provider ? <Button size="sm" onClick={() => navigate({ to: "/providers", search: { provider: err.provider } })}>Open provider</Button> : null}
        <Button size="sm" variant="quiet" onClick={() => navigate({ to: "/admin", search: { tab: "system" } })}>System sessions <ArrowRight /></Button>
      </div>
    </div>
  );
}

function LoadingList() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-[52px] w-full" />
      <Skeleton className="h-[52px] w-full" />
      <Skeleton className="h-[52px] w-full" />
    </div>
  );
}

/**
 * Newest files and canvases across your sessions. The Web API has no
 * cross-session outputs list yet (capability map B-item), so this reads the
 * outputs of your most recently active sessions.
 */
export function useRecentOutputs(sessions: Session[], limit = 8) {
  const { source } = useSource();
  const recent = React.useMemo(
    () => sessions.slice().sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0)).slice(0, limit),
    [sessions, limit],
  );
  const results = useQueries({
    queries: recent.map((s) => ({ queryKey: ["artifacts", s.sessionId], queryFn: () => source.listArtifacts(s.sessionId), staleTime: 10_000 })),
  });
  return React.useMemo(() => {
    const out: Array<Artifact & { session: Session }> = [];
    results.forEach((r, i) => (r.data || []).forEach((a) => out.push({ ...a, session: recent[i] })));
    return {
      data: out.sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt)),
      isLoading: results.some((r) => r.isLoading),
      isFetching: results.some((r) => r.isFetching),
      errorCount: results.filter((r) => r.isError).length,
      sessionCount: recent.length,
      refetch: () => Promise.all(results.map((r) => r.refetch())),
    };
  }, [results, recent]);
}

const toTime = (v: unknown) => (typeof v === "number" ? v : new Date(String(v || 0)).getTime() || 0);

export function isCanvasFile(name: string) {
  return /^canvas([2-5])?\.html$/.test(name);
}
export function canvasSlot(name: string) {
  const m = name.match(/^canvas([2-5])?\.html$/);
  return m ? Number(m[1] || 1) : 0;
}

/** One published file in the Overview's Outputs list: what it is, where it came from and when. Opens it in its session. */
function FileRow({ output: o, project }: { output: Artifact & { session: Session }; project?: string | null }) {
  return (
    <Link to="/s/$sessionId" params={{ sessionId: o.session.sessionId }} search={{ view: "files", files: "outputs", file: o.filename }} className="focus-inset flex min-h-12 items-center gap-3 border-t border-line-subtle px-3 py-2 first:border-t-0 hover:bg-raised/60">
      <FileText className="size-4 shrink-0 text-muted" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{o.filename}</span>
        <span className="flex items-center gap-2 text-xs text-muted"><span className="truncate">{o.session.title}</span>{project ? <span className="inline-flex shrink-0 items-center gap-1 text-faint"><ProjectIcon className="size-3" />{project}</span> : null}</span>
      </span>
      <span className="shrink-0 text-right text-xs tabular-nums text-faint">{o.size ? <span className="block">{bytes(Number(o.size))}</span> : null}<span className="block">{ago(o.updatedAt as any)}</span></span>
    </Link>
  );
}

/**
 * One canvas in the Overview's list: a small look at the page, its name, where it came from and when it changed. The
 * whole row opens the canvas in its session; reading it full size is one click further, in the session or in Outputs.
 */
function CanvasTile({ output: o, project }: { output: Artifact & { session: Session }; project?: string | null }) {
  const slot = canvasSlot(o.filename);
  const { html, loading, failed } = useCanvasPreview({ sessionId: o.session.sessionId, filename: o.filename, updatedAt: o.updatedAt, size: o.size, canvas: true });
  const name = canvasName(html, slot);
  const unseen = slot === 1 && o.session.unseenCanvas;
  return (
    <Link to="/s/$sessionId" params={{ sessionId: o.session.sessionId }} search={{ view: "canvas", slot }} className="focus-inset group flex min-h-24 items-stretch gap-3 border-t border-line-subtle p-3 first:border-t-0 hover:bg-raised/60">
      <span className="w-28 shrink-0 self-center overflow-hidden rounded-control border border-line sm:w-40"><ArtifactPreview html={html} filename={o.filename} loading={loading} failed={failed} scale={0.32} /></span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 line-clamp-2 break-words text-sm font-medium">{loading && !html ? <span className="block h-4 w-2/3 animate-pulse rounded-chip bg-raised" aria-label="Loading canvas title" /> : name}</span>
          {unseen ? <span className="inline-flex shrink-0 items-center gap-1 text-xs text-accent"><span className="size-1.5 rounded-full bg-accent" aria-hidden />Updated</span> : null}
        </span>
        <span className="truncate text-xs text-muted">{o.session.title}</span>
        <span className="flex items-center gap-2 text-xs text-faint">{project ? <span className="inline-flex min-w-0 items-center gap-1 truncate"><ProjectIcon className="size-3" />{project}</span> : null}<span className="tabular-nums">{ago(o.updatedAt as any)}</span></span>
      </span>
    </Link>
  );
}

/** Type, source and freshness are real metadata; an icon does not pretend to preview content. */
export function OutputCard({ output: o, index, preview = false }: { output: Artifact & { session: Session }; index?: number; preview?: boolean }) {
  const canvas = isCanvasFile(o.filename);
  const slot = canvasSlot(o.filename);
  // Agent documents are untrusted and can be any size: metadata decides first, a bounded read decides second.
  const { html, fit, loading: htmlLoading, failed: htmlError } = useCanvasPreview({ sessionId: o.session.sessionId, filename: o.filename, updatedAt: o.updatedAt, size: o.size, canvas });
  const loadingName = canvas && htmlLoading;
  const name = canvas ? canvasName(html, slot) : o.filename;
  const unseen = canvas && slot === 1 && o.session.unseenCanvas;
  const Icon = canvas ? LayoutPanelLeft : FileText;
  return (
    <WorkCard index={index} className="group flex min-h-48 flex-col">
      {canvas ? (
        <div className={preview ? "m-3 mb-0 overflow-hidden rounded-pane border border-line" : undefined}>
          <ArtifactInspector html={html} filename={o.filename} title={name} sessionId={o.session.sessionId} slot={slot} loading={htmlLoading} failed={htmlError} fit={fit} updatedAt={o.updatedAt} thumbnail={preview} />
        </div>
      ) : preview ? <div className="m-3 mb-0 overflow-hidden rounded-pane border border-line"><ArtifactPreview filename={o.filename} /></div> : null}
      <WorkCardBody className="flex flex-1 flex-col gap-3">
        <span className="flex items-center gap-2 text-xs text-muted"><Icon className="size-4" aria-hidden />{canvas ? "Canvas" : "File"}{unseen ? <span className="ml-auto inline-flex items-center gap-1.5 text-accent"><span className="size-1.5 rounded-full bg-accent" aria-hidden />Updated</span> : null}</span>
        <h2 className="break-words text-lg font-semibold leading-snug"><Link to="/s/$sessionId" params={{ sessionId: o.session.sessionId }} search={canvas ? { view: "canvas", slot } : { view: "files", files: "outputs", file: o.filename }} className="inline-block min-h-6 underline-offset-2 hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">{loadingName ? <span className="block h-5 w-2/3 animate-pulse rounded-chip bg-raised" aria-label="Loading canvas title" /> : name}</Link></h2>
        <p className="truncate text-sm text-muted">{o.session.title}</p>
        {preview && htmlError ? <p className="text-xs text-muted">Preview unavailable. Open the output to try again.</p> : null}
      </WorkCardBody>
      <WorkCardFooter className="justify-between"><span>{ago(o.updatedAt as any)}</span><Link to="/s/$sessionId" params={{ sessionId: o.session.sessionId }} search={canvas ? { view: "canvas", slot } : { view: "files", files: "outputs", file: o.filename }} className="inline-flex min-h-6 items-center gap-2 text-sm text-fg hover:underline pointer-coarse:min-h-11">Open output <ArrowUpRight className="fd-card-arrow size-4" aria-hidden /></Link></WorkCardFooter>
    </WorkCard>
  );
}
