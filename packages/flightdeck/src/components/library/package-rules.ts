import { compareSemver, isValidSemver } from "@/lib/semver";
import { packageRights, type PackageSummary, type PackageVersion } from "@/data/ops/packages";
import type { Profile } from "@/data/types";

// What the backend lets people do with a package, and what the words around it should therefore say.
// These are pure so the claims can be tested against the rules in docs/building-agent-packages.md,
// docs/proposals/agent-packages.md and the permission function in cms-migrations.ts:
//   - a NAME is unique per scope and owner, so a shared package and your own copy can share it;
//   - your own ENABLED copy takes the name over for you; it never changes anything for anyone else;
//   - enabling or disabling is fleet-wide for that one copy, and sessions using a disabled package fail
//     on their next turn;
//   - publish, pin and enable need owner, editor or admin; scope, delete and editors need owner or admin;
//   - anyone who can read a package may copy a version of it into their own private package.

export const sharedCopyOf = (pkg: Pick<PackageSummary, "name">, all: PackageSummary[]) => all.find((p) => p.scope === "shared" && p.name === pkg.name) ?? null;

/** The tag that explains a shared name appearing twice, true to who it applies to. */
export function sameNameTag(pkg: PackageSummary, all: PackageSummary[], profile?: Profile | null): { text: string; neutral: boolean } | null {
  if (pkg.scope === "shared") return pkg.shadowed ? { text: "Your copy takes over", neutral: true } : null;
  if (!sharedCopyOf(pkg, all)) return null;
  const mine = packageRights(pkg, profile).mine && !(profile?.isAdmin && pkg.owner && !packageRights(pkg, profile).mine);
  return pkg.enabled && mine ? { text: "Overrides the shared one", neutral: true } : { text: "Same name as a shared package", neutral: true };
}

export interface RepublishChoice { available: boolean; reason: string | null }

/** Copy a version into your own private package: open to anyone who can read it. */
export const copyIntoMine = (pkg: PackageSummary): RepublishChoice => ({ available: pkg.scope === "shared", reason: pkg.scope === "shared" ? null : "Only a shared package can be copied into your own." });

/** Update the shared package from your own copy: needs a shared package you may publish to. */
export function updateShared(pkg: PackageSummary, all: PackageSummary[]): RepublishChoice {
  if (pkg.scope !== "user") return { available: false, reason: "This is the shared package." };
  const shared = sharedCopyOf(pkg, all);
  if (!shared) return { available: false, reason: "No shared package has this name yet. Use Share to publish it for the first time." };
  if (!shared.canEdit) return { available: false, reason: "Only the shared package's owner, an editor or an admin can publish to it." };
  return { available: true, reason: null };
}

/** Where the Add dialog can publish, and why not when it cannot. */
export function publishTarget(scope: "user" | "shared", name: string | null, all: PackageSummary[], profile?: Profile | null): { existing: PackageSummary | null; blocked: string | null } {
  if (!name) return { existing: null, blocked: null };
  if (scope === "shared") {
    const shared = all.find((p) => p.scope === "shared" && p.name === name) ?? null;
    return { existing: shared, blocked: shared && !shared.canEdit ? `Only the owner, an editor or an admin can publish to the shared ${name}. Publish to Yours instead.` : null };
  }
  const own = all.find((p) => p.scope === "user" && p.name === name && packageRights(p, profile).mine) ?? null;
  return { existing: own, blocked: null };
}

export interface AddOutcome { tone: "neutral" | "waiting"; text: string }

/**
 * What publishing would do, against EVERY version of the copy it lands in. Any new version becomes the
 * active one, even a lower number; the same number is a no-op for identical files and a refusal for
 * different ones (published versions are immutable), so the dialog can only warn, not know which.
 */
export function addOutcome(a: { name: string | null; version: string | null; scope: "user" | "shared" }, target: PackageSummary | null, versions: PackageVersion[] | undefined, sharedElsewhere: boolean): AddOutcome | null {
  if (!a.name || !a.version || !isValidSemver(a.version)) return null;
  const scopeWord = a.scope === "shared" ? "shared " : "";
  if (!target) {
    return { tone: "neutral", text: a.scope === "shared" ? "This creates a new shared package." : sharedElsewhere ? `A shared package named ${a.name} exists. Your private copy takes the name over for you only.` : "This creates a new package that only you can use." };
  }
  const known = (versions ?? []).map((v) => v.semver).filter(isValidSemver);
  if (known.includes(a.version)) return { tone: "waiting", text: `${a.name} ${a.version} is already published. Identical files do nothing; different files are refused, because a published version never changes. Raise the version to publish changes.` };
  const newest = known.length ? known.reduce((m, v) => (compareSemver(v, m) > 0 ? v : m)) : target.active?.semver;
  if (newest && isValidSemver(newest) && compareSemver(a.version, newest) < 0) {
    return { tone: "waiting", text: `${a.name} ${newest} is already newer. Publishing ${a.version} still makes it the active version, so this goes back to older files for everyone who uses this ${scopeWord}package. To return to an older version you already published, use Pin in Versions instead.` };
  }
  return { tone: "neutral", text: `This adds ${a.version} to your existing ${scopeWord}package (now ${target.active?.semver ?? "unversioned"}) and makes it the active version.` };
}

/** What the on/off switch says, true to scope and to who is looking. */
export function enableCopy(pkg: PackageSummary, all: PackageSummary[]): { label: string; help: string } {
  const shared = pkg.scope === "shared";
  const reach = shared ? "for everyone" : "for its owner";
  if (!pkg.enabled) {
    return { label: "Turned off", help: shared ? "Hidden from everyone's new work. Sessions that already use its agents stop working on their next turn." : `Hidden from new work. ${sharedCopyOf(pkg, all) ? "The shared package of the same name is used instead." : "Sessions that use its agents stop working on their next turn."}` };
  }
  return { label: "Available to sessions", help: `On ${reach}. Turning it off hides its agents from new work and stops sessions that use them on their next turn${!shared && sharedCopyOf(pkg, all) ? "; the shared package of the same name takes over" : ""}.` };
}

export const VERSION_SWITCH_NOTE = "Workers pick the change up within about 20 seconds; running sessions use it from their next turn, and tools a session already loaded may not appear until it restarts. Publishing a newer version replaces a pin.";

export const MAKE_PRIVATE_CONSEQUENCES = [
  "Other people's new sessions can no longer start its agents or use its tools. Sessions already running are not interrupted by this change.",
  "Editors lose access.",
  "You stay the owner and can share it again.",
];

export function deleteConsequences(pkg: PackageSummary, versions: number, mySessions: number): string[] {
  return [
    `Removes ${versions === 1 ? "1 version" : `${versions} versions`} and their files${pkg.scope === "shared" ? " for everyone" : ""}. This cannot be undone.`,
    mySessions ? `${mySessions === 1 ? "1 of your sessions uses" : `${mySessions} of your sessions use`} its agents and will fail on their next turn.` : "None of your running sessions use its agents.",
    ...(pkg.scope === "shared" ? ["Other people's sessions that use it may fail on their next turn: you can only see your own.", "Editors lose access."] : []),
  ];
}

export const EDITOR_PICKER_NOTE = "The list shows people the directory knows by name and is capped, so someone may be missing. Search by name or email.";

export const TRUST_NOTE = "A package can include code that runs on workers. Share it only with people who should be able to run it.";
