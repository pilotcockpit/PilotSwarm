import * as React from "react";
import { getRouteApi } from "@tanstack/react-router";
import { ArrowDownUp, Check, ChevronRight, ListChecks, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/shell/AppShell";
import { useUi } from "@/shell/ui-state";
import { useGroups, useProfile, useRefresh, useSessions, useSource } from "@/data/source";
import { sessionState, type StateKey } from "@/data/state";
import type { Session } from "@/data/types";
import { SessionColumnsHeader, SessionRow } from "@/components/session-row";
import { StateFacets } from "@/components/state-facets";
import { EmptyState, Panel } from "@/components/empty";
import { Button, DisclosureButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox, Chip, Skeleton } from "@/components/ui/misc";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { cn, plural } from "@/lib/utils";
import { failedMutationIds, matchesSessionOwner } from "@/lib/session-access";
import { STATE_FILTERS } from "@/router";

const route = getRouteApi("/sessions");

const STATE_LABEL: Record<(typeof STATE_FILTERS)[number], string> = {
  any: "Any state", running: "Running", needs: "Needs you", waiting: "Waiting", scheduled: "Scheduled", failed: "Failed", idle: "Idle", closed: "Completed or cancelled",
};

type Sort = "activity" | "created" | "title";

function matchesState(s: Session, f: string | undefined) {
  if (!f || f === "any") return true;
  const st = sessionState(s);
  if (f === "scheduled") return st.waitKind === "schedule";
  if (f === "closed") return st.key === "completed" || st.key === "cancelled";
  return st.key === f;
}

export function SessionsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { data: sessions, isLoading, isError, error, refetch, isFetching } = useSessions();
  const { data: profile } = useProfile();
  const { openNewSession } = useUi();
  const [sort, setSort] = React.useState<Sort>("activity");
  const [selecting, setSelecting] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [systemOpen, setSystemOpen] = React.useState(false);
  const [agentFilter, setAgentFilter] = React.useState<string | null>(null);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const { data: groups } = useGroups();
  const agentIds = React.useMemo(() => [...new Set((sessions || []).filter((s) => !s.isSystem).map((s) => s.agentId || "generic"))].sort(), [sessions]);
  const q = (search.q || "").trim().toLowerCase();
  const who = search.who || "all";
  const unknownOwners = (sessions || []).filter((s) => !s.isSystem && !s.owner).length;

  const tree = React.useMemo(() => {
    const all = sessions || [];
    const filtered = all.filter((s) => {
      if (!matchesSessionOwner(s, who)) return false;
      if (!matchesState(s, search.state)) return false;
      if (agentFilter && (s.agentId || "generic") !== agentFilter) return false;
      if (q && !`${s.title} ${s.agentId} ${s.sessionId}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const ids = new Set(filtered.map((s) => s.sessionId));
    const childrenOf = new Map<string, Session[]>();
    for (const s of all) if (s.parentSessionId) childrenOf.set(s.parentSessionId, [...(childrenOf.get(s.parentSessionId) || []), s]);
    const cmp = (a: Session, b: Session) =>
      sort === "title" ? String(a.title).localeCompare(String(b.title)) : sort === "created" ? (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0) : (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0);
    // A child shows under its parent when the parent is listed; otherwise at top level so filters never hide it.
    const roots = filtered.filter((s) => !s.parentSessionId || !ids.has(s.parentSessionId)).sort(cmp);
    const regular = roots.filter((s) => !s.isSystem);
    const groupOf = (s: Session) => String(s.groupId ?? (s as any).viewerGroupId ?? "") || null;
    const grouped = (groups || []).map((g) => ({ group: g, rows: regular.filter((s) => !s.pinned && groupOf(s) === g.id) })).filter((g) => g.rows.length);
    const known = new Set((groups || []).map((g) => g.id));
    return {
      pinned: regular.filter((s) => s.pinned),
      grouped,
      rest: regular.filter((s) => !s.pinned && !(groupOf(s) && known.has(groupOf(s)!))),
      system: roots.filter((s) => s.isSystem),
      childrenOf: (id: string) => (childrenOf.get(id) || []).filter((c) => ids.has(c.sessionId)).sort(cmp),
      count: filtered.filter((s) => !s.isSystem).length,
    };
  }, [sessions, groups, who, search.state, agentFilter, q, sort]);

  // Counts for the state row ignore the state filter itself, so each facet shows what choosing it would give.
  const facetCounts = React.useMemo(() => {
    const counts: Partial<Record<StateKey, number>> = {};
    for (const s of sessions || []) {
      if (s.isSystem) continue;
      if (!matchesSessionOwner(s, who)) continue;
      if (agentFilter && (s.agentId || "generic") !== agentFilter) continue;
      if (q && !`${s.title} ${s.agentId} ${s.sessionId}`.toLowerCase().includes(q)) continue;
      const k = sessionState(s).key;
      counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
  }, [sessions, who, agentFilter, q]);
  const facet: StateKey | null = search.state === "closed" ? "completed" : search.state && ["running", "needs", "waiting", "failed"].includes(search.state) ? (search.state as StateKey) : null;
  // Scheduled and Idle are reachable by link; they show as one removable chip instead of a facet.
  const extraState = search.state === "scheduled" || search.state === "idle" ? search.state : null;
  const listRef = React.useRef<HTMLDivElement>(null);
  const onListKey = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (!t.matches("a[data-session-row]") || e.metaKey || e.ctrlKey || e.altKey) return;
    const move = e.key === "ArrowDown" || e.key === "j" ? 1 : e.key === "ArrowUp" || e.key === "k" ? -1 : 0;
    const edge = e.key === "Home" ? 0 : e.key === "End" ? -1 : null;
    if (!move && edge == null) return;
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>("a[data-session-row]") || [])];
    const i = rows.indexOf(t);
    const next = edge != null ? (edge === 0 ? rows[0] : rows[rows.length - 1]) : rows[Math.min(rows.length - 1, Math.max(0, i + move))];
    if (next) { e.preventDefault(); next.focus(); next.scrollIntoView({ block: "nearest" }); }
  };

  const setSearch = (patch: Record<string, unknown>) => navigate({ search: (prev: any) => ({ ...prev, ...patch }), replace: true });
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const renderRow = (s: Session, depth = 0): React.ReactNode => {
    const kids = tree.childrenOf(s.sessionId);
    return (
      <React.Fragment key={s.sessionId}>
        <SessionRow
          session={s}
          columns
          depth={depth}
          childCount={depth === 0 ? kids.length : 0}
          leading={selecting ? (
            <label className="flex min-h-11 min-w-11 cursor-default items-center justify-center">
              <Checkbox checked={selected.has(s.sessionId)} onCheckedChange={() => toggle(s.sessionId)} aria-label={`Select ${s.title || "Untitled session"}`} />
            </label>
          ) : undefined}
        />
        {kids.map((k) => renderRow(k, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <>
      <TopBar crumbs={[{ label: "Sessions" }]} actions={<Button variant="default" size="md" className="hidden sm:inline-flex" onClick={() => openNewSession()}><Plus /> New session</Button>} />
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 md:px-5">
        <div className="relative w-full sm:w-[280px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input value={search.q || ""} onChange={(e) => setSearch({ q: e.target.value || undefined })} placeholder="Find a session" className="pl-8" aria-label="Find a session" />
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Whose sessions">
          {([["mine", "Mine"], ["shared", "Others"], ["all", "All"]] as const).map(([v, label]) => (
            <Chip key={v} active={who === v} onClick={() => setSearch({ who: v === "all" ? undefined : v })}>{label}</Chip>
          ))}
        </div>
        <Menu>
          <MenuTrigger asChild>
            <Chip active={Boolean(agentFilter)}>{agentFilter || "Any agent"} <ChevronRight className="size-3 rotate-90" /></Chip>
          </MenuTrigger>
          <MenuContent align="start">
            <MenuLabel>Agent</MenuLabel>
            <MenuItem icon={!agentFilter ? <Check /> : <span className="size-4" />} onSelect={() => setAgentFilter(null)}>Any agent</MenuItem>
            {agentIds.map((a) => (
              <MenuItem key={a} icon={agentFilter === a ? <Check /> : <span className="size-4" />} onSelect={() => setAgentFilter(a)}>{a}</MenuItem>
            ))}
          </MenuContent>
        </Menu>
        <div className="ml-auto flex items-center gap-1">
          <Menu>
            <MenuTrigger asChild>
              <Button variant="quiet" size="sm"><ArrowDownUp /> {sort === "activity" ? "Recent activity" : sort === "created" ? "Newest first" : "Title"}</Button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>Sort by</MenuLabel>
              {([["activity", "Recent activity"], ["created", "Newest first"], ["title", "Title"]] as const).map(([v, l]) => (
                <MenuItem key={v} icon={sort === v ? <Check /> : <span className="size-4" />} onSelect={() => setSort(v)}>{l}</MenuItem>
              ))}
            </MenuContent>
          </Menu>
          <Button variant={selecting ? "default" : "quiet"} size="sm" aria-pressed={selecting} onClick={() => { setSelecting((v) => !v); setSelected(new Set()); }}>
            <ListChecks /> {selecting ? "Done" : "Select"}
          </Button>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2 md:px-5">
        {who !== "all" && unknownOwners ? <p className="w-full text-xs text-muted">Ownership is unavailable for {plural(unknownOwners, "session")}. <Button variant="link" size="sm" className="px-0 text-xs" onClick={() => void setSearch({ who: undefined })}>Show all sessions</Button> to include them.</p> : null}
        <StateFacets counts={facetCounts} value={facet} onChange={(k) => setSearch({ state: k === null ? undefined : k === "completed" ? "closed" : k })} />
        {extraState ? <Chip active onClick={() => setSearch({ state: undefined })} aria-label={`Clear ${STATE_LABEL[extraState]} filter`}>{STATE_LABEL[extraState]} <X className="size-3" aria-hidden /></Chip> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" ref={listRef} onKeyDown={onListKey}>
        {isLoading || (tree.count === 0 && !tree.system.length) ? null : (
          <div className="sticky top-0 z-(--z-sticky) bg-bg"><div className="mx-auto max-w-295 px-4 md:px-5"><SessionColumnsHeader /></div></div>
        )}
        <div className="mx-auto max-w-295 px-4 py-4 md:px-5">
          {isError ? (
            <Panel className="mb-4">
              <div role="alert" className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{sessions ? "Couldn't refresh sessions" : "Couldn't load sessions"}</p>
                  <p className="mt-1 text-sm text-muted">{sessions ? "Showing the last available sessions. " : ""}{error instanceof Error ? error.message : "Check your connection and try again."}</p>
                </div>
                <Button size="sm" disabled={isFetching} onClick={() => void refetch()}>{isFetching ? "Retrying…" : "Try again"}</Button>
              </div>
            </Panel>
          ) : null}
          {isLoading ? (
            <div className="flex flex-col gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[46px]" />)}</div>
          ) : isError && !sessions ? null : tree.count === 0 && !tree.system.length ? (
            <Panel>
              <EmptyState icon={<Search />} title={q || search.state || who !== "all" || agentFilter ? "No sessions match" : "No sessions yet"} action={q || search.state || who !== "all" || agentFilter ? <Button onClick={() => { setAgentFilter(null); void navigate({ search: {} as any }); }}>Clear filters</Button> : <Button variant="primary" onClick={() => openNewSession()}><Plus /> New session</Button>}>
                {q || search.state || who !== "all" || agentFilter ? "Try another word or clear the filters." : "Start one and it shows up here, with what it is doing and what it waits on."}
              </EmptyState>
            </Panel>
          ) : (
            <div className="flex flex-col gap-5">
              {tree.pinned.length ? <Group title="Pinned" count={tree.pinned.length}>{tree.pinned.map((s) => renderRow(s))}</Group> : null}
              {tree.grouped.map(({ group, rows }) => (
                <Group key={group.id} title={group.name} count={rows.length} open={!collapsed.has(group.id)} onToggle={() => setCollapsed((c) => { const n = new Set(c); n.has(group.id) ? n.delete(group.id) : n.add(group.id); return n; })}>
                  {rows.map((s) => renderRow(s))}
                </Group>
              ))}
              {tree.rest.length ? <Group title={tree.pinned.length || tree.grouped.length ? "Ungrouped" : undefined} count={tree.rest.length}>{tree.rest.map((s) => renderRow(s))}</Group> : null}
              {profile?.isAdmin && tree.system.length ? (
                <section>
                  <button type="button" aria-expanded={systemOpen} onClick={() => setSystemOpen((v) => !v)} className="mb-2 flex min-h-6 items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg pointer-coarse:min-h-11">
                    <ChevronRight className={cn("size-4 transition-transform", systemOpen && "rotate-90")} /> System <span className="font-normal tabular-nums text-faint">{tree.system.length}</span>
                  </button>
                  {systemOpen ? <Panel>{tree.system.map((s) => renderRow(s))}</Panel> : null}
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {selecting && selected.size ? <BulkBar ids={[...selected]} onDone={(remaining = []) => { setSelected(new Set(remaining)); if (!remaining.length) setSelecting(false); }} /> : null}
    </>
  );
}

function Group({ title, count, children, open = true, onToggle }: { title?: string; count?: number; children: React.ReactNode; open?: boolean; onToggle?: () => void }) {
  return (
    <section>
      {title ? (
        onToggle ? (
          <h2 className="mb-2">
            <DisclosureButton aria-expanded={open} onClick={onToggle} className="rounded-chip text-sm font-semibold text-muted">
              <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} aria-hidden /> {title} <span className="font-normal tabular-nums text-faint">{count}</span>
            </DisclosureButton>
          </h2>
        ) : <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted">{title} {count != null ? <span className="font-normal tabular-nums text-faint">{count}</span> : null}</h2>
      ) : null}
      {open ? <Panel>{children}</Panel> : null}
    </section>
  );
}

function BulkBar({ ids, onDone }: { ids: string[]; onDone: (remaining?: string[]) => void }) {
  const { source } = useSource();
  const refresh = useRefresh();
  const [confirm, setConfirm] = React.useState<null | "complete" | "cancel" | "delete">(null);
  const [busy, setBusy] = React.useState(false);
  const inFlight = React.useRef(false);
  const act = async (kind: "complete" | "cancel" | "delete") => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const fn = kind === "complete" ? source.completeSession : kind === "cancel" ? source.cancelSession : source.deleteSession;
    const results = await Promise.allSettled(ids.map((id) => Promise.resolve().then(() => fn.call(source, id))));
    const failed = results.filter((r) => r.status === "rejected").length;
    refresh();
    setConfirm(null);
    onDone(failedMutationIds(ids, results));
    inFlight.current = false;
    setBusy(false);
    const verb = kind === "complete" ? "Completed" : kind === "cancel" ? "Cancelled" : "Deleted";
    failed ? toast.error(`${verb} ${ids.length - failed} of ${ids.length}`, { description: "Unchanged sessions remain selected. Review their access and try again." }) : toast.success(`${verb} ${plural(ids.length, "session")}`);
  };
  return (
    <>
      <div role="toolbar" aria-label="Selected sessions" className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-line bg-overlay px-4 py-2.5 shadow-pop md:px-5">
        <span className="text-sm font-medium">{plural(ids.length, "session")} selected</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => setConfirm("complete")}>Complete</Button>
          <Button size="sm" disabled={busy} onClick={() => setConfirm("cancel")}>Cancel sessions</Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => setConfirm("delete")}>Delete</Button>
          <Button size="icon-sm" variant="quiet" aria-label="Clear selection" disabled={busy} onClick={() => onDone()}><X /></Button>
        </div>
      </div>
      <Dialog open={Boolean(confirm)} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        {confirm ? (
          <DialogContent title={`${confirm === "complete" ? "Complete" : confirm === "cancel" ? "Cancel" : "Delete"} ${plural(ids.length, "session")}?`}>
            <DialogBody>
              <p className="text-sm text-muted">
                {confirm === "complete" && "They close as done. Their transcripts, canvases and outputs stay."}
                {confirm === "cancel" && "They close as abandoned and stop any running turn. Their sub-agents are cancelled too."}
                {confirm === "delete" && "They disappear from every list and stop, with their sub-agents. Session facts are removed; a deleted summary is kept until an admin prunes it."}
              </p>
            </DialogBody>
            <DialogFooter>
              <Button disabled={busy} onClick={() => setConfirm(null)}>Keep them</Button>
              <Button disabled={busy} variant={confirm === "delete" ? "danger" : "primary"} onClick={() => act(confirm)}>
                {busy ? "Updating sessions…" : confirm === "complete" ? "Complete" : confirm === "cancel" ? "Cancel sessions" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
