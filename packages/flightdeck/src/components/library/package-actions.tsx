import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { PackageSummary, PackageVersion } from "@/data/ops/packages";
import { deleteConsequences } from "./package-rules";

/** Deleting a package removes every version. Typing its name makes that a decision, not a click. */
export function DeletePackageDialog({ pkg, versions, liveSessions, open, onOpenChange, onDelete }: {
  pkg: PackageSummary;
  versions: number;
  liveSessions: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => Promise<unknown>;
}) {
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => { if (open) { setTyped(""); setError(null); } }, [open]);
  const go = async () => {
    setBusy(true);
    setError(null);
    try { await onDelete(); onOpenChange(false); } catch (e: any) { setError(e?.message || "That didn't work"); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent title={`Delete ${pkg.name}?`} description="This cannot be undone.">
        <DialogBody className="flex flex-col gap-3">
          <ul className="list-disc pl-5 text-sm">
            {deleteConsequences(pkg, versions || 1, liveSessions).map((line, n) => <li key={n} className={n === 1 && liveSessions ? "text-failed" : undefined}>{line}</li>)}
          </ul>
          <Field label={<>Type <span className="font-mono">{pkg.name}</span> to confirm</>} error={error}>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button autoFocus onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="danger" onClick={go} disabled={typed !== pkg.name || busy}>{busy ? <Loader2 className="animate-spin" /> : null} Delete package</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Publish one version's exact files into the other copy of the same name: the way to update a
 * package that is already shared (promoting can only move a package to a name nobody uses).
 */
export function RepublishDialog({ pkg, versions, open, onOpenChange, onRepublish }: {
  pkg: PackageSummary;
  versions: PackageVersion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRepublish: (semver: string, targetScope: "shared" | "user") => Promise<unknown>;
}) {
  const target: "shared" | "user" = pkg.scope === "shared" ? "user" : "shared";
  const [semver, setSemver] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => { if (open) { setSemver(pkg.active?.semver ?? versions[0]?.semver ?? ""); setError(null); } }, [open, pkg, versions]);
  const go = async () => {
    setBusy(true);
    setError(null);
    try { await onRepublish(semver, target); onOpenChange(false); } catch (e: any) { setError(e?.message || "That didn't work"); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent title={target === "shared" ? "Update the shared package" : "Copy into your private package"} description={target === "shared" ? `Publishes the exact files of one version into the shared ${pkg.name}. Everyone gets it.` : `Publishes the exact files of one version into your own ${pkg.name}.`}>
        <DialogBody className="flex flex-col gap-3">
          <Field label="Version" error={error}>
            <select value={semver} onChange={(e) => setSemver(e.target.value)} className="h-control w-full rounded-control border border-line-strong bg-surface px-2.5 text-sm text-fg outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent">
              {versions.map((v) => <option key={v.versionId} value={v.semver}>{v.semver}{v.versionId === pkg.active?.versionId ? " (active)" : ""}</option>)}
            </select>
          </Field>
          {target === "shared" ? <p className="text-sm text-muted">The shared package must already exist and you must be allowed to publish to it. To share this one for the first time, use Share with everyone. The version you pick becomes the shared package's active version.</p> : null}
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={go} disabled={!semver || busy}>{busy ? <Loader2 className="animate-spin" /> : null} Publish {semver}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
