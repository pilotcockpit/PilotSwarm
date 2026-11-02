import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useUi } from "./ui-state";
import { usePref } from "./prefs";
import { Switch } from "@/components/ui/misc";

// Single keys only navigate or open things. Nothing destructive has a single
// key; Complete, Cancel and Delete live in menus and ask first.
const GO: Record<string, string> = { h: "/", s: "/projects", b: "/boards", o: "/outputs", l: "/library", p: "/providers", a: "/admin" };

export const SHORTCUTS: Array<{ keys: string[]; what: string }> = [
  { keys: ["⌘", "K"], what: "Search sessions, agents and commands" },
  { keys: ["N"], what: "New session" },
  { keys: ["?"], what: "Show keyboard shortcuts" },
  { keys: ["G", "H"], what: "Go to Home" },
  { keys: ["G", "S"], what: "Go to Sessions" },
  { keys: ["G", "B"], what: "Go to Boards" },
  { keys: ["G", "O"], what: "Go to Outputs" },
  { keys: ["G", "L"], what: "Go to Agent library" },
  { keys: ["G", "P"], what: "Go to Providers" },
  { keys: ["G", "A"], what: "Go to Admin" },
  { keys: ["Enter"], what: "Send message (in the composer)" },
  { keys: ["Shift", "Enter"], what: "New line (in the composer)" },
  { keys: ["Esc"], what: "Close a dialog, leave focus mode" },
];

function typing(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || Boolean(el.closest?.("[cmdk-root]"));
}

export function useGlobalShortcuts() {
  const { setPaletteOpen, openNewSession, setShortcutsOpen } = useUi();
  const navigate = useNavigate();
  const [enabled] = useShortcutsPref();
  React.useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      // Single-key shortcuts can be turned off (WCAG 2.1.4); ⌘K always works.
      if (enabled !== "on" || e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector("[role=dialog]")) return;
      const key = e.key.toLowerCase();
      if (pendingG && Date.now() - pendingG < 1200 && GO[key]) {
        e.preventDefault();
        pendingG = 0;
        void navigate({ to: GO[key] });
        return;
      }
      pendingG = 0;
      if (key === "g") { pendingG = Date.now(); return; }
      if (key === "n") { e.preventDefault(); openNewSession(); return; }
      if (e.key === "?") { e.preventDefault(); setShortcutsOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, navigate, openNewSession, setPaletteOpen, setShortcutsOpen]);
}

export function useShortcutsPref() {
  return usePref<"on" | "off">("fd.shortcuts", "on");
}

export function ShortcutList() {
  const [enabled, setEnabled] = useShortcutsPref();
  return (
    <>
    <label className="flex items-center justify-between gap-4 border-b border-line py-3 text-sm">
      <span><span className="font-medium">Single-key shortcuts</span><span className="block text-xs text-muted">N, ?, and G then a letter. ⌘K always works.</span></span>
      <Switch checked={enabled === "on"} onCheckedChange={(v) => setEnabled(v ? "on" : "off")} aria-label="Single-key shortcuts" />
    </label>
    <dl className="divide-y divide-line">
      {SHORTCUTS.map((s) => (
        <div key={s.what} className="flex items-center justify-between gap-4 py-2 text-sm">
          <dt className="text-fg">{s.what}</dt>
          <dd className="flex shrink-0 gap-1">{s.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</dd>
        </div>
      ))}
    </dl>
    </>
  );
}

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen, restoreFocus } = useUi();
  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent onCloseAutoFocus={restoreFocus} title="Keyboard shortcuts" description="Single keys only navigate. Anything destructive is in a menu and asks first.">
        <DialogBody><ShortcutList /></DialogBody>
      </DialogContent>
    </Dialog>
  );
}
