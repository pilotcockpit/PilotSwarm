# Sessions taxonomy and navigation model (information architect)

2026-11-01. Evidence: `00-backend-audit.md`, `cms-migrations.ts` 2111-2142, the private-groups proposal, `protocol.js` 101/155-163/246, FD `tree.ts`, `sessions-sidebar.tsx`, `routes/sessions.tsx`. Reference 1 (Claude desktop) shows pins and folders as plain lists; reference 5 (FD) lifts rows out of their folder. Both are evidence, not standards.

Principles: **[DS1]** consistency over creativity (design-system); **[OP]** Operate mode: standard patterns, motion conveys state only; **[CL]** cognitive load: chunking, working memory of four, hidden navigation, noise floor; **[N1/N6/N7]** Nielsen status, recognition, efficiency; **[PP1]** PRODUCT.md "next human decision before telemetry".

## 0. Decisions and challenged assumptions

1. Two zones: **Triage** (views: Needs you, Pinned) above **Library** (the one tree: folders, Unfiled).
2. Views reference; they never move sessions [CL, N6]. Moving a row when its state flips destroys location memory and causes today's jumping and "Empty" folders.
3. **Should user folders sit beside attention-first sections?** Yes, demoted. Triage answers "what needs me" (PP1); folders answer "where did I put it" at 500+ sessions. With zero folders, no folder chrome appears.
4. Drop "Group by Agent" from the sidebar: it is a facet, not a second taxonomy [DS1]. Rename "Recent" to **Sessions** (its true content). "Shared with me" is a filter (Mine / Shared / System), not a section: a third place for one session breaks the exactly-one-home rule.

## 1. Object model

| Object | Definition | Identity | Where it appears |
|---|---|---|---|
| Session | Durable agent conversation | `sessionId` | Once in Library (its home), plus references in views |
| Root | `parentSessionId` null. A session whose parent is invisible is an **orphan root**, tagged "parent hidden" | `sessionId` | Home = viewer placement (`viewerGroupId`) else Unfiled |
| Child | Sub-agent, depth at most 2 | `sessionId`, `rootSessionId` | Only under its root; home inherited; never filed alone |
| Folder | Private container of roots, flat | `groupId` | Library only |
| Pin | Viewer flag on a **root** (pinning a child pins its root) | ordered root ids in profile | Pinned view; pin glyph on home row |
| Attention item | Derived, never stored: `{sessionId, rootId, kind, since, key}` | `key` | Needs-you view; marker on home row and every collapsed ancestor |

Dual appearance is communicated: a view row carries a location suffix ("in Ops"); the home row carries the marker; hovering either highlights its twin; `aria-current` is set on one row only. Counts never add across zones.

**Attention inside a collapsed folder** stays discoverable three ways: it is in Needs you regardless; the folder header shows a needs chip; activating the chip expands and focuses the first attention row. Folders never auto-expand on a poll [OP].

## 2. Derivation

**Own state**, first match wins: terminal (completed, cancelled) > question (`input_required` or `pendingQuestion`) > running (`running`, `pending`) > failed (`failed`, `error`, or `lastError` when not running) > hold (`pauseState`) > waiting (`waiting`, cron active) > idle.
**Running** = a turn executes now. **Waiting** = nothing executes, a known resume exists (timer, schedule, sub-agents, hold reset). **Idle** = turn finished, next input is a human message. Running beats `lastError` (a retry is in flight).

**Parent versus child.** The glyph is always the row's own state, matching the session header. A roll-up chip shows the worst descendant state when it outranks the own state or the parent waits on sub-agents. Severity: question > failed > hold > stuck > running > waiting.

**Attention set** (rank order): question, hold, failed (unacknowledged), stuck.
- **Owner scoping**: only sessions I own. Shared sessions never enter it; admins never see others' failures. Unknown owner counts on viewer-scoped lists only; otherwise excluded and reported once.
- **Failure acknowledgement**: key = `sessionId:iterations:hash(maskVolatile(error))`. Opening the session, or Dismiss, acks it. A later failing turn has a new key and re-raises. Acks live in profile settings, capped at 500, pruned with their sessions. Questions clear when answered; holds when the pause clears.
- **Stuck** (UI-only): running with `updatedAt` older than 20 minutes. Summary writes bump `updatedAt`, so this misses some stuck sessions but never invents one.

| Number | Unit | Definition |
|---|---|---|
| Sessions N | roots | non-system visible roots |
| Folder N | roots | roots at that home (equals `memberCount`) |
| Needs you N | sessions, any depth | attention set size |
| Folder chips | sessions | needs = attention inside; running = own state running, descendants included. Waiting, idle and acked failures are not chipped [CL] |
| Facet counts | sessions | same predicate as the list they filter |

A state filter keeps a root when it or a descendant matches and shows the matching path, so a facet count never exceeds the visible list.

## 3. Ordering

- **Folders**: `metadata.sortKey` (float) via `updateSessionGroup({metadataPatch})`, which already merges server-side. Missing: `createdAt` asc. New folders append. Reorder by drag or Alt+Up/Down. Never by summary activity.
- **Pinned**: manual, array order in profile `pinnedSessionIds` (the classic key). New pins append.
- **Needs you**: rank, then `since` ascending. `since` is fixed while waiting, so the queue is stable; arrivals append.
- **Library lists**: live roots by activity bucket (`floor(updatedAt/5 min)` desc), `createdAt` desc, id. Terminal roots go to a collapsed "Done N" fold per container. Children: `createdAt` asc.
- **Settled order**: render from a snapshot. Polls update row content in place, never positions. The snapshot recomputes on mount, route change or request, or after the pointer and focus have been outside the list for 3 s at scrollTop 0. Otherwise a pill "2 updated, show" appears at the list top. Active and focused rows never move.

## 4. Nesting and roll-ups

- Sidebar rows are roots with a chevron and a sub-agent chip. Children are collapsed by default.
- **Auto-expand at mount or navigation only**: the path to the active session and roots with an attention descendant. Later arrivals add only the chip and the Needs-you row.
- Up to 8 children visible, promoting attention and running ones; "N more" reveals up to the 50 cap, then "Open in Sessions". A third level collapses to "+N deeper".
- Breadcrumb "Root › child" in Needs-you rows, search results and the session header [CL].
- **Collapsed folder header**: name, root count, then at most two chips in fixed order: needs, running.
- Triage caps: Needs you 5 rows, Pinned 8, then "N more" linking to `/sessions` [CL].

## 5. Scale

- **Windowing**: flatten visible Library nodes into one array and virtualize with fixed 32 px rows (44 px coarse), overscan 8; the focused row stays mounted.
- **Eager**: first load pages `listSessionsPage` (limit 200, keyset `updatedAt DESC, id DESC`) to the end or 2,000 rows, rendering progressively; plus `listSessionGroups`. Attention fields need `getSession` for flagged rows only, until backend row 1 lands.
- **Polling now**: every 4 s fetch page 1 and merge by id (state writes bump `updated_at`); a full sweep every 60 s and on focus catches deletions; hidden tabs poll at 30 s. Push replaces this.
- **Search**: instant over loaded rows (title, agent, summary, id) as a flat breadcrumbed list; while `hasMore`, say "Searched 800 of 1,240". Server search follows backend row 6.

## 6. Keyboard and accessibility

- Triage: `role="list"` of links. Library: `role="tree"` with `treeitem`, `aria-level`, `aria-posinset`, `aria-setsize` (required under virtualization), `aria-expanded`. Accessible name: title, state word, reason [N1].
- One tab stop per zone (roving `tabindex`) plus a skip link. Up/Down move, Right expands or enters, Left collapses or goes to the parent, Home/End, Enter opens. Type-ahead (700 ms) searches the flattened model, not the DOM.
- `p` pin, `m` menu, Alt+Up/Down reorder. `n` / Shift+N cycle attention items; global `g n` and a palette entry do the same [N7].
- A polite live region announces Needs-you increases only, debounced 2 s.
- Focus is tracked by session id and zone. Re-sorts are gated (section 3); a removed row falls back via `focusAfterChange`.

## 7. One model, two surfaces

`packages/flightdeck/src/data/session-tree/` holds pure, unit-tested functions. No component calls `sessionState` or `needsYou`, or filters rows itself (lint-enforced).

```ts
deriveState(s: Session, now: number): SessionState
attentionOf(s: Session, c: {me: string|null; acked: ReadonlySet<string>; now: number; stuckMs: number}): Attention | null
buildIndex(rows: Session[], groups: Group[], c: IndexCtx): TreeIndex
rollup(ix: TreeIndex, target: string | {groupId: string}): Rollup
buildViews(ix: TreeIndex, p: Prefs): {needs: Attention[]; pinned: string[]}
settleOrder(prev: OrderSnapshot, ix: TreeIndex, c: {interacting: boolean; now: number; force?: boolean}): OrderSnapshot
flattenLibrary(ix: TreeIndex, o: OrderSnapshot, expanded: ReadonlySet<string>, f: Filter): LibraryNode[]
searchRows(ix: TreeIndex, q: string): Hit[]
typeAhead(nodes: LibraryNode[], buffer: string, fromId: string | null): string | null
```

`useSessionTree()` is the only selector. The sidebar renders `buildViews` plus `flattenLibrary`; `/sessions` renders the same nodes with columns and a `Filter`. Parity tests on one fixture: folder counts plus Unfiled equal "Sessions N"; facet count equals filtered rows; sidebar and page give identical `needs`.

## 8. Backend changes

| # | Change | Removes | Priority |
|---|---|---|---|
| 1 | List rows carry `pendingQuestion`, `pauseState`, `cron*`, `waitUntil`, `lastActiveAt` | per-row `getSession`, dead hold branch, weak stuck | P0 |
| 2 | `listSessionsPage` filters: `updatedAfter`, state, `rootOnly`, `parentId`, `groupId`, owner | full sweeps, client scans | P0 |
| 3 | Group roll-ups: running only, `input_required` split from waiting, descendant counts, `attentionCount`; order by `sortKey` | idle counted running, roots-only counts, summary reorder | P1 |
| 4 | Partial profile patch | lost updates against the classic portal | P1 |
| 5 | List-change push | 4 s polling | P1 |
| 6 | Server search `q`; paged group listing | loaded-rows caveat | P2 |
| 7 | Server-side ack and `attentionSince` | profile acks, client `since` | P2 |

**UI-only first**: the session-tree module, views, settled ordering, roll-ups from cache, Needs-you reasons, Done fold, nesting, search, keyboard model, folder `sortKey`, rename and delete via existing operations, pins and acks through profile read-merge-write (race accepted until row 4), and paging with the delta poll.
