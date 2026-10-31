import * as React from "react";
import { Slot } from "radix-ui";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A work object, not a metric tile. Extends Card's surface and focus system.
 * `asChild` makes a single-destination card a real link; decision cards stay
 * articles so their answer buttons never nest inside a link.
 */
export function WorkCard({ asChild, index = 0, interactive = false, className, style, ...props }:
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean; index?: number; interactive?: boolean }) {
  const Comp = asChild ? Slot.Root : "article";
  return <Comp {...props} className={cn(cardVariants(), "fd-work-card overflow-hidden rounded-work", interactive && "fd-work-card-link focus-inset", className)}
    style={{ "--work-order": Math.min(index, 4), ...style } as React.CSSProperties} />;
}

export function WorkCardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 p-5", className)} {...props} />;
}

export function WorkCardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-subtle px-5 py-3 text-xs text-muted", className)} {...props} />;
}

/** Identity comes from the actual agent name; initials are an avatar, not a status. */
export function AgentIdentity({ name }: { name?: string }) {
  const label = name || "Agent";
  const initials = label.split(/[-_\s]+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return <span className="inline-flex min-w-0 items-center gap-2">
    <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-control bg-raised text-xs font-medium text-muted">{initials}</span>
    <span className="truncate">{label}</span>
  </span>;
}
