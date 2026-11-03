import * as React from "react";
import createDOMPurify from "dompurify";
import { FileText } from "lucide-react";
import { wrapReadOnlyDocument } from "@ps/sandbox";
import { INSPECTOR_PREVIEW_BYTES } from "@/lib/preview-limits";

/** Past this many characters a document is not parsed at all: UTF-8 text of at most the inspector's byte limit. */
const MAX_SANITIZE_CHARS = INSPECTOR_PREVIEW_BYTES;
/** Anything that can leave the frame, move it, or run something: gone, whatever the CSP would also say. */
const FORBIDDEN_TAGS = ["script", "iframe", "frame", "frameset", "object", "embed", "portal", "form", "meta", "link", "base",
  "map", "area", // image maps are navigation in disguise
  "animate", "set", "animateMotion", "animateTransform"]; // SMIL can write an href onto a link after sanitising
const FORBIDDEN_ATTRS = ["usemap", "action", "formaction", "ping", "srcdoc", "target", "autofocus", "contenteditable", "tabindex"];

/**
 * CSS that can reach out: an @import, or a url() that is not inline data. The frame's CSP already refuses
 * these, but a refused request is still a request the browser starts (it shows in the network log and tells
 * the agent's server a document was read), so the reference is removed before it is ever parsed.
 */
export function scrubCss(css: string): string {
  return css.replace(/@import\b[^;{}]*;?/gi, "").replace(/url\(\s*(['"]?)(?!data:)[^)]*\)/gi, "url()");
}

/**
 * The agent's HTML, made reading-only: a document with nothing to follow, submit, or edit. Pure given a DOM
 * (`window`), so a browser test can run the real thing on hostile payloads. Never called on the server.
 */
export function sanitizeArtifactHtml(html: string): string {
  if (html.length > MAX_SANITIZE_CHARS) return "<!doctype html><body><p>Too large to preview.</p></body>";
  const purifier = createDOMPurify(window);
  purifier.addHook("afterSanitizeAttributes", (node) => {
    const name = node.nodeName.toUpperCase();
    if (/^(INPUT|BUTTON|SELECT|TEXTAREA|OPTION|OPTGROUP)$/.test(name)) node.setAttribute("disabled", "");
    if (/\b(checkbox|radio|switch|button|link|textbox|combobox|slider|spinbutton|menuitem)\b/.test(node.getAttribute("role") || "")) node.setAttribute("aria-disabled", "true");
    for (const attr of FORBIDDEN_ATTRS) node.removeAttribute(attr);
    if (name === "STYLE") node.textContent = scrubCss(node.textContent || "");
    const inline = node.getAttribute("style");
    if (inline) node.setAttribute("style", scrubCss(inline));
    // Only links navigate. Other elements keep their references (an SVG <use href="#id"> is not navigation).
    if (name === "A") { node.removeAttribute("href"); node.removeAttribute("xlink:href"); }
  });
  return purifier.sanitize(html, { WHOLE_DOCUMENT: true, FORBID_TAGS: FORBIDDEN_TAGS, FORBID_ATTR: FORBIDDEN_ATTRS });
}

function readOnlyDocument(html: string) {
  // The shared wrapper's doctype, policy and disarmed shadow roots, with no script: the frame allows none.
  if (typeof window === "undefined") return wrapReadOnlyDocument("");
  return wrapReadOnlyDocument(sanitizeArtifactHtml(html));
}

/** Authentic document preview: same no-network wrapper, with scripting disabled.
 * Inert and unfocusable: the containing card owns the single navigation target.
 */
/** `scale` shrinks the page like a thumbnail (0.3 shows it at 30%): for a small frame, where the page would otherwise be cropped to its heading. */
export function ArtifactPreview({ html, filename, loading, failed, note, scale }: { html?: string; filename: string; loading?: boolean; failed?: boolean; note?: string; scale?: number }) {
  const srcDoc = React.useMemo(() => html ? readOnlyDocument(html) : undefined, [html]);
  return <div aria-hidden inert className="relative aspect-video overflow-hidden bg-raised">
    {srcDoc ? <div className="fd-preview-sheet absolute inset-0"><iframe title="" tabIndex={-1} sandbox="" referrerPolicy="no-referrer" loading="lazy" srcDoc={srcDoc}
      className="pointer-events-none absolute left-0 top-0 border-0 bg-surface"
      style={scale ? { width: `calc(${100 / scale}% + 24px)`, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: "0 0" } : { width: "calc(100% + 24px)", height: "300%" }} /></div> :
      <div className="flex h-full flex-col justify-between p-5">
        <FileText className="size-6 text-muted" />
        <div><p className="line-clamp-2 break-words text-lg font-medium text-fg">{filename}</p><p className="mt-1 text-xs text-muted">{loading ? "Loading preview…" : failed ? "Preview unavailable" : note || "Published file"}</p></div>
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
