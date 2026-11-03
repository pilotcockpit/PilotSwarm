import * as React from "react";
import { toast } from "sonner";
import { useProfile, useSessions } from "@/data/source";
import { attentionItems, buildIndex, type Attention } from "@/data/session-tree";
import { useDismissedAttention } from "./prefs";

/**
 * Who needs the viewer, by the one definition every surface shares (the sidebar's Needs you, Overview, the
 * tab title and the Sessions page): their own questions, failures they have not dismissed, and holds they
 * can lift. A failure dismissed here is dismissed everywhere.
 */
export function useAttention() {
  const { data: sessions } = useSessions();
  const { data: profile } = useProfile();
  const dismissed = useDismissedAttention();
  const isAdmin = Boolean(profile?.isAdmin);
  return React.useMemo(() => {
    const all = sessions || [];
    const items = attentionItems(buildIndex(all), all.filter((s) => !s.isSystem), { isAdmin }, dismissed.keys);
    return { items, ids: new Set(items.map((a) => a.sessionId)) };
  }, [sessions, isAdmin, dismissed.keys]);
}

/** Dismiss a failure until it fails again, with an Undo. The same everywhere a failure can be dismissed. */
export function useDismissAttention() {
  const dismissed = useDismissedAttention();
  return React.useCallback((a: Attention) => {
    dismissed.dismiss(a.key);
    toast("Dismissed", { description: `${a.title} comes back here if it fails again.`, action: { label: "Undo", onClick: () => dismissed.restore(a.key) } });
  }, [dismissed]);
}
