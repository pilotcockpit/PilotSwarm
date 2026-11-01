import { useNavigate } from "@tanstack/react-router";
import { ChevronsLeft, KeyRound, Moon, Rows3, Settings2, ShieldCheck, Sun, ToggleLeft } from "lucide-react";
import { useConnection, useProfile, useSource } from "@/data/source";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useDensity, useMediaQuery, useTheme } from "@/shell/prefs";
import { cn, initials } from "@/lib/utils";

/**
 * Everything about you and the deployment lives behind one menu at the foot of the sidebar: your
 * models and spend, administration, settings, how the app looks, and the connection. It replaces the
 * old "Manage" group, so the sidebar is for work and this is for setup.
 */
export function AccountMenu({ collapsed = false, onCollapse, onNavigate }: { collapsed?: boolean; onCollapse?: () => void; onNavigate?: () => void }) {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const state = useConnection();
  const { mode, setMode, source } = useSource();
  const [theme, setTheme] = useTheme();
  const [density, setDensity] = useDensity();
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const isDark = theme === "dark" || (theme === "system" && systemDark);
  const tone = mode === "demo" ? "bg-waiting" : state === "connected" ? "bg-live" : state === "reconnecting" ? "bg-waiting" : "bg-failed";
  const word = mode === "demo" ? "Demo data" : state === "connected" ? "Connected" : state === "reconnecting" ? "Reconnecting" : "Offline";
  const go = (to: string) => () => { onNavigate?.(); void navigate({ to }); };
  const trigger = (
    <MenuTrigger asChild>
      <button
        type="button"
        aria-label={`Account and settings, ${profile?.displayName || "you"}, ${word}`}
        className={cn("focus-inset relative flex min-h-11 items-center gap-2.5 rounded-control text-left transition-colors duration-(--duration-fast) hover:bg-raised/60", collapsed ? "w-10 justify-center" : "w-full px-2")}
      >
        <span className="relative grid size-7 shrink-0 place-items-center rounded-full bg-accent-tint text-xs font-semibold text-accent" aria-hidden>
          {initials(profile?.displayName)}
          <span className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface", tone)} />
        </span>
        {collapsed ? null : (
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-medium">{profile?.displayName || "…"}</span>
            <span className="block truncate text-xs text-faint">{profile?.isAdmin ? "Admin" : "Member"} · {word}</span>
          </span>
        )}
      </button>
    </MenuTrigger>
  );
  return (
    <Menu>
      {collapsed ? <Tooltip content="Account and settings" side="right">{trigger}</Tooltip> : trigger}
      <MenuContent align="start" side="top" className="w-62">
        <MenuLabel>{mode === "demo" ? "Demo data" : `${word} · ${source.label}`}</MenuLabel>
        <MenuItem icon={<KeyRound />} onSelect={go("/providers")} hint="Providers, limits and defaults">Models &amp; spend</MenuItem>
        {profile?.isAdmin ? <MenuItem icon={<ShieldCheck />} onSelect={go("/admin")} hint="Workers, flags, knowledge">Admin</MenuItem> : null}
        <MenuItem icon={<Settings2 />} onSelect={go("/settings")}>Settings</MenuItem>
        <MenuSeparator />
        <MenuItem icon={isDark ? <Sun /> : <Moon />} onSelect={() => setTheme(isDark ? "light" : "dark")}>{isDark ? "Switch to light theme" : "Switch to dark theme"}</MenuItem>
        <MenuItem icon={<Rows3 />} onSelect={() => setDensity(density === "compact" ? "comfortable" : "compact")}>Use {density === "compact" ? "comfortable" : "compact"} density</MenuItem>
        {mode === "demo" ? <MenuItem icon={<ToggleLeft />} onSelect={() => setMode("live")}>Use live data</MenuItem> : null}
        {onCollapse ? (
          <>
            <MenuSeparator />
            <MenuItem icon={<ChevronsLeft />} onSelect={onCollapse}>Collapse sidebar</MenuItem>
          </>
        ) : null}
      </MenuContent>
    </Menu>
  );
}
