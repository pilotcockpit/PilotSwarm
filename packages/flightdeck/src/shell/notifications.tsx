import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSessions } from "@/data/source";
import { sessionState } from "@/data/state";
import { usePref } from "./prefs";

// Browser notifications for the two things that cannot wait: a session that asks a
// question ("Needs you") and a session that fails. Off by default; turning it on asks the
// browser for permission. Only fires while this tab is not in front, and once per change of
// state per session, so a polling refresh never repeats itself.

export const useNotifyPref = () => usePref<"on" | "off">("fd.notify", "off");

export function notificationSupport(): "unsupported" | NotificationPermission {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

export function useAttentionNotifications() {
  const { data: sessions } = useSessions();
  const [pref] = useNotifyPref();
  const navigate = useNavigate();
  const seen = React.useRef<Map<string, string> | null>(null);
  React.useEffect(() => {
    if (!sessions) return;
    const now = new Map<string, string>();
    for (const s of sessions) {
      if (s.isSystem) continue;
      const key = sessionState(s).key;
      if (key === "needs" || key === "failed") now.set(s.sessionId, key);
    }
    const before = seen.current;
    seen.current = now;
    // The first snapshot is the baseline: everything already waiting was seen on arrival.
    if (!before || pref !== "on" || notificationSupport() !== "granted" || document.visibilityState === "visible") return;
    for (const [id, key] of now) {
      if (before.get(id) === key) continue;
      const s = sessions.find((x) => x.sessionId === id);
      const n = new Notification(key === "needs" ? "A session needs you" : "A session failed", { body: s?.title || "Untitled session", tag: `${id}:${key}` });
      n.onclick = () => { window.focus(); void navigate({ to: "/s/$sessionId", params: { sessionId: id } }); n.close(); };
    }
  }, [sessions, pref, navigate]);
}
