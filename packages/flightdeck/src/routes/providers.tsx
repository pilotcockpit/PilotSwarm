import * as React from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { AlertTriangle, Check, Clock, ExternalLink, Info, KeyRound, X } from "lucide-react";
import { TopBar, ClassicLink } from "@/shell/AppShell";
import { CLASSIC_PORTAL_URL } from "@/shell/prefs";
import { useModels, useProfile, useProviders, useSessions, useUsage } from "@/data/source";
import { describeError } from "@/data/state";
import type { Provider, Session, UsageSummary } from "@/data/types";
import { StateGlyph } from "@/components/state";
import { EmptyState, Panel, SectionTitle } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/tabs";
import { Skeleton, Tag } from "@/components/ui/misc";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import { cn, tokens } from "@/lib/utils";
import { cardVariants } from "@/components/ui/card";

const route = getRouteApi("/providers");

/** Providers and budgets in one area: keys, defaults, limits and usage together. */
export function ProvidersPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const tab = search.tab || "providers";
  const { data: providers, isLoading, isError, refetch } = useProviders();
  const { data: models } = useModels();
  const { data: usage } = useUsage();
  const { data: profile } = useProfile();
  const { data: sessions } = useSessions();
  const selected = providers?.find((p) => p.name === search.provider);
  const paused = React.useMemo(() => (sessions || []).filter((s) => s.pauseState), [sessions]);
  // A provider the API calls usable can still be broken on the workers. Say so here.
  const brokenOnWorkers = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions || []) { const e = describeError(s.error); if (s.error && e.provider) set.add(e.provider); }
    return set;
  }, [sessions]);

  return (
    <>
      <TopBar crumbs={[{ label: "Providers" }]} actions={<Button variant="default" aria-label="Add provider" onClick={() => window.open(CLASSIC_PORTAL_URL, "_blank", "noopener")}><KeyRound /><span className="max-sm:sr-only">Add provider</span></Button>} />
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5 md:px-5">
        <Segmented label="Providers" value={tab} onChange={(t) => navigate({ search: { tab: t }, replace: true })} options={[{ value: "providers", label: "Providers" }, { value: "defaults", label: "Defaults" }, { value: "copilot", label: "GitHub Copilot" }]} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] px-4 py-5 md:px-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Model access and usage</h2>
            <p className="mt-1 text-sm text-muted">Check credentials, see what is holding up work, and review the limits that apply to you.</p>
          </div>
          {isError ? <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm text-failed"><span>Couldn't refresh providers. {providers ? "Showing the last loaded information." : "Try again to check model access."}</span><Button size="sm" onClick={() => void refetch()}>Try again</Button></div> : null}
          {tab === "providers" ? (
            <>
              <PausedNotice providers={providers || []} paused={paused} isAdmin={Boolean(profile?.isAdmin)} onOpen={(name) => navigate({ search: (prev: any) => ({ ...prev, provider: name }) })} />
              <UsageStrip usage={usage} />
              <SectionTitle count={providers?.length}>Providers</SectionTitle>
              {isLoading ? <Skeleton className="h-40" /> : !providers?.length && !isError ? (
                <Panel><EmptyState icon={<KeyRound />} title="No providers yet" action={<ClassicLink>Add a provider</ClassicLink>}>Add your own key, or ask an admin to share one.</EmptyState></Panel>
              ) : (
                <Panel>
                  <table className="w-full text-sm max-sm:hidden">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-faint">
                        <th className="px-3 py-2 font-medium">Provider</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="hidden px-3 py-2 font-medium lg:table-cell">Used as</th>
                        <th className="px-3 py-2 font-medium">This month</th>
                        <th className="px-3 py-2 text-right font-medium">Your allowance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(providers || []).map((p) => {
                        const n = (models || []).filter((m) => m.providerId === p.name).length;
                        const open = () => navigate({ search: (prev: any) => ({ ...prev, provider: p.name }) });
                        return (
                          <tr key={p.name} className={cn("border-b border-line-subtle last:border-0 hover:bg-raised/60", search.provider === p.name && "bg-raised")} onClick={open}>
                            <td className="px-3 py-3">
                              <Button variant="link" size="sm" className="h-auto min-h-6 justify-start px-0 py-0.5 font-mono text-sm font-medium text-fg pointer-coarse:min-h-11" onClick={(e) => { e.stopPropagation(); open(); }}>{p.name}</Button>
                              <div className="text-xs text-muted">{p.class === "personal" ? `Yours${p.ownerDisplayName ? ` · ${p.ownerDisplayName}` : ""}` : "Shared"} · <span className="font-mono">{p.typeId}</span>{n ? ` · ${n} model${n === 1 ? "" : "s"}` : ""}</div>
                            </td>
                            <td className="px-3 py-3"><KeyStatus provider={p} broken={brokenOnWorkers.has(p.name)} /></td>
                            <td className="hidden px-3 py-3 lg:table-cell"><DefaultBadges provider={p} /></td>
                            <td className="w-[260px] px-3 py-3"><UsageMeter provider={p} /></td>
                            <td className="px-3 py-3 text-right tabular-nums">{p.allowancePct == null ? "Not reported" : `${p.allowancePct}%`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {/* Phones: one two-line row per provider instead of a table that scrolls sideways. */}
                  <ul className="sm:hidden">
                    {(providers || []).map((p) => (
                      <li key={p.name} className="border-t border-line-subtle first:border-t-0">
                        <button type="button" onClick={() => navigate({ search: (prev: any) => ({ ...prev, provider: p.name }) })} className="flex w-full flex-col gap-1.5 px-3 py-3 text-left">
                          <span className="flex items-center gap-2"><span className="font-mono text-sm font-medium">{p.name}</span><span className="ml-auto"><KeyStatus provider={p} broken={brokenOnWorkers.has(p.name)} /></span></span>
                          <span className="text-xs text-muted">{p.class === "personal" ? "Yours" : "Shared"} · {p.typeId} · {p.allowancePct == null ? "Allowance not reported" : `${p.allowancePct}% allowance`}</span>
                          <UsageMeter provider={p} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
              <LimitsSection providers={providers || []} />
              <p className="mt-3 text-xs text-faint">Limits are token counts per day, week or month. The allowance is the share of each limit one person may use. A hold pauses new turns until it is released. Money is not shown: the backend has no per-model prices.</p>
            </>
          ) : tab === "defaults" ? (
            <Panel>
              <dl>
                {[
                  ["My default", providers?.find((p) => p.isMyDefault)?.name || "Not set: the cluster default applies", "Used for new sessions you start."],
                  ...(profile?.isAdmin ? [
                    ["Cluster default", providers?.find((p) => p.isClusterDefault)?.name || "Not set", "Used when a person has no default. Changing it affects new sessions only."],
                    ["System default", providers?.find((p) => p.isSystemDefault)?.name || "Not set", "Used by system sessions. They restart on their next run to pick it up."],
                  ] : []),
                ].map(([k, v, note]) => (
                  <div key={k} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-line-subtle px-4 py-3 first:border-t-0">
                    <dt className="w-40 shrink-0 text-sm font-medium">{k}</dt>
                    <dd className="min-w-0 flex-1"><span className="font-mono text-sm">{v}</span><p className="text-xs text-muted">{note}</p></dd>
                  </div>
                ))}
              </dl>
              <p className="border-t border-line px-4 py-2.5 text-xs text-muted">Changing defaults is not ported yet: <ClassicLink>use the classic portal</ClassicLink>.</p>
            </Panel>
          ) : (
            <Panel><EmptyState icon={<KeyRound />} title="GitHub Copilot" action={<ClassicLink>Set your Copilot key</ClassicLink>}>Your Copilot key lets you use the Copilot models. Admins also manage the system key and the one-time adoption of a legacy key.</EmptyState></Panel>
          )}
        </div>
      </div>
      <ProviderDetail provider={selected} broken={selected ? brokenOnWorkers.has(selected.name) : false} usage={usage} onClose={() => navigate({ search: (p: any) => ({ ...p, provider: undefined }) })} />
    </>
  );
}

/**
 * One status per provider, from three facts: the credential exists, the workers can use it,
 * and you are allowed to. The headline is the first one that fails, so a provider never reads
 * "Set" in one place and "Not set up" in another. The drawer shows all three.
 */
type ProviderStatus = { key: "ready" | "no-key" | "workers" | "not-shared" | "hold" | "limit" | "unknown"; word: string; why: string; tone: "ok" | "failed" | "waiting" | "muted" };
/** What releases a hold, in words; null when there is no active hold. A hold pauses new turns. */
function holdRelease(p: Provider): string | null {
  if (p.holdIndefinite) return "until someone releases it";
  const until = p.holdUntilUtc ? Date.parse(p.holdUntilUtc) : NaN;
  return Number.isFinite(until) && until > Date.now() ? `until ${new Date(until).toLocaleString()}` : null;
}

function providerStatus(p: Provider, broken: boolean): ProviderStatus {
  const hold = holdRelease(p);
  const month = p.usage?.month;
  const usedFraction = month?.limit == null ? null : month.limit > 0 ? month.used / month.limit : 1;
  if (p.hasCredential == null) return { key: "unknown", word: "Not reported", why: "This response does not report whether a credential is configured. Review the provider before starting work.", tone: "muted" };
  if (!p.hasCredential) return { key: "no-key", word: "No key", why: "No credential is stored for this provider.", tone: "muted" };
  if (broken) return { key: "workers", word: "Session errors reported", why: "Recent sessions reported an error involving this provider. Open a failed session for its exact cause before changing credentials or worker settings.", tone: "failed" };
  if (p.usableByMe === false) return { key: "not-shared", word: "Unavailable to you", why: "The API marks this provider as unavailable to your account. Review its access settings or choose another provider.", tone: "muted" };
  if (p.usableByMe == null) return { key: "unknown", word: "Access not reported", why: "A credential is stored, but this response does not report whether you can use this provider.", tone: "muted" };
  if (hold) return { key: "hold", word: "On hold", why: `New turns are paused ${hold}.`, tone: "waiting" };
  if (usedFraction != null && usedFraction >= 0.9) return { key: "limit", word: usedFraction >= 1 ? "Limit reached" : "Near its limit", why: usedFraction >= 1 ? "Reported usage has reached the monthly limit. Review the limit or wait for its reset." : "Usage is at or above 90% of the monthly limit; new turns pause when it is reached.", tone: "waiting" };
  return { key: "ready", word: "Configured", why: "A credential is stored and this provider is available to you. Live connectivity has not been tested here.", tone: "ok" };
}
const STATUS_ICON = { ok: Check, failed: AlertTriangle, waiting: Clock, muted: X } as const;
const STATUS_TONE = { ok: "text-ok", failed: "text-failed", waiting: "text-waiting", muted: "text-muted" } as const;

function KeyStatus({ provider: p, broken }: { provider: Provider; broken: boolean }) {
  const st = providerStatus(p, broken);
  const Icon = st.key === "unknown" ? Info : STATUS_ICON[st.tone];
  return <span className={cn("inline-flex items-center gap-1 text-sm font-medium", STATUS_TONE[st.tone])}><Icon className="size-3.5" aria-hidden /> {st.word}{st.key === "hold" ? <span className="font-normal text-muted"> {holdRelease(p)}</span> : null}</span>;
}

/** One divided strip, not three hero tiles: the totals are context, the table is the content. */
function UsageStrip({ usage }: { usage?: UsageSummary | null }) {
  const w = usage?.windows;
  return (
    <dl className={cn(cardVariants({ clip: true, enter: true }), "mb-6 grid grid-cols-3 divide-x divide-line")}>
      {(["day", "week", "month"] as const).map((k) => (
        <div key={k} className="px-4 py-2.5">
          <dt className="text-xs text-muted">{k === "day" ? "Today" : k === "week" ? "This week" : "This month"}</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-base font-semibold tabular-nums">{tokens(w?.[k]?.total)}</span>
            <span className="text-xs text-faint">{w?.[k] ? <>tokens<span className="max-sm:hidden"> · {w[k].turns} turns</span></> : "Not reported"}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function UsageMeter({ provider: p }: { provider: Provider }) {
  const m = p.usage?.month;
  if (!m) return <span className="text-xs text-faint">Not reported</span>;
  if (m.limit == null) return <span className="text-xs text-muted"><span className="tabular-nums text-fg">{tokens(m.used)}</span> · no monthly limit</span>;
  const pct = m.limit > 0 ? Math.round((m.used / m.limit) * 100) : 100;
  const fill = Math.min(100, Math.max(0, pct));
  const tone = pct >= 80 ? "bg-waiting" : "bg-accent";
  return (
    <div className="min-w-[160px]">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="tabular-nums text-fg">{tokens(m.used)} <span className="text-faint">/ {tokens(m.limit)}</span></span>
        <span className={cn("tabular-nums", pct >= 80 ? "text-waiting" : "text-muted")}>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-raised" role="meter" aria-valuenow={fill} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${pct}% of the monthly limit used`} aria-label={`${p.name} monthly limit`}>
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}

function DefaultBadges({ provider: p }: { provider: Provider }) {
  const badges = [p.isClusterDefault && "Cluster default", p.isMyDefault && "My default", p.isSystemDefault && "System default"].filter(Boolean) as string[];
  if (!badges.length) return <span className="text-xs text-faint">—</span>;
  return <span className="flex flex-wrap gap-1">{badges.map((b) => <Tag key={b}>{b}</Tag>)}</span>;
}

/** The finding first: a limit that is pausing work, and what to do about it. */
function PausedNotice({ providers, paused, isAdmin, onOpen }: { providers: Provider[]; paused: Session[]; isAdmin: boolean; onOpen: (name: string) => void }) {
  const hot = providers.find((p) => p.usage?.month?.limit && p.usage.month.used / p.usage.month.limit >= 0.9);
  if (!hot && !paused.length) return null;
  const name = hot?.name || String(paused[0]?.pauseState?.provider || "A provider");
  const pct = hot?.usage?.month?.limit ? Math.round((hot.usage.month.used / hot.usage.month.limit) * 100) : null;
  return (
    <div role="status" className={cn(cardVariants({ tone: "waiting", enter: true }), "mb-4 flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center")}>
      <p className="flex min-w-0 flex-1 items-start gap-2.5 text-sm">
        <StateGlyph state="waiting" className="mt-1.5" />
        <span className="min-w-0">
        <span className="font-mono font-semibold">{name}</span>{pct != null ? ` is at ${pct}% of its monthly limit.` : " is limiting work."}{" "}
        {paused.length ? <span className="text-fg/85">Across providers, {paused.length === 1 ? "1 session is" : `${paused.length} sessions are`} paused by a limit or hold.</span> : null}{isAdmin ? null : <span className="text-fg/85"> Shared limits may need an admin.</span>}
        </span>
      </p>
      <div className="flex flex-wrap gap-2 max-sm:pl-[18px]">
        {isAdmin ? (
          <Button size="sm" asChild><a href={CLASSIC_PORTAL_URL} target="_blank" rel="noreferrer">Raise limit in classic portal <ExternalLink /></a></Button>
        ) : (
          <Button size="sm" onClick={() => onOpen(name)}>See the limit</Button>
        )}
        {paused.length ? <Button size="sm" asChild><Link to="/sessions" search={{ state: "waiting" }}>See paused sessions</Link></Button> : null}
      </div>
    </div>
  );
}

function LimitsSection({ providers }: { providers: Provider[] }) {
  const rows = providers.flatMap((p) => (p.limits || []).map((l) => ({ p, l })));
  if (!rows.length) return null;
  return (
    <section className="mt-6">
      <SectionTitle count={rows.length}>Limits and allowances</SectionTitle>
      <Panel>
        {rows.map(({ p, l }, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-subtle px-4 py-2.5 text-sm first:border-t-0">
            <span className="w-44 shrink-0 font-mono text-sm">{p.name}</span>
            <span className="text-muted">{l.model ? <span className="font-mono">{l.model.split(":").pop()}</span> : "All models"}</span>
            <span className="ml-auto tabular-nums">{tokens(l.tokens)} per {l.period}</span>
            <span className="w-32 text-right text-xs text-muted">{p.allowancePct == null ? "Allowance not reported" : `${p.allowancePct}% per person`}</span>
          </div>
        ))}
      </Panel>
    </section>
  );
}

function ProviderDetail({ provider, broken, usage, onClose }: { provider?: Provider; broken: boolean; usage?: UsageSummary | null; onClose: () => void }) {
  const { data: models } = useModels();
  const [tab, setTab] = React.useState<"overview" | "limits" | "usage">("overview");
  const chartId = React.useId();
  React.useEffect(() => setTab("overview"), [provider?.name]);
  const list = (models || []).filter((m) => m.providerId === provider?.name);
  const status = providerStatus(provider ?? ({ name: "", typeId: "" } as Provider), broken);
  const max = Math.max(0, ...(usage?.daily || []).map((d) => Number(d.total) || 0));
  return (
    <Dialog open={Boolean(provider)} onOpenChange={(o) => !o && onClose()}>
      {provider ? (
        <DialogContent side="right" title={<span className="font-mono">{provider.name}</span>} description={`${provider.typeId} · ${provider.class === "personal" ? "your provider" : "shared provider"}`}>
          <div className="px-5 pb-2"><Segmented label="Provider" value={tab} onChange={setTab} options={[{ value: "overview", label: "Overview" }, { value: "limits", label: "Limits" }, { value: "usage", label: "Usage" }]} /></div>
          <DialogBody className="flex flex-col gap-4">
            {tab === "overview" ? (
              <>
                <div role={status.tone === "failed" ? "alert" : "status"} className={cn(cardVariants({ tone: status.tone === "failed" ? "failed" : status.tone === "waiting" ? "waiting" : "neutral", enter: true }), "p-3 text-sm")}>
                  <KeyStatus provider={provider} broken={broken} />
                  <p className="mt-1 text-fg/85">{status.why}</p>
                </div>
                <dl className="grid grid-cols-[130px_1fr] gap-y-2 text-sm">
                  <dt className="text-muted">Credential</dt><dd>{provider.hasCredential == null ? "Not reported" : provider.hasCredential ? "Stored" : "Missing"}</dd>
                  <dt className="text-muted">Connectivity</dt><dd>{broken ? "Recent session errors" : "Not tested here"}</dd>
                  <dt className="text-muted">Usable by you</dt><dd>{provider.usableByMe == null ? "Not reported" : provider.usableByMe ? "Yes" : "No"}</dd>
                  <dt className="text-muted">Endpoint</dt><dd className="break-all font-mono text-xs">{provider.baseUrl || "—"}</dd>
                </dl>
                <div>
                  <div className="mb-1.5 text-sm font-medium">Models <span className="tabular-nums text-faint">{list.length}</span></div>
                  <ul className={cardVariants({ clip: true })}>
                    {list.map((m) => (
                      <li key={m.qualifiedName} className="border-t border-line-subtle px-3 py-2 first:border-t-0">
                        <div className="font-mono text-sm">{m.modelName}</div>
                        <div className="text-xs text-muted">{m.description}</div>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-muted">Connection testing is not available in this dashboard.</p>
                <Button asChild className="self-start"><a href={CLASSIC_PORTAL_URL} target="_blank" rel="noreferrer">Manage provider in classic portal <ExternalLink /></a></Button>
              </>
            ) : tab === "limits" ? (
              <dl className="grid grid-cols-[150px_1fr] gap-y-2 text-sm">
                <dt className="text-muted">Allowance</dt><dd className="tabular-nums">{provider.allowancePct == null ? "Not reported" : `${provider.allowancePct}% of each limit per person`}</dd>
                <dt className="text-muted">Limits</dt><dd>{provider.ruleCount == null ? "Not reported" : provider.ruleCount ? `${provider.ruleCount} active` : "None"}</dd>
                <dt className="text-muted">Hold</dt><dd>{holdRelease(provider) ? `On hold ${holdRelease(provider)}` : "None"}</dd>
                <dd className="col-span-2 mt-2 text-xs text-muted">Raising limits, allowances and releasing holds is not ported yet: <ClassicLink>use the classic portal</ClassicLink>.</dd>
              </dl>
            ) : (
              <div>
                <h3 className="text-base font-semibold">All-provider usage</h3>
                <p className="mt-1 text-sm text-muted">This is the aggregate returned by the usage API, not a breakdown for <span className="font-mono">{provider.name}</span>.</p>
                {usage?.daily?.length ? (
                  <figure className="mt-4" aria-labelledby={chartId}>
                  <figcaption id={chartId} className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-semibold tabular-nums">{tokens(usage.daily.reduce((sum, d) => sum + (Number(d.total) || 0), 0))} tokens</span>
                    <span className="text-xs text-muted">{usage.daily[0].day} – {usage.daily[usage.daily.length - 1].day}</span>
                  </figcaption>
                  <p className="mb-1 text-xs tabular-nums text-faint">Daily peak: {tokens(max)} tokens</p>
                  <svg viewBox={`0 0 ${usage.daily.length * 20} 100`} className="h-32 w-full" role="img" aria-label={`Daily token use across all providers, ${usage.daily.length} reported days. Values are in the table below.`}>
                    {usage.daily.map((d, i) => {
                      const h = Math.max(0, ((Number(d.total) || 0) / Math.max(1, max)) * 92);
                      return <rect key={d.day} x={i * 20 + 3} y={100 - h} width={14} height={h} rx={2} className="fill-accent/70"><title>{`${d.day}: ${tokens(Number(d.total))}`}</title></rect>;
                    })}
                  </svg>
                  <div className="flex justify-between border-t border-line pt-1 text-xs text-muted"><span>{usage.daily[0].day}</span><span>{usage.daily[usage.daily.length - 1].day}</span></div>
                  <details className="mt-4 text-sm">
                    <summary className="min-h-6 cursor-pointer py-1 text-muted hover:text-fg pointer-coarse:min-h-11">View daily values</summary>
                    <table className="mt-2 w-full text-sm"><caption className="sr-only">Daily tokens across all providers</caption><thead><tr className="border-b border-line text-left text-xs text-muted"><th scope="col" className="py-2 font-medium">Day</th><th scope="col" className="py-2 text-right font-medium">Tokens</th></tr></thead><tbody>{usage.daily.map((d) => <tr key={d.day} className="border-b border-line-subtle"><th scope="row" className="py-2 text-left font-normal text-muted">{d.day}</th><td className="py-2 text-right tabular-nums">{(Number(d.total) || 0).toLocaleString()}</td></tr>)}</tbody></table>
                  </details>
                  </figure>
                ) : <p className="mt-4 text-sm text-muted">Usage data was not returned for this period.</p>}
              </div>
            )}
          </DialogBody>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
