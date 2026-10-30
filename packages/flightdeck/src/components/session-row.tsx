import { Link } from "@tanstack/react-router";
import { FolderGit2, GitBranch, LayoutPanelLeft, Pin } from "lucide-react";
import type { Session } from "@/data/types";
import { modelShort, sessionState, STATE_TONE } from "@/data/state";
import { DurableSpine, StateGlyph } from "@/components/state";
import { ago, cn } from "@/lib/utils";

/**
 * Session row: state icon + label, title, agent, last activity, and chips for
 * the waiting reason, unseen canvas updates and sub-agent count. Wide screens
 * add agent and model/repo columns; phones keep the title on its own line so
 * the identity column is never the one that truncates.
 */
export function SessionRow({ session, childCount = 0, depth = 0, active = false, leading, columns = false }: { session: Session; childCount?: number; depth?: number; active?: boolean; leading?: React.ReactNode; columns?: boolean }) {
  const st = sessionState(session);
  const chips = (
    <>
      {session.pinned ? <Pin className="size-3 shrink-0 text-faint" aria-label="Pinned" /> : null}
      {session.unseenCanvas ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-chip bg-accent-tint px-1.5 text-[11px] font-medium text-accent">
          <LayoutPanelLeft className="size-3" aria-hidden /> canvas updated
        </span>
      ) : null}
      {childCount > 0 ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-chip bg-raised px-1.5 text-[11px] text-muted" title={`${childCount} sub-agents`}>
          <GitBranch className="size-3" aria-hidden /> {childCount}<span className="sr-only"> sub-agents</span>
        </span>
      ) : null}
    </>
  );
  return (
    <Link
      to="/s/$sessionId"
      params={{ sessionId: session.sessionId }}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-inset group flex min-h-row items-center gap-3 border-t border-line-subtle px-3 py-2 first:border-t-0 hover:bg-raised/70",
        active && "bg-raised",
        st.key === "failed" && !active && "bg-failed-tint/40",
      )}
      style={depth ? { paddingLeft: 12 + depth * 20 } : undefined}
    >
      {leading}
      {depth ? <span className="-ml-2 h-px w-2 shrink-0 bg-line-strong" aria-hidden /> : null}
      <StateGlyph state={st.key} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-fg max-sm:whitespace-normal max-sm:line-clamp-2">{session.title || "Untitled session"}</span>
          <span className="hidden items-center gap-2 sm:inline-flex">{chips}</span>
        </span>
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
          <span className={cn("shrink-0 font-medium", STATE_TONE[st.key])}>{st.word}</span>
          {st.reason ? <span className="min-w-0 truncate">· {st.reason}</span> : null}
          {st.next ? <span className="hidden shrink-0 text-faint sm:inline">· {st.next}</span> : null}
          {columns ? null : <><span className="shrink-0 text-faint">·</span><span className="shrink-0 truncate font-mono text-faint">{session.agentId || "generic"}</span></>}
          <span className="inline-flex items-center gap-1.5 sm:hidden">{chips}</span>
        </span>
      </span>
      {columns ? (
        <>
          <span className="hidden w-[150px] shrink-0 truncate font-mono text-xs text-muted lg:block">{session.agentId || "generic"}</span>
          <span className="hidden w-[190px] shrink-0 truncate text-xs text-muted xl:flex xl:items-center xl:gap-1">
            {session.workspace?.repo ? <><FolderGit2 className="size-3.5 shrink-0" aria-hidden /><span className="truncate font-mono">{session.workspace.repo}{session.workspace.branch ? ` @ ${session.workspace.branch}` : ""}</span></> : <span className="truncate font-mono">{modelShort(session.model)}</span>}
          </span>
        </>
      ) : null}
      <DurableSpine marks={session.spine} className="hidden md:inline-flex" />
      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-faint">{ago(session.updatedAt)}</span>
    </Link>
  );
}

/** Column headings that line up with SessionRow's wide-screen columns. */
export function SessionColumnsHeader() {
  return (
    <div className="hidden items-center gap-3 border-b border-line px-3 py-1.5 text-xs text-faint lg:flex" aria-hidden>
      <span className="w-[10px]" />
      <span className="flex-1">Session</span>
      <span className="w-[150px]">Agent</span>
      <span className="hidden w-[190px] xl:block">Working folder or model</span>
      <span className="w-12">Activity</span>
      <span className="w-14 text-right">Updated</span>
    </div>
  );
}
