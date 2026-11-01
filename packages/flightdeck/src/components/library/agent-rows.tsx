import * as React from "react";
import { Package as PackageIcon, Play, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton, Tag } from "@/components/ui/misc";
import { DataReadNotice, EmptyState, Panel, SectionTitle } from "@/components/empty";
import { useUi } from "@/shell/ui-state";
import { useAgents, useSessions } from "@/data/source";
import { sessionState } from "@/data/state";
import type { Agent } from "@/data/types";
import { composeAgents } from "@/lib/agent-composition";
import type { PackageSummary } from "@/data/ops/packages";
import { ago, cn, plural } from "@/lib/utils";

/**
 * The agents you can start, grouped by the package that provides them. Each group says which
 * version is live and whether the package is on, and opens the package; each agent says what it
 * can use and when you last used it.
 */
export function AgentRows({ query, packages, onOpenPackage, onClear }: { query: string; packages: PackageSummary[]; onOpenPackage: (name: string) => void; onClear: () => void }) {
  const { data: agents, isLoading, isError, error, refetch, isFetching } = useAgents();
  const { data: sessions } = useSessions();
  const { openNewSession } = useUi();
  const q = query.trim().toLowerCase();
  const usage = React.useMemo(() => {
    const m = new Map<string, { active: number; last: number }>();
    for (const s of sessions || []) {
      if (s.isSystem || !s.agentId) continue;
      const u = m.get(s.agentId) || { active: 0, last: 0 };
      if (["running", "needs", "waiting"].includes(sessionState(s).key)) u.active += 1;
      u.last = Math.max(u.last, Number(s.updatedAt) || 0);
      m.set(s.agentId, u);
    }
    return m;
  }, [sessions]);
  const byPackage = new Map<string, Agent[]>();
  const matching = (agents || []).filter((a) => !q || [a.title, a.name, a.description, a.package, ...(a.tools || [])].join(" ").toLowerCase().includes(q));
  for (const a of matching) {
    const k = a.package || a.packageTitle || a.packageName || (a.source === "builtin" ? "Built in" : "Other agents");
    byPackage.set(k, [...(byPackage.get(k) || []), a]);
  }
  const pkgFor = (key: string, list: Agent[]) => {
    const name = list[0]?.packageName || key;
    return packages.find((p) => p.name === name || p.name === key);
  };
  return (
    <>
      {isError ? <div className="mb-4"><DataReadNotice title="Couldn't refresh the agent library" onRetry={() => void refetch()} busy={isFetching}>{(error as Error)?.message || "The server did not answer."}</DataReadNotice></div> : null}
      {q ? <p role="status" className="mb-3 text-sm text-muted">{plural(matching.length, "agent")} {matching.length === 1 ? "matches" : "match"} “{query}”</p> : null}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !byPackage.size && !isError ? (
        <Panel><EmptyState icon={q ? <Search /> : <PackageIcon />} title={q ? "No agents match" : "No agents available"} action={q ? <Button onClick={onClear}>Clear search</Button> : undefined}>{q ? "Try the task you want done, a tool name, or a different agent name." : "Add a package that defines agents, or ask an admin to. They appear here within about 20 seconds."}</EmptyState></Panel>
      ) : (
        [...byPackage].map(([pkgKey, list]) => {
          const pkg = pkgFor(pkgKey, list);
          return (
            <section key={pkgKey} className="mb-6" aria-label={pkgKey}>
              <SectionTitle count={list.length} action={pkg ? <button type="button" onClick={() => onOpenPackage(pkg.name)} className="inline-flex min-h-6 items-center text-accent hover:underline pointer-coarse:min-h-11">{pkg.active ? `v${pkg.active.semver} · ` : ""}Open package</button> : undefined}>{pkgKey}</SectionTitle>
              <Panel enter>
                {composeAgents(list).map((a) => {
                  const u = usage.get(a.name);
                  const tools = a.tools || [];
                  return (
                    <div key={a.name} style={a.depth ? { paddingLeft: `${1 + Math.min(a.depth, 3) * 1.5}rem` } : undefined} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-subtle px-4 py-3 first:border-t-0", a.depth && "bg-raised/40")}>
                      <div className="min-w-0 flex-1 basis-64">
                        <div className="flex min-w-0 items-baseline gap-2">
                          <h3 className="truncate text-sm font-semibold">{a.title || a.name}</h3>
                          <span className="truncate font-mono text-xs text-faint">{a.name}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted">{a.description || "No description."}</p>
                        {tools.length ? (
                          <details className="mt-2 text-xs text-muted">
                            <summary className="min-h-6 cursor-pointer py-1 underline-offset-2 hover:text-fg hover:underline pointer-coarse:min-h-11">{plural(tools.length, "tool")} · View tools</summary>
                            <dl className="mt-1 grid gap-2 border-l border-line pl-3">
                              <div><dt className="font-medium text-fg">Tools</dt><dd className="mt-0.5 break-words font-mono">{tools.join(", ")}</dd></div>
                            </dl>
                          </details>
                        ) : <p className="mt-1 text-xs text-faint">Tool details are not reported.</p>}
                        {!a.startable && a.parentName ? <p className="mt-1 text-xs text-muted">Started by {a.parentName}. It cannot be started on its own.</p> : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {u?.active ? <Tag>{plural(u.active, "active session")}</Tag> : u?.last ? <span className="text-xs text-faint">Used {ago(u.last)}</span> : null}
                        {a.startable ? <Button onClick={() => openNewSession({ agent: a.name })}><Play /> Start session</Button> : null}
                      </div>
                    </div>
                  );
                })}
              </Panel>
            </section>
          );
        })
      )}
    </>
  );
}
