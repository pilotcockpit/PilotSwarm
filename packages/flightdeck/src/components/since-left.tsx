import * as React from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { sessionState } from "@/data/state";
import type { Session } from "@/data/types";
import { StateGlyph } from "@/components/state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { clock, plural } from "@/lib/utils";

// "Since you left": what changed while this tab was away. The stamp is written when the page
// is hidden or closed, never on render, so moving around the app never resets it.
const KEY = "fd:last-seen";
const AWAY_MS = 5 * 60_000;

let baseline = 0;
let dismissed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const read = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };
const write = (t: number) => { try { localStorage.setItem(KEY, String(t)); } catch { /* storage unavailable */ } };

if (typeof window !== "undefined") {
  const last = read();
  if (last && Date.now() - last > AWAY_MS) baseline = last;
  const hide = () => write(Date.now());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hide();
    else {
      const left = read();
      if (left && Date.now() - left > AWAY_MS) { baseline = left; dismissed = false; emit(); }
    }
  });
  window.addEventListener("pagehide", hide);
}

function useBaseline() {
  return React.useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => (dismissed ? 0 : baseline),
  );
}

export function SinceLeft({ sessions }: { sessions: Session[] }) {
  const since = useBaseline();
  const changes = React.useMemo(() => {
    if (!since) return null;
    const mine = sessions.filter((s) => !s.isSystem && (Number(s.updatedAt) || 0) > since);
    const by = (key: string) => mine.filter((s) => sessionState(s).key === key);
    const finished = by("completed");
    const failed = by("failed");
    const asked = by("needs");
    const canvases = mine.filter((s) => s.unseenCanvas);
    const started = mine.filter((s) => (Number(s.createdAt) || 0) > since);
    const total = new Set([...finished, ...failed, ...asked, ...canvases, ...started].map((s) => s.sessionId)).size;
    return total ? { finished, failed, asked, canvases, started } : null;
  }, [since, sessions]);
  if (!since || !changes) return null;
  type Part = { key: string; text: string; sessions: Session[]; glyph?: "completed" | "failed" | "needs" | "running" };
  const parts: Part[] = ([
    { key: "asked", text: `${plural(changes.asked.length, "session")} asked a question`, sessions: changes.asked, glyph: "needs" as const },
    { key: "failed", text: `${changes.failed.length} failed`, sessions: changes.failed, glyph: "failed" as const },
    { key: "finished", text: `${changes.finished.length} finished`, sessions: changes.finished, glyph: "completed" as const },
    { key: "canvases", text: `${plural(changes.canvases.length, "canvas", "canvases")} updated`, sessions: changes.canvases },
    { key: "started", text: `${changes.started.length} started`, sessions: changes.started, glyph: "running" as const },
  ] as Part[]).filter((p) => p.sessions.length);
  const dismiss = () => { dismissed = true; write(Date.now()); emit(); };
  return (
    <Card as="section" enter aria-label="Since you left" className="mb-6 flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">Since you left at {clock(since)}</h2>
        <ul className="mt-1.5 flex flex-col gap-1">
          {parts.map((p) => (
            <li key={p.key} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
              {p.glyph ? <StateGlyph state={p.glyph} pulse={false} /> : <span className="size-2.5 shrink-0" aria-hidden />}
              <span className="shrink-0 text-muted">{p.text}:</span>
              {p.sessions.slice(0, 3).map((s, i) => (
                <React.Fragment key={s.sessionId}>
                  {i ? <span className="text-faint" aria-hidden>,</span> : null}
                  <Link to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="inline-block min-h-6 max-w-[24ch] truncate align-middle leading-6 underline-offset-2 hover:underline pointer-coarse:leading-11">{s.title}</Link>
                </React.Fragment>
              ))}
              {p.sessions.length > 3 ? <span className="text-faint">+{p.sessions.length - 3} more</span> : null}
            </li>
          ))}
        </ul>
      </div>
      <Button variant="quiet" size="icon-sm" aria-label="Dismiss" onClick={dismiss}><X /></Button>
    </Card>
  );
}
