import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, FolderInput, ListFilter, MoreHorizontal, Pencil, Pin, PinOff, Plus, Share2, Link2, CheckCircle2, Ban, Trash2 } from "lucide-react";
import { useGroups, useProfile, useSessions } from "@/data/source";
import type { Session } from "@/data/types";
import { sessionState } from "@/data/state";
import { StateGlyph } from "@/components/state";
import { StateFacets } from "@/components/state-facets";
import { Button, DisclosureButton } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Popover, PopoverContent, PopoverTrigger, Skeleton, Switch } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { ShareSheet } from "@/components/session/share-sheet";
import { MoveToGroupDialog } from "@/components/session/move-to-group";
import { SessionCloseDialog, SessionRenameDialog, canManage, copySessionLink, type CloseKind } from "@/components/session/session-actions";
import { useUi } from "@/shell/ui-state";
import { cn } from "@/lib/utils";
import { usePins, useSidebarPrefs, type GroupBy } from "./prefs";
import { buildSections, RECENT_PAGE, visibleRowIds, type Section } from "./tree";

type Dialog = { id: string; kind: "rename" | "move" | "share" | CloseKind } | null;

/** The id of the session being viewed, from the address. */
export function useActiveSessionId(): string | null {
  return useRouterState({ select: (s) => (s.location.pathname.match(/^\/s\/([^/]+)/)?.[1] ?? null) });
}

/**
 * The sessions, in the sidebar: who needs you first, your pins, your groups, then the rest. One tab
 * stop for the whole list (arrow keys move, Enter opens, p pins, m opens the menu, Delete asks to
 * delete); the section headings are ordinary buttons. The list scrolls on its own, so the page
 * links above it never move.
 */
export function SessionsSidebar({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const { data: sessions, isLoading, isError, refetch } = useSessions();
  const { data: groups } = useGroups();
  const { data: profile } = useProfile();
  const pins = usePins();
  const prefs = useSidebarPrefs();
  const { openNewSession } = useUi();
  const active = useActiveSessionId();
  const [recentShown, setRecentShown] = React.useState(RECENT_PAGE);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const all = sessions || [];
  const sections = React.useMemo(
    () => buildSections({ sessions: all, groups: groups || [], pinned: pins.ids, groupBy: prefs.groupBy, state: prefs.state, showSystem: prefs.showSystem && Boolean(profile?.isAdmin) }),
    [all, groups, pins.ids, prefs.groupBy, prefs.state, prefs.showSystem, profile?.isAdmin],
  );
  const ids = React.useMemo(() => visibleRowIds(sections, prefs.collapsed, recentShown), [sections, prefs.collapsed, recentShown]);
  const tabbable = focusId && ids.includes(focusId) ? focusId : active && ids.includes(active) ? active : ids[0] ?? null;
  const byId = React.useMemo(() => new Map(all.map((s) => [s.sessionId, s])), [all]);
  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of all) if (!s.isSystem) { const k = sessionState(s).key; c[k] = (c[k] || 0) + 1; }
    return c;
  }, [all]);
  const total = all.filter((s) => !s.isSystem && !s.parentSessionId).length;
  const filtering = Boolean(prefs.state) || prefs.groupBy !== "groups";

  const focusRow = (id: string) => {
    setFocusId(id);
    listRef.current?.querySelector<HTMLElement>(`a[data-sidebar-row][data-session-id="${CSS.escape(id)}"]`)?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("a[data-sidebar-row]");
    if (!row || e.metaKey || e.ctrlKey || e.altKey) return;
    const id = row.dataset.sessionId!;
    const i = ids.indexOf(id);
    if (e.key === "ArrowDown") { e.preventDefault(); if (ids[i + 1]) focusRow(ids[i + 1]); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (ids[i - 1]) focusRow(ids[i - 1]); }
    else if (e.key === "Home") { e.preventDefault(); if (ids[0]) focusRow(ids[0]); }
    else if (e.key === "End") { e.preventDefault(); if (ids.length) focusRow(ids[ids.length - 1]); }
    else if (e.key === "p") { e.preventDefault(); pins.toggle(id); }
    else if (e.key === "m" || e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) { e.preventDefault(); setMenuFor(id); }
    else if (e.key === "Delete") { const s = byId.get(id); if (s && canManage(s)) { e.preventDefault(); setDialog({ id, kind: "delete" }); } }
  };

  const dialogSession = dialog ? byId.get(dialog.id) : undefined;
  const childCount = dialog ? all.filter((s) => s.parentSessionId === dialog.id).length : 0;

  return (
    <nav aria-label="Sessions" className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex shrink-0 items-center gap-1 px-1 pb-1">
        <Link to="/sessions" onClick={onNavigate} className="focus-inset flex min-h-8 flex-1 items-center gap-2 rounded-control px-1.5 text-sm font-semibold text-fg hover:bg-raised/60 pointer-coarse:min-h-11">
          Sessions <span className="text-xs font-normal tabular-nums text-faint">{total}</span>
        </Link>
        <Popover>
          <Tooltip content="Filter and group sessions">
            <PopoverTrigger asChild>
              <Button variant="quiet" size="icon-sm" aria-label="Filter and group sessions" className="relative">
                <ListFilter />
                {filtering ? <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-accent" aria-hidden /> : null}
              </Button>
            </PopoverTrigger>
          </Tooltip>
          <PopoverContent align="end" className="w-72">
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">Show</p>
                <StateFacets counts={counts} value={prefs.state} onChange={prefs.setState} />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">Group by</p>
                <Segmented<GroupBy> label="Group sessions by" value={prefs.groupBy} onChange={prefs.setGroupBy} options={[{ value: "groups", label: "My groups" }, { value: "agent", label: "Agent" }]} />
              </div>
              {profile?.isAdmin ? (
                <label className="flex items-center justify-between gap-3 text-sm">
                  Show system sessions
                  <Switch checked={prefs.showSystem} onCheckedChange={prefs.setShowSystem} aria-label="Show system sessions" />
                </label>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div ref={listRef} onKeyDown={onKeyDown} className="min-h-0 flex-1 overflow-y-auto px-1 pb-2" data-sessions-scroll>
        {isLoading ? (
          <div className="flex flex-col gap-1.5 px-1.5 pt-1" aria-hidden>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6" />)}</div>
        ) : isError ? (
          <p className="px-2 py-3 text-sm text-muted">Couldn't load sessions. <Button variant="link" size="sm" onClick={() => void refetch()}>Try again</Button></p>
        ) : !sections.length ? (
          <p className="px-2 py-3 text-sm text-muted">{prefs.state ? "No sessions in this state." : <>No sessions yet. <Button variant="link" size="sm" onClick={() => openNewSession()}>Start one</Button></>}</p>
        ) : (
          sections.map((sec) => (
            <SectionBlock
              key={sec.key}
              section={sec}
              collapsed={Boolean(prefs.collapsed[sec.key])}
              onToggle={() => prefs.toggleSection(sec.key)}
              recentShown={recentShown}
              onMoreRecent={() => setRecentShown((n) => n + RECENT_PAGE)}
              active={active}
              tabbable={tabbable}
              onFocusRow={setFocusId}
              pins={pins}
              menuFor={menuFor}
              setMenuFor={setMenuFor}
              setDialog={setDialog}
              onNavigate={onNavigate}
              onNewInGroup={sec.kind === "group" ? () => { onNavigate?.(); openNewSession({ group: sec.groupId }); } : undefined}
            />
          ))
        )}
      </div>

      {dialog && dialogSession ? (
        <>
          <SessionRenameDialog session={dialogSession} open={dialog.kind === "rename"} onOpenChange={(o) => !o && setDialog(null)} />
          <MoveToGroupDialog session={dialogSession} open={dialog.kind === "move"} onOpenChange={(o) => !o && setDialog(null)} />
          <ShareSheet session={dialogSession} open={dialog.kind === "share"} onOpenChange={(o) => !o && setDialog(null)} />
          <SessionCloseDialog session={dialogSession} kind={dialog.kind === "complete" || dialog.kind === "cancel" || dialog.kind === "delete" ? dialog.kind : null} childCount={childCount} onOpenChange={(o) => !o && setDialog(null)} />
        </>
      ) : null}
    </nav>
  );
}

function SectionBlock({ section, collapsed, onToggle, recentShown, onMoreRecent, active, tabbable, onFocusRow, pins, menuFor, setMenuFor, setDialog, onNavigate, onNewInGroup }: {
  section: Section; collapsed: boolean; onToggle: () => void; recentShown: number; onMoreRecent: () => void; active: string | null; tabbable: string | null;
  onFocusRow: (id: string) => void; pins: ReturnType<typeof usePins>; menuFor: string | null; setMenuFor: (id: string | null) => void; setDialog: (d: Dialog) => void; onNavigate?: () => void; onNewInGroup?: () => void;
}) {
  const isNeeds = section.kind === "needs";
  const open = isNeeds || !collapsed;
  const rows = section.kind === "recent" ? section.sessions.slice(0, recentShown) : section.sessions;
  const headingId = `sidebar-sec-${section.key.replace(/[^a-z0-9-]/gi, "_")}`;
  return (
    <section aria-labelledby={headingId} className="mt-1.5 first:mt-0">
      <div className="group/head flex items-center gap-0.5">
        {isNeeds ? (
          <h3 id={headingId} className="flex min-h-7 flex-1 items-center gap-1.5 px-1.5 text-xs font-medium text-faint">
            {section.title} <span className="tabular-nums">{section.sessions.length}</span>
          </h3>
        ) : (
          <h3 id={headingId} className="flex-1">
            <DisclosureButton aria-expanded={open} onClick={onToggle} className="w-full gap-1 rounded-control px-1.5 text-xs font-medium text-faint hover:bg-raised/60">
              <ChevronRight className={cn("size-3.5 shrink-0 transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden />
              {section.kind === "pinned" ? <Pin className="size-3 shrink-0" aria-hidden /> : null}
              <span className="truncate">{section.title}</span> <span className="tabular-nums">{section.sessions.length}</span>
            </DisclosureButton>
          </h3>
        )}
        {onNewInGroup ? (
          <Tooltip content={`New session in ${section.title}`}>
            <Button variant="quiet" size="icon-sm" aria-label={`New session in ${section.title}`} className="shrink-0 opacity-0 focus-visible:opacity-100 group-hover/head:opacity-100 pointer-coarse:opacity-100" onClick={onNewInGroup}><Plus /></Button>
          </Tooltip>
        ) : null}
      </div>
      {open ? (
        <>
          <ul className="flex flex-col gap-px">
            {rows.map((s) => (
              <SidebarRow
                key={s.sessionId}
                session={s}
                active={active === s.sessionId}
                tabbable={tabbable === s.sessionId}
                pinned={pins.isPinned(s.sessionId)}
                onFocusRow={onFocusRow}
                onTogglePin={() => pins.toggle(s.sessionId)}
                menuOpen={menuFor === s.sessionId}
                onMenuOpenChange={(o) => setMenuFor(o ? s.sessionId : null)}
                onAction={(kind) => { setMenuFor(null); setDialog({ id: s.sessionId, kind }); }}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
          {section.kind === "recent" && section.sessions.length > recentShown ? (
            <Button variant="quiet" size="sm" className="mt-0.5 w-full justify-start px-2 text-faint pointer-coarse:min-h-11" onClick={onMoreRecent}>Show {Math.min(RECENT_PAGE, section.sessions.length - recentShown)} more</Button>
          ) : null}
          {!rows.length ? <p className="px-2 py-1 text-xs text-faint">Empty. Move sessions here from their menu.</p> : null}
        </>
      ) : null}
    </section>
  );
}

function SidebarRow({ session, active, tabbable, pinned, onFocusRow, onTogglePin, menuOpen, onMenuOpenChange, onAction, onNavigate }: {
  session: Session; active: boolean; tabbable: boolean; pinned: boolean; onFocusRow: (id: string) => void; onTogglePin: () => void;
  menuOpen: boolean; onMenuOpenChange: (open: boolean) => void; onAction: (kind: NonNullable<Dialog>["kind"]) => void; onNavigate?: () => void;
}) {
  const st = sessionState(session);
  const manage = canManage(session);
  const closed = st.key === "completed" || st.key === "cancelled";
  return (
    <li className="group/row relative">
      <Link
        to="/s/$sessionId"
        params={{ sessionId: session.sessionId }}
        aria-current={active ? "page" : undefined}
        data-sidebar-row
        data-session-id={session.sessionId}
        tabIndex={tabbable ? 0 : -1}
        onFocus={() => onFocusRow(session.sessionId)}
        onClick={onNavigate}
        title={session.title}
        className={cn(
          "focus-inset flex min-h-8 items-center gap-2 rounded-control pl-2 pr-2 text-sm pointer-coarse:pr-12 transition-colors duration-(--duration-fast) pointer-coarse:min-h-11",
          active ? "bg-raised font-medium text-fg" : "text-muted hover:bg-raised/60 hover:text-fg",
        )}
      >
        <StateGlyph state={st.key} pulse={false} className="size-2" />
        <span className="min-w-0 flex-1 truncate">{session.title || "Untitled session"}</span>
        {session.unseenCanvas ? <span className="size-1.5 shrink-0 rounded-full bg-accent" role="img" aria-label="Canvas updated" /> : null}
        <span className="sr-only">, {st.word}{pinned ? ", pinned" : ""}</span>
      </Link>
      <div className={cn("absolute right-0.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-control bg-raised pl-0.5", menuOpen ? "flex" : "hidden group-hover/row:flex group-focus-within/row:flex pointer-coarse:flex pointer-coarse:bg-transparent")}>
        <Tooltip content={pinned ? "Unpin" : "Pin"}>
          <Button variant="quiet" size="icon-sm" tabIndex={-1} className="pointer-coarse:hidden" aria-label={`${pinned ? "Unpin" : "Pin"} ${session.title || "session"}`} aria-pressed={pinned} onClick={onTogglePin}>{pinned ? <PinOff /> : <Pin />}</Button>
        </Tooltip>
        <Menu open={menuOpen} onOpenChange={onMenuOpenChange}>
          <MenuTrigger asChild>
            <Button variant="quiet" size="icon-sm" tabIndex={-1} aria-label={`Actions for ${session.title || "session"}`}><MoreHorizontal /></Button>
          </MenuTrigger>
          <MenuContent align="start" className="w-55" onCloseAutoFocus={(e) => { const row = document.querySelector<HTMLElement>(`a[data-sidebar-row][data-session-id="${CSS.escape(session.sessionId)}"]`); if (row) { e.preventDefault(); row.focus(); } }}>
            <MenuItem disabled={!manage} icon={<Pencil />} onSelect={() => onAction("rename")}>Rename</MenuItem>
            <MenuItem icon={pinned ? <PinOff /> : <Pin />} onSelect={onTogglePin} hint="Press P in the list">{pinned ? "Unpin" : "Pin"}</MenuItem>
            <MenuItem icon={<FolderInput />} onSelect={() => onAction("move")}>Move to group…</MenuItem>
            <MenuItem icon={<Share2 />} onSelect={() => onAction("share")}>Share…</MenuItem>
            <MenuItem icon={<Link2 />} onSelect={() => copySessionLink(session.sessionId)}>Copy link</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<CheckCircle2 />} disabled={closed || !manage} onSelect={() => onAction("complete")}>Complete</MenuItem>
            <MenuItem icon={<Ban />} danger disabled={closed || !manage} onSelect={() => onAction("cancel")}>Cancel</MenuItem>
            <MenuItem icon={<Trash2 />} danger disabled={!manage} onSelect={() => onAction("delete")}>Delete</MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </li>
  );
}
