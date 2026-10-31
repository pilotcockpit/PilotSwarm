import * as React from "react";
import type { PackageSummary, WorkerPackageState } from "./packages";

// "Published" is not "running": workers pick up a new package version within about twenty seconds, and
// until they do the agents it provides are not yet usable. Right after a publish, enable, pin or upload
// succeeds, the page remembers which version it is waiting for and keeps looking until every worker has
// it, even before any worker has reported the package at all (the first publication of a package).
// The wait is bounded: a worker that is draining or gone must not keep the page polling forever.

export const PENDING_TIMEOUT_MS = 120_000;
export const ADOPTION_POLL_MS = 5_000;

export interface PendingPackage {
  name: string;
  scope: "shared" | "user";
  /** The owner of a user copy, when known; empty matches whichever copy the workers report. */
  ownerSubject?: string | null;
  /** The version waited for; null means "whatever is the active version when we look". */
  semver: string | null;
  since: number;
}

export const pendingKey = (p: Pick<PendingPackage, "name" | "scope" | "ownerSubject" | "semver">) => `${p.scope}:${p.ownerSubject || ""}:${p.name}@${p.semver || "active"}`;

// ── the store ──────────────────────────────────────────────────────────────────────────────────
const store = new Map<string, PendingPackage>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => { version += 1; for (const l of listeners) l(); };

export function markPending(p: Omit<PendingPackage, "since">, now = Date.now()) {
  store.set(pendingKey(p), { ...p, since: now });
  emit();
}
export function clearPending(keys: string[]) {
  let changed = false;
  for (const k of keys) changed = store.delete(k) || changed;
  if (changed) emit();
}
export const resetPending = () => { if (store.size) { store.clear(); emit(); } };
export const pendingList = (): PendingPackage[] => [...store.values()];
export const pendingVersion = () => version;
export const subscribePending = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Re-render when something becomes pending or is settled; returns what is pending now. */
export function usePending(): PendingPackage[] {
  const v = React.useSyncExternalStore(subscribePending, pendingVersion, () => 0);
  return React.useMemo(() => pendingList(), [v]);
}

// ── deciding ─────────────────────────────────────────────────────────────────────────────────
/** What one worker reports for a pending package, under whichever key it uses. */
function reportedBy(w: WorkerPackageState, p: PendingPackage) {
  const keys = [p.name, `${p.name}#${p.scope}`];
  if (p.ownerSubject) keys.push(`${p.name}#${p.scope}:${String(p.ownerSubject).slice(0, 8)}`);
  else keys.push(...Object.keys(w.installed).filter((k) => k.startsWith(`${p.name}#${p.scope}:`)));
  return keys.map((k) => w.installed[k]).find(Boolean);
}

/** The version a pending entry is waiting for, resolved against the package list when it said "active". */
function targetOf(p: PendingPackage, packages: PackageSummary[] | undefined): { semver: string | null; sha256?: string } {
  if (p.semver) return { semver: p.semver };
  const pkg = packages?.find((x) => x.name === p.name && x.scope === p.scope);
  return pkg?.active ? { semver: pkg.active.semver, sha256: pkg.active.sha256 } : { semver: null };
}

/**
 * Done when there is something to compare and EVERY worker has settled: it reports the package at the
 * target version, or reports it failed. A worker that lists nothing yet (the first publication) is
 * still waiting. With no worker rows at all there is nothing to say, so keep waiting.
 */
export function isSettled(p: PendingPackage, states: WorkerPackageState[] | undefined, packages: PackageSummary[] | undefined): boolean {
  if (!states?.length) return false;
  const target = targetOf(p, packages);
  if (!target.semver) return false;
  return states.every((w) => {
    const hit = reportedBy(w, p);
    if (!hit) return false;
    if (hit.status === "error") return true;
    // Content decides when both sides know it; otherwise the version string does.
    return target.sha256 && hit.sha256 ? hit.sha256 === target.sha256 : hit.semver === target.semver;
  });
}

export function evaluatePending(list: PendingPackage[], states: WorkerPackageState[] | undefined, packages: PackageSummary[] | undefined, now: number) {
  const done: PendingPackage[] = [];
  const expired: PendingPackage[] = [];
  const waiting: PendingPackage[] = [];
  for (const p of list) {
    if (isSettled(p, states, packages)) done.push(p);
    else if (now - p.since >= PENDING_TIMEOUT_MS) expired.push(p);
    else waiting.push(p);
  }
  return { done, expired, waiting };
}

/** True while a package that was already reported has workers on different versions (an update in flight). */
export function updateInProgress(packages: PackageSummary[] | undefined, states: WorkerPackageState[] | undefined, adoptionOf: (p: PackageSummary, s: WorkerPackageState[]) => { on: number; failed: number; total: number } | null): boolean {
  if (!packages?.length || !states?.length) return false;
  return packages.some((p) => {
    const a = adoptionOf(p, states);
    return Boolean(a && a.on + a.failed < a.total);
  });
}

/** How long until the next look: every few seconds while anything is pending or changing, never otherwise. */
export function pollInterval(list: PendingPackage[], states: WorkerPackageState[] | undefined, packages: PackageSummary[] | undefined, updating: boolean, now: number): number | false {
  const live = list.some((p) => now - p.since < PENDING_TIMEOUT_MS && !isSettled(p, states, packages));
  return live || updating ? ADOPTION_POLL_MS : false;
}

/** A fingerprint of what every worker has installed; it changes when any worker adopts, drops or fails a package. */
export function installedSignature(states: WorkerPackageState[] | undefined): string {
  return (states || [])
    .map((w) => `${w.workerNodeId}|${Object.entries(w.installed || {}).map(([k, v]) => `${k}=${v.semver ?? ""}:${v.sha256 ?? ""}:${v.status ?? ""}`).sort().join(",")}`)
    .sort()
    .join(";");
}
