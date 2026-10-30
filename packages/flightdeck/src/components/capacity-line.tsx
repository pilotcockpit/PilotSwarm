import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useProviders, useWorkers } from "@/data/source";
import { tokens } from "@/lib/utils";

/**
 * One quiet line for the question behind every wait: is there room to run? Worker slots in use,
 * workers draining, and the provider closest to its monthly limit with when it would run out at
 * the current pace. It says nothing when the deployment reports none of this.
 */
export function CapacityLine() {
  const { data: workers } = useWorkers();
  const { data: providers } = useProviders();
  const bits = React.useMemo(() => {
    const out: React.ReactNode[] = [];
    const live = (workers || []).filter((w) => w.phase !== "stopped");
    const slots = live.reduce((n, w) => n + (Number(w.health?.workerSlots?.total) || 0), 0);
    const busy = live.reduce((n, w) => n + (Number(w.health?.activeSessions) || 0), 0);
    if (slots) out.push(<span key="slots"><span className="tabular-nums text-fg">{busy}</span> of <span className="tabular-nums">{slots}</span> worker slots busy</span>);
    const draining = live.filter((w) => /drain/i.test(String(w.phase || ""))).length;
    if (draining) out.push(<span key="drain" className="text-waiting">{draining} {draining === 1 ? "worker" : "workers"} draining</span>);

    const tight = (providers || [])
      .map((p) => {
        const m = p.usage?.month;
        const pct = m?.limit ? (m.used / m.limit) * 100 : null;
        return { p, m, pct };
      })
      .filter((x) => x.pct != null && x.pct >= 70)
      .sort((a, b) => (b.pct as number) - (a.pct as number))[0];
    if (tight?.m?.limit) {
      const now = new Date();
      const day = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const perDay = tight.m.used / Math.max(day, 1);
      const left = perDay > 0 ? (tight.m.limit - tight.m.used) / perDay : Infinity;
      const runsOut = left < daysInMonth - day ? new Date(now.getTime() + left * 86_400_000) : null;
      out.push(
        <Link key="prov" to="/providers" search={{ provider: tight.p.name }} className="underline-offset-2 hover:text-fg hover:underline">
          {tight.p.name} at <span className="tabular-nums text-fg">{Math.round(tight.pct as number)}%</span> of its monthly limit ({tokens(tight.m.used)} of {tokens(tight.m.limit)})
          {runsOut ? `, runs out ${runsOut.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at this pace` : ""}
        </Link>,
      );
    }
    return out;
  }, [workers, providers]);
  if (!bits.length) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
      {bits.map((b, i) => (
        <React.Fragment key={i}>
          {i ? <span className="text-faint" aria-hidden>·</span> : null}
          {b}
        </React.Fragment>
      ))}
    </p>
  );
}
