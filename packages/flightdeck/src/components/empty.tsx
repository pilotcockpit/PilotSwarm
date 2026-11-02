import { cn } from "@/lib/utils";
import { Card, type CardProps } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A failed read is never an empty result or a clean bill of health. */
export function DataReadNotice({ title, children, onRetry, busy = false, partial = false }: { title: string; children: React.ReactNode; onRetry: () => void; busy?: boolean; partial?: boolean }) {
  return (
    <Card tone={partial ? "waiting" : "failed"} role="alert" className="flex flex-wrap items-start gap-3 px-4 py-3">
      <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", partial ? "text-waiting" : "text-failed")} aria-hidden />
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted">{children}</p>
      </div>
      <Button size="sm" disabled={busy} onClick={onRetry}><RefreshCw className={cn(busy && "animate-spin")} />{busy ? "Retrying…" : "Try again"}</Button>
    </Card>
  );
}

/** What will appear here, and the one action that makes it appear. */
export function EmptyState({ icon, illustration, title, level = 3, children, action, className }: { /** The heading level: 2 when the page has no section heading above it, so the outline never skips one. */ level?: 2 | 3; icon?: React.ReactNode; illustration?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {illustration ? <div className="mb-4">{illustration}</div> : icon ? <div className="mb-3 grid size-10 place-items-center rounded-pane border border-line bg-surface text-muted [&_svg]:size-5">{icon}</div> : null}
      {level === 2 ? <h2 className="text-base font-semibold text-fg">{title}</h2> : <h3 className="text-base font-semibold text-fg">{title}</h3>}
      {children ? <p className="mt-1 max-w-[46ch] text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, count, badge, action, className, id }: { children: React.ReactNode; count?: number; /** A count that asks for attention, drawn as a pill right after the title. */ badge?: React.ReactNode; action?: React.ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("mb-2 flex items-baseline gap-2", className)}>
      <h2 id={id} className="text-prose font-semibold text-fg">{children}</h2>
      {badge}
      {count != null ? <span className="text-sm tabular-nums text-faint">{count}</span> : null}
      {action ? <div className="ml-auto text-sm [&_a]:inline-flex [&_a]:min-h-6 [&_a]:items-center pointer-coarse:[&_a]:min-h-11">{action}</div> : null}
    </div>
  );
}

/** A static container for lists, tables and settings: a Card that clips its rows. */
export function Panel({ className, ...props }: Omit<CardProps, "as" | "interactive" | "clip">) {
  return <Card clip className={className} {...props} />;
}
