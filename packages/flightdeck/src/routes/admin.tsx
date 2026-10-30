
import { getRouteApi } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Brain, Lock, ShieldCheck, Wrench } from "lucide-react";
import { TopBar, ClassicLink } from "@/shell/AppShell";
import { useFlags, useProfile, useSessions, useSource, useWorkers } from "@/data/source";
import { describeError, sessionState } from "@/data/state";
import { SessionRow } from "@/components/session-row";
import { EmptyState, Panel } from "@/components/empty";
import { Skeleton } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/tooltip";
import { ADMIN_TABS } from "@/router";
import { ago, bytes, clock, cn, tokens } from "@/lib/utils";

const route = getRouteApi("/admin");

const TAB_LABEL: Record<(typeof ADMIN_TABS)[number], string> = {
  flags: "Feature flags", workers: "Workers", system: "System sessions", audit: "Access & audit", knowledge: "Knowledge", usage: "Cluster usage", maintenance: "Maintenance",
};

export function AdminPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const tab = search.tab || "flags";
  const { data: profile } = useProfile();
  if (profile && !profile.isAdmin) {
    return (
      <>
        <TopBar crumbs={[{ label: "Admin" }]} />
        <EmptyState icon={<ShieldCheck />} title="Admins only" className="flex-1">Ask an admin if you need a provider, a feature flag or a worker changed.</EmptyState>
      </>
    );
  }
  return (
    <>
      <TopBar crumbs={[{ label: "Admin", to: "/admin" }, { label: TAB_LABEL[tab] }]} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Admin sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-3 py-2 md:w-[200px] md:flex-col md:overflow-visible md:border-b-0 md:border-r md:py-4">
          {ADMIN_TABS.map((t) => (
            <button key={t} type="button" aria-current={t === tab ? "page" : undefined} onClick={() => navigate({ search: { tab: t } })} className={cn("h-8 shrink-0 rounded-control px-2.5 text-left text-sm font-medium pointer-coarse:h-11", t === tab ? "bg-raised text-fg" : "text-muted hover:text-fg")}>{TAB_LABEL[t]}</button>
          ))}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="max-w-[880px] px-4 py-5 md:px-6">
            {tab === "flags" ? <Flags /> : null}
            {tab === "workers" ? <Workers /> : null}
            {tab === "system" ? <SystemSessions /> : null}
            {tab === "audit" ? <Audit /> : null}
            {tab === "knowledge" ? <Panel><EmptyState icon={<Brain />} title="Knowledge" action={<ClassicLink>Open in classic portal</ClassicLink>}>Facts and graph namespaces, embedder status and purge are not ported yet.</EmptyState></Panel> : null}
            {tab === "usage" ? <ClusterUsage /> : null}
            {tab === "maintenance" ? <Panel><EmptyState icon={<Wrench />} title="Maintenance" action={<ClassicLink>Open in classic portal</ClassicLink>}>Pruning deleted-session summaries and similar upkeep. Destructive, so it stays in the classic portal until it has a reviewed confirmation flow here.</EmptyState></Panel> : null}
          </div>
        </div>
      </div>
    </>
  );
}

function Flags() {
  const { data: flags, isLoading } = useFlags();
  if (isLoading) return <Skeleton className="h-48" />;
  return (
    <>
      <p className="mb-3 text-sm text-muted">Cluster values. Each flag's history is its change audit. Changing values is not ported yet: <ClassicLink>use the classic portal</ClassicLink>.</p>
      <Panel>
        {(flags || []).map((f) => (
          <div key={f.key} className="flex items-center gap-4 border-t border-line-subtle px-4 py-3 first:border-t-0">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-sm">{f.key}</div>
              {f.description ? <div className="text-xs text-muted">{String(f.description)}</div> : null}
            </div>
            {typeof (f.value ?? f.default) === "boolean" ? (
              <Tooltip content="Read-only in this preview: change it in the classic portal">
                <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium", f.value ?? f.default ? "bg-accent-tint text-accent" : "bg-raised text-muted")} aria-label={`${f.key}: ${f.value ?? f.default ? "on" : "off"}, read-only`}>
                  <Lock className="size-3" aria-hidden /> {f.value ?? f.default ? "On" : "Off"}
                </span>
              </Tooltip>
            ) : <span className="font-mono text-xs text-muted">{JSON.stringify(f.value ?? f.default)}</span>}
          </div>
        ))}
      </Panel>
    </>
  );
}

function Workers() {
  const { data: workers, isLoading } = useWorkers();
  if (isLoading) return <Skeleton className="h-48" />;
  return (
    <Panel className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead><tr className="border-b border-line text-left text-xs text-faint"><th className="px-3 py-2 font-medium">Worker</th><th className="px-3 py-2 font-medium">State</th><th className="px-3 py-2 font-medium">Version</th><th className="px-3 py-2 text-right font-medium">Sessions</th><th className="px-3 py-2 text-right font-medium">Memory</th><th className="px-3 py-2 text-right font-medium">Up</th></tr></thead>
        <tbody>
          {(workers || []).map((w) => (
            <tr key={w.workerNodeId} className="border-b border-line-subtle last:border-0">
              <td className="px-3 py-2.5"><div className="font-mono text-[13px]">{w.workerNodeId}</div><div className="text-xs text-faint">{w.info?.runtime?.hostname}</div></td>
              <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5"><span className={cn("size-2 rounded-full", w.phase === "ready" ? "bg-live" : "bg-waiting")} aria-hidden />{w.phase}</span></td>
              <td className="px-3 py-2.5 font-mono text-xs">{w.info?.sdkVersion ? `v${w.info.sdkVersion}` : "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{w.health?.activeSessions ?? 0}{w.health?.workerSlots?.total ? ` / ${w.health.workerSlots.total}` : ""}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted">{w.health?.rssBytes ? bytes(w.health.rssBytes) : "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted">{w.health?.uptimeS ? `${Math.round(w.health.uptimeS / 3600)}h` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function SystemSessions() {
  const { data: sessions } = useSessions();
  const system = (sessions || []).filter((s) => s.isSystem);
  const failed = system.filter((s) => sessionState(s).key === "failed");
  const err = failed[0] ? describeError(failed[0].error) : null;
  return (
    <>
      {err ? (
        <div role="alert" className="mb-4 rounded-pane border border-failed/35 bg-failed-tint p-3 text-sm">
          <p className="font-semibold">{failed.length} of {system.length} system sessions failed with the same cause.</p>
          <p className="mt-0.5 text-fg/85">{err.detail || err.headline}</p>
        </div>
      ) : null}
      <Panel>{system.length ? system.map((s) => <SessionRow key={s.sessionId} session={s} />) : <EmptyState title="No system sessions" />}</Panel>
      <p className="mt-3 text-xs text-muted">Restart with Complete, Cancel or Delete &amp; restart is not ported yet: <ClassicLink>use the classic portal</ClassicLink>.</p>
    </>
  );
}

function Audit() {
  const { source } = useSource();
  const { data, isLoading } = useQuery({ queryKey: ["audit"], queryFn: () => source.authzAudit() });
  if (isLoading) return <Skeleton className="h-48" />;
  return (
    <>
      <Panel className="mb-4 p-4">
        <div className="text-sm font-semibold">Access posture</div>
        <p className="mt-1 text-sm text-muted">{source.kind === "live" ? "Authentication is off for this local deployment: everyone who can reach it has full access, and ownership is not enforced." : "Ownership is enforced. New sessions are private by default. Admins see every session, and their access is logged."}</p>
      </Panel>
      {!data?.length ? <Panel><EmptyState title="No access records yet">Who opened which session shows here, with admin access highlighted.</EmptyState></Panel> : (
        <Panel>
          {data.map((r: any, i: number) => (
            <div key={i} className={cn("flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-line-subtle px-4 py-2.5 text-sm first:border-t-0", r.admin && "bg-waiting-tint/40")}>
              <span className="font-medium">{r.actor || r.principal?.displayName || r.subject || "Someone"}</span>
              <span className="font-mono text-xs text-muted">{r.action || r.operation}</span>
              {r.admin ? <span className="text-xs font-medium text-waiting">admin access</span> : null}
              <span className="ml-auto text-xs text-faint">{clock(r.at || r.createdAt)} · {ago(r.at || r.createdAt)}</span>
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}

function ClusterUsage() {
  const { source } = useSource();
  const { data, isLoading } = useQuery({ queryKey: ["fleet"], queryFn: () => source.fleetStats() });
  if (isLoading) return <Skeleton className="h-48" />;
  if (!data) return <Panel><EmptyState title="No fleet stats">This deployment did not return fleet statistics.</EmptyState></Panel>;
  const entries = Object.entries(data).filter(([, v]) => typeof v !== "object");
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {entries.slice(0, 6).map(([k, v]) => (
          <div key={k} className="rounded-pane border border-line bg-surface p-3.5">
            <div className="text-xs text-muted">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</div>
            <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums">{typeof v === "number" && v > 9999 ? tokens(v) : String(v)}</div>
          </div>
        ))}
      </div>
      {Array.isArray((data as any).noisiest) ? (
        <Panel>
          <div className="border-b border-line px-4 py-2 text-sm font-semibold">Noisiest sessions</div>
          {(data as any).noisiest.map((n: any) => <div key={n.title} className="flex justify-between border-t border-line-subtle px-4 py-2 text-sm first:border-t-0"><span>{n.title}</span><span className="font-mono tabular-nums text-muted">{n.events} events</span></div>)}
        </Panel>
      ) : null}
    </>
  );
}


