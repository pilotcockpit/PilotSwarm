import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useSessions } from "@/data/source";
import { sessionState, type StateKey } from "@/data/state";
import type { Session } from "@/data/types";
import { DurableSpine, StateGlyph } from "@/components/state";
import { StateFacets } from "@/components/state-facets";
import { EmptyState } from "@/components/empty";
import { Chip } from "@/components/ui/misc";
import { cardVariants } from "@/components/ui/card";
import { ago, cn, plural } from "@/lib/utils";

/**
 * The fleet wall: every session as one dense cell, so a supervisor of dozens of agents can
 * read the whole fleet at a glance. Order is urgency (needs you, failed, running, waiting,
 * then the rest by recency); the state filter is the same one Sessions uses. Cells are links;
 * the arrow keys move between them and only one is a tab stop, so 60 cells are one Tab press.
 */
const RANK: Record<StateKey, number> = { needs: 0, failed: 1, running: 2, waiting: 3, idle: 4, completed: 5, cancelled: 6 };

export function FleetWall() {
  const { data: sessions, isLoading } = useSessions();
  const [facet, setFacet] = React.useState<StateKey | null>(null);
  const [system, setSystem] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);

  const scope = React.useMemo(() => (sessions || []).filter((s) => system || !s.isSystem), [sessions, system]);
  const states = React.useMemo(() => new Map(scope.map((s) => [s.sessionId, sessionState(s)])), [scope]);
  const counts = React.useMemo(() => {
    const c: Partial<Record<StateKey, number>> = {};
    for (const s of scope) { const k = states.get(s.sessionId)!.key; c[k] = (c[k] || 0) + 1; }
    return c;
  }, [scope, states]);
  const cells = React.useMemo(
    () => scope
      .filter((s) => !facet || states.get(s.sessionId)!.key === facet)
      .sort((a, b) => RANK[states.get(a.sessionId)!.key] - RANK[states.get(b.sessionId)!.key] || (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0)),
    [scope, states, facet],
  );
  React.useEffect(() => setActive((i) => Math.min(i, Math.max(0, cells.length - 1))), [cells.length]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const links = [...e.currentTarget.querySelectorAll<HTMLElement>("a[data-cell]")];
    const at = links.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    // Columns are however many cells share the first row's top edge.
    const cols = Math.max(1, links.filter((l) => l.offsetTop === links[0].offsetTop).length);
    const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" ? -cols : e.key === "ArrowDown" ? cols : 0;
    const next = e.key === "Home" ? 0 : e.key === "End" ? links.length - 1 : Math.min(links.length - 1, Math.max(0, at + step));
    links[next].focus();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* One scrolling row on phones so the wall starts near the top; wraps on wider screens. */}
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-line px-4 py-2 md:flex-wrap md:overflow-visible md:px-5">
        <StateFacets counts={counts} value={facet} onChange={setFacet} className="shrink-0 flex-nowrap md:flex-wrap" />
        <Chip active={system} onClick={() => setSystem((v) => !v)} className="shrink-0 md:ml-auto">System sessions</Chip>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
        {isLoading ? null : !cells.length ? (
          <EmptyState title={facet ? "No sessions in this state" : "No sessions yet"}>{facet ? "Clear the filter to see the rest of the fleet." : "Start a session and it appears here."}</EmptyState>
        ) : (
          <ul ref={listRef} onKeyDown={onKeyDown} aria-label={`Fleet, ${plural(cells.length, "session")}`} className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-2">
            {cells.map((s, i) => <FleetCell key={s.sessionId} session={s} state={states.get(s.sessionId)!} index={i} tabbable={i === active} onFocus={() => setActive(i)} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function FleetCell({ session: s, state: st, index, tabbable, onFocus }: { session: Session; state: ReturnType<typeof sessionState>; index: number; tabbable: boolean; onFocus: () => void }) {
  const what = s.shortSummary || st.reason || s.step || "";
  return (
    <li>
      <Link
        data-cell
        to="/s/$sessionId"
        params={{ sessionId: s.sessionId }}
        tabIndex={tabbable ? 0 : -1}
        onFocus={onFocus}
        style={{ animationDelay: `${Math.min(index, 12) * 15}ms` }}
        className={cn(
          cardVariants({ interactive: true, enter: true, tone: st.key === "failed" ? "failed" : "neutral" }),
          "focus-inset flex h-full flex-col gap-1 px-3 py-2.5",
          st.key === "needs" && "border-needs/45 bg-needs-tint hover:border-needs",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <StateGlyph state={st.key} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.title || "Untitled session"}</span>
          <span className="sr-only">{st.word}</span>
        </span>
        <span className="line-clamp-2 min-h-8 text-xs text-muted">{what || (st.word === "Running" ? "Working" : st.word)}</span>
        <span className="mt-auto flex items-center gap-2 text-xs text-faint">
          <DurableSpine marks={s.spine} />
          <span className="min-w-0 flex-1 truncate font-mono">{s.agentId}</span>
          <span className="shrink-0 tabular-nums">{ago(s.updatedAt as any)}</span>
        </span>
      </Link>
    </li>
  );
}
