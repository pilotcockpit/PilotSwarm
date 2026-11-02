#!/usr/bin/env node
// Read-only HTTP checks for an explicitly supplied frontend origin. No API calls.
import assert from "node:assert/strict";
import { NO_INDEX, SITE_TITLE } from "../src/lib/page-metadata.ts";

const target = new URL(process.argv[2]);
assert.equal(target.pathname, "/", "Supply an origin, not a workspace URL");
assert.ok(!target.username && !target.password && !target.search && !target.hash);
const records = [];
for (const path of ["/", "/projects", "/sessions", "/s/PRIVATE?view=activity&activity=logs", "/boards?board=PRIVATE", "/outputs?tab=files&q=PRIVATE", "/library?tab=packages", "/providers?provider=PRIVATE", "/admin?tab=audit", "/settings?tab=profile", "/unknown-PRIVATE", "/index.html"]) {
  const response = await fetch(new URL(path, target), { redirect: "follow" });
  const html = await response.text();
  assert.equal(response.status, 200, path);
  assert.equal(response.headers.get("x-robots-tag"), NO_INDEX, path);
  assert.ok(html.includes(`<title>${SITE_TITLE}</title>`), path);
  assert.ok(html.includes(`name="robots" content="${NO_INDEX}"`), path);
  assert.ok(html.includes('property="og:image"'), path);
  assert.ok(!html.includes("PRIVATE"), "Request values leaked into HTML");
  records.push({ path, status: response.status, robots: response.headers.get("x-robots-tag"), initialTitle: SITE_TITLE });
}
for (const path of ["/robots.txt", "/site.webmanifest", "/favicon.svg", "/favicon.ico", "/apple-touch-icon.png", "/icons/icon-maskable-512.png", "/social/og-default.png", "/social/twitter-card.png"]) {
  const response = await fetch(new URL(path, target));
  assert.equal(response.status, 200, path);
  assert.equal(response.headers.get("x-robots-tag"), NO_INDEX, path);
  assert.ok(!(response.headers.get("content-type") || "").includes("text/html"), `SPA fallback swallowed ${path}`);
  records.push({ path, status: response.status, contentType: response.headers.get("content-type"), bytes: (await response.arrayBuffer()).byteLength });
}
console.log(JSON.stringify({ origin: target.origin, checkedAt: new Date().toISOString(), records }, null, 2));
