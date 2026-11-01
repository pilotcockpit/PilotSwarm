import * as React from "react";

// Per-viewer interface preferences. Kept in this browser on purpose: Flight
// Deck must not overwrite the classic portal's roaming profile settings while
// both run side by side.

export type Theme = "dark" | "light" | "system";

// When the browser refuses storage (private windows, a full quota), a change still takes effect for this
// page: the value is held in memory and read back ahead of storage until a write succeeds again.
const memory = new Map<string, string>();

function read<T extends string>(key: string, fallback: T): T {
  if (memory.has(key)) return (memory.get(key) as T) || fallback;
  try { return (localStorage.getItem(key) as T) || fallback; } catch { return fallback; }
}
function write(key: string, value: string) {
  try { localStorage.setItem(key, value); memory.delete(key); } catch { memory.set(key, value); }
}

// Density was a setting once. There is one layout now: drop what the old setting left behind.
try { localStorage.removeItem("fd.density"); } catch { /* storage unavailable */ }
try { delete document.documentElement.dataset.density; } catch { /* no document */ }

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const value = React.useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => read(key, fallback),
  );
  const set = React.useCallback((v: T) => { write(key, v); emit(); }, [key]);
  return [value, set];
}

export function useTheme() {
  const [theme, setTheme] = usePref<Theme>("fd.theme", "system");
  React.useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);
  return [theme, setTheme] as const;
}

export function useMediaQuery(query: string) {
  return React.useSyncExternalStore(
    (cb) => { const mq = matchMedia(query); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); },
    () => matchMedia(query).matches,
  );
}

export const CLASSIC_PORTAL_URL: string = (import.meta.env.VITE_CLASSIC_URL as string | undefined) || "http://localhost:3001";
