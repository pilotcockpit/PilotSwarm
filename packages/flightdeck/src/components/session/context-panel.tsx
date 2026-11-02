import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Copy, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { useArtifacts, useGroups, useSessions } from "@/data/source";
import { modelShort, sessionState } from "@/data/state";
import type { Session } from "@/data/types";
import { ProjectIcon } from "@/components/project-icon";
import { SessionChip } from "@/components/session-chip";
import { sessionFacts } from "./session-facts";
import { Button } from "@/components/ui/button";
import { ScheduleActions } from "@/components/session/schedule-actions";
import { contextFill, ownerName, VisibilityLabel } from "@/components/session/session-meta";
import { canvasSlot, isCanvasFile } from "@/routes/home";
import { ago, bytes, cn, plural, shortId, tokens } from "@/lib/utils";
import type { SessionView } from "@/router";

/**
 * What belongs to this session, at a glance, beside the conversation: where it runs, how full its
 * context is, what it will do next, who it delegated to, what it produced. Each block shows only
 * what the server actually returned; a session with nothing to say about a block does not get an
 * empty heading.
 */
export function ContextView({ session, onOpen }: { session: Session; onOpen: (view: SessionView, patch?: Record<string, unknown>) => void }) {
  const st = sessionState(session);
  const { data: all } = useSessions();
  const { data: groups } = useGroups();
  const { data: artifacts } = useArtifacts(session.sessionId);
  const children = (all || []).filter((s) => s.parentSessionId === session.sessionId);
  const ctx = (session as any).contextUsage as { utilization?: number; tokenLimit?: number; currentTokens?: number; usedTokens?: number } | undefined;
  const fill = contextFill(ctx?.utilization);
  const used = ctx?.currentTokens ?? ctx?.usedTokens;
  const owner = ownerName(session.owner);
  const facts = sessionFacts(session, all || [], groups || []);
  const outputs = (artifacts || []).slice().sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
  const question = session.pendingQuestion?.question;
  const summary = session.summaryState?.summary || session.shortSummary;

  const env: Array<[string, React.ReactNode]> = [
    ...(session.agentId ? [["Agent", <span className="font-mono">{session.agentId}</span>] as [string, React.ReactNode]] : []),
    ...(session.model ? [["Model", <span>{modelShort(session.model)}{session.reasoningEffort ? <span className="text-muted"> · {String(session.reasoningEffort)} effort</span> : null}</span>] as [string, React.ReactNode]] : []),
    ...(session.workspace?.repo ? [["Repository", <span className="break-all font-mono">{session.workspace.repo}{session.workspace.branch ? ` @ ${session.workspace.branch}` : ""}</span>] as [string, React.ReactNode]] : session.workspace?.folder ? [["Folder", <span className="break-all font-mono">{session.workspace.folder}</span>] as [string, React.ReactNode]] : []),
    ...(facts.project ? [["Project", <span className="inline-flex min-w-0 items-center gap-1.5"><ProjectIcon className="size-3.5 text-muted" /><span className="truncate">{facts.project.name}</span></span>] as [string, React.ReactNode]] : []),
    ...(facts.parent ? [["Started by", <Link to="/s/$sessionId" params={{ sessionId: facts.parent.id }} className="truncate text-accent hover:underline">{facts.parent.title}</Link>] as [string, React.ReactNode]] : []),
    ...(facts.tier ? [["Context tier", <span className="capitalize">{facts.tier}</span>] as [string, React.ReactNode]] : []),
    ...(session.visibility ? [["Access", <VisibilityLabel visibility={session.visibility} />] as [string, React.ReactNode]] : []),
    ...(owner ? [["Owner", <span>{owner}</span>] as [string, React.ReactNode]] : []),
    ...(session.createdAt ? [["Started", <span className="tabular-nums">{ago(session.createdAt)}</span>] as [string, React.ReactNode]] : []),
    ["Session ID", (
      <span className="inline-flex items-center gap-1">
        <span className="font-mono text-xs text-muted" title={session.sessionId}>{shortId(session.sessionId)}</span>
        <Button variant="quiet" size="icon-sm" aria-label="Copy session ID" onClick={() => { void navigator.clipboard?.writeText(session.sessionId); toast.success("Session ID copied"); }}><Copy /></Button>
      </span>
    )] as [string, React.ReactNode],
  ];

  return (
    <div className="h-full overflow-y-auto px-4 py-4" data-context-panel>
      <div className="flex flex-col gap-5">
        {question ? (
          <Block title="Waiting for you">
            <p className="text-sm text-fg">{question}</p>
            <Button size="sm" className="mt-2" onClick={() => onOpen("chat")}>Answer in chat</Button>
          </Block>
        ) : null}

        {summary ? (
          <Block title="Summary"><p className="text-sm text-fg">{summary}</p></Block>
        ) : null}

        <Block title="Environment">
          <dl className="grid grid-cols-[84px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5 text-sm">
            {env.map(([k, v]) => (<React.Fragment key={k}><dt className="text-muted">{k}</dt><dd className="min-w-0">{v}</dd></React.Fragment>))}
          </dl>
        </Block>

        {fill ? (
          <Block title="Context window">
            <div role="meter" aria-label="Context window used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill.meter} aria-valuetext={fill.over ? `Over the limit: ${fill.percent}% of the context window` : `${fill.percent}% used`} className="h-1.5 overflow-hidden rounded-full bg-raised">
              <div className={cn("h-full rounded-full", fill.percent >= 90 ? "bg-failed" : fill.percent >= 70 ? "bg-waiting" : "bg-accent")} style={{ width: `${fill.meter}%` }} />
            </div>
            <p className={cn("mt-1.5 text-sm tabular-nums", fill.over ? "text-failed" : "text-muted")}>
              {fill.over ? `Over the limit: ${fill.percent}% of the window` : `${fill.percent}% used`}{used ? ` · ${tokens(used)}${ctx?.tokenLimit ? ` of ${tokens(ctx.tokenLimit)}` : ""} tokens` : ctx?.tokenLimit ? ` of ${tokens(ctx.tokenLimit)} tokens` : ""}
            </p>
          </Block>
        ) : null}

        {typeof session.iterations === "number" ? (
          <Block title="Usage"><p className="text-sm tabular-nums">{plural(session.iterations, "turn")}{session.updatedAt ? <span className="text-muted"> · last activity {ago(session.updatedAt)}</span> : null}</p></Block>
        ) : null}

        {st.next || st.waitKind === "schedule" || st.waitKind === "timer" ? (
          <Block title="Next">
            <p className="text-sm">{st.word}{st.reason ? <span className="text-muted"> · {st.reason}</span> : null}</p>
            {st.next ? <p className="mt-0.5 text-sm tabular-nums text-muted">{st.next}</p> : null}
            {st.waitKind === "schedule" || st.waitKind === "timer" ? <ScheduleActions session={session} /> : null}
          </Block>
        ) : null}

        {children.length ? (
          <Block title={`Sub-agents · ${children.length}`}>
            <div className="flex flex-wrap gap-1.5">
              {children.slice(0, 4).map((c) => <SessionChip key={c.sessionId} sessionId={c.sessionId} label={c.title || c.agentId || "Sub-agent"} session={c} className="max-w-full" />)}
            </div>
            <Button variant="link" size="sm" className="mt-1.5" onClick={() => onOpen("delegation")}><GitBranch className="size-3.5" aria-hidden /> Open delegation</Button>
          </Block>
        ) : null}

        {outputs.length ? (
          <Block title={`Outputs · ${outputs.length}`}>
            <ul className="flex flex-col">
              {outputs.slice(0, 6).map((a) => (
                <li key={a.filename}>
                  <button
                    type="button"
                    onClick={() => (isCanvasFile(a.filename) ? onOpen("canvas", { slot: canvasSlot(a.filename) }) : onOpen("files", { files: "outputs", file: a.filename }))}
                    className="focus-inset flex min-h-8 w-full items-center gap-2 rounded-control px-1.5 text-left text-sm hover:bg-raised pointer-coarse:min-h-11"
                  >
                    <span className="min-w-0 flex-1 truncate">{a.filename}</span>
                    <span className="shrink-0 text-xs tabular-nums text-faint">{a.size ? bytes(a.size) : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
            {outputs.length > 6 ? <Button variant="link" size="sm" className="mt-1" onClick={() => onOpen("files", { files: "outputs" })}>All {outputs.length} outputs</Button> : null}
          </Block>
        ) : null}
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-1.5 text-xs font-medium text-faint">{title}</h2>
      {children}
    </section>
  );
}
