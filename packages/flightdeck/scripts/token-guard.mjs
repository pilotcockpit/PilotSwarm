#!/usr/bin/env node
// Flight Deck token guard. Components read semantic tokens (src/styles.css) and nothing else.
//
//   npm run tokens:check               fail on violations
//   npm run tokens:check -- --update   re-baseline the arbitrary-value ratchet (review the diff!)
//
// Hard rules (zero tolerance). To except one line, put a real comment on it: `// token-ok: <reason>`
// (or `/* token-ok: <reason> */`). Comments are parsed with the TypeScript scanner, so the words
// inside a string or attribute never count, and a bare "token-ok" with no reason does not either.
//   1. no raw colour: hex, rgb(), hsl(), oklch(), color-mix() in TS/TSX
//   2. no colour escapes in class names: bg-[#fff], bg-[red], bg-white, text-red-500, border-x-red-500 ...
//   3. no arbitrary font sizes at all: text-[13px], text-[length:0.5rem], text-[clamp(...)]; use the type scale
//   4. no arbitrary CSS properties: [font-size:10px], [background:red], hover:[color:#fff]. Allowed
//      by design: arbitrary variants ([&_svg]:size-4, [&>div]:p-2) and custom properties ([--row:30px]),
//      because neither can set a value that bypasses a token.
// Ratchet: arbitrary size values like h-[26px] are counted per file against
// scripts/token-guard.baseline.json. The count may not rise, and may not silently fall either:
// when you remove some, re-run with --update and commit the lower baseline.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const baselinePath = join(root, "scripts", "token-guard.baseline.json");
// Fixture data and agent-drawn canvases are content, not UI chrome.
const skip = [/^src\/data\//, /^src\/canvas\/demo-canvases\.ts$/, /\.d\.ts$/];

const PALETTE = "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|white|black";
const COLOR_PROPS = "bg|text|border(?:-[xytblrse])?|ring|fill|stroke|from|to|via|outline|divide|decoration|accent|caret|placeholder";
// Arbitrary values that are not colours: lengths, calc, var(), url(), explicit type hints.
const NON_COLOUR_ARB = /^(?:var\(|color:var\(|calc\(|url\(|length:|percentage:|position:|image:|size:|-?\.?\d)/;

/** Drop anchors like href="#feed" and URL hashes so they are not read as hex colours. */
const stripAnchors = (line) => line.replace(/(?:href|to|hash|id|aria-controls|htmlFor)\s*[=:]\s*[{"'`]+#[\w-]*/g, "").replace(/["'`]#[a-z][\w-]*["'`]/g, (m) => (/^["'`]#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})["'`]$/i.test(m) ? m : '""'));

const rules = [
  { id: "raw-colour", test: (l) => /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/.test(stripAnchors(l)), msg: "raw colour; use a semantic token from styles.css" },
  {
    id: "colour-escape",
    test: (l) => {
      for (const m of l.matchAll(new RegExp(`(?<![\\w-])(?:${COLOR_PROPS})-\\[([^\\]]+)\\]`, "g"))) if (!NON_COLOUR_ARB.test(m[1])) return true;
      return false;
    },
    msg: "arbitrary colour in a class",
  },
  { id: "palette-class", test: (l) => new RegExp(`(?<![\\w-])(?:${COLOR_PROPS})-(?:${PALETTE})(?:-\\d{2,3})?(?:/\\d+)?(?![\\w-])`).test(l), msg: "Tailwind default palette; use a semantic token (bg-surface, text-muted, text-failed ...)" },
  {
    id: "arbitrary-property",
    // [prop:value] at the start of a class or after a variant colon. `[&...]` variants and `[--x:y]` are fine.
    test: (l) => /(?:^|[\s"'`:{])\[(?!&|--)[a-zA-Z][a-zA-Z-]*:[^\]]+\]/.test(l),
    msg: "arbitrary CSS property in a class; use a utility or add a token",
  },
  { id: "arbitrary-font-size", test: (l) => /(?<![\w-])text-\[(?:length:|size:|-?\.?\d|calc\(|clamp\(|min\(|max\()/.test(l), msg: "arbitrary font size; use the type scale (text-xs ... text-xl)" },
];
const arbitrary = /(?<![\w-])(?:size|[hw]|min-[hw]|max-[hw]|p[xytblr]?|m[xytblr]?|gap(?:-[xy])?|top|left|right|bottom|inset(?:-[xy])?|rounded|text|leading|translate-[xy])-\[-?\d*\.?\d+(?:px|rem|em)\]/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if ([".ts", ".tsx"].includes(extname(p))) yield p;
  }
}

/** Real comments by line, found with the TypeScript scanner, plus the source with comments blanked. */
function parseComments(text) {
  const sf = ts.createSourceFile("x.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const seen = new Set();
  const byLine = new Map();
  let code = text;
  const add = (ranges) => {
    for (const r of ranges || []) {
      if (seen.has(r.pos)) continue;
      seen.add(r.pos);
      const line = sf.getLineAndCharacterOfPosition(r.pos).line;
      byLine.set(line, [...(byLine.get(line) || []), text.slice(r.pos, r.end)]);
      code = code.slice(0, r.pos) + text.slice(r.pos, r.end).replace(/[^\n]/g, " ") + code.slice(r.end);
    }
  };
  const visit = (node) => {
    // JSX text is prose: a "//" in it is not a comment.
    if (node.kind !== ts.SyntaxKind.JsxText) add(ts.getLeadingCommentRanges(text, node.pos));
    add(ts.getTrailingCommentRanges(text, node.end));
    for (const c of node.getChildren(sf)) visit(c);
  };
  visit(sf);
  return { byLine, code };
}

/** Violations and the arbitrary-value count for one file's source. Exported for tests. */
export function checkSource(rel, text) {
  const violations = [];
  let count = 0;
  const { byLine, code } = parseComments(text);
  code.split("\n").forEach((line, i) => {
    const comments = byLine.get(i) || [];
    // Strip the comment delimiters first: `/* token-ok: */` has no reason.
    const bare = comments.map((c) => c.replace(/^\s*(?:\/\/+|\/\*+)/, "").replace(/\*+\/\s*$/, "").trim());
    const reasoned = bare.some((c) => /token-ok:\s*\S+/.test(c));
    if (comments.some((c) => /token-ok/.test(c)) && !reasoned) violations.push(`${rel}:${i + 1}  [bad-exception] token-ok needs a reason: // token-ok: <why>`);
    if (!reasoned) for (const r of rules) if (r.test(line)) violations.push(`${rel}:${i + 1}  [${r.id}] ${r.msg}\n    ${line.trim().slice(0, 140)}`);
    const m = line.match(arbitrary);
    if (m) count += m.length;
  });
  return { violations, count };
}

function main() {
  const violations = [];
  const counts = {};
  for (const file of walk(src)) {
    const rel = relative(root, file).split("\\").join("/");
    if (skip.some((r) => r.test(rel))) continue;
    const r = checkSource(rel, readFileSync(file, "utf8"));
    violations.push(...r.violations);
    if (r.count) counts[rel] = r.count;
  }

  if (process.argv.includes("--update")) {
    writeFileSync(baselinePath, JSON.stringify(Object.fromEntries(Object.entries(counts).sort()), null, 2) + "\n");
    console.log(`token-guard: baseline written (${Object.values(counts).reduce((a, b) => a + b, 0)} arbitrary values in ${Object.keys(counts).length} files)`);
  } else {
    const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
    for (const file of new Set([...Object.keys(counts), ...Object.keys(baseline)])) {
      const n = counts[file] || 0;
      const allowed = baseline[file] || 0;
      if (n > allowed) violations.push(`${file}  [arbitrary-value] ${n} arbitrary size values, baseline allows ${allowed}. Add a token or use a scale step instead.`);
      else if (n < allowed) violations.push(`${file}  [stale-baseline] ${n} arbitrary size values, baseline still allows ${allowed}. Lock in the reduction: npm run tokens:check -- --update`);
    }
  }

  if (violations.length) {
    console.error(`token-guard: ${violations.length} violation${violations.length === 1 ? "" : "s"}\n\n${violations.join("\n")}\n`);
    process.exit(1);
  }
  console.log("token-guard: clean");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
