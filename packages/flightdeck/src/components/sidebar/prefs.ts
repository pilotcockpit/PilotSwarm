import * as React from "react";
import { useProfile, useSource } from "@/data/source";
import { usePref } from "@/shell/prefs";
import { STATE_WORD, type StateKey } from "@/data/state";

// What the sidebar remembers about each person, in this browser only (the API has no pin and no
// per-person sidebar state; see OPEN-ITEMS.md). Values are JSON strings behind the shared usePref
// store, so every component that reads them re-renders together and a reload keeps them.
//
// Every key carries a scope, the data source plus the signed-in person, so two people on one
// browser (or the demo and a live server) never see each other's pins, filters or collapsed groups.
// Stored values are untrusted: anything of the wrong shape reads as the default.

export type GroupBy = "groups" | "agent";
export type StateFilter = StateKey | null;

/** The scope for this person and data source, or null until the profile has loaded. */
export function usePrefsScope(): string | null {
  const { mode } = useSource();
  const { data: profile } = useProfile();
  if (!profile) return null;
  const who = String((profile as any).subject ?? profile.email ?? profile.displayName ?? "me");
  return `${mode}:${String(profile.provider ?? "-")}:${who}`;
}

export const prefKey = (scope: string | null, name: string) => `fd.${name}${scope ? `@${scope}` : "@pending"}`;

const parse = (raw: string): unknown => { try { return JSON.parse(raw); } catch { return undefined; } };

export function readStringSet(raw: string): Set<string> {
  const v = parse(raw);
  return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
}
export function readBooleanRecord(raw: string): Record<string, boolean> {
  const v = parse(raw);
  const out: Record<string, boolean> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) for (const [k, b] of Object.entries(v as Record<string, unknown>)) if (typeof b === "boolean") out[k] = b;
  return out;
}
export const readGroupBy = (raw: string): GroupBy => (raw === "agent" ? "agent" : "groups");
export const readStateFilter = (raw: string): StateFilter => (raw && Object.prototype.hasOwnProperty.call(STATE_WORD, raw) ? (raw as StateKey) : null);

export function usePins() {
  const scope = usePrefsScope();
  const [raw, setRaw] = usePref<string>(prefKey(scope, "pins"), "[]");
  const ids = React.useMemo(() => readStringSet(raw), [raw]);
  const toggle = React.useCallback((id: string) => {
    if (!scope) return; // no profile yet: there is no person to save a pin for
    const next = new Set(readStringSet(raw));
    if (next.has(id)) next.delete(id); else next.add(id);
    setRaw(JSON.stringify([...next]));
  }, [raw, scope, setRaw]);
  return { ids, isPinned: (id: string) => ids.has(id), toggle };
}

export function useSidebarPrefs() {
  const scope = usePrefsScope();
  const [collapsedRaw, setCollapsedRaw] = usePref<string>(prefKey(scope, "sidebar.collapsed"), "{}");
  const [groupByRaw, setGroupBy] = usePref<string>(prefKey(scope, "sidebar.groupBy"), "groups");
  const [stateRaw, setStateRaw] = usePref<string>(prefKey(scope, "sidebar.state"), "");
  const [systemRaw, setSystemRaw] = usePref<string>(prefKey(scope, "sidebar.system"), "no");
  const collapsed = React.useMemo(() => readBooleanRecord(collapsedRaw), [collapsedRaw]);
  const toggleSection = React.useCallback((key: string) => {
    if (!scope) return;
    setCollapsedRaw(JSON.stringify({ ...collapsed, [key]: !collapsed[key] }));
  }, [collapsed, scope, setCollapsedRaw]);
  return {
    collapsed,
    toggleSection,
    groupBy: readGroupBy(groupByRaw),
    setGroupBy: (g: GroupBy) => { if (scope) setGroupBy(g); },
    state: readStateFilter(stateRaw),
    setState: (s: StateFilter) => { if (scope) setStateRaw(s || ""); },
    showSystem: systemRaw === "yes",
    setShowSystem: (v: boolean) => { if (scope) setSystemRaw(v ? "yes" : "no"); },
  };
}
