// Agent-authored HTML — session canvases, HTML artifact previews and shared
// canvases — runs in a srcdoc iframe sandboxed WITHOUT allow-same-origin, so its
// script gets an opaque origin and cannot touch the portal's storage, cookies
// or token. The sandbox alone does not stop a page from reaching the network:
// an opaque-origin frame can still fetch CORS-open hosts, load remote images,
// open popups that escape the sandbox, or navigate itself to a URL that
// carries data in its query string. A canvas app can read the session's
// files, so each of those is a way out for whatever the page has read.
//
// Three layers close them, and every host uses the same ones:
//
//   1. SANDBOXED_DOCUMENT_CSP, in a head the portal writes before ANY of the
//      page's bytes: no network of any kind (the html-visuals skill already
//      promises pages this contract). The same head turns DNS prefetching off
//      and removes WebRTC, which CSP does not govern in Chromium: a page could
//      otherwise send data out through a STUN server's address.
//   2. SANDBOXED_FRAME_SANDBOX: scripts only — no popups, no forms, no
//      top-level navigation. Links go through the host instead: the injected
//      guard posts EXTERNAL_LINK_MESSAGE and the portal shows the destination
//      before it opens anything.
//   3. PORTAL_FRAME_POLICY, sent with the portal shell: a frame may only show
//      the portal's own documents, so a page navigating its own frame to an
//      outside URL is refused before the request leaves the browser. blob:
//      and data: are refused too, which is why hosts load documents through
//      srcdoc: a page could otherwise build a blob without this wrapper and
//      replace itself with it.

export const SANDBOXED_FRAME_SANDBOX = "allow-scripts";

export const SANDBOXED_DOCUMENT_CSP = [
    "default-src 'none'",
    // Pages inline everything; eval stays allowed because inlined libraries
    // use it, and with no network and an opaque origin it reaches nothing.
    "script-src 'unsafe-inline' 'unsafe-eval' blob: data:",
    "style-src 'unsafe-inline' blob: data:",
    "img-src blob: data:",
    "media-src blob: data:",
    "font-src blob: data:",
    "worker-src blob: data:",
    "connect-src blob: data:",
    "form-action 'none'",
    "base-uri 'none'",
].join("; ");

// Entra sign-in renews tokens in a hidden login.microsoftonline.com frame;
// every other frame the portal shows is a srcdoc document it wrapped itself
// (srcdoc is not subject to frame-src).
export const PORTAL_FRAME_POLICY = "frame-src 'self' https://login.microsoftonline.com";

export const EXTERNAL_LINK_MESSAGE = "canvas-open-link";

// Sent with the portal shell next to PORTAL_FRAME_POLICY.
export const PORTAL_SHELL_HEADERS = Object.freeze({
    "Content-Security-Policy": PORTAL_FRAME_POLICY,
    "X-DNS-Prefetch-Control": "off",
});

const HEAD = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${SANDBOXED_DOCUMENT_CSP}"><meta http-equiv="x-dns-prefetch-control" content="off">`;

// Removes WebRTC before the page runs, and keeps the page from getting it
// back from a fresh window. The properties are made permanent, so the page
// cannot restore the constructors; and since a nested frame would start with
// a fresh window of its own, frames, objects and embeds are removed as soon as
// they appear, including inside shadow roots (attachShadow is watched, and the
// APIs that build shadow roots from an HTML string at run time are removed).
// Canvases are self-contained by contract and have no use for nested frames.
//
// It runs before any of the page's script, and everything it calls later is
// captured here first: a page that replaces Array.prototype.forEach or
// Element.prototype.remove must not be able to switch the observer off.
// Serialized into the document, so it may use nothing from this module.
// Tested against STUN egress in test/e2e/canvas-sandbox.spec.mjs.
function lockDownFreshWindows() {
    var defineProperty = Object.defineProperty;
    var getDescriptor = Object.getOwnPropertyDescriptor;
    var apply = Reflect.apply;
    var ElementProto = Element.prototype;
    var matches = ElementProto.matches;
    var remove = ElementProto.remove;
    var attachShadow = ElementProto.attachShadow;
    var queryElement = ElementProto.querySelectorAll;
    var queryFragment = DocumentFragment.prototype.querySelectorAll;
    var queryDocument = Document.prototype.querySelectorAll;
    var nodeType = getDescriptor(Node.prototype, "nodeType").get;
    var shadowRoot = getDescriptor(ElementProto, "shadowRoot").get;
    var addedNodes = getDescriptor(MutationRecord.prototype, "addedNodes").get;
    var listLength = getDescriptor(NodeList.prototype, "length").get;
    var listItem = NodeList.prototype.item;
    var observe = MutationObserver.prototype.observe;
    var frameWindows = [];
    var frameTypes = [window.HTMLIFrameElement, window.HTMLFrameElement, window.HTMLObjectElement];
    for (var t = 0; t < frameTypes.length; t++) {
        var d = frameTypes[t] && getDescriptor(frameTypes[t].prototype, "contentWindow");
        if (d && d.get) frameWindows[frameWindows.length] = d.get;
    }
    var FRAMES = "iframe,frame,object,embed,portal,fencedframe";
    var NAMES = ["RTCPeerConnection", "webkitRTCPeerConnection", "mozRTCPeerConnection", "RTCDataChannel", "RTCIceCandidate", "RTCSessionDescription"];
    var options = Object.create(null);
    options.childList = true;
    options.subtree = true;

    function fix(target, key, value) {
        try { defineProperty(target, key, { value: value, configurable: false, writable: false, enumerable: false }); } catch (e) { /* not ours to change */ }
    }
    function lock(win) {
        if (!win) return;
        for (var i = 0; i < NAMES.length; i++) fix(win, NAMES[i], undefined);
    }
    function each(list, fn) {
        var n = apply(listLength, list, []);
        for (var i = 0; i < n; i++) fn(apply(listItem, list, [i]));
    }
    function disarm(el) {
        for (var i = 0; i < frameWindows.length; i++) {
            try { lock(apply(frameWindows[i], el, [])); } catch (e) { /* not that kind of frame */ }
        }
        apply(remove, el, []);
    }
    function visit(el) {
        if (apply(matches, el, [FRAMES])) { disarm(el); return; }
        var root = apply(shadowRoot, el, []);
        if (root) watch(root);
    }
    function sweep(root, query) {
        each(apply(query, root, ["*"]), visit);
    }
    function strip(node) {
        try {
            if (!node || apply(nodeType, node, []) !== 1) return;
            if (apply(matches, node, [FRAMES])) { disarm(node); return; }
            visit(node);
            sweep(node, queryElement);
        } catch (e) { /* keep watching */ }
    }
    var observer = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) each(apply(addedNodes, records[i], []), strip);
    });
    function watch(root) {
        apply(observe, observer, [root, options]);
        sweep(root, apply(nodeType, root, []) === 9 ? queryDocument : queryFragment);
    }

    lock(window);
    watch(document);
    fix(ElementProto, "attachShadow", function (init) {
        var root = apply(attachShadow, this, [init]);
        watch(root);
        return root;
    });
    fix(ElementProto, "setHTMLUnsafe", undefined);
    if (window.ShadowRoot) fix(ShadowRoot.prototype, "setHTMLUnsafe", undefined);
    fix(Document, "parseHTMLUnsafe", undefined);
}

const WEBRTC_LOCKDOWN = `<script>(${lockDownFreshWindows.toString()})();</script>`;

// A shadow root declared in markup (<template shadowrootmode>) is built by the
// parser, out of reach of the observer, so a frame inside a closed one would
// keep a fresh window. Each <template> start tag's attributes are read the way
// the HTML tokenizer reads them, and a shadowrootmode attribute is renamed so
// the <template> stays inert. Only text that starts a <template> tag is
// touched; script, style and prose are left alone.
//
// Every "<template" is scanned from its own start, even one inside a comment
// or a script: a real start tag always begins with that text, so it is read
// from where the browser reads it however the text before it confuses a scan
// (a fake '<template x="' in a comment must not swallow the real one).
const TAG_SPACE = "\t\n\f\r ";
const TEMPLATE_START = /<template(?=[\t\n\f\r />])/gi;

export function disarmDeclaredShadowRoots(html) {
    const text = String(html ?? "");
    const renames = [];
    let match;
    TEMPLATE_START.lastIndex = 0;
    while ((match = TEMPLATE_START.exec(text))) {
        let i = match.index + match[0].length;
        while (i < text.length) {
            while (i < text.length && (TAG_SPACE.includes(text[i]) || text[i] === "/")) i += 1;
            if (i >= text.length || text[i] === ">") break;
            const nameStart = i;
            i += 1; // the first character belongs to the name, even "="
            while (i < text.length && !TAG_SPACE.includes(text[i]) && !"/>=".includes(text[i])) i += 1;
            if (text.slice(nameStart, i).toLowerCase() === "shadowrootmode") renames.push(nameStart);
            while (i < text.length && TAG_SPACE.includes(text[i])) i += 1;
            if (text[i] !== "=") continue;
            i += 1;
            while (i < text.length && TAG_SPACE.includes(text[i])) i += 1;
            if (text[i] === '"' || text[i] === "'") {
                const quote = text[i];
                i = text.indexOf(quote, i + 1);
                i = i < 0 ? text.length : i + 1;
            } else {
                while (i < text.length && !TAG_SPACE.includes(text[i]) && text[i] !== ">") i += 1;
            }
        }
        TEMPLATE_START.lastIndex = match.index + 1;
    }
    let out = "";
    let from = 0;
    for (const at of [...new Set(renames)].sort((a, b) => a - b)) {
        out += text.slice(from, at) + "data-blocked-";
        from = at;
    }
    return out + text.slice(from);
}

// Every link click, and window.open, becomes a request to the host. Runs on
// window after the page's own handlers, so a page that handles its own clicks
// (preventDefault) keeps them; "#" links, javascript: links and downloads are
// left alone.
// Embedded in a <script>: no "<" (so no "</script>") and no line separators can come out of the literal, whatever the constant holds.
const MESSAGE_LITERAL = JSON.stringify(EXTERNAL_LINK_MESSAGE).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const LINK_GUARD = `<script>(function(){var M=${MESSAGE_LITERAL};function ask(u){try{parent.postMessage({type:M,href:new URL(String(u),document.baseURI).href},"*")}catch(x){}}addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href],area[href]");if(!a||e.defaultPrevented||a.hasAttribute("download"))return;var h=a.getAttribute("href")||"";if(!h||h.charAt(0)==="#"||/^javascript:/i.test(h))return;e.preventDefault();ask(h)});window.open=function(u){if(u)ask(u);return null}})();</script>`;

// MoA tiles hand Tab and Escape back to the dashboard.
const PANEL_KEY_BRIDGE = `<script>window.addEventListener('keydown',function(e){if(e.isTrusted&&!e.altKey&&!e.metaKey&&!e.ctrlKey&&(e.key==='Tab'||e.key==='Escape')){e.preventDefault();e.stopImmediatePropagation();parent.postMessage({type:'moa-panel-key',key:e.key,backwards:e.shiftKey},'*')}},true);</script>`;

/**
 * Wrap agent-authored HTML for a sandboxed frame. The portal's own doctype,
 * policy and guards come first; NOTHING the page wrote precedes them, not
 * even a comment or its doctype, because the browser's parser and any regex
 * disagree on where those end. The page's own doctype, later, is ignored, and
 * a policy the page adds can only narrow this one.
 */
/**
 * The same wrapper with no script in it, for a frame that only reads (its sandbox allows no scripts, and the page's own
 * are removed before it gets here): the doctype, the policy and the disarmed shadow roots, and nothing the guards would run.
 */
export function wrapReadOnlyDocument(html) {
    return HEAD + disarmDeclaredShadowRoots(String(html ?? "").replace(/^\uFEFF/, ""));
}

export function wrapSandboxedDocument(html, { panelKeys = false } = {}) {
    const text = disarmDeclaredShadowRoots(String(html ?? "").replace(/^\uFEFF/, ""));
    return HEAD
        + WEBRTC_LOCKDOWN
        + LINK_GUARD
        + (panelKeys ? PANEL_KEY_BRIDGE : "")
        + text;
}

/**
 * The links a page may ask the host to open: web pages only. A user name or
 * password in the URL is refused, because "trusted.example@other.example"
 * reads as the wrong host.
 */
export function normalizeExternalLink(href) {
    if (typeof href !== "string" || href.length > 4096) return null;
    try {
        const url = new URL(href);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
        return url.href;
    } catch {
        return null;
    }
}
