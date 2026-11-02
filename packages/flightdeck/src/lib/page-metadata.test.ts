import { describe, expect, it } from "vitest";
import indexHtml from "../../index.html?raw";
import routerSource from "../router.tsx?raw";
import robots from "../../public/robots.txt?raw";
import { ACTIVITY_LABELS, ADMIN_LABELS, deploymentOrigin, METADATA_PATHS, NO_INDEX, pageMetadata, publicOrigin, SESSION_LABELS, SETTINGS_LABELS, SITE_TITLE, staticMetadata } from "./page-metadata";

function routeEnum(name: string) {
  const block = routerSource.match(new RegExp(`export const ${name} = \\[([^\\]]+)\\] as const`));
  if (!block) throw new Error(`Missing router enum ${name}`);
  return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

describe("metadata route coverage and privacy", () => {
  it("covers every declared route and the fallback, so a new route requires a metadata decision", () => {
    const declared = [...routerSource.matchAll(/path:\s*"([^"]+)"/g)].map((match) => match[1]).sort();
    expect([...METADATA_PATHS].filter((path) => path !== "*").sort()).toEqual(declared);
    for (const [name, labels] of [["SESSION_VIEWS", SESSION_LABELS], ["ACTIVITY_TABS", ACTIVITY_LABELS], ["ADMIN_TABS", ADMIN_LABELS], ["SETTINGS_TABS", SETTINGS_LABELS]] as const) {
      expect(Object.keys(labels).sort(), name).toEqual(routeEnum(name).sort());
    }
  });
  it("matches the rendered defaults and legacy aliases", () => {
    const cases = [["/", "", "Overview"], ["/projects", "", "Projects"], ["/sessions", "", "Projects"], ["/s/private-id", "", "Chat · Session"], ["/s/private-id", "view=activity&activity=nodes", "Details · Session"], ["/boards", "board=fleet", "Fleet · Boards"], ["/outputs", "tab=files", "Files · Outputs"], ["/library", "tab=apps", "Agents · Library"], ["/library", "tab=packages", "Packages · Library"], ["/providers", "tab=copilot", "Providers · Models & spend"], ["/admin", "", "Overview · Admin"], ["/settings", "", "Appearance · Settings"], ["/missing", "", "Page not found"], ["/index.html", "", "Page not found"]];
    for (const [path, query, title] of cases) expect(pageMetadata(path, query).title).toBe(`${title} · ${SITE_TITLE}`);
  });
  it("never copies private route/query values into titles or descriptions", () => {
    const secret = 'PRIVATE-<script>token&name="Alice"';
    const query = new URLSearchParams({ q: secret, project: secret, provider: secret, board: secret, file: secret, token: secret, tab: secret, view: secret, activity: secret }).toString();
    for (const path of METADATA_PATHS) {
      const result = pageMetadata(path.replace("$sessionId", secret), query);
      expect(JSON.stringify(result)).not.toContain("PRIVATE");
      expect(JSON.stringify(result)).not.toContain("Alice");
    }
    for (const view of Object.keys(SESSION_LABELS)) expect(pageMetadata("/s/PRIVATE", `view=${view}&file=PRIVATE`).title).not.toContain("PRIVATE");
  });
});

describe("crawler-visible metadata", () => {
  it("ships the complete generic no-index block in source HTML, without JavaScript", () => {
    const block = indexHtml.split("<!-- site-metadata:start -->")[1].split("<!-- site-metadata:end -->")[0].trim();
    expect(block).toBe(staticMetadata());
    expect(block).toContain(`name="robots" content="${NO_INDEX}"`);
    expect(block).toContain('name="twitter:card" content="summary_large_image"');
    expect(block).not.toContain('rel="canonical"');
    expect(block).not.toContain("application/ld+json");
  });
  it("makes social URLs absolute only from an explicit safe public origin", () => {
    const html = staticMetadata("https://preview.example.test/");
    expect(html).toContain('property="og:url" content="https://preview.example.test/"');
    expect(html).toContain('property="og:image" content="https://preview.example.test/social/og-default.png"');
    expect(html).toContain('name="twitter:image" content="https://preview.example.test/social/twitter-card.png"');
    expect(staticMetadata()).not.toContain('property="og:url"');
  });
  it("rejects origins containing private URL details or non-HTTPS remote hosts", () => {
    for (const value of ["http://example.com", "https://user:secret@example.com", "https://example.com/private", "https://example.com/?token=secret", "https://example.com/#secret", "javascript:alert(1)", "//example.com"]) expect(() => publicOrigin(value)).toThrow();
    expect(publicOrigin("https://EXAMPLE.com:443/")).toBe("https://example.com");
    expect(publicOrigin("http://localhost:5180")).toBe("http://localhost:5180");
  });
  it("uses an explicit origin first, then the Vercel deployment hostname when supplied", () => {
    expect(deploymentOrigin({ VITE_PUBLIC_SITE_URL: "https://review.example.test", VERCEL_URL: "deployment.example.test" })).toBe("https://review.example.test");
    expect(deploymentOrigin({ VERCEL_URL: "deployment.example.test" })).toBe("https://deployment.example.test");
    expect(deploymentOrigin({})).toBeUndefined();
    expect(() => deploymentOrigin({ VERCEL_URL: "user:secret@deployment.example.test" })).toThrow();
  });
  it("lets compliant crawlers fetch noindex rather than hiding it behind a crawl block", () => {
    expect(robots).toMatch(/^Disallow:\s*$/m);
    expect(robots).not.toMatch(/^Disallow:\s*\//m);
    expect(robots).not.toMatch(/^Sitemap:/mi);
  });
});
