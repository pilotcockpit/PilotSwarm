import { getRouteApi } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { AppWindow, Bot, Package, Play, Wrench } from "lucide-react";
import { TopBar, ClassicLink } from "@/shell/AppShell";
import { useUi } from "@/shell/ui-state";
import { useAgents, useProfile } from "@/data/source";
import type { Agent } from "@/data/types";
import { EmptyState, Panel } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/misc";

const route = getRouteApi("/library");

/** The agents, canvas apps and packages you can use. */
export function LibraryPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const tab = search.tab || "agents";
  const { data: agents, isLoading } = useAgents();
  const { data: profile } = useProfile();
  const { openNewSession } = useUi();
  const byPackage = new Map<string, Agent[]>();
  for (const a of agents || []) {
    const k = a.package || (a.source === "builtin" ? "Built in" : "Packages");
    byPackage.set(k, [...(byPackage.get(k) || []), a]);
  }
  return (
    <>
      <TopBar crumbs={[{ label: "Agent library" }]} />
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5 md:px-5">
        <Segmented label="Library" value={tab} onChange={(t) => navigate({ search: { tab: t }, replace: true })} options={[{ value: "agents", label: "Agents" }, { value: "apps", label: "Canvas apps" }, { value: "packages", label: "Packages" }]} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] px-4 py-5 md:px-5">
          {tab === "agents" ? (
            isLoading ? <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div> : (
              [...byPackage].map(([pkg, list]) => (
                <section key={pkg} className="mb-6">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted"><Package className="size-4" aria-hidden /> {pkg}</h2>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {list.map((a, i) => (
                      <Card as="article" key={a.name} enter index={i} className="group flex flex-col p-4 transition-colors duration-(--duration-fast) hover:border-line-strong">
                        <div className="flex items-start gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-control bg-raised text-muted transition-colors duration-(--duration-fast) group-hover:bg-accent-tint group-hover:text-accent"><Bot className="size-4" aria-hidden /></span>
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold">{a.title || a.name}</h3>
                            <p className="truncate font-mono text-xs text-faint">{a.name}</p>
                          </div>
                        </div>
                        <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{a.description || "No description."}</p>
                        {a.tools?.length ? (
                          <p className="mt-2 flex flex-wrap gap-1">
                            {a.tools.slice(0, 4).map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-chip bg-raised px-1.5 font-mono text-xs text-muted"><Wrench className="size-3" aria-hidden />{t}</span>)}
                          </p>
                        ) : null}
                        <Button className="mt-3 self-start" onClick={() => openNewSession({ agent: a.name })}><Play /> Start session</Button>
                      </Card>
                    ))}
                  </div>
                </section>
              ))
            )
          ) : tab === "apps" ? (
            <Panel><EmptyState icon={<AppWindow />} title="Browsing canvas apps needs an API">Agents can already find published canvas apps; people can't list them yet. When the browse operation lands, apps appear here with "Use in a session".</EmptyState></Panel>
          ) : (
            <Panel>
              <EmptyState icon={<Package />} title="Packages" action={<ClassicLink>Manage packages in the classic portal</ClassicLink>}>
                Upload, import, enable, promote to shared{profile?.isAdmin ? ", see which workers run which version" : ""} and delete. Not ported to Flight Deck yet.
              </EmptyState>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
