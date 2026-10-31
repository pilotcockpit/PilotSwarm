import * as React from "react";
import { flushSync } from "react-dom";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Expand } from "lucide-react";
import { ArtifactPreview, ReadOnlyArtifactDocument } from "@/components/artifact-preview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";

/** Inspect the actual published document. Its preview grows into the reading
 * surface with a native shared-element transition; no motion library or new API.
 */
export function ArtifactInspector({ html, filename, title, sessionId, slot, loading, failed }: {
  html?: string; filename: string; title: string; sessionId: string; slot: number; loading: boolean; failed: boolean;
}) {
  const [open, setOpen] = React.useState(false);
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
      <ArtifactPreview html={html} filename={filename} loading={loading} failed={failed} />
      <Button ref={trigger} variant="quiet" disabled={!html || loading || failed} onClick={() => changeOpen(true)}
        aria-label={`Inspect ${title}`} className="absolute inset-0 h-full w-full rounded-none p-0 hover:bg-transparent">
        <span className="absolute bottom-3 right-3 inline-flex min-h-8 items-center gap-2 rounded-control border border-line bg-overlay px-3 text-sm text-fg pointer-coarse:min-h-11"><Expand /> Inspect</span>
      </Button>
    </div>
    <DialogContent title={title} description="Read-only preview of the published canvas. Open the output to see it in its session."
      className="fd-document-dialog top-8 h-5/6 max-h-dvh w-full max-w-5xl rounded-work data-[state=open]:animate-none"
      onCloseAutoFocus={(e) => { e.preventDefault(); trigger.current?.focus(); }}>
      <DialogBody className="flex overflow-hidden p-0">
        <div className="min-h-0 flex-1" onLoadCapture={() => { documentLoaded.current?.(); documentLoaded.current = null; }} style={{ viewTransitionName: ownsTransition && open ? "fd-output-inspection" : "none" }}>
          {html ? <ReadOnlyArtifactDocument html={html} title={title} /> : null}
        </div>
      </DialogBody>
      <DialogFooter><Button onClick={() => changeOpen(false)}>Back to your work</Button><Button asChild variant="primary"><Link to="/s/$sessionId" params={{ sessionId }} search={{ view: "canvas", slot }} onClick={() => setOpen(false)}>Open output <ArrowUpRight /></Link></Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
