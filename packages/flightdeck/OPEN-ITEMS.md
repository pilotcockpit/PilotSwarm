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
| V6 | Automated accessibility: axe on every route, tab, sheet and confirm the specs open; no sideways scroll; no console errors; phone tap targets under 24px fail | `e2e/a11y-smoke.spec.ts` plus axe calls in each spec |
| V7 | Phone top bar: Share, theme toggle and session actions reachable from the session menu | `e2e/sharing.spec.ts` (phone projects), `e2e/a11y-smoke.spec.ts` |

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

## Handoff: review of the e2e suite (REJECT at 0f11b8bd, not yet addressed)

An independent read-only review of the Playwright suite found these. None are fixed yet. Verify
the suite still passes first (`npm run test:e2e`, about 2 minutes, 288 tests), then fix:

1. **Hard-delete test does not guard the execution boundary** (`e2e/knowledge.spec.ts`). An early
   `restart.mutate` before the confirmation would pass because the demo op deletes nothing. Add a
   call log to the dev-only demo hook (`window.__fdDemo`) and assert zero `restartSystemSession`
   calls before confirm and after cancel, exactly one with the right params after the name is
   typed. Apply the same call-count check to force purge, namespace delete, prune and embedder stop.
2. **Weak assertions**: gentle restart (`/restart/i` matches static page text; assert the exact
   result toast), default-model explanation (assert model, provider and source together in the
   card), diff (assert distinct added and removed lines), provider removal (assert the exact
   waiting-session count). Scan the suite for the same pattern.
3. **Undo is not keyboard-reachable while a sheet is open**: Radix's modal focus trap redirects focus
   away from the external toaster. Render the Undo inside the open dialog (status region, Tab
   reachable, same 8 s window) and add keyboard specs.
4. **`window.__fdDemo` is installed in dev even with `?data=live`**: install it only for the demo
   source and only when `import.meta.env.DEV`; add a spec for the live case and a check that the
   production build contains no `__fdDemo`, `writeBehind` or `bumpRevision`.
5. **Config**: add one run without `reducedMotion` (desktop, light, a11y smoke); do not raise
   timeouts to hide slowness.

Run the matching mutation for each fix and confirm the spec fails before restoring.
