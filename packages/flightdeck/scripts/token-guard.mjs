#!/usr/bin/env node
// Flight Deck token guard. Components read semantic tokens (src/styles.css) and nothing else.
//
//   npm run tokens:check            fail on violations
//   npm run tokens:check -- --update   re-baseline the arbitrary-value ratchet (review the diff!)
//
// Hard rules (zero tolerance; add `token-ok: <reason>` on the line to except one):
//   1. no raw colour: hex, rgb(), hsl(), oklch(), color-mix() in TS/TSX
//   2. no colour escapes in class names: bg-[#fff], text-[rgb(...)], bg-white, text-red-500 ...
//   3. no text under 12px
// Ratchet (may only go down): arbitrary size values like h-[26px] or w-[240px]. New ones mean
// a token or a layout primitive is missing; promote the value in styles.css instead.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const baselinePath = join(root, "scripts", "token-guard.baseline.json");
// Fixture data and agent-drawn canvases are content, not UI chrome.
const skip = [/^src\/data\//, /^src\/canvas\/demo-canvases\.ts$/, /\.d\.ts$/];

const PALETTE = "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|white|black";
const COLOR_PROPS = "bg|text|border|ring|fill|stroke|from|to|via|shadow|outline|divide|decoration|accent|caret";
const rules = [
  { id: "raw-colour", re: /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/, msg: "raw colour; use a semantic token from styles.css" },
  { id: "colour-escape", re: new RegExp(`\\b(?:${COLOR_PROPS})-\\[(?:#|rgb|hsl|oklch|color-mix)`), msg: "arbitrary colour in a class" },
  { id: "palette-class", re: new RegExp(`\\b(?:${COLOR_PROPS})-(?:${PALETTE})(?:-\\d{2,3})?(?:/\\d+)?(?![\\w-])`), msg: "Tailwind default palette; use a semantic token (bg-surface, text-muted, text-failed ...)" },
  { id: "tiny-text", re: /\btext-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/, msg: "text under 12px; use text-xs" },
];
const arbitrary = /\b(?:size|[hw]|min-[hw]|max-[hw]|p[xytblr]?|m[xytblr]?|gap(?:-[xy])?|top|left|right|bottom|inset(?:-[xy])?|rounded|text|leading|translate-[xy])-\[-?\d*\.?\d+(?:px|rem|em)\]/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if ([".ts", ".tsx"].includes(extname(p))) yield p;
  }
}

const violations = [];
const counts = {};
for (const file of walk(src)) {
  const rel = relative(root, file).split("\\").join("/");
  if (skip.some((r) => r.test(rel))) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (/token-ok/.test(line)) return;
    for (const r of rules) if (r.re.test(line)) violations.push(`${rel}:${i + 1}  [${r.id}] ${r.msg}\n    ${line.trim().slice(0, 140)}`);
    const m = line.match(arbitrary);
    if (m) counts[rel] = (counts[rel] || 0) + m.length;
  });
}

if (process.argv.includes("--update")) {
  writeFileSync(baselinePath, JSON.stringify(Object.fromEntries(Object.entries(counts).sort()), null, 2) + "\n");
  console.log(`token-guard: baseline written (${Object.values(counts).reduce((a, b) => a + b, 0)} arbitrary values in ${Object.keys(counts).length} files)`);
} else {
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
  for (const [file, n] of Object.entries(counts)) {
    const allowed = baseline[file] || 0;
    if (n > allowed) violations.push(`${file}  [arbitrary-value] ${n} arbitrary size values, baseline allows ${allowed}. Add a token or use a scale step instead.`);
  }
}

if (violations.length) {
  console.error(`token-guard: ${violations.length} violation${violations.length === 1 ? "" : "s"}\n\n${violations.join("\n")}\n`);
  process.exit(1);
}
console.log("token-guard: clean");
