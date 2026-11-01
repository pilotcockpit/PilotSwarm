import type { Agent } from "@/data/types";
import type { PackageSummary } from "@/data/ops/packages";

/** File names describe contents. Only the SDK's creatable catalog grants a launch. */
export function creatablePackageAgents(pkg: PackageSummary, agents: Agent[], viewerOwnsCopy: boolean) {
  if (!pkg.enabled || pkg.shadowed || !pkg.active || (pkg.scope === "user" && !viewerOwnsCopy)) return [];
  return agents.filter((a) => a.source === "package" && a.packageName === pkg.name && a.scope === pkg.scope
    && a.packageSemver === pkg.active!.semver && (pkg.scope === "shared" || a.mine === true));
}

/**
 * Why an agent in this package copy cannot be started from here, in the words of the rule that applies.
 * The server's catalog keeps ONE agent per name, shared copies first, so a private copy that repeats a
 * shared agent's name does not appear in it (the shared agent does), and a disabled or other person's
 * private copy never does.
 */
export function notStartableReason(pkg: PackageSummary, viewerOwnsCopy: boolean): string {
  if (!pkg.enabled) return "Package turned off";
  if (pkg.shadowed) return "Your private copy takes over this name";
  if (pkg.scope === "user" && !viewerOwnsCopy) return "Only its owner can start these agents";
  return pkg.scope === "user" ? "Not offered: a shared agent with this name is listed instead" : "Not in the agent list yet. Workers may still be installing it.";
}
