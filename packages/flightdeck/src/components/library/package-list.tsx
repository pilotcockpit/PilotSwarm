import * as React from "react";
import { ChevronRight, FolderUp, Package, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip, Skeleton, Tag } from "@/components/ui/misc";
import { DataReadNotice, EmptyState, Panel } from "@/components/empty";
import { adoption, isSamePerson, packageKey, packageRights, usePackages, useWorkerPackageState, type PackageSummary } from "@/data/ops/packages";
import type { Profile } from "@/data/types";
import { readDropped, type ReadResult } from "./package-source";
import { ago, bytes, cn, plural } from "@/lib/utils";

type Filter = "all" | "shared" | "mine" | "off";

export const ownerLabel = (p: PackageSummary, profile?: Profile | null) =>
  p.scope === "shared" ? "Shared" : !p.owner || isSamePerson(p.owner, profile) ? "Yours" : `${p.owner.displayName || p.owner.email || "Someone"}'s`;

/** Quiet fleet adoption for admins: how many workers run the active version. */
function Adoption({ on, failed, total }: { on: number; failed: number; total: number }) {
  const pct = total ? Math.round((on / total) * 100) : 0;
  const tone = failed ? "text-failed" : on === total ? "text-muted" : "text-waiting";
  return (
    <div className="flex shrink-0 items-center gap-2" title={`${on} of ${plural(total, "worker")} run the active version${failed ? `, ${failed} failed to load it` : ""}`}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-raised" aria-hidden><span className={cn("block h-full", failed ? "bg-failed" : on === total ? "bg-live" : "bg-waiting")} style={{ width: `${pct}%` }} /></span>
      <span className={cn("text-xs tabular-nums", tone)}>{failed ? `${plural(failed, "worker")} failed` : on === total ? "All workers" : `${on} of ${total}`}</span>
    </div>
  );
}

/**
 * Everything agents can be given, in one list: who it is shared with, whether it is on, which
 * version is active, and (for admins) whether the fleet has caught up. Drop a folder or .zip
 * anywhere on the list to start adding one.
 */
export function PackagesTab({ query, profile, onOpen, onAdd, onDropped }: {
  query: string;
  profile?: Profile | null;
  onOpen: (p: PackageSummary) => void;
  onAdd: () => void;
  onDropped: (r: ReadResult) => void;
}) {
  const { data: packages, isLoading, isError, error, refetch, isFetching } = usePackages();
  const admin = Boolean(profile?.isAdmin);
  const workers = useWorkerPackageState(admin);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [over, setOver] = React.useState(false);
  const q = query.trim().toLowerCase();
  const all = packages ?? [];
  const mineCount = all.filter((p) => p.scope === "user" && packageRights(p, profile).mine).length;
  const counts: Record<Filter, number> = { all: all.length, shared: all.filter((p) => p.scope === "shared").length, mine: mineCount, off: all.filter((p) => !p.enabled).length };
  const rows = all
    .filter((p) => filter === "all" || (filter === "shared" && p.scope === "shared") || (filter === "mine" && p.scope === "user") || (filter === "off" && !p.enabled))
    .filter((p) => !q || [p.name, p.active?.manifest?.description, p.owner?.displayName].join(" ").toLowerCase().includes(q))
    .sort((a, b) => Number(!a.enabled) - Number(!b.enabled) || a.name.localeCompare(b.name));
  const sharedNames = new Set(all.filter((p) => p.scope === "shared").map((p) => p.name));

  const drop = async (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    try { onDropped(await readDropped(e.dataTransfer.items, e.dataTransfer.files)); } catch (err: any) { toast.error("That could not be read", { description: err?.message }); }
  };

  return (
    <div onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }} onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false); }} onDrop={drop} className={cn("rounded-pane transition-colors duration-(--duration-fast)", over && "bg-accent-tint")}>
      {isError ? <div className="mb-4"><DataReadNotice title="Couldn't load packages" onRetry={() => void refetch()} busy={isFetching}>{(error as Error)?.message || "The server did not answer."}</DataReadNotice></div> : null}
      <div role="group" aria-label="Show packages" className="mb-3 flex flex-wrap gap-1.5">
        {([["all", "All"], ["shared", "Shared"], ["mine", "Yours"], ["off", "Turned off"]] as Array<[Filter, string]>).map(([k, label]) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)} disabled={k === "off" && !counts.off && filter !== k}>{label} <span className="tabular-nums text-muted">{counts[k]}</span></Chip>
        ))}
      </div>
      {isLoading ? <Skeleton className="h-48" /> : !rows.length && !isError ? (
        <Panel>
          {!all.length ? (
            <EmptyState icon={<Package />} title="No packages yet" action={<Button variant="primary" onClick={onAdd}><FolderUp /> Add a package</Button>}>A package gives agents new skills, tools and workflows. Drop a folder or .zip here, or add one to get started.</EmptyState>
          ) : (
            <EmptyState icon={<Search />} title="No packages match" action={<Button onClick={() => setFilter("all")}>Show all packages</Button>}>Try a different name, or clear the filter.</EmptyState>
          )}
        </Panel>
      ) : (
        <Panel enter>
          <ul>
            {rows.map((p) => {
              const a = admin ? adoption(p, workers.data) : null;
              const overrides = p.scope === "user" && sharedNames.has(p.name);
              return (
                <li key={packageKey(p)} className="border-t border-line-subtle first:border-t-0">
                  <button type="button" onClick={() => onOpen(p)} className="focus-inset flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition-colors duration-(--duration-fast) hover:bg-raised/70 pointer-coarse:min-h-11">
                    <span className="min-w-0 flex-1 basis-64">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold">{p.name}</span>
                        <Tag tone={p.scope === "shared" ? "accent" : "neutral"}>{ownerLabel(p, profile)}</Tag>
                        {!p.enabled ? <Tag tone="waiting">Turned off</Tag> : null}
                        {overrides ? <Tag>Overrides the shared one</Tag> : null}
                        {p.shadowed ? <Tag>Your copy takes over</Tag> : null}
                      </span>
                      {p.active?.manifest?.description ? <span className="mt-0.5 line-clamp-1 block text-sm text-muted">{String(p.active.manifest.description)}</span> : null}
                      <span className="mt-0.5 block text-xs text-muted">
                        {p.active ? <><span className="font-mono">{p.active.semver}</span> · {ago(p.active.createdAt as any)} · {bytes(p.active.sizeBytes)}</> : "No version published"}
                      </span>
                    </span>
                    {a ? <Adoption {...a} /> : null}
                    <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
      {all.length ? <p className="mt-3 text-xs text-muted">Drop a folder or .zip anywhere on this list to add or update a package.</p> : null}
    </div>
  );
}
