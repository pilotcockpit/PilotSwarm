#!/usr/bin/env node
// Replace public Microsoft npm mirrors without changing package versions.
import assert from "node:assert/strict";
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";

const mirrorHost = /^ms-feed-\d+\.pkgs\.visualstudio\.com$/;
const registry = "https://registry.npmjs.org";

function packageName(entry) {
    const source = new URL(entry.resolved);
    assert.equal(source.protocol, "https:");
    assert.ok(mirrorHost.test(source.hostname) && !source.username && !source.password && !source.search && !source.hash);
    const match = decodeURIComponent(source.pathname).match(/^\/1es-public\/_packaging\/npm-public\/npm\/registry\/((?:@[^/]+\/)?[^/]+)\/-\/[^/]+\.tgz$/);
    assert.ok(match, "Only public npm mirror paths are supported");
    return match[1];
}

export function normalizeEntry(entry, metadata, expectedName) {
    const name = packageName(entry);
    assert.equal(name, expectedName, "Mirror package does not match the lockfile slot");
    assert.equal(metadata.name, name, "Registry package name mismatch");
    assert.equal(metadata.version, entry.version, "Registry version mismatch");
    const target = new URL(metadata.dist.tarball);
    assert.ok(target.origin === registry && !target.username && !target.password && !target.search && !target.hash, "Tarball must use the public npm registry");
    const digests = String(metadata.dist.integrity || "").split(/\s+/);
    const old = String(entry.integrity || "").split(/\s+/);
    assert.ok(old.some(digest => {
        if (digests.includes(digest)) return true;
        if (!digest.startsWith("sha1-")) return false;
        const bytes = Buffer.from(digest.slice(5), "base64");
        return bytes.length === 20 && bytes.toString("hex") === metadata.dist.shasum;
    }), `Existing integrity does not match registry metadata for ${name}`);
    const integrity = digests.find(digest => /^sha512-[A-Za-z0-9+/]+={0,2}$/.test(digest) && Buffer.from(digest.slice(7), "base64").length === 64);
    assert.ok(integrity, `Missing SHA-512 integrity for ${name}`);
    return { ...entry, resolved: target.href, integrity };
}

async function registryMetadata(name, version) {
    const response = await fetch(`${registry}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`, { signal: AbortSignal.timeout(15_000) });
    assert.equal(response.status, 200, `Cannot verify ${name}@${version}`);
    return response.json();
}

export async function normalizeLockfile(input, fetchMetadata = registryMetadata) {
    const lock = structuredClone(input);
    const entries = Object.entries(lock.packages).filter(([, entry]) => {
        try { return mirrorHost.test(new URL(entry.resolved).hostname); }
        catch { return false; } // Workspace links have no remote URL.
    });
    let next = 0;
    let strengthened = 0;
    await Promise.all(Array.from({ length: Math.min(8, entries.length) }, async () => {
        while (next < entries.length) {
            const [path, entry] = entries[next++];
            const slotStart = path.lastIndexOf("node_modules/");
            assert.ok(slotStart >= 0, "Mirror entry must have a node_modules slot");
            const expectedName = entry.name ?? path.slice(slotStart + "node_modules/".length);
            const name = packageName(entry);
            assert.equal(name, expectedName, "Mirror package does not match the lockfile slot");
            const metadata = await fetchMetadata(name, entry.version);
            const normalized = normalizeEntry(entry, metadata, expectedName);
            if (entry.integrity !== normalized.integrity) strengthened++;
            lock.packages[path] = normalized;
        }
    }));
    return { lock, normalized: entries.length, strengthened };
}

export async function normalizeFile(filename, fetchMetadata = registryMetadata) {
    const original = await readFile(filename, "utf8");
    const result = await normalizeLockfile(JSON.parse(original), fetchMetadata);
    if (!result.normalized) return result;
    // Preserve another session's edits made while registry checks were running.
    const temporary = `${filename}.normalizing-${process.pid}-${randomUUID()}`;
    try {
        await writeFile(temporary, JSON.stringify(result.lock, null, 2) + "\n", { flag: "wx" });
        assert.equal(await readFile(filename, "utf8"), original, "Lockfile changed during verification; keeping the newer file");
        await rename(temporary, filename);
    } finally { await rm(temporary, { force: true }); }
    return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const filename = resolve(process.argv[2] || fileURLToPath(new URL("../package-lock.json", import.meta.url)));
    const result = await normalizeFile(filename);
    console.log(`Lockfile: normalized ${result.normalized} public mirror URLs; strengthened ${result.strengthened} integrities to SHA-512; versions unchanged.`);
}
