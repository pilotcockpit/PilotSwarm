import * as React from "react";
import { Switch as S, Checkbox as C, Popover as P } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn("relative inline-flex h-[20px] w-[36px] shrink-0 items-center rounded-full border border-line-strong bg-raised transition-colors after:absolute after:-inset-1 after:content-[''] pointer-coarse:after:-inset-3 data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-45", className)}
      {...props}
    >
      <S.Thumb className="block size-3.5 translate-x-[2px] rounded-full bg-muted transition-transform duration-(--duration-fast) data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-fg" />
    </S.Root>
  );
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof C.Root>) {
  return (
    <C.Root
      className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-chip border border-line-strong bg-surface data-[state=checked]:border-accent data-[state=checked]:bg-accent", className)}
      {...props}
    >
      <C.Indicator>
        <Check className="size-3 text-accent-fg" strokeWidth={3} />
      </C.Indicator>
    </C.Root>
  );
}

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export function PopoverContent({ className, align = "start", sideOffset = 6, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={sideOffset} className={cn("z-(--z-overlay) w-72 rounded-pane border border-line bg-overlay p-3 text-sm shadow-pop outline-none data-[state=open]:animate-pop", className)} {...props} />
    </P.Portal>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("motion-safe:animate-pulse rounded-control bg-raised", className)} />;
}

export function Chip({ className, active, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium transition-colors pointer-coarse:h-11 pointer-coarse:px-3.5",
        active ? "border-accent/60 bg-accent-tint text-fg" : "border-line-strong text-muted hover:bg-raised hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "accent" | "live" | "waiting" | "failed" | "ok" }) {
  const tones = {
    neutral: "bg-raised text-muted",
    accent: "bg-accent text-accent-fg",
    live: "bg-live-tint text-live",
    waiting: "bg-waiting-tint text-waiting",
    failed: "bg-failed-tint text-failed",
    ok: "bg-ok-tint text-ok",
  } as const;
  return <span className={cn("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums", tones[tone], className)} {...props} />;
}

/**
 * Metadata label: a quiet, square-cornered tag for facts that are not state
 * (a count of sub-agents, a tool name, a setting). State is StatePill; counts in
 * navigation are Badge. Never clickable: if it acts, it is a Chip or a Button.
 */
export function Tag({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "accent" | "needs" | "live" | "waiting" | "failed" | "ok" }) {
  const tones = {
    neutral: "bg-raised text-muted",
    accent: "bg-accent-tint text-accent",
    needs: "bg-needs-tint text-needs",
    live: "bg-live-tint text-live",
    waiting: "bg-waiting-tint text-waiting",
    failed: "bg-failed-tint text-failed",
    ok: "bg-ok-tint text-ok",
  } as const;
  return <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-chip px-1.5 text-xs font-medium [&_svg]:size-3", tones[tone], className)} {...props} />;
}
