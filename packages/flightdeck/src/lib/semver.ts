// Concrete semver, the way the package validator reads it (packages/sdk/src/agent-package-format.ts):
// no ranges, no "v" prefix, build metadata ignored when comparing. Kept in step with that file by hand,
// so a version the server would refuse is refused here before anything is sent.

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export const isValidSemver = (v: unknown): v is string => typeof v === "string" && SEMVER_RE.test(v);

/** Standard precedence: -1, 0 or 1. Throws on a string that is not a concrete semver. */
export function compareSemver(a: string, b: string): number {
  const ma = SEMVER_RE.exec(a);
  const mb = SEMVER_RE.exec(b);
  if (!ma || !mb) throw new Error(`compareSemver: invalid semver (${a}, ${b})`);
  for (let i = 1; i <= 3; i++) {
    const na = Number(ma[i]), nb = Number(mb[i]);
    if (na !== nb) return na < nb ? -1 : 1;
  }
  const pa = ma[4], pb = mb[4];
  if (pa === undefined && pb === undefined) return 0;
  if (pa === undefined) return 1;
  if (pb === undefined) return -1;
  const ia = pa.split("."), ib = pb.split(".");
  for (let i = 0; i < Math.max(ia.length, ib.length); i++) {
    const xa = ia[i], xb = ib[i];
    if (xa === undefined) return -1;
    if (xb === undefined) return 1;
    const nxa = /^\d+$/.test(xa), nxb = /^\d+$/.test(xb);
    if (nxa && nxb) {
      const da = Number(xa), db = Number(xb);
      if (da !== db) return da < db ? -1 : 1;
    } else if (nxa !== nxb) return nxa ? -1 : 1;
    else if (xa !== xb) return xa < xb ? -1 : 1;
  }
  return 0;
}
