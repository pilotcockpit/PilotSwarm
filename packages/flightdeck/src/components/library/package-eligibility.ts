import type { Agent } from "@/data/types";
import type { PackageSummary } from "@/data/ops/packages";

/** File names describe contents. Only the SDK's creatable catalog grants a launch. */
export function creatablePackageAgents(pkg: PackageSummary, agents: Agent[], viewerOwnsCopy: boolean) {
  if (!pkg.enabled || pkg.shadowed || !pkg.active || (pkg.scope === "user" && !viewerOwnsCopy)) return [];
  return agents.filter((a) => a.source === "package" && a.packageName === pkg.name && a.scope === pkg.scope
    && a.packageSemver === pkg.active!.semver && (pkg.scope === "shared" || a.mine === true));
}
