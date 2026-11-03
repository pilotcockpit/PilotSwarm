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

// ── Trust ────────────────────────────────────────────────────────────────────────────
// The text of a message is untrusted: an agent, another person or a pasted block can write any
// marker, including one that names another session or a path-shaped file. The marker parser only
// reads text; it decides nothing. Anything that turns a marker into a request (a thumbnail) must
// pass `chipModel` with the id of the session actually on screen. Assistant messages do not go
// through the marker parser today; this confinement is what keeps that safe if they ever do.

const MAX_NAME = 120;
const MAX_ARTIFACT_NAME = 255;
const CONTROL_CHARS = "[\\u0000-\\u001f\\u007f-\\u009f\\u202a-\\u202e\\u2066-\\u2069]";
const HAS_CONTROL = new RegExp(CONTROL_CHARS);
const STRIP_CONTROL = new RegExp(CONTROL_CHARS, "g");

/** A stored artifact name that is one plain path segment: no separators, dot segments, encodings of them, or control characters. */
export function isSafeArtifactName(name: string): boolean {
  if (!name || name.length > MAX_ARTIFACT_NAME) return false;
  if (HAS_CONTROL.test(name) || /[\\/]/.test(name)) return false;
  if (name === "." || name === "..") return false;
  if (/%(?:2e|2f|5c|00)/i.test(name)) return false;
  let decoded: string;
  try { decoded = decodeURIComponent(name); } catch { return false; }
  return decoded !== "." && decoded !== ".." && !/[\\/]/.test(decoded) && !HAS_CONTROL.test(decoded);
}

/** What people see for a file name: control and direction-override characters removed, long names cut. */
export function displayFileName(name: string): { label: string; title?: string } {
  const clean = String(name ?? "").replace(STRIP_CONTROL, "").trim() || "file";
  if (clean.length <= MAX_NAME) return { label: clean };
  return { label: `${clean.slice(0, MAX_NAME - 1)}…`, title: clean.slice(0, 300) };
}

export interface ChipModel {
  label: string;
  title?: string;
  /** Set only for an image that belongs to the session on screen: the artifact to load as a thumbnail. */
  thumbnailArtifact: string | null;
}

/** The one place a marker becomes something the page may fetch. `trustedSessionId` is the session being shown, never read from message text. */
export function chipModel(marker: AttachmentMarker, trustedSessionId: string | null | undefined): ChipModel {
  const shown = displayFileName(marker.name);
  const ours = Boolean(trustedSessionId) && marker.sessionId === trustedSessionId;
  return { ...shown, thumbnailArtifact: ours && marker.isImage && isSafeArtifactName(marker.artifact) ? marker.artifact : null };
}
