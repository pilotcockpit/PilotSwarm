import * as React from "react";
import { ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, Panel, SectionTitle } from "@/components/empty";
import { Button, DisclosureButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { Skeleton, Switch, Tag } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import { PersonalFlagList } from "@/components/settings/personal-flags";
import { useWorkers } from "@/data/source";
import { changeSentence, clusterPolicy, defaultPolicy, flagDelivery, groupFlags, policySentence, samePolicy, useClusterFlags, useFeatureUsers, useFlagChanges, useFlagMutation, usePersonNames, useUserFlags, type FlagChange, type FlagUser, type FlagView, type Policy } from "@/data/ops/flags";
import { ago, cn } from "@/lib/utils";

/**
 * Admin > Feature flags. Each flag answers three questions in one row: what is it, who gets it right now
 * (on or off, and whether people may choose for themselves), and is it live on the workers yet. Changes
 * save as you make them, say who they affect, and offer Undo; only the ones that take a choice away from
 * everyone ask first.
 */
export function ClusterFlags() {
  const { data, isLoading, error } = useClusterFlags();
  const changes = useFlagChanges();
  if (isLoading) return <Skeleton className="h-64" />;
  if (error || !data) return <Panel><EmptyState title="Feature flags aren't available">{(error as any)?.message || "This deployment doesn't publish feature settings."}</EmptyState></Panel>;
  const groups = groupFlags(data.flags);
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <SectionTitle count={g.items.length}>{g.label}</SectionTitle>
          <Panel enter>{g.items.map((f) => <ClusterFlagRow key={f.featureKey} flag={f} changes={(changes.data || []).filter((c) => c.featureKey === f.featureKey)} />)}</Panel>
        </section>
      ))}
      <PersonOverrides />
      <RecentChanges flags={data.flags} changes={changes.data || []} loading={changes.isLoading} />
    </div>
  );
}

/** Locking everyone into a value, or taking away their choice, is the only edit that asks first. */
function needsConfirm(cur: Policy, next: Policy) {
  return !next.allowUserOverride && (next.enabled !== cur.enabled || cur.allowUserOverride);
}

const CLUSTER = { kind: "cluster" } as const;

function ClusterFlagRow({ flag, changes }: { flag: FlagView; changes: FlagChange[] }) {
  const mutation = useFlagMutation();
  const nameOf = usePersonNames();
  const { data: workers } = useWorkers();
  const policy = clusterPolicy(flag);
  const fallback = defaultPolicy(flag);
  const [pending, setPending] = React.useState<{ next: Policy | "reset" } | null>(null);
  const [history, setHistory] = React.useState(false);
  const delivery = flagDelivery(flag, workers || []);
  const custom = Boolean(flag.cluster);

  const write = async (next: Policy | "reset") => {
    const before = flag.cluster ? policy : null;
    const input = next === "reset" ? { target: CLUSTER, featureKey: flag.featureKey, expectedRevision: flag.revision, clear: true } : { target: CLUSTER, featureKey: flag.featureKey, expectedRevision: flag.revision, enabled: next.enabled, allowUserOverride: next.allowUserOverride };
    const r = await mutation.mutateAsync(input).catch(() => null);
    if (!r) return;
    const label = next === "reset" ? `back to the default (${policySentence(fallback)})` : policySentence(next);
    toast(`${flag.displayName}: ${label}`, {
      duration: 9000,
      action: {
        label: "Undo",
        onClick: () => void mutation.mutate(before ? { target: CLUSTER, featureKey: flag.featureKey, expectedRevision: r.revision, enabled: before.enabled, allowUserOverride: before.allowUserOverride } : { target: CLUSTER, featureKey: flag.featureKey, expectedRevision: r.revision, clear: true }),
      },
    });
  };
  const request = (next: Policy | "reset") => {
    const target = next === "reset" ? fallback : next;
    if (samePolicy(target, policy) && next !== "reset") return;
    if (needsConfirm(policy, target)) setPending({ next });
    else void write(next);
  };

  const target = pending ? (pending.next === "reset" ? fallback : pending.next) : null;
  const disabled = !flag.supported || mutation.isPending;
  return (
    <div className="border-t border-line-subtle px-4 py-3.5 first:border-t-0">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{flag.displayName}</span>
            <Tag tone={policy.enabled ? "ok" : "neutral"}>{policy.enabled ? "On" : "Off"}</Tag>
            {!custom ? <Tag>Default</Tag> : null}
          </div>
          <p className="mt-0.5 max-w-[68ch] text-sm text-muted">{flag.description}</p>
          <p className="mt-1 text-xs text-muted">{policySentence(policy)}.{flag.reason === "requires_native_tasks" ? " Needs “Native Copilot tasks” on to take effect." : ""}</p>
          {delivery.eligible > 0 ? (
            <p className={cn("mt-0.5 text-xs", delivery.updated === delivery.eligible ? "text-faint" : "text-waiting")}>
              {delivery.updated === delivery.eligible ? `Live on all ${delivery.eligible} workers.` : `Live on ${delivery.updated} of ${delivery.eligible} workers; the rest pick it up within about 20 seconds.`}
            </p>
          ) : null}
          {!flag.supported ? <p className="mt-1 text-xs text-waiting">This server can't change this setting.</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <Segmented
            label={`${flag.displayName}: on or off`}
            value={policy.enabled ? "on" : "off"}
            onChange={(v) => request({ ...policy, enabled: v === "on" })}
            className={cn(disabled && "pointer-events-none opacity-50")}
            options={[{ value: "off", label: "Off", disabled }, { value: "on", label: "On", disabled }]}
          />
          <label className="flex items-center gap-2 text-sm">
            <Switch aria-label={`${flag.displayName}: let people choose for themselves`} checked={policy.allowUserOverride} disabled={disabled} onCheckedChange={(v) => request({ ...policy, allowUserOverride: v })} />
            People can choose
          </label>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <DisclosureButton aria-expanded={history} onClick={() => setHistory((v) => !v)} className="text-xs text-muted">
          <ChevronRight className={cn("size-3.5 transition-transform duration-(--duration-fast)", history && "rotate-90")} aria-hidden /> History
        </DisclosureButton>
        {custom ? <Button variant="quiet" size="sm" disabled={disabled} onClick={() => request("reset")}>Reset to default</Button> : null}
      </div>
      {history ? (
        <ul className="mt-1.5 flex flex-col gap-1 pl-5 text-xs text-muted">
          {changes.length ? changes.slice(0, 5).map((c, i) => <li key={c.auditId || i}><span className="text-fg">{c.actor}</span> {changeSentence(c, nameOf)} · {ago(c.at)}</li>) : <li>No changes recorded for this flag. It is using its default.</li>}
        </ul>
      ) : null}
      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.next === "reset" ? `Reset “${flag.displayName}” to its default?` : target && !target.allowUserOverride ? `Set “${flag.displayName}” for everyone?` : `Change “${flag.displayName}”?`}
        description={target ? `${policySentence(target)}.` : undefined}
        consequences={[
          "Affects everyone in this deployment, including running sessions on their next turn.",
          ...(target && !target.allowUserOverride && policy.allowUserOverride ? ["People lose the ability to choose for themselves. Choices they already saved are kept, but stop applying."] : []),
          "Workers pick the change up within about 20 seconds. You can undo it afterwards.",
        ]}
        confirmLabel={pending?.next === "reset" ? "Reset to default" : "Apply to everyone"}
        onConfirm={() => write(pending!.next)}
      />
    </div>
  );
}

/** Look someone up, then set their flags exactly as they would in Settings. */
function PersonOverrides() {
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [picked, setPicked] = React.useState<FlagUser | null>(null);
  React.useEffect(() => { const t = window.setTimeout(() => setDebounced(query.trim()), 250); return () => window.clearTimeout(t); }, [query]);
  const users = useFeatureUsers(debounced);
  const flags = useUserFlags(picked?.userId ?? null);
  const name = picked ? picked.displayName || picked.email || `user ${picked.userId}` : "";
  return (
    <section aria-label="Person overrides">
      <SectionTitle>Set a flag for one person</SectionTitle>
      <Panel enter>
        <div className="flex flex-col gap-3 p-4">
          <label className="relative block">
            <span className="sr-only">Find a person</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a person by name or email" className="pl-8" autoComplete="off" />
          </label>
          {users.isLoading ? <Skeleton className="h-10" /> : users.data?.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="People">
              {users.data.slice(0, 12).map((u) => (
                <li key={u.userId}>
                  <button
                    type="button"
                    aria-pressed={picked?.userId === u.userId}
                    onClick={() => setPicked(u)}
                    className={cn("inline-flex h-6.5 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium transition-colors duration-(--duration-fast) pointer-coarse:h-11", picked?.userId === u.userId ? "border-accent/60 bg-accent-tint" : "border-line-strong hover:bg-raised")}
                  >
                    {u.displayName || u.email || u.userId}
                    {u.displayName && u.email ? <span className="font-normal text-muted">{u.email}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">{debounced ? `Nobody matches “${debounced}”.` : "Start typing to find someone."}</p>}
        </div>
      </Panel>
      {picked ? (
        <div className="mt-4">
          <p className="mb-3 text-sm font-medium">Settings for {name}</p>
          {flags.isLoading ? <Skeleton className="h-32" /> : flags.data ? <PersonalFlagList data={flags.data} target={{ kind: "user", userId: picked.userId }} who={name} /> : <p className="text-sm text-failed">Couldn't load their settings.</p>}
        </div>
      ) : null}
    </section>
  );
}

function RecentChanges({ flags, changes, loading }: { flags: FlagView[]; changes: FlagChange[]; loading: boolean }) {
  const [open, setOpen] = React.useState(false);
  const nameOf = usePersonNames();
  const names = new Map(flags.map((f) => [f.featureKey, f.displayName]));
  return (
    <section aria-label="Recent changes">
      <DisclosureButton aria-expanded={open} onClick={() => setOpen((v) => !v)} className="text-sm font-semibold text-muted">
        <ChevronRight className={cn("size-4 transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden /> Recent changes <span className="font-normal tabular-nums text-faint">{changes.length}</span>
      </DisclosureButton>
      {open ? (
        <Panel enter className="mt-2">
          {loading ? <Skeleton className="h-24" /> : changes.length ? changes.slice(0, 20).map((c, i) => (
            <div key={c.auditId || i} className="flex flex-wrap items-baseline gap-x-2 border-t border-line-subtle px-4 py-2 text-sm first:border-t-0">
              <span className="font-medium">{c.actor}</span>
              <span className="text-muted">{changeSentence(c, nameOf)}</span>
              <span>{names.get(c.featureKey) || c.featureKey}</span>
              <span className="ml-auto text-xs text-faint">{ago(c.at)}</span>
            </div>
          )) : <EmptyState title="No changes yet">When someone changes a flag it is recorded here.</EmptyState>}
        </Panel>
      ) : null}
    </section>
  );
}
