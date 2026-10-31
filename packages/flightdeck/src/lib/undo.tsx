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
 *
 * Undo must never overwrite something newer. Two protections:
 * - `resource` names what the change touched ("package:ops-toolkit:version"). A newer undo for the same
 *   resource RETIRES the older one, so the older notice cannot restore a value that is already history.
 * - `guard` runs when Undo is pressed and re-reads the current state: if it no longer matches what the
 *   change produced (somebody else changed it, or another tab did), Undo refuses and says why.
 */

export const UNDO_MS = 8000;

export const STALE_UNDO_MESSAGE = "This changed since: Undo no longer applies.";

interface Item {
  id: number;
  message: string;
  description?: string;
  onUndo: () => void;
  remaining: number;
  resource?: string;
}
interface ShowItem extends Omit<Item, "id" | "remaining"> { duration: number }
interface Host { key: symbol; show: (item: ShowItem) => void }
export interface UndoOptions {
  description?: string;
  duration?: number;
  /** What this change touched. A newer undo for the same resource retires this one. */
  resource?: string;
  /** Re-reads the current state: true when it is still what the change produced. */
  guard?: () => boolean | Promise<boolean>;
}

const hosts: Host[] = [];
let seq = 0;
/** One live undo per resource, whichever channel (toast or in-dialog) shows it. */
const live = new Map<string, { token: number; retire: () => void }>();

function claim(resource: string | undefined, retire: () => void): number {
  const token = ++seq;
  if (resource) {
    live.get(resource)?.retire();
    live.set(resource, { token, retire });
  }
  return token;
}
function release(resource: string | undefined, token: number) {
  if (resource && live.get(resource)?.token === token) live.delete(resource);
}

/** The action actually run on Undo: guarded when the caller supplied a guard. */
function guarded(onUndo: () => void, guard?: UndoOptions["guard"]) {
  if (!guard) return onUndo;
  return () => {
    void (async () => {
      let ok = false;
      try { ok = await guard(); } catch { ok = false; }
      if (ok) onUndo(); else toast.error(STALE_UNDO_MESSAGE);
    })();
  };
}

/** An Undo in a toast. `run` is already guarded. */
function toastUndo({ message, description, duration, resource, run }: { message: string; description?: string; duration: number; resource?: string; run: () => void }) {
  let toastId: string | number | undefined;
  const token = claim(resource, () => { if (toastId != null) toast.dismiss(toastId); });
  toastId = toast.success(message, {
    description, duration,
    action: { label: "Undo", onClick: () => { release(resource, token); run(); } },
    onDismiss: () => release(resource, token),
    onAutoClose: () => release(resource, token),
  });
}

export function notifyUndo(message: string, onUndo: () => void, opts?: UndoOptions) {
  const duration = opts?.duration ?? UNDO_MS;
  const run = guarded(onUndo, opts?.guard);
  const host = hosts[hosts.length - 1];
  if (host) {
    host.show({ message, description: opts?.description, onUndo: run, duration, resource: opts?.resource });
    return;
  }
  toastUndo({ message, description: opts?.description, duration, resource: opts?.resource, run });
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

  const tokens = React.useRef(new Map<number, number>()); // item id -> claim token
  const drop = React.useCallback((id: number) => {
    const rec = timers.current.get(id);
    if (rec) window.clearTimeout(rec.t);
    timers.current.delete(id);
    const item = itemsRef.current.find((i) => i.id === id);
    if (item) release(item.resource, tokens.current.get(id) ?? -1);
    tokens.current.delete(id);
    itemsRef.current = itemsRef.current.filter((i) => i.id !== id);
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
        const id = ++seq;
        const item: Item = { id, remaining: duration, ...rest };
        tokens.current.set(id, claim(rest.resource, () => drop(id)));
        // At most two at once; the newest wins the row. The one that falls off loses its timer too.
        const keep = itemsRef.current.slice(-1);
        for (const evicted of itemsRef.current.slice(0, -1)) {
          const rec = timers.current.get(evicted.id);
          if (rec) window.clearTimeout(rec.t);
          timers.current.delete(evicted.id);
          release(evicted.resource, tokens.current.get(evicted.id) ?? -1);
          tokens.current.delete(evicted.id);
        }
        itemsRef.current = [...keep, item];
        setItems(itemsRef.current);
        if (!paused.current) arm(item);
      },
    });
    const timerMap = timers.current;
    return () => {
      const at = hosts.findIndex((h) => h.key === key);
      if (at >= 0) hosts.splice(at, 1);
      // Hand anything still pending to a toast for the time it has left; then no timer of ours survives.
      for (const item of itemsRef.current) {
        const rec = timerMap.get(item.id);
        const left = rec ? item.remaining - (Date.now() - rec.started) : item.remaining;
        release(item.resource, tokens.current.get(item.id) ?? -1);
        if (left > 500) toastUndo({ message: item.message, description: item.description, duration: left, resource: item.resource, run: item.onUndo });
      }
      for (const rec of timerMap.values()) window.clearTimeout(rec.t);
      timerMap.clear();
      tokens.current.clear();
      itemsRef.current = [];
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
