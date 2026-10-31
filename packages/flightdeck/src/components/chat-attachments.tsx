import { FileText, Paperclip } from "lucide-react";
import { useSource } from "@/data/source";
import { chipModel, type AttachmentMarker } from "@/lib/attachment-marker";

/**
 * The files a message carried, as quiet chips: an image shows its thumbnail, anything else a file
 * mark and its name. The raw marker text stays in the message the agent reads; people see this.
 * `sessionId` is the session on screen. A marker that names any other session, or a file name
 * that is not one plain segment, still shows as text but never loads anything.
 */
export function ChatAttachments({ markers, sessionId }: { markers: AttachmentMarker[]; sessionId: string | null | undefined }) {
  const { source } = useSource();
  if (!markers.length) return null;
  return (
    <ul className="mb-1.5 flex flex-wrap gap-1.5" aria-label={`${markers.length} attached ${markers.length === 1 ? "file" : "files"}`}>
      {markers.map((m, i) => {
        const chip = chipModel(m, sessionId);
        const url = chip.thumbnailArtifact && sessionId ? source.artifactUrl(sessionId, chip.thumbnailArtifact) : null;
        return (
          <li key={`${i}/${m.sessionId}/${m.artifact}`} title={chip.title} className="flex max-w-full items-center gap-1.5 rounded-control border border-line bg-surface py-1 pl-1.5 pr-2 text-sm">
            {url ? <img src={url} alt="" className="size-7 shrink-0 rounded-chip object-cover" loading="lazy" referrerPolicy="no-referrer" /> : m.isImage ? <Paperclip className="size-4 shrink-0 text-muted" aria-hidden /> : <FileText className="size-4 shrink-0 text-muted" aria-hidden />}
            <span className="min-w-0 truncate">{chip.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
