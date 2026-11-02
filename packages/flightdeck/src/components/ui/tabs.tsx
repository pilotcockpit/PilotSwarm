import * as React from "react";
import { Tabs as T, ToggleGroup } from "radix-ui";
import { rovingKeyDown } from "@/lib/roving";
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

/** Scrolls the selected item of a strip into view, so on a narrow screen the one you are on is never the one cut off. */
function useKeepSelectedInView(ref: React.RefObject<HTMLElement | null>, selected: unknown) {
  React.useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-selected="true"],[data-state="on"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [ref, selected]);
}

/**
 * Segmented control: switches a panel between a few views of the same thing (Files · Changes, Timeline · Logs).
 * On touch screens the items fill the control and are 44 px tall. Labels never wrap and a long one is cut with an ellipsis (its full text is the tooltip). When the options do not
 * fit the control scrolls sideways, with no scrollbar, and keeps the selected one in view.
 */
export function Segmented<T extends string>({ value, onChange, options, className, label }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: React.ReactNode; disabled?: boolean; title?: string }>; className?: string; label: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  useKeepSelectedInView(ref, value);
  return (
    <ToggleGroup.Root
      ref={ref}
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("fd-scroll-x inline-flex h-control min-w-0 max-w-full items-center gap-0.5 overflow-x-auto rounded-control border border-line bg-raised/70 p-0.5 pointer-coarse:h-11.5 pointer-coarse:gap-0 pointer-coarse:p-0", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          title={o.title ?? (typeof o.label === "string" ? o.label : undefined)}
          className="inline-flex h-full shrink-0 items-center gap-1 whitespace-nowrap rounded-chip px-2.5 text-xs font-medium text-muted pointer-coarse:min-w-11 pointer-coarse:justify-center focus-inset hover:text-fg data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-[inset_0_0_0_1px_var(--line-strong)] disabled:opacity-45 transition-colors duration-(--duration-fast)"
        >
          <span className="inline-flex max-w-44 items-center gap-1 truncate">{o.label}</span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** A count, shown after the label. */
  badge?: number;
  /** Something changed in it since you looked. The label says what, for people who cannot see the dot. */
  dot?: { tone: "accent" | "failed" | "needs"; label: string } | null;
  /** Show only the icon (the label is the tooltip and the accessible name). */
  iconOnly?: boolean;
  disabled?: boolean;
}

/**
 * One tab bar for the whole product: the session's views, a session's canvases, the boards. `underline` is for the
 * views of a page (an accent bar under the open one); `pill` is for a list of named things (a raised chip). Tabs
 * never wrap or shrink; a bar that is too wide for its place scrolls sideways with a soft edge and keeps the open
 * tab in view. Arrow keys move between tabs. On a phone `stacked` puts each icon over its label, at equal widths.
 */
export function TabStrip<T extends string>({ label, value, onChange, tabs, variant = "underline", idPrefix, controls, stacked = false, className }: {
  label: string; value: T; onChange: (v: T) => void; tabs: Array<TabItem<T>>; variant?: "underline" | "pill"; idPrefix: string; controls?: string; stacked?: boolean; className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  useKeepSelectedInView(ref, value);
  return (
    <div ref={ref} role="tablist" aria-label={label} onKeyDown={rovingKeyDown("tab")} className={cn("fd-scroll-x flex min-w-0 items-center overflow-x-auto", variant === "pill" ? "gap-1" : "gap-0.5", stacked && "max-sm:gap-0", className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`${idPrefix}-${tab.value}`}
            aria-selected={active}
            aria-controls={controls}
            tabIndex={active ? 0 : -1}
            disabled={tab.disabled}
            title={tab.iconOnly ? tab.label : undefined}
            onClick={() => onChange(tab.value)}
            className={cn(
              "focus-inset relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors duration-(--duration-fast) disabled:opacity-45",
              variant === "underline" ? "h-10 px-2.5 pointer-coarse:h-11" : "h-control rounded-control px-2.5 pointer-coarse:h-11",
              // Phones: icon over a short label, equal widths while they fit.
              stacked && "max-sm:h-12 max-sm:min-w-12 max-sm:flex-1 max-sm:flex-col max-sm:justify-center max-sm:gap-0.5 max-sm:px-0.5 max-sm:text-xs",
              active ? (variant === "pill" ? "bg-raised text-fg shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-fg") : "text-muted hover:text-fg",
            )}
          >
            {Icon ? <Icon className="size-4" /> : null}
            <span className={cn(tab.iconOnly && "sr-only")}>{tab.label}</span>
            {tab.badge ? <span className={cn("text-xs tabular-nums", variant === "pill" ? "text-faint" : "text-muted", stacked && "max-sm:absolute max-sm:right-2 max-sm:top-1")}>{tab.badge}</span> : null}
            {tab.dot && !active ? <span role="img" aria-label={tab.dot.label} className={cn("size-1.5 rounded-full", tab.dot.tone === "failed" ? "bg-failed" : tab.dot.tone === "needs" ? "bg-needs" : "bg-accent", stacked && "max-sm:absolute max-sm:left-[calc(50%+10px)] max-sm:top-2")} /> : null}
            {active && variant === "underline" ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t bg-accent" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Vertical section list for Admin and Settings: one recipe, one active style, 44px on touch. */
export function SideNav({ className, label, ...props }: React.HTMLAttributes<HTMLElement> & { label: string }) {
  return <nav aria-label={label} className={cn("fd-scroll-x flex shrink-0 gap-1 overflow-x-auto border-b border-line px-3 py-2 md:w-[200px] md:flex-col md:overflow-visible md:border-b-0 md:border-r md:py-4", className)} {...props} />;
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
