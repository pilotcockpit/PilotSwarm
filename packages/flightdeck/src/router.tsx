import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/shell/AppShell";
import { AttentionTitle } from "@/shell/attention";
import { HomePage } from "@/routes/home";
import { SessionsPage } from "@/routes/sessions";
import { SessionPage } from "@/routes/session";
import { BoardsPage } from "@/routes/boards";
import { OutputsPage } from "@/routes/outputs";
import { LibraryPage } from "@/routes/library";
import { ProvidersPage } from "@/routes/providers";
import { AdminPage } from "@/routes/admin";
import { SettingsPage } from "@/routes/settings";
import { NotFound } from "@/routes/not-found";

// The URL is the source of truth for navigation: every area, session view,
// canvas slot and tab is a route or a search param, so Back, reload,
// bookmarks and shared links all work.

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const oneOf = <T extends string>(v: unknown, values: readonly T[]) => (values.includes(v as T) ? (v as T) : undefined);
// Every search param is optional: links name only the ones they set.
const optional = <T extends object>(read: (s: Record<string, unknown>) => T) => (s: Record<string, unknown>): Partial<T> => read(s);

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <AttentionTitle />
      <Outlet />
    </AppShell>
  ),
  notFoundComponent: NotFound,
});

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });

export const SESSION_FILTERS = ["mine", "shared", "all"] as const;
export const STATE_FILTERS = ["any", "running", "needs", "waiting", "scheduled", "failed", "idle", "closed"] as const;
const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sessions",
  validateSearch: optional((s) => ({
    q: str(s.q),
    who: oneOf(s.who, SESSION_FILTERS),
    state: oneOf(s.state, STATE_FILTERS),
  })),
  component: SessionsPage,
});

export const SESSION_VIEWS = ["chat", "context", "canvas", "files", "delegation", "activity"] as const;
export type SessionView = (typeof SESSION_VIEWS)[number];
export const ACTIVITY_TABS = ["timeline", "logs", "nodes", "history", "stats"] as const;
const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/s/$sessionId",
  validateSearch: optional((s) => ({
    view: oneOf(s.view, SESSION_VIEWS),
    slot: Number.isFinite(Number(s.slot)) && Number(s.slot) >= 1 && Number(s.slot) <= 5 ? Number(s.slot) : undefined,
    files: oneOf(s.files, ["outputs", "folders"] as const),
    file: str(s.file),
    activity: oneOf(s.activity, ACTIVITY_TABS),
    focus: s.focus === true || s.focus === "1" || s.focus === 1 ? true : undefined,
  })),
  component: SessionPage,
});

const boardsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/boards",
  validateSearch: optional((s) => ({ board: str(s.board) })),
  component: BoardsPage,
});

const outputsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/outputs",
  validateSearch: optional((s) => ({ tab: oneOf(s.tab, ["canvases", "files"] as const), q: str(s.q) })),
  component: OutputsPage,
});

const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/library",
  validateSearch: optional((s) => ({ tab: oneOf(s.tab, ["agents", "apps", "packages"] as const) })),
  component: LibraryPage,
});

const providersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/providers",
  validateSearch: optional((s) => ({ tab: oneOf(s.tab, ["providers", "defaults", "copilot"] as const), provider: str(s.provider) })),
  component: ProvidersPage,
});

export const ADMIN_TABS = ["flags", "workers", "system", "audit", "knowledge", "usage", "maintenance"] as const;
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  validateSearch: optional((s) => ({ tab: oneOf(s.tab, ADMIN_TABS) })),
  component: AdminPage,
});

export const SETTINGS_TABS = ["profile", "appearance", "shortcuts", "flags", "notifications", "data"] as const;
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  validateSearch: optional((s) => ({ tab: oneOf(s.tab, SETTINGS_TABS) })),
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  sessionsRoute,
  sessionRoute,
  boardsRoute,
  outputsRoute,
  libraryRoute,
  providersRoute,
  adminRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: false, scrollRestoration: true });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export { Outlet };
