# Flight Deck

The PilotSwarm browser dashboard, redesigned around one question: what needs a person
right now. It is a separate app over the same Web API, so it runs beside the classic
portal and changes nothing in it.

**Status: preview.** It is exercised on demo data by the unit and end-to-end suites and
has not yet been run against a live backend (open items V5, V8, V9). What is built, what
is fixed and what is still to do:

- [CHANGELOG](../../CHANGELOG.md): what each change added and fixed.
- [OPEN-ITEMS.md](OPEN-ITEMS.md): everything not done, with the condition that closes it (unverified
  work, backend gaps to raise upstream, deferred features, process).
- [DESIGN.md](DESIGN.md) and [PRODUCT.md](PRODUCT.md): the visual system and the product brief.
- [docs/ux-audit](../../docs/ux-audit/README.md): dated audits, decisions and evidence
  ([30 October](../../docs/ux-audit/2026-10-30/README.md),
  [1 November](../../docs/ux-audit/2026-11-01/README.md)).

Checks: `npm run build` (types, token guard, production bundle, demo-hook and metadata
guards), `npm test` (unit and component tests) and `npm run test:e2e` (Playwright). From the
repo root: `npm run build:flightdeck`, `test:flightdeck`, `test:flightdeck:e2e`.

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

Everything the classic portal does has a Flight Deck screen.

- **Shell.** A sidebar (page links; then Needs you, Pinned, Projects, No project and Recents, all folded at
  load), an account menu, a phone drawer and tab bar, ⌘K with page actions, `?` for shortcuts, connection status.
- **Overview.** A start box (with a project picker), Needs you (inline answers, failure groups), Canvases, Outputs,
  and what is running or coming next.
- **Projects** (`/projects`). One page for projects and their sessions: search finds either, filters narrow the
  sessions, projects are created, renamed, pinned and deleted here. A project is the backend's session group:
  private to the person, one per root tree. Sessions in none are shown as **No project**. `/sessions` redirects here.
- **Session.** Chat (attachments, steer, queue, stop, Share, Move to project, model, schedule actions), Context,
  Canvas (with a public-link sheet), Files (outputs and working folders: edit, search, git changes), Delegation,
  Activity; the working-folder dialog.
- **Boards and Fleet, Outputs, Library** (agents and package management), **Models & spend** (providers, limits,
  holds, defaults), **Admin** (overview, workers, system sessions, access, feature flags, knowledge, maintenance)
  and **Settings** (appearance, shortcuts, personal feature preferences, notifications).

Not here, because the Web API has no operation for it: browsing published canvas apps, pausing, resuming or firing
a schedule from outside a turn (Flight Deck asks the agent instead), and listing the directories inside a working-
folder location. Boards are stored in the browser. See the gap tables in [OPEN-ITEMS.md](OPEN-ITEMS.md).

Where the data lives: sessions, projects, outputs and settings come from the Web API. Pins, pinned projects and
dismissed failures are kept in the person's profile settings document (so they roam; open item S2 explains the
classic portal limit). What is opened in the sidebar lasts for the visit only.

## The composer footer

`components/session/composer-footer.tsx` renders what sits under the message box: the agent (fixed: a robot icon and its name, no chevron), the model chip and the working-folder chip (changeable), the context meter, and on phones a single
Session settings button. The model is chosen in `components/model-picker.tsx`, the only model picker in the
app; the rules for what a change sends (leave out untouched options, clear unsupported ones) live in
`lib/model-options.ts` and are unit-tested. `DataSource.setSessionModel(id, model, { reasoningEffort?,
contextTier? })` maps to the `setSessionModel` operation; a key left out is preserved by the server.

## End-to-end tests

Playwright drives the real app on the demo data (no server, no database) in four projects: desktop
(1280x800) and phone (390x844), each in light and dark, plus one desktop-light run of the smoke spec with real
motion.

```bash
npm run test:e2e --workspace=pilotswarm-flightdeck            # everything (about 4 minutes)
npm run test:e2e --workspace=pilotswarm-flightdeck -- files   # one spec by name
npm run test:e2e:ui --workspace=pilotswarm-flightdeck         # the Playwright UI
```

It starts its own dev server on **5181**, so a dev server on 5180 can keep running. Browsers come from
the shared Playwright cache; install them once with `npx playwright install chromium` if missing.

What each spec covers: `files` (browse, edit, conflict, unsaved-changes guards, Changes, create, rename,
delete, upload), `knowledge` (typed confirms for purge, namespaces, prune, restart), `providers-hold`
(hold, allowance, limits, remove, add, paused work), `sharing` (Share sheet, Move to group, canvas public
link, working-folder conflict), `sidebar` and `sidebar-actions` (the sections and what they hold, the sidebar loading folded, pins, row and title
menus with call counts, keyboard roving, focus after a row moves, the phone drawer), `composer-turn` (Stop, Steer and Queue while a turn runs), `a11y-smoke` (axe, overflow, console errors and phone tap targets on every
route and tab).

Writing a spec:

- Start with `gotoDemo(page, path, info)`; it sets demo data and the project's theme once per browser context before load, so a test that changes the theme and reloads keeps what it chose. `e2e/theme.spec.ts` covers the theme control; a first-visit test removes the stored theme to exercise the System default.
- Assert outcomes and roles, not pixels. `shot(page, info, "state")` saves a picture to
  `e2e/__screenshots__/<project>/` for a person to look at; they are not compared and not committed.
- Use `Sheet.open(page, opener, name)` for dialogs and sheets: it checks the label, that focus moved in,
  and (`expectEscapeReturnsFocusTo`) that Escape closes it and returns focus. `expectNoSeriousAxe(page, scope)`
  fails on serious or critical axe violations.
- The phone project hides some header controls in the session menu; check `isPhone(info)`.
- The sidebar loads folded. `sidebar(page, info)` (`e2e/sidebar-helpers.ts`) opens every section so a test can reach
  rows; pass `{ folded: true }` to test the folded state. Demo pins live in memory, so they survive navigation, not a reload.
- To play "someone else changed it", use the dev-only demo hook `window.__fdDemo.workspace`
  (`writeBehind(folder, path, text)` and `bumpRevision({ folder })`, defined in
  `src/data/ops/workspace.demo.ts`). It does not exist in production builds. Add a similar hook beside the
  demo fixtures of another area when a spec needs one.
- Demo state lives in module memory, so every test starts from the same fixtures.
- **Count what was sent, not just what is shown.** The demo operations delete nothing, so a destructive
  confirm that ran early would still look right on screen. The dev-only hook records every operation the demo
  registry answers: `demoCalls(page, "restartSystemSession")` returns `[{ op, params }]`. Assert zero calls
  before a confirmation and after Cancel, and exactly one, with the right parameters, after it.
- **The hook exists only for the demo source on the dev server.** `window.__fdDemo` is installed when the
  demo source starts and deleted when the live source starts (`src/data/ops/demo-hook.ts`); a spec
  (`demo-hook.spec.ts`) checks that `?data=live` has none, and `npm run build` ends with
  `scripts/check-dist.mjs`, which fails if the production bundle contains `__fdDemo`, `writeBehind`,
  `bumpRevision` or `clearCalls` (`npm run test:dist`; its own tests are `scripts/check-dist.test.mjs`).
  Register a new area's helpers with `extendDemoHook(area, {...})` inside an `if (import.meta.env.DEV)` block.
- **Hostile and oversized documents.** `window.__fdDemo.artifacts.publish(sessionId, { filename, content, size })`
  puts a document into a session as its newest output (`size: null` means the size is unknown, so the bounded read
  decides); then `invalidate(["artifacts"])` re-reads. `artifact-preview.spec.ts` uses it to run a hostile canvas (image
  map, form, meta refresh, `@import`, frames, links) through the real sanitiser and the sandboxed frames, and asserts
  that nothing navigates and no request leaves, and that a document over the preview limits is never downloaded.
  Playwright's own locators log "Blocked script execution" inside a sandboxed frame: filter that message, nothing else.
- **A read that fails.** `window.__fdDemo.failOps(["listFlags"])` makes a typed demo read reject until
  `clearFailures()`; `admin-overview.spec.ts` uses it to check the page says "unavailable" and offers Retry.
- **Layout shift.** `layout-shift.spec.ts` runs only in the `desktop-light-motion` project (real motion) and fails when
  Home or Fleet shifts by 0.01 or more after arriving.
- **Undo while a sheet is open lives in the sheet.** A modal traps focus, so a toast outside it cannot be
  reached by keyboard. Call `notifyUndo(message, onUndo)` (`src/lib/undo.tsx`) instead of `toast` for any Undo:
  with a modal open it renders in the dialog's status region (Tab-reachable, 8 seconds, paused on hover or
  focus), otherwise it is a normal toast, never both. Specs find it with
  `sheet.dialog.getByRole("status").getByRole("button", { name: "Undo" })`.
- **Real motion.** The default projects run with `reducedMotion: "reduce"` so tests are deterministic.
  `desktop-light-motion` runs only `a11y-smoke.spec.ts` with real motion, waiting for animations to finish on
  their own, so layout shifts and animation overlaps show up. Do not raise timeouts to hide slow tests; read
  the slowest list in the run output instead.

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
  `useIntent("name", "/its/pathname", handler)` (`src/shell/intents.ts`); the palette
  navigates and requests the intent for that exact pathname (a session action
  names `/s/<id>`), so no other screen can take it. One intent is pending at a
  time and it expires after two seconds.
- **State that must survive navigation** (unsaved file edits, upload plans,
  package adoption) lives in small module stores (`session/files/drafts.ts`,
  `data/ops/adoption.ts`) with explicit expiry, not in component state.
- **Tests.** `npm test` runs vitest (pure functions, wrappers, a tiny
  `react-reconciler` renderer for hooks and editors) and node:test for the
  access/composer helpers.

## Operations Flight Deck uses

| Area | Web API operations |
|---|---|
| Sessions | listSessions, getSession, getSessionEventsBefore, sendMessage, sendAnswer (strict: requireQuestionMatch), stopSessionTurn, steerSessionTurn, createSession, createSessionForAgent, renameSession, completeSession, cancelSession, deleteSession, setSessionModel, exportExecutionHistory |
| Sharing and groups | getSessionAccess, setSessionVisibility, grantSessionShare, revokeSessionShare, listSessionShares, listKnownUsers, listSessionGroups, createSessionGroup, placeSessionsInGroup |
| Files | listArtifacts, downloadArtifact, uploadArtifact, deleteArtifact, getSessionWorkspace, setSessionWorkspace, retrySessionWorkspace, listSessionWorkspaceFolders, sessionWorkspaceFiles |
| Canvas | getCanvasLive, readCanvasKv, setCanvasKvAccess, getCanvasShareLink, resetCanvasShareLink, removeCanvasShareLink |
| Providers and spend | listProviders, getProviderUsageGrid, getProviderUsage, getModelsByProvider, listModels, createMyProvider, createProvider, updateSharedProviderCredential, updateMyProviderCredential, deleteProvider, deleteMyProvider, clearProviderRoutingDependencies, setProviderLimit, removeProviderLimit, setProviderAllowance, setProviderHold, getModelDefaults, setModelDefault, setMyDefault, setSystemModelDefault, setSystemSessionModel, clearSystemSessionModel, listPausedSessions |
| Library | listCreatableAgents, listAgentPackages, getAgentPackage, getAgentPackageTree, getAgentPackageFile, uploadAgentPackage, setAgentPackageScope, setAgentPackageEnabled, pinAgentPackageVersion, deleteAgentPackage, grantAgentPackageEditor, revokeAgentPackageEditor, listAgentPackageEditors, republishAgentPackageVersion, listAgentWorkerState (plus the authenticated `GET /agent-packages/:name/download` route for Download package) |
| Admin | listWorkers, getFleetStats, listAuthzAudit, listFeatureFlags, getClusterFeatureFlags, setClusterFeatureFlag, resetClusterFeatureFlag, listFeatureFlagChanges, listFeatureFlagUsers, getUserFeatureFlags, setUserFeatureFlag, unsetUserFeatureFlag, restartSystemSession, pruneDeletedSummaries, factsCapabilities, getSharedFactsStats, getFactsTombstoneStats, getEmbedderStatus, startFactsEmbedder, stopFactsEmbedder, forcePurgeFacts, searchFacts, listGraphNamespaces, upsertGraphNamespace, deleteGraphNamespace, graphStats |
| Settings | getCurrentUserProfile, getMyFeatureFlags, setMyFeatureFlag, unsetMyFeatureFlag |
