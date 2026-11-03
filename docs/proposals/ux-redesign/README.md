# PilotSwarm portal redesign

Status: proposal, 2026-10-30, branch `dev`. Nothing here is implemented yet.

This folder holds a full UX redesign of the PilotSwarm browser portal: what
is wrong today, the new information architecture, the screen designs, the
design system, the frontend stack, and a plan for moving there without
breaking the TUI or the canvas apps people already use.

| Document | What it covers |
|---|---|
| [This README](#) | Summary, principles, information architecture, screen designs, terminology, rollout |
| [mocks/](./mocks/) | Clickable high-fidelity prototype (open `mocks/index.html` in a browser) and screenshots |
| [design-system.md](./design-system.md) | Tokens, type, color, components, states, accessibility floor |
| [frontend-stack.md](./frontend-stack.md) | Why React + Vite + Tailwind v4, not Next.js; migration shape |
| [capability-map.md](./capability-map.md) | Every API capability and where it lives in the new UI |
| [research/](./research/) | The audits this proposal is built on (API, UI inventory, canvas, journeys, visual critique, usability and accessibility) and screenshots of the current portal |

## The short version

The portal can already do a lot. Durable sessions that sleep for days,
sub-agents, live canvases, working folders with git, multi-session
dashboards, providers with budgets, packages, feature flags, workers. The
problem is that almost all of it is hidden behind eleven unlabeled icons,
four mutually exclusive "modes", three different places for files, and a
terminal look that treats a browser like a character grid.

The redesign keeps every capability and gives each one a single, named home:

1. **A labeled navigation rail** replaces the icon toolbar: Home, Sessions,
   Boards, Outputs, Agent library, Providers, and (by role) Admin, plus
   Settings.
2. **Home answers "what needs me?"** Sessions waiting on your answer, failed
   turns, budget holds, what is running, what is scheduled and when it
   resumes, and the latest outputs.
3. **A session is one screen with five views:** Chat, Canvas, Files,
   Delegation (its sub-agents and in-session tasks), and Activity (today's
   Inspector). Chat stays on the
   left; the other views open beside it on desktop and as tabs on phones.
4. **Starting a session begins with the task**, not the model: one sheet with
   the prompt, the agent, and optional model, working folder and group.
5. **Every waiting state explains itself** in the session header and list:
   what it waits on, until when, and what you can do about it.
6. **Providers and budgets become one area.** Keys, defaults, limits and
   usage for each provider sit together.
7. **Canvas stays and gets better.** It becomes a first-class part of the
   session, with named tabs for each canvas, a gallery across sessions, a
   clear share dialog, and visible feedback when a click is refused.
8. **The URL always says where you are.** Every view is a route, so Back,
   reload, bookmarks and shared links work.
9. **⌘K finds anything.** Every action, session, board, canvas, agent and
   setting is one command palette away, and `?` lists the shortcuts.
10. **Phones get the same product**, including Admin, through a bottom tab bar.

Stack: keep React and the Vite single-page app, add TypeScript, Tailwind v4,
accessible primitives and URL routing, and reuse the shared `ui/core` state
layer. Next.js does not fit a portal that ships inside an npm package and
runs beside a long-lived WebSocket and Postgres relay. Details in
[frontend-stack.md](./frontend-stack.md).

## What we found

The full evidence is in [research/](./research/). The findings that shaped
the design:

**Navigation and discoverability**

- The header has eleven icon-only buttons (New, Filter, Back, Forward,
  Canvas, Diagnostics, Sessions, Master of Agents, Budget, Admin, Theme). Five
  of them switch between mutually exclusive modes that are flags, not routes
  ([02 §2.2](./research/02-portal-ui-inventory.md)).
- The address bar never changes. Browser Back leaves the app. A custom
  ten-step history with its own arrows stands in for it, desktop only.
- Linked items, multi-select and expand/collapse of a parent have no visible
  control. The user guide documents controls that do not exist (right-click
  menus, a select-mode toggle, a Summary/Chat toggle, slash commands).

**Core tasks**

- Starting a session asks for the model, then reasoning effort, then context
  window, then the agent: up to four dialogs before you can type
  ([04 J1](./research/04-journeys-and-parity.md)).
- Files live in three places: Inspector → files (artifacts), the Workspace
  tab hidden inside the canvas pane, and Manage session → Workspace.
- "Waiting" can mean a timer, a cron schedule, child sessions or a budget
  hold. Only the timer is documented. Nothing lists what is scheduled.
- Provider setup lives in Admin, provider spend in a separate Budget mode.
  The Admin console does not exist on phones.
- Complete, cancel and delete have different names on every surface.
- Worker errors are shown raw in the chat: a paragraph of environment
  variable names with no next step (see
  [screenshot](./research/screens/d01-home.png)).

**Canvas**

- Canvas is the agent's default way to show you something and the portal's
  most distinctive feature. 85–90% of it (tools, storage, relay, API, state)
  is independent of React ([03](./research/03-canvas.md)).
- Today it has eight overlapping presentation modes, shares a pane with the
  file browser, hides its slots, and fails silently when a click is refused.
- The sandbox does not block network calls from agent-written pages, and
  it lets pages open popups that escape the sandbox. This is a security fix
  to land now, independent of the redesign
  ([03 §5 S1](./research/03-canvas.md)). The fix has to cover both canvas
  hosts (the portal and the public share viewer, which both load canvases
  as `blob:` documents), inject the policy before any page script, and
  replace unrestricted popups with a host-mediated "Open link" that shows
  the destination first.

**Visual and accessibility**

- Monospace for the whole UI, about 50 font sizes, no spacing tokens, an
  11k-line global stylesheet, and pane borders at 1.26:1 contrast in the
  default theme.
- About 20 dialogs have no dialog role, focus trap or focus return, and Tab
  is captured inside them. Unmodified single keys cancel, complete or delete
  a session (each asks for confirmation).
- The 59 Playwright specs are not run in CI and there are no accessibility
  checks.

## Who it is for

From [research/04](./research/04-journeys-and-parity.md) (desk research;
validate with interviews):

| Persona | Does | Needs from the portal |
|---|---|---|
| **Operator** (core) | Runs agents on real work, several at once, some for days | See what each agent is doing, what it waits on, and what it made; steer or stop without losing work |
| **Fleet admin** | Runs a shared deployment | Providers, keys, budgets, flags, packages, workers, system sessions and audit in one place, including from a phone |
| **Collaborator** | Opens a shared session or a public canvas link | Read the result, follow progress, sometimes reply, with clear limits on what they can do |
| **Package author** | Publishes agents, skills and tools | Publish, see which workers run which version, fix a misbehaving agent |

## Design principles

1. **One home per object, one name per concept.** Every capability appears
   in exactly one primary place. Shortcuts may point to it; copies may not.
2. **Start from intent.** Ask what the user wants done, then fill the rest
   from defaults.
3. **State is visible and explained.** Status is shown with color, an icon
   and words, and always says what the user can do next.
4. **Outputs are first-class.** Files and canvases are destinations, not
   diagnostics.
5. **The URL is the source of truth for navigation.**
6. **Progressive disclosure, not hidden features.** Advanced controls sit one
   level down behind a labeled control, never behind a gesture or an
   unlabeled key.
7. **Explain what you cannot do.** Disabled controls say why.
8. **Phone parity by default.** Desktop-only features are the labeled
   exception.
9. **Calm by default, dense on demand.** Comfortable density for reading
   chats; a compact density for operators and for logs, tables and boards.

## Information architecture

### Global structure

```
PilotSwarm
├── Home                      /                      what needs you, running, scheduled, recent outputs
├── Sessions                  /sessions              list + filters + groups
│   └── Session               /s/:id                 Chat ▸ Canvas · Files · Delegation · Activity
│       ├── Canvas            /s/:id/canvas/:slot    (also full-screen focus)
│       ├── Files             /s/:id/files/outputs[/:name] · /s/:id/files/folders/:folder[/*path]
│       ├── Delegation        /s/:id/delegation      sub-agent tree with results + in-session tasks
│       └── Activity          /s/:id/activity/:view  Timeline · Logs · Nodes · History · Stats (incl. Memory)
├── Boards                    /boards/:id            saved tiled views (was Master of Agents)
├── Outputs                   /outputs               Canvases · Files, across every session you can see
├── Agent library             /library               Agents you can start · Canvas apps · Packages
├── Providers                 /providers             providers (keys · limits · usage) · Defaults · GitHub Copilot
├── Admin (admins only)       /admin                 Feature flags · Workers (+ Logs) · System sessions · Access & audit · Knowledge · Cluster usage · Maintenance
└── Settings                  /settings              Profile · Appearance · Shortcuts · My feature flags · Notifications
Public, no sign-in:           /c/:token              shared canvas viewer (own small bundle)
```

The rail shows Home, Sessions, Boards, Outputs and Agent library at the top, then
Providers, then Admin (only for admins) and Settings at the bottom with the
user's name and the connection status. **New session** is the primary button
at the top of the rail on every screen.

### Where today's features go

| Today | New home |
|---|---|
| ＋ New session (model → effort → context → agent) | **New session** sheet: prompt, agent, then optional model/effort/context, working folder, group |
| Filter button, owner filter, sort icons, Find a session | Sessions list toolbar: search, filter chips (Mine · Shared with me · All), State, Agent, Group; sort menu |
| Back / Forward arrows, `Alt+-`/`Alt++` | Browser Back/Forward (real routes) |
| Canvas toggle + Canvas/Workspace side-pane tabs | Session → **Canvas** view; Session → **Files** view |
| Diagnostics toggle (Inspector + Activity) | Session → **Activity** view |
| Inspector → files (artifacts), with its "all sessions" filter | Session → Files → **Outputs** (This session · With sub-agents); **Outputs → Files** for everything you can access; Home → Recent outputs |
| Inspector → sequence, logs, nodes, history, stats | Session → Activity → Timeline, Logs, Nodes, History, Stats; fleet stats → Admin → Cluster usage |
| Manage session (General, Access) | Session header: **Share** button + **⋯** session menu |
| Terminate → Session Lifecycle modal | ⋯ menu danger section: Complete, Cancel, Delete (with cascade count); bulk bar in the list |
| Copy link button | ⋯ menu → Copy link (the URL is also always current) |
| Pin, Group (folder) buttons | Row ⋯ menu and drag; list "Select" mode with a bulk bar |
| Master of Agents | **Boards** |
| Budget (Providers, Cluster summary, Agents) | **Providers** (per provider: Usage, Limits); Admin → Cluster usage |
| Admin console / Settings (one panel, two names) | **Providers**, **Admin** and **Settings**, split by what they manage |
| Admin → Packages | **Agent library** → Packages (shared scope controls visible to admins) |
| Admin → Workers | Admin → Workers |
| System sessions (top of the session list, admin restart) | Admin → System sessions; also listed in Sessions under a collapsed **System** group |
| Theme button (20 themes) | Settings → Appearance (light, dark, system, density, and the classic themes); ⌘K "Change theme" |
| Single-key shortcuts | ⌘K palette and `?` overlay; destructive actions need a modifier |
| API/MCP only: audit log, knowledge store, paused-session list, artifact pin/copy | Admin → Audit log; Admin → Knowledge; Home → Waiting; Files → Outputs ⋯ (Pin, Copy to session) |

The complete mapping of every API operation is in
[capability-map.md](./capability-map.md).

## Screen designs

The clickable prototype in [mocks/](./mocks/) shows each of these with
realistic data. Screenshots are next to it.

### App shell

- **Rail** (desktop 232px, collapsible to 64px icons with tooltips; tablet
  collapsed by default; phone becomes a bottom tab bar with Home, Sessions,
  Boards, Outputs and More).
- **Top bar** inside each area: breadcrumb title, area actions on the right,
  ⌘K search field. No global icon toolbar.
- **Connection status** sits at the bottom of the rail: Connected, Reconnecting
  (with retry countdown), Offline. It turns into a banner only when it
  matters.
- **Toasts** (bottom right) confirm async results: "Session completed · Undo".

### Home

Four stacked sections, each hidden when empty:

1. **Needs you** — sessions asking a question (`input_required`), failed
   turns, budget holds, workspaces that failed to clone, unpushed clones about
   to expire. Each row has its own action: Answer, Retry, Raise limit, Open.
2. **Running** — live sessions with the agent, the current step and elapsed
   time.
3. **Scheduled and waiting** — sleeping sessions sorted by when they wake:
   "Nightly cost report · cron · next run 02:00 (in 6h 12m)", "Release
   watcher · waiting on 3 sub-agents". Wake now is one click.
4. **Recent outputs** — the newest files and canvases across your sessions.

A blocked state replaces Home when nothing can run, and names the cause:
no usable provider ("Add a model provider to start", with the two paths:
your own key, or ask an admin for a shared one), no workers running, or a
provider that is not set up on the workers. It works on phones.

### Sessions list

- Rows: state icon + label, title, agent, last activity, and chips for the
  waiting reason, unseen canvas updates and sub-agent count.
- Sections: Pinned, then groups (collapsible), then ungrouped, then System
  (collapsed, admins only).
- Toolbar: search (instant), filter chips, sort menu (Recent activity,
  Recently opened, Manual order), **Select** button. Select shows checkboxes
  and a bulk bar: Move to group, Complete, Cancel, Delete.
- The list is also the left column of the session screen on wide screens, so
  switching sessions keeps you in place.

### Session

```
┌ Session header ─────────────────────────────────────────────────────────┐
│ Release readiness 0.8.8      ● Waiting on 3 sub-agents · since 14:02     │
│ release-captain · claude-sonnet-5 · repo pilotswarm@dev   [Share] [⋯]   │
├ Chat ─────────────────────────┬ [Canvas 2] Files  Delegation 3  Activity ┤
│ transcript                          │ ┌ Release checklist ▾ ┐ Timeline  ⤢ ⋯│
│  · messages                         │ │ live canvas (sandboxed)           │ │
│  · tool calls as one-line rows      │ │                                   │ │
│  · task and sub-agent cards         │ │                                   │ │
│  · "Drew Release checklist · Open"  │ │                                   │ │
│  · questions as inline forms        │ └───────────────────────────────────┘ │
│ ┌ composer ──────────────────────┐  │                                       │
│ │ Message release-captain…   📎 ↵│  │                                       │
│ └ Stop · Steer · Queue ──────────┘  │                                       │
└─────────────────────────────────────┴───────────────────────────────────────┘
```

- **Header**: title (click to rename), agent, model, working folder, state
  pill with its reason and next time, **Share**, and the **⋯ session menu**:
  Rename, Pin, Move to group, Change model, Working folder, Regenerate
  context, Copy link, Export history, then a separated danger section
  (Complete, Cancel, Delete) that names what cascades ("Also cancels 3
  sub-agents").
- **Chat** is always on the left. The right side (the companion) shows one
  of Canvas, Files, Delegation or Activity, chosen by the view tabs. It opens
  by itself only when the session has a canvas; otherwise the chat is full
  width and the view buttons sit in the header. The split is resizable and
  remembered. Either side can take the full width (focus) for long tool
  output or a large canvas; Esc returns.
- **Width rules** (container widths, not device names): chat needs 360px and
  the companion 400px. When the space is short, the session list collapses
  first, then the rail folds to icons, then the session switches to tabs
  (Chat, Canvas, Files, Delegation, Activity) as on phones. While Chat is
  hidden, a question or error from the agent shows as a persistent badge on
  the Chat tab.
- **Sub-agents** open as their own session with a parent breadcrumb
  ("Release readiness 0.8.8 › Run test campaign").
- **Transcript**: messages; tool calls as one-line rows that expand; native
  tasks as cards; sub-agent spawns as cards that link to the child; canvas
  draws as cards with Open; files the agent wrote as file chips; questions
  from the agent (`ask_user`) as inline forms with the choices as buttons.
- **Errors** are structured: a plain sentence, the fix as a button, and the
  raw detail behind "Show details". Example: "This session can't reach its
  model. The anthropic-wif provider isn't set up on the worker. [Open
  provider] [Switch model] [Retry now] [Show details]".
- **A failed turn stays in the transcript** with the user's prompt, the
  error and Retry. Today the chat falls back to the splash after three
  retries, the prompt disappears and the session reads Idle
  ([06](./research/06-usability-a11y-audit.md)).
- **One state everywhere.** The header, the list row, the board tile and the
  Delegation view read the same selector, so a session can never be Error in one
  place and Idle in another. Times use the viewer's time zone throughout.
- **Composer**: Enter sends; while a turn runs the buttons are **Stop**
  (says "discards this turn's work"), **Steer** (adds guidance to the running
  turn; disabled with a reason when the flag is off), and **Queue** (runs
  next). Queued messages sit above the composer with edit and remove. `/`
  opens the session's commands; `@` attaches a file from the session.
- **Canvas view**: a tab strip with each canvas by name and an "updated" dot;
  Share, Zoom, Open full screen, and an auto-open toggle in the ⋯ menu.
  Refused clicks show a toast on the canvas ("View-only access: this canvas
  can't send actions"). Empty state suggests prompts that suit the agent.
- **Files view**: **Outputs** (files explicitly shared with the session:
  your attachments and files the agent publishes; preview, download, pin,
  copy to another session, delete; scope This session or With sub-agents)
  and
  **Folders** (working folder, home, shared: tree, editor, find, upload,
  move, git changes and commits). A working-folder file reaches Outputs
  only through an explicit **Publish to Outputs**. Canvas apps that use
  files show a "Uses files: work/**" chip.
  **Folders** belong to the session owner. Collaborators and admins see the
  Folders tab disabled with that reason and get Outputs only.
- **Delegation view**: the session tree (this session, its sub-agents and their
  children) and in-session tasks in one list with a legend, each with state,
  last digest time, the sub-agent's result (verdict and summary) once it
  finishes, and actions (Open, Stop turn, Message). Sub-agent cards in Chat
  show the same result.
- **Activity view**: starts from questions ("Why is it waiting?", "Why did it
  fail?", "Where is it running?") that open the right view pre-filtered;
  then the full Timeline (sequence), Logs, Nodes, History (with Export) and
  Stats, which includes a read-only **Memory** section (retrieval and graph
  use, session facts) when the deployment's store supports it.
- **Schedule popover**: when a session runs on a schedule, its state pill
  opens next run, interval, time zone and runs so far, with Pause, Cancel
  and Wake now once the API supports them. The Sessions State filter has a
  **Scheduled** option.
- **Share dialog**: General access, People, and an **Access history** tab
  where the owner sees who opened the session. When the deployment does not
  enforce ownership, the dialog says so plainly.

### New session

One sheet, opened by **New session**, ⌘N, or "Start" on an agent card:

1. **What should the agent do?** A large prompt box (optional; you can start
   empty).
2. **Agent**: cards for the agents you can use, with one-line descriptions
   and recent ones first. The default is preselected.
3. **Options** (collapsed, showing the current values): model (your default),
   reasoning effort and context window when the model supports them, working
   folder (none, a repo to clone, or a folder), group. Only models the
   workers can actually run are offered; the rest are listed as unavailable
   with the reason.
4. **Start session** sends the prompt and opens the session.

No provider: the sheet shows the first-run state inline instead of failing
after submit.

### Boards (was Master of Agents)

- Saved tiled views of chats and canvases, up to five boards with up to
  sixteen tiles each (today's limits).
- **Add tile** opens a picker: session, then Chat or a named canvas.
- Every tile has the same header as the session: title, state pill, Open,
  and the session ⋯ menu, so sharing and lifecycle work inside a board.
- Split, resize and drag stay; a single **Focus** mode (F) replaces zen,
  maximize and full screen.
- Phones show one tile at a time with the minimap and swipe, as today.

### Outputs

Everything your agents produced, across every session you can see. Each card
links to its canonical place in the session.

- **Canvases**: newest first, with thumbnail, session, updated time and an
  unseen dot.
- **Files**: every output file you can access (today's "all sessions"
  filter), searchable and filterable by session and agent.

### Agent library

- **Agents**: every agent you can start, grouped by package, with a
  description, the tools and skills it brings, and **Start session**.
- **Canvas apps**: published canvas apps (`find_canvas_app`) with "Use in a
  session".
- **Packages**: yours and shared, with version, enabled state, upload or
  import, promote to shared (admins), editors, delete. Which workers run
  which version is shown to admins (the API is admin-only today).

### Providers

- A summary row: this month's token use against limits, and any holds.
- A table of providers (yours and shared) with type, models, key status,
  a "Default" badge where it is used as one, and tokens used today, this
  week and this month against limits.
- Limits are token counts per day, week or month (for all models or one).
  The allowance is one percentage that applies to each person. A hold pauses
  new turns and has its own **Release** action; it is separate from limits.
  Showing money instead of tokens would need per-model prices, which the
  backend does not have.
- Provider detail tabs: **Overview** (key, models, test connection),
  **Limits** (per period, per-user allowances, holds), **Usage** (chart and
  per-agent breakdown).
- **Defaults** (area-level tab, because defaults are deployment-wide
  `provider:model` choices, not per provider): my default, and for admins the
  cluster and system defaults, each with its restart behaviour spelled out.
- **GitHub Copilot**: your Copilot key, and for admins the system key and the
  one-time adoption of a legacy key (shown as a banner until done).
- Users who cannot change a shared provider's limits see **Open provider**
  where admins see **Raise limit**.

### Admin

- **Feature flags**: cluster and per-user values; each flag's **History** is
  its home for change audit.
- **Workers**: version, packages and load per worker, package adoption
  across workers, and a fleet-wide **Logs** tail.
- **System sessions**: state, and restart with Complete, Cancel or Delete &
  restart explained.
- **Access & audit**: a posture card first (is session ownership enforced,
  the default visibility, admin scope), then the log of who opened which
  session, with admin access highlighted and a "Feature changes" filter that
  links to flag history.
- **Knowledge**: facts and graph namespaces, embedder status, purge.
- **Cluster usage**: fleet stats and the noisiest sessions.
- **Maintenance**: pruning of deleted-session summaries and similar upkeep.

### Settings

Profile, Appearance (System, Light, Dark; density Comfortable/Compact; the
classic terminal themes kept as an option), Keyboard shortcuts, My feature
flags, Notifications (browser notifications for "Needs you").

### Phone

Bottom tab bar (Home, Sessions, Boards, Outputs, More). A session opens
full screen with a segmented control for Chat, Canvas, Files, Delegation and
Activity; the visible canvas stays mounted when you switch. Agent library,
Providers, Admin and Settings live under More and work on a phone.

## Terminology

One word per concept, used in the portal, TUI, MCP descriptions and docs.
Shared labels live in `ui/core` so both UIs inherit them.

| Use | Means | Replaces |
|---|---|---|
| **Session** | One durable conversation with an agent | orchestration, instance (in user copy) |
| **Agent** | What a session runs | — |
| **Sub-agent** | A child session started by a session's agent | child, children |
| **In-session task** | Work delegated inside one session (Explore and Task cards) | native task, task |
| **Delegation** | A session's sub-agents and in-session tasks together | spawn tree |
| **Agent library** | The agents, canvas apps and packages you can use | Packages (as an area name) |
| **Group** | A private folder of sessions | folder |
| **Working folder** | A session's folders on disk (main, home, shared) | workspace |
| **Outputs** | Files explicitly shared with a session (attachments and files the agent publishes), and the cross-session area that lists them with canvases | artifacts, files tab |
| **Canvas** | A live page the agent draws; up to five per session | canvas slot |
| **Board** | A saved tiled view of chats and canvases | Master of Agents, MoA, dashboard |
| **Activity** | What happened inside a session (timeline, logs, nodes, history, stats) | Inspector, Diagnostics |
| **Stop** | End the current turn | — |
| **Steer** | Add guidance to the running turn | — |
| **Queue** | Run this message after the current turn | — |
| **Complete** | Close a session as done | Done, Mark completed |
| **Cancel** | Close a session as abandoned | Terminate, abort |
| **Delete** | Remove a session and its sub-agents from every list and stop them; session facts are removed and a deleted summary is kept until an admin prunes it | Hard delete |
| **Provider** | A named model credential | — |
| **Limit · Allowance · Hold** | Token cap per day, week or month · the share of each limit one person may use · a pause on new turns | quota, pool |
| **Package** | Agents, skills and tools published together | agent package |

State labels (always icon + word + reason): Running, Needs you, Waiting
(timer · schedule · sub-agents · budget hold · working folder), Idle,
Completed, Cancelled, Failed.

## Accessibility and quality floor

- WCAG 2.2 AA: 4.5:1 text contrast, 3:1 for borders that carry meaning and
  focus rings, 24px minimum targets, reflow at 320px, reduced motion.
- One dialog primitive with role, label, focus trap and focus return.
- Landmarks per area, a skip link, and live regions only for new messages and
  toasts, not the whole transcript.
- Single-letter shortcuts only for navigation; destructive actions need a
  modifier and confirmation.
- Pinch zoom enabled.
- CI gates: the existing Playwright suite plus axe checks and visual
  baselines for every route, run on every pull request.

## Backend work the design depends on

The UI cannot fake these; each needs API work first. The full list (B1–B26)
and suggested shapes are in [capability-map.md](./capability-map.md). Until
an item lands, its control is not shown. Highlights:

| UI feature | Needs |
|---|---|
| Home → Scheduled, "Pause schedule" / "Cancel schedule" | Operations to list, pause and cancel a session's recurring schedule (none exist) |
| Home and Sessions update instantly | Push session-list, budget and flag changes over the WebSocket instead of re-downloading the full list every 4 s |
| Upload with progress, files up to the advertised size | Streamed or chunked uploads; today base64 inside an 8 MB body caps files near 5.9 MB |
| Settings that roam across tabs and devices safely | Versioned writes (conflict check) for UI preferences |
| Calm reconnect banner | WebSocket reconnect with backoff and jitter (today a fixed 1.5 s) |
| Collaborator view that shows what you can't do | Session ownership checks on by default; today they are off unless a deployment enables them |
| Structured errors everywhere | JSON error bodies for oversized requests (likely HTML today) and typed error codes instead of status codes guessed from message text |
| Home "Wake now", "Undo" after Complete | Operations to wake a sleeping session early and to reopen a just-completed one |
| Home → Recent outputs, Outputs → Canvases and Files | Cross-session lists of recent outputs and canvases (today only per session) |
| Agent library → Canvas apps | A browse operation for published canvas apps (agents can search it; people cannot) |
| State pill reasons (timer, schedule, sub-agents, hold, folder) | The wait reason and wake time as structured fields on the session, not only as label text |
| "Clone expires in 2 days, not pushed" warning | Expiry time and push state of cloned working folders |

## Canvas: what the new host must do

Canvas is carried forward (see [research/03](./research/03-canvas.md)). The
agent tools, storage, relay, Web API and the page-side `postMessage`
protocol stay exactly as they are; only the React host is rewritten. Before
the host's contract becomes an acceptance test it needs three corrections
found in review:

- **Visibility receipts**: a canvas is marked viewed on promote or data
  injection while visible, *and* when a hidden live frame becomes visible
  (`web-app.js:8506`). Spell out both.
- **Retention per slot**: today switching slots remounts the frame through
  its slot key (`web-app.js:8849`). Define which frames stay alive (the
  visible slot of each open session and each board tile) and when others
  are evicted, instead of a blanket "keep alive".
- **Conformance cases** run against both the old and new host: hidden
  update then reveal, slot switch, a stale staging load, a relay gap that
  forces a snapshot resync (the relay is stateless by design,
  `canvas-plane.js:8`), refused action feedback, and the security policy
  (no network, no escaping popups).

## Rollout

1. **Now, independent of the redesign**: the canvas security policy for both
   hosts (S1, above), fix the canvas doc (S2), turn session ownership checks
   on by default (or warn loudly at startup when they are off), run the
   Playwright suite in CI, delete the dead `web/src/**/*.tsx` tree.
2. **Foundation** (behind the `portal.v2` flag, served at `/next`): Tailwind
   v4 tokens, primitives, router, rail, command palette, typed hooks over
   `ui/core`, and the decision of which data the controller owns and which
   TanStack Query owns (never both for one resource).
3. **First slice, end to end**: New session → Chat → Canvas, on desktop and
   phone sizes, with a link back to the old shell from every new screen. It
   proves routing synchronized with the controller, the new canvas host, and
   the phone layout together, before anything else is ported.
4. **Port the rest by area**, each with its backend prerequisites listed,
   a fallback link to the old shell, and a rollback test: Sessions → Files →
   Home → Delegation and Activity → Boards → Outputs and Agent library →
   Providers → Admin and Settings. Refactor the shared controller in its own
   pull requests, separate from host or screen replacement, with the TUI
   tests green on each.
5. **Parity check** against [capability-map.md](./capability-map.md) and the
   e2e suite on both shells; usability test with 5 operators and 3 admins.
6. **Flip the default**, keep the old shell one release behind a flag, then
   delete `web-app.js` and `index.css`.
7. **Docs**: rewrite `docs/user-guide/portal.md` against the new UI with
   screenshot checks.

## Review record

- **Research** (2026-10-30): six parallel audits, in [research/](./research/):
  API capabilities, portal UI inventory, canvas, journeys and parity, visual
  critique, usability and accessibility
  (UX craft review, accessibility review, design critique, UX copy), driven against
  a local portal with Playwright.
- **Capability map**: all 178 Web API operations and every WebSocket message
  mapped to a home or a deliberate exclusion; its 15 gaps were folded into
  this README.
- **Independent review** (a second AI model, read-only):
  verdict *sound with changes*. Applied: canvas security policy for both
  hosts and no escaping popups; Providers in tokens with a per-person
  allowance and a separate hold; the shared-core boundary and data ownership
  in [frontend-stack.md](./frontend-stack.md); a first end-to-end slice and
  per-slice rollback in the rollout; container width rules for the session
  screen; canvas host contract corrections; the terms Agent library,
  Delegation, In-session task and Outputs; and soft-delete wording.
