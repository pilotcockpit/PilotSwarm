import * as React from "react";

// A command from the palette that a page owns: "open the Share sheet", "add a provider".
// The palette navigates first when it must, then requests the intent; the page that owns it
// takes it when it mounts (or at once if it is already showing). An intent nobody takes within
// a few seconds is dropped, so a stale one never fires on a later visit.

export type Intent = "add-provider" | "add-package" | "share-session" | "move-to-group" | "attach-file" | "share-canvas" | "find-file";

const TTL_MS = 5000;
const pending = new Map<Intent, number>();
const EVENT = "fd:intent";

export function requestIntent(name: Intent) {
  pending.set(name, Date.now());
  window.dispatchEvent(new CustomEvent(EVENT, { detail: name }));
}

/** Run `handler` when `name` is requested while this component is mounted, or was requested just before it mounted. */
export function useIntent(name: Intent, handler: () => void, enabled = true) {
  const latest = React.useRef(handler);
  latest.current = handler;
  React.useEffect(() => {
    if (!enabled) return;
    const take = () => {
      const at = pending.get(name);
      if (at === undefined) return;
      pending.delete(name);
      if (Date.now() - at < TTL_MS) latest.current();
    };
    take();
    const on = (e: Event) => { if ((e as CustomEvent).detail === name) take(); };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [name, enabled]);
}
