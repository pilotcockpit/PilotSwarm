import { cn } from "@/lib/utils";

export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <kbd className={cn("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-chip border border-line-strong bg-raised px-1 text-xs font-medium leading-none text-muted", className)}>
      {children}
    </kbd>
  );
}
