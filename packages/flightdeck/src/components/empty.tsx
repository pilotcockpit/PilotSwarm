import { cn } from "@/lib/utils";

/** What will appear here, and the one action that makes it appear. */
export function EmptyState({ icon, title, children, action, className }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon ? <div className="mb-3 grid size-10 place-items-center rounded-pane border border-line bg-surface text-muted [&_svg]:size-5">{icon}</div> : null}
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {children ? <p className="mt-1 max-w-[46ch] text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, count, action, className, id }: { children: React.ReactNode; count?: number; action?: React.ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("mb-2 flex items-baseline gap-2", className)}>
      <h2 id={id} className="text-[15px] font-semibold text-fg">{children}</h2>
      {count != null ? <span className="font-mono text-sm tabular-nums text-faint">{count}</span> : null}
      {action ? <div className="ml-auto text-sm">{action}</div> : null}
    </div>
  );
}

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-hidden rounded-pane border border-line bg-surface", className)} {...props} />;
}
