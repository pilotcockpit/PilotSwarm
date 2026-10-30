# Flight Deck (portal redesign preview)

A separate, side-by-side build of the proposed PilotSwarm portal redesign
([docs/proposals/ux-redesign](../../docs/proposals/ux-redesign/README.md)),
so it can be compared with the current portal without touching it. Nothing in
`packages/app` imports this package, and this package changes nothing there.

| | Classic portal | Flight Deck |
|---|---|---|
| URL | http://localhost:3001 (built) or :5173 (`web:dev`) | **http://localhost:5180** |
| Code | `packages/app/web`, `packages/app/ui/react` | `packages/flightdeck` |
| Data | Web API `/api/v1` on :3001 | the same Web API, proxied by this dev server |

## Run it

```bash
npm run portal:start -- --no-auth          # the classic portal server and Web API on :3001
npm run dev --workspace=pilotswarm-flightdeck   # Flight Deck on :5180
```

Set `PILOTSWARM_API_TARGET` to point the proxy at another server, and
`VITE_CLASSIC_URL` to change where "Open in classic portal" links go.

**Live or demo data.** Flight Deck reads the live Web API by default. When the
deployment has little to show (for example a local worker without model
credentials), switch to demo data from the rail footer, Settings → Data source,
⌘K "Use demo data", or by adding `?data=demo` to any URL. Demo data is
fixtures shaped like the API payloads; nothing is sent anywhere.

## Stack

React 19 · Vite 8 · TypeScript (strict) · Tailwind CSS v4 (CSS-variable tokens
through `@theme inline`) · shadcn-style components on Radix primitives
(`src/components/ui`, owned in this repo, not a dependency) · TanStack Router
(every view is a URL) · TanStack Query · cmdk · Sonner · Lucide ·
react-resizable-panels · Recursive variable font, self-hosted.

Shared domain code is reused, not copied: the SDK's `ApiClient`, the
framework-free `ui/core` event→transcript projection (`history.js`) and budget
pause rules (`state.js`), and the canvas sandbox policy
(`ui/react/src/sandboxed-document.js`) so both hosts run agent pages under one
policy. The 12k-line controller and the terminal-shaped selectors are not used.

## Did Tailwind and shadcn-style primitives help?

Yes, measured on this build:

- **Stylesheet:** 46 KB (9.7 KB gzipped) for every screen here, against the
  classic portal's 261 KB (42.8 KB gzipped) from an 11k-line `index.css`.
  The classic portal covers more features, but the gap is mostly
  hand-written CSS that Tailwind generates only when a class is used.
- **Tokens:** `@theme inline` over CSS variables gives the design system's two
  tiers directly. Light and dark are one variable swap. A11y fixes for contrast
  and touch targets were token edits, not hunts through selectors.
- **Primitives:** Radix (via shadcn-style components we own in
  `src/components/ui`) gave dialogs, menus, focus traps and focus return that
  the classic portal hand-rolls. No shadcn default look leaked through.
- **Costs seen in review:** utility-layout bugs are easy to miss (the
  palette input shrank in a flex column), class strings get copied between
  files, and rules inside `@layer` lose to utilities. A screenshot suite per
  route and a lint rule against raw hex and arbitrary values would catch these.
- **What Radix lacks:** a keyboard tree and grid. React Aria Components would
  fill that for the Sessions tree, Files tree and tables.

Design signoff (three independent reviews, four rounds): Impeccable finish
review **sign off**, design-taste-frontend **sign off**, craft-ux +
accessibility **sign off with changes** (no WCAG 2.2 AA failures; the
remaining items were touch targets, since closed, and the view-only composer
state, unverified because no demo session is view-only).

## What is in, what links back

In: app shell (labeled rail, phone tab bar, ⌘K, `?` shortcuts, connection and
data-source status), Home, Sessions (filters, tree, select + bulk actions),
Session (header with state pill and reason, schedule popover, Share, ⋯ menu
with cascade notes; Chat with tool-call blocks, spawn blocks, question cards,
structured errors, Stop · Steer · Queue; Canvas host with tabs, zoom, focus and
host-mediated links; Files → Outputs with preview; Delegation; Activity with
question shortcuts), New session sheet, Boards, Outputs, Agent library,
Providers (summary, table, detail with "not set up on workers"), Admin (flags,
workers, system sessions, audit, cluster usage), Settings (appearance, density,
shortcuts, data source).

Links to the classic portal (not ported yet): working-folder editing, file
attach, share/visibility changes, model switch, packages, provider and flag
writes, knowledge, maintenance, canvas share links, canvas live data plane
(Flight Deck re-reads a canvas when it changes instead of patching it live).
