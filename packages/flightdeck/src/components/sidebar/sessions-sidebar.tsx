import * as React from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ListChecks, MoreHorizontal, Pin, PinOff, RefreshCw, SquarePen } from "lucide-react";
import { useGroups, useProfile, useSessions } from "@/data/source";
import type { Session } from "@/data/types";
import { buildSidebarModel, DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME, PROJECT_PREVIEW, type ProjectRow, inSettledOrder, RECENT_PAGE, settleOrder, type Attention, type Settled } from "@/data/session-tree";
import { focusAfterChange } from "@/data/session-tree";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/misc";
import { ShareSheet } from "@/components/session/share-sheet";
import { MoveToGroupDialog } from "@/components/session/move-to-group";
import { SessionCloseDialog, SessionRenameDialog, canModify } from "@/components/session/session-actions";
import { RestartDialog } from "@/components/admin/system-sessions-panel";
import { useUi } from "@/shell/ui-state";
import { cn, plural } from "@/lib/utils";
import { useDismissedAttention, usePins, useSidebarPrefs } from "./prefs";
import { useDismissAttention } from "./use-attention";
import { NeedsCountStatus } from "./needs-status";
import { ProjectIcon } from "@/components/project-icon";
import { NewProjectDialog } from "@/components/project-dialogs";
import { SectionHeading } from "./section-heading";
import { SidebarRow, type RowDialog } from "./sidebar-row";

/** The id of the session being viewed, from the address. */
export function useActiveSessionId(): string | null {
  return useRouterState({ select: (s) => (s.location.pathname.match(/^\/s\/([^/]+)/)?.[1] ?? null) });
}

interface Entry { key: string; session: Session; attention?: Attention }

/** Where focus goes when a row's key is gone: the same session under another key, else the neighbouring row. */
function nextFocus(prev: readonly string[], next: readonly string[], key: string): string | null {
  const sessionOf = (k: string) => k.slice(k.lastIndexOf("/") + 1);
  if (next.includes(key)) return key;
  const moved = next.find((k) => sessionOf(k) === sessionOf(key));
  return moved ?? focusAfterChange(prev, next, key);
}

/**
 * The sessions, in the sidebar: what needs you, your pins, your projects, then what you were doing. It is a
 * place to jump from, not the whole library (that is Sessions): five things at most ask for you, a project
 * opens to five, and finished work leaves. One tab stop for the list (arrow keys move, Enter opens,
 * p pins, m opens the menu, Delete asks to delete); headings are ordinary buttons.
 */
export function SessionsSidebar({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const { data: sessions, isLoading, isError, refetch } = useSessions();
  const { data: groups } = useGroups();
  const { data: profile, isPending: profilePending } = useProfile();
  const pins = usePins();
  const dismissed = useDismissedAttention();
  const prefs = useSidebarPrefs();
  const { openNewSession } = useUi();
  const active = useActiveSessionId();
  const [recentShown, setRecentShown] = React.useState(RECENT_PAGE);
  const [focusKey, setFocusKey] = React.useState<string | null>(null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<RowDialog>(null);
  const [newProjectOpen, setNewProjectOpen] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const isAdmin = Boolean(profile?.isAdmin);

  const model = React.useMemo(
    () => buildSidebarModel({ sessions: sessions || [], groups: groups || [], pins: pins.order, pinnedProjects: pins.projects, keep: prefs.openProject?.where === "projects" ? [prefs.openProject.id] : [], dismissed: dismissed.keys, viewer: { isAdmin } }),
    [sessions, groups, pins.order, pins.projects, prefs.openProject, dismissed.keys, isAdmin],
  );

  // Recent keeps the order it was drawn in. A session that updates stays where it is (its state still updates in
  // place); the person chooses when to re-sort.
  const settled = React.useRef<Settled | null>(null);
  const resort = React.useRef(false);
  const [resortTick, setResortTick] = React.useState(0);
  const recent = React.useMemo(() => {
    const force = resort.current;
    resort.current = false;
    const next = settleOrder(settled.current, model.recent, force);
    settled.current = next.settled;
    return { rows: inSettledOrder(next.settled, model.recent), pending: next.pending };
  }, [model.recent, resortTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // The session being viewed stays in the list even after it finishes or leaves the top, so the highlight has somewhere to be.
  const activeRoot = active ? model.index.rootOf(active) : null;
  const shownRecent = recent.rows.slice(0, recentShown);
  const hiddenRecent = recent.rows.length - shownRecent.length;

  const entries = React.useMemo(() => {
    const seen = new Set<string>();
    const out: { needs: Entry[]; pinned: Entry[]; project: Entry[]; loose: Entry[]; recent: Entry[] } = { needs: [], pinned: [], project: [], loose: [], recent: [] };
    for (const a of model.needs.shown) { const s = model.index.byId.get(a.sessionId); if (s) { out.needs.push({ key: `needs/${s.sessionId}`, session: s, attention: a }); seen.add(s.sessionId); } }
    for (const s of model.pinned) { out.pinned.push({ key: `pin/${s.sessionId}`, session: s }); seen.add(s.sessionId); }
    const where = prefs.openProject?.where;
    const visible = where === "pinned" ? model.pinnedProjects : model.projects.shown;
    const open = visible.find((f) => f.group.id === prefs.openProject?.id);
    // The session being viewed always shows in its open project, even when it is not among the first few.
    const viewed = activeRoot ? open?.trees.find((s) => s.sessionId === activeRoot) : undefined;
    const preview = open ? open.trees.slice(0, PROJECT_PREVIEW) : [];
    if (viewed && !preview.includes(viewed)) preview[PROJECT_PREVIEW - 1] = viewed;
    for (const s of preview) out.project.push({ key: `project/${s.sessionId}`, session: s });
    // Sessions outside any project are listed in their own section, the same way: five, and the one being viewed always among them.
    const loose = model.projects.fallback?.trees ?? [];
    const looseView = activeRoot ? loose.find((s) => s.sessionId === activeRoot) : undefined;
    const looseShown = loose.slice(0, PROJECT_PREVIEW);
    if (looseView && !looseShown.includes(looseView)) looseShown[PROJECT_PREVIEW - 1] = looseView;
    for (const s of looseShown) out.loose.push({ key: `loose/${s.sessionId}`, session: s });
    for (const s of shownRecent) { out.recent.push({ key: `recent/${s.sessionId}`, session: s }); seen.add(s.sessionId); }
    const current = activeRoot ? model.index.byId.get(activeRoot) : undefined;
    if (current && !current.isSystem && !seen.has(current.sessionId)) out.recent.unshift({ key: `recent/${current.sessionId}`, session: current });
    return out;
  }, [model, prefs.openProject, shownRecent, activeRoot]);

  // The keyboard walks the rows in the order they are drawn: a project open under Pinned sits above the pinned sessions.
  const openWhere = prefs.openProject?.where;
  const orderedKeys = React.useMemo(() => [
    ...(prefs.collapsed.needs ? [] : entries.needs.map((e) => e.key)),
    ...(prefs.collapsed.pinned ? [] : [...(openWhere === "pinned" ? entries.project : []), ...entries.pinned].map((e) => e.key)),
    ...(prefs.collapsed.projects || openWhere === "pinned" ? [] : entries.project.map((e) => e.key)),
    ...(prefs.collapsed.noproject ? [] : entries.loose.map((e) => e.key)),
    ...(prefs.collapsed.recent ? [] : entries.recent.map((e) => e.key)),
  ], [entries, prefs.collapsed, openWhere]);
  // Opening a session from anywhere (a Recent pointer, Needs you, a link) opens the project it is filed in and selects it
  // there. The project stays open for the person to close; it is only opened again when they go to a different session.
  const revealed = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!active || !activeRoot || !prefs.ready || !pins.settled || groups === undefined || revealed.current === active) return;
    const root = model.index.byId.get(activeRoot);
    if (!root) return; // not loaded yet
    revealed.current = active;
    const project = model.projectOf.get(activeRoot);
    // A project lists only live trees. A finished session, or any session when there are no projects, is not in one: it is
    // drawn where it is pinned, where it needs you, or among the Recents, and that is the section to open.
    const folder = project ? (project === DEFAULT_PROJECT_ID ? model.projects.fallback : [...model.projects.all, ...model.pinnedProjects].find((f) => f.group.id === project)) : undefined;
    if (!project || !folder?.trees.some((s) => s.sessionId === activeRoot)) {
      const section = model.needs.shown.some((a) => a.sessionId === activeRoot) ? "needs" : model.pinned.some((s) => s.sessionId === activeRoot) ? "pinned" : "recent";
      if (prefs.collapsed[section]) prefs.toggleSection(section);
      return;
    }
    // A session outside any project is in the No project section: make sure that is open.
    if (project === DEFAULT_PROJECT_ID) { if (prefs.collapsed.noproject) prefs.toggleSection("noproject"); return; }
    // Stay under Pinned when the project is pinned and Pinned is open; otherwise show it among the projects.
    const where = model.pinnedProjects.some((p) => p.group.id === project) && !prefs.collapsed.pinned ? "pinned" : "projects";
    if (prefs.openProject?.id !== project || prefs.openProject.where !== where) prefs.setOpenProject(project, where);
    if (where === "projects" && prefs.collapsed.projects) prefs.toggleSection("projects");
  });
  // The one row that is the current page: the one in its project when it is shown there, else the first place it appears.
  const currentKey = active ? orderedKeys.find((k) => (k.startsWith("project/") || k.startsWith("loose/")) && k.endsWith(`/${active}`)) ?? orderedKeys.find((k) => k.endsWith(`/${active}`)) ?? null : null;
  React.useEffect(() => { if (currentKey) listRef.current?.querySelector<HTMLElement>(`a[data-sidebar-row][data-row-key="${CSS.escape(currentKey)}"]`)?.scrollIntoView?.({ block: "nearest" }); }, [currentKey]);
  const tabbable = focusKey && orderedKeys.includes(focusKey) ? focusKey : orderedKeys.find((k) => k.endsWith(`/${active}`)) ?? orderedKeys[0] ?? null;
  const byId = model.index.byId;
  const empty = !isLoading && !isError && !model.total && !model.completed && !model.pinned.length && !model.needs.all.length;

  // The row that last held keyboard focus inside the list. A row that moves between sections (a pin, a state
  // change on a poll) is unmounted and mounted elsewhere, which drops focus to the page; when that happens,
  // focus goes to the same session in its new place, or to its neighbour if it is gone.
  const focusedRef = React.useRef<string | null>(null);
  const prevKeysRef = React.useRef<string[]>(orderedKeys);
  const rowEl = (key: string) => listRef.current?.querySelector<HTMLElement>(`a[data-sidebar-row][data-row-key="${CSS.escape(key)}"]`) ?? null;
  const focusRow = (key: string) => { focusedRef.current = key; setFocusKey(key); rowEl(key)?.focus(); };
  const onFocusRow = (key: string) => { focusedRef.current = key; setFocusKey(key); };
  React.useLayoutEffect(() => {
    const prev = prevKeysRef.current;
    prevKeysRef.current = orderedKeys;
    const key = focusedRef.current;
    if (!key || !listRef.current) return;
    const el = document.activeElement;
    if (listRef.current.contains(el)) return; // focus is still in the list
    if (el && el !== document.body) { if (!el.closest("[role='dialog'],[role='menu']")) focusedRef.current = null; return; } // someone else has it
    const target = nextFocus(prev, orderedKeys, key);
    if (!target) { focusedRef.current = null; return; }
    const row = rowEl(target);
    if (row) { focusedRef.current = target; setFocusKey(target); row.focus(); }
  });
  React.useEffect(() => {
    // Pointing elsewhere is a decision to leave the list: do not pull focus back later.
    const leave = (e: PointerEvent) => { if (!listRef.current?.contains(e.target as Node)) focusedRef.current = null; };
    document.addEventListener("pointerdown", leave, true);
    return () => document.removeEventListener("pointerdown", leave, true);
  }, []);
  /** Dialogs opened from a row give focus back to it, or to the row that took its place if it is gone by then. */
  const closeFocus = (key: string) => (e: Event) => {
    e.preventDefault();
    const target = nextFocus(prevKeysRef.current, orderedKeys, key);
    if (target) focusRow(target);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("a[data-sidebar-row]");
    if (!row || e.metaKey || e.ctrlKey || e.altKey) return;
    const key = row.dataset.rowKey!;
    const id = row.dataset.sessionId!;
    const i = orderedKeys.indexOf(key);
    if (e.key === "ArrowDown") { e.preventDefault(); if (orderedKeys[i + 1]) focusRow(orderedKeys[i + 1]); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (orderedKeys[i - 1]) focusRow(orderedKeys[i - 1]); }
    else if (e.key === "Home") { e.preventDefault(); if (orderedKeys[0]) focusRow(orderedKeys[0]); }
    else if (e.key === "End") { e.preventDefault(); if (orderedKeys.length) focusRow(orderedKeys[orderedKeys.length - 1]); }
    else if (e.key === "p") { e.preventDefault(); pins.toggle(id); }
    else if (e.key === "m" || e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) { e.preventDefault(); setMenuFor(key); }
    else if (e.key === "Delete") { const s = byId.get(id); if (s && canModify(s)) { e.preventDefault(); setDialog({ id: key, kind: "delete" }); } }
  };

  const dialogSession = dialog ? byId.get(dialog.id.slice(dialog.id.lastIndexOf("/") + 1)) : undefined;
  const childCount = dialogSession ? (sessions || []).filter((s) => s.parentSessionId === dialogSession.sessionId).length : 0;

  const dismiss = useDismissAttention();
  const renderRow = (e: Entry, typed = false) => (
    <SidebarRow
      key={e.key}
      rowKey={e.key}
      session={e.session}
      index={model.index}
      active={active === e.session.sessionId}
      current={currentKey === e.key}
      within={Boolean(active) && active !== e.session.sessionId && activeRoot === e.session.sessionId}
      tabbable={tabbable === e.key}
      pinned={pins.isPinned(e.session.sessionId)}
      attention={e.attention}
      isAdmin={isAdmin}
      onFocusRow={onFocusRow}
      onTogglePin={() => pins.toggle(e.session.sessionId)}
      onDismiss={e.attention?.dismissible ? () => dismiss(e.attention!) : undefined}
      menuOpen={menuFor === e.key}
      onMenuOpenChange={(o) => setMenuFor(o ? e.key : null)}
      onAction={(kind) => { setMenuFor(null); setDialog({ id: e.key, kind }); }}
      onNavigate={onNavigate}
      typed={typed}
    />
  );
  const navigate = useNavigate();
  const go = (to: "/projects", search?: Record<string, string>) => { onNavigate?.(); void navigate({ to, search: search as any }); };
  const projectRows = model.projects.all;
  const projectsAsk = projectRows.reduce((n, p) => n + p.attention, 0);
  const recentDot = recent.pending > 0 ? `${recent.pending} updated` : shownRecent.some((s) => s.unseenCanvas) ? "Canvas updated" : null;
  const pinnedAsk = model.pinnedProjects.reduce((n, p) => n + p.attention, 0);
  const pinnedDot = pinnedAsk ? `${plural(pinnedAsk, "session")} in pinned projects ${pinnedAsk === 1 ? "needs" : "need"} you` : model.pinned.some((s) => s.unseenCanvas) ? "Canvas updated" : null;
  const actionButton = "size-7 pointer-coarse:size-11";

  const renderProject = (f: ProjectRow, where: "pinned" | "projects") => {
    const open = prefs.openProject?.id === f.group.id && prefs.openProject.where === where;
    const pinned = pins.isProjectPinned(f.group.id);
    return (
      <li key={`${where}/${f.group.id}`} className="group/row relative">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => prefs.setOpenProject(open ? null : f.group.id, where)}
          className={cn("focus-inset flex min-h-8 w-full items-center gap-2 rounded-control px-2 text-left text-sm pointer-coarse:min-h-11 pointer-coarse:pr-22 transition-colors duration-(--duration-fast)", open ? "bg-raised/60 text-fg" : "text-muted hover:bg-raised/60 hover:text-fg")}
        >
          <ProjectIcon open={open} label="Project" />
          <span className="min-w-0 flex-1 truncate font-medium">{f.group.name}</span>
          {f.attention ? <span className="shrink-0 rounded-full bg-failed-tint px-1.5 text-xs tabular-nums text-failed" title={`${plural(f.attention, "session")} here ${f.attention === 1 ? "needs" : "need"} you`}>{f.attention}<span className="sr-only"> {f.attention === 1 ? "needs" : "need"} you</span></span> : null}
          <span className="shrink-0 text-xs tabular-nums text-faint" title="Live trees; finished work is under Completed">{f.trees.length}<span className="sr-only"> {f.trees.length === 1 ? "tree" : "trees"}</span></span>
        </button>
        <div className="absolute right-0.5 top-1 hidden items-center rounded-control bg-raised pl-0.5 group-hover/row:flex group-focus-within/row:flex pointer-coarse:flex pointer-coarse:bg-transparent">
          {/* A new session started here is filed in this project. */}
          <Tooltip content={`New session in ${f.group.name}`}>
            <Button variant="quiet" size="icon-sm" aria-label={`New session in ${f.group.name}`} onClick={() => { onNavigate?.(); openNewSession({ group: f.group.id }); }}><SquarePen /></Button>
          </Tooltip>
          <Tooltip content={pinned ? "Unpin project" : "Pin project"}>
            <Button variant="quiet" size="icon-sm" aria-pressed={pinned} aria-label={`${pinned ? "Unpin" : "Pin"} project ${f.group.name}`} onClick={() => pins.toggleProject(f.group.id)}>{pinned ? <PinOff /> : <Pin />}</Button>
          </Tooltip>
        </div>
        {open ? (
          <div className="ml-3 border-l border-line pl-1">
            {f.trees.length ? <ul className="flex flex-col gap-px">{entries.project.map((e) => renderRow(e))}</ul> : <p className="px-2 py-1 text-xs text-faint">No live sessions in this project.</p>}
            <div className="flex items-center gap-0.5">
              <Link to="/projects" search={{ project: f.group.id }} onClick={onNavigate} className="focus-inset flex min-h-8 min-w-0 flex-1 items-center gap-1 rounded-control px-2 text-xs text-accent hover:bg-raised/60 pointer-coarse:min-h-11">
                {f.trees.length > PROJECT_PREVIEW ? `All ${f.trees.length} in Projects` : "Open in Projects"} <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <nav aria-label="Sessions" className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <NeedsCountStatus count={model.needs.all.length} ready={!isLoading && sessions !== undefined && !profilePending && pins.settled} />
      <div ref={listRef} onKeyDown={onKeyDown} onBlur={(e) => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node) && !(e.relatedTarget as HTMLElement).closest?.("[role='dialog'],[role='menu']")) focusedRef.current = null; }} className="min-h-0 flex-1 overflow-y-auto px-1 pb-2" data-sessions-scroll>
        {/* Until the account's dismissals have loaded, Needs you is not known: showing the sections now would push them down when it appears. */}
        {isLoading || !pins.settled ? (
          <div className="flex flex-col gap-1.5 px-1.5 pt-1" aria-hidden>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6" />)}</div>
        ) : isError ? (
          <p className="px-2 py-3 text-sm text-muted">Couldn't load sessions. <Button variant="link" size="sm" onClick={() => void refetch()}>Try again</Button></p>
        ) : empty ? (
          <p className="px-2 py-3 text-sm text-muted">No sessions yet. <Button variant="link" size="sm" onClick={() => openNewSession()}>Start one</Button></p>
        ) : (
          <>
            {model.needs.all.length ? (
              <section aria-labelledby="sidebar-sec-needs" className="mt-1.5 first:mt-0">
                <SectionHeading
                  id="sidebar-sec-needs"
                  title="Needs you"
                  badge={{ count: model.needs.all.length, label: `${plural(model.needs.all.length, "session")} ${model.needs.all.length === 1 ? "needs" : "need"} you` }}
                  open={!prefs.collapsed.needs}
                  onToggle={() => prefs.toggleSection("needs")}
                />
                {prefs.collapsed.needs ? null : <ul className="flex flex-col gap-px">{entries.needs.map((e) => renderRow(e))}</ul>}
                {!prefs.collapsed.needs && model.needs.hidden > 0 ? (
                  <Link to="/projects" search={{ state: "attention" }} onClick={onNavigate} className="focus-inset mt-0.5 flex min-h-8 items-center gap-1 rounded-control px-2 text-xs text-accent hover:bg-raised/60 pointer-coarse:min-h-11">
                    {model.needs.hidden} more need you <ArrowRight className="size-3" aria-hidden />
                  </Link>
                ) : null}
              </section>
            ) : null}

            {model.pinned.length || model.pinnedProjects.length ? (
              <section aria-labelledby="sidebar-sec-pinned-h" className="mt-1.5 first:mt-0">
                <SectionHeading id="sidebar-sec-pinned-h" title="Pinned" open={!prefs.collapsed.pinned} onToggle={() => prefs.toggleSection("pinned")} dot={pinnedDot} />
                {prefs.collapsed.pinned ? null : <ul className="flex flex-col gap-px">{model.pinnedProjects.map((f) => renderProject(f, "pinned"))}{entries.pinned.map((e) => renderRow(e, true))}</ul>}
              </section>
            ) : null}

            {(
              <section aria-labelledby="sidebar-sec-projects-h" className="mt-1.5 first:mt-0">
                <SectionHeading
                  id="sidebar-sec-projects-h"
                  title="Projects"
                  to="/projects"
                  onNavigate={onNavigate}
                  open={!prefs.collapsed.projects}
                  onToggle={() => prefs.toggleSection("projects")}
                  dot={projectsAsk ? `${plural(projectsAsk, "session")} in projects ${projectsAsk === 1 ? "needs" : "need"} you` : null}
                  actions={(
                    <>
                      <Menu>
                        <MenuTrigger asChild><Button variant="quiet" size="icon-sm" className={actionButton} aria-label="Project actions"><MoreHorizontal /></Button></MenuTrigger>
                        <MenuContent align="start" className="w-55">
                          <MenuItem icon={<ProjectIcon />} onSelect={() => go("/projects")}>All projects</MenuItem>
                          <MenuItem icon={<ProjectIcon />} onSelect={() => go("/projects", { project: DEFAULT_PROJECT_ID })}>Sessions with no project</MenuItem>
                        </MenuContent>
                      </Menu>
                      <Button variant="quiet" size="icon-sm" className={actionButton} aria-label="New project" onClick={() => setNewProjectOpen(true)}><SquarePen /></Button>
                    </>
                  )}
                />
                {prefs.collapsed.projects ? null : !model.projects.all.length ? (
                  <p className="px-2 py-1 text-xs text-faint">Sort sessions your own way. <Button variant="link" size="sm" className="px-0 text-xs" onClick={() => setNewProjectOpen(true)}>Create a project</Button></p>
                ) : (
                  <>
                    <ul className="flex flex-col gap-px">{model.projects.shown.map((f) => renderProject(f, "projects"))}</ul>
                    {model.projects.hidden > 0 ? (
                      <Link to="/projects" onClick={onNavigate} className="focus-inset mt-0.5 flex min-h-8 items-center gap-1 rounded-control px-2 text-xs text-accent hover:bg-raised/60 pointer-coarse:min-h-11">
                        All {model.projects.all.length} projects <ArrowRight className="size-3" aria-hidden />
                      </Link>
                    ) : null}
                  </>
                )}
              </section>
            )}

            {model.projects.fallback && model.projects.fallback.trees.length ? (
              <section aria-labelledby="sidebar-sec-noproject-h" className="mt-1.5 first:mt-0">
                <SectionHeading
                  id="sidebar-sec-noproject-h"
                  title={DEFAULT_PROJECT_NAME}
                  to="/projects"
                  search={{ project: DEFAULT_PROJECT_ID }}
                  onNavigate={onNavigate}
                  open={!prefs.collapsed.noproject}
                  onToggle={() => prefs.toggleSection("noproject")}
                  dot={model.projects.fallback.attention ? `${plural(model.projects.fallback.attention, "session")} with no project ${model.projects.fallback.attention === 1 ? "needs" : "need"} you` : null}
                  actions={(
                    <Tooltip content="New session with no project">
                      <Button variant="quiet" size="icon-sm" className={actionButton} aria-label="New session with no project" onClick={() => { onNavigate?.(); openNewSession(); }}><SquarePen /></Button>
                    </Tooltip>
                  )}
                />
                {prefs.collapsed.noproject ? null : (
                  <>
                    <ul className="flex flex-col gap-px">{entries.loose.map((e) => renderRow(e))}</ul>
                    {model.projects.fallback.trees.length > PROJECT_PREVIEW ? (
                      <Link to="/projects" search={{ project: DEFAULT_PROJECT_ID }} onClick={onNavigate} className="focus-inset mt-0.5 flex min-h-8 items-center gap-1 rounded-control px-2 text-xs text-accent hover:bg-raised/60 pointer-coarse:min-h-11">
                        All {model.projects.fallback.trees.length} in Projects <ArrowRight className="size-3" aria-hidden />
                      </Link>
                    ) : null}
                  </>
                )}
              </section>
            ) : null}

            {entries.recent.length ? (
              <section aria-labelledby="sidebar-sec-recent-h" className="mt-1.5 first:mt-0">
                <SectionHeading
                  id="sidebar-sec-recent-h"
                  title="Recents"
                  open={!prefs.collapsed.recent}
                  onToggle={() => prefs.toggleSection("recent")}
                  dot={recentDot}
                  actions={(
                    <>
                      <Menu>
                        <MenuTrigger asChild><Button variant="quiet" size="icon-sm" className={actionButton} aria-label="Recents actions"><MoreHorizontal /></Button></MenuTrigger>
                        <MenuContent align="start" className="w-55">
                          <MenuItem icon={<RefreshCw />} disabled={recent.pending === 0} onSelect={() => { resort.current = true; setResortTick((x) => x + 1); }}>Refresh order</MenuItem>
                          <MenuItem icon={<CheckCircle2 />} onSelect={() => go("/projects", { state: "closed" })}>Completed sessions</MenuItem>
                          <MenuItem icon={<ListChecks />} onSelect={() => go("/projects")}>All sessions</MenuItem>
                        </MenuContent>
                      </Menu>
                    </>
                  )}
                />
                {prefs.collapsed.recent ? null : (
                  <>
                    <ul className="flex flex-col gap-px">{entries.recent.map((e) => renderRow(e))}</ul>
                    {recent.pending > 0 ? (
                      <button type="button" onClick={() => { resort.current = true; setResortTick((t) => t + 1); }} className="focus-inset mx-1.5 my-1 flex min-h-7 w-[calc(100%-0.75rem)] items-center justify-between gap-2 rounded-control bg-accent-tint px-2 text-xs text-accent pointer-coarse:min-h-11">
                        <span>{recent.pending} updated</span><span className="font-medium">Refresh order</span>
                      </button>
                    ) : null}
                    {hiddenRecent > 0 ? (
                      <Button variant="quiet" size="sm" className="mt-0.5 w-full justify-start px-2 text-faint pointer-coarse:min-h-11" onClick={() => setRecentShown((n) => n + RECENT_PAGE)}>Show {Math.min(RECENT_PAGE, hiddenRecent)} more</Button>
                    ) : null}
                  </>
                )}
              </section>
            ) : null}

            {model.completed > 0 ? (
              <Link to="/projects" search={{ state: "closed" }} onClick={onNavigate} className="focus-inset mt-2 flex min-h-8 items-center gap-1.5 rounded-control px-2 text-xs text-faint hover:bg-raised/60 hover:text-fg pointer-coarse:min-h-11">
                {model.completed} completed or cancelled <ArrowRight className="size-3" aria-hidden />
              </Link>
            ) : null}
          </>
        )}
      </div>

      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        existing={(groups || []).map((g) => g.name)}
        onCreated={(id) => { if (id) { prefs.setOpenProject(id, "projects"); if (prefs.collapsed.projects) prefs.toggleSection("projects"); } }}
      />
      {dialog && dialogSession ? (
        <>
          <SessionRenameDialog session={dialogSession} open={dialog.kind === "rename"} onOpenChange={(o) => !o && setDialog(null)} />
          {dialog.kind === "restart" ? <RestartDialog session={dialogSession} onClose={() => setDialog(null)} /> : null}
          <MoveToGroupDialog session={dialogSession} open={dialog.kind === "move"} onOpenChange={(o) => !o && setDialog(null)} />
          <ShareSheet session={dialogSession} open={dialog.kind === "share"} onOpenChange={(o) => !o && setDialog(null)} />
          <SessionCloseDialog session={dialogSession} kind={dialog.kind === "complete" || dialog.kind === "cancel" || dialog.kind === "delete" ? dialog.kind : null} childCount={childCount} onOpenChange={(o) => !o && setDialog(null)} onCloseAutoFocus={closeFocus(dialog.id)} />
        </>
      ) : null}
    </nav>
  );
}
