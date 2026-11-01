# Session navigation: jobs-to-be-done and design evaluation

2026-11-01. UX research memo for the Flight Deck sessions-navigation panel.

**Method and honesty.** I could not run interviews, observe operators or read usage analytics. Methods: task analysis, scenario walkthroughs (cold open after 8 hours away; 02:00 page on a phone; handover), heuristic evaluation of reference screenshots 1 and 5 (visibility of status, recognition over recall, error prevention), cognitive-load analysis (Hick's law, chunk count, error severity), and the design-critique framework. Tags: **[E]** observed in the repo, backend audit or screenshots; **[H]** hypothesis, unvalidated. All scores are my judgement, not measurements.

## 1. Personas and contexts (roles [E]; behaviours [H])

| Persona | Context | Needs from navigation |
|---|---|---|
| On-call operator | Dozens of sessions, interrupt-driven, often on a phone | Triage in seconds: who needs me, what broke, what is stuck. No organising effort. |
| Builder | Runs own agents across projects; returns to work | Resume, group by project or release, finished work out of the way. |
| Admin | Fleet-wide view of others' sessions [E] | Cross-owner failures and holds, scoped by owner. Cannot see others' private folders [E]. |
| Shared-session viewer | Reads shared sessions, maybe no write access | A "shared with me" place, owner and access tags, own private folders. |

## 2. Tasks ranked by frequency x cost of failure (1-5 each; [H])

Tasks 1, 3, 4 and 6 need signals the list rows lack today [E: audit rows 14-15].

| # | Task | F | C | Score | Answer in 2 s | Signals required |
|---|---|---|---|---|---|---|
| 1 | What needs me right now? | 5 | 5 | 25 | How many, which, what is asked | question text, kind |
| 2 | What finished or failed while I was away? | 5 | 4 | 20 | What changed since last visit | since-last-visit marker, error line |
| 3 | What are X's sub-agents doing; failed child under healthy parent? | 4 | 4 | 16 | Worst child beside the parent | descendant roll-up |
| 4 | Anything stuck or burning budget? | 3 | 5 | 15 | Paused, errored, overlong | pauseState, run time, spend |
| 5 | Continue yesterday's work | 4 | 3 | 12 | Which session, where I left off | recency, summary |
| 6 | Sleeping: expected or stuck? | 4 | 3 | 12 | Wakes 14:00 vs no timer | waitUntil, cron |
| 7 | Jump back to the session I was just in | 5 | 2 | 10 | One stable place | stable position |
| 8 | Find last week's session by what it did | 3 | 3 | 9 | Hit with context | searchable summary |
| 9 | Clear finished work out of the way | 4 | 2 | 8 | Done leaves the working set | terminal state, age |
| 10 | Admin: triage others' sessions | 2 | 4 | 8 | Whose, which kind | owner tag |
| 11 | Group by project or release | 3 | 2 | 6 | Folder, true count | folder roll-ups |
| 12 | Hand off, or open what was shared with me | 2 | 3 | 6 | Shared tag, who | owner, share state |

## 3. Task x design matrix (0 weak, 3 strong; [H])

A flat recency + state filters. B attention-first lists. C folders + pins. D hybrid (attention strip, pinned, folders, unfiled). E project by working folder.

| # | A | B | C | D | E | Why |
|---|---|---|---|---|---|---|
| 1 | 1 | 3 | 1 | 3 | 1 | A needs a filter click; C and E bury it in collapsed containers |
| 2 | 2 | 2 | 1 | 2 | 1 | Needs the since-last-visit marker in any layout |
| 3 | 1 | 2 | 1 | 2 | 1 | The roll-up signal matters, not the layout |
| 4 | 1 | 3 | 0 | 3 | 0 | A paused session in a folder looks idle |
| 5 | 3 | 1 | 2 | 2 | 2 | B moves sessions between buckets as state changes |
| 6 | 1 | 3 | 1 | 2 | 1 | B's Waiting bucket shows wake times; D only if rows do |
| 7 | 3 | 1 | 2 | 2 | 2 | Position stability |
| 8 | 1 | 1 | 2 | 2 | 2 | Search is the real answer; folders narrow it |
| 9 | 1 | 3 | 2 | 3 | 1 | Auto-collapsed Done beats manual tidying |
| 10 | 2 | 2 | 0 | 2 | 1 | Private folders do not apply to others' sessions |
| 11 | 0 | 0 | 3 | 3 | 2 | E needs a working folder and is not "release" |
| 12 | 1 | 1 | 1 | 2 | 1 | Virtual "Shared with me" section |
| **Weighted /441** | **213 (48%)** | **305 (69%)** | **175 (40%)** | **348 (79%)** | **169 (38%)** | weights from section 2 |

D beats B by only 19 points once tasks 11 and 12 are ignored. Designs differ mainly on tasks 1, 4, 6 and 9 (attention structure, not folders). Tasks 2 and 3 cap at 2 everywhere: signals decide.

Screenshots [E]: Claude desktop (1) is calm and stable, pinned first, with project headings: strong for tasks 5 and 7, but nearly stateless. Flight Deck (5) correctly lifts three items first, but the clock glyph is identical on "Customer research digest" (Needs you), "Nightly cost report" and "Release readiness", so a hold looks like routine waiting, and there is no reason line.

## 4. Cognitive load and error analysis

The current sidebar shows about 4 section headings plus rows [E]: fine at 8 sessions, untested at 40 [H]. Each extra parallel section slows the scan (Hick's law), so there must be one place to look first.

| Failure | Severity (4 blocks, 3 major) | Evidence |
|---|---|---|
| Child failed, parent healthy | 4 | Children hidden, failing ones appear as orphan rows [E] |
| Paused by budget looks idle | 4 | `pauseState` not on list rows; hold branch unreachable [E] |
| Needs-input inside a collapsed folder (pure C or E) | 4 | Current lift mitigates [E]; no roll-up badge |
| Hold, waiting and sleeping share a glyph | 3 | Screenshot 5 [E] |
| Counts disagree across total, facets, needs-you | 3 | Audit section 2 [E] |
| Folders reorder as summaries are written | 3 | mig:2142 [E] |
| "Empty" folder that holds attention rows | 3 | `sessions-sidebar.tsx:257` [E] |
| Row moves under the pointer on a poll | 3 | Focus kept for keyboard [E]; pointer [H] |
| Admin list fills with others' failures | 3 | Inferred from unscoped list [E] |
| Stale list shown as current | 3 | 4 s poll, no freshness mark [H] |

## 5. Visible without opening vs behind a click

**Per row, always visible [H]:** a state glyph with a distinct shape for question, failed, paused, running, sleeping (with wake time) and done; title; for attention rows one reason line (~80 characters of the question or error); sub-agent chip with the worst child state; owner or shared tag when not mine. **Chrome:** Needs-you count in the rail, phone tab and document title; attention roll-up badge and true count on collapsed folders; a freshness indicator.

**Behind a click:** full question, transcript, summary and blockers, spend breakdown, child list (auto-open only when a child needs me), folder management, group-by, sort, model, working folder, ids.

## 6. Validation plan and metrics

**Cheapest first.** Read-only counts on my own data or the demo dataset (no production database, no model spend): roots and folders per owner, share ungrouped, state mix, children per root, share with a working folder. These size assumptions 1 and 2.

**Five-minute test, five operators** who supervise at least 10 long-running agent sessions (the owner is one, and biased). Synthetic 40-session fixture in demo mode with planted traps: a question in a collapsed folder, a failed child under a healthy parent, a budget hold that looks idle, a normal sleeper, noise. Plain-word tasks: "You just got back; what needs you?", "Is anything wrong?", "Find last week's release-readiness session." Two variants (B-like, D-like), counterbalanced. Five people find severity-4 problems; they do not establish preference. Collect SEQ.

**Targets [H]:** median time to open the first needs-me session under 5 s; no trap missed by at least 4 of 5 people; 1 click to the target, never a folder expand first; SEQ at least 6. In-app after shipping: load to first needs-you open, needs-you sessions unopened after 10 minutes, folder-expand-before-open rate.

## 7. Recommendation and riskiest assumptions

**Recommend D, built attention-first.** (1) The strip is an index, not a relocation: capped (about 5, then "n more"), split by kind (questions, failed, paused), each with a reason line. The session keeps a marker in its home folder, so the tree stays true. (2) Collapsed folders show an attention badge and a true member count. (3) Children enter the strip as "Parent > child"; parents carry a worst-child chip. (4) Order below is stable: pinned, folders in manual order, then Unfiled by activity with Done auto-collapsed. (5) "Shared with me" is a virtual section. (6) Working folder is a chip and a group-by option, not the primary structure; Claude desktop's project grouping solves continuation, not supervision [H].

**Precondition [E]:** list rows must carry pending question, `pauseState`, wake time and descendant roll-up. Without them D cannot answer tasks 1, 3, 4 and 6 and degrades to a prettier A.

**Five riskiest assumptions**
1. Concurrent attention items stay under about 7; in a failure storm the strip becomes the whole list [H].
2. People create and maintain folders; if few do, Unfiled carries the load [H; check with section 6 counts].
3. One reason line suffices to decide "now or later", and agent summaries are good enough to fill it [H].
4. Operators trust the signal: states accurate and fresh. One false "all clear" sends them back to transcripts [H].
5. Showing a session twice reads as an index, and folder badges are noticed rather than ignored as noise [H].
