# Sessions navigation: backend facts and where Flight Deck diverges

Read-only code audit, 2026-11-01. Nothing was run; claims about live behaviour are inferred from code.
Abbreviations: `mig` = `packages/sdk/src/cms-migrations.ts`, `mc` = `packages/sdk/src/management-client.ts`, `FD` = `packages/flightdeck/src`, `proto` = `packages/sdk/api/src/protocol.js`.

## 1) Capability table

| Backend capability | Evidence | Flight Deck exposure | Gap |
|---|---|---|---|
| Group = private per-user folder of ROOT trees. One placement per (user, root); placing any session moves its whole tree. | mig:1791-1840, 1977 (root resolve), 2040-2054; cms.ts:169-173; proto:155-163 | Partial. Create (inside the Move dialog) and place only (`data/ops/groups.ts:19-30`). No rename, delete, description or reorder. | High |
| Group roll-ups: `memberCount`, running, waiting, failed, completed, cancelled, `latestActivityAt` | cms.ts:284-300; mig:2111-2117 | None. Header shows the count of roots left after Needs/Pinned are removed (`tree.ts:75`). `memberCount` is used only in the Move dialog. | High |
| Tree: `parentSessionId`, `rootSessionId`. Nesting 2 levels, 50 sub-agents. | cms.ts:151,188; `orchestration_1_0_82/state.ts:392-393` | Partial. The sidebar hides children (`tree.ts:22`). The Sessions page nests them. Delegation is a flat walk (`session-views.tsx:246`). | Med |
| Status: pending, running, idle, waiting, input_required, completed, cancelled, failed, error; plus `waitReason` and `lastError` | types.ts:743-752; cms.ts:134 | Full via `sessionState`, but pause and cron are never filled on list rows. | Low |
| Pending question, cron fields | mc:476-484 are set only in `getSession` (mc:1291-1417). `sessionViewFromCmsRow` (mc:406-438) omits them. | None on live lists. `cronActive` is read in `state.ts:56` and never set by `live.ts`; the "Scheduled" filter is empty on live data. | High |
| Budget pause | `pause_state` column (mig:9921) is read only by `listPausedSessions` (proto:302). No session view carries `pauseState`. | None in navigation. `needsYou`'s hold branch (`state.ts:187`) is unreachable on live data; paused sessions look like ordinary "Waiting". | High |
| Summary: `shortSummary`, `summaryState` (intent, blockers, nextActions) | mc:429-431 (on list rows) | Partial. Used on the Sessions page row; the sidebar row ignores it. | Med |
| Owner, visibility, shares | cms.ts:181-186; proto:76-80 | Partial. Mine/Others/All on the page only. No shared marker on any row. | Med |
| System and service sessions | cms.ts:153-161 | Partial. Admin toggle; `serviceKind` is never read. | Low |
| Pins, manual order, collapsed state, owner filter, sort mode | Only the profile-settings blob (proto:246, a full replace). The classic portal stores `pinnedSessionIds`, `collapsedSessionIds` and `sessionOrder` there (`web-app.js:370-377,666`). | None server-side. FD uses localStorage (`prefs.ts:6-54`). OPEN-ITEMS G11 and DESIGN.md say "no server-side pin": that is wrong, the profile document is available. | High |
| Keyset paging, `updated_at DESC, id DESC`, limit at most 200 | mc:1088-1134, 188-189; mig:2618; proto:101 | None. FD calls unpaged `listSessions` every 4s (`source.tsx:78`, `live.ts:117`). | High at 500+ |
| Complete, cancel and delete cascade to descendants | mc:1658-1700; portal.md:308 | Full (menus, bulk bar). | Low |
| Archive or favourite | Not found in the CMS. | n/a | n/a |

## 2) Mismatches and mis-modelled concepts

- **A group is a folder**: private, single-membership, roots only, no nesting, no sharing (proposal `private-session-groups-and-deep-links.md`). FD's copy ("your own folders") is right; its behaviour is not:
  - "Needs you" and "Pinned" lift sessions out of their folder (`tree.ts:60-65`), so a session lives in two conceptual places. The classic portal forbids pinning a foldered session (`session-tree.js:70-76`).
  - The "Group by Agent" toggle makes folders optional.
- **Group headers lie.** They show leftovers, not membership. An all-needs group renders "Empty. Move sessions here" (`sessions-sidebar.tsx:257`) while it has members. Group order is the backend's `MAX(summary_updated_at) DESC` (mig:2142), so folders reorder as agents write summaries.
- **Counts disagree.** "Sessions N" counts roots only (`sessions-sidebar.tsx:65`); facet counts include children (`:59-63`); Needs-you includes children (`tree.ts:60` has no `isRoot` check); a state filter hides a running child whose parent is idle (`tree.ts:55,63`), yet the facet counted it.
- **Children are hidden, so active work is invisible.** A child only surfaces when it needs you or fails, as an orphan row with no parent context. `withChildCounts` counts every non-terminal child, including idle finished ones (`live.ts:61-69`); the classic portal counts only running or input_required (`reducer.js:498-544`).
- **"Needs you" mixes questions, failures and holds on purpose** (`state.ts:183`). Rows show only a glyph and title, with no reason or question. Sorted by `updatedAt` only. It has no owner check; an admin's `listSessions` is unfiltered when admin scope is unrestricted (`runtime.js:243,570-575`), so other users' failures can appear in an admin's "Needs you" (inferred).
- **"Recent" is really "Unfiled".** Every ungrouped root, completed and cancelled included, ordered by `updated_at`, which is bumped by every state write and summary write, and by soft-delete (mig:2250, 5391-5405). So it is not "activity".
- **Canvas dot is dead on live data.** `unseenCanvas` is set only in `demo.ts`. `canvases` ride `listSessionsPage` only (mc:1123).
- **No sidebar search.** Search is on the page only, over title, agent and id, not over summary.
- **Group-scoped listing is unreachable.** `listGroupSessions` is not in proto.

## 3) Audit's recommended information architecture (input to the design panel, not a decision)

Sidebar: Needs you (split by kind: questions, failed, paused, with reason line), Pinned (unfiled roots only, or tagged with their folder), Folders in manual order (name, true `memberCount`, roll-up dots, at most 5 rows plus "All N"), Shared with me (virtual), Unfiled (by `updatedAt`, Done collapsed), System (admin).
Row: glyph, title, one muted reason line, sub-agent chip, shared/owner tag; children nested, auto-expanded when one needs you; depth capped at 2.
Sessions page: same grouping, filters, `listSessionsPage` paging at 200, stop polling the full list.

UI-only (existing operations): group rename/delete/description, folder order via group `metadataPatch`, client-side roll-ups, Needs-you split, Unfiled and Done sections, Shared-with-me, nesting and breadcrumbs, root-only counts, join `listPausedSessions`, `getSession` for the few needs-you rows, pins/collapsed/order in profile settings (full replace; read-merge-write with the classic key names; lost-update race with the classic portal).
Needs backend work: list rows carrying `pendingQuestion`, `cron*`, `waitUntil`, `pauseState`; `listSessionsPage` filters (state, group, owner, text, parent/root); a paged group listing operation; correct group roll-ups (today `running_count` includes idle and pending, `waiting_count` merges input_required, roots only); a tree roll-up of descendant states; a partial-merge profile patch operation; server-side archive; a list-change push; a server-side unseen-canvas flag.
