import * as React from "react";
import { useIntent } from "@/shell/intents";
import { getRouteApi } from "@tanstack/react-router";
import { KeyRound, Plus } from "lucide-react";
import { TopBar } from "@/shell/AppShell";
import { useProfile, useSessions, useUsage } from "@/data/source";
import { describeError } from "@/data/state";
import { PERIOD_LABEL, useProviderRows, useUsageGrid } from "@/data/ops/providers";
import type { Provider, UsageSummary } from "@/data/types";
import { EmptyState, Panel, SectionTitle } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { Segmented } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/misc";
import { AddProviderSheet } from "@/components/providers/add-provider";
import { DefaultsPanel } from "@/components/providers/defaults";
import { PausedPanel } from "@/components/providers/paused";
import { ProviderSheet, type SheetTab } from "@/components/providers/provider-sheet";
import { DefaultTags, KeyStatus, Meter, monthProjection } from "@/components/providers/shared";
import { LegacyKeyNotice } from "@/components/providers/legacy-key";
import { cn, tokens } from "@/lib/utils";

const route = getRouteApi("/providers");

/** Models & spend: the providers that supply models, what each may spend, and which model new work starts on. */
export function ProvidersPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const tab = search.tab === "defaults" ? "defaults" : "providers";
  const { data: providers, isLoading, isError, refetch } = useProviderRows();
  useUsageGrid();
  const { data: usage } = useUsage();
  const { data: profile } = useProfile();
  const { data: sessions } = useSessions();
  const isAdmin = Boolean(profile?.isAdmin);
  const selected = providers?.find((p) => p.name === search.provider);
  const [sheetTab, setSheetTab] = React.useState<SheetTab>("overview");
  const [add, setAdd] = React.useState<{ open: boolean; type?: string }>({ open: false });

  useIntent("add-provider", "/providers", () => setAdd({ open: true }));

  // Old links to the Copilot tab land in the add flow with GitHub Copilot chosen: it is a provider type like the rest.
  React.useEffect(() => {
    if (search.tab === "copilot") {
      setAdd({ open: true, type: "github" });
      navigate({ search: { tab: "providers" }, replace: true });
    }
  }, [search.tab, navigate]);

  // A provider the API calls usable can still be failing in sessions. Say so.
  const broken = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions || []) { const e = describeError(s.error); if (s.error && e.provider) set.add(e.provider); }
    return set;
  }, [sessions]);

  const openProvider = (name: string, t: SheetTab = "overview") => { setSheetTab(t); navigate({ search: (prev: any) => ({ ...prev, provider: name }) }); };
  const closeProvider = () => navigate({ search: (p: any) => ({ ...p, provider: undefined }) });

  return (
    <>
      <TopBar crumbs={[{ label: "Models & spend" }]} actions={<Button onClick={() => setAdd({ open: true })} aria-label="Add provider"><Plus /><span className="max-sm:sr-only">Add provider</span></Button>} />
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5 md:px-5">
        <Segmented label="Models and spend" value={tab} onChange={(t) => navigate({ search: { tab: t }, replace: true })} options={[{ value: "providers", label: "Providers" }, { value: "defaults", label: "Default models" }]} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] px-4 py-5 md:px-5">
          {tab === "providers" ? (
            <>
              <div className="mb-5">
                <h2 className="text-lg font-semibold">Models and spend</h2>
                <p className="mt-1 text-sm text-muted">Where your models come from, what each one may spend, and what is holding work up.</p>
              </div>
              {isError ? <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm text-failed"><span>Couldn't refresh providers. {providers ? "Showing what loaded last." : "Try again."}</span><Button size="sm" onClick={() => refetch()}>Try again</Button></div> : null}
              <LegacyKeyNotice isAdmin={isAdmin} />
              <PausedPanel isAdmin={isAdmin} onRaiseLimit={(name) => openProvider(name, "limits")} onOpenProvider={(name) => openProvider(name, "limits")} onAddProvider={() => setAdd({ open: true })} />
              <UsageStrip usage={usage} />
              <SectionTitle count={providers?.length}>Providers</SectionTitle>
              {isLoading ? <Skeleton className="h-40" /> : !providers?.length && !isError ? (
                <Panel>
                  <EmptyState icon={<KeyRound />} title="Connect your first provider" action={<Button variant="primary" onClick={() => setAdd({ open: true })}><Plus /> Add a provider</Button>}>
                    A provider is where models come from. Pick GitHub Copilot, OpenAI or Anthropic and paste a key; it takes under a minute. Or ask an administrator to share one with everyone.
                  </EmptyState>
                </Panel>
              ) : (
                <ProviderList providers={providers || []} broken={broken} selected={search.provider} onOpen={(n) => openProvider(n)} />
              )}
              <p className="mt-3 text-xs text-faint">Limits count tokens per day, week or month, not money. A hold pauses new turns until it is released.</p>
            </>
          ) : (
            <>
              <div className="mb-5">
                <h2 className="text-lg font-semibold">Default models</h2>
                <p className="mt-1 text-sm text-muted">Which model a new session starts on, and why. Changes apply at once; you can undo them.</p>
              </div>
              <DefaultsPanel />
            </>
          )}
        </div>
      </div>
      <ProviderSheet provider={selected} broken={selected ? broken.has(selected.name) : false} isAdmin={isAdmin} initialTab={sheetTab} onClose={closeProvider} />
      <AddProviderSheet open={add.open} initialType={add.type} onOpenChange={(open) => setAdd((s) => ({ ...s, open }))} onOpenProvider={(name) => openProvider(name, "limits")} />
    </>
  );
}

function ProviderList({ providers, broken, selected, onOpen }: { providers: Provider[]; broken: Set<string>; selected?: string; onOpen: (name: string) => void }) {
  return (
    <Panel>
      <table className="w-full text-sm max-sm:hidden">
        <thead>
          <tr className="border-b border-line text-left text-xs text-faint">
            <th scope="col" className="px-3 py-2 font-medium">Provider</th>
            <th scope="col" className="px-3 py-2 font-medium">Status</th>
            <th scope="col" className="px-3 py-2 font-medium">This month</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Per-person share</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((p) => (
            <tr key={p.name} className={cn("border-b border-line-subtle last:border-0 hover:bg-raised/60", selected === p.name && "bg-raised")}>
              <td className="px-3 py-2.5">
                <Button variant="link" className="justify-start text-sm font-medium text-fg" onClick={() => onOpen(p.name)}>{p.name}</Button>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">{p.class === "personal" ? (p.usableByMe === false ? `${p.ownerDisplayName || "Someone else"}'s` : "Yours") : "Shared"} · {p.typeId}<DefaultTags provider={p} /></div>
              </td>
              <td className="px-3 py-2.5"><KeyStatus provider={p} broken={broken.has(p.name)} /></td>
              <td className="w-64 px-3 py-2.5">
                {p.usage?.month ? <><Meter used={p.usage.month.used} limit={p.usage.month.limit} label={`${p.name} monthly limit`} />{monthProjection(p.usage.month.used, p.usage.month.limit) ? <p className="mt-1 text-xs text-waiting">{monthProjection(p.usage.month.used, p.usage.month.limit)}</p> : null}</> : <span className="text-xs text-faint">Not reported</span>}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted">{p.class === "shared" ? (p.allowancePct == null ? "—" : p.allowancePct >= 100 ? "No ceiling" : `${p.allowancePct}%`) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Phones: one tappable block per provider instead of a table that scrolls sideways. */}
      <ul className="sm:hidden">
        {providers.map((p) => (
          <li key={p.name} className="border-t border-line-subtle first:border-t-0">
            <button type="button" onClick={() => onOpen(p.name)} className="flex min-h-11 w-full flex-col gap-1.5 px-3 py-3 text-left">
              <span className="flex items-center gap-2"><span className="text-sm font-medium">{p.name}</span><span className="ml-auto"><KeyStatus provider={p} broken={broken.has(p.name)} /></span></span>
              <span className="text-xs text-muted">{p.class === "personal" ? (p.usableByMe === false ? `${p.ownerDisplayName || "Someone else"}'s` : "Yours") : "Shared"} · {p.typeId}</span>
              {p.usage?.month ? <Meter used={p.usage.month.used} limit={p.usage.month.limit} label={`${p.name} monthly limit`} /> : null}
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** One divided strip, not three hero tiles: the totals are context, the table is the content. */
function UsageStrip({ usage }: { usage?: UsageSummary | null }) {
  const w = usage?.windows;
  return (
    <dl className={cn(cardVariants({ clip: true, enter: true }), "mb-6 grid grid-cols-3 divide-x divide-line")}>
      {(["day", "week", "month"] as const).map((k) => (
        <div key={k} className="px-4 py-2.5">
          <dt className="text-xs text-muted">{PERIOD_LABEL[k]}</dt>
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-base font-semibold tabular-nums">{tokens(w?.[k]?.total)}</span>
            <span className="text-xs text-faint">{w?.[k] ? <>tokens<span className="max-sm:hidden"> · {w[k].turns} turns</span></> : "Not reported"}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
