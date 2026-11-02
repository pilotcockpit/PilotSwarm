import * as React from "react";
import { useIntent } from "@/shell/intents";
import { getRouteApi, Link } from "@tanstack/react-router";
import { FolderUp, Search } from "lucide-react";
import { TopBar } from "@/shell/AppShell";
import { useProfile } from "@/data/source";
import { packageKey, usePackages, type PackageSummary } from "@/data/ops/packages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { AgentRows } from "@/components/library/agent-rows";
import { AddPackageDialog } from "@/components/library/add-package";
import { PackagePanel } from "@/components/library/package-panel";
import { PackagesTab, ownerLabel } from "@/components/library/package-list";
import type { ReadResult } from "@/components/library/package-source";
import { ProductIllustration } from "@/components/product-illustration";

const route = getRouteApi("/library");

/**
 * One place to find, trust and manage what agents can do. Agents is the front door: pick one and
 * start. Packages is what provides them: who can use each, which version is live, whether the fleet
 * has caught up, and how to add, update, roll back or remove one. Opening a package never leaves
 * the page, and the two tabs link to each other.
 */
export function LibraryPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const tab: "agents" | "packages" = search.tab === "packages" ? "packages" : "agents";
  const { data: profile } = useProfile();
  const { data: packages } = usePackages();
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [dropped, setDropped] = React.useState<ReadResult | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const list = packages ?? [];
  const open: PackageSummary | null = list.find((p) => packageKey(p) === selected) ?? null;
  // A package just published is selected as soon as the refreshed list has it.
  React.useEffect(() => {
    if (!pendingId) return;
    const hit = list.find((p) => p.packageId === pendingId);
    if (hit) { setSelected(packageKey(hit)); setPendingId(null); }
  }, [pendingId, list]);

  const go = (next: "agents" | "packages") => { setQuery(""); void navigate({ search: next === "packages" ? { tab: "packages" } : {}, replace: true }); };
  const openByName = (name: string) => {
    const hit = list.find((p) => p.name === name && p.scope === "user") ?? list.find((p) => p.name === name);
    if (!hit) return;
    void navigate({ search: { tab: "packages" }, replace: true });
    setSelected(packageKey(hit));
  };
  const startAdd = (files: ReadResult | null = null) => { setDropped(files); setAdding(true); };
  useIntent("add-package", "/library", () => startAdd());

  return (
    <>
      <TopBar crumbs={[{ label: "Library" }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[980px] px-4 py-5 md:px-5">
          <div className="mb-4 flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold tracking-tight">{tab === "agents" ? "Choose the right agent for the task" : "What agents can do"}</h2>
              <p className="mt-1 text-sm text-muted">{tab === "agents" ? "Compare what each agent does and the tools it can use, then start a session." : "Packages give agents, skills, tools and MCP servers. Add one, update it, or roll it back."}</p>
            </div>
            <ProductIllustration kind="library" compact />
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Segmented label="Library" value={tab} onChange={go} options={[{ value: "agents", label: "Agents" }, { value: "packages", label: <>Packages{list.length ? <span className="ml-1 tabular-nums text-muted">{list.length}</span> : null}</> }]} />
            {tab === "packages" ? <Button variant="primary" className="ml-auto sm:ml-0" onClick={() => startAdd()}><FolderUp /> Add a package</Button> : null}
            <div className="relative w-full sm:ml-auto sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" placeholder={tab === "agents" ? "Find an agent or tool" : "Find a package"} aria-label={tab === "agents" ? "Find an agent by name, description or tool" : "Find a package by name or description"} />
            </div>
          </div>

          {tab === "agents" ? (
            <>
              <AgentRows query={query} packages={list} onOpenPackage={openByName} onClear={() => setQuery("")} />
              <p className="mt-2 border-t border-line pt-4 text-sm text-muted">A package that adds only skills, tools or MCP servers has no agent here: start any session and ask for them. Canvases that agents publish appear in <Link to="/outputs" className="text-accent hover:underline">Outputs</Link>.</p>
            </>
          ) : (
            <PackagesTab query={query} profile={profile} onOpen={(p) => setSelected(packageKey(p))} onAdd={() => startAdd()} onDropped={(r) => startAdd(r)} />
          )}
        </div>
      </div>

      {open ? <PackagePanel pkg={open} profile={profile} ownerName={ownerLabel(open, profile).replace(/'s$/, "")} onClose={() => setSelected(null)} /> : null}
      <AddPackageDialog open={adding} onOpenChange={setAdding} initial={dropped} existing={list} onPublished={(id) => { if (id) setPendingId(id); void navigate({ search: { tab: "packages" }, replace: true }); }} />
    </>
  );
}
