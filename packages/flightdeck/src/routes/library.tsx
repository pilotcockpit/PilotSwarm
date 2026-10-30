import * as React from "react";
import { Package, Play } from "lucide-react";
import { TopBar, ClassicLink } from "@/shell/AppShell";
import { useUi } from "@/shell/ui-state";
import { useAgents, useSessions } from "@/data/source";
import { sessionState } from "@/data/state";
import type { Agent } from "@/data/types";
import { EmptyState, Panel, SectionTitle } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { Skeleton, Tag } from "@/components/ui/misc";
import { ago, plural } from "@/lib/utils";

/**
 * The agents you can start. A row per agent: what it is, what it can use, whether it is
 * working for you right now, and when you last used it. Canvas apps and packages have no
 * browse operation yet, so they get one honest line instead of two empty tabs.
 */
export function LibraryPage() {
  const { data: agents, isLoading } = useAgents();
  const { data: sessions } = useSessions();
  const { openNewSession } = useUi();
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
  for (const a of agents || []) {
    const k = a.package || (a.source === "builtin" ? "Built in" : "Packages");
    byPackage.set(k, [...(byPackage.get(k) || []), a]);
  }
  return (
    <>
      <TopBar crumbs={[{ label: "Agent library" }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[980px] px-4 py-5 md:px-5">
          {isLoading ? (
            <Skeleton className="h-64" />
          ) : !byPackage.size ? (
            <Panel><EmptyState icon={<Package />} title="No agents available">Packages that define agents appear here once a worker loads them.</EmptyState></Panel>
          ) : (
            [...byPackage].map(([pkg, list]) => (
              <section key={pkg} className="mb-6" aria-label={pkg}>
                <SectionTitle count={list.length}>{pkg}</SectionTitle>
                <Panel enter>
                  {list.map((a) => {
                    const u = usage.get(a.name);
                    const tools = a.tools || [];
                    return (
                      <div key={a.name} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-subtle px-4 py-3 first:border-t-0">
                        <div className="min-w-0 flex-1 basis-64">
                          <div className="flex min-w-0 items-baseline gap-2">
                            <h3 className="truncate text-sm font-semibold">{a.title || a.name}</h3>
                            <span className="truncate font-mono text-xs text-faint">{a.name}</span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-sm text-muted">{a.description || "No description."}</p>
                          {tools.length ? <p className="mt-1 truncate text-xs text-faint">Can use {tools.slice(0, 4).join(", ")}{tools.length > 4 ? ` and ${tools.length - 4} more` : ""}</p> : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {u?.active ? <Tag tone="live">{plural(u.active, "session")} working</Tag> : u?.last ? <span className="text-xs text-faint">Used {ago(u.last)}</span> : null}
                          <Button onClick={() => openNewSession({ agent: a.name })}><Play /> Start session</Button>
                        </div>
                      </div>
                    );
                  })}
                </Panel>
              </section>
            ))
          )}
          <p className="text-xs text-muted">Canvas apps and agent packages are browsed and managed in <ClassicLink>the classic portal</ClassicLink> for now.</p>
        </div>
      </div>
    </>
  );
}
