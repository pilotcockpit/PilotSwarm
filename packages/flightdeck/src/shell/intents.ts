import * as React from "react";
import { useRouterState } from "@tanstack/react-router";

// A command from the palette that a page owns: "open the Share sheet", "add a provider".
//
// An intent names the screen it is for (its scope: the pathname, which carries the session id for
// a session action). Only a handler whose own scope is exactly that scope may take it, so an
// intent asked of session A can never be taken by session B, or by another page, mounted later.
// There is one pending intent at a time: a new request replaces it, leaving the target's pathname
// cancels it, and it expires after two seconds, so a stale request never fires on a later visit.

export type Intent = "add-provider" | "add-package" | "share-session" | "move-to-group" | "attach-file" | "share-canvas" | "find-file";

export const INTENT_TTL_MS = 2000;

interface Pending { name: Intent; scope: string; expiresAt: number }

export interface IntentBus {
  request(name: Intent, scope: string): void;
  /** True, once, only for a handler whose name and scope match the live pending intent. */
  take(name: Intent, scope: string): boolean;
  cancel(): void;
  /** Keep the pending intent only if its scope is where the person now is. */
  keepOnlyFor(pathname: string): void;
  pending(): Pending | null;
  subscribe(listener: () => void): () => void;
}

export function createIntentBus(now: () => number = Date.now, ttl = INTENT_TTL_MS): IntentBus {
  let current: Pending | null = null;
  const listeners = new Set<() => void>();
  const live = () => {
    if (current && now() >= current.expiresAt) current = null;
    return current;
  };
  return {
    request(name, scope) {
      current = { name, scope, expiresAt: now() + ttl };
      for (const l of [...listeners]) l();
    },
    take(name, scope) {
      const p = live();
      if (!p || p.name !== name || p.scope !== scope) return false;
      current = null;
      return true;
    },
    cancel() { current = null; },
    keepOnlyFor(pathname) {
      const p = live();
      if (p && p.scope !== pathname) current = null;
    },
    pending: live,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

export const intents = createIntentBus();

/** Ask the screen at `scope` (its pathname) to run `name`. */
export const requestIntent = (name: Intent, scope: string) => intents.request(name, scope);

/** Run `handler` when `name` is requested for this exact `scope` while mounted, or was requested for it just before mounting. */
export function useIntent(name: Intent, scope: string, handler: () => void, enabled = true) {
  const latest = React.useRef(handler);
  latest.current = handler;
  React.useEffect(() => {
    if (!enabled) return;
    const attempt = () => { if (intents.take(name, scope)) latest.current(); };
    attempt();
    return intents.subscribe(attempt);
  }, [name, scope, enabled]);
}

/** Mount once: a pending intent is dropped as soon as the person is anywhere other than its target. */
export function useIntentNavigationGuard() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  React.useEffect(() => { intents.keepOnlyFor(pathname); }, [pathname]);
}
