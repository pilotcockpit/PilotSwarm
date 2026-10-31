import * as React from "react";
import { flushSync } from "react-dom";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Expand } from "lucide-react";
import { ArtifactPreview, ReadOnlyArtifactDocument } from "@/components/artifact-preview";
import { Button } from "@/components/ui/button";
import { useBoundedArtifactText } from "@/lib/use-artifact-preview";
import { INSPECTOR_PREVIEW_BYTES, type PreviewFit } from "@/lib/preview-limits";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";

/** Inspect the actual published document. Its preview grows into the reading
 * surface with a native shared-element transition; no motion library or new API.
 */
export function ArtifactInspector({ html, filename, title, sessionId, slot, loading, failed, fit = "card", updatedAt }: {
  html?: string; filename: string; title: string; sessionId: string; slot: number; loading: boolean; failed: boolean;
  /** Where the document fits: "inspector" means the card has no preview but the reading view can load it on open. */
  fit?: PreviewFit; updatedAt?: string | number;
}) {
  const [open, setOpen] = React.useState(false);
  // A document the card did not load is read on open, bounded to the inspector limit; never in full.
  const loadOnOpen = !html && fit !== "none";
  const reading = useBoundedArtifactText({ sessionId, filename, updatedAt, maxBytes: INSPECTOR_PREVIEW_BYTES, enabled: open && loadOnOpen });
  const doc = html ?? (reading.data && !reading.data.truncated ? reading.data.text : undefined);
  const tooLarge = !doc && (fit === "none" || Boolean(reading.data?.truncated));
  const [ownsTransition, setOwnsTransition] = React.useState(false);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const motionRevision = React.useRef(0);
  const documentLoaded = React.useRef<(() => void) | null>(null);
  const changeOpen = (next: boolean) => {
    const revision = ++motionRevision.current;
    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOpen(next);
      setOwnsTransition(false);
      return;
    }
    // Only the active inspector owns this name; other cards never duplicate it.
    flushSync(() => setOwnsTransition(true));
    const transition = document.startViewTransition(async () => {
      const loaded = next ? new Promise<void>((resolve) => { documentLoaded.current = resolve; }) : Promise.resolve();
      flushSync(() => setOpen(next));
      if (next) {
        // Capture real document ink, not a newly mounted blank iframe.
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([loaded, new Promise<void>((resolve) => { timer = setTimeout(resolve, 500); })]);
        clearTimeout(timer);
      }
    });
    void transition.ready.catch(() => {}); // A rapid close can legitimately skip the opening snapshot.
    void transition.finished.catch(() => {}).finally(() => { if (motionRevision.current === revision) setOwnsTransition(false); });
  };
  return <Dialog open={open} onOpenChange={changeOpen}>
    <div className="relative" style={{ viewTransitionName: ownsTransition && !open ? "fd-output-inspection" : "none" }}>
      <ArtifactPreview html={html} filename={filename} loading={loading} failed={failed} note={fit === "none" ? "Too large to preview" : fit === "inspector" ? "Large document. Inspect to read it." : undefined} />
      <Button ref={trigger} variant="quiet" disabled={(!html && !loadOnOpen) || loading || failed} onClick={() => changeOpen(true)}
        aria-label={`Inspect ${title}`} className="absolute inset-0 h-full w-full rounded-none p-0 hover:bg-transparent">
        <span className="absolute bottom-3 right-3 inline-flex min-h-8 items-center gap-2 rounded-control border border-line bg-overlay px-3 text-sm text-fg pointer-coarse:min-h-11"><Expand /> Inspect</span>
      </Button>
    </div>
    <DialogContent title={title} description="Read-only preview of the published canvas. Open the output to see it in its session."
      className="fd-document-dialog top-8 h-5/6 max-h-dvh w-full max-w-5xl rounded-work data-[state=open]:animate-none"
      onCloseAutoFocus={(e) => { e.preventDefault(); trigger.current?.focus(); }}>
      <DialogBody className="flex overflow-hidden p-0">
        <div className="min-h-0 flex-1" onLoadCapture={() => { documentLoaded.current?.(); documentLoaded.current = null; }} style={{ viewTransitionName: ownsTransition && open ? "fd-output-inspection" : "none" }}>
          {doc ? <ReadOnlyArtifactDocument html={doc} title={title} /> : (
            <p role="status" className="m-auto max-w-prose p-6 text-center text-base text-muted">
              {tooLarge ? "This document is too large to read here. Open the output to see it in its session."
                : reading.isError ? "The document could not be loaded. Open the output to try again."
                : "Loading document…"}
            </p>
          )}
        </div>
      </DialogBody>
      <DialogFooter><Button onClick={() => changeOpen(false)}>Back to your work</Button><Button asChild variant="primary"><Link to="/s/$sessionId" params={{ sessionId }} search={{ view: "canvas", slot }} onClick={() => setOpen(false)}>Open output <ArrowUpRight /></Link></Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
