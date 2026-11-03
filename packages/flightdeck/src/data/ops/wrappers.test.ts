import { beforeAll, describe, expect, it } from "vitest";
import { callDemoOp } from "./index";
import { runRequest } from "./use-op";
import { changeSentence, flagChangesRequest, type FlagChange } from "./flags";
import { editableTokens, initialLimitText, parseTokens, providerUsageRequest } from "./providers";
import { packageFileRequest, type PackageSummary } from "./packages";

// These run the SAME request objects the screens run (the ones the hooks are built from), against a
// stubbed `call` that answers with the wire shapes the SDK really sends. Reverting any adapter fails them.

const stub = (answers: Record<string, unknown>) => {
  const seen: Array<{ op: string; params: any }> = [];
  return { seen, call: async (op: string, params?: any) => { seen.push({ op, params }); return answers[op]; } };
};

describe("provider usage (getProviderUsage)", () => {
  const wire = {
    totals: { tokensTotal: 9_300_000, turns: 120, sessions: 9 },
    daily: [{ dayUtc: "2026-10-29", tokensTotal: 4_000_000, turns: 50, tokensInput: 3_000_000, tokensOutput: 800_000, tokensCacheRead: 200_000, tokensCacheWrite: 0 }, { dayUtc: "2026-10-30", tokensTotal: 5_300_000, turns: 70, tokensInput: 0, tokensOutput: 0, tokensCacheRead: 0, tokensCacheWrite: 0 }],
    breakdown: [{ key: "anthropic-wif:claude-sonnet-5-5", label: "claude-sonnet-5-5", tokensTotal: 9_000_000, turns: 100 }],
    dimension: "model", truncated: false,
  };
  it("asks for the model breakdown and shows real numbers", async () => {
    const s = stub({ getProviderUsage: wire });
    const r = await runRequest(s, providerUsageRequest("anthropic-wif", 14));
    expect(s.seen[0]).toEqual({ op: "getProviderUsage", params: { provider: "anthropic-wif", days: 14, dimension: "model" } });
    expect(r.totals.total).toBe(9_300_000);
    expect(r.daily.map((d) => [d.day, d.total])).toEqual([["2026-10-29", 4_000_000], ["2026-10-30", 5_300_000]]);
    expect(r.breakdown[0]).toMatchObject({ label: "claude-sonnet-5-5", total: 9_000_000, turns: 100 });
  });
});

describe("limit editor", () => {
  it("opens on the exact saved limit, so saving without edits changes nothing", () => {
    for (const quota of [1_234_567, 10_000_000, 999_999]) expect(parseTokens(initialLimitText(quota))).toBe(quota);
    expect(initialLimitText(1_234_567)).toBe("1234567");
    expect(initialLimitText(null)).toBe("");
    expect(editableTokens(5)).toBe("5");
  });
  it("still takes compact input", () => {
    expect(parseTokens("1.5M")).toBe(1_500_000);
    expect(parseTokens("250k")).toBe(250_000);
    expect(parseTokens("lots")).toBeNull();
  });
});

describe("package file preview (getAgentPackageFile)", () => {
  const pkg = { packageId: "p", name: "ops-toolkit", scope: "shared", owner: null, enabled: true, canEdit: false, active: null } as PackageSummary;
  it("shows the file's text from the server's `content`", async () => {
    const s = stub({ getAgentPackageFile: { name: "ops-toolkit", semver: "1.0.0", path: "README.md", size: 7, truncated: false, binary: false, encoding: "utf8", content: "# Hello" } });
    const r = await runRequest(s, packageFileRequest(pkg, undefined, "README.md"));
    expect(s.seen[0].params).toMatchObject({ name: "ops-toolkit", scope: "shared", filePath: "README.md" });
    expect(r.text).toBe("# Hello");
    expect(r.binary).toBe(false);
  });
  it("shows no text for a binary file", async () => {
    const s = stub({ getAgentPackageFile: { path: "x.png", size: 3, truncated: false, binary: true, encoding: "base64", content: "AAEC" } });
    expect(await runRequest(s, packageFileRequest(pkg, undefined, "x.png"))).toMatchObject({ binary: true, text: "" });
  });
});

describe("feature flag history (listFeatureFlagChanges)", () => {
  const setting = (o: any) => ({ settingId: "1", featureKey: "sessions.steering", scope: "cluster", userId: null, enabled: true, allowUserOverride: true, revision: "3", updatedBy: "demo:sam", updatedAt: "2026-10-30T10:00:00Z", ...o });
  const row = (id: string, action: string, d: any) => ({ audit_id: id, occurred_at: "2026-10-30T10:00:00Z", actor_provider: "demo", actor_subject: "Sam Lee", action, target: "sessions.steering", decision: "allow", details: { actorKey: "demo:sam", requestId: "r", requestHash: "h", featureKey: "sessions.steering", revision: "3", ...d } });
  const wire = [
    row("5", "feature_flag.set", { scope: "cluster", userId: null, before: setting({ enabled: false }), after: setting({ enabled: true }) }),
    row("4", "feature_flag.set", { scope: "user", userId: 7, before: null, after: setting({ scope: "user", userId: 7, enabled: false, allowUserOverride: null }) }),
    row("3", "feature_flag.set", { scope: "cluster", userId: null, before: setting({}), after: setting({ allowUserOverride: false }) }),
  ];
  it("says what changed, from before and after", async () => {
    const r = await runRequest(stub({ listFeatureFlagChanges: wire }), flagChangesRequest);
    expect(r.map((c) => c.summary)).toEqual(["turned on", "turned off", "locked for everyone"]);
  });
  it("names the person for a personal change, from a directory, and falls back to a short id", async () => {
    const r = await runRequest(stub({ listFeatureFlagChanges: wire }), flagChangesRequest);
    const personal = r.find((c) => c.scope === "user") as FlagChange;
    expect(changeSentence(personal, (id) => (id === 7 ? "Priya Nair" : null))).toBe("turned off for Priya Nair");
    expect(changeSentence(personal, () => null)).toBe("turned off for user 7");
    expect(changeSentence(r[0], () => "x")).toBe("turned on");
  });
  it("prefers a name the audit row itself carries", () => {
    const withOwner = { ...wire[1], details: { ...wire[1].details, owner: { provider: "demo", subject: "priya", displayName: "Priya (row)" } } };
    return runRequest(stub({ listFeatureFlagChanges: [withOwner] }), flagChangesRequest).then(([c]) => expect(changeSentence(c, () => "Directory name")).toBe("turned off for Priya (row)"));
  });
});

// The demo fixtures go through the same adapters, so a fixture that drifts from the real shape shows up here.
describe("demo fixtures use the real wire shapes", () => {
  beforeAll(() => { (globalThis as any).window = { setTimeout }; });
  const demo = { call: (op: string, params?: any) => callDemoOp(op, params) };
  it("provider usage reads real numbers", async () => {
    const r = await runRequest(demo, providerUsageRequest("anthropic-wif", 14));
    expect(r.daily).toHaveLength(14);
    expect(r.daily.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day) && d.total > 0)).toBe(true);
    expect(r.totals.total).toBeGreaterThan(0);
  });
  it("flag history is described from before and after", async () => {
    const r = await runRequest(demo, flagChangesRequest);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((c) => c.summary !== "changed")).toBe(true);
  });
});
