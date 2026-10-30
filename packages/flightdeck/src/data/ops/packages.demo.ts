import { callDemoOp, registerDemoOps } from "./registry";

// Demo fixtures for agent packages: enough variety (shared and private copies, a disabled one, a copy
// that shadows a shared name, editors, a worker that lags) to exercise every flow without a backend.

const now = Date.now();
const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();
const me = { provider: "entra", subject: "sam", email: "sam.lee@contoso.com", displayName: "Sam Lee" };
const maya = { provider: "entra", subject: "maya", email: "maya.chen@contoso.com", displayName: "Maya Chen" };
const alex = { provider: "entra", subject: "alex", email: "alex.rivera@contoso.com", displayName: "Alex Rivera" };
const jordan = { provider: "entra", subject: "jordan", email: "jordan.kim@contoso.com", displayName: "Jordan Kim" };
const priya = { provider: "entra", subject: "priya", email: "priya.nair@contoso.com", displayName: "Priya Nair" };
const users = [me, maya, alex, jordan, priya, { provider: "entra", subject: "dev", email: "dev.patel@contoso.com", displayName: "Dev Patel" }, { provider: "entra", subject: "lena", email: "lena.fox@contoso.com", displayName: "Lena Fox" }];

type Ver = { versionId: string; semver: string; sha256: string; sizeBytes: number; createdAt: string; createdBy: string; manifest: Record<string, any> };
interface Pkg { packageId: string; name: string; scope: "shared" | "user"; owner: typeof me; enabled: boolean; shadowed?: boolean; versions: Ver[]; activeVersionId: string; editors: Array<typeof me & { grantedAt: string; grantedByDisplay: string }>; files: Record<string, string>; description: string }

const ver = (name: string, semver: string, hoursAgo: number, size: number, by: string, description: string): Ver => ({
  versionId: `${name}@${semver}`, semver, sha256: `sha-${name}-${semver}`, sizeBytes: size, createdAt: ago(hoursAgo), createdBy: by, manifest: { name, version: semver, description },
});

const releaseFiles: Record<string, string> = {
  "plugin.json": JSON.stringify({ name: "pilotswarm-release", version: "1.4.0", description: "Release captain and the agents that test, build and sign off a PilotSwarm release." }, null, 2),
  "README.md": "# pilotswarm-release\n\nAgents that run a release end to end.\n\n## What you get\n\n- **Release captain** coordinates tests, changelog, images and the sign-off canvas.\n- **Test runner** runs the local test campaign and reports failures.\n\n## Using it\n\nStart a *Release captain* session and tell it the version. It spawns the test runner and image verifier itself.\n",
  "agents/release-captain.agent.md": "---\nname: release-captain\ndescription: Coordinates a release: tests, changelog, images, sign-off canvas.\ntools: [spawn_agent, write_canvas, git]\n---\nYou coordinate a PilotSwarm release. Ask for the target version, then delegate.\n",
  "agents/test-runner.agent.md": "---\nname: test-runner\ndescription: Runs the local test campaign and reports failures.\ntools: [bash]\n---\nRun the suites in order and stop at the first red one.\n",
  "skills/changelog/SKILL.md": "---\nname: changelog\ndescription: Draft a changelog entry from merged pull requests.\n---\nGroup entries by user-facing area. Lead with what changes for the reader.\n",
  "worker-module.js": "export default { tools: [{ name: 'tag_release', description: 'Create and push a release tag' }] };\n",
};
const opsFiles: Record<string, string> = {
  "plugin.json": JSON.stringify({ name: "ops-toolkit", version: "0.9.2", description: "Incident response agents and runbooks." }, null, 2),
  "README.md": "# ops-toolkit\n\nIncident response agents and runbooks.\n",
  "agents/sre-investigator.agent.md": "---\nname: sre-investigator\ndescription: Finds the cause of latency and error spikes.\ntools: [kusto_query, list_deployments, write_canvas]\n---\nStart from the deploy timeline, then the metrics.\n",
  ".mcp.json": "{ \"mcpServers\": { \"kusto\": { \"command\": \"kusto-mcp\" } } }\n",
};
const mineFiles: Record<string, string> = {
  "plugin.json": JSON.stringify({ name: "my-experiments", version: "0.2.1", description: "Scratch skills I am trying out." }, null, 2),
  "skills/tone/SKILL.md": "---\nname: tone\ndescription: Rewrite text in a plainer tone.\n---\nShort sentences. No jargon.\n",
};
const researchFiles: Record<string, string> = {
  "plugin.json": JSON.stringify({ name: "research-notes", version: "1.0.0", description: "Literature review helpers." }, null, 2),
  "agents/reviewer.agent.md": "---\nname: reviewer\ndescription: Summarises papers.\n---\nSummarise in five bullets.\n",
};

const size = (files: Record<string, string>) => Object.values(files).reduce((n, t) => n + t.length, 0);

const store: Pkg[] = [
  {
    packageId: "p-release", name: "pilotswarm-release", scope: "shared", owner: maya, enabled: true, description: "Release captain and the agents that test, build and sign off a PilotSwarm release.",
    versions: [ver("pilotswarm-release", "1.4.0", 6, size(releaseFiles), "Maya Chen", "Release captain and the agents that test, build and sign off a PilotSwarm release."), ver("pilotswarm-release", "1.3.2", 96, 5400, "Maya Chen", "Fixes the changelog skill."), ver("pilotswarm-release", "1.3.0", 400, 5100, "Priya Nair", "Adds the image verifier.")],
    activeVersionId: "pilotswarm-release@1.4.0", editors: [{ ...priya, grantedAt: ago(900), grantedByDisplay: "Maya Chen" }], files: releaseFiles,
  },
  {
    packageId: "p-ops-shared", name: "ops-toolkit", scope: "shared", owner: alex, enabled: true, shadowed: true, description: "Incident response agents and runbooks.",
    versions: [ver("ops-toolkit", "0.9.2", 30, size(opsFiles), "Alex Rivera", "Incident response agents and runbooks."), ver("ops-toolkit", "0.9.0", 300, 3000, "Alex Rivera", "First runbooks.")],
    activeVersionId: "ops-toolkit@0.9.2", editors: [], files: opsFiles,
  },
  {
    packageId: "p-ops-mine", name: "ops-toolkit", scope: "user", owner: me, enabled: true, description: "My tweaked copy of the ops toolkit.",
    versions: [ver("ops-toolkit", "0.9.3-sam.1", 3, size(opsFiles) + 200, "Sam Lee", "My tweaked copy of the ops toolkit.")],
    activeVersionId: "ops-toolkit@0.9.3-sam.1", editors: [], files: { ...opsFiles, "plugin.json": JSON.stringify({ name: "ops-toolkit", version: "0.9.3-sam.1", description: "My tweaked copy of the ops toolkit." }, null, 2) },
  },
  {
    packageId: "p-mine", name: "my-experiments", scope: "user", owner: me, enabled: true, description: "Scratch skills I am trying out.",
    versions: [ver("my-experiments", "0.2.1", 50, size(mineFiles), "Sam Lee", "Scratch skills I am trying out."), ver("my-experiments", "0.2.0", 120, 700, "Sam Lee", "Adds the tone skill.")],
    activeVersionId: "my-experiments@0.2.1", editors: [], files: mineFiles,
  },
  {
    packageId: "p-research", name: "research-notes", scope: "user", owner: jordan, enabled: false, description: "Literature review helpers.",
    versions: [ver("research-notes", "1.0.0", 700, size(researchFiles), "Jordan Kim", "Literature review helpers.")],
    activeVersionId: "research-notes@1.0.0", editors: [], files: researchFiles,
  },
];

const byId = (p: any) =>
  store.find((x) => x.name === p.name && (!p.scope || x.scope === p.scope) && (x.scope === "shared" || x.owner.subject === (p.ownerSubject || "sam")));
const need = (p: any) => {
  const pkg = byId(p);
  if (!pkg) throw Object.assign(new Error(`There is no package called ${p.name}.`), { code: "NOT_FOUND" });
  return pkg;
};
const active = (p: Pkg) => p.versions.find((v) => v.versionId === p.activeVersionId) ?? p.versions[0];
const summary = (p: Pkg) => ({ packageId: p.packageId, name: p.name, scope: p.scope, owner: p.owner, enabled: p.enabled, shadowed: Boolean(p.shadowed), canEdit: true, createdAt: p.versions.at(-1)?.createdAt, active: active(p) });

registerDemoOps({
  listAgentPackages: () => store.map(summary),
  getAgentPackage: (p) => {
    const pkg = need(p);
    return { ...summary(pkg), activeVersionId: pkg.activeVersionId, versions: pkg.versions, editors: pkg.scope === "shared" ? pkg.editors : [] };
  },
  getAgentPackageTree: (p) => {
    const pkg = need(p);
    const paths = Object.keys(pkg.files).sort();
    const dirs = [...new Set(paths.flatMap((f) => f.split("/").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("/"))))].sort();
    return { name: pkg.name, semver: p.semver || active(pkg).semver, sha256: active(pkg).sha256, dirs, files: paths.map((path) => ({ path, size: pkg.files[path].length })) };
  },
  getAgentPackageFile: (p) => {
    const pkg = need(p);
    const text = pkg.files[p.filePath];
    if (text == null) throw Object.assign(new Error(`"${p.filePath}" is not in ${pkg.name}`), { code: "NOT_FOUND" });
    return { path: p.filePath, text, binary: false, truncated: false, size: text.length };
  },
  setAgentPackageEnabled: (p) => { need(p).enabled = Boolean(p.enabled); return { ok: true }; },
  pinAgentPackageVersion: (p) => {
    const pkg = need(p);
    const v = pkg.versions.find((x) => x.semver === p.semver);
    if (!v) throw new Error(`${pkg.name} has no version ${p.semver}.`);
    pkg.activeVersionId = v.versionId;
    return { ok: true };
  },
  setAgentPackageScope: (p) => {
    const pkg = store.find((x) => x.name === p.name && x.scope !== p.scope && (p.scope === "shared" ? x.owner.subject === "sam" || p.ownerSubject === x.owner.subject : x.scope === "shared"));
    if (!pkg) throw new Error(`There is nothing to move for ${p.name}.`);
    if (store.some((x) => x !== pkg && x.name === p.name && x.scope === p.scope)) throw new Error(`A ${p.scope} package called ${p.name} already exists. Publish a new version into it instead.`);
    pkg.scope = p.scope;
    if (p.scope === "user") pkg.editors = [];
    return { ok: true };
  },
  republishAgentPackageVersion: (p) => {
    const src = need({ name: p.name, scope: p.targetScope === "shared" ? "user" : "shared", ownerSubject: p.ownerSubject });
    const v = src.versions.find((x) => x.semver === p.semver);
    if (!v) throw new Error(`${p.name} has no version ${p.semver}.`);
    let dest = store.find((x) => x.name === p.name && x.scope === p.targetScope && (x.scope === "shared" || x.owner.subject === "sam"));
    if (!dest) {
      dest = { ...src, packageId: `p-${p.name}-${p.targetScope}`, scope: p.targetScope, owner: me, shadowed: false, versions: [], editors: [] };
      store.push(dest);
    }
    if (!dest.versions.some((x) => x.semver === v.semver)) dest.versions.unshift({ ...v, createdAt: new Date().toISOString(), createdBy: "Sam Lee" });
    dest.activeVersionId = `${p.name}@${v.semver}`.replace(/^.*@/, `${p.name}@`);
    dest.files = src.files;
    return { status: "published" };
  },
  deleteAgentPackage: (p) => {
    const pkg = need(p);
    store.splice(store.indexOf(pkg), 1);
    return { ok: true, versions: pkg.versions.length };
  },
  grantAgentPackageEditor: async (p) => {
    const pkg = need({ name: p.name, scope: "shared" });
    // Anyone the directory knows: the shared list first, this area's own people as a fallback.
    const directory = (await callDemoOp("listKnownUsers").catch(() => [])) as typeof users;
    const u = [...directory, ...users].find((x) => x.subject === p.user?.subject);
    if (u && !pkg.editors.some((e) => e.subject === u.subject)) pkg.editors.push({ ...u, grantedAt: new Date().toISOString(), grantedByDisplay: "Sam Lee" });
    return { ok: true };
  },
  revokeAgentPackageEditor: (p) => {
    const pkg = need({ name: p.name, scope: "shared" });
    pkg.editors = pkg.editors.filter((e) => e.subject !== p.user?.subject);
    return { ok: true };
  },
  listAgentWorkerState: () => [
    { workerNodeId: "chk-w1", epoch: 41, updatedAt: ago(0.01), installed: { "pilotswarm-release": { semver: "1.4.0", sha256: "sha-pilotswarm-release-1.4.0", status: "ready" }, "ops-toolkit#shared": { semver: "0.9.2", sha256: "sha-ops-toolkit-0.9.2", status: "ready" } } },
    { workerNodeId: "chk-w2", epoch: 41, updatedAt: ago(0.01), installed: { "pilotswarm-release": { semver: "1.4.0", sha256: "sha-pilotswarm-release-1.4.0", status: "ready" }, "ops-toolkit#shared": { semver: "0.9.2", sha256: "sha-ops-toolkit-0.9.2", status: "ready" } } },
    { workerNodeId: "chk-w3", epoch: 40, updatedAt: ago(0.02), installed: { "pilotswarm-release": { semver: "1.3.2", sha256: "sha-pilotswarm-release-1.3.2", status: "ready" }, "ops-toolkit#shared": { semver: "0.9.2", status: "error", error: "worker-module failed to load" } } },
    { workerNodeId: "chk-w4", epoch: 41, updatedAt: ago(0.01), installed: { "pilotswarm-release": { semver: "1.4.0", sha256: "sha-pilotswarm-release-1.4.0", status: "ready" } } },
  ],
  uploadAgentPackage: (p) => {
    const text = (path: string) => {
      const f = (p.files || []).find((x: any) => x.path === path);
      return f ? atob(f.contentBase64) : null;
    };
    const raw = text("plugin.json");
    if (raw == null) throw new Error("plugin.json: missing. Every package needs one at its top level.");
    let m: any;
    try { m = JSON.parse(raw); } catch { throw new Error("plugin.json: is not valid JSON."); }
    const problems = [!m.name ? "plugin.json: name is required." : "", !m.version ? "plugin.json: version is required." : ""].filter(Boolean);
    if (problems.length) throw new Error(problems.join("\n"));
    const scope: "shared" | "user" = p.scope === "shared" ? "shared" : "user";
    const files: Record<string, string> = Object.fromEntries((p.files || []).map((f: any) => [f.path, (() => { try { return atob(f.contentBase64); } catch { return ""; } })()]));
    const total = (p.files || []).reduce((n: number, f: any) => n + f.contentBase64.length, 0);
    let pkg = store.find((x) => x.name === m.name && x.scope === scope && (scope === "shared" || x.owner.subject === "sam"));
    const v: Ver = { versionId: `${m.name}@${m.version}`, semver: m.version, sha256: `sha-${m.name}-${m.version}-${total}`, sizeBytes: total, createdAt: new Date().toISOString(), createdBy: "Sam Lee", manifest: m };
    if (pkg?.versions.some((x) => x.semver === m.version)) return { status: "noop", packageId: pkg.packageId, versionId: v.versionId };
    if (!pkg) {
      pkg = { packageId: `p-${m.name}-${scope}`, name: m.name, scope, owner: me, enabled: true, description: m.description || "", versions: [], activeVersionId: v.versionId, editors: [], files };
      store.push(pkg);
    }
    pkg.versions.unshift(v);
    pkg.activeVersionId = v.versionId;
    pkg.files = files;
    return { status: "published", packageId: pkg.packageId, versionId: v.versionId };
  },
});
