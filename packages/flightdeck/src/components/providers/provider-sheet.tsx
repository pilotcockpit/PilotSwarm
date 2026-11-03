import * as React from "react";
import { ChevronRight, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, DisclosureButton } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch, Tag } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import { AllowanceControl, HoldControl, LimitsEditor } from "@/components/providers/limits";
import { DefaultTags, KeyStatus, plural, providerStatus, sessionsUsing, holdRelease } from "@/components/providers/shared";
import { typeLabel, useClearRouting, useDeleteProvider, useProviderTypes, useProviderUsage, useRotateKey, useSetSystemUse, useUsableModels, useUsageGrid } from "@/data/ops/providers";
import { useSessions } from "@/data/source";
import type { Provider } from "@/data/types";
import { cn, tokens } from "@/lib/utils";

export type SheetTab = "overview" | "limits" | "usage";

/**
 * Everything about one provider, in one place and in the order a person needs it: is it working,
 * what is it allowed to spend, where did the tokens go. Controls appear only for what you may
 * change; the rest reads as information, with who can change it.
 */
export function ProviderSheet({ provider, broken, isAdmin, initialTab = "overview", onClose }: { provider?: Provider; broken: boolean; isAdmin: boolean; initialTab?: SheetTab; onClose: () => void }) {
  const [tab, setTab] = React.useState<SheetTab>(initialTab);
  React.useEffect(() => setTab(initialTab), [provider?.name, initialTab]);
  const { data: grid } = useUsageGrid();
  const { data: sessions } = useSessions();
  const rows = (grid || []).filter((r) => r.providerName === provider?.name);
  const providerRow = rows.find((r) => r.rowKind === "provider");
  const shared = provider?.class === "shared";
  const manageable = providerRow?.manageable ?? (shared ? isAdmin : provider?.usableByMe !== false);
  const using = provider ? sessionsUsing(provider.name, sessions) : [];
  const holdText = provider ? holdRelease(provider) : null;
  return (
    <Dialog open={Boolean(provider)} onOpenChange={(o) => !o && onClose()}>
      {provider ? (
        <DialogContent side="right" title={<span className="font-mono">{provider.name}</span>} description={`${typeLabel(provider.typeId)} · ${shared ? "shared with everyone" : provider.usableByMe === false ? `${provider.ownerDisplayName || "someone else"}'s provider` : "yours"}`}>
          <div className="px-5 pb-2"><Segmented label="Provider" value={tab} onChange={setTab} options={[{ value: "overview", label: "Overview" }, { value: "limits", label: "Limits & access" }, { value: "usage", label: "Usage" }]} /></div>
          <DialogBody className="flex flex-col gap-6">
            {tab === "overview" ? <Overview provider={provider} broken={broken} manageable={manageable} isAdmin={isAdmin} usingCount={using.length} onDeleted={onClose} /> : null}
            {tab === "limits" ? <LimitsTab provider={provider} rows={rows} manageable={manageable} isAdmin={isAdmin} usingCount={using.length} holdText={holdText} /> : null}
            {tab === "usage" ? <UsageTab provider={provider} /> : null}
          </DialogBody>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function Overview({ provider, broken, manageable, isAdmin, usingCount, onDeleted }: { provider: Provider; broken: boolean; manageable: boolean; isAdmin: boolean; usingCount: number; onDeleted: () => void }) {
  const status = providerStatus(provider, broken);
  const { data: types } = useProviderTypes();
  const { data: models } = useUsableModels();
  const wi = Boolean(types?.find((t) => t.id === provider.typeId)?.usesWorkloadIdentity);
  const list = (models || []).filter((m) => m.providerId === provider.name);
  const shared = provider.class === "shared";
  const systemUse = useSetSystemUse();
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const del = useDeleteProvider();
  const clear = useClearRouting();
  const [alsoClear, setAlsoClear] = React.useState(true);
  const routing = [provider.isMyDefault && "your default model", provider.isClusterDefault && "the cluster default", provider.isSystemDefault && "the system default"].filter(Boolean) as string[];
  return (
    <>
      <div role={status.tone === "failed" ? "alert" : "status"} className={cn(cardVariants({ tone: status.tone === "failed" ? "failed" : status.tone === "waiting" ? "waiting" : "neutral", enter: true }), "p-3 text-sm")}>
        <KeyStatus provider={provider} broken={broken} />
        <p className="mt-1 text-fg/85">{status.why}</p>
        {routing.length ? <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">Used as <DefaultTags provider={provider} /></div> : null}
      </div>

      <section aria-labelledby="key-h">
        <h3 id="key-h" className="text-base font-semibold">Key</h3>
        {wi ? (
          <p className="mt-1 flex items-start gap-2 text-sm text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> Signs in with the cluster's workload identity. There is no key to store or rotate; if it stops working, the worker's identity settings need attention.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">{provider.hasCredential ? "A key is stored. It is never shown again." : "No key is stored."}{typeof provider.keyChangedAt === "string" ? ` Last changed ${new Date(provider.keyChangedAt).toLocaleDateString()}.` : ""}</p>
            {manageable ? <RotateKey provider={provider} /> : <p className="mt-1 text-xs text-faint">Only {shared ? "an administrator" : "its owner"} can replace it.</p>}
          </>
        )}
      </section>

      {!shared && isAdmin && manageable ? (
        <section aria-labelledby="sys-h">
          <h3 id="sys-h" className="text-base font-semibold">System sessions</h3>
          <label className="mt-1 flex items-start gap-3 text-sm">
            <Switch checked={Boolean(provider.systemUseEnabled)} disabled={systemUse.isPending} onCheckedChange={(enabled) => systemUse.mutate({ name: provider.name, enabled })} aria-label="Let system sessions use this provider" />
            <span className="text-muted">Let system sessions (housekeeping agents) spend on this personal provider. Off by default so your key is not used without you deciding.</span>
          </label>
        </section>
      ) : null}

      <section aria-labelledby="models-h">
        <h3 id="models-h" className="text-base font-semibold">Models <span className="font-normal tabular-nums text-faint">{list.length}</span></h3>
        {list.length ? (
          <ul className={cn(cardVariants({ clip: true }), "mt-2")}>
            {list.map((m) => (
              <li key={m.qualifiedName} className="border-t border-line-subtle px-3 py-2 first:border-t-0">
                <div className="text-sm font-medium">{m.modelName}</div>
                {m.description ? <div className="text-xs text-muted">{m.description}</div> : null}
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-sm text-muted">No models are available until a key is stored.</p>}
      </section>

      {manageable ? (
        <section aria-labelledby="rm-h" className="border-t border-line pt-4">
          <h3 id="rm-h" className="text-base font-semibold">Remove this provider</h3>
          <p className="mt-1 text-sm text-muted">Sessions using it will wait until a provider with this name exists again. Usage history is kept.</p>
          <Button variant="danger" className="mt-2" onClick={() => setConfirmRemove(true)}><Trash2 /> Remove provider…</Button>
          <ConfirmDialog
            open={confirmRemove}
            onOpenChange={setConfirmRemove}
            title={`Remove ${provider.name}?`}
            description={<>{routing.length ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={alsoClear} onChange={(e) => setAlsoClear(e.target.checked)} className="mt-1 size-4 accent-(--accent)" /> <span>Also clear {routing.join(" and ")}, which {routing.length === 1 ? "points" : "point"} to it. Otherwise new sessions will fail to start there.</span></label> : null}</>}
            consequences={[usingCount ? `${plural(usingCount, "session")} using it will pause until the name is provided again.` : "No session is using it right now.", "The stored key is deleted.", "Usage history stays."]}
            confirmLabel="Remove provider"
            tone="danger"
            onConfirm={async () => {
              if (routing.length && alsoClear) await clear.mutateAsync({ name: provider.name });
              const r = await del.mutateAsync({ name: provider.name, shared });
              toast.success(`${provider.name} removed.${r?.waitingSessions ? ` ${plural(r.waitingSessions, "session")} will wait for it.` : ""}`);
              onDeleted();
            }}
          />
        </section>
      ) : null}
    </>
  );
}

function RotateKey({ provider }: { provider: Provider }) {
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState("");
  const rotate = useRotateKey();
  const shared = provider.class === "shared";
  const submit = async () => {
    const k = key;
    setKey("");
    try { await rotate.mutateAsync({ name: provider.name, type: provider.typeId, shared, apiKey: k }); setOpen(false); } catch { /* toasted */ }
  };
  return (
    <div className="mt-1">
      <DisclosureButton aria-expanded={open} onClick={() => setOpen((v) => !v)} className="text-sm text-accent">
        <ChevronRight className={cn("size-4 transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden /> Replace the key
      </DisclosureButton>
      {open ? (
        <div className="mt-2 flex flex-col gap-2 animate-enter">
          <Field label="New key" hint="Only the key changes. Name, defaults, routing and usage history stay as they are."><Input type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} /></Field>
          <div className="flex gap-2"><Button variant="primary" disabled={!key.trim() || rotate.isPending} onClick={submit}>{rotate.isPending ? <Loader2 className="animate-spin" /> : null} Replace key</Button><Button onClick={() => { setKey(""); setOpen(false); }}>Cancel</Button></div>
        </div>
      ) : null}
    </div>
  );
}

function LimitsTab({ provider, rows, manageable, isAdmin, usingCount, holdText }: { provider: Provider; rows: ReturnType<typeof useUsageGrid>["data"] & {}; manageable: boolean; isAdmin: boolean; usingCount: number; holdText: string | null }) {
  const { data: models } = useUsableModels();
  const list = (models || []).filter((m) => m.providerId === provider.name);
  const shared = provider.class === "shared";
  const monthQuota = rows.find((r) => r.rowKind === "provider")?.periods.month.quotaTokens ?? null;
  return (
    <>
      <LimitsEditor provider={provider} rows={rows} manageable={manageable} models={list} usingCount={usingCount} />
      {shared ? <AllowanceControl provider={provider} isAdmin={isAdmin} monthQuota={monthQuota} /> : null}
      <HoldControl provider={provider} isAdmin={isAdmin} holdText={holdText} usingCount={usingCount} />
    </>
  );
}

function UsageTab({ provider }: { provider: Provider }) {
  const { data, isLoading } = useProviderUsage(provider.name, 14);
  const chartId = React.useId();
  if (isLoading) return <p className="text-sm text-muted">Loading usage…</p>;
  const daily = data?.daily || [];
  const max = Math.max(1, ...daily.map((d) => Number(d.total) || 0));
  const total = daily.reduce((s, d) => s + (Number(d.total) || 0), 0);
  const breakdown = data?.breakdown || [];
  const bmax = Math.max(1, ...breakdown.map((b) => b.total));
  if (!daily.length && !breakdown.length) return <p className="text-sm text-muted">No usage recorded for {provider.name} in the last 14 days.</p>;
  return (
    <>
      <figure aria-labelledby={chartId}>
        <figcaption id={chartId} className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="font-semibold tabular-nums">{tokens(total)} tokens in 14 days</span><span className="text-xs text-muted">{daily[0]?.day} – {daily.at(-1)?.day}</span></figcaption>
        <svg viewBox={`0 0 ${daily.length * 20} 100`} className="h-32 w-full" role="img" aria-label={`Daily tokens for ${provider.name}, ${daily.length} days. Peak ${tokens(max)}.`}>
          {daily.map((d, i) => { const h = Math.max(1, ((Number(d.total) || 0) / max) * 92); return <rect key={d.day} x={i * 20 + 3} y={100 - h} width={14} height={h} rx={2} className="fill-accent/70"><title>{`${d.day}: ${tokens(Number(d.total))}`}</title></rect>; })}
        </svg>
      </figure>
      {breakdown.length ? (
        <section aria-labelledby="by-model-h">
          <h3 id="by-model-h" className="text-base font-semibold">By model</h3>
          <ul className="mt-2">
            {breakdown.map((b) => (
              <li key={b.key} className="border-t border-line-subtle py-2 first:border-t-0">
                <div className="flex items-baseline justify-between gap-2 text-sm"><span className="min-w-0 truncate font-medium">{(b.label || b.key).split(":").pop()}</span><span className="tabular-nums text-muted">{tokens(b.total)}{b.turns ? <span className="text-faint"> · {b.turns} turns</span> : null}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-accent/70" style={{ width: `${(b.total / bmax) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Tag className="self-start">Usage counts tokens, not money</Tag>
    </>
  );
}
