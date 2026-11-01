import * as React from "react";

// App-level overlays that any screen can open: the New session sheet, the
// command palette and the shortcuts list.
interface UiState {
  newSession: { open: boolean; agent?: string | null; prompt?: string; group?: string | null };
  openNewSession: (opts?: { agent?: string | null; prompt?: string; group?: string | null }) => void;
  closeNewSession: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;
  /** The phone navigation drawer: closed, the menu, or the menu scrolled to the sessions list. */
  navOpen: false | "menu" | "sessions";
  setNavOpen: (v: false | "menu" | "sessions") => void;
  railCollapsed: boolean;
  setRailCollapsed: (v: boolean) => void;
  /** Overlays opened from state have no Radix trigger, so they return focus here on close. */
  restoreFocus: (e: Event) => void;
}

let returnTo: HTMLElement | null = null;
function remember() {
  // Opening one overlay from another (⌘K → New session) keeps the first opener.
  if (document.querySelector('[role="dialog"][data-state="open"]')) return;
  const el = document.activeElement as HTMLElement | null;
  returnTo = el && el !== document.body ? el : null;
}

const Ctx = React.createContext<UiState | null>(null);

export function UiStateProvider({ children }: { children: React.ReactNode }) {
  const [newSession, setNewSession] = React.useState<UiState["newSession"]>({ open: false });
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [navOpen, setNavOpenState] = React.useState<false | "menu" | "sessions">(false);
  const [railCollapsed, setRailCollapsedState] = React.useState(() => {
    try { return localStorage.getItem("fd.rail") === "collapsed"; } catch { return false; }
  });
  const setRailCollapsed = React.useCallback((v: boolean) => {
    setRailCollapsedState(v);
    try { localStorage.setItem("fd.rail", v ? "collapsed" : "open"); } catch { /* ignore */ }
  }, []);
  const value = React.useMemo<UiState>(() => ({
    newSession,
    openNewSession: (opts) => { remember(); setNewSession({ open: true, agent: opts?.agent ?? null, prompt: opts?.prompt ?? "", group: opts?.group ?? null }); },
    closeNewSession: () => setNewSession((s) => ({ ...s, open: false })),
    paletteOpen,
    setPaletteOpen: (v: boolean) => { if (v) remember(); setPaletteOpen(v); },
    shortcutsOpen,
    setShortcutsOpen: (v: boolean) => { if (v) remember(); setShortcutsOpen(v); },
    restoreFocus: (e: Event) => {
      e.preventDefault();
      // Another overlay took over (and owns focus now); it restores when it closes.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      const target = returnTo && document.contains(returnTo) ? returnTo : document.getElementById("main");
      returnTo = null;
      target?.focus();
    },
    navOpen,
    setNavOpen: (v) => { if (v) remember(); setNavOpenState(v); },
    railCollapsed,
    setRailCollapsed,
  }), [newSession, paletteOpen, shortcutsOpen, navOpen, railCollapsed, setRailCollapsed]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUi() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useUi outside UiStateProvider");
  return ctx;
}
