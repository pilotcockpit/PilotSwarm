# Flight Deck: open items (the repo .gitignore excludes files named TODO.md)

Last updated 2026-10-30. Each item says how it closes. Mark an item done by deleting it and
noting the commit in the PR or changelog, not by leaving a checked box here.

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
| V5 | Every new screen against a LIVE backend (real API shapes, real permissions, real latency) | A smoke run against a dev PilotSwarm server with a member and an admin account; each ported operation called once; failures filed |
| V6b | Assistive technology: a manual VoiceOver pass on Share, Add provider and the file editor; 200% zoom | A person does it once and files what they find; axe cannot judge announcement quality |

## Sessions sidebar (built 2026-11-01; design in docs/ux-audit/2026-11-01/sessions-ux/06-final-design-for-owner.md)

No project: sessions in no project (or in one that was deleted) are shown as a derived **No project** group: its own sidebar section beside Projects (five rows, a link to the rest), and the last group on the Projects page. It is not stored, so it cannot be renamed or deleted; "Take out of its project" files a session there. It appears only once the person has made a project. (In code it is `DEFAULT_PROJECT_ID`.)

The Projects page (`/projects`) is the one page for projects and their sessions: search finds either, filters narrow the sessions, and projects are managed there. `/sessions` redirects to it with the same filters.

Naming: the product calls a backend session group a **Project** (private, one per root tree, nothing to do with the working folder). Code and API names keep `group`/`groupId`.

Built: shared derivation (`src/data/session-tree/`), Needs you / Pinned / Projects / Recent, settled Recent order with "Refresh order", roaming pins and dismissals, one attention count for sidebar, Overview, nav badge, tab title and the Projects page (`state=attention`, `project=`).

| ID | What | Closes when |
|---|---|---|
| S1 | Projects can be created, renamed and deleted on the Projects page. Still missing: a description and a manual order (the backend keeps both: `description` and group `metadata`) | The page offers them |
| S2 | Dismissals and pinned projects live under a `flightdeck` key in the profile settings. The classic portal replaces the whole document from its own state, so its next save erases that key (session pins use the classic `pinnedSessionIds` key and survive). A dismissed failure reappears and a pinned project has to be pinned again | The classic portal is retired, or its normaliser keeps the `flightdeck` key |
| S3 | Two devices changing the pin list within the same moment can lose one change: the profile endpoint replaces the document and has no version check | A patch or compare-and-swap operation on profile settings |
| S4 | List rows lack `pendingQuestion`, `pauseState`, cron and `lastActiveAt`, so a hold only shows when the list row carries `pauseState`, and the question text comes from `waitReason` | Backend list-row fields (design doc, P1) |
| S5 | Attention age is the session's last update, not when it began waiting | Backend attention timestamps |
| S6 | Needs you covers the viewer's own sessions only. A shared session needs its owner, not you | Owner decision revisited if delegated responsibility is wanted |
| S7 | The Completed view is the existing Completed state filter on the Projects page, not a tab of its own | Lens tabs on the page, if wanted |
| S10 | The Context panel now shows project, started by, context tier and the session ID. Still to add: where the model came from, last active (apart from last updated), tokens in/out and cache-hit ratio (see G19), regenerations, who it is shared with, and the agent package version. Orchestration ID, snapshot sizes and hydration counts stay in Activity > Details | The panel is extended; tokens wait on G19 |
| S11 | Audit 2026-11-01: after lazy-loading every area except Overview, the first load is 543 kB (163 kB gzip, down from 990 kB). What remains is the shell, Overview, the data layer and `marked`/`dompurify` | Split the markdown and canvas code behind the views that use them; measure again |
| S9 | The router marks every link to the open session with `aria-current="page"`, so a session shown in Recent and in its project is announced twice (the page heading no longer carries it as well, since the 2026-11-01 audit) | Rows render their own link element, or the router stops setting it |
| S8 | Counts reflect the loaded sessions; there is no "partial" marker while the list is still paging | List paging with a completeness flag |

## API and SDK gaps (candidates for upstream issues)

| ID | Gap | Workaround today |
|---|---|---|
| G1 | No Web API operation to pause, resume or fire a session's schedule (cron) outside a turn | Controls ask the agent in chat |
| G2 | No operation to list canvas apps | Library shows a note linking to Outputs |
| G11 | No safe per-person navigation store. The profile settings document exists but the classic portal's normaliser whitelists keys and replaces it (`web-app.js` 325-380, 660-672), so new keys written by Flight Deck are erased by the classic portal's next save; group metadata is visible to the classic portal and TUI, has no reserved-identity or size contract, and replaces arrays wholesale. Pins, collapsed sections and dismissals are per browser. Fix: a small per-user preferences document with a revision and compare-and-swap operations (see docs/ux-audit/2026-11-01/sessions-ux/06-final-design-for-owner.md) | Per browser, labelled |
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
| Q1 | 86 arbitrary size values remain baselined in `scripts/token-guard.baseline.json`; reduce over time |
| Q2 | vitest mis-collects `src/lib/*.test.mjs`; `npm test` runs them with node:test instead |
| Q3 | Upstream PR for orchestration 1.0.83 (stale bound answers) not yet opened; needs the maintainer `/test all` run and a rollout note (workers must register 1.0.83) |
| Q4 | A live worker upgrade 1.0.82 to 1.0.83 through continue-as-new has not been exercised against real Duroxide history |

## End-to-end suite (done)

`packages/flightdeck/e2e/` runs the Vite dev server on port 5181 (not 5180) and drives the demo data.
See README, "End-to-end tests". It already found and fixed real defects; the list is in the commit
that added it.

## What a session lets you change (backend facts behind the composer footer)

Changeable while a session exists: model, reasoning effort and context tier (`setSessionModel`, applied from
the next turn); working folder (`setSessionWorkspace`, `retrySessionWorkspace`); title, group, sharing,
lifecycle. Fixed at creation: the agent (`createSessionForAgent`; there is no operation to change it),
owner and the initial prompt. Not in the backend at all, so not in the UI: a permission or approval mode,
a per-message model override, an output style, and forking a session. The composer footer is built on
exactly this split.

Open: composer footer behaviour is covered by unit and component tests only; Playwright coverage waits for
the e2e pass.

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

## E2E paused

The Playwright suite (`e2e/`, `playwright.config.ts`) is intentionally not maintained while the UX settles. Nothing was
deleted. When the owner says so, repair and re-run it in one pass (`npm run test:e2e`, about 4 minutes).

Known stale or unverified, from the sidebar, density and theme work:

- **Session header**: the Canvas, Files, Activity, Delegation and Context icon buttons are gone (the tab bar is the one place to
  choose a view), so any spec that clicks them must click the tab instead (`getByRole("tab", { name: … })`). The header "More" menu is gone too: Change model and Working folder are the composer chips, and Copy session ID is in Session actions.
- **Everything that touches the sidebar**: `e2e/sidebar.spec.ts`, `e2e/a11y-smoke.spec.ts`, `e2e/files.spec.ts`,
  `e2e/sharing.spec.ts` and any spec that navigates through the rail or the account menu.
- **The collapse toggle**: it moved to the top of the sidebar ("Collapse sidebar" / "Expand sidebar", an icon at the
  top, no longer in the account menu).
- **Density**: removed entirely (no Settings row, no account-menu item, no palette command, no `data-density`).
- **Theme controls**: one control now (Settings segmented, account-menu radio group, three palette commands), no
  top-bar toggle, and the default is System. `e2e/helpers.ts` `setTheme` now seeds the project's theme once per browser
  context, not on every load.
- **Findings from the sidebar review without browser coverage yet**: focus after a row moves or disappears, per-person
  preference keys and malformed stored values, system-session menus, Needs-you announcements, the Context panel's
  over-limit meter, missing Access row and canvas slot. (Rename drafts under polling and the phone Search handoff now
  have unit and component tests, `src/lib/rename-draft.test.tsx` and `src/shell/ui-state.test.tsx`; the browser pass
  still owes the end-to-end version.)

Specs written during this work and **not yet run as a full suite** (they passed when run alone on `desktop-light` and,
for the phone one, `phone-light`): `e2e/sidebar-actions.spec.ts` (the destructive-action matrix, finding 12: complete,
cancel, delete, rename and pin, from the row menu and the title menu, with zero calls before confirming and after
cancelling, exactly one targeted call after, and a server refusal), `e2e/sidebar-helpers.ts`, and `e2e/theme.spec.ts`
(Settings, account menu, palette, the System default following the browser, no top-bar toggle, axe on the radio group).
The demo test hooks they use (`window.__fdDemo.sessions.setTitle`, `setContextUtilization`, and `failOps` for
`renameSession`, `completeSession`, `cancelSession`, `deleteSession`) are dev-only and covered by `check-dist`.

Still owed once the UX is final: the full-suite pass on all five projects, the destructive-action matrix on the phone
projects, and a flake run (three consecutive green runs).
