// A message that carries files has one marker line per file in its text:
//   [Attached file: report.csv — artifact://<sessionId>/<artifact>]
// Flight Deck and the classic portal both write it, and the agent reads it, so the text stays as
// sent. The transcript shows each marker as a chip instead of raw text.

export interface AttachmentMarker {
  name: string;
  sessionId: string;
  /** The stored artifact filename, which can differ from `name` when a name was already taken. */
  artifact: string;
  isImage: boolean;
}

const MARKER = /^\[Attached file: (.+?) (?:—|-|–) artifact:\/\/([^/\]\s]+)\/([^\]]+?)\]$/;
const IMAGE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

/** Pull the marker lines out of a message. `rest` is what the person wrote, without them. */
export function splitAttachmentMarkers(text: string): { markers: AttachmentMarker[]; rest: string } {
  const markers: AttachmentMarker[] = [];
  const kept: string[] = [];
  for (const line of String(text ?? "").split("\n")) {
    const m = MARKER.exec(line.trim());
    if (m) markers.push({ name: m[1], sessionId: m[2], artifact: m[3], isImage: IMAGE.test(m[3]) || IMAGE.test(m[1]) });
    else kept.push(line);
  }
  // The blank line that separated the markers from the words goes with them.
  return { markers, rest: markers.length ? kept.join("\n").replace(/^\s*\n/, "").trim() : String(text ?? "") };
}
