import * as React from "react";
import createDOMPurify from "dompurify";
import { FileText } from "lucide-react";
import { wrapSandboxedDocument } from "@ps/sandbox";

const scriptedHead = wrapSandboxedDocument("");
// This is trusted wrapper markup, not a regex sanitizer for agent HTML. Keep
// its canonical policy/DNS guards; scriptful link/WebRTC guards are unnecessary
// in a scriptless reading frame and would only produce blocked-script warnings.
const staticHead = scriptedHead.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

function readOnlyDocument(html: string) {
  if (typeof window === "undefined") return staticHead;
  const purifier = createDOMPurify(window);
  purifier.addHook("afterSanitizeAttributes", (node) => {
    const name = node.nodeName.toUpperCase();
    if (/^(INPUT|BUTTON|SELECT|TEXTAREA|OPTION|OPTGROUP)$/.test(name)) node.setAttribute("disabled", "");
    if (/\b(checkbox|radio|switch|button|link|textbox|combobox|slider|spinbutton|menuitem)\b/.test(node.getAttribute("role") || "")) node.setAttribute("aria-disabled", "true");
    node.removeAttribute("contenteditable"); node.removeAttribute("tabindex"); node.removeAttribute("autofocus");
    if (name === "A") { node.removeAttribute("href"); node.removeAttribute("xlink:href"); node.removeAttribute("target"); }
  });
  const clean = purifier.sanitize(html, { WHOLE_DOCUMENT: true, FORBID_TAGS: ["script", "iframe", "object", "embed", "portal", "form", "meta", "link", "base"] });
  // Retain the shared wrapper's shadow-root disarming of the sanitized body.
  return staticHead + wrapSandboxedDocument(clean).slice(scriptedHead.length);
}

/** Authentic document preview: same no-network wrapper, with scripting disabled.
 * Inert and unfocusable: the containing card owns the single navigation target.
 */
export function ArtifactPreview({ html, filename, loading, failed }: { html?: string; filename: string; loading?: boolean; failed?: boolean }) {
  const srcDoc = React.useMemo(() => html ? readOnlyDocument(html) : undefined, [html]);
  return <div aria-hidden inert className="relative aspect-video overflow-hidden border-b border-line-subtle bg-raised">
    {srcDoc ? <div className="fd-preview-sheet absolute inset-0"><iframe title="" tabIndex={-1} sandbox="" referrerPolicy="no-referrer" loading="lazy" srcDoc={srcDoc}
      className="pointer-events-none absolute left-0 top-0 border-0 bg-surface"
      style={{ width: "100%", height: "300%" }} /></div> :
      <div className="flex h-full flex-col justify-between p-5">
        <FileText className="size-6 text-muted" />
        <div><p className="line-clamp-2 break-words text-lg font-medium text-fg">{filename}</p><p className="mt-1 text-xs text-muted">{loading ? "Loading preview…" : failed ? "Preview unavailable" : "Published file"}</p></div>
      </div>}
  </div>;
}

/** Reading view: preserve actual content and checked values, with no document
 * actions pretending to save. The containing session owns interactive work.
 */
export function ReadOnlyArtifactDocument({ html, title }: { html: string; title: string }) {
  const srcDoc = React.useMemo(() => readOnlyDocument(html), [html]);
  return <iframe title={`${title} — read-only preview`} sandbox="" referrerPolicy="no-referrer" srcDoc={srcDoc} className="block h-full w-full border-0" />;
}
