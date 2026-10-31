import type { FeatureFlag, Group } from "./types";

const rows = (raw: any, key: string): any[] => Array.isArray(raw) ? raw : Array.isArray(raw?.[key]) ? raw[key] : [];

/** SDK SessionGroupRow uses groupId/title; the portal's common view uses id/name. */
export function normalizeSessionGroups(raw: unknown): Group[] {
  return rows(raw, "groups").map((g) => ({ ...g, id: String(g.groupId ?? g.id), name: String(g.title ?? g.name ?? "Untitled group") }));
}

/** A FeatureView contains rows, not a dictionary. `false` is an effective value. */
export function normalizeFeatureFlags(catalog: unknown, cluster: unknown): FeatureFlag[] {
  const views = new Map(rows(cluster, "flags").map((f) => [f.featureKey ?? f.key, f]));
  return rows(catalog, "flags").map((f) => {
    const key = f.featureKey ?? f.key ?? f.name;
    const view = views.get(key);
    return { ...f, ...view, key, default: f.defaultEnabled ?? f.default, value: view?.effective ?? f.effective ?? f.value ?? f.defaultEnabled ?? f.default };
  });
}
