import { describe, expect, it } from "vitest";
import type { PackageSummary } from "@/data/ops/packages";
import type { Agent } from "@/data/types";
import { creatablePackageAgents } from "./package-eligibility";

const pkg = { name: "ops", scope: "shared", enabled: true, active: { semver: "1.0.0" } } as PackageSummary;
const agent: Agent = { name: "frontmatter-name", source: "package", packageName: "ops", packageSemver: "1.0.0", scope: "shared" };
describe("package launch eligibility", () => {
  it("keeps the catalog identity rather than deriving an agent from a filename", () => {
    expect(creatablePackageAgents(pkg, [agent], false)).toEqual([agent]);
  });
  it("refuses a different package copy or inactive version", () => {
    expect(creatablePackageAgents(pkg, [{ ...agent, scope: "user", mine: true }, { ...agent, packageSemver: "0.9.0" }], false)).toEqual([]);
  });
  it("does not let admin inspection imply launch rights to another private copy", () => {
    expect(creatablePackageAgents({ ...pkg, scope: "user" }, [{ ...agent, scope: "user", mine: false }], false)).toEqual([]);
  });
  it("does not borrow an owned catalog entry for another admin-visible private copy", () => {
    const other = { ...pkg, scope: "user" as const, owner: { subject: "someone-else" } };
    const ownCatalogAgent = { ...agent, scope: "user" as const, mine: true };
    expect(creatablePackageAgents(other, [ownCatalogAgent], false)).toEqual([]);
    expect(creatablePackageAgents({ ...other, owner: { subject: "me" } }, [ownCatalogAgent], true)).toEqual([ownCatalogAgent]);
  });
  it("refuses disabled, shadowed or metadata-incomplete entries", () => {
    expect(creatablePackageAgents({ ...pkg, enabled: false }, [agent], true)).toEqual([]);
    expect(creatablePackageAgents({ ...pkg, shadowed: true }, [agent], true)).toEqual([]);
    expect(creatablePackageAgents(pkg, [{ name: "filename-guess", source: "package", packageName: "ops" }], false)).toEqual([]);
  });
});
