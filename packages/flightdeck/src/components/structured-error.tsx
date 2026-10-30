import * as React from "react";
import { cardVariants } from "@/components/ui/card";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, RotateCw, Settings2, Shuffle, TriangleAlert } from "lucide-react";
import { describeError } from "@/data/state";
import { useProfile } from "@/data/source";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Structured error: a plain sentence, the fix as a button, the raw detail
 * behind "Show details". Never a paragraph of environment variables.
 */
export function StructuredErrorCard({ raw, onRetry, onSwitchModel, compact = false, className }: { raw: unknown; onRetry?: () => void; onSwitchModel?: () => void; compact?: boolean; className?: string }) {
  const err = describeError(raw);
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const isAdmin = Boolean(profile?.isAdmin);
  const [open, setOpen] = React.useState(false);
  const detailsId = React.useId();
  return (
    <div role="alert" className={cn(cardVariants({ tone: "failed", enter: true }), compact ? "p-3" : "p-4", className)}>
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-failed" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">{err.headline}.</p>
          {err.detail ? <p className="mt-0.5 text-sm text-fg/85">{err.detail}</p> : null}
          {err.fixes.includes("open-provider") && !isAdmin ? (
            <p className="mt-0.5 text-sm text-fg/85">A worker admin has to fix this. Until then you can switch this session to a model that works.</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {err.fixes.includes("open-provider") && isAdmin ? (
              <Button size="sm" variant="primary" onClick={() => navigate({ to: "/providers", search: { provider: err.provider } })}>
                <Settings2 /> Open provider
              </Button>
            ) : null}
            {err.fixes.includes("switch-model") && onSwitchModel ? (
              <Button size="sm" onClick={onSwitchModel}>
                <Shuffle /> Switch model
              </Button>
            ) : null}
            {err.fixes.includes("retry") && onRetry ? (
              <Button size="sm" onClick={onRetry}>
                <RotateCw /> Ask to retry
              </Button>
            ) : null}
            {err.raw ? (
              <Button size="sm" variant="quiet" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((v) => !v)}>
                <ChevronDown className={cn("transition-transform", open && "rotate-180")} /> {open ? "Hide details" : "Show details"}
              </Button>
            ) : null}
          </div>
          {open ? (
            <pre id={detailsId} className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-control border border-line bg-surface p-2.5 text-xs text-muted">{err.raw}</pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}
