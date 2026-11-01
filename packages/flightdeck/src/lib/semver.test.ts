import { describe, expect, it } from "vitest";
import { compareSemver, isValidSemver } from "./semver";

describe("semver as the package validator reads it", () => {
  it("accepts concrete versions and refuses ranges, prefixes and short forms", () => {
    for (const ok of ["1.2.3", "0.0.1", "1.2.3-dev.1", "1.0.0+build.5"]) expect(isValidSemver(ok), ok).toBe(true);
    for (const bad of ["v1.2.3", "1.2", "^1.2.3", "1.2.3.4", "01.2.3", "1.2.x", "", "latest"]) expect(isValidSemver(bad), bad).toBe(false);
  });
  it("orders by precedence, with prereleases below their release", () => {
    expect(compareSemver("1.2.3", "1.2.4")).toBe(-1);
    expect(compareSemver("2.0.0", "1.9.9")).toBe(1);
    expect(compareSemver("1.0.0-dev.1", "1.0.0")).toBe(-1);
    expect(compareSemver("1.0.0-dev.2", "1.0.0-dev.10")).toBe(-1);
    expect(compareSemver("1.0.0+a", "1.0.0+b")).toBe(0);
  });
  it("throws on a version it cannot read", () => {
    expect(() => compareSemver("1.2", "1.2.3")).toThrow();
  });
});
