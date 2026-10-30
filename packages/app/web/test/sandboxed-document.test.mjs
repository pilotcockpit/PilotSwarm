// The policy every agent-authored HTML document gets before it reaches a
// frame: canvases, HTML artifact previews and shared canvases. What the
// browser does with it is covered by test/e2e/canvas-sandbox.spec.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { portalStaticOptions } from "../server.js";
import {
    EXTERNAL_LINK_MESSAGE,
    PORTAL_FRAME_POLICY,
    PORTAL_SHELL_HEADERS,
    SANDBOXED_DOCUMENT_CSP,
    SANDBOXED_FRAME_SANDBOX,
    disarmDeclaredShadowRoots,
    normalizeExternalLink,
    wrapSandboxedDocument,
} from "../../ui/react/src/sandboxed-document.js";

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

test("the document policy allows no network of any kind", () => {
    const directives = Object.fromEntries(SANDBOXED_DOCUMENT_CSP.split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
    assert.deepEqual(directives["default-src"], ["'none'"]);
    for (const [name, sources] of Object.entries(directives)) {
        for (const source of sources) {
            assert.ok(!/^(?:https?:|wss?:|\*)/.test(source) && !source.includes("."), `${name} must not allow ${source}`);
        }
    }
    assert.deepEqual(directives["form-action"], ["'none'"]);
    assert.deepEqual(directives["base-uri"], ["'none'"]);
});

test("the frame sandbox runs scripts and nothing else", () => {
    assert.equal(SANDBOXED_FRAME_SANDBOX, "allow-scripts");
});

test("the portal page lets frames show only its own documents and Entra sign-in", () => {
    // No blob: or data: — a page could build one without the wrapper and
    // replace itself with it. Hosts load documents through srcdoc instead.
    assert.equal(PORTAL_FRAME_POLICY, "frame-src 'self' https://login.microsoftonline.com");
});

const HEAD = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${SANDBOXED_DOCUMENT_CSP}"><meta http-equiv="x-dns-prefetch-control" content="off">`;

test("the portal's head comes before every byte the page wrote", () => {
    const page = "<!doctype html>\n<html><head><script>window.first = 1</script></head><body>hi</body></html>";
    const wrapped = wrapSandboxedDocument(page);
    assert.ok(wrapped.startsWith(HEAD), "the portal's own doctype and policy open the document");
    assert.ok(wrapped.indexOf("RTCPeerConnection") < wrapped.indexOf(page), "WebRTC is removed before the page runs");
    assert.ok(wrapped.indexOf(EXTERNAL_LINK_MESSAGE) < wrapped.indexOf(page), "the link guard is in place before the page runs");
    assert.ok(wrapped.endsWith(page), "the page's own bytes follow, unchanged");
});

test("shadow roots declared in markup are disarmed, and nothing else is touched", () => {
    for (const markup of [
        '<template shadowrootmode="closed">',
        "<template SHADOWROOTMODE=open>",
        "<template/shadowrootmode=open>",
        '<template x="1"shadowrootmode=open>',
        "<template\tshadowrootmode\n=closed>",
        "<template shadowrootmode>",
        '<template a="x>y" b=\'1\' shadowrootmode=closed>',
        '<template =x shadowrootmode="closed">',
        // A fake template in a comment or a script must not hide the real one.
        '<!-- <template x=" -->\n<div><template shadowrootmode=closed><p>x</p></template></div>',
        "<script>const t = '<template a=\"';</script><template shadowrootmode=open></template>",
    ]) {
        const wrapped = disarmDeclaredShadowRoots(markup);
        assert.ok(!/(^|[\s"'/])shadowrootmode(?=[\s=/>]|$)/i.test(wrapped), markup);
        assert.ok(/data-blocked-shadowrootmode/i.test(wrapped), markup);
    }
    for (const untouched of [
        "<script>const root = host.shadowRoot; const mode = tpl.shadowRootMode; if (r instanceof ShadowRoot) {}</script>",
        '<script>const shadowRootMode = "open"; let shadowrootmode = 1;</script>',
        "<style>.shadowrootmode { color: red }</style><p>Set shadowrootmode = open on a template.</p>",
        '<div shadowrootmode="closed"></div><templatex shadowrootmode=open></templatex>',
        '<template title="a > shadowrootmode=open"></template>',
        // The tokenizer reads "d/shadowrootmode=open" as c's unquoted value.
        "<template c=d/shadowrootmode=open></template>",
    ]) {
        assert.equal(disarmDeclaredShadowRoots(untouched), untouched, untouched);
    }
});

test("no prolog the page writes can come ahead of the policy", () => {
    // Inputs where a regex and the HTML parser disagree about where a comment
    // or doctype ends; none may be copied in front of the policy.
    const prologs = [
        '<!--><script>document.write("<plaintext>")</script><!--x--><!doctype html><p>x</p>',
        '<!doctype html "a>b"><script>1</script>',
        '\u000c<!doctype html><script>1</script>',
        '<!-- a --><!-- b --><!DOCTYPE html><script>1</script>',
    ];
    for (const page of prologs) {
        const wrapped = wrapSandboxedDocument(page);
        assert.ok(wrapped.startsWith(HEAD), JSON.stringify(page).slice(0, 40));
        assert.ok(wrapped.endsWith(page));
    }
});

test("a leading byte-order mark is dropped, not left in front of the policy", () => {
    const wrapped = wrapSandboxedDocument("\uFEFF<!doctype html><p>x</p>");
    assert.ok(wrapped.startsWith(HEAD));
    assert.ok(!wrapped.includes("\uFEFF"));
});

test("only dashboard tiles get the panel-key bridge", () => {
    assert.ok(!wrapSandboxedDocument("<p>x</p>").includes("moa-panel-key"));
    assert.ok(wrapSandboxedDocument("<p>x</p>", { panelKeys: true }).includes("moa-panel-key"));
});

test("only web links can be opened, and never with a user name in them", () => {
    assert.equal(normalizeExternalLink("https://example.com/a?b=1"), "https://example.com/a?b=1");
    assert.equal(normalizeExternalLink("http://example.com"), "http://example.com/");
    assert.equal(normalizeExternalLink("https://bücher.example/"), "https://xn--bcher-kva.example/", "international names show as punycode");
    for (const bad of [
        "https://trusted.example@attacker.example/", "https://user:pass@example.com/",
        "mailto:ops@example.com", "javascript:alert(1)", "data:text/html,hi", "blob:https://x/1",
        "file:///etc/passwd", "not a url", "", null, 42, `https://e.com/${"x".repeat(5000)}`,
    ]) {
        assert.equal(normalizeExternalLink(bad), null, String(bad).slice(0, 40));
    }
});

test("no host keeps an escaping popup or loads a document without the wrapper", () => {
    const sources = [read("../../ui/react/src/web-app.js"), read("../src/App.jsx")].join("\n");
    assert.ok(!sources.includes("allow-popups"), "no frame may open popups, let alone escape the sandbox");
    assert.ok(!/sandbox:\s*"/.test(sources), "every frame takes SANDBOXED_FRAME_SANDBOX");
    assert.ok(!sources.includes("CANVAS_LINK_GUARD"), "the old guard that opened links directly is gone");
    assert.ok(!/\bsrc:\s*(?:frame\.url|frameUrl|doc\.url)/.test(sources), "sandboxed documents load through srcDoc, never a blob: src");
    assert.equal((sources.match(/srcDoc:/g) || []).length, 3, "canvas, artifact preview and share viewer");
});

test("the shell headers carry the frame policy and turn DNS prefetching off", () => {
    assert.deepEqual({ ...PORTAL_SHELL_HEADERS }, {
        "Content-Security-Policy": PORTAL_FRAME_POLICY,
        "X-DNS-Prefetch-Control": "off",
    });
    assert.match(read("../server.js"), /res\.set\(PORTAL_SHELL_HEADERS\)/, "the SPA fallback sends them");
    assert.match(read("../vite.config.ts"), /\.\.\.PORTAL_SHELL_HEADERS/, "so does `npm run web:dev`");
});

test("every way of reaching the shell gets the headers, /index.html included", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ps-shell-"));
    fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><p>portal</p>");
    fs.writeFileSync(path.join(dir, "app.js"), "1");
    const app = express();
    app.use(express.static(dir, portalStaticOptions));
    const server = http.createServer(app).listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const get = (p) => new Promise((resolve, reject) => http.get({ host: "127.0.0.1", port: server.address().port, path: p }, (res) => { res.resume(); resolve(res); }).on("error", reject));
    try {
        const html = await get("/index.html");
        assert.equal(html.statusCode, 200);
        assert.equal(html.headers["content-security-policy"], PORTAL_FRAME_POLICY);
        assert.equal(html.headers["x-dns-prefetch-control"], "off");
        const script = await get("/app.js");
        assert.equal(script.headers["content-security-policy"], undefined, "only HTML documents need it");
    } finally {
        server.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
