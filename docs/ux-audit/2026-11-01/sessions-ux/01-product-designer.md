# Flight Deck session navigation: design memo

Mode: Operate. Person: one operator, 20-60 root sessions, glancing all day. Success: no question or failure waits unnoticed, any session is two keystrokes away, nothing moves under the pointer. Principles: NN (Nielsen), AS (app-screen rules), DC (design-critique passes).

**Thesis.** Claude and Codex sidebars are a library of conversations you drive. Ours is a dispatch board for work that drives itself. **Places contain, queues point:** a folder or Pinned holds a session once; Needs you is a queue pointing at sessions that stay where they live.

## 1. Critique

**Claude gets right (image 1):** stable noun headers; one-line title-only rows; icons only as exceptions (branch, sync-off); detail kept off the row (Context 19% sits in the right panel); a title dropdown with accelerators (R, A, D, image 2); back/forward in the chrome. Codex, as I understand it, adds a running spinner, an unread dot and Archive. [AS: navigation recedes]

**Does not transfer:**
- *Project folders.* In Claude the folder is the cwd: automatic. Ours are manual private folders; supervisors do not file.
- *Time buckets.* `updated_at` moves on every state or summary write; a healthy session asleep for three days looks stale. State and next event are the axes.
- *Unread dots.* One bit means "finished" in Claude. Our sessions emit constantly; a dot per change is wallpaper.
- *Archive as hide.* Asleep is not done.
- *One thread, one row.* A root is a tree of up to 50 sub-agents.

**Image 5 against image 1.** It keeps Claude's calm and rightly puts Needs you first. It fails on:
1. Three taxonomies at one level in identical type: state (Needs you), folders (Release, Ops), pseudo-time (Recent is really Unfiled, completed included). [NN: match with the real world]
2. Needs-you rows are glyph plus title, no reason. You must open each to learn why; the question is the information.
3. The amber partial circle and the blue dot mean different things in different places. [DC: consistency]
4. Uniform grey weight: nothing scans.
5. Folder counts show leftovers, so they lie. [NN: system status]
6. No verbs (New, Search), pin or peek; "Sessions 8" spends the top on a label.

## 2. Information architecture

Order: **Needs you, Pinned, Folders, Sessions, Done.** Urgent and transient first, then your shortlist, then stable places. Empty sections vanish.

```
272px                               rail 56   phone drawer
+---------------------------------+ +-----+  +-------------------+
| Sessions          [+ New]  [<]  | | [+] |  | (search)      [x] |
| Search or jump...          ⌘K   | | [s] |  | Needs you 3 | All |
| 2 done, 1 failed since 14:02    | |-----|  |-------------------|
|---------------------------------| | !3  |  | ◆ Investigate p95 |
| Needs you 3                 ⌥↓  | |-----|  |   Asks: roll back?|
| ◆ Investigate p95 spike     12m | | [Re]|  |   12m             |
|   Asks: roll back or hold?      | | [No]|  | ⏸ Anthropic hold  |
| ⏸ Anthropic on hold, 6 sess.    | | [Ma]|  |   6 sessions      |
|   resumes 14:20                 | |-----|  | ✕ Weekly dep bumps|
| ✕ Weekly dependency bumps   3h  | | (f) |  |-------------------|
|   Rate limited after 3 retries  | +-----+  | Pinned  Folders   |
| Pinned                          |          | Sessions  Done    |
| ◔ Release readiness      ⑂3     |          | [+ New session]   |
| ◌ Nightly cost report  wakes 2h |          +-------------------+
| Folders                         |
| ▸ Release 0.8.8   5  ✕1 ◔2      |
| Sessions  12 live               |
| ◔ Customer research digest  4m  |
|   Show 31 more                  |
| ▸ Done 14                       |
|---------------------------------|
| All sessions ->   12 live 5 asleep |
+---------------------------------+
```

**Needs you** is a derived queue: a pending question, an unseen failure, a budget or provider hold. Completion is not attention (it gets a dot).
- Order: questions, holds, failures; oldest wait first ("12m"). A queue is first-in, first-out, not recency.
- Group by cause using `failureKey`: "Anthropic on hold, 6 sessions" is one row; one fix clears N.
- Two-line rows; line two is the question or cause. Cap 5, then "+N more".
- A question stays until answered. A failure leaves when opened or snoozed, keeping its red glyph at home.
- Empty, it becomes one line: "All clear, 12 running, 5 asleep". [AS: honest zeros]
- **Versus Pinned:** Needs you is system-computed, expiring and wait-ordered; Pinned is your permanent, manually ordered watchlist of any state, capped at 9 to match ⌘1-9. A pinned failing session appears in both.

**Pinned lifts a session out of its folder** (as in Claude); the folder count still includes it. Pins live in the profile blob.

**Folders are second-class on purpose.** Shown only if you have any; each is one collapsed row: name, true `memberCount`, worst-state roll-up, manual order. Management lives on the page. State is the supervisor's axis, so the default must work with zero folders.

**Sessions** (replaces Recent): unfiled, not-done roots ordered by last meaningful event (state change, question, completion, user message), never summary writes.

**Sub-agents** show as a chip (`⑂3`) plus a tree roll-up glyph, worst child wins (needs, failed, hold, running, asleep, idle, done). Chip or → expands, depth 2, 5 shown. A root auto-expands only when a child needs you or fails, and re-collapses on resolve. In the queue a child carries "in Release readiness". Running children never auto-expand.

**Retiring.** Completed roots keep their place with a dim check (and a dot if unseen). Seen plus one hour, or E, moves them to **Done**: collapsed, last 7 days. No server archive exists, so this is client state in the profile blob.

**Large lists.** Windowed. Defaults: Pinned 9, Needs you 5, Sessions 12 then "Show 31 more". Load the first keyset page plus pinned ids; stop polling the full list. [Miller, Hick]

**Rail:** plus, search, one badge button for the queue, pins as monogram tiles with a state corner, folders as one icon. **Phone drawer:** opens on Needs you (phone use is triage); rows always two lines at 56px; swipe right pins, left sends to Done, with Undo; long-press opens a sheet; no drag.

## 3. Row anatomy

`[glyph 16] [title] [trailing 40]`, 8px padding, 32px pitch (52px for two lines).
- **Glyph:** one shape per state, colour second: question ◆, failed ✕, hold ⏸, running spinning arc (the only motion), asleep dashed ring, idle ring, done check. Never reuse a glyph. [AS: colour goes on data]
- **Trailing, one item by priority:** unseen dot, else wait or wake time, else chip. A person glyph after the title marks shared-with-me.
- **Line two only for exceptions:** question text, cause, hold and resume time, parent breadcrumb. About a third of rows at most. Running, asleep, idle and done are one line.
- **Not on the row:** agent, model, context, schedule, folder. They live in the **peek** (Space, or 600ms hover) with summary and blockers.
- **States:** hover is one tone step; the trailing slot swaps to pin and ⋯ without layout shift. Selected is a neutral filled pill, no coloured bar. Focus is a 2px inset ring.
- **Menu** (right click, ⋯): Pin P, Rename R, Move M, Mark unread U, Snooze, Copy link L, Move to Done E; a rule; then Complete, Cancel, Delete in red, no accelerator, each confirming the tree count.
- **Drag:** onto a folder moves the tree (ghost: "+3 sub-agents move with it"); onto Pinned pins. Children and queue rows are not draggable. Keyboard: M, ⌥↑↓.
- **Keyboard:** one roving-tabindex tree: ↑↓, ←→ expand, Enter, Space peek, `/` filter. ⌘K switcher: empty shows Needs you then recents; typing searches title, agent, summary, id. ⌘1-9 jump to pins. ⌥↓/⌥↑ next and previous needing you, even from the composer. ⌃Tab flips between the last two sessions.

## 4. Sidebar, page, top bar

- **Sidebar = jump and triage:** bounded, about 40 rows, one session at a time. No filters, columns, multi-select or folder management.
- **/sessions = the fleet:** all sessions (all owners for admins), keyset paged, filters, columns, bulk actions, folder management. Many sessions or folders: page. This one, or jump: sidebar.
- **Top bar:** breadcrumb "Folder › Parent › Title ▾" whose dropdown carries every session action; status cluster (state and reason, "wakes in 2h", model, context meter); while the queue is non-empty, a stepper "1 of 3 need you ‹ ›"; right menu for panes (sub-agents, schedule, canvas, sharing).

## 5. Feel

- **Arrival:** a row grows 180ms ease-out with a one-tone-step flash; no glow, no sound; none under reduced motion.
- **Frozen under the pointer:** while pointer or focus is in the list, reorders wait behind a "+2 updates" pill. Questions still reach you via the tab title "(3)" and `aria-live=polite`. [NN: user control]
- **Two bits, not one:** Needs you is objective and persists until resolved. The blue dot means new and unseen, set only by a final result, question, failure or canvas update, never by progress or summaries. It clears after one second open and focused.
- **Since you left:** after five minutes away, one head line, "2 done, 1 failed since 14:02"; click lights only those rows. Reuses the existing stamp.
- **Undo:** pin, move, retire, rename and snooze are optimistic with a six-second Undo and ⌘Z. Destructive actions confirm instead.

## 6. What I would not build

1. Time buckets or recency as the primary order.
2. Nested, shared or smart folders, or tags.
3. Cost, token, model or agent badges on rows.
4. An always-expanded sub-agent tree.
5. Multi-select, bulk bars or sound alerts in the sidebar.

## 7. Owner questions

1. Sidebar is mine plus shared-with-me, with the all-owner fleet on the page only?
2. Does a failure leave Needs you when seen, or only when fixed?
3. Is Done as client state in the profile blob acceptable, race with the classic portal included?
4. Unseen state per browser or cross-device? Will you fund list rows carrying `pendingQuestion`, `pauseState` and cron? The queue's reasons depend on them.
5. How many operators use folders? If few, drop the sidebar section.
6. Do scheduled and sleeping sessions get their own lens, as Claude has Scheduled?
7. May a hold collapse to one queue row?
