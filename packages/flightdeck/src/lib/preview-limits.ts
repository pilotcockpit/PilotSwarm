// How much of an agent-authored document Flight Deck will read and render for a preview. Agent output is
// untrusted and can be any size: the read is bounded before it is downloaded and again before it is parsed.

/** Inline card previews on Home: the whole document is sanitised and laid out in a frame, once per card. */
export const CARD_PREVIEW_BYTES = 512 * 1024;
/**
 * The inspector's reading view. The Web API caps `readArtifactBase64` at 1 MiB whatever is asked
 * (packages/app/tui/src/node-sdk-transport.js), so a larger limit would be a promise the server cannot keep.
 */
export const INSPECTOR_PREVIEW_BYTES = 1024 * 1024;

/** Where a document of this size can be previewed: on the card, only in the inspector, or not at all. */
export type PreviewFit = "card" | "inspector" | "none";

export function previewFit(sizeBytes: unknown): PreviewFit {
  const n = Number(sizeBytes);
  // Unknown size: the bounded read decides (a truncated read means it did not fit).
  if (sizeBytes == null || !Number.isFinite(n) || n < 0) return "card";
  if (n <= CARD_PREVIEW_BYTES) return "card";
  if (n <= INSPECTOR_PREVIEW_BYTES) return "inspector";
  return "none";
}

/** Text of at most `maxBytes` bytes, and whether the document was longer than that. */
export interface BoundedText { text: string; truncated: boolean }
