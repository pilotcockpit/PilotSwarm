import * as React from "react";

// Per-viewer interface preferences. Kept in this browser on purpose: Flight
// Deck must not overwrite the classic portal's roaming profile settings while
// both run side by side.

export type Theme = "dark" | "light" | "system";
export type Density = "compact" | "comfortable";

function read<T extends string>(key: string, fallback: T): T {
  try { return (localStorage.getItem(key) as T) || fallback; } catch { return fallback; }
}
function write(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

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
  const [theme, setTheme] = usePref<Theme>("fd.theme", "dark");
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

export function useDensity() {
  const [density, setDensity] = usePref<Density>("fd.density", "compact");
  React.useEffect(() => { document.documentElement.dataset.density = density; }, [density]);
  return [density, setDensity] as const;
}

export function useMediaQuery(query: string) {
  return React.useSyncExternalStore(
    (cb) => { const mq = matchMedia(query); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); },
    () => matchMedia(query).matches,
  );
}

export const CLASSIC_PORTAL_URL: string = (import.meta.env.VITE_CLASSIC_URL as string | undefined) || "http://localhost:3001";
