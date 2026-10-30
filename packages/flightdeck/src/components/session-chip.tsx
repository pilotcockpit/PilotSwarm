import { Link } from "@tanstack/react-router";
import { GitBranch } from "lucide-react";
import { StateGlyph } from "@/components/state";
import { sessionState } from "@/data/state";
import type { Session } from "@/data/types";
import { cn } from "@/lib/utils";

/**
 * A link to another session: state glyph, then what it is doing. Used wherever one
 * session points at another (spawned sub-agents, handoffs). 24px, 44px on touch.
 */
export function SessionChip({ sessionId, label, session, className }: { sessionId: string; label: string; session?: Session; className?: string }) {
  const st = session ? sessionState(session) : null;
  return (
    <Link
      to="/s/$sessionId"
      params={{ sessionId }}
      className={cn("inline-flex h-6 max-w-full items-center gap-1.5 rounded-control border border-line px-2 text-xs transition-colors duration-(--duration-fast) hover:border-line-strong hover:bg-raised pointer-coarse:h-11 pointer-coarse:px-3", className)}
    >
      {st ? <StateGlyph state={st.key} className="size-2" /> : <GitBranch className="size-3 text-muted" aria-hidden />}
      <span className="truncate">{label}</span>
      {st ? <span className="sr-only">, {st.word}</span> : null}
    </Link>
  );
}
