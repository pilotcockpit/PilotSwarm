import * as React from "react";
import { Tabs as T, ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("flex items-center gap-1 border-b border-line", className)} {...props} />;
}

/** Underlined tab in accent: companion-pane views and area sections. */
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "relative -mb-px inline-flex h-10 items-center gap-1.5 pointer-coarse:h-11 border-b-2 border-transparent px-2.5 text-sm font-medium text-muted focus-inset transition-colors hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

/** Segmented control: view switches inside a pane (Outputs · Folders, Timeline · Logs…). */
export function Segmented<T extends string>({ value, onChange, options, className, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: React.ReactNode; disabled?: boolean; title?: string }>; className?: string; label: string }) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("inline-flex h-[30px] items-center rounded-control border border-line-strong bg-bg p-0.5 pointer-coarse:h-[50px]", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          title={o.title}
          className="inline-flex h-full items-center gap-1 rounded-chip px-2.5 text-xs font-medium text-muted pointer-coarse:min-w-11 pointer-coarse:justify-center focus-inset hover:text-fg data-[state=on]:bg-raised data-[state=on]:text-fg data-[state=on]:shadow-[inset_0_0_0_1px_var(--line-strong)] disabled:opacity-45"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

/** Vertical section list for Admin and Settings: one recipe, one active style, 44px on touch. */
export function SideNav({ className, label, ...props }: React.HTMLAttributes<HTMLElement> & { label: string }) {
  return <nav aria-label={label} className={cn("flex shrink-0 gap-1 overflow-x-auto border-b border-line px-3 py-2 md:w-[200px] md:flex-col md:overflow-visible md:border-b-0 md:border-r md:py-4", className)} {...props} />;
}

export function SideNavItem({ active, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={cn("focus-inset inline-flex h-8 shrink-0 items-center gap-2 rounded-control px-2.5 text-left text-sm font-medium transition-colors duration-(--duration-fast) pointer-coarse:h-11", active ? "bg-raised text-fg" : "text-muted hover:bg-raised/60 hover:text-fg", className)}
      {...props}
    />
  );
}
