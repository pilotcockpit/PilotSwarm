
import * as React from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { TopBar } from "@/shell/AppShell";
import { ClusterFlags } from "@/components/admin/flags-panel";
import { KnowledgeHealth } from "@/components/admin/knowledge-panel";
import { Maintenance } from "@/components/admin/maintenance-panel";
import { SystemSessions } from "@/components/admin/system-sessions-panel";
import { WorkerPackages } from "@/components/admin/worker-packages";
import { useFlags, useProfile, useSessions, useSource, useWorkers } from "@/data/source";
import { describeError, sessionState } from "@/data/state";
import { EmptyState, Panel } from "@/components/empty";
import { Skeleton, Tag } from "@/components/ui/misc";
import { SideNav, SideNavItem } from "@/components/ui/tabs";
import { StateGlyph } from "@/components/state";
import { ADMIN_TABS } from "@/router";
import { ago, bytes, clock, cn, tokens } from "@/lib/utils";
import { Card, Stat } from "@/components/ui/card";

const route = getRouteApi("/admin");

type AdminTab = (typeof ADMIN_TABS)[number] | "overview";
const TAB_LABEL: Record<AdminTab, string> = {
  overview: "Overview", flags: "Feature flags", workers: "Workers", system: "System sessions", audit: "Access & audit", knowledge: "Knowledge", usage: "Cluster usage", maintenance: "Maintenance",
};
// Health first; the rarely changed, mostly read-only things last. Overview is the page with no tab chosen.
const NAV_ORDER: AdminTab[] = ["overview", "workers", "system", "usage", "audit", "flags", "knowledge", "maintenance"];

export function AdminPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const tab: AdminTab = search.tab || "overview";
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
        <SideNav label="Admin sections">
          {NAV_ORDER.map((t) => (
            <SideNavItem key={t} active={t === tab} onClick={() => navigate({ search: t === "overview" ? {} : { tab: t } })}>{TAB_LABEL[t]}</SideNavItem>
          ))}
        </SideNav>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="max-w-[880px] px-4 py-5 md:px-6">
            <p className="mb-5 text-sm text-muted">{tab === "overview" ? "Check worker availability and system sessions before investigating a specific issue." : tab === "workers" ? "Runtime capacity and versions reported by registered workers." : tab === "usage" ? "Review the fleet statistics this deployment reports, with each measure shown in its own units." : tab === "audit" ? "Review returned access decisions. A missing record is not proof that no access occurred." : tab === "system" ? "The agents that keep the platform tidy. Restart one that is stuck." : tab === "flags" ? "Switch features on or off for everyone, or let people choose for themselves. Changes reach workers within about 20 seconds." : tab === "knowledge" ? "What the agents know, whether search is healthy, and the graph built from it." : tab === "maintenance" ? "Housekeeping you can run by hand. Each task says what it touches." : "Deployment administration and configuration."}</p>
            {tab === "overview" ? <Overview /> : null}
            {tab === "flags" ? <ClusterFlags /> : null}
            {tab === "workers" ? <Workers /> : null}
            {tab === "system" ? <SystemSessions /> : null}
            {tab === "audit" ? <Audit /> : null}
            {tab === "knowledge" ? <KnowledgeHealth /> : null}
            {tab === "usage" ? <ClusterUsage /> : null}
            {tab === "maintenance" ? <Maintenance /> : null}
          </div>
        </div>
      </div>
    </>
  );
}

function Workers() {
  const { data: workers, isLoading } = useWorkers();
  if (isLoading) return <Skeleton className="h-48" />;
  return (
    <>
    <Panel className="overflow-x-auto" tabIndex={0} role="region" aria-label="Workers, scrolls sideways on narrow screens">
      <table className="w-full min-w-[640px] text-sm">
        <thead><tr className="border-b border-line text-left text-xs text-faint"><th className="px-3 py-2 font-medium">Worker</th><th className="px-3 py-2 font-medium">State</th><th className="px-3 py-2 font-medium">Version</th><th className="px-3 py-2 text-right font-medium">Sessions</th><th className="px-3 py-2 text-right font-medium">Memory</th><th className="px-3 py-2 text-right font-medium">Up</th></tr></thead>
        <tbody>
          {(workers || []).map((w) => (
            <tr key={w.workerNodeId} className="border-b border-line-subtle last:border-0">
              <td className="px-3 py-2.5"><div className="font-mono text-sm">{w.workerNodeId}</div><div className="text-xs text-faint">{w.info?.runtime?.hostname}</div></td>
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
    <WorkerPackages />
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
        <div className="text-sm font-semibold">{source.kind === "live" ? "Access policy is not reported here" : "Example access policy"}</div>
        <p className="mt-1 text-sm text-muted">{source.kind === "live" ? <>This dashboard has not verified authentication, ownership enforcement, or the deployment's admin scope. Check the deployment's configured access policy before relying on a session's privacy label.</> : "In this demo, ownership is enforced and new sessions are private by default. These are example settings, not a statement about your deployment."}</p>
      </Panel>
      {!data?.length ? <Panel><EmptyState title="No access records returned">The current request returned no records. This does not establish whether audit history is empty, unavailable, or outside your access.</EmptyState></Panel> : (
        <Panel>
          {data.map((r: any, i: number) => (
            <div key={i} className={cn("flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-line-subtle px-4 py-2.5 text-sm first:border-t-0", r.admin && "bg-waiting-tint/40")}>
              <span className="font-medium">{r.actor || r.principal?.displayName || r.subject || "Someone"}</span>
              <span className="font-mono text-xs text-muted">{r.action || r.operation}</span>
              {typeof r.decision === "string" ? <span className="text-xs font-medium">{r.decision}</span> : null}
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
  const metrics: Array<{ label: string; value: unknown; unit?: string }> = [
    { label: "Sessions", value: data.sessionCount ?? data.sessions },
    { label: "Input tokens", value: data.tokensIn },
    { label: "Output tokens", value: data.tokensOut },
    { label: "Cached input tokens", value: data.tokensCacheRead },
    { label: "Cache hit rate", value: data.cacheHitPct, unit: "%" },
    { label: "Agents", value: data.agents },
    { label: "Running sessions", value: data.running },
    { label: "Waiting sessions", value: data.waiting },
    { label: "Failed sessions", value: data.failed },
    { label: "Tokens today", value: data.tokensToday },
  ].filter((m) => typeof m.value === "number" && Number.isFinite(m.value));
  return (
    <>
      {data.window?.since ? <p className="mb-3 text-xs text-muted">Reporting window begins {new Date(data.window.since).toLocaleString()}.</p> : null}
      {metrics.length ? <Card as="div" enter clip className="mb-4">
        <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
          {metrics.map((m) => (
            <Stat key={m.label} className="bg-surface" label={m.label} value={`${m.unit ? m.value : tokens(m.value as number)}${m.unit || ""}`} />
          ))}
        </dl>
      </Card> : <Panel><EmptyState title="No recognized fleet measures">The response did not include the session or token measures this dashboard supports.</EmptyState></Panel>}
      <p className="mb-4 text-xs text-muted">Only reported measures are shown. Missing values are not counted as zero.</p>
      {Array.isArray((data as any).noisiest) ? (
        <Panel>
          <div className="border-b border-line px-4 py-2 text-sm font-semibold">Noisiest sessions</div>
          {(data as any).noisiest.map((n: any) => <div key={n.title} className="flex justify-between border-t border-line-subtle px-4 py-2 text-sm first:border-t-0"><span>{n.title}</span><span className="font-mono tabular-nums text-muted">{n.events} events</span></div>)}
        </Panel>
      ) : null}
    </>
  );
}



/** The page an admin opens: is the cluster healthy, and if not, where to look. Rows, not tiles. */
function Overview() {
  const { data: workers, isLoading } = useWorkers();
  const { data: sessions } = useSessions();
  const { data: flags } = useFlags();
  if (isLoading) return <Skeleton className="h-48" />;
  const list = workers || [];
  const ready = list.filter((w) => w.phase === "ready");
  const unavailable = list.filter((w) => w.phase !== "ready");
  const slots = ready.reduce((n, w) => n + (w.health?.workerSlots?.total || 0), 0);
  const active = list.reduce((n, w) => n + (w.health?.activeSessions || 0), 0);
  const versions = [...new Set(list.map((w) => w.info?.sdkVersion).filter(Boolean))] as string[];
  const missingVersions = list.filter((w) => !w.info?.sdkVersion).length;
  const system = (sessions || []).filter((s) => s.isSystem);
  const failed = system.filter((s) => sessionState(s).key === "failed");
  const err = failed[0] ? describeError(failed[0].error) : null;
  const on = (flags || []).filter((f) => (f.value ?? f.default) === true).length;
  const rows: Array<{ key: string; state: "running" | "waiting" | "failed" | "completed"; title: string; detail: React.ReactNode; to: (typeof ADMIN_TABS)[number] }> = [
    {
      key: "workers",
      state: !list.length ? "failed" : unavailable.length ? "waiting" : "running",
      title: !list.length ? "No workers registered" : `${ready.length} of ${list.length} workers ready`,
      detail: !list.length ? "No worker data was returned. Check registration and connectivity before starting work." : unavailable.length ? `${unavailable.length} ${unavailable.length === 1 ? "worker is" : "workers are"} not reporting ready. Open Workers to inspect each state.` : "Every registered worker reports ready.",
      to: "workers",
    },
    {
      key: "capacity",
      state: !slots || active / slots > 0.85 ? "waiting" : "running",
      title: slots ? `${active} of ${slots} session slots in use` : `${active} active ${active === 1 ? "session" : "sessions"}`,
      detail: !slots ? "Available slot capacity was not reported. Check worker readiness." : active / slots > 0.85 ? "Reported slot use is above 85%. Review capacity before adding work." : "Reported active sessions are below the available slot count.",
      to: "workers",
    },
    {
      key: "versions",
      state: versions.length !== 1 || missingVersions ? "waiting" : "running",
      title: versions.length > 1 ? `${versions.length} SDK versions are running` : versions.length ? `Reported SDK version v${versions[0]}` : "Worker versions unknown",
      detail: versions.length > 1 ? `v${versions.join(", v")}. Review compatibility during the rollout.` : missingVersions ? `${missingVersions} ${missingVersions === 1 ? "worker did" : "workers did"} not report an SDK version.` : versions.length ? "Every registered worker reports the same SDK version." : "No SDK version was returned by the workers.",
      to: "workers",
    },
    {
      key: "system",
      state: failed.length ? "failed" : system.length ? "running" : "waiting",
      title: failed.length ? `${failed.length} of ${system.length} system sessions failed` : system.length ? `${system.length} system sessions, no failures reported` : "No system sessions returned",
      detail: failed.length && err ? err.detail || err.headline : system.length ? "Open System sessions to inspect their current work and waiting states." : "Check which housekeeping agents are configured for this deployment.",
      to: "system",
    },
    {
      key: "flags",
      state: "completed",
      title: `${on} of ${(flags || []).length} feature flags on`,
      detail: "Turn features on or off for everyone, or let people choose.",
      to: "flags",
    },
  ];
  return (
    <Panel enter>
      {rows.map((r) => (
        <Link key={r.key} to="/admin" search={{ tab: r.to }} className="flex items-start gap-3 border-t border-line-subtle px-4 py-3 transition-colors duration-(--duration-fast) first:border-t-0 hover:bg-raised/70 pointer-coarse:min-h-11">
          <span className="mt-1.5"><StateGlyph state={r.state} pulse={false} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{r.title}</span>
            <span className="block text-sm text-muted">{r.detail}</span>
          </span>
          {r.state === "failed" || r.state === "waiting" ? <Tag tone={r.state}>Check</Tag> : null}
        </Link>
      ))}
    </Panel>
  );
}
