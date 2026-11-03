# Metadata, no-index and brand assets

Scope: the Flight Deck frontend, including every router path and its tab/view
variants. This does not change the classic portal, public canvas host or SDK.
Requirements: prevent search indexing, professional browser/social metadata,
complete PilotSwarm brand exports, industry-standard directories, no missed pages.
Microsoft corporate branding and endorsement claims remain excluded.

## Delivery tracker

- [x] Shared no-index policy in initial HTML, before JavaScript.
- [x] HTTP no-index headers for local dev/preview and static hosting adapters.
- [x] robots.txt permits fetching the no-index directive; no indexable sitemap.
- [x] Generic, privacy-safe OG and X/Twitter cards, including image dimensions/alt.
- [x] Route-aware titles/descriptions with one owner for the attention count.
- [x] SVG/ICO/PNG favicons, Apple touch icon, normal and maskable app icons.
- [x] Web manifest, pinned-tab mark and theme-color handling.
- [x] Editable brand masters, logo variants, social exports, font license/provenance.
- [x] Route/tab coverage regression tests, build-output asset/metadata guard.
- [x] Browser navigation, source tests, build and independent metadata inspection.
- [x] Staged privacy scan and whitespace checks.
- [ ] Hosted origin, crawler-visible deployed responses and live social unfurls (deployment pending; open item Q11).

## Page inventory

| Surface | Variants requiring inherited policy | Status |
| --- | --- | --- |
| `/` | Empty, populated, loading and read failure | Shared policy + route tests; raw HTTP verified |
| `/projects` | Search; owner/state/project filters | Shared policy + route tests; raw HTTP verified |
| `/sessions` | Legacy redirect with preserved filters | Shared policy + route tests; raw HTTP verified |
| `/s/<id>` | Chat, Context, Canvas, Files, Delegation, Activity | Shared policy + route tests; raw HTTP verified |
| Session Canvas | Slots 1–5; focus; sharing dialog | Shared policy + route tests; raw HTTP verified |
| Session Files | Outputs/Folders; selected file; Changes | Shared policy + route tests; raw HTTP verified |
| Session Activity | Timeline, Logs, Details aliases: nodes/history/stats | Shared policy + route tests; raw HTTP verified |
| `/boards` | Named board, Fleet, focused chat/canvas tiles | Shared policy + route tests; raw HTTP verified |
| `/outputs` | Canvases, Files, search misses, read errors | Shared policy + route tests; raw HTTP verified |
| `/library` | Agents, Packages, legacy Apps alias; package panels | Shared policy + route tests; raw HTTP verified |
| `/providers` | Providers, Defaults, provider drawers, legacy Copilot flow | Shared policy + route tests; raw HTTP verified |
| `/admin` | Overview, flags, workers, system, audit, knowledge, usage, maintenance; denied state | Shared policy + route tests; raw HTTP verified |
| `/settings` | Appearance default, profile, shortcuts, flags, notifications, data | Shared policy + route tests; raw HTTP verified |
| Unknown paths; `/index.html` | Safe fallback, before/after JavaScript | Shared policy + route tests; raw HTTP verified |
| Global overlays | New session, search, shortcuts, project/session actions | Inherits page policy; source coverage, no separate overlay crawl |

No private session/project/board names, filenames, provider/package selections,
search text, user identities or canvas tokens may enter social metadata or a
canonical URL. Page labels come only from an explicit allowlist.


## Implementation and evidence

- Initial HTML carries `noindex, nofollow, nosnippet, noimageindex` in both robots
  and googlebot tags. JavaScript is not required to discover these directives.
- Local Vite dev/preview and the static-host adapters emit the matching
  `X-Robots-Tag`. Existing sandbox-related CSP and DNS headers are preserved.
- `robots.txt` intentionally has an empty `Disallow:`: crawlers must be able to
  fetch pages to see noindex. There is no sitemap, canonical link, public
  organization schema or JSON-LD for this private workspace.
- Social metadata and cards are product-level and static. Browser tab titles and
  descriptions use allowlisted route/view names. Session names, IDs, search
  queries and selections never become metadata. The existing attention prefix
  remains in the browser tab only.
- Standard platform exports, editable masters, font license, regeneration script
  and asset hashes are documented in the [brand guide](../../../../assets/brand/README.md).
- Targeted Vitest run: **3 files, 13 tests passed** (route/tab inventory, private
  values/origins, route title lifecycle, existing theme preference behavior).
- `npm run build --workspace=pilotswarm-flightdeck` passed TypeScript, token guard,
  production compilation, dist-hook guard and new metadata/34-asset hash guard.
  Existing large-chunk advisory remains; this work does not claim bundle tuning.
- [Dev HTTP evidence](http-dev.json) and [built-preview evidence](http-preview.json)
  each cover 12 page URLs and 8 static resources: successful responses, noindex
  headers and raw HTML metadata; asset responses are not SPA fallback HTML.
- [Browser head evidence](browser-head.json) covers Overview → Library → Back →
  Forward → Packages, keeping the same attention count. Titles/descriptions
  update; one title element and generic social metadata remain. The temporary
  test tab and built-preview process were closed; the user's tab/server remain.
- Independent metadata reviewer found a Vite env-file loading issue; resolved
  with `loadEnv` in the config callback, preserving shell environment precedence.
  No material privacy/title/route/noindex issue found in that scoped inspection.
  This is source review, not deployed crawler or live social-network acceptance.
- Independent Impeccable finish reviewer: **ship** for the contact sheet, both
  OG cards, sampled 16/32px and maskable icons, and brand documentation. No
  material visual defect found. Platform installation and live social cropping
  were outside that visual review.
- Final staged privacy scan: **2,713 indexed files, 0 findings**. Staged
  whitespace check passed. The original font license's trailing whitespace was
  normalized; license wording was preserved.
- A commit-time review run at the time produced no signoff (the review tool was not logged in). The work was
  committed later and the whole change was reviewed by a second model; see the [1 November record](../README.md).

Route-table entries describe inherited policy and coverage tests, not an assertion
that every loading/error/modal variant was separately exercised in a browser.
The build covers the current shared worktree, including other agents' work.

## Hosting configuration and limits

Set `VITE_PUBLIC_SITE_URL` to the final HTTPS **origin only** (no path, query,
credentials or fragment), through hosting environment settings or the frontend's
normal Vite env files. Host-injected values take precedence. Vercel's `VERCEL_URL`
is a fallback when the explicit setting is absent. The build qualifies social
image URLs and `og:url` from this trusted origin; it never derives them from
workspace paths. Without an origin, local assets still work and a build warning
records that absolute social URLs remain unconfigured. No placeholder public
hostname is shipped.

The root `vercel.json` assumes the repository root as the project directory and
builds `pilotswarm-flightdeck` to `packages/flightdeck/dist`. `public/_headers`
and `_redirects` provide the corresponding Netlify/Cloudflare Pages-style static
rules. The hosting platform must actually honor its adapter; verify deployed
responses before sharing. Preserve these headers when integrating another host.

These are **static/demo preview adapters**. They do not provision authentication,
route `/api` to a production service, or establish live SDK connectivity. The
existing same-origin live frontend requires a separately configured API host
route. The classic portal, public canvas host, API/SDK and managed deployments
are unchanged. Noindex is a search directive, not access control.

Still open before a hosted release: select/configure the deployment origin;
verify deep-link, asset, robots and HTTP-header behavior on that deployment;
verify OG/X image fetches and link unfurls (deployment protection can prevent
those fetches). No deployment or public sharing was performed in this task.
