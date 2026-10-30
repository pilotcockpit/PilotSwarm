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
import { CLASSIC_PORTAL_URL, useDensity, useMediaQuery, useTheme } from "./prefs";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsDialog, useGlobalShortcuts } from "./shortcuts";
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
    { to: "/", label: "Home", icon: House, badge: counts.needs || undefined, badgeTone: "accent", match: (p) => p === "/" },
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
        "focus-inset group relative flex h-[34px] items-center gap-2.5 rounded-control text-sm font-medium transition-colors duration-(--duration-fast)",
        collapsed ? "w-10 justify-center" : "px-2.5",
        active ? "bg-raised text-fg" : "text-muted hover:bg-raised/60 hover:text-fg",
      )}
    >
      {active ? <span className="absolute -left-2 top-2 h-[18px] w-[3px] rounded-r bg-accent" aria-hidden /> : null}
      <Icon className={cn("size-4 shrink-0", active ? "text-fg" : "text-muted group-hover:text-fg")} />
      {collapsed ? (
        item.badge ? <span className="absolute right-1 top-1 size-2 rounded-full bg-accent" aria-hidden /> : null
      ) : (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge ? <Badge tone={item.badgeTone === "accent" ? "accent" : "neutral"}>{item.badge}</Badge> : null}
        </>
      )}
      {collapsed && item.badge ? <span className="sr-only">, {item.badge}</span> : null}
    </Link>
  );
  return collapsed ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link;
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
      <button type="button" className="shrink-0 rounded-chip px-1 text-accent hover:underline" onClick={() => setMode(mode === "demo" ? "live" : "demo")}>
        {mode === "demo" ? "Use live" : "Use demo"}
      </button>
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
      className={cn("flex h-full shrink-0 flex-col border-r border-line bg-surface py-3 transition-[width] duration-(--duration-base) ease-out-fd", collapsed ? "w-16 items-center px-3" : "w-[232px] px-3")}
    >
      <div className={cn("mb-3 flex h-8 items-center gap-2", collapsed ? "justify-center" : "px-1.5")}>
        <Logo />
        {collapsed ? null : (
          <>
            <span className="text-prose font-semibold tracking-tight">PilotSwarm</span>
            <span className="ml-auto rounded-chip border border-line px-1.5 font-mono text-xs text-faint" title="Flight Deck preview build">next</span>
          </>
        )}
      </div>
      {collapsed ? (
        <Tooltip content={<span className="flex items-center gap-2">New session <Kbd>N</Kbd></span>} side="right">
          <Button variant="primary" size="icon" className="mb-3 size-10" aria-label="New session" onClick={() => openNewSession()}>
            <Plus />
          </Button>
        </Tooltip>
      ) : (
        <Button variant="primary" size="lg" className="mb-3 w-full justify-start" onClick={() => openNewSession()}>
          <Plus /> <span className="flex-1 text-left">New session</span> <Kbd className="border-accent-fg/40 bg-transparent font-semibold text-accent-fg">N</Kbd>
        </Button>
      )}
      <div className="flex w-full flex-col gap-0.5">
        {top.map((item) => <RailLink key={item.to} item={item} collapsed={collapsed} path={path} />)}
      </div>
      <div className="mt-auto flex w-full flex-col gap-0.5 border-t border-line pt-3">
        {bottom.map((item) => <RailLink key={item.to} item={item} collapsed={collapsed} path={path} />)}
        <div className={cn("mt-2 flex items-center gap-2.5", collapsed ? "justify-center" : "px-2.5")}>
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

/** Phone: the same product through a bottom tab bar (Home, Sessions, Boards, Outputs, More). */
function BottomTabs() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { top, bottom } = useNav();
  const [more, setMore] = React.useState(false);
  const { openNewSession } = useUi();
  const tabs = top.slice(0, 4);
  const moreActive = !tabs.some((t) => t.match(path));
  return (
    <>
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {tabs.map((t) => {
          const active = t.match(path);
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to} aria-current={active ? "page" : undefined} className={cn("relative flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium", active ? "text-fg" : "text-muted")}>
              <span className="relative">
                <Icon className="size-5" />
                {t.badge && t.badgeTone === "accent" ? <span className="absolute -right-1.5 -top-1 size-2 rounded-full bg-accent" aria-hidden /> : null}
              </span>
              {t.label}
              {active ? <span className="absolute top-0 h-0.5 w-8 rounded-b bg-accent" aria-hidden /> : null}
            </Link>
          );
        })}
        <button type="button" onClick={() => setMore(true)} className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium", moreActive ? "text-fg" : "text-muted")}>
          <MenuIcon className="size-5" /> More
        </button>
      </nav>
      <Dialog open={more} onOpenChange={setMore}>
        <DialogContent title="More" side="right" className="max-w-[360px]">
          <DialogBody className="flex flex-col gap-1">
            <Button variant="primary" size="lg" className="mb-2" onClick={() => { setMore(false); openNewSession(); }}><Plus /> New session</Button>
            {[top[4], ...bottom].filter(Boolean).map((item) => {
              const Icon = item!.icon;
              return (
                <Link key={item!.to} to={item!.to} onClick={() => setMore(false)} className="flex h-11 items-center gap-3 rounded-control px-3 text-base hover:bg-raised">
                  <Icon className="size-5 text-muted" /> {item!.label}
                </Link>
              );
            })}
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
  const isDark = document.documentElement.classList.contains("dark");
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-line bg-bg px-4 md:px-5">
      {phone ? <Logo /> : null}
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          {crumbs.map((c, i) => (
            <li key={i} className={cn("flex min-w-0 items-center gap-1.5", i < crumbs.length - 1 && "hidden sm:flex")}>
              {i > 0 ? <span className="hidden text-faint sm:inline" aria-hidden>›</span> : null}
              {c.to && i < crumbs.length - 1 ? (
                <Link to={c.to} params={c.params} search={c.search} className="truncate text-muted hover:text-fg">{c.label}</Link>
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
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className={cn("flex h-8 items-center gap-2 rounded-control border border-line bg-surface text-sm text-faint transition-colors hover:border-line-strong hover:text-muted pointer-coarse:h-11", phone ? "w-8 justify-center pointer-coarse:w-11" : "w-[300px] px-2.5")}
        aria-label="Search sessions, agents and commands"
      >
        <Search className="size-4 shrink-0" />
        {phone ? null : (
          <>
            <span className="flex-1 truncate text-left">Search sessions, agents, commands…</span>
            <Kbd>⌘K</Kbd>
          </>
        )}
      </button>
      <Tooltip content={isDark ? "Switch to light" : "Switch to dark"}>
        <Button variant="quiet" size="icon" aria-label="Toggle light and dark theme" onClick={() => setTheme(isDark ? "light" : theme === "light" ? "dark" : "dark")}>
          {isDark ? <Sun /> : <Moon />}
        </Button>
      </Tooltip>
    </header>
  );
}

/** "Not in Flight Deck yet": every unported feature links back to the classic portal. */
export function ClassicLink({ path = "", children = "Open in classic portal", className }: { path?: string; children?: React.ReactNode; className?: string }) {
  return (
    <a href={`${CLASSIC_PORTAL_URL}${path}`} target="_blank" rel="noreferrer" className={cn("text-accent hover:underline underline-offset-2", className)}>
      {children}
    </a>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  useTheme();
  useDensity();
  useGlobalShortcuts();
  const phone = useMediaQuery("(max-width: 767px)");
  return (
    <div className="flex h-dvh overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-control focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">Skip to content</a>
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

