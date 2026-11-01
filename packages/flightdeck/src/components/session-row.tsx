import { Link } from "@tanstack/react-router";
import { GitBranch, Pin } from "lucide-react";
import type { Session } from "@/data/types";
import { modelShort, sessionState, STATE_TONE } from "@/data/state";
import { DurableSpine, StateGlyph } from "@/components/state";
import { Tag } from "@/components/ui/misc";
import { ago, cn } from "@/lib/utils";

/**
 * Session row: state icon + label, title, what it is doing (the waiting reason, else the
 * agent's own one-line summary), last activity, a dot for an unseen canvas update and a
 * tag for the sub-agent count. Wide screens add agent and model columns and the working
 * folder; phones keep the title on its own line so the identity column is never the one
 * that truncates.
 */
export function SessionRow({ session, pinned = Boolean(session.pinned), childCount = 0, depth = 0, active = false, leading, columns = false }: { session: Session; pinned?: boolean; childCount?: number; depth?: number; active?: boolean; leading?: React.ReactNode; columns?: boolean }) {
  const st = sessionState(session);
  const chips = (
    <>
      {pinned ? <Pin className="size-3 shrink-0 text-faint" aria-label="Pinned" /> : null}
      {session.unseenCanvas ? <span className="size-1.5 shrink-0 rounded-full bg-accent" role="img" aria-label="Canvas updated" title="Canvas updated since you looked" /> : null}
      {childCount > 0 ? (
        <Tag title={`${childCount} sub-agents`}>
          <GitBranch aria-hidden /> {childCount}<span className="sr-only"> sub-agents</span>
        </Tag>
      ) : null}
    </>
  );
  return (
    <div className={cn("group flex items-stretch border-t border-line-subtle first:border-t-0", active && "bg-raised", st.key === "failed" && !active && "bg-failed-tint/40")}>
      {leading ? <div className="flex shrink-0 items-center pl-3">{leading}</div> : null}
      <Link
        to="/s/$sessionId"
        params={{ sessionId: session.sessionId }}
        aria-current={active ? "page" : undefined}
        data-session-row
        className={cn(
          "focus-inset flex min-h-row min-w-0 flex-1 items-center gap-3 px-3 py-2 hover:bg-raised/70",
        )}
        style={depth ? { paddingLeft: 12 + depth * 20 } : undefined}
      >
        {depth ? <span className="-ml-2 h-px w-2 shrink-0 bg-line-strong" aria-hidden /> : null}
        <StateGlyph state={st.key} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-sm font-medium text-fg max-sm:whitespace-normal max-sm:line-clamp-2">{session.title || "Untitled session"}</span>
            <span className="hidden items-center gap-2 sm:inline-flex">{chips}</span>
          </span>
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
            <span className={cn("shrink-0 font-medium", STATE_TONE[st.key])}>{st.word}</span>
            {st.reason || session.shortSummary ? <span className="min-w-0 truncate">· {st.reason || session.shortSummary}</span> : null}
            {st.next ? <span className="hidden shrink-0 text-faint sm:inline">· {st.next}</span> : null}
            {columns ? (session.workspace?.repo ? <span className="hidden min-w-0 shrink-0 truncate text-faint xl:inline">· {session.workspace.repo}{session.workspace.branch ? ` @ ${session.workspace.branch}` : ""}</span> : null) : <><span className="shrink-0 text-faint">·</span><span className="shrink-0 truncate text-faint">{session.agentId || "generic"}</span></>}
            <span className="inline-flex items-center gap-1.5 sm:hidden">{chips}</span>
          </span>
        </span>
        {columns ? (
          <>
            <span className="hidden w-37.5 shrink-0 truncate text-xs text-muted lg:block">{session.agentId || "generic"}</span>
            <span className="hidden w-40 shrink-0 truncate font-mono text-xs text-muted xl:block">{modelShort(session.model)}</span>
          </>
        ) : null}
        <DurableSpine marks={session.spine} className="hidden md:inline-flex" />
        <span className="w-14 shrink-0 text-right text-xs tabular-nums text-faint">{ago(session.updatedAt)}</span>
      </Link>
    </div>
  );
}

/** Column headings that line up with SessionRow's wide-screen columns. */
export function SessionColumnsHeader() {
  return (
    <div className="hidden items-center gap-3 border-b border-line bg-bg px-3.25 py-1.5 text-xs text-faint lg:flex" aria-hidden>
      <span className="w-2.5" />
      <span className="flex-1">Session</span>
      <span className="w-37.5">Agent</span>
      <span className="hidden w-40 xl:block">Model</span>
      <span className="w-12">Activity</span>
      <span className="w-14 text-right">Updated</span>
    </div>
  );
}
