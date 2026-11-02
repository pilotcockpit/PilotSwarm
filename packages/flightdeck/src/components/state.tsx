import { cn } from "@/lib/utils";
import { STATE_TINT, STATE_TONE, sessionState, type SessionState, type StateKey } from "@/data/state";
import type { Session, SpineMark } from "@/data/types";

// State = glyph + word + colour. Glyphs are drawn, not typed, so they render
// the same in every font: ● running (pulses only while streaming; `arc` draws it as a turning arc, the one
// moving glyph in a dense list), ◔ waiting (`hold` draws a provider or budget hold as pause bars so it never
// reads as routine waiting), ◆ needs you, ✕ failed, ○ idle, ✓ completed/cancelled.

export function StateGlyph({ state, className, pulse = true, hold = false, arc = false }: { state: StateKey; className?: string; pulse?: boolean; hold?: boolean; arc?: boolean }) {
  const tone = STATE_TONE[state];
  const common = cn("inline-block size-[10px] shrink-0", tone, className);
  if (state === "waiting" && hold) {
    return (
      <svg data-state-glyph viewBox="0 0 10 10" className={common} aria-hidden>
        <path d="M3.2 1.6 L3.2 8.4 M6.8 1.6 L6.8 8.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }
  if (state === "running" && arc) {
    return (
      <svg data-state-glyph viewBox="0 0 10 10" className={cn(common, "motion-safe:animate-spin")} aria-hidden>
        <circle cx="5" cy="5" r="3.7" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.4" />
        <path d="M5 1.3 A3.7 3.7 0 0 1 8.7 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  switch (state) {
    case "running":
      return (
        <svg data-state-glyph viewBox="0 0 10 10" className={cn(common, pulse && "motion-safe:animate-pulse-live")} aria-hidden>
          <circle cx="5" cy="5" r="4" fill="currentColor" />
        </svg>
      );
    case "waiting":
      return (
        <svg data-state-glyph viewBox="0 0 10 10" className={common} aria-hidden>
          <circle cx="5" cy="5" r="3.9" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5 5 L5 1.1 A3.9 3.9 0 0 1 8.9 5 Z" fill="currentColor" />
        </svg>
      );
    case "needs":
      return (
        <svg data-state-glyph viewBox="0 0 10 10" className={common} aria-hidden>
          <path d="M5 0.6 L9.4 5 L5 9.4 L0.6 5 Z" fill="currentColor" />
        </svg>
      );
    case "failed":
      return (
        <svg data-state-glyph viewBox="0 0 10 10" className={common} aria-hidden>
          <path d="M1.6 1.6 L8.4 8.4 M8.4 1.6 L1.6 8.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case "idle":
      return (
        <svg data-state-glyph viewBox="0 0 10 10" className={common} aria-hidden>
          <circle cx="5" cy="5" r="3.7" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    default:
      return (
        <svg data-state-glyph viewBox="0 0 10 10" className={common} aria-hidden>
          <path d="M1.9 5.3 L4.1 7.5 L8.1 2.7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

/** Pill: glyph + word, then the reason in a quieter voice. */
export function StatePill({ state, className, showReason = true, size = "md" }: { state: SessionState; className?: string; showReason?: boolean; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "h-5 px-2 text-xs" : "h-6 px-2.5 text-sm",
        STATE_TINT[state.key],
        className,
      )}
    >
      <StateGlyph state={state.key} className={size === "sm" ? "size-2" : undefined} />
      <span className="shrink-0">{state.word}</span>
      {showReason && state.reason ? <span className="truncate font-normal text-fg/75">· {state.reason}</span> : null}
    </span>
  );
}

/** The row-level label: glyph + word in the state colour, reason in muted. */
export function StateLine({ session, className }: { session: Session; className?: string }) {
  const st = sessionState(session);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs", className)}>
      <StateGlyph state={st.key} />
      <span className={cn("shrink-0 font-medium", STATE_TONE[st.key])}>{st.word}</span>
      {st.reason ? <span className="truncate text-muted">· {st.reason}</span> : null}
    </span>
  );
}

const SPINE_TONE: Record<SpineMark, string> = {
  run: "bg-live",
  sleep: "bg-line-strong",
  wait: "bg-waiting",
  fail: "bg-failed",
  done: "bg-muted",
};

/**
 * Durable spine: the last 16 durable events as a 48×12 strip. It makes
 * durable execution visible at a glance: runs, sleeps, waits, failures.
 */
export function DurableSpine({ marks, className }: { marks?: SpineMark[]; className?: string }) {
  if (!marks?.length) return null;
  const last = marks.slice(-14);
  const label = `Last ${last.length} durable events: ${summarize(last)}`;
  // A fixed 14-slot strip: empty slots stay faint so every row's spine has the same width and rhythm.
  const slots: Array<SpineMark | null> = [...Array(14 - last.length).fill(null), ...last];
  return (
    <span className={cn("inline-flex h-3 w-12 shrink-0 items-end justify-between", className)} role="img" aria-label={label} title={label}>
      {slots.map((mark, i) => (
        <span key={i} className={cn("w-[2px] rounded-[1px]", mark ? SPINE_TONE[mark] : "bg-line", !mark ? "h-1" : mark === "sleep" ? "h-1.5" : mark === "fail" ? "h-3" : "h-2.5")} />
      ))}
    </span>
  );
}

function summarize(marks: SpineMark[]) {
  const words: Record<SpineMark, string> = { run: "ran", sleep: "slept", wait: "waited", fail: "failed", done: "finished" };
  const counts = new Map<SpineMark, number>();
  for (const m of marks) counts.set(m, (counts.get(m) || 0) + 1);
  return [...counts].map(([m, n]) => `${words[m]} ${n}`).join(", ");
}
