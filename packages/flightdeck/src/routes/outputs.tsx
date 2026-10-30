import * as React from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { FileText, FolderOutput, Search } from "lucide-react";
import { TopBar } from "@/shell/AppShell";
import { useSessions } from "@/data/source";
import { EmptyState, Panel } from "@/components/empty";
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
  const { data: sessions } = useSessions();
  const mine = React.useMemo(() => (sessions || []).filter((s) => !s.isSystem), [sessions]);
  const all = useRecentOutputs(mine, 40);
  const q = (search.q || "").toLowerCase();
  const list = all.filter((o) => (tab === "canvases" ? isCanvasFile(o.filename) : !isCanvasFile(o.filename)) && (!q || `${o.filename} ${o.session.title} ${o.session.agentId}`.toLowerCase().includes(q)));
  return (
    <>
      <TopBar crumbs={[{ label: "Outputs" }]} />
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 md:px-5">
        <Segmented label="Outputs" value={tab} onChange={(t) => navigate({ search: (p: any) => ({ ...p, tab: t }), replace: true })} options={[{ value: "canvases", label: "Canvases" }, { value: "files", label: "Files" }]} />
        <div className="relative w-full sm:ml-auto sm:w-[280px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input value={search.q || ""} onChange={(e) => navigate({ search: (p: any) => ({ ...p, q: e.target.value || undefined }), replace: true })} placeholder="Filter by name, session or agent" className="pl-8" aria-label="Filter outputs" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] px-4 py-5 md:px-5">
          {list.length === 0 ? (
            <Panel><EmptyState icon={<FolderOutput />} title={q ? "Nothing matches" : tab === "canvases" ? "No canvases yet" : "No output files yet"}>{tab === "canvases" ? "When an agent draws a canvas it appears here, newest first, with a dot when it changed since you looked." : "Files you attach and files agents publish to a session's Outputs show up here."}</EmptyState></Panel>
          ) : tab === "canvases" ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{list.map((o) => <OutputCard key={`${o.session.sessionId}/${o.filename}`} output={o} />)}</div>
          ) : (
            <Panel>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-left text-xs text-faint"><th className="px-3 py-2 font-medium">File</th><th className="px-3 py-2 font-medium">Session</th><th className="hidden px-3 py-2 font-medium md:table-cell">Agent</th><th className="px-3 py-2 text-right font-medium">Size</th><th className="px-3 py-2 text-right font-medium">Updated</th></tr></thead>
                <tbody>
                  {list.map((o) => (
                    <tr key={`${o.session.sessionId}/${o.filename}`} className="border-b border-line-subtle last:border-0 hover:bg-raised/60">
                      <td className="px-3 py-2"><Link to="/s/$sessionId" params={{ sessionId: o.session.sessionId }} search={{ view: "files", files: "outputs", file: o.filename }} className="inline-flex items-center gap-2 font-mono text-[13px] hover:underline"><FileText className="size-4 text-muted" aria-hidden />{o.filename}</Link></td>
                      <td className="max-w-[260px] truncate px-3 py-2 text-muted">{o.session.title}</td>
                      <td className="hidden px-3 py-2 font-mono text-xs text-faint md:table-cell">{o.session.agentId}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-faint">{o.size ? bytes(o.size) : "—"}</td>
                      <td className="px-3 py-2 text-right text-faint">{ago(o.updatedAt as any)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
          <p className="mt-4 text-xs text-faint">Reads the outputs of your 40 most recently active sessions. A cross-session outputs list needs a new Web API operation (capability map, backend work).</p>
        </div>
      </div>
    </>
  );
}

export { canvasSlot };
