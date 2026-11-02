/** Public metadata is an allowlist. Never interpolate workspace records or URL values. */
export const SITE_NAME = "PilotSwarm";
export const SITE_TITLE = "PilotSwarm · Flight Deck";
export const SITE_DESCRIPTION = "A web workspace for durable agent sessions, projects, canvases and outputs. Explore the proposed PilotSwarm web experience.";
export const NO_INDEX = "noindex, nofollow, nosnippet, noimageindex";
export const THEME_COLORS = { light: "#f6f7f8", dark: "#0e0f11" } as const; // token-ok: browser chrome metadata requires literal colors before CSS loads
export const SOCIAL_ALT = "PilotSwarm swarm mark with the words Your agent workspace and Flight Deck web experience preview.";
export const METADATA_PATHS = ["/", "/projects", "/sessions", "/s/$sessionId", "/boards", "/outputs", "/library", "/providers", "/admin", "/settings", "*"] as const;

export const SESSION_LABELS = { chat: "Chat", context: "Context", canvas: "Canvas", files: "Files", delegation: "Delegation", activity: "Activity" } as const;
export const ACTIVITY_LABELS = { timeline: "Timeline", logs: "Logs", nodes: "Details", history: "Details", stats: "Details" } as const;
export const ADMIN_LABELS = { flags: "Feature flags", workers: "Workers", system: "System sessions", audit: "Access & audit", knowledge: "Knowledge", usage: "Cluster usage", maintenance: "Maintenance" } as const;
export const SETTINGS_LABELS = { profile: "Profile", appearance: "Appearance", shortcuts: "Keyboard shortcuts", flags: "Feature flags", notifications: "Notifications", data: "Data source" } as const;

const label = (values: Record<string, string>, key: string | null, fallback: string) => key && Object.hasOwn(values, key) ? values[key] : fallback;
export function pageMetadata(pathname: string, search = ""): { title: string; description: string } {
  const query = new URLSearchParams(search);
  const path = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  let title: string;
  let description: string;
  if (path === "/") { title = "Overview"; description = "Review decisions, follow ongoing agent work and open recent outputs in your PilotSwarm workspace."; }
  else if (path === "/projects" || path === "/sessions") { title = "Projects"; description = "Organize projects and find accessible agent sessions in PilotSwarm."; }
  else if (/^\/s\/[^/]+$/.test(path)) {
    const view = label(SESSION_LABELS, query.get("view"), "Chat");
    const detail = view === "Activity" ? label(ACTIVITY_LABELS, query.get("activity"), "Timeline") : view;
    title = `${detail} · Session`;
    description = "Follow an agent session, review its context and inspect the work it produces in PilotSwarm.";
  }
  else if (path === "/boards") { title = query.get("board") === "fleet" ? "Fleet · Boards" : "Boards"; description = "Follow selected agent chats and canvases together in your PilotSwarm workspace."; }
  else if (path === "/outputs") { title = query.get("tab") === "files" ? "Files · Outputs" : "Canvases · Outputs"; description = "Find published canvases and files from accessible PilotSwarm sessions."; }
  else if (path === "/library") { title = query.get("tab") === "packages" ? "Packages · Library" : "Agents · Library"; description = "Explore available agents and manage the packages that supply their capabilities in PilotSwarm."; }
  else if (path === "/providers") { title = query.get("tab") === "defaults" ? "Default models · Models & spend" : "Providers · Models & spend"; description = "Manage model providers, defaults and usage limits in your PilotSwarm workspace."; }
  else if (path === "/admin") { title = `${label(ADMIN_LABELS, query.get("tab"), "Overview")} · Admin`; description = "Review PilotSwarm deployment administration, workers, feature policies and maintenance."; }
  else if (path === "/settings") { title = `${label(SETTINGS_LABELS, query.get("tab"), "Appearance")} · Settings`; description = "Manage your PilotSwarm appearance, preferences, notifications and data source."; }
  else { title = "Page not found"; description = "This address is not a page in the PilotSwarm web workspace."; }
  return { title: `${title} · ${SITE_TITLE}`, description };
}

/** Explicit deployment origin only: never copy paths, credentials or query tokens. */
export function publicOrigin(value?: string): string | undefined {
  if (!value) return undefined;
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("VITE_PUBLIC_SITE_URL must be an HTTPS origin without credentials, path, query or fragment (HTTP is allowed only for local previews).");
  return url.origin;
}

/** Host-specific discovery stays at the frontend build boundary, not the SDK. */
export function deploymentOrigin(environment: Record<string, string | undefined>): string | undefined {
  return publicOrigin(environment.VITE_PUBLIC_SITE_URL || (environment.VERCEL_URL ? `https://${environment.VERCEL_URL}` : undefined));
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function staticMetadata(origin?: string): string {
  const base = publicOrigin(origin);
  const absolute = (path: string) => base ? `${base}${path}` : path;
  const entries: Array<[string, string, string]> = [
    ["name", "description", SITE_DESCRIPTION], ["name", "robots", NO_INDEX], ["name", "googlebot", NO_INDEX],
    ["name", "application-name", SITE_NAME], ["name", "apple-mobile-web-app-title", SITE_NAME],
    ["name", "theme-color", THEME_COLORS.light], ["name", "referrer", "strict-origin-when-cross-origin"],
    ["property", "og:type", "website"], ["property", "og:site_name", SITE_NAME], ["property", "og:locale", "en_US"],
    ["property", "og:title", SITE_TITLE], ["property", "og:description", SITE_DESCRIPTION],
    ["property", "og:image", absolute("/social/og-default.png")], ["property", "og:image:type", "image/png"],
    ["property", "og:image:width", "1200"], ["property", "og:image:height", "630"], ["property", "og:image:alt", SOCIAL_ALT],
    ["name", "twitter:card", "summary_large_image"], ["name", "twitter:title", SITE_TITLE], ["name", "twitter:description", SITE_DESCRIPTION],
    ["name", "twitter:image", absolute("/social/twitter-card.png")], ["name", "twitter:image:alt", SOCIAL_ALT],
  ];
  if (base) entries.push(["property", "og:url", `${base}/`]);
  return [`<title>${SITE_TITLE}</title>`, ...entries.map(([attribute, key, content]) => `<meta ${attribute}="${key}" content="${escape(content)}" />`),
    '<link rel="icon" href="/favicon.ico" sizes="any" />', '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
    '<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />',
    '<link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />',
    '<link rel="mask-icon" href="/safari-pinned-tab.svg" color="#315fcb" />', '<link rel="manifest" href="/site.webmanifest" />'].join("\n    "); // token-ok: Safari pinned-tab metadata requires a literal brand color
}
