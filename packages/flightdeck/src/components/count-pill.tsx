import { cn } from "@/lib/utils";

/**
 * A count that asks for attention: a small pill in the needs colour, the same wherever "who needs you" is counted
 * (the sidebar heading, the Overview). Capped at 99+. Says what it counts, for people who cannot see it.
 */
export function CountPill({ count, label, className }: { count: number; label: string; className?: string }) {
  if (count <= 0) return null;
  return <span role="img" aria-label={label} title={label} className={cn("grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-needs-tint px-1.5 text-xs font-medium tabular-nums text-needs", className)}>{count > 99 ? "99+" : count}</span>;
}
