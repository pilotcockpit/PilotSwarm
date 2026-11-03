# Capability map: every API capability and its home in the redesign

Status: proposal, 2026-10-30, branch `dev` at `2a50ca25`. Companion to the
[README](./README.md). This is the **parity contract** for the redesign: the
new portal ships when every row below either works in its new home or is
listed under [Not exposed on purpose](#not-exposed-on-purpose).

Sources: [research/01](./research/01-api-capabilities.md) (the API catalog,
cited as 01 §n and 01 Q*n*), [research/02](./research/02-portal-ui-inventory.md)
(today's surfaces), [research/03](./research/03-canvas.md) (canvas) and
[research/04 §3](./research/04-journeys-and-parity.md) (TUI, portal and MCP
parity). The operation list was checked against the `OPERATIONS` table in
`packages/sdk/api/src/protocol.js`: all 178 operations appear exactly once.

## How to read this

**Columns**

| Column | Meaning |
|---|---|
| Domain | The capability group (sections follow 01 §1, plus Realtime) |
| Operation | The exact operation name from `protocol.js`, the exact route, the WebSocket message or event, or *(client-only)* for capabilities with no server API |
| What it does | Plain words |
| Who | Who may use it (legend below) |
| Today | Where the current portal exposes it. **[NO]** = the browser transport has a method but no UI calls it; **[NO-T]** = not even the transport has it; *(partial)* and *(via bootstrap)* as in 01 §6 |
| New home | Where it lives in the redesign, using the README's routes and screen names. "Background: feeds X" means no control of its own; it powers the named view |
| Notes | New UI needed, API work needed, or why it is not exposed |

**Who**

| Label | Access class (01 §3) |
|---|---|
| Public | No sign-in |
| Link holder | Holds a public canvas link token |
| Signed-in | `authed`: any admitted user (and `session:create`, subject to the creation policy) |
| Viewer | `session:list`: sees the sessions visible to them |
| Reader | `session:read` (and `canvas:read`): read access to the session tree |
| Writer | `session:write`: owner, write grant, or `shared_write` |
| Owner/admin | `session:manage`, `session:destroy`, `session:share` |
| Owner only | `session:files`: the owner; admins get no access |
| Group owner | `group:list`, `group:manage` |
| Admin | `fleet:admin`, always enforced |
| Admin read | `fleet:read`: admin, but **open to every user while ownership enforcement is off** (the default) |

**Words.** User-facing columns use the README terminology: Outputs (not
artifacts), Working folder and Folders (not workspace), Board (not MoA),
Group (not folder), Complete, Cancel and Delete. Operation names keep their
code spelling.

**Areas.** Each row's first New home entry is its primary home; later entries
are shortcuts that point to it. [Totals](#totals) count primary homes.

## 1. Platform, sign-in and start-up

The hand-written routes the browser hits before and around the operations table, plus the two `/system` operations. Almost all of this is invisible plumbing; what users see is the sign-in screen, the rail's brand and identity, and the first-run state.

| Domain | Operation | What it does | Who | Today | New home | Notes |
|---|---|---|---|---|---|---|
| Platform | `GET /api/v1/health` (legacy `GET /api/health`) | Says the portal is up, with its mode, API version and access-control posture. | Public | none | Background: load-balancer and smoke-test probe | Deliberately not shown. It publishes the authz posture to anyone (01 Q16); move the posture behind sign-in. |
| Platform | `GET /api/v1/auth/config` (legacy `GET /api/auth-config`) | Tells the browser which sign-in method this deployment uses (and the dev personas). | Public | Sign-in gate; dev persona picker | Sign-in screen; dev persona picker and DEV AUTH banner | — |
| Platform | `GET /api/portal-config` (legacy only) | Branding, loading copy, docs links, link origins, and whether working-folder files are on. | Public | First fetch in `App.jsx` | App shell: rail brand, sign-in and loading copy; turns Files › Folders on or off; origins for Copy link | Needs API work: no `/api/v1` equivalent (01 Q9). |
| Platform | `GET /api/portal-assets/:assetName` | Serves the deployment's logo and favicon. | Public | Header brand mark; favicon | Rail brand mark; favicon; sign-in screen | — |
| Platform | `GET /api/v1/auth/me` (legacy `GET /api/auth/me`) | Who you are, whether you are let in, and your role. | Signed-in | Header identity; Access denied gate | Rail footer (name, role, connection); Access denied screen; Settings › Profile | A 403 shows Access denied with Sign out. |
| Platform | `GET /api/v1/bootstrap` (legacy `GET /api/bootstrap`) | One start-up read: workers, log availability, default model, model templates, startable agents, creation policy, access posture. | Signed-in | App start | Background: app start; feeds the New session sheet, Home first-run state and Activity › Logs availability | Admins should see the `authz` posture (see Gaps in the README IA). |
| Platform | `getWorkerCount` | How many workers are live. | Signed-in | Read through bootstrap *(via bootstrap)* | Admin › Workers (count in the header); Home blocked state when zero | Home state is new (see Gaps in the README IA). |
| Platform | `getLogConfig` | Whether the live log tail is available here, and if not, why. | Signed-in | Read through bootstrap *(via bootstrap)* | Session › Activity › Logs (the empty state gives the reason) | — |
| Platform | `POST /api/rpc` | Legacy single-endpoint RPC for every operation. | Per operation | Not used by the portal | Not exposed | Retire after the deprecation window (01 Q9). |

## 2. Sessions and chat

Creating, reading, talking to and closing sessions. In the redesign these spread across the Sessions list, the New session sheet, the session header and ⋯ menu, and the Chat view. Lifecycle words are Complete, Cancel and Delete everywhere; turn words are Stop, Steer and Queue.

| Domain | Operation | What it does | Who | Today | New home | Notes |
|---|---|---|---|---|---|---|
| Sessions | `listSessionsPage` | Pages through the sessions you can see, newest first, with system and deleted filters. | Viewer | Sessions pane; the whole catalog is re-walked every 4 s | Sessions list (also the left column of Session); Home sections; ⌘K session search | Needs API work: push instead of the 4 s walk (Q1) and server-side search and filters for the toolbar chips (Q2). |
| Sessions | `listSessions` | Unpaged flat list of sessions. | Viewer | Fallback only *(partial)* | Not exposed | Superseded by `listSessionsPage`; drop the fallback. |
| Sessions | `getSession` | One session's live state: status, pending question, schedule fields, context use, whether it takes Stop and Steer. | Reader | Chat title, status chip, session details box | Session header (title, agent, model, state pill with reason and next time); Board tile header | The state pill needs a server-computed wait reason (see Backend work). |
| Sessions | `createSession` | Starts a session with no agent, with model, effort, context window, group, visibility and working folder. | Signed-in (creation policy) | ＋ chain: model → effort → context → agent | New session sheet › Start session with no agent picked | Offered only when the policy allows generic sessions. Working folder at creation is new to the portal (MCP-only today). |
| Sessions | `createSessionForAgent` | Starts a session for a named agent, optionally with the first prompt. | Signed-in (creation policy) | ＋ chain, step 4 | New session sheet › Start session; Agents › agent › Start session; Canvases › App catalog › Use in a session | Send the prompt as `initialPrompt` so one call starts the work. |
| Sessions | `listCreatableAgents` | Agents you may start, with description, tools and package. | Signed-in | Agent picker (step 4 of 4) | Agents › Agents; New session sheet › Agent cards | — |
| Sessions | `getSessionCreationPolicy` | Whether generic sessions are allowed, the allowlist and the default agent. | Signed-in | Read through bootstrap *(via bootstrap)* | New session sheet (preselects the default agent; hides 'No agent' when not allowed) | — |
| Sessions | `sendMessage` | Sends a prompt; can queue it, attach images or carry a canvas action. | Writer | Composer Send; image attach; outbox | Session › Chat › composer: Send, Queue, 📎; Board chat tile | Attachments ≤4 images, ≤4 MB each. Read-only viewers see why the composer is off. |
| Sessions | `sendAnswer` | Answers the question the agent asked (`ask_user`). | Writer | Typed into the composer; choices shown as bullets | Session › Chat › inline question form with choice buttons; Home › Needs you › Answer | New UI: choice buttons and client-side `allowFreeform=false`. The server does not enforce choices. |
| Sessions | `cancelPendingMessage` | Removes queued messages before they run. | Writer | Outbox strip ✕ | Session › Chat › queued messages above the composer › Remove | — |
| Sessions | `sendSessionEvent` | Posts a custom named event into a session (integration hook). | Writer | none **[NO-T]** | Not exposed | See Not exposed on purpose. |
| Sessions | `stopSessionTurn` | Ends the running turn; waits up to 30 s for the outcome. | Writer | Composer ■ | Session › Chat › composer › Stop; Session › Agents › row › Stop turn; Board tile | Two-phase: 'Stopping…', then the outcome. The button says it discards this turn's work. |
| Sessions | `steerSessionTurn` | Adds guidance to the running turn. | Writer + `sessions.steering` flag | Composer ↪ (phone: hold menu) | Session › Chat › composer › Steer (disabled with the reason when the flag is off) | Delivery chips: Pending → Delivered, Carried or Not delivered. |
| Sessions | `renameSession` | Renames a session. | Owner/admin | Manage session › General; `t` | Session header title (click to rename); ⋯ › Rename; ⌘K | — |
| Sessions | `cancelSession` | Closes a session as abandoned. | Owner/admin | Terminate → Session Lifecycle; `c` | ⋯ › Cancel (danger section, names what cascades); Sessions › Select › bulk bar › Cancel | Bulk needs a bulk op with per-session results (see Backend work). |
| Sessions | `completeSession` | Closes a session as done, with a reason. | Owner/admin | Terminate → Lifecycle › Mark completed; `d` | ⋯ › Complete; bulk bar › Complete | The README's 'Undo' toast has no reopen op (see Backend work). |
| Sessions | `deleteSession` | Cancels and soft-deletes a session. | Owner/admin | Terminate → Lifecycle; `Shift+D` | ⋯ › Delete (confirm with the cascade count); bulk bar › Delete | System sessions may be protected (`deletion.protectSystem`). |
| Sessions | `setSessionModel` | Switches model, effort or context window mid-session. | Owner/admin | Manage › Switch model… | ⋯ › Change model | Picker uses `listModels` only (Q13). |
| Sessions | `regenerateSession` | Rebuilds the context in place (archive, distil, restart) at a turn boundary. | Owner/admin | Manage › Regenerate context, and the Lifecycle modal (two entries) | ⋯ › Regenerate context (one entry; the dialog shows context health) | Progress keyed on `attemptId`; refusals (too young, cooldown, pending) explained, with Force where allowed. |
| Sessions | `getSessionStatus` | Raw custom and orchestration status. | Reader | none **[NO-T]** | Not exposed | Redundant with `getSession` plus events. |
| Sessions | `waitForStatusChange` | Long-polls until the status changes. | Reader | none **[NO-T]** | Not exposed | For clients without a WebSocket. |
| Sessions | `getLatestResponse` | The last turn's response payload. | Reader | none **[NO-T]** | Not exposed | Scripting convenience; Chat already shows it. |
| Sessions | `getSessionEvents` | Events after a sequence number; the catch-up path after a reconnect. | Reader | Event replay | Background: feeds Session › Chat and Activity › Timeline | Correctness path; the WebSocket only accelerates. |
| Sessions | `getSessionEventsBefore` | Older events, for scrolling back. | Reader | Pull to load older | Session › Chat (scrolling up loads older messages) | — |
| Sessions | `getExecutionHistory` | Raw orchestration history. | Reader (admins on private sessions are audited) | Inspector › Duroxide Event History | Session › Activity › History | An admin opening a private session sees a break-glass notice. |
| Sessions | `exportExecutionHistory` | Saves the execution history as an output file. | Owner/admin | History tab › Export as artifact | Session › Activity › History › Export; ⋯ › Export history | The file lands in Files › Outputs with a toast and Open. |
| Sessions | `getOrchestrationStats` | Runtime stats for the session's orchestration. | Reader | Inspector › Stats (every 20 s) | Session › Activity › Stats | — |
| Sessions | `getSessionFootprint` | Context health: size, compaction, an assessment and a regenerate recommendation. | Reader | none **[NO-T]** | ⋯ › Regenerate context dialog; header context meter; Activity › Stats › Context health | New UI and a transport method. 'Recommended' badge on Regenerate when the backend says so. |

## 3. Sub-agents, groups and schedules

The spawn tree, in-session tasks, private groups and scheduled wakes. Sub-agents and tasks get one home, Session › Agents. Groups live in the Sessions list. Schedules are visible today but cannot be managed from any surface.

| Domain | Operation | What it does | Who | Today | New home | Notes |
|---|---|---|---|---|---|---|
| Tree & groups | `listChildOutcomes` | Structured results of a session's sub-agents: verdict, summary and result. | Reader | none **[NO]** | Session › Agents (verdict and summary on each sub-agent row) | New UI. |
| Tree & groups | `getChildOutcome` | One sub-agent's result. | Reader (on the child) | none **[NO]** | Session › Agents › sub-agent row › expand; Chat sub-agent card ('Finished · verdict') | New UI. |
| Tree & groups | Spawn tree (client-only, from parent ids) | The session tree rebuilt from the full session list. | Reader | Nested rows in the Sessions pane | Session › Agents tree; Sessions list nested rows and sub-agent chip | Needs API work: a tree endpoint, so the Agents view does not need the whole catalog. |
| Tree & groups | Native tasks (live topic `native-tasks`; event `native.task_updated`) *(client-only)* | In-session tasks (Explore, Task) and their state. | Reader | Task cards in chat | Session › Agents (in-session tasks, with a legend); Chat task cards | Needs the `copilot.native_tasks` flag. |
| Tree & groups | `listSessionGroups` | Your private groups. | Group owner (own only) | Group rows in the Sessions pane | Sessions list › group sections; filter chip Group; New session › Options › Group | — |
| Tree & groups | `createSessionGroup` | Creates a group. | Signed-in | Folder button › New group; `Ctrl+G` | Sessions › Move to group › New group | — |
| Tree & groups | `updateSessionGroup` | Renames or describes a group. | Group owner | Manage on a group row | Sessions › group header ⋯ › Rename | — |
| Tree & groups | `deleteSessionGroup` | Deletes a group; its sessions stay. | Group owner | Delete on a group | Sessions › group header ⋯ › Delete group | Copy says 'Sessions are kept'. |
| Tree & groups | `placeSessionsInGroup` | Moves sessions into one of your groups, or out of all groups. | Signed-in + read access to each session | Folder picker; drag | Row ⋯ › Move to group; drag; bulk bar › Move to group; Session ⋯ › Move to group | — |
| Tree & groups | `assignSessionsToGroup` | Deprecated alias of `placeSessionsInGroup`. | Signed-in | Dead fallback *(partial)* | Not exposed | Remove the client fallback (Q11). |
| Tree & groups | `moveSessionsToGroup` | Deprecated alias of `placeSessionsInGroup`. | Signed-in | Dead fallback *(partial)* | Not exposed | Remove the client fallback (Q11). |
| Tree & groups | `cancelSessionGroup` | Cancels every session in a group (deprecated). | Group owner | none **[NO]** | Not exposed. The capability: group header ⋯ › Select all → bulk bar › Cancel | Deprecated op; the bulk bar should use a bulk op (see Backend work). |
| Tree & groups | `completeSessionGroup` | Completes every session in a group (deprecated). | Group owner | none **[NO]** | Not exposed. The capability: group header ⋯ › Select all → bulk bar › Complete | Same as above. |
| Tree & groups | Schedules (no operation; session `cron*` fields and `session.cron_*` events) *(client-only)* | Cron and one-shot wakes: interval, next run, reason, runs done. | Reader | Wait countdown badge; display only | Home › Scheduled and waiting; Session header state pill ('cron · next run 02:00'); Sessions › State filter | Needs API work: list, pause, resume, cancel, wake now. |

## 4. Working folder and folder files

A session's folders on disk (main, home, shared, extras) and the file and git calls the Files view makes. These ops say "workspace"; the UI says **Working folder** and **Folders**. Folder files are owner-only, even for admins, so collaborators need a clear reason in place of the Folders tab.

| Domain | Operation | What it does | Who | Today | New home | Notes |
|---|---|---|---|---|---|---|
| Working folder | `getSessionWorkspace` | The session's working folder: binding, status, last error, held prompts, adopted agents and skills. | Reader | Manage › Workspace; Workspace tab | Session › Files › Folders header; session header working-folder chip; Home › Needs you (failed to attach) | — |
| Working folder | `setSessionWorkspace` | Sets or clears the working folder and extra folders; applied between turns. | Owner/admin | Manage › Workspace › Set… / Clear | ⋯ › Working folder (sheet); New session › Options › Working folder (via `workspace` on create) | Pending state while a turn runs; revision conflict asks to reload. |
| Working folder | `retrySessionWorkspace` | Retries a stuck working folder now. | Writer | Manage › Workspace › Retry now | Header state pill 'Waiting · working folder' › Retry now; Home › Needs you › Retry; Files › Folders banner | — |
| Working folder | `listSessionWorkspaceFolders` | Folders the Files view can show, the size limit and whether git works. | Owner only | Workspace tab | Session › Files › Folders (folder switcher) | Collaborators and admins see why Folders is unavailable. |
| Working folder | `sessionWorkspaceFiles` | One file or git call in a session folder (calls below). | Owner only | Workspace tab: tree, editor, git | Session › Files › Folders | Owner-only even for admins. Calls mapped below. |
| Working folder | `canvasWorkspace` | A canvas app's access to session folders and declared commands, checked against its manifest. | Owner only (manifest-checked) | Canvas bridge | Background: Session › Canvas; 'Uses files: work/**' chip on the canvas | Refusals show a toast on the canvas. |
| Working folder | Repo import (browser-side, no server op) *(client-only)* | Imports a package from a GitHub or Azure DevOps repo with your own token. | Signed-in | Add package dialog | Agents › Packages › Add package › Import from repo | The token stays in the browser. |

**`sessionWorkspaceFiles` calls → Files › Folders controls**

| Call | New control |
|---|---|
| `list` | Folder tree (≤5000 entries; "showing the first 5000" when truncated) |
| `stat` | Details panel |
| `read` | Editor and preview |
| `find` | Find in folder (≤200 matches) |
| `write` | Editor Save (etag conflict dialog: Compare, Keep mine, Take theirs, Keep both); New file; Upload |
| `mkdir` | New folder |
| `move` | Rename; Move to…; drag between folders |
| `delete` | Delete (recursive confirm names the item count) |
| `zip` | Download selected as .zip |
| git `status` | Changes (staged and unstaged, "since" picker) |
| git `log` | Commits (pages of 50) |
| git `show` | Commit detail |
| git `file` | File at a revision (≤5 MB) |
| git `compare` | Diff (side by side or inline) |
| git `repos` | Repo picker when a folder holds more than one |
| git `checkout` | Check out commit (disabled while a turn runs, with the reason) |
| git `restore` | Discard changes |

## 5. Outputs (session files)

Files shared in chat or written by the agent. The ops say "artifact"; the UI says **Outputs**. One home: Session › Files › Outputs, with Home › Recent outputs as a shortcut. Pin and Copy to session are exposed for the first time.

| Domain | Operation | What it does | Who | Today | New home | Notes |
|---|---|---|---|---|---|---|
| Outputs | `listArtifacts` | Lists the session's outputs. | Reader | Inspector › Files | Session › Files › Outputs; Home › Recent outputs | Home across sessions needs API work. |
| Outputs | `getArtifactMetadata` | An output's size, type, source and pin state. | Reader | Artifact reader; Files | Files › Outputs › preview header and details | — |
| Outputs | `GET /api/sessions/:id/artifacts/:filename/meta` (legacy) | Legacy route for the same metadata. | Reader | Not used | Not exposed | Retire with the other legacy routes (Q9). |
| Outputs | `downloadArtifact` | Reads an output as text for preview. | Reader (admin break-glass audited) | Artifact reader | Files › Outputs › preview (Markdown, CSV, HTML, code) | — |
| Outputs | `GET /api/v1/sessions/:id/artifacts/:filename/download` (legacy `/api/sessions/…/download`) | Downloads an output file. | Reader | Reader › Download; Files | Files › Outputs › Download; Chat file chip ⋯ › Download | — |
| Outputs | `readArtifactBase64` | Reads up to 1 MB of an output as base64. | Reader | none **[NO]** | Files › Outputs thumbnails and image or PDF preview; Home › Recent outputs thumbnails | New UI. |
| Outputs | `uploadArtifact` | Uploads a file into the session's outputs. | Writer | Composer 📎 (images only); Files › Upload | Files › Outputs › Upload; Session › Chat › composer › 📎 and drag | Needs API work: ≈5.9 MB effective ceiling (Q5); uploads recorded as `source:"agent"` (Q17). |
| Outputs | `deleteArtifact` | Deletes an output. | Owner/admin | Files › Delete | Files › Outputs › ⋯ › Delete | — |
| Outputs | `copyArtifact` | Copies an output to another session. | Reader on source + Writer on target | none **[NO]** | Files › Outputs › ⋯ › Copy to session… | New UI: session picker limited to sessions you can write. |
| Outputs | `setArtifactPinned` | Pins an output so retention sweeps keep it. | Owner/admin | none **[NO]** | Files › Outputs › ⋯ › Pin (pin badge in the list) | New UI. |
| Outputs | `session.artifact_presented` | The agent asks to show a file. | Reader | Auto-opens the artifact reader | Chat file chip; opens Files › Outputs preview | — |
| Outputs | Output deep link `?session=&artifact=&view=` (client-only) | A link straight to a file. | Reader | Deep-link entry only | Route `/s/:id/files/outputs/:filename` (old links redirect) | Route shape is listed under Gaps in the README IA. |

## 6. Canvas

Live pages the agent draws, up to five per session. The protocol is frozen (research/03 §6); the redesign changes only where the host UI puts things: Session › Canvas with a named tab per canvas, a Share dialog split into Link and Permissions, the public viewer at `/c/:token`, and the cross-session Canvases area. The WebSocket messages are listed under Realtime.

| Domain | Operation | What it does | Who | Today | New home | Notes |
|---|---|---|---|---|---|---|
| Canvas | `getCanvasLive` | The current document and latest data for each canvas. | Reader | Inside the canvas mirror *(partial)* | Session › Canvas (tab strip names and updated dots; frames); Board canvas tiles | Snapshot and resync source behind the frames. |
| Canvas | `readCanvasKv` | A canvas app's shared key/value state, plus your right to write it. | Reader (canvas policy) | Canvas bridge | Background: inside canvas frames (Session › Canvas, Board tiles) | — |
| Canvas | `writeCanvasKv` | A canvas app writes its key/value state. | Writer, or reader when the canvas policy allows | Canvas bridge | Background: inside canvas frames | Rate-limited (429). Refused writes show a toast on the canvas. |
| Canvas | `setCanvasKvAccess` | Who may edit inside this canvas app: owner, readers or link. | Owner/admin | Share canvas › Session access › select | Session › Canvas › ⋯ › Share › Permissions ('Who can edit inside this app') | Separated from link audience (03 §5.8). |
| Canvas | `getCanvasShareLink` | Whether a public link exists (never the token). | Owner/admin | Share canvas › Anyone with link | Session › Canvas › Share › Link (status, created by and when) | — |
| Canvas | `resetCanvasShareLink` | Creates or rotates the public link; returns the token once. | Owner/admin | Share canvas › Anyone with link | Session › Canvas › Share › Link › Create link / Reset link | Make Copy explicit: the token cannot be shown again. |
| Canvas | `removeCanvasShareLink` | Removes the public link. | Owner/admin | Share canvas › Anyone with link | Session › Canvas › Share › Link › Remove | — |
| Canvas | `GET /api/canvas-share/doc?t=` | Serves the shared canvas page, sandboxed. | Link holder | `?canvasShare=` viewer | Public viewer `/c/:token` | Own small bundle; add the CSP (03 S1). |
| Canvas | `GET /api/canvas-share/live?t=` | The shared canvas's live state. | Link holder | `?canvasShare=` viewer | Public viewer `/c/:token` | — |
| Canvas | `GET /api/canvas-share/kv?t=` | Read-only key/value state for a shared canvas. | Link holder | `?canvasShare=` viewer | Public viewer `/c/:token` | Writes are always refused. |
| Canvas | Canvas actions (`sendMessage` with the `[canvas-action] ` prefix) *(client-only)* | Clicks inside a canvas, sent to the agent. | Writer | Inside the canvas; refusals are silent | Session › Canvas and Board tiles; a refused click shows a toast | The code admits every writer (Q12). |
| Canvas | `session.canvas_app_published` | The agent published a reusable canvas app. | Reader | Generic activity line | Chat card 'Published app X'; Canvases › App catalog | The catalog list needs API work. |

## 7. Agents, packages, workers and system sessions

What sessions run and who runs it. Agents and Packages live in the Agents area; workers and system sessions in Admin.

| Domain | Operation | What it does | Who | Today | New home | Notes |
|---|---|---|---|---|---|---|
| Agents | `listAgentPackages` | Packages you can see: shared plus yours (admins see all). | Signed-in | Admin console › Packages | Agents › Packages | — |
| Agents | `uploadAgentPackage` | Publishes a package version from files. | Signed-in (creator, editor or admin) | + Add package | Agents › Packages › Upload; package › New version | Validation errors listed per file. |
| Agents | `getAgentPackage` | One package and its version history. | Signed-in | Package detail | Agents › package › Overview and Versions | — |
| Agents | `getAgentPackageTree` | Files inside a package version. | Signed-in | Package file workspace | Agents › package › Files | — |
| Agents | `getAgentPackageFile` | Previews one file from a package. | Signed-in | Package file workspace | Agents › package › Files › preview | — |
| Agents | `GET /api/v1/agent-packages/:name/download` | Downloads a package as .tgz. | Signed-in | Package detail | Agents › package ⋯ › Download .tgz | — |
| Agents | `setAgentPackageScope` | Promotes a package to shared, or makes it private. | Creator or admin | Package detail | Agents › package ⋯ › Promote to shared / Make private | — |
| Agents | `setAgentPackageEnabled` | Turns a package on or off for the fleet. | Creator, editor or admin | Package detail | Agents › package › Enabled switch | Show fleet convergence (~20 s). |
| Agents | `pinAgentPackageVersion` | Chooses the active version (roll back). | Creator, editor or admin | Package detail | Agents › package › Versions › Make active | Show fleet convergence. |
| Agents | `deleteAgentPackage` | Deletes a package and every version. | Creator or admin | Package detail | Agents › package ⋯ › Delete | Warns that live sessions using it fail on their next turn. |
| Agents | `grantAgentPackageEditor` | Lets a person publish to a shared package. | Owner or admin | Package detail › editors | Agents › package › Editors › Add | — |
| Agents | `revokeAgentPackageEditor` | Removes an editor. | Owner or admin | Package detail › editors | Agents › package › Editors › Remove | — |
| Agents | `listAgentPackageEditors` | Lists a shared package's editors. | Anyone who can see the package | none (editors read from the detail) **[NO]** | Agents › package › Editors | Switch to this op. |
| Agents | `republishAgentPackageVersion` | Copies a version's exact bytes into the other scope. | Creator or admin | Package detail | Agents › package › Versions › Publish to shared / Publish to my copy | The update path for a shared package. |
| Agents | `listAgentWorkerState` | Which workers have which package versions. | Admin | Admin console › Packages | Agents › package › Workers (admins); Admin › Workers › Packages column | Package authors who are not admins cannot see it (see Backend work). |
| Agents | `listWorkers` | Worker registry: pool, liveness, health, package and flag delivery. | Admin | Admin › Workers; Inspector › Node Map | Admin › Workers; Session › Activity › Nodes | — |
| Agents | System agents (`pilotswarm`, `sweeper`, `facts-manager`, `resourcemgr`, `token-manager`) *(client-only)* | Built-in agents that run as system sessions. | Reader (if system visibility is `read`); manage: Admin | Top of the session list | Admin › System sessions; Sessions › System group (collapsed, admins) | — |
| Agents | `restartSystemSession` | Restarts a system agent: Complete, Cancel or Delete, then start a new one. | Admin | Lifecycle modal on system rows | Admin › System sessions › Restart | `SYSTEM_AGENT_LOADED` (409) explained. |

## 8. Providers, models, defaults, limits and usage

Today split between Admin › Model Providers and the Budget mode. In the redesign all of it is **Providers**, except per-system-agent model overrides (Admin › System sessions) and fleet totals (Admin › Cluster usage). Words: Limit, Allowance, Hold.

| Domain | Operation | What it does | Who | Today | New home | Notes |
|---|---|---|---|---|---|---|
| Providers | `listModels` | Models you can actually run, by provider. | Signed-in | Model picker | Providers › provider › Overview › Models; New session › Options › Model; ⋯ › Change model | The only source for run pickers (Q13). |
| Providers | `getModelsByProvider` | Model templates per provider type. | Signed-in | Read through bootstrap *(via bootstrap)* | Providers › Add provider (models offered for the chosen type) | Never in run pickers (Q13). |
| Providers | `getDefaultModel` | The deployment's default model. | Signed-in | Read through bootstrap *(via bootstrap)* | Providers › Defaults (deployment line); New session preselect | — |
| Providers | `listProviders` | Providers you can use; admins also see other people's. | Signed-in | Admin › Model Providers; Budget | Providers table | — |
| Providers | `getProviderStatus` | Limits, use against them, reset times and your own ceiling. | Signed-in | Budget; session status label | Providers › provider › Limits; header pill 'Waiting · budget hold' detail | — |
| Providers | `getProviderUsageGrid` | Day, week and month use against quota per provider and per model limit. | Signed-in | Budget › Providers table (every 60 s) | Providers table spend columns | — |
| Providers | `getProviderUsageSummary` | Token totals and a daily series (admins: the cluster; others: their own). | Signed-in | Budget › Cluster summary | Providers summary row; Admin › Cluster usage (fleet totals) | — |
| Providers | `getProviderUsageAgents` | Tokens per agent per day. | Signed-in | Budget › Agents | Providers › provider › Usage › By agent | — |
| Providers | `getProviderUsage` | Where tokens went, by session, user, provider, model or agent. | Signed-in (own data unless admin) | Budget drill-down | Providers › provider › Usage (breakdown table) | — |
| Providers | `listPausedSessions` | Sessions paused by a limit, allowance, hold or missing provider. | Signed-in (own; admins all) | Drives a status label only | Home › Needs you (budget holds); Providers › provider › Limits › Paused sessions | Capped at 100, no cursor (see Backend work). |
| Providers | `createProvider` | Adds a shared provider. | Admin | Create provider sheet | Providers › Add provider › Shared | — |
| Providers | `updateSharedProviderCredential` | Replaces a shared provider's key. | Admin | Edit provider sheet | Providers › provider › Overview › Replace key | — |
| Providers | `deleteProvider` | Removes a shared provider and says how many sessions now wait on it. | Admin | Edit provider sheet | Providers › provider ⋯ › Delete | On `PROVIDER_IN_USE`, offer 'Clear defaults and delete'. |
| Providers | `createMyProvider` | Adds your own provider on your own key. | Signed-in | My Providers | Providers › Add provider › Personal; Home first-run 'Use your own key' | — |
| Providers | `updateMyProviderCredential` | Replaces your provider's key. | Owner | My Providers | Providers › provider › Overview › Replace key | — |
| Providers | `deleteMyProvider` | Removes your provider and says how many sessions now wait on it. | Owner | My Providers | Providers › provider ⋯ › Delete | — |
| Providers | `clearProviderRoutingDependencies` | Clears defaults and system overrides that point at a provider. | Signed-in (admin for shared) | none **[NO]** | Providers › provider ⋯ › Delete › 'In use' dialog › Clear and delete | New UI: the fix for `PROVIDER_IN_USE`. |
| Providers | `setProviderLimit` | Saves a day, week or month token limit (all models or one). | Admin (shared) / owner (personal) | Budget edit sheet | Providers › provider › Limits › Add or Edit limit | Wakes paused sessions. |
| Providers | `removeProviderLimit` | Drops a limit. | Admin (shared) / owner (personal) | Budget edit sheet | Providers › provider › Limits › Remove | — |
| Providers | `setProviderAllowance` | Sets each person's share of a shared provider's limits. | Admin | Budget edit sheet | Providers › provider › Limits › Per-person allowance | — |
| Providers | `setProviderHold` | Pauses new turns on a provider, until a time or indefinitely. | Admin | Budget edit sheet | Providers › provider › Limits › Hold / Release | — |
| Providers | `getDefaults` | Compatibility view of default tuples. | Signed-in | Used in places | Not exposed | Use `getModelDefaults`. |
| Providers | `getModelDefaults` | Your, cluster and system defaults, the effective source and per-agent overrides. | Signed-in | Admin › Model Providers | Providers › Defaults; default badges in the Providers table | Placement is listed under Gaps in the README IA. |
| Providers | `setModelDefault` | Sets or clears your default or the cluster default. | Signed-in; cluster = admin | My Session Default; cluster default | Providers › Defaults › My default / Cluster default; New session › 'Make this my default' | — |
| Providers | `setMyDefault` | Sets your new-session prefill (older call). | Signed-in | My Session Default | Not exposed | The new UI calls `setModelDefault` with scope user. |
| Providers | `setClusterDefault` | Deprecated alias for the cluster default. | Admin | Shared Providers | Not exposed | Deprecated; use `setModelDefault`. |
| Providers | `setSystemModelDefault` | Sets the system-session default and optionally restarts the sessions that inherit it. | Admin | Shared Providers | Providers › Defaults › System default (restart choice; per-agent result list) | — |
| Providers | `setSystemSessionModel` | Sets a lasting model override for one system agent. | Admin | Shared Providers › overrides | Admin › System sessions › agent › Model override | Linked from Providers › Defaults. |
| Providers | `clearSystemSessionModel` | Clears a system agent's model override. | Admin | Shared Providers › overrides | Admin › System sessions › agent › Model override › Clear | — |
| Providers | `setProviderSystemUse` | Lets system sessions use your own (admin's) personal provider. | Admin (own provider) | My Providers toggle | Providers › provider (yours) › Overview › 'Allow system sessions' | — |
| Providers | `getLegacyProviderMigrationStatus` | Whether legacy GitHub Copilot keys still need migrating. | Admin | none **[NO]** | Providers › admin banner 'Legacy GitHub Copilot key found' | New UI; the banner shows only when something is pending. |
| Providers | `adoptLegacySystemGitHubCopilotKey` | Moves the legacy System key into your own system-enabled provider. | Admin | none **[NO]** | Providers › legacy banner › Adopt key | New UI. |
| Providers | `setCurrentUserGitHubCopilotKey` | Sets or clears your GitHub Copilot key. | Signed-in | GHCP key editor (Admin console) | Providers › GitHub Copilot › Your key; Home first-run | A missing key fails only at turn time (Q14). |
| Providers | `setSystemGitHubCopilotKey` | Sets or clears the System user's GitHub Copilot key. | Admin | GHCP key editor | Providers › GitHub Copilot › System key | — |
| Providers | `getSystemGitHubCopilotKeyStatus` | Whether a System key is set and who changed it last. | Admin | GHCP key editor | Providers › GitHub Copilot › System key (status line) | — |

## 9. Sharing, access and audit

Who can see and change a session. Everything except the audit trail lives in the session's **Share** dialog. Access is decided on the tree root, so a sub-agent's Share dialog says it inherits from its root.

| Domain | Operation | What it does | Who | Today | New home | Notes |
|---|---|---|---|---|---|---|
| Sharing | `getSessionAccess` | Your relation to a session, what you may do, and whether rules are enforced. | Reader | Read-only notice; Manage › Access | Session › Share dialog; Share button state; disabled-control reasons; composer read-only notice | — |
| Sharing | `setSessionVisibility` | Private, shared read or shared write, for the whole tree. | Owner/admin | Manage › Access › General access | Session › Share › General access | Audited. |
| Sharing | `grantSessionShare` | Gives one person read or write. | Owner/admin | Manage › Access › Special access | Session › Share › People › Add | — |
| Sharing | `revokeSessionShare` | Removes a person's access. | Owner/admin | Manage › Access › Remove | Session › Share › People › Remove | — |
| Sharing | `listSessionShares` | Lists people with access. | Owner/admin | Manage › Access | Session › Share › People | — |
| Sharing | `listKnownUsers` | Member directory for picking people. | Signed-in | Share autocomplete | Session › Share › People search; Agents › package › Editors › Add | — |
| Sharing | `listAuthzAudit` | Denials, break-glass reads, sharing changes and feature-flag changes. | Admin; owner for their own session | none **[NO]** | Admin › Audit log; Session › Share › Access history (owners) | New UI. Needs a cursor and filters (see Backend work). Owner view is listed under Gaps in the README IA. |
| Sharing | Copy link (client-only, `PORTAL_LINK_ORIGINS`) | Copies a link to the session. | Reader | Copy link button and a modal | ⋯ › Copy link; Share › Copy link; the address bar | Says that a link locates and does not grant access. |

## 10. Feature flags, profile and maintenance

Cluster policy and per-user flags, the signed-in profile, and fleet housekeeping. Cluster and per-user flags go to Admin › Feature flags; your own go to Settings › My feature flags.

| Domain | Operation | What it does | Who | Today | New home | Notes |
|---|---|---|---|---|---|---|
| Admin & settings | `listFeatureFlags` | The flag catalog with published defaults. | Signed-in | (the UI reads the cluster policy instead) *(partial)* | Settings › My feature flags (names, descriptions); Admin › Feature flags | — |
| Admin & settings | `getClusterFeatureFlags` | The cluster policy for each flag. | Signed-in | Admin console › Feature flags | Admin › Feature flags › Cluster; lock state in Settings › My feature flags | — |
| Admin & settings | `setClusterFeatureFlag` | Sets a flag's cluster policy and whether users may override it. | Admin | Admin console › Feature flags | Admin › Feature flags › Cluster › switch and 'Allow user override' | `FEATURE_CONFLICT` → 'Reload before saving'. |
| Admin & settings | `resetClusterFeatureFlag` | Returns a flag to its published default. | Admin | Admin console › Feature flags | Admin › Feature flags › Cluster › Reset | — |
| Admin & settings | `getMyFeatureFlags` | Your preferences and effective values. | Signed-in | Settings › Feature flags | Settings › My feature flags | — |
| Admin & settings | `setMyFeatureFlag` | Sets your preference (a locked cluster policy still wins). | Signed-in | Settings › Feature flags | Settings › My feature flags › switch | Locked flags say who locked them. |
| Admin & settings | `unsetMyFeatureFlag` | Drops your preference and follows the cluster. | Signed-in | Settings › Feature flags | Settings › My feature flags › 'Use cluster setting' | — |
| Admin & settings | `getUserFeatureFlags` | Reads one user's preferences. | Admin | Admin console › Feature flags | Admin › Feature flags › Per user | — |
| Admin & settings | `setUserFeatureFlag` | Sets one user's preference. | Admin | Admin console › Feature flags | Admin › Feature flags › Per user › switch | — |
| Admin & settings | `unsetUserFeatureFlag` | Clears one user's preference. | Admin | Admin console › Feature flags | Admin › Feature flags › Per user › 'Use cluster setting' | — |
| Admin & settings | `listFeatureFlagUsers` | Finds users to manage. | Admin | Admin console › Feature flags | Admin › Feature flags › Per user › search | — |
| Admin & settings | `listFeatureFlagChanges` | Feature-flag change history. | Admin | none **[NO]** | Admin › Feature flags › History (also an Audit log filter) | New UI. ≤200 rows, no cursor. |
| Admin & settings | Per-flag delivery to workers (derived from `listWorkers`) *(client-only)* | Whether each worker has picked up a flag change. | Admin | Feature flags panel | Admin › Feature flags › Delivery column | — |
| Admin & settings | `getCurrentUserProfile` | Your profile, admin scope and capability flags. | Signed-in | Profile load | Settings › Profile; the rail shows Admin by capability | Gate on `capabilities`, not the raw role. |
| Admin & settings | `setCurrentUserProfileSettings` | Saves UI preferences (replaces the whole object). | Signed-in | Every preference change; polled every 5 s | Background: Settings › Appearance, pins, group collapse, sort, canvas prefs, Boards | Needs API work: revision and merge (Q3). |
| Admin & settings | `pruneDeletedSummaries` | Deletes summaries of deleted sessions older than a date. | Admin | none **[NO]** | Admin › Maintenance › Prune deleted-session summaries | New UI; Maintenance is listed under Gaps in the README IA. |

## 11. Stats and telemetry

Per-session numbers go to Session › Activity › Stats, with a scope switch for "This session" and "With sub-agents". Fleet numbers go to Admin › Cluster usage, and knowledge numbers to Admin › Knowledge. Ops marked Admin read are `fleet:read`: open to every user while ownership enforcement is off.

| Domain | Operation | What it does | Who | Today | New home | Notes |
|---|---|---|---|---|---|---|
| Observability | `getSessionMetricSummary` | A session's metric summary. | Reader | Inspector › Stats › Session | Session › Activity › Stats | — |
| Observability | `getSessionTokensByModel` | A session's tokens by model. | Reader | Inspector › Stats | Session › Activity › Stats › Tokens by model | — |
| Observability | `getSessionSkillUsage` | Skills a session used. | Reader | Inspector › Stats | Session › Activity › Stats › Skills | — |
| Observability | `getSessionFactsStats` | Facts a session read and wrote. | Reader | Inspector › Stats | Session › Activity › Stats › Memory | — |
| Observability | `getSessionTreeStats` | Stats rolled up across the spawn tree. | Reader | Inspector › Stats | Session › Activity › Stats (With sub-agents); Session › Agents header totals | — |
| Observability | `getSessionTreeSkillUsage` | Skill use across the spawn tree. | Reader | Inspector › Stats | Session › Activity › Stats › Skills (With sub-agents) | — |
| Observability | `getSessionTreeFactsStats` | Facts use across the spawn tree. | Reader | Inspector › Stats | Session › Activity › Stats › Memory (With sub-agents) | — |
| Observability | `getSessionRetrievalUsage` | Facts and graph searches a session ran. | Reader | none **[NO-T]** | Session › Activity › Stats › Memory › Retrieval | New UI and a transport method; hidden when the store lacks search. |
| Observability | `getSessionTreeRetrievalUsage` | Retrieval across the spawn tree. | Reader | none **[NO-T]** | Session › Activity › Stats › Memory › Retrieval (With sub-agents) | New UI and a transport method. |
| Observability | `getSessionGraphNodeUsage` | Graph nodes a session touched. | Reader | none **[NO-T]** | Session › Activity › Stats › Memory › Graph nodes | New UI; shown only when a graph store exists. |
| Observability | `getSessionGraphEdgeSearchUsage` | Graph edge searches a session ran. | Reader | none **[NO-T]** | Session › Activity › Stats › Memory › Graph edges | New UI. |
| Observability | `getSessionGraphSearches` | A session's recent graph searches. | Reader | none **[NO-T]** | Session › Activity › Stats › Memory › Recent searches | New UI. |
| Observability | `getFleetStats` | Fleet-wide stats (redacted for cluster-scoped admins). | Admin read | Inspector › Stats › Fleet | Admin › Cluster usage | — |
| Observability | `getFleetSkillUsage` | Fleet-wide skill use. | Admin read | Inspector › Stats › Fleet | Admin › Cluster usage › Skills | Refused for cluster-scoped admins: hide, don't error. |
| Observability | `getFleetRetrievalUsage` | Fleet-wide retrieval use. | Admin read | Inspector › Stats › Fleet | Admin › Cluster usage › Retrieval | Same as above. |
| Observability | `getFleetGraphNodeUsage` | Fleet-wide graph node use. | Admin read | none **[NO-T]** | Admin › Knowledge › Graph › Usage | New UI and a transport method. |
| Observability | `getUserStats` | Per-user stats. | Admin read | Inspector › Stats › Users | Admin › Cluster usage › Users | — |
| Observability | `getSharedFactsStats` | Shared facts counts. | Admin read | Inspector › Stats › Fleet | Admin › Knowledge › Overview | — |
| Observability | `getFactsTombstoneStats` | Deleted facts waiting to be purged. | Admin read | Inspector › Stats › Fleet | Admin › Knowledge › Overview (count next to Purge) | — |
| Observability | `getTopEventEmitters` | The noisiest event emitters since a date. | Admin read | none **[NO]** | Admin › Cluster usage › Noisiest sessions | New UI. |

## 12. Knowledge: facts and graph

Agents' shared memory. No portal surface calls any of these today; the redesign gives them Admin › Knowledge. The facts and graph data plane is open to any signed-in user at the API, but the UI keeps editing in Admin and offers non-admins a read-only per-session view (see Gaps in the README IA). Hand-editing graph nodes and edges stays MCP-only.

| Domain | Operation | What it does | Who | Today | New home | Notes |
|---|---|---|---|---|---|---|
| Knowledge | `factsCapabilities` | What the store supports: search, embedder, graph. | Signed-in | none **[NO-T]** | Background: shows or hides Knowledge tabs and Memory stats | Transport method needed. |
| Knowledge | `readFacts` | Reads facts by key and scope. | Signed-in (shared; session facts with read access; admins all) | none **[NO-T]** | Admin › Knowledge › Facts (browse by scope) | New UI. |
| Knowledge | `storeFact` | Adds or changes a fact. | Facts writer (shared, or sessions you can write) | none **[NO-T]** | Admin › Knowledge › Facts › Add / Edit | New UI. |
| Knowledge | `deleteFact` | Deletes a fact or a key pattern. | Facts writer | none **[NO-T]** | Admin › Knowledge › Facts › Delete | Pattern deletes confirm the match count first. |
| Knowledge | `searchFacts` | Searches facts: lexical, semantic or hybrid. | Signed-in (facts read) | none **[NO-T]** | Admin › Knowledge › Facts › Search (mode switch) | Modes hidden on a basic store (`FACTS_ENHANCED_UNSUPPORTED`). |
| Knowledge | `similarFacts` | Facts close in meaning to one fact. | Signed-in (facts read) | none **[NO-T]** | Admin › Knowledge › fact › Similar facts | Enhanced store only. |
| Knowledge | `getEmbedderStatus` | Whether the embedder runs and how far it has got. | Signed-in | none **[NO-T]** | Admin › Knowledge › Embedder | New UI. |
| Knowledge | `startFactsEmbedder` | Starts the embedder loop. | Admin | none **[NO-T]** | Admin › Knowledge › Embedder › Start | New UI. |
| Knowledge | `stopFactsEmbedder` | Stops the embedder loop. | Admin | none **[NO-T]** | Admin › Knowledge › Embedder › Stop | New UI. |
| Knowledge | `forcePurgeFacts` | Purges soft-deleted facts now. | Admin | none **[NO-T]** | Admin › Knowledge › Facts › Purge deleted facts | Danger action; shows the pending count. |
| Knowledge | `searchGraphNodes` | Searches graph nodes. | Signed-in | none **[NO-T]** | Admin › Knowledge › Graph › Search nodes | `GRAPH_UNSUPPORTED` hides the Graph tab. |
| Knowledge | `searchGraphEdges` | Searches graph edges. | Signed-in | none **[NO-T]** | Admin › Knowledge › Graph › Search edges | — |
| Knowledge | `graphNeighbourhood` | Expands the graph around a node. | Signed-in | none **[NO-T]** | Admin › Knowledge › Graph › node › Neighbourhood | — |
| Knowledge | `upsertGraphNode` | Creates or updates a graph node. | Signed-in | none **[NO-T]** | Not exposed | Agents maintain the index; see Not exposed on purpose. |
| Knowledge | `upsertGraphEdge` | Creates or updates a graph edge. | Signed-in | none **[NO-T]** | Not exposed | Same as above. |
| Knowledge | `deleteGraphNode` | Deletes a graph node. | Signed-in (UI: admins) | none **[NO-T]** | Admin › Knowledge › Graph › node ⋯ › Delete | Cleanup only. |
| Knowledge | `deleteGraphEdge` | Deletes a graph edge. | Signed-in (UI: admins) | none **[NO-T]** | Admin › Knowledge › Graph › edge ⋯ › Delete | Cleanup only. |
| Knowledge | `graphStats` | Node and edge counts. | Signed-in | none **[NO-T]** | Admin › Knowledge › Overview | — |
| Knowledge | `listGraphNamespaces` | Lists graph namespaces. | Signed-in | none **[NO-T]** | Admin › Knowledge › Graph › Namespace picker | — |
| Knowledge | `getGraphNamespace` | One namespace's details. | Signed-in | none **[NO-T]** | Admin › Knowledge › Namespaces › namespace | — |
| Knowledge | `upsertGraphNamespace` | Registers or updates a namespace. | Admin | none **[NO-T]** | Admin › Knowledge › Namespaces › Add / Edit | — |
| Knowledge | `deleteGraphNamespace` | Deletes a namespace and its data. | Admin | none **[NO-T]** | Admin › Knowledge › Namespaces › Delete | Danger action; `default` cannot be deleted. |

## 13. Boards and other client-only capabilities

Things with no server API of their own. Most of their state rides in profile settings, which is why `setCurrentUserProfileSettings` needs conflict handling before Boards and pins can be trusted across tabs.

| Domain | Operation | What it does | Who | Today | New home | Notes |
|---|---|---|---|---|---|---|
| Client-only | Master of Agents dashboards (`profileSettings.moa`) *(client-only)* | Saved tiled views of chats and canvases (≤5 boards, ≤16 tiles). | Signed-in | Master of Agents mode | Boards `/boards/:id` | Needs API work: its own resource with a revision (Q3). No sharing today. |
| Client-only | Themes (20) *(client-only)* | Colour themes and touch scale. | Signed-in | Theme button; `Shift+T` | Settings › Appearance; ⌘K 'Change theme' | — |
| Client-only | View history (custom back and forward) *(client-only)* | Ten-step history with its own arrows. | Signed-in | Toolbar arrows; `Alt+-` / `Alt++` | Browser Back and Forward (real routes) | Deleted; routes replace it. |
| Client-only | Pinned and ordered sessions (profile settings) *(client-only)* | Pin sessions and keep a manual order. | Signed-in | Pin button; drag in Saved order | Sessions list › Pinned section; sort menu › Manual order; row ⋯ › Pin; Session ⋯ › Pin | — |
| Client-only | Deep links (`?session=`, `?view=canvas`, `?show_chrome=false`, …) *(client-only)* | Open the portal at a session, canvas or file. | Reader | Entry only; the URL never updates | Routes (`/s/:id`, `/s/:id/canvas/:slot`, …); old query links redirect | — |
| Client-only | Phone layouts and Zen *(client-only)* | Layouts for screens ≤920px. | Signed-in | Mobile toolbar, Main cycle, Zen | Phone bottom tab bar; session segmented control; Admin and Providers under More | Admin works on phones for the first time. |

## 14. Realtime: WebSocket messages and session events

The socket, its messages and the events the UI must render. None of these has a page of its own: they feed the views named in the New home column. The rail's connection status (Connected, Reconnecting with a countdown, Offline) is the only user-facing sign of the socket itself.

| Domain | Operation | What it does | Who | Today | New home | Notes |
|---|---|---|---|---|---|---|
| Realtime | `WS /api/v1/ws` | The product WebSocket. | Signed-in (Bearer or subprotocol); link holder for canvas only | App-wide socket | Background: rail connection status | Needs API work: reconnect backoff (Q7). |
| Realtime | `WS /portal-ws` (legacy) | Legacy socket; also takes `theme`. | Signed-in | Not used by the new client | Not exposed | Retire (Q9). |
| Realtime | Close codes `4401`, `4403`, `1013` | Unauthorized, forbidden or revoked link, slow consumer. | — | Re-auth or forbidden handler | Sign-in screen (4401); Access denied or 'link no longer valid' (4403); rail 'Reconnecting' (1013) | — |
| Realtime | `subscribeSession` / `unsubscribeSession` (client → server) | Follow one session's events. | Reader | Opening a session | Background: Session, Board tiles | ≤64 sessions per socket; Boards show at most 16. |
| Realtime | `subscribeCanvas` / `unsubscribeCanvas` (client → server) | Follow a session's canvas plane. | Reader; link holder on the share socket | Canvas pane | Background: Session › Canvas, Board canvas tiles, `/c/:token` | Missing from `WS_CLIENT_MESSAGES` (Q8). |
| Realtime | `subscribeLive` / `unsubscribeLive` (client → server) | Follow ephemeral live topics (≤16). | Reader | Streaming preview; native tasks | Background: streaming preview in Chat; Session › Agents tasks | — |
| Realtime | `subscribeLogs` / `unsubscribeLogs` (client → server) | Follow the fleet log tail. | Admin (open to all while enforcement is off) | Inspector › Logs › Tail | Session › Activity › Logs (filtered to the session); Admin › Workers › Logs (proposed) | Needs API work: server-side filter and catch-up. |
| Realtime | `publishLive` (client → server) | Client publishing to the live plane. | — | Always refused | Not exposed | Server-only by design. |
| Realtime | `theme` / `themeAck` (legacy socket) | Legacy theme sync. | Signed-in | Legacy | Not exposed | Theme is a profile setting. |
| Realtime | `ready` (server → client) | The socket is usable. | — | Connection status | Background: rail 'Connected' | — |
| Realtime | `subscribedSession` / `subscribedCanvas` / `subscribedLive` / `subscribedLogs` | Subscription acknowledgements. | — | Internal | Background | `subscribedCanvas` missing from `WS_SERVER_MESSAGES` (Q8). |
| Realtime | `sessionEvent` (server → client) | A durable session event. | Reader | Chat and activity | Background: feeds Session › Chat, Activity › Timeline, header state | Replay with `getSessionEvents` after reconnect. |
| Realtime | `live` (server → client) | Ephemeral last-value state (snapshot, patch, signal, unavailable). | Reader | Streaming; native tasks | Background: Chat streaming preview; Agents view tasks | — |
| Realtime | `canvasLive` (server → client) | Canvas tick or key/value change. | Reader; link holder | Canvas frames | Background: Session › Canvas, Board tiles, `/c/:token` | Missing from `WS_SERVER_MESSAGES` (Q8). |
| Realtime | `logEntry` (server → client) | One log line. | Admin | Inspector › Logs | Session › Activity › Logs | Live only; no history. |
| Realtime | `error` (server → client) | Scoped error, including `ACCESS_REVOKED`. | — | Synthetic access-revoked event | Session banner 'Your access to this session was removed'; canvas 'unavailable' state | — |
| Realtime | `getLive` | Current retained live-plane values, by topic. | Reader | Internal resync *(partial)* | Background: resync for the Chat streaming preview and Agents tasks | — |
| Realtime | `assistant.live_tick` (synthetic) | Streaming preview of the reply being written. | Reader | Live preview | Session › Chat (streaming text) | Only when the deployment sets `PILOTSWARM_LIVE_TURN=1`; Chat must look right without it. |
| Realtime | `session.native_tasks_tick` (synthetic) | In-session tasks snapshot. | Reader | Task cards | Session › Agents; Chat task cards | — |
| Realtime | `session.canvas_data` (synthetic) | Canvas data tick from the plane. | Reader | Canvas frame | Session › Canvas frames; updated dot on the tab | — |
| Realtime | `session.canvas_kv` (synthetic) | Key/value change posted into the canvas. | Reader | Canvas frame | Session › Canvas frames | — |
| Realtime | `session.canvas_plane_released` (synthetic) | The canvas plane went away; durable events resume. | Reader | Internal | Background | — |
| Realtime | `session.access_revoked` (synthetic) | Your access was removed while you watched. | Reader | Generic | Session banner; composer turns read-only; the row leaves the Sessions list | Copy must cover the opaque 404 (Q15). |
| Realtime | Transcript: `user.message`, `assistant.message`, `assistant.reasoning`, `system.message`, `assistant.intent` | Messages, reasoning, notices and the agent's stated intent. | Reader | Chat bubbles and activity | Session › Chat (reasoning collapsed as 'Thinking'); intent shown as the current step on Home › Running and in Session › Agents | — |
| Realtime | Turn: `session.turn_started/_completed/_stopped`, `assistant.turn_start/_end`, `assistant.usage`, `session.usage_info`, `session.compaction_start/_complete` | Turn boundaries, usage and compaction. | Reader | Partly dedicated; context meter | Chat turn boundaries; header context meter; Activity › Timeline and Stats | — |
| Realtime | Tools: `tool.execution_*`, `external_tool.*`, `skill.invoked`, `hook.*`, `permission.*` | Tool calls, skills, hooks and permission requests. | Reader | Call lines | Session › Chat one-line tool rows that expand; Activity › Timeline | — |
| Realtime | Questions: `session.input_required_started` | The agent asks a question, with choices. | Reader | Question card; answer mode | Session › Chat inline form with choice buttons; Home › Needs you; state pill 'Needs you' | — |
| Realtime | Waits and schedules: `session.wait_*`, `session.cron_*`, `session.cron_at_*` | Timers and schedules start, fire, complete or are cancelled. | Reader | Activity lines; `cron_waiting` status | Header state pill (Waiting · timer or schedule, next time); Home › Scheduled and waiting; a quiet Chat notice | — |
| Realtime | Turn control: `user.steer`, `user.stop`, `session.control_outcome`, `session.steer_confirmed`, `session.carried_steers_closed`, `pending_messages.cancelled`, `session.message_duplicate_suppressed`, `session.fifo_overflow` | What happened to Stop, Steer and queued messages. | Reader | Turn-control chips | Session › Chat composer chips (Delivered, Carried, Not delivered); queue strip; overflow warning | `fifo_overflow` is a generic line today; give it a notice. |
| Realtime | Model and regenerate: `session.model_changed/_resolved/_mismatch`, `session.regenerate_requested/_refused/_failed`, `session.epoch_committed`, `session.regenerated` | Model switches and context rebuilds. | Reader | Model chip; refusals inline; the rest generic | Header model chip; regenerate progress banner; mismatch warning notice in Chat | Several are generic lines today (01 §5.2). |
| Realtime | Sub-agents: `session.agent_spawned`, `subagent.*`, `session.child_update_suppressed`, `session.child_cleanup_completed`, `native.task_updated`, `native.<type>` | Sub-agents start, finish or fail; tasks update. | Reader | Spawn lines; task cards | Chat sub-agent cards linking to the child; Session › Agents tree | — |
| Realtime | Budget: `session.budget_paused` | A turn is held by a limit, allowance, hold or missing provider. | Reader | Generic grey line | Header pill 'Waiting · budget hold' with reset time; Chat notice with Open provider; Home › Needs you | New UI. |
| Realtime | Working folder: `session.workspace_changed/_unavailable/_available/_adopted/_defaults/_opened/_released/_files_changed/_files_noted` | The working folder changes, fails, recovers, or its files change. | Reader | All generic lines | Header pill 'Waiting · working folder'; Chat notices; Files › Folders refresh; Home › Needs you | New UI. |
| Realtime | Canvas and outputs: `session.canvas_updated/_data/_presented/_app_published`, `session.artifact_presented` | A canvas was drawn, updated or shown; a file was presented. | Reader | Canvas state; auto-open | Canvas tab updated dot; Chat 'Drew X · Open' card; file chips | — |
| Realtime | Lifecycle and runtime: `session.hydrated/_dehydrated/...`, `session.error`, `session.warning`, `session.truncation`, `session.title_changed`, `session.todos_changed`, `runtime.*` | Sleep and wake, errors, warnings, titles, todos, runtime anomalies. | Reader | Error card; rest generic or hidden | Chat structured error card (sentence, fix button, details); warning chip on a dropped image (`runtime.attachment_dropped`); header title; Activity › Timeline for sleep and wake | Structured errors need error codes (see Backend work). |

## Not exposed on purpose

These stay API, MCP or CLI only. Each has a reason, and where users still
need the outcome, the redesign meets it another way.

| Operation or route | Why it stays out of the UI | How the need is met instead |
|---|---|---|
| `listSessions` | Unpaged; its cost grows with history. Superseded | `listSessionsPage` (with the push and filters in Backend work) |
| `assignSessionsToGroup`, `moveSessionsToGroup` | Deprecated aliases (01 Q11) | `placeSessionsInGroup` |
| `cancelSessionGroup`, `completeSessionGroup` | Deprecated. A one-click "close everything in this group" hides how many sessions and sub-agents it touches | Group header ⋯ › Select all, then the bulk bar, which names the count and cascade (backed by the bulk op in Backend work) |
| `sendSessionEvent` | An integration hook: agents treat custom events as external triggers. A button would let people inject events with no user-facing meaning | MCP `send_session_event` and the API |
| `getSessionStatus`, `waitForStatusChange`, `getLatestResponse` | Conveniences for clients without a WebSocket. The portal gets the same facts from `getSession` and the event stream | MCP, CLI and scripts |
| `getDefaults`, `setMyDefault`, `setClusterDefault` | Compatibility and deprecated aliases | `getModelDefaults`, `setModelDefault` |
| `upsertGraphNode`, `upsertGraphEdge` | The graph is an index agents build over facts. Hand-made nodes and edges drift from the facts and can mislead retrieval, and the API does not restrict them to admins | MCP graph tools. The UI offers delete (cleanup) only, in Admin › Knowledge |
| `publishLive` (WS) | Refused by the server: live publishing is server-only | — |
| `GET /api/v1/health`, `GET /api/health` | Infrastructure probe, not a user feature. It should also stop disclosing the authz posture (01 Q16) | Load balancers and smoke tests |
| `POST /api/rpc`, `WS /portal-ws` with `theme` / `themeAck`, legacy REST mirrors (`/api/auth-config`, `/api/auth/me`, `/api/bootstrap`, `/api/sessions/:id/artifacts/*`) | Legacy surfaces kept for a deprecation window (01 Q9) | The new client uses `/api/v1` only. `/api/portal-config` is the one legacy route it still needs until a `/api/v1` equivalent exists |

Two capabilities are reachable but deliberately narrowed in the UI:

- **Run pickers never use `getModelsByProvider`** (provider-type templates).
  They use `listModels`, which lists only models the viewer can run (01 Q13).
  The templates appear only in Providers › Add provider.
- **Graph deletes and facts edits are admin-only in the UI**, although the API
  admits any signed-in user. Non-admins get read-only memory views in
  Session › Activity › Stats › Memory.

## Backend work the redesign needs

Gaps found in research/01 and in mapping the README's screens to real
operations. **Blocks** means a README feature cannot ship as designed
without it; **Quality** means the feature ships but is slow, lossy or
misleading without it.

| # | Gap | Redesign feature that depends on it | Suggested API shape | Impact | Evidence |
|---|---|---|---|---|---|
| B1 | **No schedule operations.** You can see that a session has a cron or one-shot wake, but you cannot list, pause, resume or cancel one | Home › Scheduled and waiting (actions); header Schedule popover; Sessions › State › Scheduled | `GET /management/schedules?scope=mine\|all&cursor` → `[{sessionId, kind: cron\|at, interval, at, timezone, nextFireAt, reason, firesCompleted, maxFires, paused}]`; `POST /management/sessions/:id/schedule/pause\|resume\|cancel` (session:manage), emitting `session.cron_paused/_resumed/_cancelled` (the UI already handles `cron_cancelled`, which nothing emits) | Blocks | 01 §1.2, G6 |
| B2 | **No "wake now".** Nothing ends a timer or schedule wait early | Home › Scheduled and waiting › Wake now; header pill | `POST /management/sessions/:id/wake {reason?}` (session:write) → `{woke}` or a refusal `not_waiting\|waiting_on_sub_agents\|budget_hold\|working_folder`, each pointing to its real fix (`retrySessionWorkspace`, Providers) | Blocks | No such op in `protocol.js` |
| B3 | **No reopen after Complete or Cancel.** A closed session refuses messages (409) | The "Session completed · Undo" toast | Recommended: no API. The client holds the call for 5 s and Undo cancels it. Alternative: `POST /management/sessions/:id/reopen` within a grace window | Blocks (as written) | 01 §1.1 (terminal → 409) |
| B4 | **Session list is polled, not pushed.** The UI walks every page every 4 s | Sessions list, Home sections, sub-agent and canvas chips | WS `subscribeCatalog {filter}` → snapshot, then `catalog {seq, kind: upsert\|remove, session}`; resync with `listSessionsPage` on a seq gap | Quality | 01 Q1 |
| B5 | **No server-side search or filters on sessions** | Sessions toolbar (search, Mine · Shared with me · All, State, Agent, Group); ⌘K | Add `q`, `owner: me\|shared\|all`, `state[]`, `agentName`, `groupId` (caller's own), `parentSessionId`, `waitKind` to `listSessionsPage` | Quality (Blocks at scale) | 01 Q2 |
| B6 | **Wait reasons are derived in the client**, and a working-folder wait reads as plain "waiting" | The state pill on every row, header and tile ("Waiting · budget hold · resets 00:00") | `getSession` and list rows return `waitReason {kind: input\|timer\|cron\|sub_agents\|budget\|working_folder, until?, detail, actions[]}` | Blocks | 01 §5.2 (status gaps) |
| B7 | **No "needs you" feed.** Paused sessions cap at 100 with no cursor; failed turns and working-folder failures have no list; clone expiry has no data source at all | Home › Needs you | `GET /management/attention?cursor` → `[{kind: input_required\|turn_failed\|budget_paused\|working_folder_failed\|clone_expiring, sessionId, since, detail}]`, pushed on the catalog topic | Blocks | 01 §1.7, §4.3; README Home |
| B8 | **No cross-session outputs or canvases** | Home › Recent outputs; Canvases › Recent | `GET /artifacts/recent?limit&cursor` → `[{sessionId, filename, contentType, sizeBytes, uploadedAt, source}]`; `GET /canvases/recent?limit&cursor` → `[{sessionId, slot, name, docRev, updatedAt}]` | Blocks | No such ops in `protocol.js` |
| B9 | **No canvas app catalog op.** Only the agent tool `find_canvas_app` can browse it | Canvases › App catalog; "Use in a session" | `GET /canvas-apps?q&cursor`, `GET /canvas-apps/:id`, wrapping `canvas-app-catalog.ts` | Blocks | 03 §6 |
| B10 | **No tree endpoint.** The spawn tree is rebuilt from the whole catalog | Session › Agents; sub-agent chips; cascade counts | `GET /management/sessions/:id/tree?depth` → `[{sessionId, parentId, title, agentName, state, waitReason, lastDigestAt, outcome?{verdict, summary}}]` | Quality | 01 §1.2 |
| B11 | **No bulk lifecycle or cascade preview.** The bulk bar fires one call per session; nothing says how many sub-agents a close will take with it | Bulk bar; ⋯ danger section ("Also cancels 3 sub-agents") | `POST /management/sessions/bulk {action: complete\|cancel\|delete, sessionIds[≤200], reason?, dryRun?}` → per session `{ok, error?, cascadeCount}`. Replaces `cancelSessionGroup` / `completeSessionGroup` | Quality | 01 G11 |
| B12 | **Upload ceiling ≈ 5.9 MB, no progress, wrong source.** Base64 inside an 8 MB JSON envelope; uploads are recorded as `source:"agent"` | Composer 📎 and drag; Files › Outputs › Upload; "Uploaded by you" | `PUT /api/v1/sessions/:id/artifacts/:filename/content` with a raw streamed body (Content-Type, Content-Length) up to the binary cap; the server stamps `source:"user"` | Quality | 01 Q5, Q17 |
| B13 | **Oversized requests return an HTML error page.** Body parsers are installed app-wide (`installJsonBodyLimits` in `server.js`), but the 413 mapper lives inside the `/api/v1` router | Every upload, package publish and long prompt ("File is larger than 10 MB") | App-level error middleware for `/api/v1/*` and `/api/canvas-share/*` that returns `PAYLOAD_TOO_LARGE` (413) in the envelope with `limitBytes`; a test with no custom handler | Quality | 01 Q4 (handler placement checked in `server.js` and `router.js`) |
| B14 | **Settings are saved without a conflict check.** The whole object is replaced; two tabs or devices overwrite each other; polled every 5 s | Settings › Appearance; pins; group collapse; sort; Boards; canvas prefs | `PATCH /me/profile/settings` as a JSON merge patch with `expectedRevision` → 409 `SETTINGS_CONFLICT {current, revision}`; push changes on a per-user topic; move Boards to `/me/boards/:id` with their own revision | Blocks (Boards) | 01 Q3 |
| B15 | **WebSocket reconnects with no backoff.** Fixed 1.5 s, no jitter (`RECONNECT_DELAY_MS = 1500` in `api-client.js`) | Rail "Reconnecting (with retry countdown)"; offline banner | Exponential backoff with full jitter (1 s base, 30 s cap), reset on `ready`; expose state and next-attempt time to the UI; optional `retryAfterMs` in the server's shutdown close | Quality | 01 Q7 |
| B16 | **Ownership checks are off by default.** With `AUTHZ_ENFORCE_OWNERSHIP=false`, "Private" is not enforced for direct-id access, and plain users can open fleet stats and the log tail | The Share dialog's "Private"; Admin › Cluster usage; Activity › Logs | Make enforcement the default for new deployments (or refuse to start without an explicit value); keep the posture out of the public health route; include it in bootstrap for admins | Blocks (truthful sharing copy) | 01 §3.2, Q16 |
| B17 | **Canvas WS messages are missing from the protocol.** `subscribeCanvas`, `unsubscribeCanvas`, `subscribedCanvas`, `canvasLive` are not in `WS_CLIENT_MESSAGES` / `WS_SERVER_MESSAGES`; the API reference also omits per-route body caps, error extras, `authz` in health and the `dev` provider | The rebuilt canvas host and typed hooks | Add the four messages to the constants and to `docs/api/reference.md`; generate typed WS message types from `protocol.js` | Quality | 01 Q8 |
| B18 | **Errors are not structured enough for fix buttons.** Some HTTP statuses come from message regexes; `session.error` carries text, not a code | Chat error cards ("[Open provider] [Show details]"); New session inline problems | `session.error.data {code, category: provider\|worker\|working_folder\|model\|budget\|auth, remedy {action, target}}`; explicit codes instead of regex status mapping; map `PORTAL_ADMIN_REQUIRED` to 403 | Blocks (structured errors) | 01 Q6; README Session › Errors |
| B19 | **Missing keys fail at turn time, not create time** | New session sheet first-run state; Home first-run | `GET /session-readiness?agentName&model` → `{ok, problems[{code: NO_PROVIDER\|GHCP_KEY_MISSING\|MODEL_UNRESOLVED\|NO_WORKERS\|AGENT_NOT_ALLOWED, fix}]}`, or the same check inside `createSession` | Quality | 01 Q14 |
| B20 | **Audit and flag history have no paging or filters** (≤200 rows, `limit` only) | Admin › Audit log; Share › Access history; Feature flags › History | Add `cursor`, `since`, `until`, `decision[]`, `actor`, `sessionId` to `listAuthzAudit` and `listFeatureFlagChanges` | Quality | 01 §4.3 |
| B21 | **Log tail is fleet-wide, live-only and not filterable on the server** | Session › Activity › Logs; Admin › Workers › Logs | `subscribeLogs {sessionId?, level?, podName?}` filtered server-side; `GET /management/logs/recent?sessionId&since&limit` from a short ring buffer for catch-up; admin gate enforced regardless of dark launch (or session:read when `sessionId` is given) | Quality | 01 §1.10 |
| B22 | **Package adoption is admin-only** | Agents › package › Workers ("which workers run it") for package authors | `GET /agent-packages/:name/adoption?scope` → redacted `[{worker, version, state}]` for the creator and editors | Quality | 01 §1.6 |
| B23 | **Nothing outside sessions is pushed.** Providers (60 s), flags and steering (30 s), workers and fleet stats are polled | Providers table; Feature flags delivery; Workers; Steer availability | Signal topics on the socket (`providers`, `features`, `workers`, `me`) that tell the client to refetch | Quality | 01 §2.5 |
| B24 | **`/api/portal-config` has no `/api/v1` equivalent** | App shell branding; Files › Folders on/off | `GET /api/v1/portal-config`, same shape; keep the legacy route as an alias | Quality | 01 Q9 |
| B25 | **Question choices are not enforced by the server** | Inline question form | `sendAnswer` checks `choices` when `allowFreeform=false` → 400 `ANSWER_NOT_A_CHOICE` | Quality | 01 §1.1 |
| B26 | **A public canvas link can be copied only once.** A link made on another device can only be reset | Session › Canvas › Share › Link | Decide: keep (safer; the dialog says so) or store the token encrypted for the owner to reveal again | Decision | 03 §5.8 |

## Gaps in the README IA

Capabilities that have no sensible home in the README's information
architecture, with a concrete proposal for each. The README is unchanged;
these are for its authors to accept or reject.

1. **Model defaults are not per provider.** The README puts Defaults inside provider detail, but defaults are deployment-wide `provider:model` tuples (`getModelDefaults`, `setModelDefault`, `setSystemModelDefault`). Proposal: an area-level **Providers › Defaults** tab (my, cluster and system default, with restart behaviour), and "Default" badges on provider rows.
2. **GitHub Copilot keys have no home.** Your key, the System key and legacy-key adoption are not providers (`setCurrentUserGitHubCopilotKey`, `setSystemGitHubCopilotKey`, `getSystemGitHubCopilotKeyStatus`, `adoptLegacySystemGitHubCopilotKey`). Proposal: a **Providers › GitHub Copilot** entry (Your key; for admins, System key) and an admin banner for legacy adoption.
3. **Owners cannot see who accessed their session.** `listAuthzAudit` lets an owner read audit for their own session; the README has only Admin › Audit log. Proposal: **Session › Share › Access history** tab.
4. **The deployment's access posture has no home.** Ownership enforcement, default visibility and admin scope change what "Private" means. Proposal: rename Admin › Audit log to **Admin › Access & audit** with a posture card, and have the Share dialog warn when enforcement is off.
5. **The fleet-wide log tail has no admin home.** Activity › Logs is per session. Proposal: **Admin › Workers › Logs** tab.
6. **Admin maintenance has no home** (`pruneDeletedSummaries`, `getTopEventEmitters`). Proposal: **Admin › Maintenance** for pruning; "Noisiest sessions" under **Admin › Cluster usage**; the facts purge stays in Knowledge.
7. **Per-session memory telemetry has no view.** Activity lists Timeline, Logs, Nodes, History and Stats; five retrieval and graph ops plus session facts need a place, and non-admins may read their session's facts. Proposal: a **Session › Activity › Stats › Memory** section, read-only, shown only when the store supports it.
8. **Sub-agent results are missing from the Agents view.** The README lists state, last digest and actions. Proposal: rows also show verdict and summary (`listChildOutcomes`), and Chat sub-agent cards show the result.
9. **Schedules are display-only.** Proposal: the header state pill opens a **Schedule** popover (next run, interval, timezone, runs done; Pause, Cancel and Wake now once B1 and B2 land), and the Sessions State filter gains **Scheduled**.
10. **Files routes are ambiguous.** `/s/:id/files[/path]` does not say Outputs or which folder. Proposal: `/s/:id/files/outputs[/:filename]` and `/s/:id/files/folders/:folderId[/*path]`; legacy `?session&artifact&view` links redirect.
11. **Folders are owner-only, even for admins**, but the README presents Files › Folders to everyone. Proposal: collaborators and admins see the Folders tab disabled with the reason, and get Outputs only.
12. **"No workers" and worker-side setup errors have no home.** First-run covers providers only. Proposal: the Home blocked state and the New session inline state also cover "No workers running" (`getWorkerCount`) and provider-not-set-up-on-worker errors.
13. **Package adoption is promised to all authors** ("which workers run it"), but `listAgentWorkerState` is admin-only. Proposal: show it to admins only until B22 exists.
14. **Feature-flag history has two candidate homes** (Admin › Feature flags "with audit", and Admin › Audit log). Proposal: **Admin › Feature flags › History** is the home; the Audit log gets a "Feature changes" filter that links there.
15. **README actions with no API behind them:** Home "Wake now", the "Undo" toast after Complete, "Raise limit" for users who cannot set limits on a shared provider, and "unpushed clones about to expire". Proposal: ship each only when its Backend work item lands (B2, B3, B7); for non-admins, "Raise limit" becomes "Open provider".

## Totals

**Operations by primary home** (the 178 operations in `protocol.js`; each counted once). The last column counts the other rows above (hand-written routes, WebSocket messages, events and client-only capabilities) by their primary home.

| New area | Operations (primary home) | Operations reachable here (primary or shortcut) | Routes, WS, events, client-only (primary home) |
|---|---:|---:|---:|
| Home | 1 | 10 | 1 |
| Sessions | 6 | 6 | 1 |
| New session | 3 | 9 | 0 |
| Session › Header | 10 | 15 | 5 |
| Session › Share | 6 | 7 | 0 |
| Session › Chat | 6 | 10 | 8 |
| Session › Canvas | 8 | 8 | 4 |
| Session › Files | 11 | 13 | 3 |
| Session › Agents | 2 | 4 | 4 |
| Session › Activity | 16 | 19 | 2 |
| Boards | 0 | 6 | 1 |
| Canvases | 0 | 1 | 1 |
| Agents | 15 | 17 | 2 |
| Providers | 29 | 30 | 0 |
| Admin | 42 | 45 | 2 |
| Settings | 5 | 7 | 1 |
| Public viewer | 0 | — | 3 |
| App shell | 0 | 1 | 7 |
| Background | 4 | — | 14 |
| Not exposed | 14 | — | 5 |
| **Total** | **178** | — | **64** |

The "reachable" column counts operations whose New home mentions the area at all, including shortcuts, so it does not add up to 178. Home is the clearest case: it is the primary home of almost nothing, because it aggregates rows that live elsewhere.

The Session screen (header, Share, Chat, Canvas, Files, Agents, Activity) is the primary home of **59** operations. Admin is the primary home of **42** operations, 22 of them in Admin › Knowledge. **14** operations stay out of the UI on purpose, and **4** run without a control of their own.

**Operations by exposure today** (01 §6)

| Today | Operations |
|---|---:|
| Exposed | 119 |
| Partial | 6 |
| Read through bootstrap | 5 |
| Transport only, no UI (NO) | 15 |
| No transport (NO-T) | 33 |
| **Total** | **178** |

**Currently unexposed operations that become exposed: 39 of 48.**

Of the 48 operations no portal UI calls today (15 NO, 33 NO-T):

- **39 get a visible home.** Admin: 24; Session › Activity: 5; Session › Files: 3; Providers: 3; Session › Agents: 2; Session › Header: 1; Agents: 1.
- **1 is used in the background:** `factsCapabilities` (it shows or hides the Knowledge tabs and Memory stats).
- **8 stay unexposed on purpose:** `sendSessionEvent`, `getSessionStatus`, `waitForStatusChange`, `getLatestResponse`, `cancelSessionGroup`, `completeSessionGroup`, `upsertGraphNode`, `upsertGraphEdge`.

Separately, 11 operations are only partly used today (fallbacks, internal resync, or read through bootstrap). 7 of them get an explicit home: `getWorkerCount`, `getLogConfig`, `getSessionCreationPolicy`, `getCanvasLive`, `getModelsByProvider`, `getDefaultModel`, `listFeatureFlags`.

Beyond operations, the redesign also gives a home to capabilities that exist only as data or events today: schedules (display-only), the budget, working-folder and model events that render as generic grey lines, canvas refusals that fail silently, and question choices that render as text.
