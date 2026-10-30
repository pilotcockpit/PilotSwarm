import * as React from "react";
import { Package, Play, Search } from "lucide-react";
import { TopBar, ClassicLink } from "@/shell/AppShell";
import { useUi } from "@/shell/ui-state";
import { useAgents, useSessions } from "@/data/source";
import { sessionState } from "@/data/state";
import type { Agent } from "@/data/types";
import { EmptyState, Panel, SectionTitle } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton, Tag } from "@/components/ui/misc";
import { ago, plural } from "@/lib/utils";

/**
 * The agents you can start. A row per agent: what it is, what it can use, whether it is
 * active for you right now, and when you last used it. Canvas-app and package management
 * are not surfaced here yet, so they get an explicit handoff instead of empty tabs.
 */
export function LibraryPage() {
  const { data: agents, isLoading, isError, refetch } = useAgents();
  const { data: sessions } = useSessions();
  const { openNewSession } = useUi();
  const [query, setQuery] = React.useState("");
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
  const matching = (agents || []).filter((a) => !q || [a.title, a.name, a.description, a.package, ...(a.tools || []), ...(a.skills || [])].join(" ").toLowerCase().includes(q));
  for (const a of matching) {
    const k = a.package || (a.source === "builtin" ? "Built in" : "Packages");
    byPackage.set(k, [...(byPackage.get(k) || []), a]);
  }
  return (
    <>
      <TopBar crumbs={[{ label: "Agent library" }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[980px] px-4 py-5 md:px-5">
          <div className="mb-5 flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">Choose the right agent for the task</h2>
              <p className="mt-1 text-sm text-muted">Compare what each agent does and the tools it can use, then start a session.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" placeholder="Find an agent or capability" aria-label="Find an agent by name, description, tool or skill" />
            </div>
          </div>
          {isError ? <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm text-failed"><span>Couldn't refresh the agent library.</span><Button size="sm" onClick={() => void refetch()}>Try again</Button></div> : null}
          {q ? <p role="status" className="mb-3 text-sm text-muted">{plural(matching.length, "agent")} {matching.length === 1 ? "matches" : "match"} “{query}”</p> : null}
          {isLoading ? (
            <Skeleton className="h-64" />
          ) : !byPackage.size && !isError ? (
            <Panel><EmptyState icon={q ? <Search /> : <Package />} title={q ? "No agents match" : "No agents available"} action={q ? <Button onClick={() => setQuery("")}>Clear search</Button> : undefined}>{q ? "Try the task you want done, a tool name, or a different agent name." : "Packages that define agents appear here once a worker loads them."}</EmptyState></Panel>
          ) : (
            [...byPackage].map(([pkg, list]) => (
              <section key={pkg} className="mb-6" aria-label={pkg}>
                <SectionTitle count={list.length}>{pkg}</SectionTitle>
                <Panel enter>
                  {list.map((a) => {
                    const u = usage.get(a.name);
                    const tools = a.tools || [];
                    const skills = a.skills || [];
                    return (
                      <div key={a.name} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-subtle px-4 py-3 first:border-t-0">
                        <div className="min-w-0 flex-1 basis-64">
                          <div className="flex min-w-0 items-baseline gap-2">
                            <h3 className="truncate text-sm font-semibold">{a.title || a.name}</h3>
                            <span className="truncate font-mono text-xs text-faint">{a.name}</span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-sm text-muted">{a.description || "No description."}</p>
                          {tools.length || skills.length ? (
                            <details className="mt-2 text-xs text-muted">
                              <summary className="min-h-6 cursor-pointer py-1 underline-offset-2 hover:text-fg hover:underline pointer-coarse:min-h-11">{[tools.length ? plural(tools.length, "tool") : null, skills.length ? plural(skills.length, "skill") : null].filter(Boolean).join(" · ")} · View capabilities</summary>
                              <dl className="mt-1 grid gap-2 border-l border-line pl-3">
                                {tools.length ? <div><dt className="font-medium text-fg">Tools</dt><dd className="mt-0.5 break-words font-mono">{tools.join(", ")}</dd></div> : null}
                                {skills.length ? <div><dt className="font-medium text-fg">Skills</dt><dd className="mt-0.5 break-words font-mono">{skills.join(", ")}</dd></div> : null}
                              </dl>
                            </details>
                          ) : <p className="mt-1 text-xs text-faint">Tool and skill details are not reported.</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {u?.active ? <Tag>{plural(u.active, "active session")}</Tag> : u?.last ? <span className="text-xs text-faint">Used {ago(u.last)}</span> : null}
                          <Button onClick={() => openNewSession({ agent: a.name })}><Play /> Start session</Button>
                        </div>
                      </div>
                    );
                  })}
                </Panel>
              </section>
            ))
          )}
          <div className="mt-2 border-t border-line pt-4">
            <p className="text-sm font-medium">Manage apps and packages</p>
            <p className="mt-1 text-sm text-muted">This library shows agents you can start. Browse canvas apps, install packages, and manage their versions in <ClassicLink>the classic portal</ClassicLink>.</p>
          </div>
        </div>
      </div>
    </>
  );
}
