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
| V4 | Share sheet roles/undo/widening, view-only reasons, Move to group, canvas public link (shown once, rotate, remove), working-folder conflict | `e2e/sharing.spec.ts` |
| V6 | Automated accessibility: axe on every route, tab, sheet and confirm the specs open (also once with real motion, no reducedMotion); no sideways scroll; no console errors; phone tap targets under 24px fail; Undo reachable by keyboard inside open sheets | `e2e/a11y-smoke.spec.ts` (incl. `desktop-light-motion`), keyboard specs in `providers-hold`, `sharing`, `library` |
| V7 | Phone top bar: Share and session actions reachable from the session menu; the theme is in the More sheet | `e2e/sharing.spec.ts` (phone projects), `e2e/a11y-smoke.spec.ts` |

Still open:

| ID | What | Closes when |
|---|---|---|
| V5 | Every new screen against a LIVE backend (real API shapes, real permissions, real latency) | A smoke run against a dev PilotSwarm server with a member and an admin account; each ported operation called once; failures filed |
| V6b | Assistive technology: a manual VoiceOver pass on Share, Add provider and the file editor; 200% zoom | A person does it once and files what they find; axe cannot judge announcement quality |

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

## E2E paused

The Playwright suite (`e2e/`, `playwright.config.ts`) is intentionally not maintained while the UX settles. Nothing was
deleted. When the owner says so, repair and re-run it in one pass (`npm run test:e2e`, about 4 minutes).

Known stale or unverified, from the sidebar, density and theme work:

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
