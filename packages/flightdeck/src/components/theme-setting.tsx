import * as React from "react";
import { Moon, Monitor, Sun } from "lucide-react";
import { MenuLabel, MenuRadioGroup, MenuRadioItem } from "@/components/ui/menu";
import { Segmented } from "@/components/ui/tabs";
import { useTheme, type Theme } from "@/shell/prefs";

// The theme is set in ONE way, with one set of options, wherever it appears: Settings (a segmented
// control), the account menu (a radio group), and the command palette (three commands). There is no
// toggle in the top bar: a toggle cannot say what "System" is, and a choice you make once a year does not
// earn a permanent button.

export const THEME_OPTIONS: ReadonlyArray<{ value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const isTheme = (v: string): v is Theme => THEME_OPTIONS.some((o) => o.value === v);

/** System | Light | Dark as a segmented control: Settings, and the phone More sheet. */
export function ThemeSegmented({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  return <Segmented<Theme> label="Theme" className={className} value={theme} onChange={setTheme} options={THEME_OPTIONS.map(({ value, label }) => ({ value, label }))} />;
}

/** The same choice as a radio group inside a menu: the current one is checked. */
export function ThemeMenuItems() {
  const [theme, setTheme] = useTheme();
  return (
    <>
      <MenuLabel>Theme</MenuLabel>
      <MenuRadioGroup aria-label="Theme" value={theme} onValueChange={(v) => { if (isTheme(v)) setTheme(v); }}>
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <MenuRadioItem key={value} value={value} icon={<Icon />}>{label}</MenuRadioItem>
        ))}
      </MenuRadioGroup>
    </>
  );
}

/** Three fixed palette commands, found by "theme", "dark mode", "light mode" or "appearance". */
export function useThemeCommands() {
  const [, setTheme] = useTheme();
  return React.useMemo(() => THEME_OPTIONS.map(({ value, label, icon }) => ({
    value,
    label: `Theme: ${label}`,
    icon,
    keywords: ["theme", "dark mode", "light mode", "appearance"],
    run: () => setTheme(value),
  })), [setTheme]);
}
