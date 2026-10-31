import { FileText, Paperclip } from "lucide-react";
import { useSource } from "@/data/source";
import type { AttachmentMarker } from "@/lib/attachment-marker";

/**
 * The files a message carried, as quiet chips: an image shows its thumbnail, anything else a file
 * mark and its name. The raw marker text stays in the message the agent reads; people see this.
 */
export function ChatAttachments({ markers }: { markers: AttachmentMarker[] }) {
  const { source } = useSource();
  if (!markers.length) return null;
  return (
    <ul className="mb-1.5 flex flex-wrap gap-1.5" aria-label={`${markers.length} attached ${markers.length === 1 ? "file" : "files"}`}>
      {markers.map((m) => {
        const url = m.isImage ? source.artifactUrl(m.sessionId, m.artifact) : null;
        return (
          <li key={`${m.sessionId}/${m.artifact}`} className="flex max-w-full items-center gap-1.5 rounded-control border border-line bg-surface py-1 pl-1.5 pr-2 text-sm">
            {url ? <img src={url} alt="" className="size-7 shrink-0 rounded-chip object-cover" loading="lazy" /> : m.isImage ? <Paperclip className="size-4 shrink-0 text-muted" aria-hidden /> : <FileText className="size-4 shrink-0 text-muted" aria-hidden />}
            <span className="min-w-0 truncate">{m.name}</span>
          </li>
        );
      })}
    </ul>
  );
}
