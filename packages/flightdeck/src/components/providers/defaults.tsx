import * as React from "react";
import { ArrowRight, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/providers/shared";
import { Skeleton } from "@/components/ui/misc";
import { useClearSystemAgentModel, useModelDefaults, useSetDefault, useSetSystemAgentModel, useUsableModels, type DefaultsSlot, type Effective, type Tuple } from "@/data/ops/providers";
import { useProfile, useSessions } from "@/data/source";
import type { Model } from "@/data/types";
import { cn } from "@/lib/utils";
import { notifyUndo } from "@/lib/undo";

const SOURCE_WORD: Record<Effective["source"], string> = {
  user_default: "your default",
  cluster_default: "the cluster default",
  system_default: "the system default",
  first_available: "the first available model",
};

/** A grouped model list: models grouped by the provider they run on. "" means inherit. */
export function ModelPicker({ value, onChange, models, inheritLabel, disabled, id, label }: { value: string; onChange: (qualified: string) => void; models: Model[]; inheritLabel?: string; disabled?: boolean; id?: string; label?: string }) {
  const groups = React.useMemo(() => {
    const m = new Map<string, Model[]>();
    for (const x of models.filter((x) => x.credentialAvailable !== false)) m.set(x.providerId, [...(m.get(x.providerId) || []), x]);
    return [...m];
  }, [models]);
  return (
    <Select id={id} aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {inheritLabel ? <option value="">{inheritLabel}</option> : null}
      {groups.map(([provider, list]) => (
        <optgroup key={provider} label={provider}>
          {list.map((m) => <option key={m.qualifiedName} value={m.qualifiedName}>{m.modelName}{m.cost ? ` · ${m.cost} cost` : ""}</option>)}
        </optgroup>
      ))}
    </Select>
  );
}

/** "Your default → cluster default → first available", with the one that is deciding lit. */
function Chain({ active, steps }: { active: Effective["source"] | undefined; steps: Array<[Effective["source"], string]> }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-xs" aria-label="Where the default comes from">
      {steps.map(([key, label], i) => (
        <li key={key} className="flex items-center gap-1.5">
          {i > 0 ? <ArrowRight className="size-3 text-faint" aria-hidden /> : null}
          <span className={cn("rounded-chip px-1.5 py-0.5", active === key ? "bg-accent-tint font-medium text-fg" : "text-muted")} aria-current={active === key ? "true" : undefined}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function DefaultCard({ title, description, slot, scope, canEdit, inheritLabel, models, steps, restartNote }: {
  title: string; description: string; slot: DefaultsSlot; scope: "user" | "cluster" | "system"; canEdit: boolean; inheritLabel: string; models: Model[]; steps: Array<[Effective["source"], string]>; restartNote?: boolean;
}) {
  const set = useSetDefault();
  const [restart, setRestart] = React.useState(false);
  const configured = slot.configured.model || "";
  const chosen = models.find((m) => m.qualifiedName === configured);
  const efforts = chosen?.supportedReasoningEfforts || [];
  const eff = slot.effective;

  const apply = async (next: { model: string; reasoning?: string | null }, prev: Tuple, message: string) => {
    const m = models.find((x) => x.qualifiedName === next.model);
    try {
      await set.mutateAsync({ scope, provider: m?.providerId ?? null, model: next.model || null, reasoningEffort: next.model ? next.reasoning ?? m?.defaultReasoningEffort ?? null : null, contextTier: null, restartSystemSessions: scope === "system" && restart });
      notifyUndo(message, () => void set.mutateAsync({ scope, provider: prev.provider, model: prev.model, reasoningEffort: prev.reasoning, contextTier: prev.context }));
    } catch { /* toasted */ }
  };

  return (
    <Card enter className="p-4">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-0.5 text-sm text-muted">{description}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
        <Field label="Model">
          <ModelPicker value={configured} models={models} inheritLabel={inheritLabel} disabled={!canEdit || set.isPending} onChange={(q) => apply({ model: q }, slot.configured, q ? `${title} is ${models.find((m) => m.qualifiedName === q)?.modelName || q}.` : `${title} cleared. It now follows the next step.`)} />
        </Field>
        {efforts.length ? (
          <Field label="Reasoning">
            <Select value={slot.configured.reasoning || chosen?.defaultReasoningEffort || ""} disabled={!canEdit || set.isPending} onChange={(e) => apply({ model: configured, reasoning: e.target.value }, slot.configured, `Reasoning set to ${e.target.value}.`)}>
              {efforts.map((e) => <option key={e} value={e}>{e}</option>)}
            </Select>
          </Field>
        ) : null}
      </div>
      {restartNote && canEdit ? (
        <label className="mt-3 flex items-start gap-2 text-sm text-muted"><input type="checkbox" checked={restart} onChange={(e) => setRestart(e.target.checked)} className="mt-0.5 size-4 accent-(--accent)" /> Restart system sessions that inherit this now. Otherwise they pick it up on their next run.</label>
      ) : null}
      <div className="mt-3 flex flex-col gap-1.5 border-t border-line-subtle pt-3">
        {slot.error ? <p role="alert" className="text-sm text-failed">{slot.error}</p> : eff ? (
          <p className="text-sm">Right now: <span className="font-medium">{eff.model.split(":").pop()}</span> <span className="text-muted">on {eff.provider}, from {SOURCE_WORD[eff.source]}.</span></p>
        ) : <p className="text-sm text-muted">No model is available yet. Add a provider first.</p>}
        <Chain active={eff?.source} steps={steps} />
        {!canEdit ? <p className="text-xs text-faint">Only an administrator can change this.</p> : null}
      </div>
    </Card>
  );
}

/** System agents can each run on their own model; the rest follow the system default. */
function SystemOverrides({ overrides, models }: { overrides: Array<Tuple & { agentId: string }>; models: Model[] }) {
  const { data: sessions } = useSessions();
  const setModel = useSetSystemAgentModel();
  const clear = useClearSystemAgentModel();
  const [agent, setAgent] = React.useState("");
  const [model, setModelValue] = React.useState("");
  const agentIds = [...new Set((sessions || []).filter((s) => s.isSystem && s.agentId).map((s) => String(s.agentId)))].filter((a) => !overrides.some((o) => o.agentId === a));
  const save = async (agentId: string, q: string) => {
    const m = models.find((x) => x.qualifiedName === q);
    if (!m) return;
    try { await setModel.mutateAsync({ agentId, provider: m.providerId, model: q }); toast.success(`${agentId} now runs on ${m.modelName}.`); } catch { /* toasted */ }
  };
  return (
    <Card enter className="p-4">
      <h3 className="text-base font-semibold">System agents with their own model</h3>
      <p className="mt-0.5 text-sm text-muted">Housekeeping agents follow the system default unless you pin one here.</p>
      {overrides.length ? (
        <ul className="mt-3">
          {overrides.map((o) => (
            <li key={o.agentId} className="flex flex-wrap items-center gap-2 border-t border-line-subtle py-2 first:border-t-0">
              <span className="w-36 shrink-0 text-sm font-medium">{o.agentId}</span>
              <div className="min-w-48 flex-1"><ModelPicker label={`Model for ${o.agentId}`} value={o.model || ""} models={models} onChange={(q) => save(o.agentId, q)} /></div>
              <Button variant="quiet" size="sm" aria-label={`Use the system default for ${o.agentId}`} disabled={clear.isPending} onClick={async () => { try { await clear.mutateAsync({ agentId: o.agentId }); toast.success(`${o.agentId} follows the system default again.`); } catch { /* toasted */ } }}><Trash2 /> Use default</Button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-muted">None. Every system agent follows the system default.</p>}
      {agentIds.length ? (
        <div className="mt-3 grid gap-2 rounded-pane bg-raised p-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <Field label="Agent"><Select value={agent} onChange={(e) => setAgent(e.target.value)}><option value="">Choose an agent</option>{agentIds.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field>
          <Field label="Model"><ModelPicker value={model} models={models} inheritLabel="Choose a model" onChange={setModelValue} /></Field>
          <Button variant="primary" disabled={!agent || !model || setModel.isPending} onClick={async () => { await save(agent, model); setAgent(""); setModelValue(""); }}>{setModel.isPending ? <Loader2 className="animate-spin" /> : null} Pin</Button>
        </div>
      ) : null}
    </Card>
  );
}

/** Default models, with the reason each one is what it is. Changes apply at once and can be undone. */
export function DefaultsPanel() {
  const { data, isLoading } = useModelDefaults();
  const { data: models } = useUsableModels();
  const { data: profile } = useProfile();
  const isAdmin = Boolean(profile?.isAdmin);
  if (isLoading || !data || !models) return <Skeleton className="h-64" />;
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <DefaultCard
        title="Your default model"
        description="What a new session you start begins on. You can still pick another model when you start one."
        slot={data.userSession} scope="user" canEdit models={models}
        inheritLabel="Follow the cluster default"
        steps={[["user_default", "Your default"], ["cluster_default", "Cluster default"], ["first_available", "First available model"]]}
      />
      <DefaultCard
        title="Cluster default"
        description="For everyone who has not chosen their own. Changing it affects new sessions only."
        slot={data.clusterSession} scope="cluster" canEdit={isAdmin} models={models}
        inheritLabel="None: use the first available model"
        steps={[["cluster_default", "Cluster default"], ["first_available", "First available model"]]}
      />
      {isAdmin ? (
        <>
          <DefaultCard
            title="System default"
            description="For housekeeping sessions the system runs on its own."
            slot={data.system} scope="system" canEdit models={models} restartNote
            inheritLabel="None: use the first available model"
            steps={[["system_default", "System default"], ["first_available", "First available model"]]}
          />
          <SystemOverrides overrides={data.systemOverrides} models={models} />
        </>
      ) : null}
    </div>
  );
}
