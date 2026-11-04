import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeEntry, normalizeLockfile, normalizeFile } from "../normalize-npm-lockfile.mjs";

const sha1 = Buffer.alloc(20, 1);
const strong = "sha512-" + Buffer.alloc(64, 2).toString("base64");
const entry = { version: "1.2.3", resolved: "https://ms-feed-25.pkgs.visualstudio.com/1es-public/_packaging/npm-public/npm/registry/example/-/example-1.2.3.tgz", integrity: "sha1-" + sha1.toString("base64"), dev: true };
const metadata = { name: "example", version: "1.2.3", dist: { tarball: "https://registry.npmjs.org/example/-/example-1.2.3.tgz", shasum: sha1.toString("hex"), integrity: strong } };

test("normalization verifies the old digest and strengthens it without changing versions or flags", () => {
    const result = normalizeEntry(entry, metadata, "example");
    assert.deepEqual(result, { ...entry, resolved: metadata.dist.tarball, integrity: strong });
    assert.notEqual(entry.resolved, result.resolved);
});
test("an existing SHA-512 digest is preserved", () => {
    assert.equal(normalizeEntry({ ...entry, integrity: strong }, metadata, "example").integrity, strong);
});
for (const [name, patch, error] of [
    ["package substitution", { name: "other" }, /name mismatch/],
    ["version substitution", { version: "2.0.0" }, /version mismatch/],
    ["different artifact", { dist: { ...metadata.dist, shasum: "0".repeat(40) } }, /integrity does not match/],
    ["foreign tarball", { dist: { ...metadata.dist, tarball: "https://example.invalid/file.tgz" } }, /public npm registry/],
]) test(`refuses ${name}`, () => assert.throws(() => normalizeEntry(entry, { ...metadata, ...patch }, "example"), error));

test("refuses a URL whose package differs from its lockfile slot", async () => {
    let fetched = false;
    await assert.rejects(normalizeLockfile({ packages: { "node_modules/different": entry } }, async () => { fetched = true; return metadata; }), /lockfile slot/);
    assert.equal(fetched, false);
});
test("an explicit alias name identifies the actual package", async () => {
    const result = await normalizeLockfile({ packages: { "node_modules/alias": { ...entry, name: "example" } } }, async () => metadata);
    assert.equal(result.lock.packages["node_modules/alias"].resolved, metadata.dist.tarball);
});
test("package paths are decoded once, including scoped names", async () => {
    const scoped = { ...entry, resolved: entry.resolved.replace("/example/-/", "/%40scope%2Fexample/-/") };
    const result = await normalizeLockfile({ packages: { "node_modules/@scope/example": scoped } }, async () => ({ ...metadata, name: "@scope/example" }));
    assert.equal(result.normalized, 1);
    await assert.rejects(normalizeLockfile({ packages: { "node_modules/@scope/example": { ...scoped, resolved: scoped.resolved.replace("%40", "%2540") } } }, async () => metadata), /public npm mirror paths/);
});

test("non-mirror dependencies and the input document are left untouched", async () => {
    const other = { version: "9", resolved: "https://registry.npmjs.org/other/-/other-9.tgz", integrity: strong };
    const input = { lockfileVersion: 3, packages: { "node_modules/example": entry, "node_modules/other": other, "node_modules/local": { link: true, resolved: "packages/local" } } };
    const before = structuredClone(input);
    const result = await normalizeLockfile(input, async (name, version) => { assert.equal(name, "example"); assert.equal(version, "1.2.3"); return metadata; });
    assert.equal(result.normalized, 1);
    assert.equal(result.strengthened, 1);
    assert.deepEqual(input, before);
    assert.deepEqual(result.lock.packages["node_modules/other"], other);
});
test("a concurrently edited lockfile survives registry verification", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ps-lockfile-"));
    const filename = join(dir, "package-lock.json");
    const input = { packages: { "node_modules/example": entry } };
    try {
        await writeFile(filename, JSON.stringify(input));
        await assert.rejects(normalizeFile(filename, async () => {
            await writeFile(filename, "newer user draft");
            return metadata;
        }), /changed during verification/);
        assert.equal(await readFile(filename, "utf8"), "newer user draft");
    } finally { await rm(dir, { recursive: true, force: true }); }
});
