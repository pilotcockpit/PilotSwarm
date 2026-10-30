import * as React from "react";
import { Check, Copy, Link2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton, Tag } from "@/components/ui/misc";
import { useKvAccess, useMintShareLink, useRemoveShareLink, useSetKvAccess, useShareLink, type KvAccess } from "@/data/ops/canvas-share";
import { ago, cn } from "@/lib/utils";

/**
 * Where a public link lands. The Flight Deck preview runs on its own dev port and the page that
 * opens a public link is served by the portal server; a deployment serving both from one origin
 * needs no setting. Override with VITE_PUBLIC_SHARE_ORIGIN.
 */
function publicShareOrigin() {
  const set = import.meta.env.VITE_PUBLIC_SHARE_ORIGIN || import.meta.env.VITE_CLASSIC_URL;
  if (set) return String(set).replace(/\/+$/, "");
  return window.location.port === "5180" ? "http://localhost:3001" : window.location.origin;
}

const ACCESS: Array<{ value: KvAccess; label: string; detail: string }> = [
  { value: "owner", label: "Only people who can edit the session", detail: "You, admins and anyone you shared the session with as “can edit”. People with view-only access can watch the canvas but not change anything in it." },
  { value: "readers", label: "Anyone who can open the session", detail: "Adds your view-only people: they can edit inside the canvas. It doesn't let them message the agent." },
  { value: "link", label: "Anyone who can open the session, plus link viewers", detail: "Your view-only people can edit inside the canvas. Anyone holding the public link can watch it, but a link holder can never edit." },
];

function CopyField({ label, value, className }: { label: string; value: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't reach the clipboard", { description: "Select the link and copy it by hand." });
    }
  };
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Input readOnly aria-label={label} value={value} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
      <Button onClick={copy} className="shrink-0">{copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}</Button>
    </div>
  );
}

/**
 * Share one canvas. Two audiences, said plainly: people who can already open the session get an
 * ordinary link; anyone else gets a public view-only link that can be created, rotated or removed.
 * A public link is shown once, when it is made, because the server keeps only its hash.
 */
export function ShareCanvasDialog({ sessionId, slot, name, open, onOpenChange }: { sessionId: string; slot: number; name?: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const kv = useKvAccess(sessionId, slot, open);
  // The server's own answer decides: only the owner or an admin may make, rotate or remove a public link.
  const relation = kv.data?.me?.relation;
  const canManage = relation === "owner" || relation === "admin";
  const link = useShareLink(sessionId, slot, open && canManage);
  const mint = useMintShareLink(sessionId, slot);
  const remove = useRemoveShareLink(sessionId, slot);
  const setAccess = useSetKvAccess(sessionId, slot);
  const [fresh, setFresh] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<"rotate" | "remove" | null>(null);
  // A new link is shown once, to the dialog that asked for it. Closing it (or moving to another canvas)
  // ends that lifetime: a response that lands afterwards is dropped, never shown on a later open.
  const generation = React.useRef(0);
  React.useEffect(() => {
    generation.current += 1;
    setFresh(null);
    setConfirm(null);
    mint.reset();
  }, [open, sessionId, slot]);

  const sessionUrl = `${window.location.origin}/s/${encodeURIComponent(sessionId)}?view=canvas&slot=${slot}`;
  const make = async () => {
    const mine = generation.current;
    // The token reaches this component through the callback only: it is not in the mutation's data or cache.
    await mint.mutateAsync({ onToken: (token) => { if (generation.current === mine) setFresh(`${publicShareOrigin()}/?canvasShare=${encodeURIComponent(token)}`); } });
    mint.reset();
  };
  const policy = kv.data?.policy ?? "owner";
  const canSetAccess = canManage;
  const exists = link.data?.exists || Boolean(fresh);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title="Share this canvas" description={name ? `“${name}”` : undefined} side="right">
          <DialogBody className="flex flex-col gap-6">
            <section aria-labelledby="share-people" className="flex flex-col gap-2">
              <h3 id="share-people" className="text-sm font-semibold">People who can open this session</h3>
              <p className="text-sm text-muted">They sign in and see the canvas full size. Change who can open the session from its Share menu.</p>
              <CopyField label="Link for people with access" value={sessionUrl} />
            </section>

            <section aria-labelledby="share-public" className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h3 id="share-public" className="text-sm font-semibold">Anyone with the link</h3>
                {!canManage ? null : exists ? <Tag tone="live">Link active</Tag> : <Tag>Off</Tag>}
              </div>
              <p className="text-sm text-muted">View only, live, no sign-in. There is one link at a time.</p>
              {!canManage ? <p className="text-sm text-muted">{kv.isLoading ? "Checking what you can do…" : "Only the session's owner or an admin can create, rotate or remove the public link."}</p> : link.isLoading ? <Skeleton className="h-9" /> : fresh ? (
                <div className="flex flex-col gap-2">
                  <CopyField label="Public link" value={fresh} />
                  <p className={cn(cardVariants({ tone: "waiting" }), "flex items-start gap-2 px-3 py-2 text-sm")}>
                    <ShieldAlert className="mt-0.5 size-4 shrink-0 text-waiting" aria-hidden />
                    Copy it now. For safety the link is shown only once; if you lose it, create a new one.
                  </p>
                </div>
              ) : link.data?.exists ? (
                <p className="text-sm">
                  A link has been active since <time dateTime={link.data.createdAt}>{link.data.createdAt ? ago(link.data.createdAt) : "earlier"}</time>
                  {link.data.createdBy ? <> (made by {link.data.createdBy})</> : null}. It can't be shown again; rotate it to get a new one.
                </p>
              ) : null}
              {link.error ? <p role="alert" className="text-sm text-failed">Couldn't check the link. {(link.error as Error).message}</p> : null}
              {canManage ? <div className="flex flex-wrap gap-2">
                {exists ? (
                  <>
                    <Button onClick={() => setConfirm("rotate")} disabled={mint.isPending}><Link2 /> Rotate link</Button>
                    <Button variant="danger" onClick={() => setConfirm("remove")} disabled={remove.isPending}>Remove link</Button>
                  </>
                ) : (
                  <Button variant="primary" onClick={make} disabled={mint.isPending || link.isLoading}>{mint.isPending ? <Loader2 className="animate-spin" /> : <Link2 />} Create public link</Button>
                )}
              </div> : null}
            </section>

            {kv.data ? (
              <fieldset className="flex flex-col gap-2" disabled={!canSetAccess || setAccess.isPending}>
                <legend className="mb-1 text-sm font-semibold">Who can edit inside this canvas</legend>
                {ACCESS.map((o) => (
                  <label key={o.value} className={cn("flex cursor-pointer items-start gap-2.5 rounded-pane border p-2.5 text-sm transition-colors duration-(--duration-fast)", policy === o.value ? "border-accent bg-accent-tint" : "border-line hover:border-line-strong", !canSetAccess && "cursor-default opacity-80")}>
                    <input type="radio" name="kv-access" className="mt-1 accent-accent" checked={policy === o.value} onChange={() => setAccess.mutate(o.value)} />
                    <span className="min-w-0">
                      <span className="block font-medium">{o.label}</span>
                      <span className="block text-xs text-muted">{o.detail}</span>
                    </span>
                  </label>
                ))}
                {!canSetAccess ? <p className="text-xs text-muted">Only the session's owner or an admin can change this.</p> : null}
              </fieldset>
            ) : null}
          </DialogBody>
          <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm === "rotate"}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Rotate the public link?"
        description="You get a new link and the current one stops working."
        consequences={["Anyone using the current link loses access immediately.", "The new link is shown once. Copy it before you close this."]}
        confirmLabel="Rotate link"
        onConfirm={make}
      />
      <ConfirmDialog
        open={confirm === "remove"}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Remove the public link?"
        description="The canvas goes back to people who can open the session."
        consequences={["The link stops working immediately for everyone who has it."]}
        confirmLabel="Remove link"
        tone="danger"
        onConfirm={async () => { await remove.mutateAsync(); setFresh(null); }}
      />
    </>
  );
}
