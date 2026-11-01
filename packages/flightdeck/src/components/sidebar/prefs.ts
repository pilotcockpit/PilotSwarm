import * as React from "react";
import { usePref } from "@/shell/prefs";
import type { StateKey } from "@/data/state";

// What the sidebar remembers about each person, in this browser only (the API has no pin and no
// per-person sidebar state; see OPEN-ITEMS.md). Values are JSON strings behind the shared usePref
// store, so every component that reads them re-renders together and a reload keeps them.

const parse = <T,>(raw: string, fallback: T): T => {
  try { const v = JSON.parse(raw); return v == null ? fallback : (v as T); } catch { return fallback; }
};

export function usePins() {
  const [raw, setRaw] = usePref<string>("fd.pins", "[]");
  const ids = React.useMemo(() => new Set(parse<unknown[]>(raw, []).filter((x): x is string => typeof x === "string")), [raw]);
  const toggle = React.useCallback((id: string) => {
    const next = new Set(parse<string[]>(raw, []));
    if (next.has(id)) next.delete(id); else next.add(id);
    setRaw(JSON.stringify([...next]));
  }, [raw, setRaw]);
  return { ids, isPinned: (id: string) => ids.has(id), toggle };
}

export type GroupBy = "groups" | "agent";
export type StateFilter = StateKey | null;

export function useSidebarPrefs() {
  const [collapsedRaw, setCollapsedRaw] = usePref<string>("fd.sidebar.collapsed", "{}");
  const [groupBy, setGroupBy] = usePref<GroupBy>("fd.sidebar.groupBy", "groups");
  const [stateRaw, setStateRaw] = usePref<string>("fd.sidebar.state", "");
  const [systemRaw, setSystemRaw] = usePref<string>("fd.sidebar.system", "no");
  const collapsed = React.useMemo(() => parse<Record<string, boolean>>(collapsedRaw, {}), [collapsedRaw]);
  const toggleSection = React.useCallback((key: string) => {
    setCollapsedRaw(JSON.stringify({ ...collapsed, [key]: !collapsed[key] }));
  }, [collapsed, setCollapsedRaw]);
  return {
    collapsed,
    toggleSection,
    groupBy,
    setGroupBy,
    state: (stateRaw || null) as StateFilter,
    setState: (s: StateFilter) => setStateRaw(s || ""),
    showSystem: systemRaw === "yes",
    setShowSystem: (v: boolean) => setSystemRaw(v ? "yes" : "no"),
  };
}
