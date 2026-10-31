import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { canvasName } from "@/canvas/CanvasFrame";
import { ArrowRight, CheckCheck, FileText, LayoutPanelLeft, Plus, ServerCrash } from "lucide-react";
import { TopBar } from "@/shell/AppShell";
import { useUi } from "@/shell/ui-state";
import { useProfile, useSessions, useSource } from "@/data/source";
import { describeError, failureKey, needsYou, sessionState, type StateKey } from "@/data/state";
import type { Artifact, Session } from "@/data/types";
import { StateGlyph } from "@/components/state";
import { DataReadNotice, Panel, SectionTitle } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { ago, clock, cn, plural, until } from "@/lib/utils";
import { cardVariants } from "@/components/ui/card";
import { CapacityLine } from "@/components/capacity-line";
import { FailureGroup, NeedsRow } from "@/components/needs-row";
import { SinceLeft } from "@/components/since-left";
import { StateFacets } from "@/components/state-facets";

type Facet = "needs" | "failed" | "running" | "waiting" | "completed";

/** Overview puts decisions before monitoring, and monitoring before browsing. */
export function HomePage() {
  const catalog = useSessions();
  const { data: sessions, isLoading } = catalog;
  const { data: profile } = useProfile();
  const { openNewSession } = useUi();
  const navigate = useNavigate();
  const admin = Boolean(profile?.isAdmin);

  const groups = React.useMemo(() => {
    const all = sessions || [];
    const visible = all.filter((s) => !s.isSystem || admin);
    const mine = all.filter((s) => !s.isSystem);
    const needs = mine.filter(needsYou).sort(byNeedsPriority);
    const running = visible.filter((s) => sessionState(s).key === "running");
    const waiting = visible.filter((s) => sessionState(s).key === "waiting" && sessionState(s).waitKind !== "hold")
      .sort((a, b) => (sessionState(a).nextAt || Infinity) - (sessionState(b).nextAt || Infinity));
    const systemFailed = all.filter((s) => s.isSystem && sessionState(s).key === "failed");
    const counts: Partial<Record<StateKey, number>> = {};
    for (const s of mine) { const k = sessionState(s).key; counts[k] = (counts[k] || 0) + 1; }
    const items: Array<{ kind: "row"; session: Session } | { kind: "group"; key: string; sessions: Session[] }> = [];
    const seen = new Set<string>();
    for (const s of needs) {
      if (sessionState(s).key !== "failed") { items.push({ kind: "row", session: s }); continue; }
      const key = failureKey(s);
      if (seen.has(key)) continue;
      seen.add(key);
      const same = needs.filter((n) => sessionState(n).key === "failed" && failureKey(n) === key);
      items.push(same.length > 1 ? { kind: "group", key, sessions: same } : { kind: "row", session: s });
    }
    return { mine, needs, items, running, waiting, systemFailed, counts };
  }, [sessions, admin]);

  const nothingYet = !isLoading && !catalog.isError && groups.mine.length === 0;
  const n = groups.needs.length;
  const name = profile?.anonymous ? "" : (profile?.displayName || "").split(" ")[0];
  const unavailable = catalog.isError && !sessions;
  return (
    <>
      <TopBar crumbs={[{ label: "Overview" }]} titleIsHeading={false} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-295 flex-col gap-7 px-4 py-6 md:px-6 md:py-7">
          <header>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">{nothingYet ? `Welcome to PilotSwarm${name ? `, ${name}` : ""}` : "Your workspace"}</h1>
                <p className="mt-1 text-sm text-muted">Decisions, progress and results from your agents.</p>
              </div>
              {!nothingYet && !isLoading && !unavailable ? <Link to="/sessions" className="inline-flex min-h-8 items-center gap-1.5 text-sm text-accent hover:underline pointer-coarse:min-h-11">View all sessions <ArrowRight className="size-3.5" aria-hidden /></Link> : null}
            </div>
            <div className="mt-4 border-t border-line pt-3"><CapacityLine /></div>
            {!nothingYet && !isLoading && !unavailable ? <StateFacets className="mt-4" counts={groups.counts} onChange={(k) => navigate({ to: "/sessions", search: { state: k === "completed" ? "closed" : (k as Facet) } as any })} /> : null}
          </header>

          {catalog.isError ? <DataReadNotice title={sessions ? "Session updates are unavailable" : "Couldn't load your workspace"} partial={Boolean(sessions)} busy={catalog.isFetching} onRetry={() => void catalog.refetch()}>{sessions ? "Showing the last available sessions. States may have changed; refresh before making a decision." : "We couldn't read the session list. Try again to see what needs your attention."}</DataReadNotice> : null}
          {!unavailable ? <SinceLeft sessions={sessions || []} /> : null}
          {groups.systemFailed.length && admin ? <FleetNotice failed={groups.systemFailed} /> : null}

          {nothingYet ? (
            <Panel enter className="grid items-center gap-6 p-6 sm:grid-cols-2 md:p-8">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Give your first agent a task.</h2>
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">Describe the outcome you want. Follow its progress here, answer when it needs you, and find its finished work in Outputs.</p>
                <Button variant="primary" className="mt-5" onClick={() => openNewSession()}><Plus /> Start a session</Button>
                <p className="mt-4 text-xs leading-relaxed text-faint">Sessions keep their place when they pause, and resume when it's time to continue.</p>
              </div>
              <img src="/assets/durable-work.png" width="1536" height="1024" alt="" className="mx-auto w-full max-w-80 object-contain" loading="lazy" decoding="async" />
            </Panel>
          ) : null}

          {isLoading ? <div role="status" aria-label="Loading workspace"><LoadingList /></div> : null}
          {!nothingYet && !isLoading && !unavailable ? <>
            <section aria-labelledby="needs-h">
              <SectionTitle id="needs-h" count={n} action={n ? <span className="hidden text-xs text-muted sm:inline">Questions, failures and usage holds</span> : undefined}>Needs attention</SectionTitle>
              <Panel enter>
                {groups.items.length ? groups.items.map((it) => it.kind === "row" ? <NeedsRow key={it.session.sessionId} session={it.session} /> : <FailureGroup key={it.key} sessions={it.sessions} />) : (
                  <div className="flex items-center gap-3 px-4 py-5"><CheckCheck className="size-5 shrink-0 text-muted" aria-hidden /><div><p className="text-sm font-medium">{catalog.isError ? "No attention items in the last available list" : "You're up to date."}</p><p className="mt-0.5 text-xs text-muted">{catalog.isError ? "Refresh the workspace to check the current state." : "No questions, failures or usage holds in the latest session list."}</p></div></div>
                )}
              </Panel>
            </section>
            <div className="grid grid-cols-1 items-start gap-7 xl:grid-cols-2">
              <section className="min-w-0" aria-labelledby="running-h">
                <SectionTitle id="running-h" count={groups.running.length} action={groups.running.length ? <Link to="/sessions" search={{ state: "running" }} className="text-xs text-accent hover:underline">View running</Link> : undefined}>In progress</SectionTitle>
                <Panel>
                  {groups.running.length ? groups.running.slice(0, 5).map((s) => (
                    <Link key={s.sessionId} to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="focus-inset flex min-h-16 items-center gap-3 border-t border-line-subtle px-4 py-3 first:border-t-0 hover:bg-raised/70">
                      <StateGlyph state="running" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.title}</span><span className="mt-1 block truncate text-xs text-muted">{s.step || s.shortSummary || "Working"}</span></span>
                      <span className="flex shrink-0 flex-col items-end gap-1"><span className="text-xs text-live">Running</span><span className="text-xs tabular-nums text-faint">{ago(s.updatedAt)}</span></span>
                    </Link>
                  )) : <p className="px-4 py-5 text-sm text-muted">No agents are running right now.</p>}
                  {groups.running.length > 5 ? <Link to="/sessions" search={{ state: "running" }} className="focus-inset block border-t border-line px-4 py-3 text-sm text-accent hover:bg-raised">View all {groups.running.length} running sessions</Link> : null}
                </Panel>
              </section>
              <section className="min-w-0" aria-labelledby="sched-h">
                <SectionTitle id="sched-h" count={groups.waiting.length}>Upcoming and waiting</SectionTitle>
                <Panel>{groups.waiting.length ? groups.waiting.slice(0, 5).map((s) => <WaitingRow key={s.sessionId} session={s} />) : <p className="px-4 py-5 text-sm text-muted">No scheduled wake-ups or agent handoffs.</p>}
                  {groups.waiting.length > 5 ? <Link to="/sessions" search={{ state: "waiting" }} className="focus-inset block border-t border-line px-4 py-3 text-sm text-accent hover:bg-raised">View all waiting sessions</Link> : null}
                </Panel>
              </section>
            </div>
            <RecentOutputs sessions={groups.mine} />
          </> : null}
        </div>
      </div>
    </>
  );
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

function RecentOutputs({ sessions }: { sessions: Session[] }) {
  const result = useRecentOutputs(sessions);
  const outputs = result.data.slice(0, 4);
  return (
    <section aria-labelledby="outputs-h">
      <SectionTitle id="outputs-h" action={<Link to="/outputs" className="text-xs text-accent hover:underline">Browse outputs</Link>}>Recent outputs</SectionTitle>
      {result.errorCount ? <div className="mb-3"><DataReadNotice title="Some outputs couldn't be loaded" partial busy={result.isFetching} onRetry={() => void result.refetch()}>Results may be incomplete. Open a session to inspect its work directly, or try again.</DataReadNotice></div> : null}
      {result.isLoading && !outputs.length ? <Skeleton className="h-24 w-full" /> : outputs.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{outputs.map((o, i) => <OutputCard key={`${o.session.sessionId}/${o.filename}`} output={o} index={i} />)}</div> : !result.errorCount ? <Panel><p className="px-4 py-5 text-sm text-muted">Canvases and published files from your recent sessions will appear here.</p></Panel> : null}
    </section>
  );
}

/** Type, source and freshness are real metadata; an icon does not pretend to preview content. */
export function OutputCard({ output: o, index }: { output: Artifact & { session: Session }; index?: number }) {
  const canvas = isCanvasFile(o.filename);
  const slot = canvasSlot(o.filename);
  const { source } = useSource();
  const { data: html, isLoading: htmlLoading } = useQuery({
    queryKey: ["artifact-text", o.session.sessionId, o.filename, o.updatedAt],
    queryFn: () => source.readArtifact(o.session.sessionId, o.filename), enabled: canvas, staleTime: 60_000,
  });
  const loadingName = canvas && htmlLoading;
  const name = canvas ? canvasName(html, slot) : o.filename;
  const unseen = canvas && slot === 1 && o.session.unseenCanvas;
  const Icon = canvas ? LayoutPanelLeft : FileText;
  return (
    <Link to="/s/$sessionId" params={{ sessionId: o.session.sessionId }}
      search={canvas ? { view: "canvas", slot } : { view: "files", files: "outputs", file: o.filename }}
      style={index != null ? { animationDelay: `${Math.min(index, 8) * 30}ms` } : undefined}
      className={cn(cardVariants({ interactive: true }), "group flex min-h-40 flex-col gap-3 p-4")}>
      <span className="flex items-center gap-2 text-xs text-muted"><Icon className="size-4" aria-hidden />{canvas ? "Canvas" : "File"}{unseen ? <span className="ml-auto inline-flex items-center gap-1.5 text-accent"><span className="size-1.5 rounded-full bg-accent" aria-hidden />Updated</span> : null}</span>
      <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold leading-snug group-hover:text-accent">{loadingName ? <span className="block h-4 w-2/3 animate-pulse rounded-chip bg-raised" aria-label="Loading canvas title" /> : name}</span><span className="mt-1.5 block truncate text-xs text-muted">{o.session.title}</span></span>
      <span className="flex items-center justify-between gap-2 border-t border-line-subtle pt-2 text-xs text-faint"><span>{ago(o.updatedAt as any)}</span><ArrowRight className="size-3.5 text-muted" aria-hidden /></span>
    </Link>
  );
}
