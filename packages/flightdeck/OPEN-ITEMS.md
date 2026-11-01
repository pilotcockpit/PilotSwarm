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
| G11 | No server-side pin, and no per-person sidebar state: pins, collapsed sections, group-by and the state filter live in this browser, in keys scoped by data source and person (`fd.pins@…`, `fd.sidebar.*@…`) | A pin follows the browser, not the person across browsers |
| G12 | Session list rows carry no working folder, so the sidebar cannot group by project folder (Claude Code's default) | Groups are the person's own; agent grouping is offered |
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
  preference keys and malformed stored values, system-session menus, rename drafts under polling, the phone Search
  handoff, Needs-you announcements, the Context panel's over-limit meter, missing Access row and canvas slot.

Specs written during this work and **not yet run as a full suite** (they passed when run alone on `desktop-light` and,
for the phone one, `phone-light`): `e2e/sidebar-actions.spec.ts` (the destructive-action matrix, finding 12: complete,
cancel, delete, rename and pin, from the row menu and the title menu, with zero calls before confirming and after
cancelling, exactly one targeted call after, and a server refusal), `e2e/sidebar-helpers.ts`, and `e2e/theme.spec.ts`
(Settings, account menu, palette, the System default following the browser, no top-bar toggle, axe on the radio group).
The demo test hooks they use (`window.__fdDemo.sessions.setTitle`, `setContextUtilization`, and `failOps` for
`renameSession`, `completeSession`, `cancelSession`, `deleteSession`) are dev-only and covered by `check-dist`.

Still owed once the UX is final: the full-suite pass on all five projects, the destructive-action matrix on the phone
projects, and a flake run (three consecutive green runs).
