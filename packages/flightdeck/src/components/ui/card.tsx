import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The one surface recipe. Every card, panel, notice and tile in Flight Deck is this,
 * so radius, border, tone and hover response change in one place.
 *
 * - tone: neutral is the default; failed / waiting / accent are notices and carry
 *   state meaning (see DESIGN.md: colour means agent state).
 * - interactive: the whole surface is a target. It answers hover with a stronger
 *   border and a small lift, press with a settle, and keeps the global focus ring.
 * - selected: a chosen option inside a group (radio cards).
 * - enter: arrive with a short rise and fade, once, when it mounts.
 */
export const cardVariants = cva("relative min-w-0 rounded-pane border bg-surface text-fg", {
  variants: {
    tone: {
      neutral: "border-line",
      failed: "border-failed/35 bg-failed-tint",
      waiting: "border-waiting/40 bg-waiting-tint",
      accent: "border-accent/45 bg-accent-tint",
    },
    interactive: {
      true: "cursor-pointer transition-[border-color,background-color,box-shadow,transform] duration-(--duration-fast) ease-out-fd hover:border-line-strong hover:shadow-lift active:translate-y-px active:shadow-none",
      false: "",
    },
    selected: {
      true: "border-accent bg-accent-tint hover:border-accent",
      false: "",
    },
    clip: { true: "overflow-hidden", false: "" },
    enter: { true: "animate-enter", false: "" },
  },
  defaultVariants: { tone: "neutral", interactive: false, selected: false, clip: false, enter: false },
});

export type CardProps = React.HTMLAttributes<HTMLElement> & VariantProps<typeof cardVariants> & { as?: "div" | "section" | "article" | "li" };

/** `index` staggers a list of cards that arrive together: 30ms apart, capped at eight. */
export const Card = React.forwardRef<HTMLElement, CardProps & { index?: number }>(function Card(
  { as = "div", className, tone, interactive, selected, clip, enter, index, style, ...props },
  ref,
) {
  const Comp = as as React.ElementType;
  const delay = enter && index != null ? { animationDelay: `${Math.min(index, 8) * 30}ms` } : undefined;
  return <Comp ref={ref} className={cn(cardVariants({ tone, interactive, selected, clip, enter }), className)} style={{ ...delay, ...style }} {...props} />;
});

/** A divided strip of figures: the quiet alternative to hero-metric tiles. */
export function Stat({ label, value, hint, className }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 px-4 py-3", className)}>
      <dt className="truncate text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
        {hint ? <span className="text-xs text-faint">{hint}</span> : null}
      </dd>
    </div>
  );
}
