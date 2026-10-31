import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/misc";
import type { PackageSummary, PackageVersion } from "@/data/ops/packages";
import { ago, bytes } from "@/lib/utils";
import { notifyUndo } from "@/lib/undo";

/**
 * Every published version, newest first. Switching is one click and says what it does; the toast
 * offers Undo, so rolling back never needs a confirmation dialog.
 */
export function VersionTimeline({ pkg, versions, canEdit, onPin, busy }: {
  pkg: PackageSummary;
  versions: PackageVersion[];
  canEdit: boolean;
  onPin: (semver: string) => Promise<unknown>;
  busy: boolean;
}) {
  const activeId = pkg.active?.versionId;
  const activeIndex = versions.findIndex((v) => v.versionId === activeId);
  const pin = async (v: PackageVersion, index: number) => {
    const previous = pkg.active?.semver;
    try {
      await onPin(v.semver);
      const message = `${pkg.name} now uses ${v.semver}`;
      const description = "Workers switch within about 20 seconds. Running turns finish first.";
      if (previous) notifyUndo(message, () => void onPin(previous), { description });
      else toast(message, { description });
    } catch { /* the mutation already reported the failure */ }
    void index;
  };
  return (
    <ol className="divide-y divide-line-subtle rounded-pane border border-line">
      {versions.map((v, i) => {
        const isActive = v.versionId === activeId;
        const older = activeIndex >= 0 && i > activeIndex;
        return (
          <li key={v.versionId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
            <div className="min-w-0 flex-1 basis-40">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{v.semver}</span>
                {isActive ? <Tag tone="accent">Active</Tag> : null}
              </div>
              <p className="mt-0.5 text-xs text-muted">{ago(v.createdAt as any)} · {bytes(v.sizeBytes)}{v.createdBy ? ` · ${v.createdBy}` : ""}</p>
            </div>
            {!isActive && canEdit ? (
              <Button size="sm" disabled={busy} onClick={() => void pin(v, i)}>{older ? "Roll back to this" : "Switch to this"}</Button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
