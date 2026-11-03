import { AlertCircle, FileText, Loader2, X } from "lucide-react";
import { formatBytes, type Attachment } from "@/data/ops/attachments";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * What is about to be sent, as chips above the text: a thumbnail for an image, an icon for a file,
 * its size, and its state (uploading, ready, or why it failed). Every chip can be removed.
 */
export function AttachmentTray({ items, onRemove }: { items: Attachment[]; onRemove: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-2 px-3 pt-3" aria-label="Attachments">
      {items.map((a) => (
        <li
          key={a.id}
          className={cn(
            "flex h-10 max-w-64 items-center gap-2 rounded-control border bg-raised pl-1.5 pr-1",
            a.status === "error" ? "border-failed/50" : "border-line",
          )}
          title={a.status === "error" ? a.error : a.kind === "image" ? "The agent can see this image" : "The agent can read this file"}
        >
          {a.previewUrl ? (
            <img src={a.previewUrl} alt="" className="size-7 shrink-0 rounded-chip object-cover" />
          ) : (
            <span className="grid size-7 shrink-0 place-items-center rounded-chip bg-surface text-muted"><FileText className="size-4" aria-hidden /></span>
          )}
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-xs font-medium">{a.name}</span>
            <span className={cn("block truncate text-xs", a.status === "error" ? "text-failed" : "text-muted")}>
              {a.status === "uploading" ? "Uploading…" : a.status === "error" ? a.error : formatBytes(a.size)}
            </span>
          </span>
          {a.status === "uploading" ? <Loader2 className="size-3.5 shrink-0 animate-spin text-muted" aria-label="Uploading" /> : null}
          {a.status === "error" ? <AlertCircle className="size-3.5 shrink-0 text-failed" aria-hidden /> : null}
          <Button size="icon-sm" variant="quiet" aria-label={`Remove ${a.name}`} onClick={() => onRemove(a.id)}><X /></Button>
        </li>
      ))}
    </ul>
  );
}
