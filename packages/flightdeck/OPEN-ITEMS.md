# Flight Deck: open items (the repo .gitignore excludes files named TODO.md)

Last updated 2026-11-01. This file lists what is **not done**, each with the condition that closes it. Mark an item
done by deleting it and recording it in the [CHANGELOG](../../CHANGELOG.md), not by leaving a checked box here.
Nothing here is a silent gap: if something was found and not fixed, it has an ID below.

| Where to look | What it answers |
|---|---|
| [CHANGELOG](../../CHANGELOG.md) | What was added and fixed, per change |
| [docs/ux-audit/2026-11-01](../../docs/ux-audit/2026-11-01/README.md) | Why: audits, decisions, evidence, what was found and fixed on the all-pages audit |
| Unverified (V) | Built and tested on demo data, not yet run against real infrastructure or by a person |
| Sessions sidebar (S, W) | Known limits of the projects and sidebar work and of the working-folder dialog |
| API and SDK gaps (G), classic portal (C) | Backend gaps to raise upstream, with today's workaround |
| Deferred features (D) | Decided against for now |
| Process and quality (Q) | Tests, CI, upstreaming, licensing |

## Unverified (built and reviewed, not yet run against real infrastructure)

Closed on demo data by the Playwright suite (`npm run test:e2e`, 4 projects: desktop and phone, light and dark):

| ID | What | Closed by |
|---|---|---|
| V1 | Files: edit, conflict resolution, Changes (git) view, upload, rename, delete, unsaved-changes guards | `e2e/files.spec.ts` |
| V2 | Admin > Knowledge purge, embedder Stop, namespace delete, Maintenance prune, system-session restart typed confirms | `e2e/knowledge.spec.ts` |
| V3 | Providers: hold dialog, allowance, exact-integer limits, remove, add (password key cleared), paused banner, defaults | `e2e/providers-hold.spec.ts` |
| V4 | Share sheet roles/undo/widening, view-only reasons, Move to project, canvas public link (shown once, rotate, remove), working-folder conflict | `e2e/sharing.spec.ts` |
| V6 | Automated accessibility: axe on every route, tab, sheet and confirm the specs open (also once with real motion, no reducedMotion); no sideways scroll; no console errors; phone tap targets under 24px fail; Undo reachable by keyboard inside open sheets | `e2e/a11y-smoke.spec.ts` (incl. `desktop-light-motion`), keyboard specs in `providers-hold`, `sharing`, `library` |
| V7 | Phone top bar: Share and session actions reachable from the session menu; the theme is in the More sheet | `e2e/sharing.spec.ts` (phone projects), `e2e/a11y-smoke.spec.ts` |

Still open:

| ID | What | Closes when |
|---|---|---|
| V8 | The composer on a live server: Steer (`steerSessionTurn`), Queue (a message sent mid-turn), Stop, the model change and the working-folder change, including a session that reports `acceptsTurnControl: false` | Each action run once against a dev server and the result compared with the demo |
| V9 | Roaming pins, pinned projects and dismissals on a live server: the profile settings write replaces the document (see S2, S3), and a server that cannot store settings must fall back to the browser with the sidebar saying so | A smoke run with two browsers on one account, and one run against a server with settings storage off |
| V10 | The first-run states: Overview, the sidebar and Projects with no sessions and no projects; the demo data always has sessions | A fixture with an empty account, checked on desktop and phone, in light and dark |
| V5 | Every new screen against a LIVE backend (real API shapes, real permissions, real latency) | A smoke run against a dev PilotSwarm server with a member and an admin account; each ported operation called once; failures filed |
| V6b | Assistive technology: a manual VoiceOver pass on Share, Add provider and the file editor; 200% zoom | A person does it once and files what they find; axe cannot judge announcement quality |

## Sessions sidebar (built 2026-11-01; design record in docs/proposals-impl/flightdeck-sessions-navigation.md)

No project: sessions in no project (or in one that was deleted) are shown as a derived **No project** group: its own sidebar section beside Projects (five rows, a link to the rest), and the last group on the Projects page. It is not stored, so it cannot be renamed or deleted; "Take out of its project" files a session there. It appears only once the person has made a project. (In code it is `DEFAULT_PROJECT_ID`.)

The Projects page (`/projects`) is the one page for projects and their sessions: search finds either, filters narrow the sessions, and projects are managed there. `/sessions` redirects to it with the same filters.

Naming: the product calls a backend session group a **Project** (private, one per root tree, nothing to do with the working folder). Code and API names keep `group`/`groupId`.

Built: shared derivation (`src/data/session-tree/`), Needs you / Pinned / Projects / No project / Recents, the sidebar loading folded, settled Recents order with "Refresh order", roaming pins and dismissals, one attention count for the sidebar, Overview, nav badge, tab title and the Projects page (`state=attention`, `project=`). The all-pages audit (2026-11-01) and the Codex review of the staged change are recorded in the 2026-11-01 folder; everything they found and could fix was fixed, and the rest is below.

| ID | What | Closes when |
|---|---|---|
| S1 | Projects can be created, renamed and deleted on the Projects page. Still missing: a description and a manual order (the backend keeps both: `description` and group `metadata`) | The page offers them |
| S2 | Dismissals and pinned projects live under a `flightdeck` key in the profile settings. The classic portal replaces the whole document from its own state, so its next save erases that key (session pins use the classic `pinnedSessionIds` key and survive). A dismissed failure reappears and a pinned project has to be pinned again | The classic portal is retired, or its normaliser keeps the `flightdeck` key |
| S3 | Two devices changing the pin list within the same moment can lose one change: the profile endpoint replaces the document and has no version check | A patch or compare-and-swap operation on profile settings |
| S4 | List rows lack `pendingQuestion`, `pauseState`, cron and `lastActiveAt`, so a hold only shows when the list row carries `pauseState`, and the question text comes from `waitReason` | Backend list-row fields (design doc, P1) |
| S5 | Attention age is the session's last update, not when it began waiting | Backend attention timestamps |
| S6 | Needs you covers the viewer's own sessions only. A shared session needs its owner, not you | Owner decision revisited if delegated responsibility is wanted |
| S7 | The Completed view is the existing Completed state filter on the Projects page, not a tab of its own | Lens tabs on the page, if wanted |
| S8 | Counts reflect the loaded sessions; there is no "partial" marker while the list is still paging | List paging with a completeness flag |
| S9 | The router marks every link to the open session with `aria-current="page"`, so a session shown in Recent and in its project is announced twice (the page heading no longer carries it as well, since the 2026-11-01 audit) | Rows render their own link element, or the router stops setting it |
| S10 | The Context panel now shows project, started by, context tier and the session ID. Still to add: where the model came from, last active (apart from last updated), tokens in/out and cache-hit ratio (see G19), regenerations, who it is shared with, and the agent package version. Orchestration ID, snapshot sizes and hydration counts stay in Activity > Details | The panel is extended; tokens wait on G19 |
| S11 | Audit 2026-11-01: after lazy-loading every area except Overview, the first load is 543 kB (163 kB gzip, down from 990 kB). What remains is the shell, Overview, the data layer and `marked`/`dompurify` | Split the markdown and canvas code behind the views that use them; measure again |

## API and SDK gaps (candidates for upstream issues)

| ID | Gap | Workaround today |
|---|---|---|
| G1 | No Web API operation to pause, resume or fire a session's schedule (cron) outside a turn | Controls ask the agent in chat |
| G2 | No operation to list canvas apps | Library shows a note linking to Outputs |
| G11 | No safe per-person navigation store. The profile settings document exists but the classic portal's normaliser whitelists keys and replaces it (`web-app.js` 325-380, 660-672), so new keys written by Flight Deck are erased by the classic portal's next save; group metadata is visible to the classic portal and TUI, has no reserved-identity or size contract, and replaces arrays wholesale. Pins, collapsed sections and dismissals are per browser. Fix: a small per-user preferences document with a revision and compare-and-swap operations (see docs/proposals-impl/flightdeck-sessions-navigation.md) | Per browser, labelled |
| G12 | Session list rows carry no working folder, so the sidebar cannot group by project folder (Claude Code's default) | Groups are the person's own; agent grouping is offered |
| G13 | The creatable-agent catalog keeps one agent per normalised name and lists shared packages first (`app/tui/src/node-sdk-transport.js` `listCreatableAgents`, ~649-658). A private copy that repeats a shared agent's name is dropped from the catalog, although the docs say a bare name resolves to your own copy. Read from code, not run against a live server | Flight Deck follows the catalog: the shared agent is listed, the private copy's panel says "a shared agent with this name is listed instead". Fix upstream by preferring the viewer's enabled copy, then drop the wording |
| G14 | The profile does not expose `adminScope`; a restricted admin is treated as a normal user by the server but looks like an admin here | Admin-only controls show, and the server refuses the action |
| G15 | The agent catalog forwards `tools`, `startedBy` and `supportsDirectStart` but never skills or MCP servers; the package manifest does | The Agents tab shows tools only; the package panel reads skills and MCP servers from the manifest |
| G16 | Worker package state: the registry keeps a row for every worker that ever reported, with no liveness or phase filter, and the install error text is only in `listAgentWorkerState` (admin). Non-admins get nothing after publishing | Rows older than 10 minutes are ignored; admins see the error text; non-admins are told workers pick it up |
| G17 | No package diff, fleet skill usage (`protocol.js` ~167) or per-worker detail operations in the Web API; they exist only in the SDK and the agent manager | Not shown |
| G18 | **Outputs has no backend.** Artifacts exist per session only (`listArtifacts`, download, upload, delete, pin all take a session id); there is no cross-session list, paging, search or filter. The Outputs page and Overview's recent outputs fan out one `listArtifacts` per session over the 40 and 8 most recently active sessions, so older outputs are invisible and each visit costs up to 40 requests. **TODO: design and implement a real backend for Outputs**: a cross-session artifact list operation in the SDK (CMS query over the artifact index, not a blob scan) and Web API: keyset paging, newest first, filters (kind: canvas or file, pinned, session, group, owner/shared-with-me), name search, per-viewer access filtering (the same read rules as `listArtifacts`), `unseen` support, and an index on `(updated_at)`; then switch the Outputs page and Overview to it, drop the 40-session cap and the cap notice, and add a unit and e2e test. The upstream issue and proposal doc should precede the code (orchestration is not involved; this is CMS and API only). | Client-side aggregation over 40 recent sessions, with the limit stated on the page |
| G3 | `listSessions` rows omit `pendingQuestion`, wait fields and a live `step`; spine, `waitUntil` and pause state are demo-only | Home and Boards read `getSession` for needs-you sessions |
| G4 | Per-turn metrics (`getSessionTurnMetrics`, hourly token buckets) exist in the catalog but are not exposed as operations | Not shown |
| G5 | Server-side saved boards do not exist | Boards live in localStorage |
| G6 | `uploadArtifact` is described as a 2 MB limit in protocol.js but the middleware grants 8 MB | Flight Deck keeps stricter UX limits |
| G7 | `forcePurgeFacts` has no dry run | Preview shows "up to N" from tombstone counts |
| G8 | No provider "test connection" operation | Status is shown after save |
| G9 | No operation to resolve a flag-change audit row's user to a name | Directory lookup, then short id |
| G10 | `getProviderUsage` and flag audit shapes are only documented in code | Normalised in `data/ops/contracts.ts` |
| G19 | Session list rows carry no tokens or cache-hit ratio. They come from a separate per-session call (`getSessionMetricSummary`; the whole tree through `getSessionTreeStats`), so showing them in the Context panel costs one extra read when the panel opens | The panel makes that one read on open, or the list rows carry token totals |

## Possible bugs in the classic portal (verify, then report)

| ID | Observation |
|---|---|
| C1 | The classic portal sends attachment image refs as `{filename}` only; the SDK's `sanitizePromptAttachmentRefs` drops refs without `contentType` and `sizeBytes`, so images may be silently lost |

## Deferred features

| ID | Item | Notes |
|---|---|---|
| D1 | Provider icons | On hold by decision. Design: built-in marks per wire type, optional `icon` per config id in `.model_providers.json` returned by `getModelsByProvider`; SDK change, untrusted-image rules (data URI SVG/PNG/WebP, size cap) |
| D2 | Deep link to one package (router cannot carry a package parameter) | Add an optional `package` search param |
| D3 | Fleet peek drawer | Optional in the original brief |
| D4 | Git checkout/restore in the Files Changes view | Deliberately omitted: changes the repository the agent works in |
| D5 | Drag-to-move between folders in Files | |
| D6 | Server-side validation wording for package upload errors | Needs a live server to capture the real messages |
| D8 | Importing a package from a GitHub or Azure DevOps repository (docs/building-agent-packages.md ~378-389; ui-core `repo-import.js`). There are no repo sync operations in the Web API | Download a folder or .zip and use Add a package |
| D7 | Demo-mode multi-user conflict test for the file editor | Needs two clients |

## Process and quality

| ID | Item |
|---|---|
| Q1 | 43 arbitrary size values remain baselined in `scripts/token-guard.baseline.json` (it only ever goes down: `npm run tokens:check -- --update` locks a reduction); reduce over time |
| Q2 | vitest mis-collects `src/lib/*.test.mjs`; `npm test` runs them with node:test instead |
| Q3 | Upstream PR for orchestration 1.0.83 (stale bound answers) not yet opened; needs the maintainer `/test all` run and a rollout note (workers must register 1.0.83) |
| Q4 | A live worker upgrade 1.0.82 to 1.0.83 through continue-as-new has not been exercised against real Duroxide history |
| Q5 | Flight Deck is not run by the PR checks or the maintainer-triggered tests (`.github/workflows`): nothing builds it, runs its 449 unit tests or its Playwright suite in CI. Local commands: `npm run build:flightdeck`, `test:flightdeck`, `test:flightdeck:e2e` | A workflow job that installs Chromium and runs the three, reviewed against the infrastructure standard (CI changes need an owner review) |
| Q6 | Decision (2026-11-01): Flight Deck stays in this repository for now and is not being proposed upstream. If that changes, it is a whole package (about 300 files) and microsoft/pilotswarm's CONTRIBUTING asks for an issue first and one change per PR | Open an upstream issue, then propose it in reviewable parts: scaffold and design system; data layer and demo data; sessions sidebar and Projects; Overview and session views; Library, Providers, Admin, Settings; brand and metadata |
| Q8 | Outputs cards now show a framed preview with an Inspect button (so the inspector and its size limits are reachable from a page); this is a visible design change made while repairing the artifact specs, not yet reviewed by the owner | Owner accepts it, or removes the `preview` prop on `OutputCard` and the artifact specs move to the Overview canvas tiles |
| Q9 | The Projects page and the Overview start box (with the project picker) are covered by model, logic and end-to-end tests, not by component render tests, because the test renderer cannot render Radix popovers or cmdk | A renderer that supports portals, or those components split so the logic renders without them |
| Q10 | The earlier sidebar kept section folds and the open project in `fd.sidebar.*@…` browser keys; they are no longer read and are never removed | A one-time cleanup of those keys on load |
| Q11 | The static host files (`vercel.json`, `public/_headers`, `public/_redirects`) and the `noindex` headers are verified against the dev and preview servers only; no hosted origin exists yet, so crawler-visible responses and social unfurls are unverified. `vercel.json` sets one fixed Content-Security-Policy (`frame-src`) | A deployment, then a check of the real response headers; a CSP review before it serves anything sensitive |

## End-to-end suite

`e2e/` runs the Vite dev server on port 5181 (not 5180) and drives the demo data, in four projects (desktop and phone,
light and dark) plus a desktop-light run with real motion for layout shift. On 2026-11-01 the whole suite was brought
up to date with the projects sidebar and passes (537 passed, 0 failed; the 67 skips are phone-only or desktop-only
tests, none unconditional). See the README, "End-to-end tests". One artifact-preview test failed once under a parallel
run and then passed 12 repeats; if it returns, treat it as timing, not a regression.

## What a session lets you change (backend facts behind the composer footer)

Changeable while a session exists: model, reasoning effort and context tier (`setSessionModel`, applied from
the next turn); working folder (`setSessionWorkspace`, `retrySessionWorkspace`); title, group, sharing,
lifecycle. Fixed at creation: the agent (`createSessionForAgent`; there is no operation to change it),
owner and the initial prompt. Not in the backend at all, so not in the UI: a permission or approval mode,
a per-message model override, an output style, and forking a session. The composer footer is built on
exactly this split.

Coverage: Playwright covers the working-folder chip and dialog (`sharing.spec.ts`) and the running composer, Stop,
Steer and Queue on demo data (`composer-turn.spec.ts`); the model chip is covered by unit and component tests. The demo
records no operation for steer and stop, so those specs check what the person sees. Against a real server they are V8. Steering text
only (no attachments) and `acceptsTurnControl: false` disable the button, as the API requires.

Phone composer: one line to start, 113px tall at 390px and at 320px (was 141px), with every control at 44px. The
session view tabs on a phone share the width equally while they fit (390px) and scroll sideways with edge hints
when they do not (320px), so labels never overlap. Board-tile composers keep their plain input: a tile is about
296px wide at 320px, its row is already full, and the model popover is wider than the tile, so changing a model
stays a session-level act.

## Working folder dialog vs the backend (checked 2026-11-01)

Backend record (`SessionWorkspace`, `packages/sdk/src/types.ts`): `{ root, folder?, extra?: { [name]: { root, folder?, required? } } }`. A root is a named location the deployment exports (`listRoots()`); `folder` is a path inside it. Extras are attached before every turn next to the working folder, at most 4 (`MAX_WORKSPACE_EXTRAS`); `required: false` lets a turn run without an extra that cannot be attached.

Done: the dialog keeps each extra's `required` flag (a "Wait for this folder" switch), caps additional folders at 4, labels every field, and picks the location from the roots the server lists. Each folder is drawn as one path (`work / projects/flight-deck`), and an extra's name follows where it points until the person names it.

| ID | Gap | Closes when |
|---|---|---|
| W5 | There is no operation to list the directories inside a root, so the path inside a location is typed, and a folder that does not exist is only found on save (`WORKSPACE_FOLDER_MISSING`) | A browse-a-root operation, then a folder picker |
