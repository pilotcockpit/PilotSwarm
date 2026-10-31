import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Panel } from "@/components/empty";
import { DisclosureButton } from "@/components/ui/button";
import { Skeleton, Tag } from "@/components/ui/misc";
import { installedStatus, installedVersion, splitInstalledKey, useAgentWorkerState } from "@/data/ops/admin";
import { cn } from "@/lib/utils";

/**
 * Which version of each agent package every worker has installed. A cell that differs from what most workers
 * run is marked, because a rollout stuck halfway is the thing an admin is looking for here.
 */
export function WorkerPackages() {
  const [open, setOpen] = React.useState(false);
  const { data, isLoading, error } = useAgentWorkerState(open);
  const workers = [...(data || [])].sort((a, b) => a.workerNodeId.localeCompare(b.workerNodeId));
  const names = [...new Set(workers.flatMap((w) => Object.keys(w.installed || {})))].sort();
  const common = new Map<string, string>();
  for (const n of names) {
    const counts = new Map<string, number>();
    for (const w of workers) { const v = installedVersion(w.installed?.[n]); if (v) counts.set(v, (counts.get(v) || 0) + 1); }
    const top = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (top) common.set(n, top[0]);
  }
  const skewed = names.filter((n) => workers.some((w) => { const v = installedVersion(w.installed?.[n]); return (v && v !== common.get(n)) || !installedStatus(w.installed?.[n]).ok; }));
  return (
    <section aria-label="Installed packages" className="mt-5">
      <DisclosureButton aria-expanded={open} onClick={() => setOpen((v) => !v)} className="text-sm font-semibold text-muted">
        <ChevronRight className={cn("size-4 transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden /> Installed agent packages
        {open && data ? <span className={cn("font-normal", skewed.length ? "text-waiting" : "text-faint")}>{skewed.length ? `${skewed.length} out of step` : "all in step"}</span> : null}
      </DisclosureButton>
      {open ? (
        <Panel enter className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Installed packages by worker, scrolls sideways on narrow screens">
          {isLoading ? <Skeleton className="h-24" /> : error || !names.length ? <p className="p-4 text-sm text-muted">{error ? "Package state isn't reported by this deployment." : "No worker has reported installed packages yet."}</p> : (
            <table className="w-full min-w-120 text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-faint"><th scope="col" className="px-3 py-2 font-medium">Package</th>{workers.map((w) => <th scope="col" key={w.workerNodeId} className="px-3 py-2 font-mono font-medium">{w.workerNodeId}</th>)}</tr></thead>
              <tbody>
                {names.map((n) => (
                  <tr key={n} className="border-b border-line-subtle last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-medium">{splitInstalledKey(n).name}{splitInstalledKey(n).scope ? <Tag className="ml-2">{splitInstalledKey(n).scope}</Tag> : null}</th>
                    {workers.map((w) => {
                      const v = installedVersion(w.installed?.[n]);
                      const st = installedStatus(w.installed?.[n]);
                      return (
                        <td key={w.workerNodeId} className="px-3 py-2 tabular-nums">
                          {!v ? <span className="text-faint">—</span> : !st.ok ? <Tag tone="failed" title={st.error}>{v} failed to load</Tag> : v !== common.get(n) ? <Tag tone="waiting">{v}</Tag> : <span className="text-muted">{v}</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      ) : null}
    </section>
  );
}
