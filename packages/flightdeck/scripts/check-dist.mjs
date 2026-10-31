#!/usr/bin/env node
// The production build must not contain the end-to-end test hooks (window.__fdDemo and the demo
// helpers behind it). They exist only on the dev server with the demo source. Run after `vite build`.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist", import.meta.url));
const FORBIDDEN = ["__fdDemo", "writeBehind", "bumpRevision", "clearCalls", "failOps", "clearFailures"];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(js|mjs|html|css|map)$/.test(name)) yield p;
  }
}

if (!existsSync(dist)) {
  console.error("check-dist: no dist/ folder. Run `npm run build` first.");
  process.exit(2);
}
const hits = [];
for (const file of walk(dist)) {
  const text = readFileSync(file, "utf8");
  for (const word of FORBIDDEN) if (text.includes(word)) hits.push(`${file.slice(dist.length + 1)} contains "${word}"`);
}
if (hits.length) {
  console.error(`check-dist: the production build contains test-only code:\n  ${hits.join("\n  ")}`);
  process.exit(1);
}
console.log("check-dist: clean (no demo test hooks in dist)");
