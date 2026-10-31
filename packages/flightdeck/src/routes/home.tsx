import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { canvasName } from "@/canvas/CanvasFrame";
import { ArrowRight, ArrowUpRight, CheckCheck, FileText, LayoutPanelLeft, Plus, ServerCrash } from "lucide-react";
import { TopBar } from "@/shell/AppShell";
import { useUi } from "@/shell/ui-state";
import { useProfile, useSessions, useSource } from "@/data/source";
import { describeError, failureKey, needsYou, sessionState } from "@/data/state";
import type { Artifact, Session } from "@/data/types";
import { DurableSpine, StateGlyph, StatePill } from "@/components/state";
import { DataReadNotice, Panel, SectionTitle } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { ago, clock, cn, plural, until } from "@/lib/utils";
import { cardVariants } from "@/components/ui/card";
import { CapacityLine } from "@/components/capacity-line";
import { FailureGroup, NeedsRow } from "@/components/needs-row";
import { SinceLeft } from "@/components/since-left";
import { OverviewWelcome } from "@/components/overview-welcome";
import { AgentIdentity, WorkCard, WorkCardBody, WorkCardFooter } from "@/components/ui/work-card";
import { ArtifactPreview } from "@/components/artifact-preview";
import { ArtifactInspector } from "@/components/artifact-inspector";

type AttentionItem = { kind: "row"; session: Session } | { kind: "group"; key: string; sessions: Session[] };

/** Overview puts decisions before monitoring, and monitoring before browsing. */
export function HomePage() {
  const catalog = useSessions();
  const { data: sessions, isLoading } = catalog;
  const { data: profile } = useProfile();
  const { openNewSession } = useUi();
  const admin = Boolean(profile?.isAdmin);

  const groups = React.useMemo(() => {
    const all = sessions || [];
    const mine = all.filter((s) => !s.isSystem);
    const needs = mine.filter(needsYou).sort(byNeedsPriority);
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
  }, [sessions]);

  const nothingYet = !isLoading && !catalog.isError && groups.mine.length === 0;
  const recentOutputs = useRecentOutputs(groups.mine);
  const n = groups.needs.length;
  const name = profile?.anonymous ? "" : (profile?.displayName || "").split(" ")[0];
  const unavailable = catalog.isError && !sessions;
  return (
    <>
      <TopBar crumbs={[{ label: "Overview" }]} titleIsHeading={false} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-295 flex-col gap-8 px-4 py-5 md:px-7 md:py-7 [&_h2]:text-lg">
          <OverviewWelcome name={name} firstVisit={nothingYet} unavailable={unavailable} onNewSession={() => openNewSession()} />

          {catalog.isError ? <DataReadNotice title={sessions ? "Session updates are unavailable" : "Couldn't load your workspace"} partial={Boolean(sessions)} busy={catalog.isFetching} onRetry={() => void catalog.refetch()}>{sessions ? "Showing the last available sessions. States may have changed; refresh before making a decision." : "We couldn't read the session list. Try again to see what needs your attention."}</DataReadNotice> : null}
          {!unavailable ? <SinceLeft sessions={sessions || []} /> : null}
          {groups.systemFailed.length && admin ? <FleetNotice failed={groups.systemFailed} /> : null}

          {nothingYet ? (
            <WorkCard className="p-6 md:p-8">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Give your first agent a task.</h2>
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">Describe the outcome you want. Follow its progress here, answer when it needs you, and find its finished work in Outputs.</p>
                <Button variant="primary" className="mt-5" onClick={() => openNewSession()}><Plus /> Start a session</Button>
                <p className="mt-4 text-xs leading-relaxed text-faint">Sessions keep their place when they pause, and resume when it's time to continue.</p>
              </div>
            </WorkCard>
          ) : null}

          {isLoading ? <div role="status" aria-label="Loading workspace"><LoadingList /></div> : null}
          {!nothingYet && !isLoading && !unavailable ? <>
            <div className="grid items-start gap-6 lg:grid-cols-12">
              <section className="min-w-0 lg:col-span-7" aria-labelledby="needs-h">
                <SectionTitle id="needs-h">For your review</SectionTitle>
                {groups.items[0] ? renderAttention(groups.items[0], 0, true) : <WorkCard><WorkCardBody className="flex min-h-64 flex-col justify-center"><CheckCheck className="mb-4 size-7 text-muted" aria-hidden /><h3 className="text-xl font-semibold">{catalog.isError ? "Your last available work list" : "Room to keep creating."}</h3><p className="mt-3 max-w-prose text-base text-muted">{catalog.isError ? "Refresh to check for new questions, failures or usage holds." : "No questions, failures or usage holds in your latest work list. Pick up a session or start something new."}</p><Button className="mt-5 w-fit" onClick={() => openNewSession()}><Plus /> Start a session</Button></WorkCardBody></WorkCard>}
              </section>
              <section className="min-w-0 lg:col-span-5" aria-labelledby="spotlight-h">
                <SectionTitle id="spotlight-h" action={<Link to="/outputs" className="text-sm text-accent hover:underline">All outputs <ArrowUpRight className="ml-1 size-3.5" aria-hidden /></Link>}>Recent output</SectionTitle>
                {recentOutputs.data[0] ? <OutputCard output={recentOutputs.data[0]} preview /> : recentOutputs.isLoading ? <Skeleton className="h-72 w-full rounded-work" /> : <WorkCard><WorkCardBody className="flex min-h-64 flex-col justify-center"><FileText className="mb-4 size-7 text-muted" aria-hidden /><h3 className="text-xl font-semibold">{recentOutputs.errorCount ? "Outputs couldn't be loaded" : "A place for your next result."}</h3><p className="mt-3 text-base text-muted">{recentOutputs.errorCount ? "Try again below, or open a session to see its work." : "Canvases and files from your agents will appear here as they're published."}</p></WorkCardBody></WorkCard>}
              </section>
            </div>
            {groups.items.length > 1 ? <section aria-labelledby="more-needs-h"><SectionTitle id="more-needs-h" count={n - (groups.items[0].kind === "group" ? groups.items[0].sessions.length : 1)}>Also needs attention</SectionTitle><div className="grid items-start gap-4 md:grid-cols-2">{groups.items.slice(1).map((it, i) => renderAttention(it, i + 1))}</div></section> : null}
            <section aria-labelledby="running-h">
              <SectionTitle id="running-h" count={groups.running.length} action={<Link to="/sessions" className="text-sm text-accent hover:underline">All sessions <ArrowUpRight className="ml-1 size-3.5" aria-hidden /></Link>}>Work in motion</SectionTitle>
              {groups.running.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{groups.running.slice(0, 3).map((s, i) => <WorkingCard key={s.sessionId} session={s} index={i} />)}</div> : <p className="py-3 text-base text-muted">No running sessions in this work list. Your ongoing sessions will appear here.</p>}
              {groups.running.length > 3 ? <Link to="/sessions" search={{ state: "running" }} className="mt-3 inline-flex min-h-8 items-center text-sm text-accent hover:underline pointer-coarse:min-h-11">View all {groups.running.length} running sessions <ArrowRight className="ml-2 size-4" aria-hidden /></Link> : null}
            </section>
            <RecentOutputs result={recentOutputs} />
            <section className="min-w-0" aria-labelledby="sched-h">
              <SectionTitle id="sched-h" count={groups.waiting.length}>Coming next</SectionTitle>
              <Panel>{groups.waiting.length ? groups.waiting.slice(0, 5).map((s) => <WaitingRow key={s.sessionId} session={s} />) : <p className="px-4 py-5 text-sm text-muted">No scheduled wake-ups or agent handoffs in this work list. Usage holds appear in your review cards.</p>}
                {groups.waiting.length > 5 ? <Link to="/sessions" search={{ state: "waiting" }} className="focus-inset block border-t border-line px-4 py-3 text-sm text-accent hover:bg-raised">View all waiting sessions</Link> : null}
              </Panel>
            </section>
          </> : null}
          {!unavailable ? <aside aria-label="Workspace capacity" className="border-t border-line pt-3"><CapacityLine /></aside> : null}
        </div>
      </div>
    </>
  );
}

function renderAttention(item: AttentionItem, index: number, featured = false) {
  return item.kind === "row" ? <NeedsRow key={item.session.sessionId} session={item.session} index={index} featured={featured} /> : <FailureGroup key={item.key} sessions={item.sessions} index={index} />;
}

function WorkingCard({ session: s, index }: { session: Session; index: number }) {
  const state = sessionState(s);
  return <WorkCard asChild interactive index={index}>
    <Link to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="group flex min-h-60 flex-col">
      <WorkCardBody className="flex flex-1 flex-col">
        <div className="mb-4"><StatePill state={state} showReason={false} /></div>
        <h3 className="break-words text-lg font-semibold leading-snug">{s.title || "Untitled session"}</h3>
        <p className="mt-3 break-words text-base text-muted">{s.step || s.shortSummary || state.reason || "Open the session to follow its progress."}</p>
        {s.spine?.length ? <div className="mt-auto pt-5"><DurableSpine marks={s.spine} /></div> : null}
      </WorkCardBody>
      <WorkCardFooter><AgentIdentity name={s.agentId} /><span className="ml-auto inline-flex items-center gap-2"><span>{ago(s.updatedAt)}</span><ArrowUpRight className="fd-card-arrow size-4" aria-hidden /></span></WorkCardFooter>
    </Link>
  </WorkCard>;
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

function RecentOutputs({ result }: { result: ReturnType<typeof useRecentOutputs> }) {
  const outputs = result.data.slice(1, 4);
  if (!outputs.length && !result.errorCount) return null;
  return (
    <section aria-labelledby="outputs-h">
      <SectionTitle id="outputs-h" action={<Link to="/outputs" className="text-sm text-accent hover:underline">Browse outputs</Link>}>More recent outputs</SectionTitle>
      {result.errorCount ? <div className="mb-3"><DataReadNotice title="Some outputs couldn't be loaded" partial busy={result.isFetching} onRetry={() => void result.refetch()}>Results may be incomplete. Open a session to inspect its work directly, or try again.</DataReadNotice></div> : null}
      {outputs.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{outputs.map((o, i) => <OutputCard key={`${o.session.sessionId}/${o.filename}`} output={o} index={i} preview />)}</div> : null}
      <p className="mt-3 text-xs text-muted">From your {result.sessionCount} most recently active work sessions. Browse outputs for a wider history.</p>
    </section>
  );
}

/** Type, source and freshness are real metadata; an icon does not pretend to preview content. */
export function OutputCard({ output: o, index, preview = false }: { output: Artifact & { session: Session }; index?: number; preview?: boolean }) {
  const canvas = isCanvasFile(o.filename);
  const slot = canvasSlot(o.filename);
  const { source } = useSource();
  const { data: html, isLoading: htmlLoading, isError: htmlError } = useQuery({
    queryKey: ["artifact-text", o.session.sessionId, o.filename, o.updatedAt],
    queryFn: () => source.readArtifact(o.session.sessionId, o.filename), enabled: canvas, staleTime: 60_000,
  });
  const loadingName = canvas && htmlLoading;
  const name = canvas ? canvasName(html, slot) : o.filename;
  const unseen = canvas && slot === 1 && o.session.unseenCanvas;
  const Icon = canvas ? LayoutPanelLeft : FileText;
  return (
    <WorkCard index={index} className="group flex min-h-48 flex-col">
      {preview ? canvas ? <ArtifactInspector html={html} filename={o.filename} title={name} sessionId={o.session.sessionId} slot={slot} loading={htmlLoading} failed={htmlError} /> : <ArtifactPreview filename={o.filename} /> : null}
      <WorkCardBody className="flex flex-1 flex-col gap-3">
        <span className="flex items-center gap-2 text-xs text-muted"><Icon className="size-4" aria-hidden />{canvas ? "Canvas" : "File"}{unseen ? <span className="ml-auto inline-flex items-center gap-1.5 text-accent"><span className="size-1.5 rounded-full bg-accent" aria-hidden />Updated</span> : null}</span>
        <h3 className="break-words text-lg font-semibold leading-snug"><Link to="/s/$sessionId" params={{ sessionId: o.session.sessionId }} search={canvas ? { view: "canvas", slot } : { view: "files", files: "outputs", file: o.filename }} className="inline-block min-h-6 underline-offset-2 hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">{loadingName ? <span className="block h-5 w-2/3 animate-pulse rounded-chip bg-raised" aria-label="Loading canvas title" /> : name}</Link></h3>
        <p className="truncate text-sm text-muted">{o.session.title}</p>
        {preview && htmlError ? <p className="text-xs text-muted">Preview unavailable. Open the output to try again.</p> : null}
      </WorkCardBody>
      <WorkCardFooter className="justify-between"><span>{ago(o.updatedAt as any)}</span><Link to="/s/$sessionId" params={{ sessionId: o.session.sessionId }} search={canvas ? { view: "canvas", slot } : { view: "files", files: "outputs", file: o.filename }} className="inline-flex min-h-6 items-center gap-2 text-sm text-fg hover:underline pointer-coarse:min-h-11">Open output <ArrowUpRight className="fd-card-arrow size-4" aria-hidden /></Link></WorkCardFooter>
    </WorkCard>
  );
}
