# Sessions navigation: synthesis v2 (after Codex round 1)

Codex's round-1 critique (verified by me against the code where noted) changed the draft materially. This document supersedes `04-synthesis-draft.md`.

## Corrections accepted (verified or accepted from Codex)

| # | Correction | Source |
|---|---|---|
| F1 | List rows already carry a question preview in practice: `session.input_required_started` writes the question into `waitReason` (session-proxy.ts:4093; management-client.ts:432). Choices and question identity still need `getSession`. The researcher's "task 1 cannot work without pendingQuestion" overstated it. | Codex; code read |
| F2 | "50 sub-agents" is a cap on concurrently running direct children per spawner (orchestration_1_0_82/agents.ts:808), not a tree-size ceiling. Depth is capped at 2, but a tree can hold more than 50 historical children. | Codex; code read |
| F3 | Flight Deck's `pending` status falls through to Idle (state.ts:40,85). | Codex |
| F4 | New session, Search and per-row pin controls already exist; the command palette already searches sessions. | Codex |
| F5 | `listPausedSessions` requests 100 rows, unpaged, before personal filtering; an admin can exhaust it. | Codex |
| F6 | Page-one polling is not a delta feed: more than 200 changed sessions displace updates; deletions and access revocations are invisible by absence; keyset ordering is not snapshot-consistent. | Codex |
| F7 | A "quiet for 20 minutes" rule can mislabel healthy long turns and is concealed by summary writes. `lastActiveAt` exists in the CMS but not in list DTOs, and its semantics are not a heartbeat. | Codex |
| F8 | "Others" is not "Shared with me" for admins (owner is not me); a viewer-scoped catalog exists (`viewerOnly`), owner filtering does not. | Codex |
| F9 | **The profile blob is unsafe for new state.** The classic portal's `normalizeProfileSettings` whitelists known keys and the store REPLACES the document (web-app.js:325-380, 660-672): any new key (acknowledgements, Flight Deck pins) is erased by the classic portal's next routine save. Read-merge-write cannot fix an old writer. | Codex; code read |

## Decisions (v2)

1. **Sidebar = jump and triage, not a library tree.** New session, Search, then **Needs you**, **Pinned**, **Recent**; optional flat **Folders**. Hierarchy appears only for delegation (sub-agents), on demand.
2. **Needs you** (owner-scoped): pending questions (with the preview from `waitReason`) and failures that need investigation. Budget/provider holds appear in Needs you only when the viewer can act on them (their own provider, or an admin); otherwise as a single secondary "Waiting" summary line. No "stuck" kind. Rows show a reason line, the parent path for children, and the home folder as a suffix. Capped (5) with a link to the complete queue; never "All clear" from incomplete or stale data.
3. **A failure leaves Needs you when the session recovers or the person explicitly dismisses it. Opening records reading only.** Dismissals are per-browser until a safe store exists (decision 8).
4. **Pinned** is a stable personal watchlist (manual order); pinning never relocates a session or changes its folder membership. A pinned session that needs attention appears in both, with the pin retained.
5. **Recent** = continuation: non-terminal roots not already shown in Needs you or Pinned, ordered by `updatedAt` on entry and then settled (no buckets, no automatic resort; "N updated" pill while the pointer or focus is in the list). Terminal sessions (completed, cancelled) leave the sidebar and live behind a **Completed** lens on `/sessions`; unresolved descendant attention is never buried by a terminal parent.
6. **Folders** stay optional: a flat list of rows (name, true member count, attention chip), expanding inline to at most 5 members plus "Open in Sessions", or opening `/sessions?folder=`. Management (create, rename, delete, order) lives on `/sessions`. A folder never implies a working directory.
7. **`/sessions`** is the fleet surface: lenses All, Needs you, Shared, Completed/Cancelled; personal scope by default for admins with an explicit Fleet scope; search, columns, bulk actions, folder management. It shares state derivation, counts and identity with the sidebar (one pure module with parity tests), not the same rendering.
8. **Persistence:** pins, dismissals and expansion are per-browser (labelled "this browser") in phase 1. Roaming requires a safe store: option A, a backend per-person key-value or patch operation with versioned namespaces; option B, an invisible per-user group whose `metadata` holds pins and order (group metadata merges server-side and is private to the viewer), if the classic portal and the group listing tolerate a reserved group; option C, leave the profile blob alone entirely.
9. **Counts** name their unit and scope ("12 sessions" vs "12 roots"), and show "partial" when the loaded set is incomplete.
10. **Cut or deferred:** hover peek, drag and drop, phone swipe, ⌘1-9 pin shortcuts, cause-grouped queue rows (except holds that share provider, scope, reason and reset), activity buckets, per-folder Done folds, a global retire state, twin-hover highlighting, "stuck" detection.

## Phasing

- **P0 (UI-only, correctness):** shared derivation module and parity tests; fix `pending`; honest folder counts and chips; question previews from `waitReason`; scoped Needs you; stable ordering; empty/loading/unavailable states; keyboard and ARIA; Completed lens; synthetic 0/40/500-session fixtures including a failure storm; metrics below.
- **P1 (backend contracts):** list rows with `pendingQuestion`/`pauseState`/cron/`lastActiveAt`; `listSessionsPage` filters (`updatedAfter`, state, owner, parent/root, group); complete pause discovery; a safe per-person store; deletion and revocation reconciliation.
- **P2:** folder prominence driven by usage; incident grouping with structured causes; richer interactions.

Metrics: missed actionable items, time to open the first needs-me session, wrong-session opens, payload size, update latency, folder-expand-before-open rate.

## Questions for the owner (recommended answers)

1. Primary audience: builder or fleet operator? **Personal continuation first; Fleet is an explicit scope.**
2. What clears a failure? **Recovery or explicit dismissal.**
3. Who owns shared-session attention? **The owner, initially.**
4. Must pins and dismissals roam? **Yes, with a safe store funded before promising it.**
5. Are folders strategic? **Optional until retrieval behaviour supports more.**
