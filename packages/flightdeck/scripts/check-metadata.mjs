#!/usr/bin/env node
// Validate the deployed artifact, not only source tags. No network/provider calls.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { NO_INDEX, SITE_TITLE } from "../src/lib/page-metadata.ts";
import { PORTAL_SHELL_HEADERS } from "../../app/ui/react/src/sandboxed-document.js";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "../..");
const dist = resolve(app, "dist");
const read = (file) => readFileSync(resolve(dist, file));
const html = read("index.html").toString();
assert.match(html, /<html lang="en">/);
assert.equal((html.match(/<title>/g) || []).length, 1);
assert.ok(html.includes(`<title>${SITE_TITLE}</title>`));
assert.ok(html.includes(`name="robots" content="${NO_INDEX}"`));
assert.ok(html.includes(`name="googlebot" content="${NO_INDEX}"`));
for (const key of ["og:type", "og:title", "og:description", "og:image", "og:image:width", "og:image:height", "og:image:alt"]) assert.equal((html.match(new RegExp(`property="${key}"`, "g")) || []).length, 1, key);
for (const key of ["description", "twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt", "theme-color", "application-name"]) assert.equal((html.match(new RegExp(`<meta\\s+name="${key}"`, "g")) || []).length, 1, key);
for (const [, url] of html.matchAll(/(?:href|content)="([^" ]+\.(?:svg|png|ico|webmanifest))"/g)) {
  const path = url.startsWith("https:") || url.startsWith("http:") ? new URL(url).pathname : url;
  assert.ok(existsSync(resolve(dist, `.${path}`)), `Missing metadata asset ${path}`);
}
const expected = { "favicon-16x16.png": [16, 16], "favicon-32x32.png": [32, 32], "favicon-48x48.png": [48, 48], "apple-touch-icon.png": [180, 180], "icons/icon-192.png": [192, 192], "icons/icon-512.png": [512, 512], "icons/icon-maskable-512.png": [512, 512], "social/og-default.png": [1200, 630], "social/og-dark.png": [1200, 630], "social/twitter-card.png": [1200, 600] };
for (const [path, dimensions] of Object.entries(expected)) {
  const data = read(path);
  assert.equal(data.subarray(1, 4).toString(), "PNG", path);
  assert.deepEqual([data.readUInt32BE(16), data.readUInt32BE(20)], dimensions, path);
}
const ico = read("favicon.ico");
assert.equal(ico.readUInt16LE(2), 1);
assert.equal(ico.readUInt16LE(4), 4);
const manifest = JSON.parse(read("site.webmanifest"));
assert.equal(manifest.id, "/");
assert.equal(manifest.scope, "/");
assert.equal(manifest.start_url, "/");
assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
for (const icon of manifest.icons) assert.ok(existsSync(resolve(dist, `.${icon.src}`)), icon.src);
assert.ok(!existsSync(resolve(dist, "sitemap.xml")), "No-index workspace must not advertise a sitemap");
assert.match(read("robots.txt").toString(), /^Disallow:\s*$/m);
const headers = read("_headers").toString();
assert.ok(headers.includes(`X-Robots-Tag: ${NO_INDEX}`));
for (const [key, value] of Object.entries(PORTAL_SHELL_HEADERS)) assert.ok(headers.includes(`${key}: ${value}`), `Static host lost ${key}`);
assert.match(read("_redirects").toString(), /^\/\* \/index.html 200/m);
const vercel = JSON.parse(readFileSync(resolve(root, "vercel.json")));
const allHeaders = Object.fromEntries(vercel.headers.find((rule) => rule.source === "/(.*)").headers.map(({ key, value }) => [key, value]));
assert.equal(allHeaders["X-Robots-Tag"], NO_INDEX);
for (const [key, value] of Object.entries(PORTAL_SHELL_HEADERS)) assert.equal(allHeaders[key], value);
const assets = JSON.parse(readFileSync(resolve(root, "assets/brand/asset-manifest.json")));
for (const file of assets.files) assert.equal(createHash("sha256").update(readFileSync(resolve(root, file.path))).digest("hex"), file.sha256, file.path);
console.log(`check-metadata: noindex, static/social metadata, host headers, manifest and ${assets.files.length} brand assets verified`);
