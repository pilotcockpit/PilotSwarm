import * as React from "react";
import { useSessions } from "@/data/source";
import { needsYou } from "@/data/state";

/**
 * The browser tab says how many sessions need you, so a supervisor can leave the
 * tab in the background: "(3) PilotSwarm · Flight Deck". Restores the plain title
 * when nothing needs attention or the app unmounts.
 */
export function AttentionTitle() {
  const { data: sessions } = useSessions();
  const count = React.useMemo(() => (sessions || []).filter(needsYou).length, [sessions]);
  const base = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (base.current === null) base.current = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = count ? `(${count}) ${base.current}` : base.current;
  }, [count]);
  React.useEffect(() => () => { if (base.current) document.title = base.current; }, []);
  return null;
}
