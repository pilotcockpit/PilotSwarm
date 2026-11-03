# Overview workbench and SDK audit

Implemented on shared `dev`, based at `37cadb2c`, 30 October 2026. This
replaces the owner-rejected Overview metric strip and decorative illustration.
No owner acceptance, deployment or live SDK integration acceptance is claimed.

## Implemented

- Unboxed personal welcome, substantial reusable work cards, clearer native
  sans typography, consistent actions and touch targets. Decisions, recoveries,
  active sessions and produced outputs have distinct jobs and clear hierarchy.
- Real artifact previews replace generated decorative art. Inspect expands the
  actual document into a read-only reader with a native shared-element
  transition, reverse/focus return, phone fullscreen and reduced-motion fallback.
  Sanitized HTML keeps the shared no-network policy and a scriptless sandbox;
  document controls and links are disabled rather than pretending to save.
- Guarded answers retain fresh-question identity and destructive confirmation;
  confirmation, cancellation and sent feedback now preserve keyboard focus.
- Frontend SDK corrections normalize feature/group rows, align the Yours filter
  with ownership counts, and launch only a current eligible catalog agent from
  the selected package copy. Private-copy identity and active-version collisions
  fail closed. Backend/API/SDK source was not changed.

See [direction and inspected references](direction.md), the maintained
[design system](../../../../packages/flightdeck/DESIGN.md), and the full
[UX → SDK coverage matrix and triage](api-coverage.md).

## Independent review scope

The fresh Impeccable reviewer initially requested three fixes: remove stretched
blank decision space, replace tiny whole-document thumbnails with readable
opening crops, and add a meaningful authored interaction. After source and
desktop/phone recaptures, its disposition was **ship for those three fixes**.
This is not blanket product signoff; it did not independently observe a motion
recording or certify temporal finesse. Parent QA confirmed the native named
transition surface expands, returns and restores focus; geometry is recorded in
[motion-evidence.json](motion-evidence.json).

The independent accessibility reviewer passed its four scoped corrections:
coarse-pointer target sizes, grouped-link targets, error wrapping and answer
confirmation focus. This was not screen-reader certification or exhaustive
async-failure testing. A separate SDK reviewer verified the frontend mapping
and launch/filter corrections and identified the selected-private-copy identity
case, which is covered by a fixture regression test.

## Validation

- `npm run build --workspace=pilotswarm-flightdeck`: passed, including TypeScript,
  token guard, Vite and production demo-hook exclusion. The existing main bundle
  size warning remains (about 891 kB minified / 262 kB gzip).
- Six targeted Vitest files: **23 tests passed**. Scope: group/flag mapping,
  package eligibility/catalog fixtures, read-only document isolation, repeated
  theme switching and session-stream recovery. No live provider/model calls.
- Browser QA used an isolated `127.0.0.1` demo tab, preserving the user's
  localhost Library tab. Captured both themes at desktop and phone sizes,
  inspected real fixture content, verified disabled reader controls and focus
  return, and confirmed 44px coarse-pointer answer targets and phone fullscreen.
- Library QA confirmed Yours filtering and canonical package-agent selection in
  the New session sheet. The sheet was cancelled: no session/model run occurred.
- Staged privacy scan: 2,568 indexed files, zero findings. Staged and worktree
  whitespace checks passed; mixed files contain only this task's owned hunks in
  the index, preserving the other session's unstaged edits.

These are source, build, fixture and browser-demo checks. They do not establish
live request acceptance, authorization, worker adoption, auth recovery or
production readiness. Existing SDK integration gaps and missing contracts remain
explicitly open in [the API audit](api-coverage.md). Browser preferences and
browser-saved boards remain local; schedule controls are disclosed agent requests.

## Evidence

| View | Capture |
| --- | --- |
| Desktop light / dark | [Light](user-desktop-light.png), [dark](user-desktop-dark.png) |
| Wider desktop | [Light](desktop-wide-light.png) |
| Phone light / dark | [Light](mobile-light.png), [dark](mobile-dark.png) |
| Active work and outputs | [Dark](desktop-work-cards-dark.png) |
| Document reader | [Desktop](inspector-desktop.png), [phone](inspector-mobile.png) |
| SDK agent selection | [Library → New session](sdk-library-agent-selection.png) |

Earlier rejected captures remain in `../overview-polish/` as historical evidence.
Other sessions' changes to tests, dialogs and data tooling are preserved and
are outside this work's staged scope. Commit/push remains subject to the current
required independent Claude review; an authentication failure is not approval.
The current scoped review attempt (`20261030-201718-67118`) failed with exit 4;
its result was “Not logged in · Please run /login”, with no reviewed tokens or
verdict. No commit or push was performed.
