# Flight Deck: Projects and Sessions Navigation

Status: **implemented** in `packages/flightdeck` (1 November 2026). What is not done is tracked in
[OPEN-ITEMS.md](../../packages/flightdeck/OPEN-ITEMS.md) (S1–S11, G11, G19, W5). The working notes that led to this design
are archived in [`docs/_archive/flightdeck-sessions-navigation`](../_archive/flightdeck-sessions-navigation/README.md).

## Summary

Flight Deck organises a person's sessions around one question: **what needs me now**, then **where does this work
belong**. The sidebar is for jumping and triage; the Projects page (`/projects`) is for the whole fleet. Both read one
pure derivation, so they cannot disagree about what a session is, where it lives or whether it needs attention.

## Goals

- Put the next human decision (a question, a failure, a hold the viewer can lift) before routine status.
- Let a person file work into their own projects without moving it out of the places that show it needs attention.
- One definition of "needs you" for the sidebar, Overview, the navigation badge, the tab title and the Projects page.
- Keep pins and dismissals with the account, so they follow the person across browsers.
- Add no backend operation.

## Non-goals

- Shared projects, nested projects or a project directory on disk (a project is not the session's working folder).
- Fleet-wide operator views. Admins get personal scope by default; "Shared with me" is a filter on the Projects page.
- Paging the session list or server-side aggregation (see open items S4, S8).

## Concepts

- **Project.** The backend's *session group*: private to the person, single placement per **root** session tree
  (placing a session moves its whole tree), no nesting, no sharing. The UI says Project; code and API keep `group` and
  `groupId`. Not related to the working folder.
- **No project.** Derived, not stored: sessions in no project (or in a deleted one). It cannot be renamed or deleted;
  "Take out of its project" files a session there.
- **Needs you.** Derived, never stored, never moves a session. Questions first, then holds the viewer can act on, then
  failures; oldest first within each kind, so a question is not pushed behind a pile of failures by the five-row cap.
- **Pinned.** A personal watchlist (sessions and projects), manual order. A pin never relocates a session.

## Behavior

The sidebar, top to bottom: New session, Search, Needs you, Pinned, Projects, No project, Recents. **It loads fully
folded**; what a person opens lasts for that visit. Opening a session by link opens only the place that draws it
(its project, No project, Pinned, Needs you or Recents). A project row opens in place, one at a time, to five of its
live trees. Completed and cancelled sessions leave the sidebar and are reached through the Completed filter on the
Projects page; they keep their project.

The Projects page: search finds projects and sessions; filters narrow the sessions (whose, agent, project, state);
projects are created, renamed, pinned and deleted there; sessions nest under their root.

### Derivation rules (`src/data/session-tree`)

- State precedence: question > running > failed > hold > waiting > idle; completed and cancelled are separate.
- Failures are classified from the real status model, never from error wording. A failure leaves Needs you when the
  session recovers or the person dismisses **that occurrence** (a key from session, iteration count and a masked error
  hash), so yesterday's dismissal cannot hide tomorrow's failure.
- Delegation: a root keeps its own truthful state; descendants that need attention are counted and shown on the root.
- Needs you is the viewer's own sessions; a shared session needs its owner, not the viewer. System sessions are not
  listed.
- Counts name their unit and scope. Membership and "finished" have one definition (`projectMembership`, `isFinished`).

## Persistence

Pins live under the classic portal's `pinnedSessionIds` key in the profile settings document. Pinned projects and
dismissals live under a `flightdeck` key. The endpoint **replaces** the whole document, so writes go through a queued
read-modify-write (`src/data/ops/roaming-settings.ts`), and the page keeps the server's last document plus the changes
still on their way: a change shows at once, and a failed or late save removes only itself. When the server cannot
store settings, pins and dismissals stay in the browser, in keys scoped by data source and person, and the sidebar says so.

Limits that remain: the classic portal's next profile save erases the `flightdeck` key (S2); two devices saving in the
same moment can lose one pin (S3).

## Decisions and alternatives

| Decision | Alternatives rejected |
|---|---|
| Call a group a **Project** | "Folder" (collides with the working folder in the composer); "Group" (says nothing to a person) |
| Pins and dismissals roam through profile settings | Per-browser only (does not follow the person); a hidden group in group metadata (the classic portal and TUI would list it, with no size or identity contract); a new backend preferences store (best long-term, needs backend work: G11) |
| Pin is a watchlist, not a move | Lifting sessions out of their project (a session would live in two conceptual places; the classic portal forbids pinning a filed session) |
| Needs you shows questions before failures | Pure oldest-first (a question can sit behind five old failures) |
| The sidebar loads folded | Remembering folds across loads (stale state; the count pill already says what waits) |
| One derivation shared by sidebar and page, with parity tests | Each surface deriving its own (they had disagreed on counts and membership) |

## Backend facts relied on

A group is a private folder of roots with one placement per root (`private-session-groups-and-deep-links`); list rows
carry status, `waitReason`, `lastError`, owner, visibility and group, but not `pendingQuestion`, `pauseState`, cron
fields or `lastActiveAt` (those come from `getSession`); the profile settings document is replaced on write. The full
capability table and the mismatches it exposed are in the archived working notes (`00-backend-audit.md`).

## Verification

Unit tests for the derivation, the settings store (concurrent, failed and stale writes), the sidebar (about 60 cases
including reveal, focus and keyboard) and the Projects model; Playwright specs for the sidebar, its menus and the
Projects page on four projects (desktop and phone, light and dark). Not yet run against a live backend (V5, V9).
All counts (five rows, five projects) are design choices, not research findings.
