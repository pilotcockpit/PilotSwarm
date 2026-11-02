import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProfile, useSource } from "@/data/source";
import { createSettingsWriter, readDismissed, readPinnedProjects, readPins, settingsOf, withDismissed, withoutDismissed, withPin, withPinnedProject, withPins, type Settings } from "@/data/ops/roaming-settings";
import { usePref } from "@/shell/prefs";

// What the sidebar remembers about each person.
//
// Pins and dismissed failures roam: they live in the person's profile settings on the server, so a pin made
// on a laptop is there on a phone (see data/ops/roaming-settings.ts). Which section is collapsed and which
// folder is open are per browser: they describe this screen, not the person.
//
// Browser-held values carry a scope, the data source plus the signed-in person, so two people on one
// browser (or the demo and a live server) never see each other's. They are untrusted: anything of the wrong
// shape reads as the default. If the server cannot store profile settings, pins and dismissals fall back to
// the browser and the sidebar says so.

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
const writers = new WeakMap<object, ReturnType<typeof createSettingsWriter>>();

// What the page shows is the server's last known document with every change still on its way applied on top. Keeping
// the two apart is what lets a change that lands, or one that fails, leave the others still shown: pinning A then B
// shows both at once, A landing does not hide B, and A and B failing in turn each put back only themselves.
// One store per data source and person, shared by every hook that reads the document.
type Pending = { mutate: (s: Settings) => Settings };
type Store = { committed: Settings | undefined; pending: Pending[]; /** Counts finished writes, so a read that started before one cannot replace what it saved. */ writes: number };
const stores = new WeakMap<object, Map<string, Store>>();
function storeFor(source: object, scope: string): Store {
  let byScope = stores.get(source);
  if (!byScope) { byScope = new Map(); stores.set(source, byScope); }
  let store = byScope.get(scope);
  if (!store) { store = { committed: undefined, pending: [], writes: 0 }; byScope.set(scope, store); }
  return store;
}
const shown = (store: Store): Settings => store.pending.reduce((s, p) => p.mutate(s), store.committed ?? {});

/**
 * The person's roaming settings document: cached, refreshed when the window regains focus and every 30 s,
 * and changed optimistically (the page shows the change at once, the server write follows, and a failed
 * write takes back only that change and says so). `available` is false when the server cannot store settings.
 * `update` resolves true once the change is saved, false when it was not.
 */
export function useRoamingSettings() {
  const { source } = useSource();
  const qc = useQueryClient();
  const scope = usePrefsScope();
  const key = React.useMemo(() => ["roaming-settings", scope] as const, [scope]);
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(scope),
    queryFn: async () => {
      const store = storeFor(source, scope as string);
      const writesAtStart = store.writes;
      const doc = settingsOf(await source.call("getCurrentUserProfile"));
      // A write that finished while this read was on its way has already updated the document; this read is older than it.
      if (store.writes === writesAtStart) store.committed = doc;
      return shown(store);
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const update = React.useCallback(async (mutate: (s: Settings) => Settings, failure = "Couldn't save that"): Promise<boolean> => {
    if (!scope) return false;
    let write = writers.get(source);
    if (!write) { write = createSettingsWriter((op, params) => source.call(op, params)); writers.set(source, write); }
    const store = storeFor(source, scope);
    if (store.committed === undefined) store.committed = qc.getQueryData<Settings>(key) ?? {};
    const entry: Pending = { mutate };
    store.pending.push(entry);
    qc.setQueryData<Settings>(key, shown(store));
    try {
      const next = await write(mutate);
      store.pending = store.pending.filter((p) => p !== entry);
      store.writes++;
      store.committed = next;
      qc.setQueryData<Settings>(key, shown(store));
      return true;
    } catch (e: any) {
      store.pending = store.pending.filter((p) => p !== entry);
      store.writes++;
      qc.setQueryData<Settings>(key, shown(store));
      toast.error(failure, { description: e?.message });
      return false;
    }
  }, [source, qc, key, scope]);
  return { settings: query.data, available: query.data !== undefined, loading: query.isLoading, update };
}

export function usePins() {
  const scope = usePrefsScope();
  const roaming = useRoamingSettings();
  const [localRaw, setLocalRaw] = usePref<string>(prefKey(scope, "pins"), "[]");
  const local = React.useMemo(() => [...readStringSet(localRaw)], [localRaw]);
  const remote = React.useMemo(() => (roaming.settings ? readPins(roaming.settings) : null), [roaming.settings]);
  const order = remote ?? local;
  const ids = React.useMemo(() => new Set(order), [order]);

  // Pins made before pins roamed were kept in this browser. The first time the server's list is read and has
  // none of them, carry them over once, then forget them here once they are saved.
  const moved = React.useRef(false);
  React.useEffect(() => {
    if (moved.current || remote === null || !local.length) return;
    moved.current = true;
    const missing = local.filter((id) => !remote.includes(id));
    if (!missing.length) { setLocalRaw("[]"); return; }
    // The browser's copy is forgotten only once the account has them: a failed save leaves the pins here.
    void roaming.update((s) => withPins(s, [...readPins(s), ...missing]), "Couldn't move your pins to your account").then((saved) => { if (saved) setLocalRaw("[]"); });
  }, [remote, local, roaming, setLocalRaw]);

  const toggle = React.useCallback((id: string) => {
    if (!scope) return; // no profile yet: there is no person to save a pin for
    const on = !order.includes(id);
    if (remote !== null) { roaming.update((s) => withPin(s, id, on), on ? "Couldn't pin that" : "Couldn't unpin that"); return; }
    setLocalRaw(JSON.stringify(on ? [...local, id] : local.filter((x) => x !== id)));
  }, [scope, order, remote, roaming, local, setLocalRaw]);

  // Pinned projects: their own list, kept with the same fallback to this browser.
  const [localProjectsRaw, setLocalProjectsRaw] = usePref<string>(prefKey(scope, "pins.projects"), "[]");
  const localProjects = React.useMemo(() => [...readStringSet(localProjectsRaw)], [localProjectsRaw]);
  const remoteProjects = React.useMemo(() => (roaming.settings ? readPinnedProjects(roaming.settings) : null), [roaming.settings]);
  const projects = remoteProjects ?? localProjects;
  const toggleProject = React.useCallback((id: string) => {
    if (!scope) return;
    const on = !projects.includes(id);
    if (remoteProjects !== null) { roaming.update((s) => withPinnedProject(s, id, on), on ? "Couldn't pin that project" : "Couldn't unpin that project"); return; }
    setLocalProjectsRaw(JSON.stringify(on ? [...localProjects, id] : localProjects.filter((x) => x !== id)));
  }, [scope, projects, remoteProjects, roaming, localProjects, setLocalProjectsRaw]);

  return { order, ids, isPinned: (id: string) => ids.has(id), toggle, roaming: remote !== null, /** False while the account's pins are still loading. */ settled: !roaming.loading, projects, isProjectPinned: (id: string) => projects.includes(id), toggleProject };
}

/** Failures the person has dismissed. A dismissal is remembered per occurrence: the same session failing again is new. */
export function useDismissedAttention() {
  const scope = usePrefsScope();
  const roaming = useRoamingSettings();
  const [localRaw, setLocalRaw] = usePref<string>(prefKey(scope, "dismissed"), "[]");
  const keys = React.useMemo(() => new Set(roaming.settings ? Object.keys(readDismissed(roaming.settings)) : [...readStringSet(localRaw)]), [roaming.settings, localRaw]);
  const dismiss = React.useCallback((key: string) => {
    if (!scope) return;
    if (roaming.available) roaming.update((s) => withDismissed(s, key, Date.now()), "Couldn't dismiss that");
    else setLocalRaw(JSON.stringify([...readStringSet(localRaw), key].slice(-200)));
  }, [scope, roaming, localRaw, setLocalRaw]);
  const restore = React.useCallback((key: string) => {
    if (roaming.available) roaming.update((s) => withoutDismissed(s, key), "Couldn't undo that");
    else setLocalRaw(JSON.stringify([...readStringSet(localRaw)].filter((k) => k !== key)));
  }, [roaming, localRaw, setLocalRaw]);
  return { keys, dismiss, restore };
}

// The sidebar starts folded on every load: five closed headings, with the count pill on Needs you saying what
// waits. What the person opens afterwards is kept only for this visit (so closing and reopening the phone
// drawer does not fold it again), never across loads. Opening a session from a link still opens the one
// section and project it sits in (see the reveal effect in sessions-sidebar.tsx).
export const SIDEBAR_SECTIONS = ["needs", "pinned", "projects", "noproject", "recent"] as const;
type View = { open: ReadonlySet<string>; project: string };
const FOLDED: View = { open: new Set(), project: "" };
let view: View = FOLDED;
const listeners = new Set<() => void>();
const setView = (next: View) => { view = next; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Back to a fresh load: everything folded, or just the sections named open. For tests and for signing out. */
export function resetSidebarView(open: readonly string[] = []) { setView(open.length ? { open: new Set(open), project: "" } : FOLDED); }

/**
 * The sidebar used to remember which sections were folded and which project was open, in `fd.sidebar.collapsed@…` and
 * `fd.sidebar.project@…`. It no longer does (it loads folded), so those keys are removed once, whoever wrote them.
 */
export function forgetOldSidebarKeys(given?: Pick<Storage, "length" | "key" | "removeItem">) {
  try {
    const storage = given ?? localStorage;
    const old: string[] = [];
    for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && /^fd\.sidebar\.(collapsed|project)@/.test(k)) old.push(k); }
    old.forEach((k) => storage.removeItem(k));
  } catch { /* storage unavailable: nothing was kept */ }
}

/** This visit's view of the sidebar: which sections are open, and which project (at most one) is open. Everything starts folded. */
export function useSidebarPrefs() {
  const scope = usePrefsScope();
  React.useEffect(() => { forgetOldSidebarKeys(); }, []);
  const current = React.useSyncExternalStore(subscribe, () => view, () => FOLDED);
  // One project is open at a time, under Pinned or under Projects: it never opens in both, which would list its sessions twice.
  const openProject = React.useMemo((): { id: string; where: "pinned" | "projects" } | null => {
    const raw = current.project;
    if (!raw) return null;
    return raw.startsWith("pinned/") ? { id: raw.slice(7), where: "pinned" } : { id: raw.replace(/^projects\//, ""), where: "projects" };
  }, [current.project]);
  const collapsed = React.useMemo(() => Object.fromEntries(SIDEBAR_SECTIONS.map((k) => [k, !current.open.has(k)])) as Record<string, boolean>, [current.open]);
  const toggleSection = React.useCallback((key: string) => {
    const open = new Set(view.open);
    if (!open.delete(key)) open.add(key);
    setView({ ...view, open });
  }, []);
  return {
    /** False until the profile has loaded: pins and dismissals need a person, so the reveal waits for one. */
    ready: Boolean(scope),
    collapsed,
    toggleSection,
    openProject,
    setOpenProject: (id: string | null, where: "pinned" | "projects" = "projects") => setView({ ...view, project: id ? `${where}/${id}` : "" }),
  };
}
