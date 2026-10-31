import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Undo for a change that was just made. Where it shows depends on whether a modal dialog is open:
 *
 * - No modal open: a normal toast, as before.
 * - A modal sheet is open: the Undo appears INSIDE that dialog, in a polite status region. A modal traps
 *   focus, so a toast outside it cannot be reached by keyboard (Tab and Sonner's hotkey both land back in
 *   the dialog). Inside, it is simply the next thing Tab reaches.
 *
 * It is never both, so it is announced once. Same 8 second window either way; the window pauses while the
 * pointer or focus is on the Undo. If the dialog closes with an Undo still pending, the Undo moves to a
 * toast for the time it has left, so closing a sheet never loses it.
 */

export const UNDO_MS = 8000;

interface Item {
  id: number;
  message: string;
  description?: string;
  onUndo: () => void;
  remaining: number;
}
interface Host { key: symbol; show: (item: Omit<Item, "id" | "remaining"> & { duration: number }) => void }

const hosts: Host[] = [];
let seq = 0;

export function notifyUndo(message: string, onUndo: () => void, opts?: { description?: string; duration?: number }) {
  const duration = opts?.duration ?? UNDO_MS;
  const host = hosts[hosts.length - 1];
  if (host) {
    host.show({ message, description: opts?.description, onUndo, duration });
    return;
  }
  toast.success(message, { description: opts?.description, duration, action: { label: "Undo", onClick: onUndo } });
}

/**
 * Rendered by DialogContent. A short-lived confirmation (ConfirmDialog) passes `enabled={false}`: it closes
 * the moment the action runs, so the Undo belongs to whatever is open underneath.
 */
export function DialogUndoHost({ enabled = true, className }: { enabled?: boolean; className?: string }) {
  const [items, setItems] = React.useState<Item[]>([]);
  const itemsRef = React.useRef<Item[]>([]);
  const timers = React.useRef(new Map<number, { t: number; started: number }>());
  const paused = React.useRef(false);
  itemsRef.current = items;

  const drop = React.useCallback((id: number) => {
    const rec = timers.current.get(id);
    if (rec) window.clearTimeout(rec.t);
    timers.current.delete(id);
    setItems((cur) => cur.filter((i) => i.id !== id));
  }, []);

  const arm = React.useCallback((item: Item) => {
    const t = window.setTimeout(() => drop(item.id), item.remaining);
    timers.current.set(item.id, { t, started: Date.now() });
  }, [drop]);

  React.useEffect(() => {
    if (!enabled) return;
    const key = Symbol("undo-host");
    hosts.push({
      key,
      show: ({ duration, ...rest }) => {
        const item: Item = { id: ++seq, remaining: duration, ...rest };
        setItems((cur) => [...cur.slice(-1), item]); // at most two at once; the newest wins the row
        itemsRef.current = [...itemsRef.current.slice(-1), item];
        if (!paused.current) arm(item);
      },
    });
    const live = timers.current;
    return () => {
      const at = hosts.findIndex((h) => h.key === key);
      if (at >= 0) hosts.splice(at, 1);
      // Hand anything still pending to a toast for the time it has left.
      for (const item of itemsRef.current) {
        const rec = live.get(item.id);
        const left = rec ? item.remaining - (Date.now() - rec.started) : item.remaining;
        if (rec) window.clearTimeout(rec.t);
        if (left > 500) toast.success(item.message, { description: item.description, duration: left, action: { label: "Undo", onClick: item.onUndo } });
      }
      live.clear();
    };
  }, [enabled, arm]);

  const pause = () => {
    if (paused.current) return;
    paused.current = true;
    for (const [id, rec] of timers.current) {
      window.clearTimeout(rec.t);
      const item = itemsRef.current.find((i) => i.id === id);
      if (item) item.remaining = Math.max(1500, item.remaining - (Date.now() - rec.started));
    }
    timers.current.clear();
  };
  const resume = () => {
    if (!paused.current) return;
    paused.current = false;
    for (const item of itemsRef.current) arm(item);
  };

  if (!enabled) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className={cn(items.length ? "shrink-0 border-t border-line bg-raised px-5 py-2" : "sr-only", className)}
    >
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 py-0.5 text-sm">
          <div className="min-w-0 flex-1">
            <span className="text-fg">{item.message}</span>
            {item.description ? <span className="ml-1.5 text-xs text-muted">{item.description}</span> : null}
          </div>
          <Button size="sm" onClick={() => { const undo = item.onUndo; drop(item.id); undo(); }}>Undo</Button>
        </div>
      ))}
    </div>
  );
}
