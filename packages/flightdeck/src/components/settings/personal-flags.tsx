import * as React from "react";
import { EmptyState, Panel, SectionTitle } from "@/components/empty";
import { Skeleton, Tag } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import { clusterPolicy, groupFlags, useFlagMutation, useMyFlags, type FlagView, type FlagsData } from "@/data/ops/flags";
import { cn } from "@/lib/utils";
import { notifyUndo } from "@/lib/undo";

type Target = { kind: "me" } | { kind: "user"; userId: number };
type Choice = "inherit" | "on" | "off";

const onOff = (v: boolean) => (v ? "On" : "Off");

/** Settings > Feature preferences: your own choice per flag, saved the moment you pick it, with Undo. */
export function MyFeaturePreferences() {
  const { data, isLoading, error } = useMyFlags();
  if (isLoading) return <Skeleton className="h-48" />;
  if (error || !data) return <Panel><EmptyState title="Feature preferences aren't available">{(error as any)?.message || "This deployment doesn't publish feature settings."}</EmptyState></Panel>;
  return (
    <>
      <p className="mb-4 max-w-[72ch] text-sm text-muted">Pick how each feature behaves for you. “Default” follows whatever your admin set. Some features are decided for everyone and can't be changed here; they say so.</p>
      <PersonalFlagList data={data} target={{ kind: "me" }} who="you" />
    </>
  );
}

/** One person's choice for each flag, shared by Settings (you) and Admin (a person you looked up). */
export function PersonalFlagList({ data, target, who }: { data: FlagsData; target: Target; who: string }) {
  const groups = groupFlags(data.flags);
  if (!groups.length) return <Panel><EmptyState title="No feature flags">This deployment doesn't publish any.</EmptyState></Panel>;
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <SectionTitle>{g.label}</SectionTitle>
          <Panel enter>{g.items.map((f) => <PersonalRow key={f.featureKey} flag={f} target={target} who={who} />)}</Panel>
        </section>
      ))}
    </div>
  );
}

function PersonalRow({ flag, target, who }: { flag: FlagView; target: Target; who: string }) {
  const mutation = useFlagMutation();
  const policy = clusterPolicy(flag);
  const mine = target.kind === "me";
  const choice: Choice = flag.user ? (flag.user.enabled ? "on" : "off") : "inherit";
  const locked = !policy.allowUserOverride;
  const blocked = flag.reason === "requires_native_tasks";
  const disabled = !flag.supported || (mine && locked) || mutation.isPending;

  // The target is read once, here, when the write is made. Undo reuses this closure, so it can only
  // ever act on the person who was selected at the time.
  const apply = async (next: Choice, revision: string, at: Target = target): Promise<string | null> => {
    try {
      const r = await mutation.mutateAsync(next === "inherit" ? { target: at, featureKey: flag.featureKey, expectedRevision: revision, clear: true } : { target: at, featureKey: flag.featureKey, expectedRevision: revision, enabled: next === "on" });
      return r?.revision ?? null;
    } catch {
      return null; // already toasted by the mutation
    }
  };
  const choose = async (next: Choice) => {
    if (next === choice) return;
    const before = choice;
    const writtenTo = target;
    const revision = await apply(next, flag.revision, writtenTo);
    if (!revision) return;
    notifyUndo(`${flag.displayName}: ${next === "inherit" ? `back to the default (${onOff(policy.enabled)})` : onOff(next === "on")} for ${who}`, () => void apply(before, revision, writtenTo));
  };

  let status: React.ReactNode;
  if (!flag.supported) status = "This server can't change this setting.";
  else if (locked) status = mine ? `Your admin set this to ${onOff(policy.enabled)} for everyone.` : `Personal choices are off for everyone (${onOff(policy.enabled)}), so this is saved but not used yet.`;
  else if (choice === "inherit") status = `Following the default: ${onOff(policy.enabled)}.`;
  else status = `${mine ? "Your" : "Their"} choice: ${onOff(choice === "on")}.`;

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2.5 border-t border-line-subtle px-4 py-3.5 first:border-t-0">
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{flag.displayName}</span>
          <Tag tone={flag.effective ? "ok" : "neutral"}>{onOff(flag.effective)}{mine ? "" : ` for ${who}`}</Tag>
        </div>
        <p className="mt-0.5 max-w-[68ch] text-sm text-muted">{flag.description}</p>
        <p className={cn("mt-1 text-xs", locked ? "text-waiting" : "text-faint")}>{status}</p>
        {blocked ? <p className="mt-1 text-xs text-waiting">Saved, but off for now: it needs “Native Copilot tasks” to be on first.</p> : null}
      </div>
      <Segmented
        label={`${flag.displayName}: ${mine ? "your" : `${who}'s`} choice`}
        value={choice}
        onChange={(v) => void choose(v)}
        className={cn(disabled && "pointer-events-none opacity-50")}
        options={[
          { value: "inherit", label: `Default · ${onOff(policy.enabled)}`, disabled },
          { value: "on", label: "On", disabled },
          { value: "off", label: "Off", disabled },
        ]}
      />
    </div>
  );
}
