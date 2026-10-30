import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { StateGlyph } from "@/components/state";
import { Button, DisclosureButton } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { plural } from "@/components/providers/shared";
import { untilWords, usePausedSessions, useSetHold, type PausedRow, type Period } from "@/data/ops/providers";
import { cn, tokens } from "@/lib/utils";

type Group = { key: string; kind: string; provider: string | null; period: Period | null; model: string | null; resetsAtUtc: string | null; used: number | null; limit: number | null; rows: PausedRow[] };

function group(rows: PausedRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const p = r.pause;
    if (!p) continue;
    const key = [p.kind, p.provider, p.period, p.modelQualified].join("|");
    const g = map.get(key) || { key, kind: String(p.kind), provider: p.provider ?? null, period: (p.period as Period) ?? null, model: p.modelQualified ?? null, resetsAtUtc: p.resetsAtUtc ?? null, used: p.yourUsedTokens ?? p.usedTokens ?? null, limit: p.ceilingTokens ?? p.limitTokens ?? null, rows: [] };
    g.rows.push(r);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.rows.length - a.rows.length);
}

/** The sentence a person needs: what is stopping the work, how long, and why. */
function headline(g: Group): string {
  const who = plural(g.rows.length, "session");
  const per = g.period ? `${g.period}ly` : "";
  const resets = untilWords(g.resetsAtUtc);
  switch (g.kind) {
    case "limit": return `${who} waiting: ${g.provider} reached its ${per} limit${g.model ? ` for ${g.model.split(":").pop()}` : ""}${resets ? `. It resets in ${resets}` : ""}.`;
    case "allowance": return `${who} waiting: your share of ${g.provider}'s ${per} limit is used up${resets ? `. It resets in ${resets}` : ""}.`;
    case "hold": return `${who} waiting: ${g.provider} is on hold${resets ? ` for ${resets}` : " until someone releases it"}.`;
    case "no_provider": return `${who} waiting: there is no provider named ${g.provider}.`;
    default: return `${who} waiting on a provider.`;
  }
}

/**
 * Work that stopped because of a limit, an allowance, a hold or a missing provider, with the one
 * action that unblocks it for the person looking. Nothing here needs a trip to another tool.
 */
export function PausedPanel({ isAdmin, onRaiseLimit, onOpenProvider, onAddProvider }: { isAdmin: boolean; onRaiseLimit: (provider: string, period: Period | null) => void; onOpenProvider: (provider: string) => void; onAddProvider: (name: string | null) => void }) {
  const { data } = usePausedSessions();
  const hold = useSetHold();
  const groups = React.useMemo(() => group(data || []), [data]);
  if (!groups.length) return null;
  return (
    <div className="mb-5 flex flex-col gap-2" role="status" aria-label="Paused work">
      {groups.map((g) => <PausedGroup key={g.key} g={g} isAdmin={isAdmin} hold={hold} onRaiseLimit={onRaiseLimit} onOpenProvider={onOpenProvider} onAddProvider={onAddProvider} />)}
    </div>
  );
}

function PausedGroup({ g, isAdmin, hold, onRaiseLimit, onOpenProvider, onAddProvider }: { g: Group; isAdmin: boolean; hold: ReturnType<typeof useSetHold>; onRaiseLimit: (provider: string, period: Period | null) => void; onOpenProvider: (provider: string) => void; onAddProvider: (name: string | null) => void }) {
  const [open, setOpen] = React.useState(false);
  const provider = g.provider || "";
  return (
    <div className={cn(cardVariants({ tone: "waiting", enter: true }), "p-3")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex min-w-0 flex-1 items-start gap-2.5 text-sm"><StateGlyph state="waiting" className="mt-1.5" /><span className="min-w-0 text-fg">{headline(g)}{g.limit != null && g.used != null ? <span className="text-muted"> {tokens(g.used)} of {tokens(g.limit)} used.</span> : null}</span></p>
        <div className="flex flex-wrap gap-2 max-sm:pl-4.5">
          {g.kind === "hold" ? (
            isAdmin ? <Button variant="primary" disabled={hold.isPending} onClick={async () => { try { await hold.mutateAsync({ name: provider, release: true }); toast.success("Hold released. Waiting sessions are waking up."); } catch { /* toasted */ } }}>{hold.isPending ? <Loader2 className="animate-spin" /> : <Play />} Release hold</Button> : <Button onClick={() => onOpenProvider(provider)}>See the hold</Button>
          ) : g.kind === "no_provider" ? (
            <Button variant="primary" onClick={() => onAddProvider(provider)}>Add “{provider}” again</Button>
          ) : isAdmin ? (
            <Button variant="primary" onClick={() => onRaiseLimit(provider, g.period)}>Raise the limit</Button>
          ) : (
            <Button onClick={() => onOpenProvider(provider)}>See the limit</Button>
          )}
        </div>
      </div>
      {!isAdmin && (g.kind === "limit" || g.kind === "allowance") ? <p className="mt-1.5 pl-5.5 text-xs text-muted max-sm:pl-4.5">An administrator can raise it. Or switch these sessions to another model from each session’s header.</p> : null}
      <div className="mt-1 pl-5.5 max-sm:pl-4.5">
        <DisclosureButton aria-expanded={open} onClick={() => setOpen((v) => !v)} className="text-xs text-muted">{open ? "Hide" : "Show"} {plural(g.rows.length, "session")}</DisclosureButton>
        {open ? <ul className="mt-1 flex flex-col">{g.rows.map((r) => <li key={r.sessionId}><Link to="/s/$sessionId" params={{ sessionId: r.sessionId }} className="inline-flex min-h-6 items-center text-sm text-accent hover:underline pointer-coarse:min-h-11">{r.title || r.sessionId.slice(0, 8)}</Link>{r.ownerEmail ? <span className="text-xs text-muted"> · {r.ownerEmail}</span> : null}</li>)}</ul> : null}
      </div>
    </div>
  );
}
