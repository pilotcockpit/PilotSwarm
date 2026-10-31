# Flight Deck: open items (the repo .gitignore excludes files named TODO.md)

Last updated 2026-10-30. Each item says how it closes. Mark an item done by deleting it and
noting the commit in the PR or changelog, not by leaving a checked box here.

## Unverified (built and reviewed, never exercised end to end)

| ID | What | Closes when |
|---|---|---|
| V1 | Files: edit, conflict resolution, Changes (git) view, upload and delete states | Browser e2e specs for these states pass at 1280 and 390, light and dark (see "Closing the unverified states" below) |
| V2 | Admin > Knowledge: typed-confirm purge, namespace delete confirm, embedder Stop confirm | e2e spec |
| V3 | Providers: hold dialog (presets, custom, release), allowance slider, system-agent overrides, legacy-key move, paused-session action | e2e spec |
| V4 | Share sheet roles and undo, canvas Share sheet create/rotate/remove, working-folder dialog conflict path | e2e spec |
| V5 | Every new screen against a LIVE backend (real API shapes, real permissions, real latency) | A smoke run against a dev PilotSwarm server with a member and an admin account; each ported operation called once; failures filed |
| V6 | Real-browser accessibility: keyboard journeys, screen-reader names, focus return, focus trap in sheets, 200% zoom | axe scan in the e2e run plus a manual VoiceOver pass on Share, Add provider and the file editor |
| V7 | Phone top-bar change (theme toggle moved to More) with keyboard and screen reader | Covered by V6 |

## API and SDK gaps (candidates for upstream issues)

| ID | Gap | Workaround today |
|---|---|---|
| G1 | No Web API operation to pause, resume or fire a session's schedule (cron) outside a turn | Controls ask the agent in chat |
| G2 | No operation to list canvas apps | Library shows a note linking to Outputs |
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

## Closing the unverified states (V1 to V4, V6, V7)

Add `packages/flightdeck/e2e/` with Playwright (already a root devDependency, used by
`packages/app/web/playwright.config.mjs`):

1. `playwright.config.ts`: `webServer` runs the Vite dev server on a free port; projects for
   desktop (1280x800) and phone (390x844, touch), each in light and dark; `?data=demo`.
2. One spec per area (`files.spec.ts`, `knowledge.spec.ts`, `providers-hold.spec.ts`,
   `sharing.spec.ts`), each walking the states in the table above and asserting outcomes (a
   saved edit shows the new text, a conflict keeps the draft, a typed confirm stays disabled
   until the phrase matches, a hold shows its release time, Undo restores).
3. An axe scan (`@axe-core/playwright`) on every sheet and dialog the specs open; fail on
   serious or critical violations.
4. A screenshot per state to `e2e/__screenshots__` for review (not pixel-diffed at first).
5. `npm run test:e2e` in the package; defects found become fixes in the same change.
6. Done when the run is green on both viewports and both themes, and the screenshots were
   reviewed once by a person.
