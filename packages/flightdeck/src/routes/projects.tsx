import * as React from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowDownUp, Bot, Check, ChevronRight, ListChecks, MoreHorizontal, Pencil, Pin, PinOff, Plus, Search, SquarePen, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/shell/AppShell";
import { useUi } from "@/shell/ui-state";
import { useDismissedAttention, usePins } from "@/components/sidebar/prefs";
import { useAttention } from "@/components/sidebar/use-attention";
import { ProjectIcon } from "@/components/project-icon";
import { buildSidebarModel, DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME } from "@/data/session-tree";
import { useGroups, useProfile, useRefresh, useSessions, useSource } from "@/data/source";
import { sessionState, type StateKey } from "@/data/state";
import { buildProjectsPage, type PageSort } from "./projects-model";
import { DeleteProjectDialog, NewProjectDialog, RenameProjectDialog } from "@/components/project-dialogs";
import type { Session } from "@/data/types";
import { SessionColumnsHeader, SessionRow } from "@/components/session-row";
import { StateFacets } from "@/components/state-facets";
import { EmptyState, Panel } from "@/components/empty";
import { Button, DisclosureButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox, Chip, Skeleton } from "@/components/ui/misc";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, plural } from "@/lib/utils";
import { failedMutationIds } from "@/lib/session-access";
import { STATE_FILTERS } from "@/router";

const route = getRouteApi("/projects");

const STATE_LABEL: Record<(typeof STATE_FILTERS)[number], string> = {
  any: "Any state", attention: "Needs your attention", running: "Running", needs: "Needs you", waiting: "Waiting", scheduled: "Scheduled", failed: "Failed", idle: "Idle", closed: "Completed or cancelled",
};

type Sort = PageSort;

export function ProjectsPage() {
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
  const [newProject, setNewProject] = React.useState(false);
  const [renaming, setRenaming] = React.useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = React.useState<{ id: string; name: string; count: number } | null>(null);
  const { data: groups } = useGroups();
  const pins = usePins();
  const dismissed = useDismissedAttention();
  // Pinned is the person's own list (the same one the sidebar shows): there is no second, server-side flag.
  const isPinned = React.useCallback((s: Session) => pins.isPinned(s.sessionId), [pins]);
  const agentIds = React.useMemo(() => [...new Set((sessions || []).filter((s) => !s.isSystem).map((s) => s.agentId || "generic"))].sort(), [sessions]);
  const q = (search.q || "").trim().toLowerCase();
  const who = search.who || "all";
  const unknownOwners = (sessions || []).filter((s) => !s.isSystem && !s.owner).length;

  // The same derivation as the sidebar's Needs you: a question, a failure not dismissed, or a hold you can lift.
  const attentionIds = useAttention().ids;
  // Pinned projects come from the same model as the sidebar's, so the two lists cannot disagree.
  const projectModel = React.useMemo(
    () => buildSidebarModel({ sessions: sessions || [], groups: groups || [], pins: pins.order, pinnedProjects: pins.projects, dismissed: dismissed.keys, viewer: { isAdmin: Boolean(profile?.isAdmin) } }),
    [sessions, groups, pins.order, pins.projects, dismissed.keys, profile?.isAdmin],
  );
  const pinnedProjects = projectModel.pinnedProjects;
  /** Live sessions in each project, for the project filter. */
  const projectCounts = React.useMemo(() => new Map([...projectModel.projects.all, ...(projectModel.projects.fallback ? [projectModel.projects.fallback] : [])].map((p) => [p.group.id, p.trees.length] as const)), [projectModel]);
  const projectName = search.project ? search.project === DEFAULT_PROJECT_ID ? DEFAULT_PROJECT_NAME : (groups || []).find((g) => g.id === search.project)?.name ?? "this project" : null;

  const tree = React.useMemo(
    () => buildProjectsPage(sessions || [], groups || [], { who, state: search.state, project: search.project, agent: agentFilter, q, sort, attention: attentionIds, pins: pins.order }),
    [sessions, groups, who, search.state, search.project, attentionIds, agentFilter, q, sort, pins.order],
  );

  // Counts for the state row ignore the state filter itself, so each facet shows what choosing it would give. They use the
  // same matching as the list (a search that matches a project's name counts that project's sessions).
  const facetCounts = React.useMemo(() => {
    const counts: Partial<Record<StateKey, number>> = {};
    const all = buildProjectsPage(sessions || [], groups || [], { who, state: undefined, project: search.project, agent: agentFilter, q, sort, attention: attentionIds, pins: pins.order });
    for (const s of all.matches) { const k = sessionState(s).key; counts[k] = (counts[k] || 0) + 1; }
    return counts;
  }, [sessions, groups, who, search.project, agentFilter, q, sort, attentionIds, pins.order]);
  const facet: StateKey | null = search.state === "closed" ? "completed" : search.state && ["running", "needs", "waiting", "failed"].includes(search.state) ? (search.state as StateKey) : null;
  // Scheduled and Idle are reachable by link; they show as one removable chip instead of a facet.
  const extraState = search.state === "scheduled" || search.state === "idle" || search.state === "attention" ? search.state : null;
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
          pinned={isPinned(s)}
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
      <TopBar crumbs={[{ label: "Projects" }]} actions={<div className="hidden items-center gap-2 sm:flex"><Button variant="default" size="md" onClick={() => setNewProject(true)}><ProjectIcon /> New project</Button><Button variant="default" size="md" onClick={() => openNewSession()}><Plus /> New session</Button></div>} />
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 md:px-5">
        <div className="relative w-full sm:w-[280px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input value={search.q || ""} onChange={(e) => setSearch({ q: e.target.value || undefined })} placeholder="Find a project or session" className="pl-8" aria-label="Find a project or session" />
        </div>
        {/* On a phone the filters are one row that scrolls sideways instead of three rows that push the list away. */}
        <div className="fd-scroll-x flex min-w-0 items-center gap-2 max-sm:w-full sm:contents">
          <div className="flex items-center gap-1" role="group" aria-label="Whose sessions">
            {([["mine", "Mine"], ["shared", "Others"], ["all", "All"]] as const).map(([v, label]) => (
              <Chip key={v} active={who === v} onClick={() => setSearch({ who: v === "all" ? undefined : v })}>{label}</Chip>
            ))}
          </div>
          <Menu>
            <MenuTrigger asChild>
              <Chip active={Boolean(agentFilter)}><Bot className="size-3.5" aria-hidden /> {agentFilter || "Any agent"} <ChevronRight className="size-3 rotate-90" /></Chip>
            </MenuTrigger>
            <MenuContent align="start">
              <MenuLabel>Agent</MenuLabel>
              <MenuRadioGroup value={agentFilter ?? ""} onValueChange={(v) => setAgentFilter(v || null)}>
                <MenuRadioItem value="" icon={<Bot />}>Any agent</MenuRadioItem>
                {agentIds.map((a) => <MenuRadioItem key={a} value={a} icon={<Bot />}>{a}</MenuRadioItem>)}
              </MenuRadioGroup>
            </MenuContent>
          </Menu>
          {(groups || []).length ? (
            <Menu>
              <MenuTrigger asChild>
                <Chip active={Boolean(search.project)}><ProjectIcon className="size-3.5" /> <span className="max-w-40 truncate">{projectName || "Any project"}</span> <ChevronRight className="size-3 rotate-90" /></Chip>
              </MenuTrigger>
              <MenuContent align="start" className="max-h-80 overflow-y-auto">
                <MenuLabel>Project</MenuLabel>
                <MenuRadioGroup value={search.project ?? ""} onValueChange={(v) => setSearch({ project: v || undefined })}>
                  <MenuRadioItem value="" icon={<ProjectIcon open />}>Any project</MenuRadioItem>
                  {(groups || []).map((g) => (
                    <MenuRadioItem key={g.id} value={g.id} icon={<ProjectIcon />}>
                      <span className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate">{g.name}</span><span className="text-xs tabular-nums text-faint">{projectCounts.get(g.id) ?? 0}</span></span>
                    </MenuRadioItem>
                  ))}
                  <MenuSeparator />
                  <MenuRadioItem value={DEFAULT_PROJECT_ID} icon={<ProjectIcon />}>
                    <span className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate">{DEFAULT_PROJECT_NAME}</span><span className="text-xs tabular-nums text-faint">{projectCounts.get(DEFAULT_PROJECT_ID) ?? 0}</span></span>
                  </MenuRadioItem>
                </MenuRadioGroup>
              </MenuContent>
            </Menu>
          ) : null}
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
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2 md:px-5">
        {who !== "all" && unknownOwners ? <p className="w-full text-xs text-muted">Ownership is unavailable for {plural(unknownOwners, "session")}. <Button variant="link" size="sm" className="px-0 text-xs" onClick={() => void setSearch({ who: undefined })}>Show all sessions</Button> to include them.</p> : null}
        <StateFacets className="fd-scroll-x max-sm:w-full max-sm:flex-nowrap" counts={facetCounts} value={facet} onChange={(k) => setSearch({ state: k === null ? undefined : k === "completed" ? "closed" : k })} />
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
          ) : isError && !sessions ? null : tree.count === 0 && !tree.system.length && !tree.projects.length && !pinnedProjects.length && !tree.finishedHidden ? (
            <Panel>
              <EmptyState icon={<Search />} title={q || search.state || search.project || who !== "all" || agentFilter ? "No sessions match" : "No sessions yet"} action={q || search.state || search.project || who !== "all" || agentFilter ? <Button onClick={() => { setAgentFilter(null); void navigate({ search: {} as any }); }}>Clear filters</Button> : <Button variant="primary" onClick={() => openNewSession()}><Plus /> New session</Button>}>
                {q || search.state || search.project || who !== "all" || agentFilter ? "Try another word or clear the filters." : "Start one and it shows up here, with what it is doing and what it waits on."}
              </EmptyState>
            </Panel>
          ) : (
            <div className="flex flex-col gap-5">
              {tree.pinned.length || pinnedProjects.length ? (
                <Group title="Pinned" count={tree.pinned.length + pinnedProjects.length}>
                  {pinnedProjects.map((p) => (
                    <div key={p.group.id} className="group flex min-h-row items-center gap-3 border-t border-line-subtle px-3 first:border-t-0">
                      <Link to="/projects" search={{ project: p.group.id }} className="focus-inset flex min-h-row min-w-0 flex-1 items-center gap-3 py-2 hover:text-fg">
                        <ProjectIcon className="text-muted" label="Project" />
                        <span className="min-w-0 truncate text-sm font-medium text-fg">{p.group.name}</span>
                        {p.attention ? <span className="shrink-0 rounded-full bg-failed-tint px-1.5 text-xs tabular-nums text-failed">{p.attention}<span className="sr-only"> {p.attention === 1 ? "needs" : "need"} you</span></span> : null}
                        <span className="ml-auto shrink-0 text-xs tabular-nums text-faint">{plural(p.trees.length, "session")}</span>
                      </Link>
                      <Button variant="quiet" size="icon-sm" aria-pressed aria-label={`Unpin project ${p.group.name}`} onClick={() => pins.toggleProject(p.group.id)}><PinOff /></Button>
                    </div>
                  ))}
                  {tree.pinned.map((s) => renderRow(s))}
                </Group>
              ) : null}
              {tree.projects.map(({ group, rows }) => {
                const pinned = pins.isProjectPinned(group.id);
                return (
                  <Group
                    key={group.id}
                    project
                    title={group.name}
                    count={rows.length}
                    open={!collapsed.has(group.id)}
                    onToggle={() => setCollapsed((c) => { const n = new Set(c); n.has(group.id) ? n.delete(group.id) : n.add(group.id); return n; })}
                    actions={(
                      <>
                        <Tooltip content={`New session in ${group.name}`}>
                          <Button variant="quiet" size="icon-sm" aria-label={`New session in ${group.name}`} onClick={() => openNewSession({ group: group.id })}><SquarePen /></Button>
                        </Tooltip>
                        <Menu>
                          <MenuTrigger asChild><Button variant="quiet" size="icon-sm" aria-label={`Actions for project ${group.name}`}><MoreHorizontal /></Button></MenuTrigger>
                          <MenuContent align="end">
                            <MenuItem icon={pinned ? <PinOff /> : <Pin />} onSelect={() => pins.toggleProject(group.id)}>{pinned ? "Unpin project" : "Pin project"}</MenuItem>
                            <MenuItem icon={<Pencil />} onSelect={() => setRenaming({ id: group.id, name: group.name })}>Rename…</MenuItem>
                            <MenuSeparator />
                            <MenuItem danger icon={<Trash2 />} onSelect={() => setDeleting({ id: group.id, name: group.name, count: rows.length })}>Delete project…</MenuItem>
                          </MenuContent>
                        </Menu>
                      </>
                    )}
                  >
                    {rows.length ? rows.map((s) => renderRow(s)) : (
                      <p className="px-4 py-3 text-sm text-muted">No sessions here yet. <Button variant="link" size="sm" onClick={() => openNewSession({ group: group.id })}>Start one</Button></p>
                    )}
                  </Group>
                );
              })}
              {tree.rest.length ? (
                <Group
                  project
                  title={tree.pinned.length || tree.projects.length ? DEFAULT_PROJECT_NAME : undefined}
                  count={tree.rest.length}
                  open={!collapsed.has(DEFAULT_PROJECT_ID)}
                  onToggle={tree.pinned.length || tree.projects.length ? () => setCollapsed((c) => { const n = new Set(c); n.has(DEFAULT_PROJECT_ID) ? n.delete(DEFAULT_PROJECT_ID) : n.add(DEFAULT_PROJECT_ID); return n; }) : undefined}
                  actions={tree.pinned.length || tree.projects.length ? (
                    <Tooltip content="New session with no project">
                      <Button variant="quiet" size="icon-sm" aria-label="New session with no project" onClick={() => openNewSession()}><SquarePen /></Button>
                    </Tooltip>
                  ) : undefined}
                >
                  {tree.rest.map((s) => renderRow(s))}
                </Group>
              ) : null}
              {tree.finishedHidden > 0 ? (
                <p className="text-sm text-muted">
                  {plural(tree.finishedHidden, "completed or cancelled session")} {tree.finishedHidden === 1 ? "is" : "are"} not shown.{" "}
                  <Button variant="link" size="sm" onClick={() => setSearch({ state: "closed" })}>Show {tree.finishedHidden === 1 ? "it" : "them"}</Button>
                </p>
              ) : null}
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
      <NewProjectDialog open={newProject} onOpenChange={setNewProject} existing={(groups || []).map((g) => g.name)} />
      <RenameProjectDialog project={renaming} onOpenChange={(o) => !o && setRenaming(null)} existing={(groups || []).map((g) => g.name)} />
      <DeleteProjectDialog project={deleting} sessionCount={deleting?.count ?? 0} onOpenChange={(o) => !o && setDeleting(null)} onDeleted={(id) => { if (pins.isProjectPinned(id)) pins.toggleProject(id); }} />
      {selecting && selected.size ? <BulkBar ids={[...selected]} onDone={(remaining = []) => { setSelected(new Set(remaining)); if (!remaining.length) setSelecting(false); }} /> : null}
    </>
  );
}

function Group({ title, count, children, open = true, onToggle, project = false, actions }: { title?: string; count?: number; children: React.ReactNode; open?: boolean; onToggle?: () => void; project?: boolean; actions?: React.ReactNode }) {
  return (
    <section>
      {title ? (
        onToggle ? (
          <div className="mb-2 flex items-center gap-1">
            <h2 className="min-w-0">
              <DisclosureButton aria-expanded={open} onClick={onToggle} className="rounded-chip text-sm font-semibold text-muted">
                <ChevronRight className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")} aria-hidden /> {project ? <ProjectIcon open={open} /> : null}<span className="truncate">{title}</span> <span className="font-normal tabular-nums text-faint">{count}</span>
              </DisclosureButton>
            </h2>
            {actions ? <div className="flex items-center">{actions}</div> : null}
          </div>
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
