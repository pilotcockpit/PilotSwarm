import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { canvasName } from "@/canvas/CanvasFrame";
import { ArrowRight, FileText, LayoutPanelLeft, Plus, ServerCrash } from "lucide-react";
import { TopBar } from "@/shell/AppShell";
import { useUi } from "@/shell/ui-state";
import { useProfile, useSessions, useSource } from "@/data/source";
import { describeError, failureKey, needsYou, sessionState, type StateKey } from "@/data/state";
import type { Artifact, Session } from "@/data/types";
import { DurableSpine, StateGlyph } from "@/components/state";
import { EmptyState, Panel, SectionTitle } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { ago, clock, cn, plural, until } from "@/lib/utils";
import { cardVariants } from "@/components/ui/card";
import { CapacityLine } from "@/components/capacity-line";
import { FailureGroup, NeedsRow } from "@/components/needs-row";
import { SinceLeft } from "@/components/since-left";
import { StateFacets } from "@/components/state-facets";

type Facet = "needs" | "failed" | "running" | "waiting" | "completed";

/** Home answers "what needs me?". Each section hides when it is empty. */
export function HomePage() {
  const { data: sessions, isLoading } = useSessions();
  const { data: profile } = useProfile();
  const { openNewSession } = useUi();
  const navigate = useNavigate();
  const admin = Boolean(profile?.isAdmin);

  const groups = React.useMemo(() => {
    const all = sessions || [];
    // System sessions are the admin's business: they never crowd a member's Running or Scheduled.
    const visible = all.filter((s) => !s.isSystem || admin);
    const mine = all.filter((s) => !s.isSystem);
    const needs = mine.filter(needsYou).sort(byNeedsPriority);
    const running = visible.filter((s) => sessionState(s).key === "running");
    const waiting = visible
      .filter((s) => sessionState(s).key === "waiting" && sessionState(s).waitKind !== "hold")
      .sort((a, b) => (sessionState(a).nextAt || Infinity) - (sessionState(b).nextAt || Infinity));
    const systemFailed = all.filter((s) => s.isSystem && sessionState(s).key === "failed");
    const counts: Partial<Record<StateKey, number>> = {};
    for (const s of mine) { const k = sessionState(s).key; counts[k] = (counts[k] || 0) + 1; }
    // Failures with one cause collapse into one row; questions and holds stay individual.
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

  const name = profile?.anonymous ? "" : (profile?.displayName || "").split(" ")[0];
  const nothingYet = !isLoading && groups.mine.length === 0;
  const n = groups.needs.length;
  const headline = isLoading ? "Reading your sessions…" : nothingYet ? `Welcome to PilotSwarm${name ? `, ${name}` : ""}` : n ? `${plural(n, "session")} ${n === 1 ? "needs" : "need"} you` : "Nothing needs you right now";

  return (
    <>
      <TopBar crumbs={[{ label: "Home" }]} titleIsHeading={false} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-295 px-4 py-6 md:px-6">
          <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1 basis-[280px]">
              <h1 className="text-xl font-semibold tracking-tight">{headline}</h1>
              <CapacityLine />
            </div>
            {nothingYet || isLoading ? null : (
              <StateFacets counts={groups.counts} onChange={(k) => navigate({ to: "/sessions", search: { state: k === "completed" ? "closed" : (k as Facet) } as any })} />
            )}
          </div>

          <SinceLeft sessions={sessions || []} />

          {groups.systemFailed.length && admin ? <FleetNotice failed={groups.systemFailed} /> : null}

          {nothingYet ? (
            <Panel enter className="mb-6">
              <EmptyState
                icon={<Plus />}
                title="Start your first session"
                action={<Button variant="primary" onClick={() => openNewSession()}><Plus /> New session</Button>}
              >
                Describe a task and pick an agent. Sessions are durable: they keep working, sleep, and wake up on their own.
              </EmptyState>
            </Panel>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="flex min-w-0 flex-col gap-6">
              {isLoading ? <LoadingList /> : null}
              {groups.items.length ? (
                <section aria-labelledby="needs-h">
                  <SectionTitle id="needs-h" count={groups.needs.length}>Needs you</SectionTitle>
                  <Panel enter>
                    {groups.items.map((it) => it.kind === "row" ? <NeedsRow key={it.session.sessionId} session={it.session} /> : <FailureGroup key={it.key} sessions={it.sessions} />)}
                  </Panel>
                </section>
              ) : null}
              {groups.running.length ? (
                <section aria-labelledby="running-h">
                  <SectionTitle id="running-h" count={groups.running.length} action={<Link to="/sessions" search={{ state: "running" }} className="text-accent hover:underline">All sessions</Link>}>Running</SectionTitle>
                  <Panel enter>
                    {groups.running.map((s) => (
                      <Link key={s.sessionId} to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="focus-inset flex min-h-[52px] items-center gap-3 border-t border-line-subtle px-4 py-2 first:border-t-0 hover:bg-raised/70">
                        <StateGlyph state="running" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{s.title}</span>
                          <span className="block truncate text-xs text-muted">{s.step || s.shortSummary || "Working"} · {s.isSystem ? `system:${s.agentId}` : s.agentId}</span>
                        </span>
                        <DurableSpine marks={s.spine} />
                        <span className="w-12 text-right text-xs tabular-nums text-faint">{ago(s.updatedAt)}</span>
                      </Link>
                    ))}
                  </Panel>
                </section>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              {groups.waiting.length ? (
                <section aria-labelledby="sched-h">
                  <SectionTitle id="sched-h">Scheduled and waiting</SectionTitle>
                  <Panel enter>{groups.waiting.map((s) => <WaitingRow key={s.sessionId} session={s} />)}</Panel>
                </section>
              ) : null}
              <RecentOutputs sessions={groups.mine} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function byNeedsPriority(a: Session, b: Session) {
  const rank = (s: Session) => ({ needs: 0, failed: 1, waiting: 2 } as Record<string, number>)[sessionState(s).key] ?? 3;
  return rank(a) - rank(b) || (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0);
}

function WaitingRow({ session: s }: { session: Session }) {
  const st = sessionState(s);
  const at = st.nextAt;
  return (
    <Link to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="flex min-h-[56px] items-center gap-3 border-t border-line-subtle px-4 py-2.5 first:border-t-0 hover:bg-raised/70">
      <span className="w-[58px] shrink-0 leading-tight">
        {at ? (
          <>
            <span className="block text-sm font-medium tabular-nums text-fg">{clock(at)}</span>
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
    return out.sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt));
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
  const outputs = useRecentOutputs(sessions).slice(0, 4);
  if (!outputs.length) return null;
  return (
    <section aria-labelledby="outputs-h">
      <SectionTitle id="outputs-h" action={<Link to="/outputs" className="text-accent hover:underline">All outputs</Link>}>Recent outputs</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {outputs.map((o, i) => <OutputCard key={`${o.session.sessionId}/${o.filename}`} output={o} index={i} />)}
      </div>
    </section>
  );
}

export function OutputCard({ output: o, index }: { output: Artifact & { session: Session }; index?: number }) {
  const canvas = isCanvasFile(o.filename);
  const slot = canvasSlot(o.filename);
  const { source } = useSource();
  // Canvases are named by what they show, so read the page (cached per revision).
  const { data: html, isLoading: htmlLoading } = useQuery({
    queryKey: ["artifact-text", o.session.sessionId, o.filename, o.updatedAt],
    queryFn: () => source.readArtifact(o.session.sessionId, o.filename),
    enabled: canvas,
    staleTime: 60_000,
  });
  const loadingName = canvas && htmlLoading;
  const name = canvas ? canvasName(html, slot) : o.filename;
  // The unseen dot follows the same rule as the session's Canvas tab: the primary canvas.
  const unseen = canvas && slot === 1 && o.session.unseenCanvas;
  return (
    <Link
      to="/s/$sessionId"
      params={{ sessionId: o.session.sessionId }}
      search={canvas ? { view: "canvas", slot } : { view: "files", files: "outputs", file: o.filename }}
      style={index != null ? { animationDelay: `${Math.min(index, 8) * 30}ms` } : undefined}
      className={cn(cardVariants({ interactive: true, clip: true, enter: true }), "group flex flex-col")}
    >
      <div className={cn("relative grid h-[92px] place-items-center overflow-hidden border-b border-line", canvas ? "bg-raised" : "bg-bg")}>
        <div className="grid size-full place-items-center transition-transform duration-(--duration-slow) ease-emphasized motion-safe:group-hover:scale-[1.04]">
          {canvas ? <CanvasThumb kind={canvasKind(html)} /> : <FileText className="size-5 text-faint" aria-hidden />}
        </div>
        {unseen ? <span className="absolute right-2 top-2 size-2 rounded-full bg-accent" aria-label="Updated since you looked" /> : null}
      </div>
      <div className="min-w-0 p-2.5">
        <div className="truncate text-sm font-medium transition-colors duration-(--duration-fast) group-hover:text-accent"><span className="sr-only">{canvas ? "Canvas" : "File"}: </span>{loadingName ? <span className="block h-4 w-2/3 rounded-chip bg-raised" aria-hidden /> : name}</div>
        <div className="mt-0.5 flex items-baseline gap-2 text-xs text-muted">
          <span className="min-w-0 flex-1 truncate">{o.session.title}</span>
          <span className="shrink-0 tabular-nums text-faint">{ago(o.updatedAt as any)}</span>
        </div>
      </div>
    </Link>
  );
}

type ThumbKind = "chart" | "table" | "checklist" | "page";

/** What a canvas mostly is, read from its markup: enough to draw an honest miniature. */
function canvasKind(html?: string): ThumbKind {
  const h = String(html || "");
  if (/<(polyline|path|canvas)\b/i.test(h) && /<svg|<canvas/i.test(h)) return "chart";
  if (/role="checkbox"|type="checkbox"|class="box/i.test(h)) return "checklist";
  if (/<table\b/i.test(h)) return "table";
  return "page";
}

function CanvasThumb({ kind }: { kind: ThumbKind }) {
  if (kind === "chart") {
    return (
      <svg viewBox="0 0 120 56" className="h-[60px] w-[72%]" aria-hidden>
        {[12, 28, 44].map((y) => <line key={y} x1="0" x2="120" y1={y} y2={y} className="stroke-line-strong" strokeWidth="0.6" />)}
        <line x1="62" x2="62" y1="4" y2="52" className="stroke-faint" strokeDasharray="2 2" strokeWidth="0.8" />
        <polyline fill="none" className="stroke-accent" strokeWidth="1.8" points="0,40 12,39 24,41 36,38 48,40 60,37 66,20 78,16 90,19 102,13 114,17 120,15" />
      </svg>
    );
  }
  if (kind === "table") {
    return (
      <span className="flex w-[72%] flex-col gap-1" aria-hidden>
        {[0, 1, 2, 3].map((r) => (
          <span key={r} className="flex gap-1">{[0, 1, 2].map((c) => <span key={c} className={cn("h-1.5 flex-1 rounded-[1px]", r === 0 ? "bg-faint/60" : c === 1 && r === 2 ? "bg-waiting/70" : "bg-line-strong")} />)}</span>
        ))}
      </span>
    );
  }
  if (kind === "checklist") {
    return (
      <span className="flex w-[70%] flex-col gap-1.5" aria-hidden>
        <span className="h-1.5 w-1/2 rounded bg-line-strong" />
        <span className="h-1 w-full rounded bg-ok/60" />
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-[2px]", i < 2 ? "bg-ok/70" : "border border-line-strong")} /><span className="h-1 flex-1 rounded bg-line-strong" /></span>
        ))}
      </span>
    );
  }
  return <LayoutPanelLeft className="size-5 text-faint" aria-hidden />;
}
