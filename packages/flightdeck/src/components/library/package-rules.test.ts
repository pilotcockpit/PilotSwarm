import { describe, expect, it } from "vitest";
import { addOutcome, copyIntoMine, deleteConsequences, enableCopy, publishTarget, sameNameTag, updateShared } from "./package-rules";

const me = { provider: "entra", subject: "sam", email: "sam@x.com" };
const other = { provider: "entra", subject: "maya", email: "maya@x.com" };
const profile: any = { ...me, isAdmin: false };
const pkg = (o: Record<string, unknown>): any => ({ packageId: "p", name: "ops", scope: "shared", owner: other, enabled: true, canEdit: false, active: { versionId: "ops@1.0.0", semver: "1.0.0", sha256: "x", sizeBytes: 1, createdAt: 0 }, ...o });
const v = (semver: string): any => ({ versionId: `ops@${semver}`, semver, sha256: semver, sizeBytes: 1, createdAt: 0 });

describe("who may copy or update", () => {
  it("lets anyone who can read a shared package copy it into their own, even without edit rights", () => {
    expect(copyIntoMine(pkg({ canEdit: false })).available).toBe(true);
    expect(copyIntoMine(pkg({ scope: "user" })).available).toBe(false);
  });
  it("updates the shared package only when one exists and the viewer may publish to it", () => {
    const mine = pkg({ scope: "user", owner: me, canEdit: true });
    expect(updateShared(mine, [mine]).reason).toMatch(/No shared package/);
    expect(updateShared(mine, [mine, pkg({ canEdit: false })])).toMatchObject({ available: false, reason: expect.stringMatching(/owner, an editor or an admin/) });
    expect(updateShared(mine, [mine, pkg({ canEdit: true })]).available).toBe(true);
  });
  it("blocks publishing to a shared package the viewer cannot edit, before the click", () => {
    const shared = pkg({ canEdit: false });
    expect(publishTarget("shared", "ops", [shared], profile).blocked).toMatch(/Publish to Yours instead/);
    expect(publishTarget("shared", "brand-new", [shared], profile).blocked).toBeNull();
    expect(publishTarget("shared", "ops", [pkg({ canEdit: true })], profile).blocked).toBeNull();
  });
});

describe("the same-name tag says who it applies to", () => {
  const shared = pkg({});
  it("says 'overrides the shared one' only for the viewer's own enabled copy", () => {
    expect(sameNameTag(pkg({ scope: "user", owner: me }), [shared], profile)?.text).toBe("Overrides the shared one");
    expect(sameNameTag(pkg({ scope: "user", owner: me, enabled: false }), [shared], profile)?.text).toBe("Same name as a shared package");
    expect(sameNameTag(pkg({ scope: "user", owner: other }), [shared], { ...profile, isAdmin: true })?.text).toBe("Same name as a shared package");
    expect(sameNameTag(pkg({ scope: "user", owner: me }), [], profile)).toBeNull();
  });
});

describe("what publishing would do, against every version", () => {
  const target = pkg({ scope: "user", owner: me, canEdit: true, active: { semver: "1.2.0", versionId: "ops@1.2.0" } });
  const a = (version: string) => ({ name: "ops", version, scope: "user" as const });
  it("warns that the same number is a no-op or a refusal, even when it is not the active version", () => {
    expect(addOutcome(a("1.0.0"), target, [v("1.0.0"), v("1.1.0"), v("1.2.0")], false)?.text).toMatch(/ops 1\.0\.0 is already published\./);
  });
  it("warns when a lower version would still become the active one", () => {
    expect(addOutcome(a("1.1.5"), target, [v("1.0.0"), v("1.2.0")], false)?.text).toMatch(/already newer[\s\S]*Pin/);
  });
  it("describes a normal new version, a first publication, and a name that overrides a shared one", () => {
    expect(addOutcome(a("1.3.0"), target, [v("1.2.0")], false)?.text).toMatch(/adds 1\.3\.0/);
    expect(addOutcome(a("1.0.0"), null, undefined, false)?.text).toMatch(/new package that only you/);
    expect(addOutcome(a("1.0.0"), null, undefined, true)?.text).toMatch(/takes the name over for you only/);
  });
  it("says nothing until the version is a real semver", () => {
    expect(addOutcome(a("v1"), target, [], false)).toBeNull();
  });
});

describe("copy that must stay true", () => {
  it("scopes the on/off switch and names who is affected", () => {
    const mine = pkg({ scope: "user", owner: me });
    expect(enableCopy(pkg({}), []).help).toMatch(/for everyone/);
    expect(enableCopy(mine, [pkg({})]).help).toMatch(/shared package of the same name takes over/);
    expect(enableCopy(pkg({ enabled: false }), []).help).toMatch(/stop working on their next turn/);
  });
  it("does not promise that deleting affects nobody else", () => {
    const text = deleteConsequences(pkg({}), 3, 0).join(" ");
    expect(text).toMatch(/Other people's sessions that use it may fail/);
    expect(text).toMatch(/None of your running sessions/);
    expect(deleteConsequences(pkg({ scope: "user", owner: me }), 1, 2).join(" ")).toMatch(/2 of your sessions use/);
  });
});
