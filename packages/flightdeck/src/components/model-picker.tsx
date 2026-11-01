import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useModels, useProviders, useRefresh, useSource } from "@/data/source";
import { modelShort } from "@/data/state";
import { sessionTupleIn } from "@/data/ops/undo-guards";
import type { Model, Session } from "@/data/types";
import { Button } from "@/components/ui/button";
import { RadioCard, RadioCards } from "@/components/ui/radio";
import { Skeleton, Tag } from "@/components/ui/misc";
import { providerStatus } from "@/components/providers/shared";
import { changeRequest, changedElsewhere, currentSelection, effectiveSelection, emptyPicker, finalSelection, groupModels, isUsable, pickModel, supportedEfforts, supportedTiers, touchField, type ModelSelection } from "@/lib/model-options";
import { clearPending, markPending } from "@/lib/pending-model";
import { notifyUndo } from "@/lib/undo";
import { cn } from "@/lib/utils";

/**
 * The one place a session's model is chosen: the composer chip, the title menu's Change model and the
 * failed-turn Switch model all render this. Models the workers can run come first, grouped by provider; the
 * reasoning effort and context tier offer only what the chosen model supports. A change applies from the
 * next turn, and a toast says so with an Undo.
 */
export function useApplyModel(session: Session) {
  const { source } = useSource();
  const refresh = useRefresh();
  const [busy, setBusy] = React.useState(false);
  const apply = React.useCallback(async (sel: ModelSelection): Promise<boolean> => {
    const req = changeRequest(session, sel);
    if (!req.changed) return false;
    const prev = currentSelection(session);
    setBusy(true);
    try {
      await source.setSessionModel(session.sessionId, req.model, req.options);
      // Queued, not adopted: the composer says "pending" until the session reports this whole setting.
      markPending(session.sessionId, sel, prev);
      refresh(session.sessionId);
      const label = `${modelShort(req.model)}${sel.effort ? ` · ${sel.effort}` : ""}`;
      notifyUndo("Model changes apply from the next turn", async () => {
        try {
          // The WHOLE previous setting, every key, null meaning "none": an effort or tier someone chose since
          // (which the previous model may not support) must not be carried back by the server's keep-on-omit rule.
          await source.setSessionModel(session.sessionId, prev.model, { reasoningEffort: prev.effort, contextTier: prev.tier });
          clearPending(session.sessionId);
          refresh(session.sessionId);
        } catch (e: any) { toast.error("Couldn't undo the model change", { description: e?.message }); }
      }, { description: label, resource: `model:${session.sessionId}`, guard: sessionTupleIn(source, session.sessionId, [sel, prev]) });
      return true;
    } catch (e: any) {
      toast.error("Couldn't change the model", { description: e?.message });
      return false;
    } finally { setBusy(false); }
  }, [session, source, refresh]);
  return { apply, busy };
}

/** The "none chosen" radio value: the model's own default. Sent to the server as null. */
const DEFAULT = "__default";

export function ModelPicker({ session, onApplied, className }: { session: Session; onApplied?: () => void; className?: string }) {
  const { data: models, isLoading } = useModels();
  const { data: providers } = useProviders();
  const { apply, busy } = useApplyModel(session);
  // What the person touched, kept apart from what the server says: a poll updates every untouched field and
  // never turns one into a write (see lib/model-options.ts).
  const [st, setSt] = React.useState(emptyPicker);
  const server = currentSelection(session);
  const byName = React.useMemo(() => new Map((models || []).map((m) => [m.qualifiedName, m])), [models]);
  const groups = React.useMemo(() => groupModels(models || []), [models]);
  const eff = effectiveSelection(server, st);
  const chosen = byName.get(eff.model);
  const efforts = supportedEfforts(chosen);
  const tiers = supportedTiers(chosen);
  // Checked against the model list as it is NOW, not as it was when the choice was made.
  const final: ModelSelection = finalSelection(server, st, chosen);
  const req = changeRequest(session, final);
  const elsewhere = changedElsewhere(server, st);
  const provider = (providers || []).find((p) => p.name === chosen?.providerId);
  const condition = provider ? providerStatus(provider, false) : null;

  const pick = (qualifiedName: string) => setSt((cur) => pickModel(server, cur, qualifiedName, byName.get(qualifiedName)));
  const submit = async () => { if (await apply(final)) { setSt(emptyPicker()); onApplied?.(); } };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {isLoading ? (
        <div className="flex flex-col gap-1.5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : groups.length ? (
        <RadioCards label="Model" value={eff.model} onValueChange={pick} className="flex flex-col gap-3">
          {groups.map((g) => (
            <div key={g.providerId} className="flex flex-col gap-1.5">
              <p className="px-0.5 text-xs text-muted">{g.providerId}</p>
              {g.models.map((m) => <ModelRow key={m.qualifiedName} model={m} current={m.qualifiedName === session.model} />)}
            </div>
          ))}
        </RadioCards>
      ) : <p className="text-sm text-muted">No models are available to this deployment.</p>}

      {efforts.length ? (
        <RadioCards label="Reasoning effort" value={eff.effort ?? DEFAULT} onValueChange={(v) => setSt((c) => touchField(server, c, "effort", v === DEFAULT ? null : v))} className="flex flex-col gap-1.5">
          <p className="px-0.5 text-xs text-muted">Reasoning effort</p>
          <div className="flex flex-wrap gap-1.5">
            <Choice value={DEFAULT}>Default</Choice>
            {efforts.map((e) => <Choice key={e} value={e}>{e}</Choice>)}
          </div>
        </RadioCards>
      ) : null}
      {tiers.length ? (
        <RadioCards label="Context window" value={eff.tier ?? DEFAULT} onValueChange={(v) => setSt((c) => touchField(server, c, "tier", v === DEFAULT ? null : v))} className="flex flex-col gap-1.5">
          <p className="px-0.5 text-xs text-muted">Context window</p>
          <div className="flex flex-wrap gap-1.5">
            <Choice value={DEFAULT}>Default</Choice>
            {tiers.map((t) => <Choice key={t} value={t}>{t}</Choice>)}
          </div>
        </RadioCards>
      ) : null}

      {elsewhere.length ? (
        <p role="status" data-changed-elsewhere className="text-xs text-waiting">
          {elsewhere.map((f) => ({ model: "The model", effort: "The reasoning effort", tier: "The context window" }[f])).join(" and ")} changed elsewhere while this was open. Apply sets your choice.
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 text-xs text-muted">
          <p>Applies from the next turn. Provider holds and token limits still apply.</p>
          {condition && (condition.key === "hold" || condition.key === "limit") ? <p data-provider-condition className="mt-0.5 text-waiting">{chosen?.providerId}: {condition.word}. {condition.why}</p> : null}
        </div>
        <Button variant="primary" size="sm" disabled={!req.changed || busy || !isUsable(chosen ?? ({ credentialAvailable: false } as Model))} onClick={submit}>
          {busy ? <Loader2 className="animate-spin" /> : null} Apply
        </Button>
      </div>
    </div>
  );
}

function Choice({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <RadioCard value={value} className="inline-flex min-h-7 items-center rounded-control px-2.5 py-1 text-sm pointer-coarse:min-h-11 data-[state=checked]:border-accent data-[state=checked]:bg-accent-tint">{children}</RadioCard>
  );
}

function ModelRow({ model, current }: { model: Model; current: boolean }) {
  const usable = isUsable(model);
  return (
    <RadioCard value={model.qualifiedName} disabled={!usable} className={cn("group flex w-full items-center gap-3 px-3 py-2 pointer-coarse:min-h-11 data-[state=checked]:border-accent data-[state=checked]:bg-accent-tint", !usable && "opacity-60")}>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{model.modelName}</span>
          {current ? <Tag>Current</Tag> : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">{usable ? model.description : model.unavailableReason || "No credential on the workers"}</span>
      </span>
      <Check className="size-4 shrink-0 text-accent opacity-0 group-data-[state=checked]:opacity-100" aria-hidden />
    </RadioCard>
  );
}
