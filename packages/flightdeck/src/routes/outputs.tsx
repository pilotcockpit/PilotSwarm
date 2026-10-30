import * as React from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { FileText, FolderOutput, Search, X } from "lucide-react";
import { TopBar } from "@/shell/AppShell";
import { useSessions } from "@/data/source";
import { DataReadNotice, EmptyState, Panel } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { ago, bytes } from "@/lib/utils";
import { OutputCard, canvasSlot, isCanvasFile, useRecentOutputs } from "./home";

const route = getRouteApi("/outputs");

/** Everything your agents produced, across every session you can see. */
export function OutputsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const tab = search.tab || "canvases";
  const catalog = useSessions();
  const { data: sessions } = catalog;
  const mine = React.useMemo(() => (sessions || []).filter((s) => !s.isSystem), [sessions]);
  const aggregate = useRecentOutputs(mine, 40);
  const all = aggregate.data;
  const loading = catalog.isLoading || aggregate.isLoading;
  const q = (search.q || "").toLowerCase();
  const canvases = all.filter((o) => isCanvasFile(o.filename)).length;
  const files = all.length - canvases;
  const list = all.filter((o) => (tab === "canvases" ? isCanvasFile(o.filename) : !isCanvasFile(o.filename)) && (!q || `${o.filename} ${o.session.title} ${o.session.agentId}`.toLowerCase().includes(q)));
  return (
    <>
      <TopBar crumbs={[{ label: "Outputs" }]} />
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 md:px-5">
        <Segmented label="Outputs" value={tab} onChange={(t) => navigate({ search: (p: any) => ({ ...p, tab: t }), replace: true })} options={[{ value: "canvases", label: `Canvases (${canvases})` }, { value: "files", label: `Files (${files})` }]} />
        <div className="relative w-full sm:ml-auto sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input value={search.q || ""} onChange={(e) => navigate({ search: (p: any) => ({ ...p, q: e.target.value || undefined }), replace: true })} placeholder="Filter by filename, session or agent" className="pl-8" aria-label="Filter outputs" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-295 space-y-5 px-4 py-6 md:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm text-muted">Find the work your agents have produced.</p><p className="text-xs text-faint">Recent {aggregate.sessionCount} of {mine.length} accessible sessions</p></div>
          <p className="text-xs leading-relaxed text-muted">Newest first. Open an output to return to its source session. Older outputs remain available inside their session.</p>
          {catalog.isError ? <DataReadNotice title="Couldn't refresh the session list" partial={Boolean(sessions)} busy={catalog.isFetching} onRetry={() => void catalog.refetch()}>The list below may be incomplete. Try again before treating it as a complete inventory.</DataReadNotice> : null}
          {aggregate.errorCount ? <DataReadNotice title={`Outputs unavailable for ${aggregate.errorCount} ${aggregate.errorCount === 1 ? "session" : "sessions"}`} partial busy={aggregate.isFetching} onRetry={() => void aggregate.refetch()}>Showing the outputs we could read. Open the source session directly or retry the missing reads.</DataReadNotice> : null}
          {loading && !list.length ? <div role="status" aria-label="Loading outputs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((n) => <Skeleton key={n} className="h-40 w-full" />)}</div> : (catalog.isError || aggregate.errorCount) && !list.length ? null : list.length === 0 ? (
            <Panel><EmptyState icon={<FolderOutput />} title={q ? "No matching outputs" : tab === "canvases" ? "Your canvases will appear here" : "Your files will appear here"} action={q ? <Button variant="quiet" onClick={() => navigate({ search: (p: any) => ({ ...p, q: undefined }), replace: true })}><X /> Clear search</Button> : <Link to="/sessions" className="inline-flex min-h-8 items-center text-sm text-accent hover:underline">Browse sessions</Link>}>{tab === "canvases" ? "When an agent draws a canvas it appears here, newest first, with a dot when it changed since you looked." : "Files you attach and files agents publish to a session's Outputs show up here."}</EmptyState></Panel>
          ) : tab === "canvases" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((o, i) => <OutputCard key={`${o.session.sessionId}/${o.filename}`} output={o} index={i} />)}</div>
          ) : (
            <Panel className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-left text-xs text-faint"><th className="px-3 py-2 font-medium">File</th><th className="px-3 py-2 font-medium">Session</th><th className="hidden px-3 py-2 font-medium md:table-cell">Agent</th><th className="px-3 py-2 text-right font-medium">Size</th><th className="px-3 py-2 text-right font-medium">Updated</th></tr></thead>
                <tbody>
                  {list.map((o) => (
                    <tr key={`${o.session.sessionId}/${o.filename}`} className="border-b border-line-subtle last:border-0 hover:bg-raised/60">
                      <td className="px-3 py-2"><Link to="/s/$sessionId" params={{ sessionId: o.session.sessionId }} search={{ view: "files", files: "outputs", file: o.filename }} className="inline-flex min-h-6 items-center gap-2 font-mono text-sm hover:underline pointer-coarse:min-h-11"><FileText className="size-4 text-muted" aria-hidden />{o.filename}</Link></td>
                      <td className="max-w-64 truncate px-3 py-2 text-muted">{o.session.title}</td>
                      <td className="hidden px-3 py-2 font-mono text-xs text-faint md:table-cell">{o.session.agentId}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-faint">{o.size ? bytes(o.size) : "—"}</td>
                      <td className="px-3 py-2 text-right text-faint">{ago(o.updatedAt as any)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
          <p className="text-xs text-faint">This view reads up to 40 recent sessions. It does not search the full output history.</p>
        </div>
      </div>
    </>
  );
}

export { canvasSlot };
