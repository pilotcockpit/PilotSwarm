// The checker that keeps test-only code out of the production build, tested on a fake dist.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function run(files) {
  const root = mkdtempSync(join(tmpdir(), "fd-dist-"));
  try {
    mkdirSync(join(root, "scripts"));
    cpSync(join(here, "check-dist.mjs"), join(root, "scripts", "check-dist.mjs"));
    mkdirSync(join(root, "dist", "assets"), { recursive: true });
    for (const [name, text] of Object.entries(files)) writeFileSync(join(root, "dist", name), text);
    return spawnSync(process.execPath, [join(root, "scripts", "check-dist.mjs")], { encoding: "utf8" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("a clean production bundle passes", () => {
  const r = run({ "assets/index.js": "console.log('hello')", "index.html": "<div id=root></div>" });
  assert.equal(r.status, 0, r.stderr);
});

for (const word of ["__fdDemo", "writeBehind", "bumpRevision", "clearCalls", "failOps", "clearFailures"]) {
  test(`a bundle containing ${word} fails`, () => {
    const r = run({ "assets/index.js": `window.${word}=1` });
    assert.equal(r.status, 1);
    assert.match(r.stderr, new RegExp(word));
  });
}

test("a missing dist folder is an error, not a pass", () => {
  const root = mkdtempSync(join(tmpdir(), "fd-nodist-"));
  try {
    mkdirSync(join(root, "scripts"));
    cpSync(join(here, "check-dist.mjs"), join(root, "scripts", "check-dist.mjs"));
    const r = spawnSync(process.execPath, [join(root, "scripts", "check-dist.mjs")], { encoding: "utf8" });
    assert.equal(r.status, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
