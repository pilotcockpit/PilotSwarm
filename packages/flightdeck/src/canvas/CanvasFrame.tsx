import * as React from "react";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { EXTERNAL_LINK_MESSAGE, SANDBOXED_FRAME_SANDBOX, normalizeExternalLink, wrapSandboxedDocument } from "@ps/sandbox";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The canvas host. Agent-authored HTML runs in a srcdoc frame sandboxed to
 * scripts only, behind the portal's own no-network policy (the same
 * wrapSandboxedDocument the classic portal uses: one policy, both hosts).
 * Links never open from the page: the host shows the destination first.
 */
export function CanvasFrame({ html, title, zoom = 1, className }: { html: string; title: string; zoom?: number; className?: string }) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [pendingLink, setPendingLink] = React.useState<string | null>(null);
  const [refused, setRefused] = React.useState<string | null>(null);
  const srcDoc = React.useMemo(() => wrapSandboxedDocument(html), [html]);

  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      if (e.data?.type === EXTERNAL_LINK_MESSAGE) {
        const href = normalizeExternalLink(e.data.href);
        if (href) setPendingLink(href);
        else setRefused("This canvas tried to open a link that isn't a web page, so it was blocked.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  React.useEffect(() => {
    if (!refused) return;
    const t = window.setTimeout(() => setRefused(null), 5000);
    return () => window.clearTimeout(t);
  }, [refused]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-white", className)}>{/* token-ok: agent canvases are documents drawn on white */}
      <iframe
        ref={frameRef}
        title={title}
        sandbox={SANDBOXED_FRAME_SANDBOX}
        srcDoc={srcDoc}
        referrerPolicy="no-referrer"
        className="block border-0"
        style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})`, transformOrigin: "0 0" }}
      />
      {refused ? (
        <div role="status" className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-pane border border-line bg-overlay px-3 py-2 text-sm text-fg shadow-pop">
          <ShieldAlert className="size-4 shrink-0 text-waiting" aria-hidden /> {refused}
        </div>
      ) : null}
      <Dialog open={Boolean(pendingLink)} onOpenChange={(o) => !o && setPendingLink(null)}>
        <DialogContent onCloseAutoFocus={(e) => { e.preventDefault(); frameRef.current?.focus(); }} title="Open this link?" description="The canvas wants to open a page outside PilotSwarm. Check where it goes first.">
          <DialogBody>
            <p className="break-all rounded-control border border-line bg-bg px-3 py-2 font-mono text-sm">{pendingLink}</p>
            <p className="mt-2 text-xs text-muted">Host: <span className="font-mono text-fg">{pendingLink ? new URL(pendingLink).host : ""}</span></p>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setPendingLink(null)}>Stay here</Button>
            <Button variant="primary" onClick={() => { if (pendingLink) window.open(pendingLink, "_blank", "noopener,noreferrer"); setPendingLink(null); }}>
              <ExternalLink /> Open in new tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** A canvas's display name: its <title>, else its first heading, else "Canvas N". */
export function canvasName(html: string | undefined, slot: number) {
  const text = String(html || "");
  const title = text.match(/<title[^>]*>([^<]{1,80})<\/title>/i)?.[1]?.trim();
  const h1 = text.match(/<h1[^>]*>([\s\S]{1,160}?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
  const name = title || h1;
  return name ? name.replace(/\s*·.*$/, "").slice(0, 40) : `Canvas ${slot}`;
}
