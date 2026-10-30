import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useModels, useRefresh, useSource } from "@/data/source";
import { modelShort } from "@/data/state";
import type { Model, Session } from "@/data/types";
import { cardVariants } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Tag } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/misc";
import { rovingKeyDown } from "@/lib/roving";
import { cn } from "@/lib/utils";

/**
 * Change the model a session uses from its next turn. Models the workers can run come
 * first; the rest are listed with the reason they cannot be chosen. Calls the real
 * setSessionModel operation, then refreshes the session so the header and the failure
 * card reflect it.
 */
export function ChangeModelDialog({ open, onOpenChange, session }: { open: boolean; onOpenChange: (v: boolean) => void; session: Session }) {
  const { data: models, isLoading } = useModels();
  const { source } = useSource();
  const refresh = useRefresh();
  const [choice, setChoice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { if (open) setChoice(null); }, [open]);

  const ordered = React.useMemo(() => {
    const usable = (m: Model) => m.credentialAvailable !== false;
    return [...(models || [])].sort((a, b) => Number(usable(b)) - Number(usable(a)));
  }, [models]);
  const selected = choice ?? session.model ?? null;
  const changed = Boolean(choice && choice !== session.model);
  const firstUsable = ordered.find((m) => m.credentialAvailable !== false);
  const selectedUsable = ordered.some((m) => m.credentialAvailable !== false && m.qualifiedName === selected);

  const apply = async () => {
    if (!choice) return;
    setBusy(true);
    try {
      await source.setSessionModel(session.sessionId, choice);
      refresh(session.sessionId);
      toast.success(`Switched to ${modelShort(choice)}`, { description: "The next turn uses it." });
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Couldn't switch the model", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Change model" description="The next turn uses the model you pick. Models the workers can't run are shown but can't be chosen.">
        <DialogBody>
          {isLoading ? (
            <div className="flex flex-col gap-1.5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div role="radiogroup" aria-label="Model" onKeyDown={rovingKeyDown("radio")} className="flex flex-col gap-1.5">
              {ordered.map((m) => {
                const usable = m.credentialAvailable !== false;
                // The group needs one tab stop: the chosen option, or the first usable one when none is chosen and usable.
                const stop = (m.qualifiedName === selected && usable) || (!selectedUsable && m === firstUsable);
                const isCurrent = m.qualifiedName === session.model;
                const on = m.qualifiedName === selected;
                return (
                  <button
                    key={m.qualifiedName}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    tabIndex={stop ? 0 : -1}
                    disabled={!usable}
                    onClick={() => setChoice(m.qualifiedName)}
                    className={cn(cardVariants({ interactive: usable, selected: on }), "flex items-center gap-3 px-3 py-2 text-left", !usable && "opacity-60")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{m.modelName}</span>
                        <span className="shrink-0 text-xs text-muted">{m.providerId}</span>
                        {isCurrent ? <Tag>Current</Tag> : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">{usable ? m.description : m.unavailableReason || "No credential on the workers"}</span>
                    </span>
                    {on ? <Check className="size-4 shrink-0 text-accent" aria-hidden /> : null}
                  </button>
                );
              })}
              {!ordered.length ? <p className="text-sm text-muted">No models are available to this deployment.</p> : null}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!changed || busy} onClick={apply}>{busy ? <Loader2 className="animate-spin" /> : null} Switch model</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
