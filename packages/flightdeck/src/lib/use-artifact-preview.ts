import { useQuery } from "@tanstack/react-query";
import { useSource } from "@/data/source";
import { CARD_PREVIEW_BYTES, previewFit, type PreviewFit } from "@/lib/preview-limits";

/**
 * A bounded read of an artifact for previewing. The read is capped at `maxBytes` by the server, so a huge
 * agent-authored document never travels to the browser or reaches the sanitiser; `truncated` means it did
 * not fit. Callers that already know the size from metadata should not enable this at all (see previewFit).
 */
export function useBoundedArtifactText({ sessionId, filename, updatedAt, maxBytes, enabled }: {
  sessionId: string; filename: string; updatedAt?: string | number; maxBytes: number; enabled: boolean;
}) {
  const { source } = useSource();
  return useQuery({
    queryKey: ["artifact-preview", sessionId, filename, updatedAt, maxBytes],
    queryFn: () => source.readArtifactPreview(sessionId, filename, maxBytes),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * What an output card may show of a canvas: metadata decides first (an oversized document is never
 * downloaded), the bounded read decides second (an unknown size that comes back truncated did not fit).
 * `fit` is where the document can be previewed: on the card, only in the inspector, or not at all.
 */
export function useCanvasPreview({ sessionId, filename, updatedAt, size, canvas }: {
  sessionId: string; filename: string; updatedAt?: string | number; size?: unknown; canvas: boolean;
}): { html: string | undefined; fit: PreviewFit; loading: boolean; failed: boolean } {
  const sized = previewFit(size);
  const read = useBoundedArtifactText({ sessionId, filename, updatedAt, maxBytes: CARD_PREVIEW_BYTES, enabled: canvas && sized === "card" });
  return {
    html: read.data && !read.data.truncated ? read.data.text : undefined,
    fit: sized === "card" && read.data?.truncated ? "inspector" : sized,
    loading: read.isLoading,
    failed: read.isError,
  };
}
