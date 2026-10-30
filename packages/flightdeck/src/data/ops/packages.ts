import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSource } from "@/data/source";
import { useOpMutation, useOpQuery } from "@/data/ops/use-op";
import type { Profile } from "@/data/types";

// Agent packages through the Web API. A NAME is not a package: one name can be a shared package
// and one or more user copies at once, so every call carries the copy it means (scope, plus the
// owner when an admin looks at someone else's copy).

export interface Principal { provider?: string; subject?: string; email?: string | null; displayName?: string | null }
export interface PackageVersion {
  versionId: string;
  semver: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string | number;
  createdBy?: string | null;
  commitSha?: string | null;
  manifest?: Record<string, any>;
}
export interface PackageSummary {
  packageId: string;
  name: string;
  scope: "shared" | "user";
  owner: Principal | null;
  enabled: boolean;
  /** A shared package the viewer's own enabled copy of the same name overrides. */
  shadowed?: boolean;
  /** Admin, owner or granted editor: may publish, pin and enable. Scope, delete and editors stay with owner/admin. */
  canEdit: boolean;
  createdAt?: string | number;
  active: PackageVersion | null;
}
export interface PackageEditor extends Principal { grantedAt?: string | number; grantedByDisplay?: string | null }
export interface PackageDetail extends PackageSummary {
  activeVersionId?: string | null;
  versions: PackageVersion[];
  editors: PackageEditor[];
}
export interface PackageTree { name?: string; semver: string; sha256?: string; dirs: string[]; files: Array<{ path: string; size: number }> }
export interface PackageFile { path?: string; text?: string; binary?: boolean; truncated?: boolean; size?: number }
export interface WorkerPackageState { workerNodeId: string; epoch?: number; installed: Record<string, { semver?: string; sha256?: string; status?: string; error?: string }>; updatedAt?: string | number }
export interface KnownUser extends Principal {}

const list = <T,>(raw: any, key: string): T[] => (Array.isArray(raw) ? raw : Array.isArray(raw?.[key]) ? raw[key] : []);

const norm = (p: any): PackageSummary => ({
  ...p,
  scope: p.scope === "shared" ? "shared" : "user",
  owner: p.owner ?? null,
  enabled: p.enabled !== false,
  canEdit: p.canEdit !== false,
  active: p.active ?? null,
});

/** The same person, by provider and subject, or by email when the provider does not report one. */
export function isSamePerson(a: Principal | null | undefined, b: Principal | Profile | null | undefined) {
  if (!a || !b) return false;
  const x = a as any, y = b as any;
  if (x.subject && y.subject && x.subject === y.subject && (!x.provider || !y.provider || x.provider === y.provider)) return true;
  return Boolean(x.email && y.email && String(x.email).toLowerCase() === String(y.email).toLowerCase());
}

/** What the viewer may do. Owner or admin is the stronger right; canEdit also covers editors. */
export function packageRights(pkg: PackageSummary, profile?: Profile | null) {
  const admin = Boolean(profile?.isAdmin);
  const mine = pkg.scope === "user" ? (admin ? isSamePerson(pkg.owner, profile) || !pkg.owner : true) : isSamePerson(pkg.owner, profile);
  const owner = admin || mine;
  return { admin, mine, owner, edit: owner || pkg.canEdit };
}

/** Stable identity for one copy. */
export const packageKey = (p: Pick<PackageSummary, "name" | "scope" | "owner" | "packageId">) => p.packageId || `${p.scope}:${p.name}:${p.owner?.subject ?? ""}`;

/** The selector every :name operation takes so it hits the copy it means. */
export function packageSelector(pkg: Pick<PackageSummary, "name" | "scope" | "owner">, profile?: Profile | null) {
  const other = pkg.scope === "user" && pkg.owner && profile && !isSamePerson(pkg.owner, profile);
  return { name: pkg.name, scope: pkg.scope, ...(other ? { ownerProvider: pkg.owner!.provider, ownerSubject: pkg.owner!.subject } : {}) };
}

export function usePackages() {
  return useOpQuery<PackageSummary[]>(["packages", "list"], "listAgentPackages", {}, { select: (raw) => list<any>(raw, "packages").map(norm), staleTime: 15_000 });
}

export function usePackageDetail(pkg: PackageSummary | null, profile?: Profile | null) {
  return useOpQuery<PackageDetail>(["packages", "detail", pkg ? packageKey(pkg) : ""], "getAgentPackage", pkg ? packageSelector(pkg, profile) : {}, {
    enabled: Boolean(pkg),
    select: (raw) => {
      const p = norm(raw?.package ?? raw);
      const versions = list<PackageVersion>(raw?.package ?? raw, "versions");
      const active = p.active ?? versions.find((v) => v.versionId === (raw?.activeVersionId ?? raw?.package?.activeVersionId)) ?? null;
      return { ...p, active, versions, editors: list<PackageEditor>(raw?.package ?? raw, "editors"), activeVersionId: raw?.activeVersionId ?? active?.versionId };
    },
  });
}

export function usePackageTree(pkg: PackageSummary | null, semver: string | undefined, profile?: Profile | null) {
  return useOpQuery<PackageTree>(["packages", "tree", pkg ? packageKey(pkg) : "", semver || "active"], "getAgentPackageTree", pkg ? { ...packageSelector(pkg, profile), ...(semver ? { semver } : {}) } : {}, {
    enabled: Boolean(pkg),
    staleTime: 60_000,
    select: (raw) => ({ ...raw, dirs: list<string>(raw, "dirs"), files: list<any>(raw, "files") }),
  });
}

export function usePackageFile(pkg: PackageSummary | null, semver: string | undefined, filePath: string | null, profile?: Profile | null) {
  return useOpQuery<PackageFile>(["packages", "file", pkg ? packageKey(pkg) : "", semver || "active", filePath || ""], "getAgentPackageFile", pkg && filePath ? { ...packageSelector(pkg, profile), ...(semver ? { semver } : {}), filePath } : {}, {
    enabled: Boolean(pkg && filePath),
    staleTime: 60_000,
  });
}

/** Admin only: what each worker has installed, for the adoption meter. */
export function useWorkerPackageState(enabled: boolean) {
  return useOpQuery<WorkerPackageState[]>(["packages", "workers"], "listAgentWorkerState", {}, { enabled, staleTime: 15_000, select: (raw) => list<WorkerPackageState>(raw, "workers").concat(Array.isArray(raw) ? [] : list<WorkerPackageState>(raw, "rows")).map((r) => ({ ...r, installed: (r.installed || {}) as WorkerPackageState["installed"] })) });
}

export function useKnownUsers(enabled = true) {
  return useOpQuery<KnownUser[]>(["packages", "users"], "listKnownUsers", {}, { enabled, staleTime: 300_000, select: (raw) => list<KnownUser>(raw, "users") });
}

/**
 * How many workers run the active version of a copy. Workers key their report by name, or by
 * `name#scope[:owner]` when two copies share a name; match by the key first, then by hash.
 */
export function adoption(pkg: PackageSummary, states: WorkerPackageState[] | undefined) {
  if (!states?.length || !pkg.active) return null;
  const keys = [pkg.name, `${pkg.name}#${pkg.scope}`, `${pkg.name}#${pkg.scope}:${String(pkg.owner?.subject ?? "").slice(0, 8)}`];
  let on = 0, failed = 0, seen = 0;
  for (const w of states) {
    const hit = keys.map((k) => w.installed[k]).find(Boolean);
    if (!hit) continue;
    seen += 1;
    if (hit.status === "error") failed += 1;
    else if (hit.sha256 ? hit.sha256 === pkg.active.sha256 : hit.semver === pkg.active.semver) on += 1;
  }
  // No worker reports this copy at all (a private package nobody has used): nothing to show, not a failure.
  return seen ? { on, failed, total: states.length } : null;
}

export interface Provides { agents: string[]; skills: string[]; tools: boolean; mcp: boolean; readme: string | null }
/** What a package gives agents, read from its file layout, so it never depends on manifest details. */
export function describeFiles(paths: string[]): Provides {
  const agents = paths.filter((p) => /\.agent\.md$/i.test(p)).map((p) => p.split("/").pop()!.replace(/\.agent\.md$/i, ""));
  const skills = [...new Set(paths.filter((p) => /(^|\/)SKILL\.md$/i.test(p)).map((p) => p.split("/").slice(-2, -1)[0] || "skill"))];
  return {
    agents: [...new Set(agents)].sort(),
    skills: skills.sort(),
    tools: paths.some((p) => /(^|\/)worker-module\.js$/.test(p)),
    mcp: paths.some((p) => /(^|\/)\.mcp\.json$/.test(p)),
    readme: paths.find((p) => /^readme(\.md)?$/i.test(p)) ?? null,
  };
}

const invalidate = [["packages"]];
const sel = (pkg: PackageSummary, profile?: Profile | null) => packageSelector(pkg, profile);

export function usePackageActions(profile?: Profile | null) {
  const setEnabled = useOpMutation<{ pkg: PackageSummary; enabled: boolean }>("setAgentPackageEnabled", {
    params: ({ pkg, enabled }) => ({ ...sel(pkg, profile), enabled }),
    invalidate,
    success: (_r, v) => (v.enabled ? `${v.pkg.name} is available to sessions again` : `${v.pkg.name} is turned off. Sessions that use its agents will stop resolving them.`),
  });
  const pin = useOpMutation<{ pkg: PackageSummary; semver: string }>("pinAgentPackageVersion", {
    params: ({ pkg, semver }) => ({ ...sel(pkg, profile), semver }),
    invalidate,
    success: () => null,
  });
  const setScope = useOpMutation<{ pkg: PackageSummary; scope: "shared" | "user" }>("setAgentPackageScope", {
    params: ({ pkg, scope }) => ({ name: pkg.name, scope, ...(pkg.owner && !isSamePerson(pkg.owner, profile) ? { ownerProvider: pkg.owner.provider, ownerSubject: pkg.owner.subject } : {}) }),
    invalidate,
    success: (_r, v) => (v.scope === "shared" ? `${v.pkg.name} is now shared with everyone` : `${v.pkg.name} is private again`),
  });
  const republish = useOpMutation<{ pkg: PackageSummary; semver: string; targetScope: "shared" | "user" }>("republishAgentPackageVersion", {
    params: ({ pkg, semver, targetScope }) => ({ name: pkg.name, semver, targetScope, ...(pkg.owner && !isSamePerson(pkg.owner, profile) ? { ownerProvider: pkg.owner.provider, ownerSubject: pkg.owner.subject } : {}) }),
    invalidate,
    success: (_r, v) => `Published ${v.pkg.name} ${v.semver} into ${v.targetScope === "shared" ? "the shared package" : "your copy"}`,
  });
  const remove = useOpMutation<{ pkg: PackageSummary }>("deleteAgentPackage", {
    params: ({ pkg }) => sel(pkg, profile),
    invalidate,
    success: (_r, v) => `Deleted ${v.pkg.name}`,
  });
  const grant = useOpMutation<{ pkg: PackageSummary; user: Principal }>("grantAgentPackageEditor", {
    params: ({ pkg, user }) => ({ name: pkg.name, user: { provider: user.provider, subject: user.subject } }),
    invalidate,
    success: (_r, v) => `${v.user.displayName || v.user.email || "They"} can now publish updates`,
  });
  const revoke = useOpMutation<{ pkg: PackageSummary; user: Principal }>("revokeAgentPackageEditor", {
    params: ({ pkg, user }) => ({ name: pkg.name, user: { provider: user.provider, subject: user.subject } }),
    invalidate,
    success: (_r, v) => `${v.user.displayName || v.user.email || "They"} can no longer publish updates`,
  });
  return { setEnabled, pin, setScope, republish, remove, grant, revoke };
}

export interface UploadFile { path: string; contentBase64: string }
/** Upload reports its own errors inline (per file, in the install dialog), so it does not toast. */
export function useUploadPackage() {
  const { source } = useSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { files: UploadFile[]; scope: "shared" | "user" }) =>
      (await source.call("uploadAgentPackage", { files: v.files, scope: v.scope })) as { status?: "published" | "noop"; packageId?: string; versionId?: string },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}
