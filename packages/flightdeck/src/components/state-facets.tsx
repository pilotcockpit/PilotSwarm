import { StateGlyph } from "@/components/state";
import { STATE_TONE, STATE_WORD, type StateKey } from "@/data/state";
import { cn } from "@/lib/utils";

export type FacetKey = Exclude<StateKey, "cancelled" | "idle">;
const ORDER: FacetKey[] = ["needs", "failed", "running", "waiting", "completed"];

/**
 * The state filter, always visible: how many sessions are in each state, and one click to
 * see only those. It replaces the hidden "Any state" menu and the Home glance chips. Zero
 * counts stay in place (a stable row beats a jumping one) but go quiet and cannot be chosen.
 * Single choice; choosing the active facet again clears it.
 */
export function StateFacets({ counts, value, onChange, className }: { counts: Partial<Record<StateKey, number>>; value?: StateKey | null; onChange: (next: StateKey | null) => void; className?: string }) {
  return (
    <div role="group" aria-label="Filter by state" className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {ORDER.map((key) => {
        const n = counts[key] || 0;
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            disabled={!n && !active}
            onClick={() => onChange(active ? null : key)}
            className={cn(
              "inline-flex h-6.5 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium transition-colors duration-(--duration-fast) pointer-coarse:h-11 pointer-coarse:px-3.5",
              active ? "border-accent/60 bg-accent-tint text-fg" : n ? "border-line-strong text-fg hover:bg-raised" : "border-line text-faint",
            )}
          >
            <StateGlyph state={key} pulse={false} className={cn("size-2", !n && !active && "text-faint")} />
            <span>{STATE_WORD[key]}</span>
            <span className={cn("tabular-nums", n ? STATE_TONE[key] : "text-faint")}>{n}</span>
          </button>
        );
      })}
    </div>
  );
}
