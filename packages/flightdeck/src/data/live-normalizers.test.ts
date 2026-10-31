import { describe, expect, it } from "vitest";
import { normalizeFeatureFlags, normalizeSessionGroups } from "./live-normalizers";

describe("SDK view contracts", () => {
  it("maps current group identity and title for session placement", () => {
    expect(normalizeSessionGroups([{ groupId: "ops", title: "Operations", memberCount: 3 }])).toEqual([{ groupId: "ops", title: "Operations", memberCount: 3, id: "ops", name: "Operations" }]);
  });
  it("uses effective false instead of an enabled feature default", () => {
    const catalog = [{ featureKey: "canvas.apps", defaultEnabled: true, displayName: "Canvas apps" }];
    const result = normalizeFeatureFlags(catalog, { userId: null, flags: [{ ...catalog[0], effective: false, source: "cluster" }] });
    expect(result[0]).toMatchObject({ key: "canvas.apps", default: true, value: false, source: "cluster" });
  });
  it("reads an effective enabled feature from its row, not an array index", () => {
    expect(normalizeFeatureFlags([{ featureKey: "agents.base", defaultEnabled: false }], { flags: [{ featureKey: "agents.base", effective: true }] })[0].value).toBe(true);
  });
});
