import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Toaster } from "sonner";
import {
  Bot, FolderOutput, House, KeyRound, LayoutGrid, Menu as MenuIcon, MessagesSquare, PanelLeftClose, PanelLeftOpen, Plus, Search, ShieldCheck, SlidersHorizontal,
} from "lucide-react";
import { useProfile, useSessions, useSource } from "@/data/source";
import { sessionState } from "@/data/state";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Badge } from "@/components/ui/misc";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import { ProjectIcon } from "@/components/project-icon";
import { SessionsSidebar } from "@/components/sidebar/sessions-sidebar";
import { useAttention } from "@/components/sidebar/use-attention";
import { ThemeSegmented } from "@/components/theme-setting";
import { AccountMenu } from "@/components/sidebar/account-menu";
import { cn, initials } from "@/lib/utils";
import { handOffToSearch, useUi, UiStateProvider } from "./ui-state";
import { useMediaQuery, useTheme } from "./prefs";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsDialog, useGlobalShortcuts } from "./shortcuts";
import { useAttentionNotifications } from "./notifications";
import { NewSessionSheet } from "@/routes/new-session";

const ProjectNavIcon = ({ className }: { className?: string }) => <ProjectIcon className={className} />;

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number; badgeTone?: "accent" | "neutral"; match: (path: string) => boolean };

function useNavCounts() {
  const { data: sessions } = useSessions();
  const needs = useAttention().items.length;
  return React.useMemo(() => {
    const list = (sessions || []).filter((s) => !s.isSystem);
    const open = list.filter((s) => !["completed", "cancelled"].includes(sessionState(s).key)).length;
    const unseen = list.filter((s) => s.unseenCanvas).length;
    return { needs, open, unseen };
  }, [sessions, needs]);
}

/** The page links. Sessions are not here: they are the list below these, in the sidebar. */
function useNav(): { pages: NavItem[]; sessionsLink: NavItem; projectsLink: NavItem } {
  const counts = useNavCounts();
  const pages: NavItem[] = [
    { to: "/", label: "Overview", icon: House, badge: counts.needs || undefined, badgeTone: "accent", match: (p) => p === "/" },
    { to: "/boards", label: "Boards", icon: LayoutGrid, match: (p) => p.startsWith("/boards") },
    { to: "/outputs", label: "Outputs", icon: FolderOutput, badge: counts.unseen || undefined, badgeTone: "neutral", match: (p) => p.startsWith("/outputs") },
    { to: "/library", label: "Library", icon: Bot, match: (p) => p.startsWith("/library") },
  ];
  const sessionsLink: NavItem = { to: "/projects", label: "Sessions", icon: MessagesSquare, badge: counts.needs || undefined, badgeTone: "accent", match: (p) => p.startsWith("/projects") || p.startsWith("/sessions") || p.startsWith("/s/") };
  // On a phone the Sessions tab opens the sessions drawer; the rail and the palette go to the Projects page, where projects and their sessions are listed.
  const projectsLink: NavItem = { ...sessionsLink, label: "Projects", icon: ProjectNavIcon };
  return { pages, sessionsLink, projectsLink };
}

function RailLink({ item, collapsed, path, onNavigate }: { item: NavItem; collapsed: boolean; path: string; onNavigate?: () => void }) {
  const active = item.match(path);
  const Icon = item.icon;
  const link = (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      // Folded to an icon, the link has no text: its name (and what waits in it) is spoken from here; the tooltip is only for sight.
      aria-label={collapsed ? (item.badge ? `${item.label}, ${item.badge} ${item.badgeTone === "accent" ? "need you" : "new"}` : item.label) : undefined}
      onClick={onNavigate}
      className={cn(
        "focus-inset group relative flex min-h-9 items-center gap-2.5 rounded-control text-sm font-medium transition-colors duration-(--duration-fast) pointer-coarse:min-h-11",
        collapsed ? "w-10 justify-center" : "px-2.5",
        active ? "bg-accent-tint text-accent" : "text-muted hover:bg-raised/60 hover:text-fg",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-muted group-hover:text-fg")} aria-hidden />
      {collapsed ? (
        item.badge && item.badgeTone === "accent" ? <span className="absolute right-1 top-1 size-2 rounded-full bg-accent" aria-hidden /> : null
      ) : (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge ? (item.badgeTone === "accent" ? <Badge tone="accent">{item.badge}</Badge> : <span className="text-xs tabular-nums text-faint">{item.badge}</span>) : null}
        </>
      )}
    </Link>
  );
  return collapsed ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link;
}

/** New session, Search and the page links: the same in the desktop rail and the phone drawer. */
export function NavTop({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { openNewSession, setPaletteOpen } = useUi();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { pages, projectsLink } = useNav();
  return (
    <>
      {collapsed ? (
        <div className="flex flex-col items-center gap-1.5">
          <Tooltip content={<span className="flex items-center gap-2">New session <Kbd>N</Kbd></span>} side="right">
            <Button size="icon" className="size-10" aria-label="New session" onClick={() => { onNavigate?.(); openNewSession(); }}><Plus /></Button>
          </Tooltip>
          <Tooltip content={<span className="flex items-center gap-2">Search <Kbd>⌘K</Kbd></span>} side="right">
            <Button variant="quiet" size="icon" className="size-10" aria-label="Search" onClick={() => handOffToSearch({ setPaletteOpen }, onNavigate)}><Search /></Button>
          </Tooltip>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Button className="w-full justify-start" onClick={() => { onNavigate?.(); openNewSession(); }}><Plus /> <span className="flex-1 text-left">New session</span> <Kbd>N</Kbd></Button>
          <Button variant="quiet" className="w-full justify-start text-muted" aria-label="Search" onClick={() => handOffToSearch({ setPaletteOpen }, onNavigate)}><Search /> <span className="flex-1 text-left">Search</span> <Kbd>⌘K</Kbd></Button>
        </div>
      )}
      <nav aria-label="Primary" className={cn("mt-3 flex w-full flex-col gap-0.5", collapsed && "items-center")}>
        {pages.map((item) => <RailLink key={item.to} item={item} collapsed={collapsed} path={path} onNavigate={onNavigate} />)}
        {/* Collapsed, the sessions list has no room: one icon takes you to the table, with the count of what needs you. */}
        {collapsed ? <RailLink item={projectsLink} collapsed path={path} onNavigate={onNavigate} /> : null}
      </nav>
    </>
  );
}

function Rail() {
  const { railCollapsed, setRailCollapsed: setPreference } = useUi();
  // Tablet widths fold the rail to icons without changing the saved desktop preference.
  const tablet = useMediaQuery("(max-width: 1100px)");
  const [tabletOpen, setTabletOpen] = React.useState(false);
  const collapsed = tablet ? !tabletOpen : railCollapsed;
  const setRailCollapsed = (v: boolean) => (tablet ? setTabletOpen(!v) : setPreference(v));
  return (
    <aside aria-label="Sidebar" className={cn("flex h-full shrink-0 flex-col border-r border-line bg-surface py-3", collapsed ? "w-16 items-center px-3" : "w-[272px] px-2.5")}>
      <div className={cn("mb-3 flex shrink-0 items-center", collapsed ? "flex-col gap-2" : "h-8 gap-2 px-2")}>
        <Logo />
        {collapsed ? null : <span className="text-prose font-semibold tracking-tight">PilotSwarm</span>}
        {/* The toggle lives at the top, where the sidebar begins, in both states. */}
        <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
          {/* 30px target (44px on touch) around an 18px glyph: one step above the 16px page icons, because this is chrome, not a destination. */}
          <Button variant="quiet" size="icon" className={cn("[&_svg]:size-4.5", !collapsed && "-mr-1 ml-auto")} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={() => setRailCollapsed(!collapsed)}>
            {collapsed ? <PanelLeftOpen strokeWidth={1.75} /> : <PanelLeftClose strokeWidth={1.75} />}
          </Button>
        </Tooltip>
      </div>
      <NavTop collapsed={collapsed} />
      {collapsed ? <div className="min-h-0 flex-1" /> : <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-line pt-2"><SessionsSidebar /></div>}
      <div className={cn("mt-2 flex shrink-0 flex-col gap-1 border-t border-line pt-2", collapsed && "items-center")}>
        <AccountMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}

/** Phone: the whole sidebar in a drawer from the left, opened by the menu button or the Sessions tab. */
function NavDrawer() {
  const { navOpen, setNavOpen, restoreFocus } = useUi();
  const close = () => setNavOpen(false);
  return (
    <Dialog open={Boolean(navOpen)} onOpenChange={(o) => !o && close()}>
      {navOpen ? (
        <DialogContent side="left" title="PilotSwarm" onCloseAutoFocus={restoreFocus} className="p-0">
          <div className="flex min-h-0 flex-1 flex-col px-3 pb-3" data-nav-drawer>
            <NavTop collapsed={false} onNavigate={close} />
            <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-line pt-2"><SessionsSidebar onNavigate={close} /></div>
            <div className="mt-2 shrink-0 border-t border-line pt-2"><AccountMenu onNavigate={close} /></div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
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

/** Phone: a bottom tab bar (Overview, Sessions, Boards, Outputs, More); Sessions opens the drawer on the list. */
function BottomTabs() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { pages, sessionsLink } = useNav();
  const { setNavOpen, openNewSession } = useUi();
  const [more, setMore] = React.useState(false);
  const { data: profile } = useProfile();
  const { mode, setMode } = useSource();
  const tabs = [pages[0], pages[1], pages[2]];
  const moreItems: Array<{ to: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { to: "/library", label: "Library", icon: Bot },
    { to: "/providers", label: "Models & spend", icon: KeyRound },
    ...(profile?.isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }] : []),
    { to: "/settings", label: "Settings", icon: SlidersHorizontal },
  ];
  const moreActive = !tabs.some((t) => t.match(path)) && !sessionsLink.match(path);
  const tabClass = (active: boolean) => cn("relative flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium", active ? "text-fg" : "text-muted");
  const tab = (t: NavItem) => {
    const active = t.match(path);
    const Icon = t.icon;
    return (
      <Link key={t.to} to={t.to} aria-current={active ? "page" : undefined} className={tabClass(active)}>
        <span className="relative">
          <Icon className="size-5" aria-hidden />
          {t.badge && t.badgeTone === "accent" ? <span className="absolute -right-1.5 -top-1 size-2 rounded-full bg-accent" aria-hidden /> : null}
        </span>
        {t.label}
        {t.badge ? <span className="sr-only">, {t.badge}{t.badgeTone === "accent" ? " need attention" : ""}</span> : null}
        {active ? <span className="absolute top-0 h-0.5 w-8 rounded-b bg-accent" aria-hidden /> : null}
      </Link>
    );
  };
  return (
    <>
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-(--z-sticky) grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        {tab(tabs[0])}
        <button type="button" onClick={() => setNavOpen("sessions")} aria-haspopup="dialog" className={tabClass(sessionsLink.match(path))}>
          <span className="relative">
            <MessagesSquare className="size-5" aria-hidden />
            {sessionsLink.badge ? <span className="absolute -right-1.5 -top-1 size-2 rounded-full bg-accent" aria-hidden /> : null}
          </span>
          Sessions
          {sessionsLink.badge ? <span className="sr-only">, {sessionsLink.badge} need attention</span> : null}
          {sessionsLink.match(path) ? <span className="absolute top-0 h-0.5 w-8 rounded-b bg-accent" aria-hidden /> : null}
        </button>
        {tab(tabs[1])}
        {tab(tabs[2])}
        <Button variant="quiet" onClick={() => setMore(true)} aria-expanded={more} className={cn("h-14 flex-col gap-0.5 rounded-none text-xs [&_svg]:size-5", moreActive ? "text-fg" : "text-muted")}>
          <MenuIcon aria-hidden /> More
        </Button>
      </nav>
      <Dialog open={more} onOpenChange={setMore}>
        <DialogContent title="More" side="right" className="max-w-[360px]">
          <DialogBody className="flex flex-col gap-1">
            <Button className="mb-2" onClick={() => { setMore(false); openNewSession(); }}><Plus /> New session</Button>
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = path.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined} onClick={() => setMore(false)} className={cn("flex min-h-11 items-center gap-3 rounded-control px-3 text-base", active ? "bg-accent-tint text-accent" : "hover:bg-raised")}>
                  <Icon className="size-5" aria-hidden /> {item.label}
                </Link>
              );
            })}
            <div className="mt-4 flex items-center gap-3 border-t border-line px-3 pt-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-raised text-xs font-semibold" aria-hidden>{initials(profile?.displayName)}</span>
              <div className="min-w-0"><p className="truncate text-sm font-medium">{profile?.displayName || "Signed-in person"}</p><p className="text-xs text-muted">{profile?.isAdmin ? "Admin" : "Member"}</p></div>
            </div>
            <div className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
              <div className="flex items-center justify-between gap-3 px-3 py-1 text-sm"><span>Theme</span><ThemeSegmented /></div>
              {mode === "demo" ? <Button variant="quiet" className="justify-start text-accent" onClick={() => setMode("live")}>Use live data</Button> : null}
            </div>
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
  const { setPaletteOpen, setNavOpen } = useUi();
  const phone = useMediaQuery("(max-width: 767px)");
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-4 md:gap-3 md:px-6">
      {phone ? <Button variant="quiet" size="icon" aria-label="Open menu and sessions" aria-haspopup="dialog" onClick={() => setNavOpen("menu")}><MenuIcon /></Button> : null}
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
                  <h1 className="truncate text-lg font-semibold tracking-tight text-fg">{c.label}</h1>
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
    </header>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  useTheme();
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
      {phone ? <NavDrawer /> : null}
      <CommandPalette />
      <ShortcutsDialog />
      <NewSessionSheet />
      <Toaster
        // Undo and Retry live in toasts: 4s (the library default) is too short to read and reach them (WCAG 2.2.1).
        duration={8000}
        // Phones: above the bottom bar, not over the top bar. A toast on top covers the title, search and the
        // session menu for its whole 8 seconds, so you cannot reach them.
        position={phone ? "bottom-center" : "bottom-right"}
        mobileOffset={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px))", left: 12, right: 12 }}
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

