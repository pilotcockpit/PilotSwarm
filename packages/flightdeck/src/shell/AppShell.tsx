import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Toaster } from "sonner";
import {
  Bot, ChevronsLeft, ChevronsRight, FolderOutput, House, KeyRound, LayoutGrid, Menu as MenuIcon, MessagesSquare, Moon, Plus, Search, ShieldCheck, SlidersHorizontal, Sun,
} from "lucide-react";
import { useConnection, useProfile, useSessions, useSource } from "@/data/source";
import { sessionState } from "@/data/state";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Badge } from "@/components/ui/misc";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import { cn, initials } from "@/lib/utils";
import { useUi, UiStateProvider } from "./ui-state";
import { useDensity, useMediaQuery, useTheme } from "./prefs";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsDialog, useGlobalShortcuts } from "./shortcuts";
import { useAttentionNotifications } from "./notifications";
import { NewSessionSheet } from "@/routes/new-session";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number; badgeTone?: "accent" | "neutral"; match: (path: string) => boolean };

function useNavCounts() {
  const { data: sessions } = useSessions();
  return React.useMemo(() => {
    const list = (sessions || []).filter((s) => !s.isSystem);
    const needs = list.filter((s) => {
      const k = sessionState(s).key;
      return k === "needs" || k === "failed" || (k === "waiting" && sessionState(s).waitKind === "hold");
    }).length;
    const open = list.filter((s) => !["completed", "cancelled"].includes(sessionState(s).key)).length;
    const unseen = list.filter((s) => s.unseenCanvas).length;
    return { needs, open, unseen };
  }, [sessions]);
}

function useNav(): { top: NavItem[]; bottom: NavItem[] } {
  const counts = useNavCounts();
  const { data: profile } = useProfile();
  const top: NavItem[] = [
    { to: "/", label: "Overview", icon: House, badge: counts.needs || undefined, badgeTone: "accent", match: (p) => p === "/" },
    { to: "/sessions", label: "Sessions", icon: MessagesSquare, badge: counts.open || undefined, badgeTone: "neutral", match: (p) => p.startsWith("/sessions") || p.startsWith("/s/") },
    { to: "/boards", label: "Boards", icon: LayoutGrid, match: (p) => p.startsWith("/boards") },
    { to: "/outputs", label: "Outputs", icon: FolderOutput, badge: counts.unseen || undefined, badgeTone: "neutral", match: (p) => p.startsWith("/outputs") },
    { to: "/library", label: "Agent library", icon: Bot, match: (p) => p.startsWith("/library") },
  ];
  const bottom: NavItem[] = [
    { to: "/providers", label: "Providers", icon: KeyRound, match: (p) => p.startsWith("/providers") },
    ...(profile?.isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck, match: (p: string) => p.startsWith("/admin") }] : []),
    { to: "/settings", label: "Settings", icon: SlidersHorizontal, match: (p) => p.startsWith("/settings") },
  ];
  return { top, bottom };
}

function RailLink({ item, collapsed, path }: { item: NavItem; collapsed: boolean; path: string }) {
  const active = item.match(path);
  const Icon = item.icon;
  const link = (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-inset group relative flex min-h-9 items-center gap-2.5 rounded-control text-sm font-medium transition-colors duration-(--duration-fast) pointer-coarse:min-h-11",
        collapsed ? "w-10 justify-center" : "px-2.5",
        active ? "bg-accent-tint text-accent" : "text-muted hover:bg-raised/60 hover:text-fg",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-muted group-hover:text-fg")} aria-hidden />
      {collapsed ? (
        item.badge ? <span className="absolute right-1 top-1 size-2 rounded-full bg-accent" aria-hidden /> : null
      ) : (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge ? (item.badgeTone === "accent" ? <Badge tone="accent">{item.badge}</Badge> : <span className="text-xs tabular-nums text-faint">{item.badge}</span>) : null}
        </>
      )}
      {collapsed && item.badge ? <span className="sr-only">, {item.badge}</span> : null}
    </Link>
  );
  return collapsed ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link;
}

function NavigationGroup({ label, items, collapsed, path, className }: { label: string; items: NavItem[]; collapsed: boolean; path: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("flex w-full flex-col gap-0.5", className)}>
      {collapsed ? <div className="mx-auto my-2 h-px w-6 bg-line" aria-hidden /> : <p className="mb-1 px-2.5 text-xs font-medium text-faint">{label}</p>}
      {items.map((item) => <RailLink key={item.to} item={item} collapsed={collapsed} path={path} />)}
    </div>
  );
}

function ConnectionStatus({ collapsed }: { collapsed: boolean }) {
  const state = useConnection();
  const { mode, setMode, source } = useSource();
  const tone = state === "connected" ? "bg-live" : state === "reconnecting" ? "bg-waiting" : "bg-failed";
  const word = state === "connected" ? "Connected" : state === "reconnecting" ? "Reconnecting" : "Offline";
  const label = mode === "demo" ? "Demo data" : `${word} · ${source.label}`;
  const dot = <span className={cn("size-2 shrink-0 rounded-full", mode === "demo" ? "bg-waiting" : tone)} aria-hidden />;
  if (collapsed) {
    return (
      <Tooltip content={label} side="right">
        <span className="flex h-6 w-10 items-center justify-center" role="status" aria-label={label}>{dot}</span>
      </Tooltip>
    );
  }
  return (
    <div className="flex items-center gap-2 px-2.5 text-xs text-muted" role="status" aria-live="polite">
      {dot}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {/* Production carries no dev toggles: the way back to live data only shows while demo data is on.
          Switching in the other direction lives in Settings and the command palette. */}
      {mode === "demo" ? <Button variant="quiet" size="sm" className="shrink-0 text-accent" onClick={() => setMode("live")}>Use live</Button> : null}
    </div>
  );
}

function Rail() {
  const { railCollapsed, setRailCollapsed: setPreference, openNewSession } = useUi();
  // Tablet widths fold the rail to icons without changing the saved desktop preference.
  const tablet = useMediaQuery("(max-width: 1100px)");
  const [tabletOpen, setTabletOpen] = React.useState(false);
  const collapsed = tablet ? !tabletOpen : railCollapsed;
  const setRailCollapsed = (v: boolean) => (tablet ? setTabletOpen(!v) : setPreference(v));
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { top, bottom } = useNav();
  const { data: profile } = useProfile();
  return (
    <nav
      aria-label="Primary"
      className={cn("flex h-full shrink-0 flex-col overflow-y-auto border-r border-line bg-surface py-4", collapsed ? "w-16 items-center px-3" : "w-[232px] px-3")}
    >
      <div className={cn("mb-4 flex h-8 shrink-0 items-center gap-2", collapsed ? "justify-center" : "px-1.5")}>
        <Logo />
        {collapsed ? null : (
          <>
            <span className="text-prose font-semibold tracking-tight">PilotSwarm</span>
          </>
        )}
      </div>
      {collapsed ? (
        <Tooltip content={<span className="flex items-center gap-2">New session <Kbd>N</Kbd></span>} side="right">
          <Button size="icon" className="mb-3 size-10" aria-label="New session" onClick={() => openNewSession()}>
            <Plus />
          </Button>
        </Tooltip>
      ) : (
        <Button className="mb-3 w-full justify-start" onClick={() => openNewSession()}>
          <Plus /> <span className="flex-1 text-left">New session</span> <Kbd>N</Kbd>
        </Button>
      )}
      <NavigationGroup label="Work" items={top.slice(0, 4)} collapsed={collapsed} path={path} />
      <NavigationGroup label="Build" items={top.slice(4)} collapsed={collapsed} path={path} className="mt-5" />
      <div className="mt-auto flex w-full shrink-0 flex-col gap-0.5 pt-6">
        <NavigationGroup label="Manage" items={bottom} collapsed={collapsed} path={path} />
        <div className={cn("mt-4 flex items-center gap-2.5 border-t border-line pt-3", collapsed ? "justify-center" : "px-2.5")}>
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-tint text-xs font-semibold text-accent" aria-hidden>{initials(profile?.displayName)}</span>
          {collapsed ? null : (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">{profile?.displayName || "…"}</div>
              <div className="truncate text-xs text-faint">{profile?.isAdmin ? "Admin" : "Member"}</div>
            </div>
          )}
          {collapsed ? null : (
            <Tooltip content="Collapse navigation">
              <Button variant="quiet" size="icon-sm" aria-label="Collapse navigation" onClick={() => setRailCollapsed(true)}><ChevronsLeft /></Button>
            </Tooltip>
          )}
        </div>
        {collapsed ? (
          <Tooltip content="Expand navigation" side="right">
            <Button variant="quiet" size="icon-sm" className="mx-auto mt-1" aria-label="Expand navigation" onClick={() => setRailCollapsed(false)}><ChevronsRight /></Button>
          </Tooltip>
        ) : null}
        <div className="mt-2"><ConnectionStatus collapsed={collapsed} /></div>
      </div>
    </nav>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5 shrink-0 text-accent", className)} aria-hidden>
      <g fill="currentColor">
        <circle cx="12" cy="12" r="2.6" />
        <circle cx="12" cy="4.2" r="1.6" opacity=".85" /><circle cx="12" cy="19.8" r="1.6" opacity=".85" />
        <circle cx="5.2" cy="8.1" r="1.6" opacity=".85" /><circle cx="18.8" cy="8.1" r="1.6" opacity=".85" />
        <circle cx="5.2" cy="15.9" r="1.6" opacity=".85" /><circle cx="18.8" cy="15.9" r="1.6" opacity=".85" />
      </g>
    </svg>
  );
}

/** Phone: the same product through a bottom tab bar (Overview, Sessions, Boards, Outputs, More). */
function BottomTabs() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { top, bottom } = useNav();
  const [more, setMore] = React.useState(false);
  const { openNewSession } = useUi();
  const { data: profile } = useProfile();
  const tabs = top.slice(0, 4);
  const moreActive = !tabs.some((t) => t.match(path));
  return (
    <>
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-(--z-sticky) grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => {
          const active = t.match(path);
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to} aria-current={active ? "page" : undefined} className={cn("relative flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium", active ? "text-fg" : "text-muted")}>
              <span className="relative">
                <Icon className="size-5" aria-hidden />
                {t.badge && t.badgeTone === "accent" ? <span className="absolute -right-1.5 -top-1 size-2 rounded-full bg-accent" aria-hidden /> : null}
              </span>
              {t.label}
              {t.badge ? <span className="sr-only">, {t.badge}{t.badgeTone === "accent" ? " need attention" : ""}</span> : null}
              {active ? <span className="absolute top-0 h-0.5 w-8 rounded-b bg-accent" aria-hidden /> : null}
            </Link>
          );
        })}
        <Button variant="quiet" onClick={() => setMore(true)} aria-expanded={more} className={cn("h-14 flex-col gap-0.5 rounded-none text-xs [&_svg]:size-5", moreActive ? "text-fg" : "text-muted")}>
          <MenuIcon aria-hidden /> More
        </Button>
      </nav>
      <Dialog open={more} onOpenChange={setMore}>
        <DialogContent title="More" side="right" className="max-w-[360px]">
          <DialogBody className="flex flex-col gap-1">
            <Button className="mb-2" onClick={() => { setMore(false); openNewSession(); }}><Plus /> New session</Button>
            {[{ label: "Build", items: top.slice(4) }, { label: "Manage", items: bottom }].map((group) => (
              <div key={group.label} role="group" aria-label={group.label} className="mt-3">
                <p className="mb-1 px-3 text-xs font-medium text-faint">{group.label}</p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.match(path);
                  return (
                    <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined} onClick={() => setMore(false)} className={cn("flex min-h-11 items-center gap-3 rounded-control px-3 text-base", active ? "bg-accent-tint text-accent" : "hover:bg-raised")}>
                      <Icon className="size-5" aria-hidden /> {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
            <div className="mt-4 flex items-center gap-3 border-t border-line px-3 pt-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-raised text-xs font-semibold" aria-hidden>{initials(profile?.displayName)}</span>
              <div className="min-w-0"><p className="truncate text-sm font-medium">{profile?.displayName || "Signed-in person"}</p><p className="text-xs text-muted">{profile?.isAdmin ? "Admin" : "Member"}</p></div>
            </div>
            <div className="mt-3 border-t border-line pt-3"><ConnectionStatus collapsed={false} /></div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Top bar inside each area: breadcrumb title, area actions, ⌘K search.
 * Pages render it themselves so the crumbs and actions sit with the page.
 */
export function TopBar({ crumbs, actions, titleIsHeading = true }: { crumbs: Array<{ label: React.ReactNode; to?: string; params?: any; search?: any }>; actions?: React.ReactNode; titleIsHeading?: boolean }) {
  const { setPaletteOpen } = useUi();
  const [theme, setTheme] = useTheme();
  const phone = useMediaQuery("(max-width: 767px)");
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const isDark = theme === "dark" || (theme === "system" && systemDark);
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-4 md:gap-3 md:px-6">
      {phone ? <Link to="/" aria-label="PilotSwarm overview" className="grid size-8 shrink-0 place-items-center rounded-control pointer-coarse:size-11"><Logo /></Link> : null}
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          {crumbs.map((c, i) => (
            <li key={i} className={cn("flex min-w-0 items-center gap-1.5", i < crumbs.length - 1 && "hidden sm:flex")}>
              {i > 0 ? <span className="hidden text-faint sm:inline" aria-hidden>›</span> : null}
              {c.to && i < crumbs.length - 1 ? (
                <Link to={c.to} params={c.params} search={c.search} className="inline-flex min-h-6 items-center truncate text-muted hover:text-fg pointer-coarse:min-h-11">{c.label}</Link>
              ) : (
                // The current area's name is the page heading; a session page has its own h1 below.
                titleIsHeading && i === crumbs.length - 1 ? (
                  <h1 className="truncate text-lg font-semibold tracking-tight text-fg" aria-current="page">{c.label}</h1>
                ) : (
                  <span className={cn("truncate font-semibold text-fg", i === crumbs.length - 1 && crumbs.length === 1 && "text-lg tracking-tight")} aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
                )
              )}
            </li>
          ))}
        </ol>
      </nav>
      {actions}
      <Button
        variant="quiet"
        onClick={() => setPaletteOpen(true)}
        className={cn("h-8 shrink-0 gap-2 border border-line bg-bg text-sm text-muted hover:border-line-strong hover:bg-raised pointer-coarse:h-11", phone ? "w-8 px-0 pointer-coarse:w-11" : "w-8 px-0 xl:w-64 xl:px-2.5")}
        aria-label="Search sessions, agents and commands"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        {phone ? null : (
          <span className="hidden min-w-0 flex-1 items-center gap-3 xl:flex"><span className="flex-1 truncate text-left">Search or jump to…</span><Kbd>⌘K</Kbd></span>
        )}
      </Button>
      <Tooltip content={isDark ? "Switch to light" : "Switch to dark"}>
        <Button variant="quiet" size="icon" aria-label="Toggle light and dark theme" onClick={() => setTheme(isDark ? "light" : "dark")}>
          {isDark ? <Sun /> : <Moon />}
        </Button>
      </Tooltip>
    </header>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  useTheme();
  useDensity();
  useGlobalShortcuts();
  useAttentionNotifications();
  const phone = useMediaQuery("(max-width: 767px)");
  return (
    <div className="flex h-dvh overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-(--z-toast) focus:rounded-control focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">Skip to content</a>
      {phone ? null : <Rail />}
      <main id="main" tabIndex={-1} className={cn("flex min-w-0 flex-1 flex-col outline-none", phone && "pb-[calc(56px+env(safe-area-inset-bottom))]")}>
        {children}
      </main>
      {phone ? <BottomTabs /> : null}
      <CommandPalette />
      <ShortcutsDialog />
      <NewSessionSheet />
      <Toaster
        position={phone ? "top-center" : "bottom-right"}
        toastOptions={{ className: "!bg-overlay !text-fg !border-line !rounded-pane !shadow-pop !font-sans !text-sm" }}
      />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={350}>
      <UiStateProvider>
        <ShellInner>{children}</ShellInner>
      </UiStateProvider>
    </TooltipProvider>
  );
}

