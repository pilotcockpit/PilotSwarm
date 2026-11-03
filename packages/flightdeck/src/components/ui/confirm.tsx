import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";

/**
 * One confirmation for anything that removes, revokes, widens access or spends. Say what happens
 * and to how much ("3 sessions will wait"), name the action on the button, and keep Cancel as the
 * focused default for danger. `onConfirm` may be async: the dialog stays open and busy until it
 * settles, and stays open with the error if it throws.
 */
export function ConfirmDialog({ open, onOpenChange, title, description, consequences, confirmLabel, tone = "default", onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** Concrete effects, one per line: "Removes 4 versions", "2 sessions will wait for a provider". */
  consequences?: React.ReactNode[];
  confirmLabel: string;
  tone?: "default" | "danger";
  onConfirm: () => void | Promise<unknown>;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => { if (!open) { setBusy(false); setError(null); } }, [open]);
  const run = async () => {
    setBusy(true);
    setError(null);
    try { await onConfirm(); onOpenChange(false); } catch (e: any) { setError(e?.message || "That didn't work"); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent title={title} description={typeof description === "string" ? description : undefined} undoHost={false}>
        <DialogBody className="flex flex-col gap-3">
          {description && typeof description !== "string" ? <div className="text-sm text-muted">{description}</div> : null}
          {consequences?.length ? <ul className="list-disc pl-5 text-sm text-fg">{consequences.map((c, i) => <li key={i}>{c}</li>)}</ul> : null}
          {error ? <p role="alert" className="text-sm text-failed">{error}</p> : null}
        </DialogBody>
        <DialogFooter>
          <Button autoFocus={tone === "danger"} onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={run} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null} {confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
