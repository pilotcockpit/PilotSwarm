import * as React from "react";
import { AlertTriangle, Check, Clock, Info, X } from "lucide-react";
import type { Provider, Session } from "@/data/types";
import { Tag } from "@/components/ui/misc";
import { cn, tokens } from "@/lib/utils";

/** What releases a hold, in words; null when there is no active hold. A hold pauses new turns. */
export function holdRelease(p: Pick<Provider, "holdIndefinite" | "holdUntilUtc">): string | null {
  if (p.holdIndefinite) return "until someone releases it";
  const until = p.holdUntilUtc ? Date.parse(p.holdUntilUtc) : NaN;
  return Number.isFinite(until) && until > Date.now() ? `until ${new Date(until).toLocaleString()}` : null;
}

export type ProviderStatus = { key: "ready" | "no-key" | "workers" | "not-shared" | "hold" | "limit" | "unknown"; word: string; why: string; tone: "ok" | "failed" | "waiting" | "muted" };

/**
 * One status per provider, from the facts the API gives: a credential exists, you may use it, it is
 * not held, it is under its limit. The headline is the first that fails, so a provider never reads
 * "Set" in one place and "Not set up" in another.
 */
export function providerStatus(p: Provider, broken: boolean): ProviderStatus {
  const hold = holdRelease(p);
  const month = p.usage?.month;
  const usedFraction = month?.limit == null ? null : month.limit > 0 ? month.used / month.limit : 1;
  if (p.hasCredential == null) return { key: "unknown", word: "Not reported", why: "This response does not say whether a credential is configured.", tone: "muted" };
  if (!p.hasCredential) return { key: "no-key", word: "No key", why: "No credential is stored for this provider. Add a key to use it.", tone: "muted" };
  if (broken) return { key: "workers", word: "Session errors", why: "Recent sessions failed on this provider. Open a failed session for the exact cause before changing anything.", tone: "failed" };
  if (p.usableByMe === false) return { key: "not-shared", word: "Not yours", why: "Someone else's provider. You can see it, but only its owner can run work on it.", tone: "muted" };
  if (hold) return { key: "hold", word: "On hold", why: `New turns are paused ${hold}.`, tone: "waiting" };
  if (usedFraction != null && usedFraction >= 0.9) {
    return { key: "limit", word: usedFraction >= 1 ? "Limit reached" : "Near its limit", why: usedFraction >= 1 ? "The monthly limit is used up. New turns wait until it resets or is raised." : "Over 90% of the monthly limit is used.", tone: usedFraction >= 1 ? "failed" : "waiting" };
  }
  return { key: "ready", word: "Ready", why: "A key is stored and you can use this provider.", tone: "ok" };
}

const ICON = { ok: Check, failed: AlertTriangle, waiting: Clock, muted: X } as const;
const TONE = { ok: "text-ok", failed: "text-failed", waiting: "text-waiting", muted: "text-muted" } as const;

export function KeyStatus({ provider: p, broken }: { provider: Provider; broken: boolean }) {
  const st = providerStatus(p, broken);
  const Icon = st.key === "unknown" ? Info : ICON[st.tone];
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-medium", TONE[st.tone])}>
      <Icon className="size-3.5" aria-hidden /> {st.word}
      {st.key === "hold" ? <span className="font-normal text-muted"> {holdRelease(p)}</span> : null}
    </span>
  );
}

/** Used against a limit. Neutral until 80%, then waiting, then failed: the bar says how close, the words say how much. */
export function Meter({ used, limit, label, className }: { used: number; limit: number | null | undefined; label: string; className?: string }) {
  if (limit == null) return <span className={cn("text-xs text-muted", className)}><span className="tabular-nums text-fg">{tokens(used)}</span> used · no limit</span>;
  const ratio = limit > 0 ? used / limit : 1;
  const pct = Math.round(ratio * 100);
  const fill = Math.min(100, Math.max(0, pct));
  return (
    <div className={cn("min-w-35", className)}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="tabular-nums text-fg">{tokens(used)} <span className="text-faint">of {tokens(limit)}</span></span>
        <span className={cn("tabular-nums", ratio >= 1 ? "font-medium text-failed" : ratio >= 0.8 ? "text-waiting" : "text-muted")}>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-raised" role="meter" aria-valuenow={fill} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${pct}% used`} aria-label={label}>
        <div className={cn("h-full rounded-full transition-[width] duration-(--duration-slow) ease-out-fd", ratio >= 1 ? "bg-failed" : ratio >= 0.8 ? "bg-waiting" : "bg-accent")} style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}

export function DefaultTags({ provider: p }: { provider: Provider }) {
  const tags = [p.isMyDefault && "Your default", p.isClusterDefault && "Cluster default", p.isSystemDefault && "System default"].filter(Boolean) as string[];
  if (!tags.length) return null;
  return <span className="flex flex-wrap gap-1">{tags.map((t) => <Tag key={t}>{t}</Tag>)}</span>;
}

/** Sessions that run on this provider and would feel a change to it. */
export function sessionsUsing(name: string, sessions: Session[] | undefined): Session[] {
  return (sessions || []).filter((s) => s.model?.startsWith(`${name}:`) && !["completed", "cancelled", "terminated", "deleted"].includes(String(s.status)));
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A native select that looks like our inputs: the right control for a short list, on a phone and on a keyboard. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn("h-control w-full rounded-control border border-line-strong bg-surface px-2 text-sm text-fg outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50", className)} {...props} />;
});

/** "On pace to run out around Oct 28", or null when usage will not reach the limit this month. */
export function monthProjection(used: number, limit: number | null | undefined, now = new Date()): string | null {
  if (!limit || used <= 0 || used >= limit) return null;
  const day = now.getUTCDate() - 1 + now.getUTCHours() / 24 + 0.5;
  const perDay = used / day;
  const daysLeft = (limit - used) / perDay;
  const monthDays = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  if (day + daysLeft >= monthDays) return null;
  return `On pace to run out around ${new Date(now.getTime() + daysLeft * 86_400_000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
