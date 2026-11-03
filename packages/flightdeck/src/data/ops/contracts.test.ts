import { describe, expect, it } from "vitest";
import { describeFlagChange, normalizePackageFile, normalizeUsageReport } from "./contracts";

// The wire shapes below are copied from the SDK: ProviderUsageReport (management-client.ts),
// getAgentPackageFile's return, and the authz audit rows written by cms_feature_mutate.

describe("normalizeUsageReport", () => {
  const wire = {
    totals: { tokensTotal: 4200, turns: 7, sessions: 3 },
    daily: [{ dayUtc: "2026-10-29", tokensTotal: 1000, turns: 2, tokensInput: 700, tokensOutput: 200, tokensCacheRead: 100, tokensCacheWrite: 0 }, { dayUtc: "2026-10-30", tokensTotal: 3200, turns: 5, tokensInput: 0, tokensOutput: 0, tokensCacheRead: 0, tokensCacheWrite: 0 }],
    breakdown: [{ key: "azure:gpt-5", label: "gpt-5", tokensTotal: 4000, turns: 6 }],
    dimension: "model", truncated: false,
  };
  it("reads dayUtc and tokensTotal, the fields the server really sends", () => {
    const r = normalizeUsageReport(wire);
    expect(r.totals).toEqual({ total: 4200, turns: 7, sessions: 3 });
    expect(r.daily.map((d) => [d.day, d.total])).toEqual([["2026-10-29", 1000], ["2026-10-30", 3200]]);
    expect(r.breakdown[0]).toEqual({ key: "azure:gpt-5", label: "gpt-5", total: 4000, turns: 6 });
  });
  it("never shows NaN for a missing or odd field", () => {
    const r = normalizeUsageReport({ totals: {}, daily: [{ dayUtc: "d" }], breakdown: [{ key: "k", tokensTotal: "x" }] });
    expect(r.totals.total).toBe(0);
    expect(r.daily[0].total).toBe(0);
    expect(r.breakdown[0]).toMatchObject({ key: "k", label: "k", total: 0 });
    expect(normalizeUsageReport(null).daily).toEqual([]);
  });
});

describe("normalizePackageFile", () => {
  it("maps utf8 content to text", () => {
    expect(normalizePackageFile({ path: "README.md", size: 5, truncated: false, binary: false, encoding: "utf8", content: "hello" })).toEqual({ path: "README.md", text: "hello", binary: false, truncated: false, size: 5 });
  });
  it("never puts base64 in the text of a binary file", () => {
    const r = normalizePackageFile({ path: "a.png", size: 9, binary: true, encoding: "base64", content: "AAEC" });
    expect(r).toMatchObject({ binary: true, text: "" });
  });
  it("flags a truncated preview and survives a missing body", () => {
    expect(normalizePackageFile({ truncated: true, encoding: "utf8", content: "x" }).truncated).toBe(true);
    expect(normalizePackageFile({}).text).toBe("");
  });
});

describe("describeFlagChange", () => {
  const row = (action: string, details: any, target = "sessions.steering") => ({ audit_id: "9", occurred_at: "2026-10-30T10:00:00Z", actor_subject: "Sam", action, target, details });
  const setting = (o: any) => ({ featureKey: "sessions.steering", scope: "cluster", userId: null, revision: "3", ...o });
  it("says turned on / off from details.after", () => {
    expect(describeFlagChange(row("feature_flag.set", { scope: "cluster", before: null, after: setting({ enabled: true, allowUserOverride: true }) })).summary).toBe("turned on, people can choose");
    expect(describeFlagChange(row("feature_flag.set", { scope: "cluster", before: setting({ enabled: true, allowUserOverride: true }), after: setting({ enabled: false, allowUserOverride: true }) })).summary).toBe("turned off");
  });
  it("says locked when only the override policy changed", () => {
    const r = describeFlagChange(row("feature_flag.set", { scope: "cluster", before: setting({ enabled: true, allowUserOverride: true }), after: setting({ enabled: true, allowUserOverride: false }) }));
    expect(r.summary).toBe("locked for everyone");
  });
  it("describes resets and personal changes, with the person", () => {
    expect(describeFlagChange(row("feature_flag.unset", { scope: "cluster", before: setting({ enabled: true }), after: null })).summary).toBe("reset to the default");
    const mine = describeFlagChange(row("feature_flag.set", { scope: "user", userId: 7, before: null, after: setting({ scope: "user", userId: 7, enabled: false, allowUserOverride: null }) }));
    expect(mine.summary).toBe("turned off");
    expect(mine.scope).toBe("user");
    expect(mine.userId).toBe(7);
    expect(describeFlagChange(row("feature_flag.unset", { scope: "user", userId: 7, before: setting({}), after: null })).summary).toBe("removed a personal choice");
    expect(describeFlagChange(row("feature_flag.user_adopt", { scope: "user", userId: 7, before: null, after: null })).summary).toBe("adopted a personal choice");
  });
  it("reads the feature key from details or the target, and never throws on a bare row", () => {
    expect(describeFlagChange(row("feature_flag.set", { featureKey: "a.b", before: null, after: setting({ enabled: true }) }, "feature:x.y")).featureKey).toBe("a.b");
    expect(describeFlagChange({ action: "feature_flag.set", target: "feature:x.y" }).featureKey).toBe("x.y");
    expect(describeFlagChange({}).summary).toBe("changed");
  });
});

describe("normalizeArtifactPreview (readArtifactBase64)", () => {
  it("decodes UTF-8 from the base64 envelope and carries the server's truncated flag", async () => {
    const { normalizeArtifactPreview } = await import("./contracts");
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode("<p>héllo ✓</p>")));
    expect(normalizeArtifactPreview({ filename: "c.html", base64: b64, truncated: false })).toEqual({ text: "<p>héllo ✓</p>", truncated: false });
    expect(normalizeArtifactPreview({ base64: b64, truncated: true }).truncated).toBe(true);
    expect(normalizeArtifactPreview(null)).toEqual({ text: "", truncated: false });
  });
});
