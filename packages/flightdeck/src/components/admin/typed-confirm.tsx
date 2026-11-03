import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * For the few actions that cannot be undone and remove data: say what goes, then make the person type a
 * short phrase (the name of the thing) before the button works. Cancel stays the default focus.
 */
export function TypedConfirmDialog({ open, onOpenChange, title, description, consequences, phrase, confirmLabel, onConfirm, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  consequences: React.ReactNode[];
  phrase: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<unknown>;
  /** Options to set before confirming (shown first). */
  children?: React.ReactNode;
}) {
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => { if (!open) { setTyped(""); setBusy(false); setError(null); } }, [open]);
  const ready = typed.trim() === phrase;
  const run = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try { await onConfirm(); onOpenChange(false); } catch (e: any) { setError(e?.message || "That didn't work"); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent title={title} description={description}>
        <form onSubmit={(e) => { e.preventDefault(); void run(); }}>
          <DialogBody className="flex flex-col gap-3">
            {children}
            <ul className="list-disc pl-5 text-sm">{consequences.map((c, i) => <li key={i}>{c}</li>)}</ul>
            <Field label={<>Type <span className="font-mono">{phrase}</span> to confirm</>} error={error}>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" autoFocus onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={!ready || busy}>{busy ? <Loader2 className="animate-spin" /> : null} {confirmLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
