# Sessions navigation: synthesis of the three expert memos (draft 1, for Codex discussion)

Inputs: `00-backend-audit.md`, `01-product-designer.md`, `02-ux-researcher.md`, `03-information-architect.md`. The classic portal is a reference only.

## Where the experts agree (adopt)

1. **Attention first, folders second.** A triage zone answers "what needs me" in under two seconds; user folders answer "where did I put it" and must work with zero folders configured.
2. **Needs you is a derived queue of references.** Question, budget or provider hold, failure (unacknowledged), plus a UI-only "stuck" rule. Ordered by how long it has been waiting (stable, arrivals append), capped at 5 rows then "N more". Each row carries a reason line (the question, the error headline, the hold and resume time). Owner-scoped: only sessions I own, so an admin never sees others' failures in their queue.
3. **Counts must never disagree.** One pure derivation module (`data/session-tree/`) feeds the sidebar and the `/sessions` page; parity tests on one fixture. Every number has a defined unit (roots vs sessions).
4. **Folder headers tell the truth:** real member count, a needs chip and a running chip, never "Empty" while members exist; folders in manual order stored in group metadata (`sortKey`), never reordered by summary activity.
5. **Sub-agents:** a chip with the worst-descendant roll-up on the root; children collapsed; auto-expanded only on mount or navigation when a child needs you or failed; depth cap 2; a "Parent › child" breadcrumb inside the queue; failed child under a healthy parent is a severity-4 case and must surface.
6. **Stable lists:** render from a settled snapshot; polls update content in place, not position; "N updated, show" pill while the pointer or focus is in the list.
7. **State glyphs are distinct shapes per state** (question, failed, hold, running, asleep, idle, done), never reused for a different meaning; a hold must not look like routine waiting.
8. **Scale:** keyset paging (`listSessionsPage`, 200), virtualized rows, delta poll of page 1, no full-list poll.
9. **Keyboard:** roving tab stop, type-ahead, next/previous attention item from anywhere, quick switcher; list or tree ARIA matched to what is rendered.
10. **Backend asks (P0):** list rows carry `pendingQuestion`, `pauseState`, `cron*`/`waitUntil`, `lastActiveAt` (and the row-level descendant roll-up); `listSessionsPage` filters (`updatedAfter`, state, `rootOnly`, `parentId`, `groupId`, owner). Without them the queue's reason lines degrade, so UI-only first, backend next.

## Where they disagree (needs a decision)

| # | Question | Designer | IA | Researcher | Draft position |
|---|---|---|---|---|---|
| D1 | Does Pinned move a session out of its folder? | Yes, like Claude (folder count still includes it) | No: Pinned is a view; one home; marker on the home row | Index not relocation (applies to the queue) | **No move.** A session has exactly one home; Pinned and Needs you are views with a location suffix and a pin glyph at home. Revisit if 40-row sidebars feel duplicated. |
| D2 | Where does finished work go? | Global collapsed "Done" (client retire state, seen+1h) | Collapsed "Done N" fold per container, derived from terminal status (no client state) | Done auto-collapsed | **Per-container derived fold**, plus a tab-wide "Done" count in the sidebar footer; no client-side retire state. |
| D3 | Group a hold or repeated failure into one queue row? | Yes ("Anthropic on hold, 6 sessions") | No grouping (stable per-session rows) | Split by kind | **Group only holds and identical failure causes when 3 or more**, expandable; owner question. |
| D4 | Scope: peek card, drag and drop, swipe actions, top-bar stepper, ⌘1-9 pins | Included | Not specified | Not specified | **Phase 2.** Phase 1 ships structure, derivation and keyboard. |
| D5 | Sidebar's own sort of unfiled sessions | Last meaningful event | Activity bucket (5 min) with settled order | Pinned, folders manual, Unfiled by activity | **Activity bucket + settled order now; `lastActiveAt` from backend later.** |
| D6 | Is "stuck" a queue kind? | Not mentioned | Yes, UI-only (running and silent 20 min) | Stuck or budget-burning is task 4 | **Yes, but labelled "Quiet for 20 min", never "Failed".** |
| D7 | "Shared with me" | Mine plus shared; fleet on page | A filter, not a section | Virtual section | **Filter in the sidebar header, section on `/sessions`.** |

## Proposed sidebar (272px), phase 1

```
[+ New session]                 [<]
Search or jump…               ⌘K
Overview · Boards · Outputs · Library          (page links, unchanged)
------------------------------------------------
Sessions  12 live · 5 asleep         [filter]
 Needs you 3
  ◆ Investigate p95 spike     12m
     Asks: roll back or hold?
  ⏸ Anthropic on hold · 6 sessions
     resumes 14:20
  ✕ Weekly dependency bumps   3h
     Rate limited after 3 retries
 Pinned
  ◔ Release readiness ⑂3
 Folders (only if any)
  ▸ Release 0.8.8   5   ✕1 ◔2
  ▸ Ops             3
 Unfiled
  ◔ Customer research digest
  … Show more
 ▸ Done 14
```

Row: glyph (distinct shape per state) · title · one trailing item by priority (unseen dot, else wake time, else sub-agent chip). Line two only for exceptions (question, cause, hold). Peek, agent, model and context live behind hover or Space (phase 2).

## Phasing

1. **UI-only (no backend change):** `data/session-tree/` module; views (Needs you, Pinned); folder headers with true counts and chips; stable ordering; sub-agent chips and roll-ups from loaded rows; per-container Done fold; reason lines using `getSession` for the few needs-you rows and `listPausedSessions` for holds; pins, acknowledgements and manual folder order via profile read-merge-write and group `metadataPatch`; folder rename and delete; paging with the delta poll; keyboard model.
2. **After backend row work:** list rows with question, pause, cron and `lastActiveAt`; server filters; correct group roll-ups; partial profile patch; list-change push.
3. **Phase 2 design:** peek card, drag and drop, phone swipe, top-bar stepper, ⌘1-9.

## Open owner questions

1. Does a failure leave Needs you when opened, or only when fixed? (Draft: when opened or dismissed; a new failing turn re-raises.)
2. Will the backend rows (P0) be funded? The queue's reason lines depend on them.
3. How many operators actually use folders? (Measure first; if few, the sidebar folder section stays collapsed by default.)
4. Is the pins and acknowledgement state living in the profile blob acceptable, race with the classic portal included?
5. Should hold grouping (D3) exist?
