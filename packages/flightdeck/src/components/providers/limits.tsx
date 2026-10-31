import * as React from "react";
import { ChevronRight, Loader2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Button, DisclosureButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/misc";
import { cardVariants } from "@/components/ui/card";
import { Meter, Select, monthProjection, plural } from "@/components/providers/shared";
import { PERIODS, PERIOD_LABEL, PERIOD_WORD, initialLimitText, parseTokens, untilWords, useRemoveLimit, useSetAllowance, useSetHold, useSetLimit, type GridCell, type GridRow, type Period } from "@/data/ops/providers";
import type { Provider } from "@/data/types";
import { cn, tokens } from "@/lib/utils";

const PRESETS: Record<Period, number[]> = { day: [250_000, 1_000_000, 5_000_000, 10_000_000], week: [1_000_000, 5_000_000, 25_000_000, 50_000_000], month: [5_000_000, 10_000_000, 50_000_000, 100_000_000] };

/**
 * One limit, read and edited in place. The editor says what saving will do before it does it:
 * how much headroom is left, or that new turns will wait because the period is already over.
 * Saving a limit never resets what a period has spent; it counts from now.
 */
/** "Daily", not "Dayly": the adverb is irregular for day. */
const PERIOD_ADVERB = { day: "Daily", week: "Weekly", month: "Monthly" } as const;

export function LimitRow({ provider, period, model, cell, manageable, usingCount, allowancePct, shared }: { provider: string; period: Period; model?: string | null; cell?: GridCell; manageable: boolean; usingCount: number; allowancePct: number; shared: boolean }) {
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState("");
  const set = useSetLimit();
  const remove = useRemoveLimit();
  const quota = cell?.quotaTokens ?? null;
  const used = cell?.usedTokens ?? 0;
  const parsed = parseTokens(text);
  const resets = untilWords(cell?.resetsAtUtc);
  const over = parsed != null && used >= parsed;

  const open = () => { setText(initialLimitText(quota)); setEditing(true); };
  const save = async () => {
    if (parsed == null) return;
    try {
      await set.mutateAsync({ name: provider, period, model: model ?? null, tokens: parsed });
      toast.success(`${PERIOD_LABEL[period]} limit is ${tokens(parsed)}${model ? ` for ${model.split(":").pop()}` : ""}.`);
      setEditing(false);
    } catch { /* toasted */ }
  };
  const clear = async () => {
    try {
      await remove.mutateAsync({ name: provider, period, model: model ?? null });
      toast.success(`${PERIOD_LABEL[period]} limit removed.`, { action: quota != null ? { label: "Undo", onClick: () => void set.mutateAsync({ name: provider, period, model: model ?? null, tokens: quota }) } : undefined });
      setEditing(false);
    } catch { /* toasted */ }
  };

  return (
    <li className="border-t border-line-subtle py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="w-24 shrink-0 text-sm font-medium">{model ? PERIOD_ADVERB[period] : PERIOD_LABEL[period]}</div>
        <div className="min-w-40 flex-1"><Meter used={used} limit={quota} label={`${provider} ${PERIOD_WORD[period]} limit${model ? ` for ${model}` : ""}`} />{period === "month" && !model && monthProjection(used, quota) ? <p className="mt-1 text-xs text-waiting">{monthProjection(used, quota)}</p> : null}</div>
        {resets ? <span className="text-xs text-muted">resets in {resets}</span> : null}
        {manageable && !editing ? <Button size="sm" onClick={open}>{quota == null ? "Set a limit" : "Change"}</Button> : null}
      </div>
      {editing ? (
        <div className="mt-3 flex flex-col gap-3 rounded-pane bg-raised p-3 animate-enter">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Common limits">
            {PRESETS[period].map((n) => <Chip key={n} active={parsed === n} onClick={() => setText(String(n))}>{tokens(n)}</Chip>)}
          </div>
          <Field label={`Tokens per ${PERIOD_WORD[period]}`} hint={parsed == null && text ? "Use a number like 5M, 250k or 2,000,000." : undefined} error={undefined}>
            <Input value={text} onChange={(e) => setText(e.target.value)} inputMode="text" autoFocus spellCheck={false} placeholder="e.g. 10M" />
          </Field>
          {parsed != null ? (
            <p className={cn("text-sm", over ? "text-waiting" : "text-muted")} role="status">
              {over
                ? <>Already {tokens(used)} used {PERIOD_LABEL[period].toLowerCase()}, over this limit. New turns will wait{resets ? ` until it resets in ${resets}` : ""}{usingCount ? `, and ${plural(usingCount, "running session")} on ${provider} will pause at their next turn` : ""}.</>
                : <>{tokens(parsed - used)} of headroom{resets ? `, resetting in ${resets}` : ""}.{shared && allowancePct < 100 ? ` Each person can use up to ${tokens(Math.round((parsed * allowancePct) / 100))} of it.` : ""}</>}
              {" "}Counting continues from what is already spent.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={over ? "danger" : "primary"} onClick={save} disabled={parsed == null || set.isPending}>{set.isPending ? <Loader2 className="animate-spin" /> : null}{over ? "Save and pause new turns" : "Save limit"}</Button>
            <Button onClick={() => setEditing(false)}>Cancel</Button>
            {quota != null ? <Button variant="quiet" className="sm:ml-auto" onClick={clear} disabled={remove.isPending}>Remove limit</Button> : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function ModelLimits({ provider, rows, manageable, models, usingCount, allowancePct, shared }: { provider: string; rows: GridRow[]; manageable: boolean; models: Array<{ qualifiedName: string; modelName: string }>; usingCount: number; allowancePct: number; shared: boolean }) {
  const modelRows = rows.filter((r) => r.rowKind === "model");
  const [open, setOpen] = React.useState(modelRows.length > 0);
  const [model, setModel] = React.useState("");
  const [period, setPeriod] = React.useState<Period>("day");
  const [text, setText] = React.useState("");
  const set = useSetLimit();
  const parsed = parseTokens(text);
  const free = models.filter((m) => !modelRows.some((r) => r.scope === m.qualifiedName && r.periods[period].quotaTokens != null));
  return (
    <div className="mt-2">
      <DisclosureButton aria-expanded={open} onClick={() => setOpen((v) => !v)} className="text-sm text-muted">
        <ChevronRight className={cn("size-4 transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden /> Limits for one model{modelRows.length ? ` (${modelRows.length})` : ""}
      </DisclosureButton>
      {open ? (
        <div className="mt-2">
          {modelRows.length ? (
            <ul>
              {modelRows.flatMap((r) => PERIODS.filter((p) => r.periods[p].quotaTokens != null).map((p) => (
                <li key={`${r.scope}-${p}`} className="border-t border-line-subtle first:border-t-0">
                  <div className="pt-2 text-xs font-medium text-muted">{r.scope.split(":").pop()}</div>
                  <ul><LimitRow provider={provider} period={p} model={r.scope} cell={r.periods[p]} manageable={manageable} usingCount={usingCount} allowancePct={allowancePct} shared={shared} /></ul>
                </li>
              )))}
            </ul>
          ) : <p className="text-sm text-muted">No model has its own limit. A model limit stops one expensive model without pausing the rest.</p>}
          {manageable ? (
            <div className="mt-3 grid gap-2 rounded-pane bg-raised p-3 sm:grid-cols-[1fr_120px_1fr_auto] sm:items-end">
              <Field label="Model"><Select value={model} onChange={(e) => setModel(e.target.value)}><option value="">Choose a model</option>{free.map((m) => <option key={m.qualifiedName} value={m.qualifiedName}>{m.modelName}</option>)}</Select></Field>
              <Field label="Per"><Select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>{PERIODS.map((p) => <option key={p} value={p}>{PERIOD_WORD[p]}</option>)}</Select></Field>
              <Field label="Tokens"><Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 900k" spellCheck={false} /></Field>
              <Button variant="primary" disabled={!model || parsed == null || set.isPending} onClick={async () => { try { await set.mutateAsync({ name: provider, period, model, tokens: parsed! }); toast.success(`Limit added for ${model.split(":").pop()}.`); setModel(""); setText(""); } catch { /* toasted */ } }}>Add</Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The whole limits area for one provider: provider-wide meters, then per-model limits behind a disclosure. */
export function LimitsEditor({ provider, rows, manageable, models, usingCount }: { provider: Provider; rows: GridRow[]; manageable: boolean; models: Array<{ qualifiedName: string; modelName: string }>; usingCount: number }) {
  const row = rows.find((r) => r.rowKind === "provider");
  const shared = provider.class === "shared";
  const allowancePct = provider.allowancePct ?? 100;
  return (
    <section aria-labelledby="limits-h">
      <h3 id="limits-h" className="text-base font-semibold">Limits</h3>
      <p className="mt-0.5 text-sm text-muted">A hard cap on tokens per period. When a period is full, new turns wait until it resets or the limit is raised. {manageable ? "" : "You can see these but not change them."}</p>
      <ul className="mt-2">
        {PERIODS.map((p) => <LimitRow key={p} provider={provider.name} period={p} cell={row?.periods[p]} manageable={manageable} usingCount={usingCount} allowancePct={allowancePct} shared={shared} />)}
      </ul>
      <ModelLimits provider={provider.name} rows={rows} manageable={manageable} models={models} usingCount={usingCount} allowancePct={allowancePct} shared={shared} />
    </section>
  );
}

/** The share of each limit one person may use. Shared providers only; admins set it, everyone sees what it means for them. */
export function AllowanceControl({ provider, isAdmin, monthQuota }: { provider: Provider; isAdmin: boolean; monthQuota: number | null }) {
  const current = provider.allowancePct ?? 100;
  const [pct, setPct] = React.useState(current);
  React.useEffect(() => setPct(current), [current]);
  const set = useSetAllowance();
  const dirty = pct !== current;
  const share = monthQuota != null ? Math.round((monthQuota * pct) / 100) : null;
  return (
    <section aria-labelledby="allow-h">
      <h3 id="allow-h" className="text-base font-semibold">Per-person allowance</h3>
      <p className="mt-0.5 text-sm text-muted">How much of each limit a single person may use, so one person cannot spend everyone's budget.</p>
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <input type="range" min={1} max={100} step={1} value={pct} disabled={!isAdmin} onChange={(e) => setPct(Number(e.target.value))} aria-label="Per-person allowance, percent" className="h-6 min-w-0 flex-1 accent-(--accent) disabled:opacity-50 pointer-coarse:h-11" />
          <span className="w-12 text-right text-sm font-medium tabular-nums">{pct}%</span>
        </div>
        <p className="text-sm text-muted">{pct === 100 ? "No per-person ceiling: anyone can use the whole limit." : `Each person can use up to ${pct}% of every limit${share != null ? `, about ${tokens(share)} a month` : ""}.`}</p>
        {isAdmin ? (
          <div><Button variant={dirty ? "primary" : "default"} disabled={!dirty || set.isPending} onClick={async () => { try { await set.mutateAsync({ name: provider.name, pct }); toast.success(pct === 100 ? "Allowance removed." : `Each person may now use up to ${pct}%.`, { action: { label: "Undo", onClick: () => void set.mutateAsync({ name: provider.name, pct: current }) } }); } catch { /* toasted */ } }}>{set.isPending ? <Loader2 className="animate-spin" /> : null} Save allowance</Button></div>
        ) : <p className="text-xs text-faint">Only an administrator can change this.</p>}
      </div>
    </section>
  );
}

function tomorrowUtc() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString();
}

/** Pause new turns on a provider without touching its limits. Presets first; releasing is one click and wakes waiting sessions. */
export function HoldControl({ provider, isAdmin, holdText, usingCount }: { provider: Provider; isAdmin: boolean; holdText: string | null; usingCount: number }) {
  const [preset, setPreset] = React.useState<"hour" | "tomorrow" | "indefinite" | "custom">("hour");
  const [custom, setCustom] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const set = useSetHold();
  const until = preset === "hour" ? new Date(Date.now() + 3_600_000).toISOString() : preset === "tomorrow" ? tomorrowUtc() : preset === "custom" && custom ? new Date(custom).toISOString() : null;
  const customBad = preset === "custom" && (!custom || !(Date.parse(custom) > Date.now()));
  const label = preset === "hour" ? "for an hour" : preset === "tomorrow" ? "until tomorrow 00:00 UTC" : preset === "indefinite" ? "until you release it" : "until the time you chose";
  return (
    <section aria-labelledby="hold-h">
      <h3 id="hold-h" className="text-base font-semibold">Hold</h3>
      <p className="mt-0.5 text-sm text-muted">Pause new turns on this provider. Nothing is cancelled, and running turns finish. Good for a key rotation or a billing surprise.</p>
      {holdText ? (
        <div role="status" className={cn(cardVariants({ tone: "waiting" }), "mt-3 flex flex-wrap items-center gap-3 p-3 text-sm")}>
          <Pause className="size-4 shrink-0 text-waiting" aria-hidden />
          <span className="min-w-0 flex-1">New turns are paused {holdText}.</span>
          {isAdmin ? <Button disabled={set.isPending} onClick={async () => { try { await set.mutateAsync({ name: provider.name, release: true }); toast.success("Hold released. Waiting sessions are waking up."); } catch { /* toasted */ } }}>{set.isPending ? <Loader2 className="animate-spin" /> : <Play />} Release hold</Button> : <span className="text-xs text-muted">An administrator can release it.</span>}
        </div>
      ) : isAdmin ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="How long">
            {([["hour", "1 hour"], ["tomorrow", "Until tomorrow"], ["indefinite", "Until released"], ["custom", "Choose a time"]] as const).map(([k, l]) => <Chip key={k} active={preset === k} onClick={() => setPreset(k)}>{l}</Chip>)}
          </div>
          {preset === "custom" ? <Field label="Resume at" hint="Your local time." error={custom && customBad ? "Pick a time in the future." : undefined}><Input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} /></Field> : null}
          <div><Button disabled={customBad} onClick={() => setConfirm(true)}><Pause /> Pause new turns…</Button></div>
        </div>
      ) : <p className="mt-2 text-sm text-muted">No hold is active.</p>}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Pause ${provider.name}?`}
        description={`New turns on ${provider.name} will wait ${label}.`}
        consequences={[usingCount ? `${plural(usingCount, "session")} using it will pause at their next turn.` : "No session is using it right now.", "Nothing is cancelled. Releasing the hold wakes them.", "Personal providers' owners and other providers are not affected."]}
        confirmLabel="Pause new turns"
        tone="danger"
        onConfirm={async () => { await set.mutateAsync({ name: provider.name, untilUtc: until }); toast.success(`New turns are paused ${label}.`); }}
      />
    </section>
  );
}
