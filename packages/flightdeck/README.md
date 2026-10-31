# Flight Deck (portal redesign preview)

The [30 October UX audit](../../docs/ux-audit/2026-10-30/README.md) records the
current attention-first workspace, frontend interaction fixes, accepted desktop
and phone captures, and remaining API/SDK integration work. Run `npm run test:ux`
in this package for the credential-free ownership, access, bulk-result and
session-draft regression tests. `npm run build` checks TypeScript, tokens and
the production bundle. Earlier measurements and signoff below describe the
initial implementation; use the dated audit for this refresh's evidence.

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

## What is in

Everything the classic portal does has a Flight Deck screen. App shell (labeled
rail, phone tab bar, ⌘K with page actions, `?` shortcuts, connection status),
Home (inline answers, failure groups, since-you-left), Sessions, Session (Chat
with attachments, Share, Move to group, Switch model, schedule actions; Canvas
with a public-link sheet; Files over outputs and working folders with edit,
search and git changes; Delegation; Activity), New session, Boards and Fleet,
Outputs, Agent library (agents and package management), Models & spend
(providers, limits, holds, defaults), Admin (overview, workers, system
sessions, access, feature flags, knowledge, maintenance) and Settings
(appearance, shortcuts, personal feature preferences, notifications).

Not here, because the Web API has no operation for it: browsing published
canvas apps, and pausing, resuming or firing a schedule from outside a turn
(Flight Deck asks the agent instead). Boards are stored in the browser.

## Extending Flight Deck

- **Tokens first.** Components read the semantic tokens in `src/styles.css` and
  nothing else; `npm run tokens:check` (also part of `build`) enforces it. See
  `DESIGN.md`.
- **Reuse the primitives.** `Card`/`Panel` for any boxed surface, `Tag`,
  `StatePill`, `Button` (two heights), `DisclosureButton`, `RadioCards` (one
  choice among a few explained options), `Field` (label, hint, error),
  `ConfirmDialog` (state the consequence; typed confirmation for removals that
  cannot be undone), `Dialog` with `side="right"` for sheets.
- **Any Web API operation.** `source.call(op, params)` reaches the API in live
  mode. Wrap an area's operations in `src/data/ops/<area>.ts` with
  `useOpQuery` / `useOpMutation` (`use-op.ts`): they own cache keys, invalidation
  and failure toasts. Read the wire shape in `contracts.ts`-style pure
  normalisers, so a test can pin it.
- **Demo data.** Each area registers its fixtures in
  `src/data/ops/<area>.demo.ts` with `registerDemoOps(import.meta.url, {...})`.
  `index.ts` loads every `*.demo.ts`; one file owns each operation (a second
  claim throws in development). Fixtures must return the real wire shapes.
- **Page actions from ⌘K.** A page that owns an action calls
  `useIntent("name", handler)` (`src/shell/intents.ts`); the palette navigates
  and requests the intent.
- **State that must survive navigation** (unsaved file edits, upload plans,
  package adoption) lives in small module stores (`session/files/drafts.ts`,
  `data/ops/adoption.ts`) with explicit expiry, not in component state.
- **Tests.** `npm test` runs vitest (pure functions, wrappers, a tiny
  `react-reconciler` renderer for hooks and editors) and node:test for the
  access/composer helpers.

## Operations Flight Deck uses

| Area | Web API operations |
|---|---|
| Sessions | listSessions, getSession, getSessionEventsBefore, sendMessage, sendAnswer (strict: requireQuestionMatch), stopSessionTurn, steerSessionTurn, createSession(ForAgent), renameSession, completeSession, cancelSession, deleteSession, setSessionModel, exportExecutionHistory |
| Sharing and groups | getSessionAccess, setSessionVisibility, grantSessionShare, revokeSessionShare, listSessionShares, listKnownUsers, listSessionGroups, createSessionGroup, placeSessionsInGroup |
| Files | listArtifacts, downloadArtifact, uploadArtifact, deleteArtifact, getSessionWorkspace, setSessionWorkspace, retrySessionWorkspace, listSessionWorkspaceFolders, sessionWorkspaceFiles |
| Canvas | getCanvasLive, readCanvasKv, setCanvasKvAccess, getCanvasShareLink, resetCanvasShareLink, removeCanvasShareLink |
| Providers and spend | listProviders, getProviderUsageGrid, getProviderUsage, getModelsByProvider, listModels, createMyProvider, createProvider, update*ProviderCredential, delete*Provider, clearProviderRoutingDependencies, setProviderLimit, removeProviderLimit, setProviderAllowance, setProviderHold, getModelDefaults, setModelDefault, setMyDefault, setSystemModelDefault, setSystemSessionModel, clearSystemSessionModel, listPausedSessions |
| Library | listCreatableAgents, listAgentPackages, getAgentPackage(Tree/File), uploadAgentPackage, setAgentPackageScope, setAgentPackageEnabled, pinAgentPackageVersion, deleteAgentPackage, grant/revoke/listAgentPackageEditors, republishAgentPackageVersion, listAgentWorkerState |
| Admin | listWorkers, getFleetStats, listAuthzAudit, listFeatureFlags, getClusterFeatureFlags, setClusterFeatureFlag, resetClusterFeatureFlag, listFeatureFlagChanges, listFeatureFlagUsers, get/set/unsetUserFeatureFlag, restartSystemSession, pruneDeletedSummaries, factsCapabilities, getSharedFactsStats, getFactsTombstoneStats, get/start/stopEmbedder, forcePurgeFacts, searchFacts, list/upsert/deleteGraphNamespace, graphStats |
| Settings | getCurrentUserProfile, getMyFeatureFlags, setMyFeatureFlag, unsetMyFeatureFlag |
