# Sessions navigation: final design for the owner (after two Codex rounds)

Status: Codex round 2 verdict **SIGN OFF WITH CHANGES**; the changes are folded in below. Inputs: `00` audit, `01` product designer, `02` UX researcher, `03` information architect, `04`/`05` syntheses, `05a`/`05b` Codex rounds. Nothing here is built yet. All design numbers (five rows, five folders, caps) are hypotheses to validate, not research findings.

## The model in one paragraph
The sidebar is for **jumping and triage**; `/sessions` is the **fleet** surface. The sidebar shows, top to bottom: New session, Search, **Needs you**, **Pinned**, **Recent**, and optional **Folders**. A session lives in at most one private folder (placing a root moves its whole tree); Needs you and Pinned are views that reference sessions and never move them. Hierarchy shows up only for delegation (sub-agents), on demand. Hover peek, drag and drop, swipe, ⌘1-9, cause-grouped queue rows and "stuck" detection are cut.

## Sidebar sections
| Section | Contents | Rules |
|---|---|---|
| Needs you | Pending questions (preview from `waitReason`); confirmed failures that need investigation; holds only when the viewer can act (usage-grid `manageable`, or session `session:manage` plus a usable alternative model). Owner-scoped by preserved provider+subject identity, not display name. | Reason line per row; parent path for children ("Release build › Research › Child"); cap 5 then link to the full queue; never "All clear" from incomplete or stale data. A failed child always appears here regardless of parent state, folder or pinning. |
| Pinned | Personal watchlist, manual order | Never relocates a session; a pinned session that needs attention shows in both, pin retained. |
| Recent | Non-terminal roots not already shown above | Position frozen on entry; status, reason and completion update live in place; persistent "N updated · Refresh order" control; a session that completes stays visible as Completed until the next sidebar entry or refresh, unless it has unresolved descendant attention; the selected session is retained even when terminal; `/sessions` has an Activity sort for operators who want movement. |
| Folders (optional) | Zero folders: the section is omitted (create on `/sessions`). Otherwise first five in personal order, collapsed, then "All N folders" | Name opens `/sessions?folder=`; disclosure expands one folder at a time to at most five root rows plus "Open in Sessions"; the preview never subtracts pinned or attention roots; counts say "trees"; the attention chip counts actionable sessions across the trees. |

Terminal sessions (completed, cancelled) leave the sidebar and are reached through a **Completed** lens on `/sessions`; they keep their folder membership.

## Derivation rules (one pure module shared by sidebar and `/sessions`, with parity tests)
- State: question (`input_required` or pending question) > running (`running`, `pending`; fix today's `pending`→Idle) > failed > hold > waiting > idle; terminal states separate.
- **Failure classification**, from the real status model, never from error wording: confirmed `failed`/failed orchestration → investigate; explicit nonretryable or auth stop, or retries exhausted that actually park → investigate; scheduled retry, workspace retry or durable handoff → recovering; `lastError` while running → history only. `retriesExhausted:true` can precede an automatic handoff, so an ambiguous error shows as **"Error: recovery state unavailable"**, inspectable but excluded from confirmed Needs-you totals until the backend exposes a recovery disposition.
- A failure leaves Needs you when the session recovers or the person dismisses that specific occurrence; opening records reading only. Dismissal is temporary and clears on observed recovery until a failure-occurrence identifier exists, so yesterday's dismissal can never hide tomorrow's failure.
- Delegation: the root keeps its own truthful state and shows "3 running descendants · 1 failed descendant"; the failure chip opens the affected descendants. Descendant discovery runs over the complete authorized catalog before any display filtering. This is a **release gate**: in P0 the full-catalog refresh stays; once paged, server aggregation plus complete attention discovery is required. (Today's `withChildCounts` counts loaded direct children and treats idle as active; it is replaced.)
- Counts name their unit and scope and say "partial" when the loaded set is incomplete.
- Admin: personal scope by default, explicit Fleet scope; "Shared with me" is a lens on `/sessions` (not "owner is not me").

## Persistence (decision needed; recommendation A)
The classic portal's profile normaliser whitelists keys and replaces the document, so any new key we write is erased by its next save. Using group metadata (a hidden group) is not invisible (the classic portal and TUI list it and offer it as a move target), has no reserved-identity or size contract, and arrays replace wholesale, so concurrent pins can lose edits.
- **A (recommended): a small backend change.** One navigation-preferences document per user with a revision, authenticated read and compare-and-swap write and reset operations, bounded payload, schema version, explicit conflict response (columns on the user record are enough; not a general key-value platform).
- **C (phase 1, honest fallback):** per-browser, labelled "this browser". Pins and dismissals do not roam until A exists.

## Phasing and gates
- **P0 UI-only:** shared derivation module and parity tests; `pending` fix; truthful folder counts and chips from the full catalog; question previews from `waitReason`; capability-aware holds; the failure rules above; frozen Recent with the update control; bounded folders; Completed lens; empty, loading and unavailable states; keyboard and ARIA; synthetic 0 / 40 / 500-session fixtures including a failure storm and a planted failed child under a healthy parent. Metrics: missed actionable items, time to open the first needs-me session, wrong-session opens, payload size, update latency, folder-expand-before-open rate.
- **P1 backend contracts:** list rows with `pendingQuestion`, `pauseState`, cron, `lastActiveAt` and a recovery disposition; `listSessionsPage` filters (`updatedAfter`, state, owner, parent/root, group); complete pause discovery (today `listPausedSessions` takes 100 rows unpaged); the per-person preferences store (A); deletion and revocation reconciliation; server aggregation of descendant state.
- **P2:** folder prominence from usage data; structured-cause incident grouping; richer interactions.

## What needs the owner
1. **Primary audience:** builder or fleet operator? Recommended: personal continuation first, Fleet as an explicit scope.
2. **Must pins and dismissals roam for the first release?** If yes, fund option A first; if not, ship C labelled "this browser".
3. **Is "five folders, five members each" enough grouped-sidebar for your Claude/Codex expectation?** Folders are manual here (Claude's project groups are automatic from the working directory), so they do not imply a project directory.
4. **Fund P1's backend rows?** The reason lines and failed-child discovery degrade without them.
5. **Shared-session attention:** owner-only initially (recommended)?

## Owner answers and what was built (2026-11-01)

- Audience: builder; personal continuation first, Fleet explicit.
- Pins and dismissals roam (profile settings). Classic portal compatibility is not a constraint.
- Shared-session attention belongs to the owner.
- One change from this document while building: Needs you lists questions first, then holds, then failures, oldest first within each kind, so a question is never pushed behind a pile of failures by the five-row cap.
- Open items: `packages/flightdeck/OPEN-ITEMS.md`, section "Sessions sidebar".
- Naming: owner chose **Projects** for what the backend calls session groups (not "folders": the composer already has a working folder). Everything above that says folder means project.
