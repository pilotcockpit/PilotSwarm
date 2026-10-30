import * as React from "react";
import { RadioGroup as R } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * A choice among a few options, each a card with room for a title and a sentence. Built on Radix's
 * RadioGroup so it is a real radio group: one tab stop (the checked option, or the first when none is
 * chosen), arrow keys move and select, Space selects, and it is announced as one group.
 */
export function RadioCards({ value, onValueChange, label, className, children }: { value: string; onValueChange: (v: string) => void; label: string; className?: string; children: React.ReactNode }) {
  return <R.Root value={value} onValueChange={onValueChange} aria-label={label} className={className}>{children}</R.Root>;
}

export function RadioCard({ className, children, ...props }: React.ComponentProps<typeof R.Item>) {
  return (
    <R.Item
      className={cn(
        "relative min-w-0 cursor-pointer rounded-pane border border-line bg-surface text-left text-fg outline-none transition-[border-color,background-color,box-shadow] duration-(--duration-fast) ease-out-fd hover:border-line-strong hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[state=checked]:border-accent data-[state=checked]:bg-accent-tint disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </R.Item>
  );
}
