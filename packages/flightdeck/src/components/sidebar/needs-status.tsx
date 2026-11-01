import * as React from "react";

/**
 * Says how many sessions need you, politely, when that number changes: one short line, a second after
 * the change settles, never the whole list. Silent on first render so opening the page is not an event.
 */
export function NeedsCountStatus({ count, delayMs = 1000 }: { count: number; delayMs?: number }) {
  const [text, setText] = React.useState("");
  const seen = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (seen.current === null) { seen.current = count; return; }
    if (count === seen.current) return;
    const t = window.setTimeout(() => {
      seen.current = count;
      setText(count === 0 ? "Nothing needs you now" : count === 1 ? "1 session needs you" : `${count} sessions need you`);
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [count, delayMs]);
  return <p role="status" aria-live="polite" data-needs-status className="sr-only">{text}</p>;
}
