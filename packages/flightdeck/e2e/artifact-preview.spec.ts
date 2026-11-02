import { expect, test, type Page } from "@playwright/test";
import { demoCalls, expectNoSeriousAxe, gotoDemo, Sheet, shot, watchConsole } from "./helpers";

// The Outputs page previews agent-authored documents inline, and its cards open them in the inspector. Agent output is untrusted: this spec runs HOSTILE
// documents through the REAL sanitiser and the REAL sandboxed frames in a real browser, and checks that
// nothing navigates and no request leaves the sandbox. It also checks that an oversized document is never
// downloaded, and that an unknown-size document is read with a bound.

const CARD_BYTES = 512 * 1024;
const INSPECTOR_BYTES = 1024 * 1024;

const HOSTILE = `<!doctype html><html><head><title>Hostile fixture</title>
<meta http-equiv="refresh" content="0;url=/api/v1/sessions/x/artifacts/refresh.txt/download">
<base href="/api/v1/sessions/other/">
<style>@import url("/api/v1/sessions/x/artifacts/css.txt/download"); body{font:16px sans-serif}</style></head>
<body><h1>Hostile fixture</h1>
<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=" usemap="#m" width="300" height="120" alt="map" id="mapimg">
<map name="m"><area shape="rect" coords="0,0,300,120" href="/api/v1/sessions/other/artifacts/secret.txt/download" alt="area"></map>
<form action="/api/v1/sessions/other/messages" method="post"><button id="send" formaction="/api/v1/sessions/x/messages">Send</button><input name="q" autofocus></form>
<a id="link" href="/api/v1/sessions/other/artifacts/secret.txt/download" target="_blank">plain link</a>
<svg width="120" height="30"><a id="svglink" href="/api/v1/sessions/x/artifacts/svg.txt/download"><text x="0" y="20">svg link</text></a>
<defs><circle id="i" r="4"/></defs><use href="#i" x="10" y="10"/></svg>
<iframe src="/api/v1/sessions/other/artifacts/frame.html/download"></iframe><object data="/api/v1/sessions/other/o"></object><embed src="/api/v1/sessions/other/e">
<p id="marker">Hostile content rendered</p></body></html>`;

const PAYLOADS: Record<string, string> = {
  "image map": '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" usemap="#m"><map name="m"><area href="/api/x" shape="rect" coords="0,0,9,9"></map>',
  "form": '<form action="/api/x"><button formaction="/api/y">go</button></form>',
  "meta refresh": '<meta http-equiv="refresh" content="0;url=/api/x"><p>x</p>',
  "base": '<base href="/api/x/"><a href="relative">x</a>',
  "link": '<a href="/api/x" target="_blank" ping="/api/ping">x</a><a xlink:href="/api/y">y</a>',
  "svg link and SMIL": '<svg><a href="/api/x"><text>x</text></a><a><animate attributeName="href" to="/api/z" begin="0s"/><set attributeName="href" to="/api/z"/></a></svg>',
  "frames": '<iframe src="/api/x"></iframe><frame src="/api/x"><object data="/api/x"></object><embed src="/api/x">',
  "script": '<script>parent.location="/api/x"</script><img src=x onerror="parent.location=1">',
  "javascript url": '<a href="javascript:alert(1)">x</a>',
  "srcdoc": '<div srcdoc="<p>x</p>" contenteditable tabindex="0" autofocus>x</div>',
};

async function publish(page: Page, doc: { filename: string; content: string; size?: number | null; padKb?: number }) {
  await page.evaluate(({ filename, content, size, padKb }) => {
    const h = (window as any).__fdDemo;
    const pad = padKb ? `<!--${"x".repeat(padKb * 1024)}-->` : "";
    h.artifacts.publishArtifact("a1f0c2d4-0001-4c00-9000-000000000001", { filename, content: content + pad, ...(size === undefined ? {} : { size }) });
    return h.invalidate(["artifacts"]);
  }, doc);
}
/** Wait until a click at the middle of `frame` would land on it (not on the page behind a dialog still settling). */
async function untilHittable(page: Page, frame: import("@playwright/test").Locator) {
  await expect.poll(async () => {
    const box = await frame.boundingBox();
    if (!box) return "none";
    return page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName ?? "none", [box.x + box.width / 2, box.y + box.height / 2]);
  }).toBe("IFRAME");
}
/** The card for the document the test just published: Outputs lists newest first. */
const cardOf = (page: Page) => page.getByRole("article").first();
/** The Outputs page, where each canvas is a card with a preview and an Inspect button. */
const outputs = (page: Page, info: import("@playwright/test").TestInfo) => gotoDemo(page, "/outputs?tab=canvases", info);
const reads = async (page: Page, filename: string) => (await demoCalls(page)).filter((c) => (c.op === "readArtifactPreview" || c.op === "readArtifact") && c.params?.filename === filename);

test("a hostile canvas renders as reading-only: nothing navigates, nothing leaves the sandbox", async ({ page }, info) => {
  const errors = watchConsole(page);
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await outputs(page, info);
  await publish(page, { filename: "canvas3.html", content: HOSTILE });
  const inspect = page.getByRole("button", { name: "Inspect Hostile fixture" });
  await expect(inspect).toBeEnabled();
  const sheet = await Sheet.open(page, inspect, /Hostile fixture/);
  const frameEl = await sheet.dialog.locator("iframe").elementHandle();
  const frame = (await frameEl!.contentFrame())!;
  await expect(frame.locator("#marker")).toHaveText("Hostile content rendered");

  // Sanitised: nothing in the document can navigate, submit, or load a frame.
  for (const sel of ["area", "map", "form", 'meta[http-equiv="refresh"]', "base", "[usemap]", "a[href]", "[formaction]", "iframe", "frame", "object", "embed", "script", "[srcdoc]", "[ping]", "animate", "set"]) {
    expect(await frame.locator(sel).count(), `sanitised document must have no ${sel}`).toBe(0);
  }

  // The only http-equiv metas are the shared wrapper's own (the CSP and the DNS-prefetch switch), not the agent's.
  expect(await frame.locator("meta[http-equiv]").evaluateAll((els) => els.map((e) => e.getAttribute("http-equiv")?.toLowerCase()))).toEqual(["content-security-policy", "x-dns-prefetch-control"]);

  // Try every way out: click the image where the map was, the links, the button. These are ordinary clicks
  // (no `force`): a forced click skips the wait for the frame to stop moving, can land on the page behind
  // the dialog, and closes it, which would prove nothing about the document.
  const base = new URL(page.url()).origin;
  const before = requests.length;
  await untilHittable(page, sheet.dialog.locator("iframe"));
  await frame.locator("#mapimg").click({ position: { x: 40, y: 40 } });
  await frame.locator("#link").click({ timeout: 1500 }).catch(() => undefined);
  await frame.locator("#svglink").click({ timeout: 1500 }).catch(() => undefined);
  await frame.locator("#send").click({ timeout: 1500 }).catch(() => undefined);
  await page.waitForTimeout(700);
  expect(frame.url(), "the frame must never navigate away from its srcdoc").toBe("about:srcdoc");
  const sent = requests.filter((u) => /\/api\/v1\/sessions\/(other|x)\//.test(u) || /secret\.txt|refresh\.txt|css\.txt|svg\.txt/.test(u));
  expect(sent, "no request may reach another session's data").toEqual([]);
  const foreign = requests.slice(before).filter((u) => !u.startsWith("data:") && !u.startsWith("blob:") && new URL(u).origin !== base);
  expect(foreign).toEqual([]);

  await shot(page, info, "hostile-inspector");
  await expectNoSeriousAxe(page, sheet.dialog, "inspector dialog", info);
  // Focus is inside the sandboxed frame after the clicks, and Escape would go to that document, not the dialog.
  await sheet.dialog.getByRole("button", { name: "Back to your work" }).click();
  await expect(sheet.dialog).toBeHidden();
  // Playwright itself runs its locators inside the sandboxed frame, and the browser logs each one as a blocked
  // script ("allow-scripts" is deliberately not set). That is the test tool, not the app: leave it out.
  expect(errors.filter((e) => !/Blocked script execution in 'about:srcdoc'/.test(e)), "no console errors").toEqual([]);
});

test("the sanitiser itself, run on hostile payloads in a real DOM", async ({ page }, info) => {
  await gotoDemo(page, "/", info);
  const out: Record<string, string> = await page.evaluate(async (payloads) => {
    const m = await import(/* @vite-ignore */ "/src/components/artifact-preview.tsx");
    return Object.fromEntries(Object.entries(payloads).map(([k, v]) => [k, (m as any).sanitizeArtifactHtml(v as string)]));
  }, PAYLOADS);
  const banned = [/<area/i, /<map/i, /usemap/i, /<form/i, /formaction/i, /<meta/i, /<base/i, /<iframe/i, /<frame/i, /<object/i, /<embed/i, /<script/i, /onerror/i, /srcdoc/i, /javascript:/i, /\bping=/i, /<animate/i, /<set\b/i, /\bhref=/i, /contenteditable/i, /autofocus/i, /tabindex/i, /\btarget=/i];
  for (const [name, html] of Object.entries(out)) {
    for (const re of banned) expect(html, `${name}: ${re}`).not.toMatch(re);
  }
  // Reading content survives.
  const benign = await page.evaluate(async () => (await import(/* @vite-ignore */ "/src/components/artifact-preview.tsx") as any).sanitizeArtifactHtml('<h1>Title</h1><p>text <b>bold</b></p><table><tr><td>cell</td></tr></table><svg width="20" height="20"><circle cx="5" cy="5" r="4"/></svg>'));
  expect(benign).toContain("<h1>Title</h1>");
  expect(benign).toContain("<b>bold</b>");
  expect(benign).toContain("<td>cell</td>");
  expect(benign).toContain("<circle");
  // A document past the parse limit is not parsed at all.
  const big = await page.evaluate(async (limit) => {
    const m: any = await import(/* @vite-ignore */ "/src/components/artifact-preview.tsx");
    const t0 = performance.now();
    const html = m.sanitizeArtifactHtml("<p>x</p>".repeat(Math.ceil(limit / 8) + 10));
    return { html, ms: performance.now() - t0 };
  }, INSPECTOR_BYTES);
  expect(big.html).toContain("Too large to preview");
  expect(big.html.length).toBeLessThan(200);
});

test("a document whose metadata says it is too large is never downloaded", async ({ page }, info) => {
  await outputs(page, info);
  await publish(page, { filename: "canvas3.html", content: "<h1>Huge</h1>", size: 5 * 1024 * 1024 });
  const card = cardOf(page);
  await expect(card.getByText("Too large to preview")).toBeVisible();
  await expect(card.getByRole("button", { name: /Inspect/ })).toBeDisabled();
  await expect(card.getByRole("link", { name: /Open output/ })).toBeVisible();     // the real way in
  await page.waitForTimeout(400);
  expect(await reads(page, "canvas3.html")).toEqual([]);                           // not even a bounded read
  await shot(page, info, "too-large-card");
});

test("a mid-size document is read only when the inspector opens, with the inspector bound", async ({ page }, info) => {
  await outputs(page, info);
  await publish(page, { filename: "canvas3.html", content: "<h1>Mid</h1><p id='m'>mid-size body</p>", size: CARD_BYTES + 1000 });
  const card = cardOf(page);
  await expect(card.getByText("Large document. Inspect to read it.")).toBeVisible();
  await page.waitForTimeout(400);
  expect(await reads(page, "canvas3.html")).toEqual([]);                            // nothing before the person asks
  const sheet = await Sheet.open(page, card.getByRole("button", { name: /Inspect/ }));
  const frame = (await (await sheet.dialog.locator("iframe").elementHandle())!.contentFrame())!;
  await expect(frame.locator("#m")).toHaveText("mid-size body");
  const r = await reads(page, "canvas3.html");
  expect(r.map((c) => [c.op, c.params.maxBytes])).toEqual([["readArtifactPreview", INSPECTOR_BYTES]]);
  await sheet.close();
});

test("an unknown size is read with the card bound; a truncated read is never rendered as half a document", async ({ page }, info) => {
  await outputs(page, info);
  await publish(page, { filename: "canvas3.html", content: "<h1>Unknown</h1><p id='u'>unknown-size body</p>", size: null, padKb: 600 });
  const card = cardOf(page);
  await expect(card.getByText("Large document. Inspect to read it.")).toBeVisible();
  expect((await reads(page, "canvas3.html"))[0]).toMatchObject({ op: "readArtifactPreview", params: { maxBytes: CARD_BYTES } });
  const sheet = await Sheet.open(page, card.getByRole("button", { name: /Inspect/ }));
  const frame = (await (await sheet.dialog.locator("iframe").elementHandle())!.contentFrame())!;
  await expect(frame.locator("#u")).toHaveText("unknown-size body");               // it did fit the inspector
  await sheet.close();
});

test("a document bigger than the inspector limit says so, with a way to open it", async ({ page }, info) => {
  await outputs(page, info);
  await publish(page, { filename: "canvas3.html", content: "<h1>Big</h1>", size: null, padKb: 1200 });
  const card = cardOf(page);
  const sheet = await Sheet.open(page, card.getByRole("button", { name: /Inspect/ }));
  await expect(sheet.dialog.getByText(/too large to read here/i)).toBeVisible();
  expect(await sheet.dialog.locator("iframe").count()).toBe(0);                    // never half a document
  await expect(sheet.dialog.getByRole("link", { name: /Open output/ })).toBeVisible();
  await expectNoSeriousAxe(page, sheet.dialog, "too-large inspector", info);
  await shot(page, info, "too-large-inspector");
});
