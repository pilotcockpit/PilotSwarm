import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Ban, CheckCircle2, GitBranch, Link2, MoreHorizontal, Pencil, Pin, PinOff, RotateCcw, Share2, Trash2, X } from "lucide-react";
import type { Session } from "@/data/types";
import { sessionState, STATE_TONE, type SessionState } from "@/data/state";
import { holdReason, rollup, type Attention, type Rollup, type TreeIndex } from "@/data/session-tree";
import { ProjectIcon, SessionIcon } from "@/components/project-icon";
import { StateGlyph } from "@/components/state";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { canModify, copySessionLink, type CloseKind } from "@/components/session/session-actions";
import { ago, cn, plural, until } from "@/lib/utils";

export type RowDialog = { id: string; kind: "rename" | "move" | "share" | "restart" | CloseKind } | null;

/** The second line, only when the row has something to say: its own reason, else what its sub-agents are doing. */
export function rowReason(st: SessionState, r: Rollup, session?: Session): string | undefined {
  // A question is its own reason: show what is asked, not that something was asked.
  if (st.key === "needs") return questionText(session) || st.reason;
  if (st.key === "failed") return st.reason;
  if (st.waitKind === "hold") return holdReason(session!);
  if (r.failed) return `${plural(r.failed, "sub-agent")} failed`;
  if (r.needs) return `${plural(r.needs, "sub-agent")} asking`;
  if (r.running) return `${plural(r.running, "sub-agent")} running`;
  return undefined;
}

function questionText(session?: Session): string {
  const q = session?.pendingQuestion?.question || (typeof session?.waitReason === "string" ? session.waitReason : "");
  const text = q.replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 139)}…` : text;
}

function SubAgentChip({ r }: { r: Rollup }) {
  const tone = r.failed ? "text-failed" : r.needs ? "text-needs" : r.running ? "text-live" : "text-faint";
  const parts = [r.running && `${r.running} running`, r.needs && `${r.needs} asking`, r.failed && `${r.failed} failed`].filter(Boolean);
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5 text-xs tabular-nums", tone)} title={`${plural(r.total, "sub-agent")}${parts.length ? `: ${parts.join(", ")}` : ""}`}>
      <GitBranch className="size-3" aria-hidden />{r.total}
    </span>
  );
}

/** "31m ago" and "in 11h 45m" are too wide for a row: "31m" and "11h" say the same thing. */
const compact = (text: string) => text.replace(/ ago$/, "").replace(/^in /, "").replace(/^(\d+[dhm]) .*$/, "$1");

/** One thing in the trailing slot, by priority: an unseen update, else how long it has waited or when it wakes, else the sub-agent chip. */
function Trailing({ session, st, since, r }: { session: Session; st: SessionState; since?: number; r: Rollup }) {
  if (session.unseenCanvas) return <span className="size-1.5 shrink-0 rounded-full bg-accent" role="img" aria-label="Canvas updated" />;
  if (since) return <span className="shrink-0 text-xs tabular-nums text-faint">{compact(ago(since))}</span>;
  if (st.key === "waiting" && st.nextAt) return <span className="shrink-0 text-xs tabular-nums text-faint" title={st.next}>{compact(until(st.nextAt))}</span>;
  if (r.total) return <SubAgentChip r={r} />;
  return null;
}

export interface SidebarRowProps {
  /** Unique within the sidebar: the same session can be in Pinned and in a project. */
  rowKey: string;
  session: Session;
  index: TreeIndex;
  /** Highlighted: this is the session being viewed. */
  active: boolean;
  /** The row meant to be announced as the current page, since the same session can appear in several sections. (The router also marks every link to the open page, so a screen reader may announce more than one.) */
  current: boolean;
  /** The viewed session sits inside this one's tree. */
  within?: boolean;
  tabbable: boolean;
  pinned: boolean;
  attention?: Attention;
  isAdmin: boolean;
  onFocusRow: (rowKey: string) => void;
  onTogglePin: () => void;
  onDismiss?: () => void;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onAction: (kind: NonNullable<RowDialog>["kind"]) => void;
  onNavigate?: () => void;
  /** Mixed lists (Pinned) say what kind of thing a row is: a conversation icon with its state on the corner. */
  typed?: boolean;
}

export function SidebarRow({ rowKey, session, index, active, current, within, tabbable, pinned, attention, isAdmin, onFocusRow, onTogglePin, onDismiss, menuOpen, onMenuOpenChange, onAction, onNavigate, typed }: SidebarRowProps) {
  const st = sessionState(session);
  const r = React.useMemo(() => rollup(index, session.sessionId), [index, session]);
  const reason = attention?.reason ?? rowReason(st, r, session);
  // System sessions are not ordinary sessions: the SDK refuses rename, complete, cancel and delete on them.
  // An admin restarts them instead.
  const manage = canModify(session);
  const system = Boolean(session.isSystem);
  const closed = st.key === "completed" || st.key === "cancelled";
  const path = attention?.path ?? [];
  const title = session.title || "Untitled session";
  return (
    <li className="group/row relative">
      <Link
        to="/s/$sessionId"
        params={{ sessionId: session.sessionId }}
        aria-current={current ? "page" : undefined}
        data-sidebar-row
        data-row-key={rowKey}
        data-session-id={session.sessionId}
        tabIndex={tabbable ? 0 : -1}
        onFocus={() => onFocusRow(rowKey)}
        onClick={onNavigate}
        title={path.length ? `${path.join(" › ")} › ${title}` : title}
        className={cn(
          "focus-inset flex items-start gap-2 rounded-control py-1.5 pl-2 pr-2 text-sm pointer-coarse:min-h-11 pointer-coarse:pr-12 transition-colors duration-(--duration-fast)",
          reason ? "min-h-11" : "min-h-8 items-center",
          active ? "bg-raised font-medium text-fg" : within ? "bg-raised/50 text-fg" : "text-muted hover:bg-raised/60 hover:text-fg",
        )}
      >
        {typed ? (
          <span className={cn("relative grid size-4 shrink-0 place-items-center", reason && "mt-0.5")} role="img" aria-label="Session">
            <SessionIcon className="text-faint" />
            <span className="absolute -bottom-0.5 -right-1 grid place-items-center rounded-full bg-surface p-px"><StateGlyph state={st.key} hold={st.waitKind === "hold"} arc pulse={false} className="size-2" /></span>
          </span>
        ) : (
          <StateGlyph state={st.key} hold={st.waitKind === "hold"} arc pulse={false} className={cn("size-2.5", reason && "mt-1")} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{title}</span>
          {reason ? <span className={cn("block truncate text-xs font-normal", st.key === "failed" || st.key === "needs" ? STATE_TONE[st.key] : "text-muted")}>{reason}{path.length ? <span className="text-faint"> · in {path.join(" › ")}</span> : null}</span> : null}
        </span>
        <span className="mt-0.5 flex shrink-0 items-center"><Trailing session={session} st={st} since={attention?.since} r={r} /></span>
        <span className="sr-only">, {st.word}{pinned ? ", pinned" : ""}{r.total ? `, ${plural(r.total, "sub-agent")}` : ""}</span>
      </Link>
      <div className={cn("absolute right-0.5 top-1 flex items-center gap-0.5 rounded-control bg-raised pl-0.5", menuOpen ? "flex" : "hidden group-hover/row:flex group-focus-within/row:flex pointer-coarse:flex pointer-coarse:bg-transparent")}>
        {onDismiss ? (
          <Tooltip content="Dismiss until it fails again">
            <Button variant="quiet" size="icon-sm" tabIndex={-1} className="pointer-coarse:hidden" aria-label={`Dismiss ${title}`} onClick={onDismiss}><X /></Button>
          </Tooltip>
        ) : null}
        <Tooltip content={pinned ? "Unpin" : "Pin"}>
          <Button variant="quiet" size="icon-sm" tabIndex={-1} className="pointer-coarse:hidden" aria-label={`${pinned ? "Unpin" : "Pin"} ${title}`} aria-pressed={pinned} onClick={onTogglePin}>{pinned ? <PinOff /> : <Pin />}</Button>
        </Tooltip>
        <Menu open={menuOpen} onOpenChange={onMenuOpenChange}>
          <MenuTrigger asChild>
            <Button variant="quiet" size="icon-sm" tabIndex={-1} aria-label={`Actions for ${title}`}><MoreHorizontal /></Button>
          </MenuTrigger>
          <MenuContent align="start" className="w-55" onCloseAutoFocus={(e) => { const row = document.querySelector<HTMLElement>(`a[data-sidebar-row][data-row-key="${CSS.escape(rowKey)}"]`); if (row) { e.preventDefault(); row.focus(); } }}>
            <MenuItem disabled={!manage} icon={<Pencil />} onSelect={() => onAction("rename")}>Rename</MenuItem>
            <MenuItem icon={pinned ? <PinOff /> : <Pin />} onSelect={onTogglePin} hint="Press P in the list">{pinned ? "Unpin" : "Pin"}</MenuItem>
            {onDismiss ? <MenuItem icon={<X />} onSelect={onDismiss} hint="Until it fails again">Dismiss</MenuItem> : null}
            <MenuItem icon={<ProjectIcon />} onSelect={() => onAction("move")}>Move to project…</MenuItem>
            <MenuItem icon={<Share2 />} onSelect={() => onAction("share")}>Share…</MenuItem>
            <MenuItem icon={<Link2 />} onSelect={() => copySessionLink(session.sessionId)}>Copy link</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<CheckCircle2 />} disabled={closed || !manage} onSelect={() => onAction("complete")}>Complete</MenuItem>
            <MenuItem icon={<Ban />} danger disabled={closed || !manage} onSelect={() => onAction("cancel")}>Cancel</MenuItem>
            <MenuItem icon={<Trash2 />} danger disabled={!manage} onSelect={() => onAction("delete")}>Delete</MenuItem>
            {system && isAdmin ? (<><MenuSeparator /><MenuItem icon={<RotateCcw />} onSelect={() => onAction("restart")} hint="The way to reset a system session">Restart…</MenuItem></>) : null}
          </MenuContent>
        </Menu>
      </div>
    </li>
  );
}
