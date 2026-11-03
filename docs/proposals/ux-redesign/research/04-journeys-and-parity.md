# 04 — Personas, journeys, surface parity and terminology

**Question this informs:** what must a redesigned PilotSwarm portal show, and in
what structure, so that every capability can be reached without confusion?
**Decision it feeds:** the portal's information architecture (top-level
destinations, where session actions live, how diagnostics and administration
are reached) and the redesign's acceptance criteria.

**Method and sample.** Desk research only, dated 2026-10-30, on branch `dev` at
`2a50ca25`. Sources: the user guide, quickstarts, architecture docs and
CHANGELOG; the live portal source (`packages/app/ui/react/src/web-app.js`,
`packages/app/ui/core/src/*`, `packages/app/web/src/*`); the TUI key handler
(`packages/app/tui/src/app.js`); and the MCP tool registrations
(`packages/app/mcp/src/tools/*.ts`). No users were interviewed and no
analytics were available. The personas below are therefore **proto-personas**
built from documented roles, scenarios and code paths. They are not observed
behaviour. Frequencies are inferred from how the docs present each scenario
(beginner, intermediate or advanced) and are marked as such. Each claim cites
`file:line` or a doc section. Where the docs and the code disagree, the code
counts as the evidence for current behaviour.

**Confidence key:** **H** means docs and code agree. **M** means one strong
source. **L** means inference that should be checked with users.

---

## 1. Who uses the portal

The product defines three roles: `user`, `admin` and `anonymous`
(`docs/user-guide/security-and-sharing.md:20-24`). Read access can also be
granted without write access (`security-and-sharing.md:45-49, 71-77`), and a
canvas link can reach someone who never signs in
(`docs/user-guide/portal.md:279-281`). An MCP host can act with the user's
identity (`docs/user-guide/mcp-local-setup.md:3-13`). These sources support
four personas.

### P1 — Agent operator (the "user" role; the core persona)

| | |
|---|---|
| **Situation** | A developer or SRE who runs agents on real work: investigations, repo changes, recurring reports. Works on a desktop browser, sometimes over SSH in the TUI, and checks in from a phone (`portal.md:584-587`, `docs/features/mobile-focus.md`). |
| **Goal** | Hand off multi-step or long-running work, steer it while it runs, and collect what it produced. |
| **Key behaviours** | Runs several sessions in parallel (`portal.md` Scenario 3). Leaves sessions waiting for hours or days (Scenario 8: "Come back tomorrow"). Works in repo clones (`docs/user-guide/workspaces.md:59-94`). Builds MoA dashboards to watch several sessions at once (`docs/user-guide/master-of-agents.md:8-12`). |
| **Top pains (evidence)** | The new-session flow asks for the model before the agent and can open up to four dialogs in a row (§2 J1). Files live in three different places (§2 J5). The Workspace tab is reached through the canvas button (`workspaces.md:184-187`). Diagnostics are hidden by default (`web-app.js:10700-10711`). The docs hedge on where controls are ("typically a checkbox toggle", `portal.md:226-228`; "paperclip or similar", `portal.md:337`). |
| **Success** | "I can see at a glance what each of my agents is doing, what it is waiting on, and what it made." |
| **Confidence** | H for the role and its capabilities. L for which pains rank highest. |

**Jobs-to-be-done** (inferred frequency):

1. *When I have a task, start an agent that suits it and give it the work*
   (daily, several times a day).
2. *While it runs, see progress and correct or stop it without losing the
   session* (daily). Stop and Steer arrived in 0.8.3 (`CHANGELOG.md:93-140`).
3. *When it is waiting (on a timer, on me, on its children or on a budget),
   know why and when it will resume* (daily, for long-haul users).
4. *Get the outputs (reports, edited files, pushed branches) and hand them
   on* (daily).
5. *Keep the session list under control: rename, pin, group, finish or delete*
   (weekly; Scenario 4, "12 sessions left from yesterday").
6. *Find out why a turn was slow or failed* (weekly; Scenario 6).

### P2 — Fleet admin / platform operator (the "admin" role)

| | |
|---|---|
| **Situation** | Runs a shared deployment: model providers and credentials, defaults, budgets, feature flags, agent packages, workers and system sessions (`docs/user-guide/keybindings.md:147-170`; `ui/core/src/selectors.js:4865-4883`). |
| **Goal** | Keep the fleet up, inside budget and safe, and unblock users. |
| **Key behaviours** | Rotates provider keys (`portal.md:568-574`). Sets cluster and system defaults and restarts system sessions (`keybindings.md:161-164`). Watches package adoption across workers (`docs/building-agent-packages.md:403-406`). Toggles flags such as `sessions.steering` (`packages/sdk/src/feature-flags.ts:17-21`). Can open any session, and each such access is recorded as break-glass (`security-and-sharing.md:140-147`). |
| **Top pains (evidence)** | Provider work is split between Settings/Admin Console (Model Providers) and a separate Budget mode (Providers, Cluster summary and Agents tabs; `web-app.js:13401`). The Admin Console is desktop-only (`web-app.js:10711-10719`). The audit log has no UI (§3). The same panel is called "Settings" for users and "Admin console" for admins (`web-app.js:10602-10614`). |
| **Success** | "I can answer who is spending what, why a session is held, and whether every worker runs the current package version, in one place." |
| **Frequency** | Weekly configuration, with on-demand incident work (L). |

### P3 — Collaborator / viewer of shared work

| | |
|---|---|
| **Situation** | A teammate given `shared_read` or `shared_write` visibility or a targeted grant (`security-and-sharing.md:45-77`), or anyone opening a canvas through an **Anyone with link** token, which needs no sign-in and is read-only (`portal.md:279-281`; `web-app.js:7863-7875`). |
| **Goal** | Read a result, follow a running session, sometimes contribute a message. |
| **Constraints** | Cannot manage, rename, share or delete (`security-and-sharing.md:79-80`). Cannot see the session's folders in the Workspace tab (`workspaces.md:224-227`). Their messages carry a "collaborator" label, and the agent defers to the owner (`security-and-sharing.md:151-159`). |
| **Top pains (evidence)** | A deep link the viewer cannot open fails with the same message whether the id is wrong or the session is not shared, by design (`portal.md:260-265`). Controls they cannot use stay visible, so the product depends on disabled-state tooltips to explain why (`web-app.js:6225-6238`). |
| **Frequency** | Occasional, link-driven (L). |

### P4 — Builder / package author (secondary portal persona)

| | |
|---|---|
| **Situation** | Writes agents, skills, worker tools and MCP integrations as packages (`docs/building-agent-packages.md:1-30`). Publishes from the CLI (`building-agent-packages.md:434-470`), from the portal (*Upload folder*, *Import & publish* and *Promote to shared*; `web-app.js:14931, 15201, 15355`) or through MCP (`push_agent_package`). |
| **Goal** | Ship a capability, confirm it is live on every worker, and fix it when a session misbehaves. |
| **Top pains (evidence)** | The UI says "Packages" (`selectors.js:4870`) where the API and CLI say "agent package" (`building-agent-packages.md:8-9`), even though a package may contain no agents (`building-agent-packages.md:24-27`). The TUI can only browse packages; changes go through `pilotswarm agents …` (`ui/core/src/commands.js:100-105`). |
| **Frequency** | Bursty, around releases (L). |

> **Out of scope for the portal but relevant to parity:** SDK app developers
> (`README.md:67-161`) and people driving PilotSwarm from Claude Code, VS Code
> or the Copilot CLI through MCP (`mcp-local-setup.md`). The MCP user is P1 or
> P2 working through another host.

---

## 2. Core journeys

Each journey lists **stages, then the current portal path, then friction**.
Severity uses the research scale: 4 blocks the task, 3 causes a major delay
or workaround, 2 is minor friction, 1 is cosmetic. The severities are expert
estimates (L) until usability testing confirms them.

### J1 — First run and choosing an agent (P1, P2)

1. **Get access.** Run `scripts/local-pilotswarm.sh up`, which starts dev
   sign-in with five test users (`docs/quickstart/local.md:277-289`), or
   sign in with Entra (`portal.md:15-17`).
2. **Make a provider usable.** `.model_providers.json` is only a catalog of
   provider types. A model becomes selectable only after a shared or personal
   provider instance exists (`local.md:234-238`). Until then, new-session
   creation is refused with "No provider can pay for a session yet — add one
   of your own, or ask an admin for a shared one."
   (`ui/core/src/controller.js:7573`).
3. **Start a session.** The single **＋** button is labelled "New session —
   choose model and agent" (`web-app.js:10624-10636`). It opens **Model →
   Reasoning effort (when the model supports it) → Context window (when the
   model supports it) → Agent** in sequence (`controller.js:7515, 7414, 7462,
   7352`).
4. **Send the first prompt** and watch the message receipts (`○` pending,
   `✓` queued, `✓✓` sent) and the session state badge (`portal.md:94-103`).

| Friction | Sev | Evidence |
|---|---|---|
| The model is chosen before the agent, the reverse of the user's intent (the task, then the agent, then optionally the model). Up to four modal steps appear before typing. | 3 | `controller.js:7352-7515` |
| The guide says the *agent* picker opens first ("Pick the default agent (or just hit Enter)"). The code opens the model picker first. | 2 | `portal.md:90-92` vs `web-app.js:10632-10636` |
| With no provider, the refusal sends users to the Admin Console, which does not exist on phones. | 3 | `controller.js:7573`; `web-app.js:10711-10719` |
| The starter image says "Click `New`… The point of the first run is to remove decisions" while the portal asks for model, reasoning effort and context before the agent. | 2 | `docs/quickstart/docker.md:109-118` |

### J2 — Chat and steer a session (P1)

Path: select the session, type in the composer, then **Enter** or **Send**.
While a turn runs, a red **■** stops it and **↪ Steer** sends guidance when
the `sessions.steering` flag is on. The flag is off by default and users
cannot override it (`feature-flags.ts:17-21`). Queued messages appear in a
strip with **↪ N**, **↑** select and **✕** delete (`portal.md:164-206,
636-642`). Tool calls collapse into one-line previews, and native tasks appear
as **Explore** or **Task** cards (`portal.md:27-38`).

| Friction | Sev | Evidence |
|---|---|---|
| A steer can end in eight outcomes (Pending, Delivered, Will run next, Carried and ran next, Carried then stopped, Carried and not run, Not delivered, plus a Retry notice). They are precise, but users must learn them. | 2 | `portal.md:180-188` |
| On a phone, Steer and Send share one button: tap to steer, hold for Steer now or Queue. This is a hidden gesture. | 2 | `portal.md:176-178` |
| Stop discards the turn's work, and the warning appears only in docs and tooltip text. | 2 | `portal.md:171`; `keybindings.md` (`Ctrl+X` row) |
| Steer is hidden entirely when the flag is off, so the same session gives different controls in different deployments. | 2 | `feature-flags.ts:17-21` |

### J3 — Long-running and durable tasks that suspend and resume (P1)

Path: ask for a wait or a schedule. The badge then reads, for example,
`waiting · 58s · "user requested wait"` (`portal.md:135-137`). The
**sequence** tab shows `wait_started` and `dehydrate`. With `cron` the session
re-arms itself. `ask_user` sets `input_required` (`portal.md:516-518`).

| Friction | Sev | Evidence |
|---|---|---|
| The guide lists eight states (`docs/user-guide/README.md:29-38`). The code also renders `budget_paused`, `cron_waiting` (shown as "waiting") and `awaiting_children`. "Waiting" therefore means a timer, a cron schedule, children or a budget, and users cannot tell which without reading the label text. | 3 | `selectors.js:246-249` |
| Nothing lists "what is scheduled and when it next fires" across sessions. Users open each session to read its badge. | 3 (L) | No such view in `web-app.js`. `getSessionStatus` and `listPausedSessions` exist in the API (`packages/sdk/api/src/protocol.js`). |
| Seeing *why* a session is waiting means switching to the sequence diagram, which is a diagnostic tool. | 2 | `portal.md:138-140` |

### J4 — Sub-agents and the spawn tree (P1)

Path: pick an agent that can spawn children, then prompt. Children nest in
the Sessions tree. The parent receives digests about every 30 s. Children go
`idle` until the parent calls `complete_agent`. `wait_for_agents` makes the
parent wait (`portal.md:425-482`).

| Friction | Sev | Evidence |
|---|---|---|
| Two delegation models look different in the UI. Sub-agents are **child sessions in the tree**. Native tasks are **cards inside the chat** (`portal.md:34-38`), behind the "Native Copilot tasks" flag (`feature-flags.ts:4-6`). Users get no explanation of the difference. | 3 | as cited |
| A parent's `stop_agent_turn` or `message_agent(deliver:"now")` appears in the child's transcript under the parent's name. Nothing shows the parent→child relationship as a whole tree. | 2 | `portal.md:203-206` |
| The troubleshooting advice for "the parent didn't notice its child" is to wait 30 s, then find `pendingChildDigest` in the sequence tab. | 3 | `portal.md:690-693` |
| Spawning is not offered as a user action on any surface, by design: MCP exposes sub-agent tools read-only (`mcp-local-setup.md:71-72`). The UI should say that delegation is the agent's decision. | 1 | as cited |

### J5 — Files, repos and the workspace (P1)

There are **three separate file surfaces**:

1. **Artifacts.** Attach with the paperclip or drag and drop, which inserts an
   `artifact://` reference. Outputs from `write_artifact` appear under
   Inspector → **files**, with preview, download, delete and a filter for
   this session or all sessions (`portal.md:335-356`). Clicking an artifact
   link opens the artifact reader (`master-of-agents.md:102-104`).
2. **Session folders (the Workspace tab).** These are the working folder,
   `home` and `shared`. The tab offers a tree, editor, find, upload, zip
   download, move, rename and delete, plus three-way conflict resolution
   (`workspaces.md:182-240`). Git history and checkout arrived in 0.8.2
   (`CHANGELOG.md` 0.8.2, "Git in the Workspace tab").
3. **Workspace settings.** **Manage session → General → Workspace**, with
   **Set…**, **Clear**, **Retry now** and **Files** (`web-app.js:7005-7022`;
   `workspaces.md:36-38`).

| Friction | Sev | Evidence |
|---|---|---|
| The Workspace tab sits inside the **canvas** side pane, so users open the canvas to see their files. | 3 | `workspaces.md:184-187`; `web-app.js:8660-8662` |
| "Files" means artifacts in the Inspector but the folder tree in Manage session → Files. Users get no model of artifact versus file. | 3 | as cited |
| The Workspace tab is empty until the first turn starts. Setting a workspace from outside before the first turn fails with `WORKSPACE_SESSION_NOT_STARTED`, and the new-session flow has no workspace step. | 3 | `workspaces.md:49-53, 229-232` |
| Only the owner sees the folders. Collaborators and admins see none, even on a session shared for writing. | 2 | `workspaces.md:224-227` |
| Push before you stop: idle clones are removed after 7 days, and the portal gives no warning. | 3 (L) | `workspaces.md:86-89` |
| The guide's **Linked items** view is hedged ("typically") and has no matching label in the live code. The TUI has it (`a`). | 2 | `portal.md:358-363`; `docs/user-guide/tui.md:261-264` |

### J6 — Canvas apps (P1, P3)

A session has up to five live HTML canvases. The agent draws, updates,
presents and reuses them (`docs/architecture/canvas.md:3-8, 256-262`). Apps
can be published to a deployment-wide catalog with `publish_canvas_app` and
`find_canvas_app` (`canvas.md:165-193`), and a canvas app can use the
session's files (`workspaces.md:242-250`). In the portal, the toolbar canvas
button shows three states: empty, loaded and unseen (`web-app.js:10655-10688`).
**Share canvas** offers Session access with *Hide page chrome*, Anyone with
link, and "Who can edit inside this app" (`portal.md:269-281`).

| Friction | Sev | Evidence |
|---|---|---|
| Canvas apps can be found and reused only by asking the agent. Portal browse affordances are designed but not shipped. | 3 | `canvas.md:229-231` |
| Five slots with previous and next arrows and a "Choose canvas" control is a hidden structure. A MoA canvas panel stays pinned to one slot even when the agent presents another. | 2 | `web-app.js` ("Previous canvas", "Next canvas", "Choose canvas"); `master-of-agents.md:80-81` |
| The canvas replaced the old session summary (`canvas.md:6-8`), but the guide still documents a **Summary / Chat** toggle (`portal.md:653`) and the TUI's `s` key (`keybindings.md:60`). Neither exists in the code (`tui/src/app.js` has no `s` handler outside the admin console). | 2 | as cited |
| Canvas sharing has three audiences in one dialog. Session sharing lives in Manage session → Access. The two follow different mental models. | 2 | `portal.md:251-281` |

### J7 — Sharing a session (P1 → P3)

Path: the **Manage session** (wrench) button opens two tabs, **General**
(name, model, workspace, regenerate context) and **Access** (visibility and
per-person grants; owner and admin only) (`web-app.js:6962-6963, 6989-7043`).
**Copy link** has its own toolbar button (`web-app.js:6255`). Sharing covers
the whole session tree (`security-and-sharing.md:82-92`). A link points to a
session but grants nothing (`security-and-sharing.md:122-132`).

| Friction | Sev | Evidence |
|---|---|---|
| The docs say there is a **Share** button that opens a "Share & settings" modal. The live UI has **Manage session** with an Access tab; "Share & settings" survives only in a code comment. | 2 | `portal.md:251-255, 649`; `web-app.js:6813` |
| Visibility names differ by surface: `private`, `shared_read` and `shared_write` in the docs, TUI and API, but "Private", "Shared · read" and "Shared · write", plus "Only me", "General access" and "Share per person", in the portal. | 2 | `security-and-sharing.md:45-49`; `web-app.js` labels |
| Sharing is all or nothing per tree, and sharing a group's session does not share the group. The rules are correct but appear only in docs. | 2 | `security-and-sharing.md:86-112` |
| MoA has no sharing or links, so users leave MoA to share. | 2 | `master-of-agents.md:19, 65-66` |

### J8 — MoA multi-session dashboards (P1)

The MoA view has up to five personal dashboards with up to 16 panels each.
Each panel holds a chat or a canvas, panels split and can be dragged,
**Zen** hides the chrome, and phones show one panel at a time with a minimap
and swipe navigation (`master-of-agents.md` throughout; `mobile-focus.md`).

| Friction | Sev | Evidence |
|---|---|---|
| MoA is a separate *mode* with its own controls (split, focus, zen, per-panel or shared composer, drag zones with Shift extend). It is powerful but carries about 150 lines of rules. | 2 | `master-of-agents.md:32-154` |
| The way into MoA is an icon "between Workspace and Budget", and "Back to MoA" appears only after zooming. | 2 | `master-of-agents.md:3-6, 97-100` |
| Two composer models (per panel or shared) are set in a global preference inside Dashboard options. | 1 | `master-of-agents.md:47-51` |
| Dashboards are private and cannot be shared. Teams cannot share a view of their sessions. | 2 (L) | `master-of-agents.md:19` |

### J9 — Bulk session management (P1, P2)

Path: owner filter, then rename and pin the sessions to keep. Enter
multi-select, click rows, then use the **Terminate** (trash) control, which
opens a "Session Lifecycle" modal with **Mark N Completed**, **Cancel N
Sessions** and **Hard Delete N Sessions** (`web-app.js:6259-6268,
13939-13959`). Groups ("folders") come from **Group (n)**. Sort by recently
used, recently updated or saved order (`portal.md:52-63`).

| Friction | Sev | Evidence |
|---|---|---|
| The same three actions have different names on each surface. Docs: Cancel, Done, Delete (`portal.md:304-310`). Portal: a Terminate button, then Mark Completed, Cancel Session, Delete Session, or Complete & Restart and Terminate & Restart for system sessions. TUI: `c`, `d` and `Shift+D`. MCP: `abort_session`, `complete_session` and `delete_session`. | 3 | as cited; `mcp/src/tools/sessions.ts`, `turn-control.ts` |
| The guide says "typically a checkbox toggle or a 'select mode' button", which shows the documentation itself is unsure where the control is. | 2 | `portal.md:226-228, 299` |
| "Group" in docs and toolbar, "folder" in tooltips ("Rename folder", `web-app.js:6235`) and in sort copy (`portal.md:57-63`). | 2 | as cited |
| Recency sorting keeps positions stable until the user presses Refresh session order. Correct, but surprising. | 1 | `portal.md:55-56` |

### J10 — Admin console: providers, budgets, flags and packages (P2, partly P1)

There are two top-level modes: **Settings/Admin console** (cog icon) and
**Budget** (coin icon) (`web-app.js:10689-10719, 10824-10828`).

- **Settings tree:** Model Providers (My Providers, plus Shared Providers for
  admins), Feature flags, Packages (each package as a child row), and Workers
  for admins (`selectors.js:4865-4883`).
- **Budget:** Providers, Cluster summary and Agents tabs (`web-app.js:13401`),
  with limits, allowances and holds (`web-app.js` labels "Limits",
  "Allowance", "Hold").
- **Package detail:** enable or disable, promote to shared, editors, upload
  folder, and import and publish from a URL (`web-app.js:14931-15355`).

| Friction | Sev | Evidence |
|---|---|---|
| Provider configuration (Admin → Model Providers) and provider spending and limits (Budget → Providers) are separate modes. The guide sends users to both in one scenario. | 3 | `portal.md:566-574` |
| The Admin Console is desktop-only, while Budget works on phones. The reason is layout, not policy. | 2 | `web-app.js:10711-10719, 10685-10688` |
| One panel, two names: "Settings" for users and "Admin console" for admins. The guide calls it "Admin / settings menu → Model Providers". | 2 | `web-app.js:10602-10617`; `portal.md:654` |
| Session defaults appear as three separate controls: My Session Default, Cluster Session Default and System Session Default, each with restart semantics (Complete, Terminate or Hard Delete & Restart). These are high-risk actions with terse labels. | 3 | `keybindings.md:161-164`; `web-app.js:15551` |
| Fact and knowledge-graph stores, namespaces and the embedder have no portal UI. They exist in the API and MCP. | 3 for P2 | §3 |
| The authorization audit trail ("who accessed my session") is promised to owners but has no UI and no MCP tool. | 3 | `security-and-sharing.md:144-147`; only `packages/sdk/src/management-client.ts:1213` |

### J11 — Troubleshooting: what did the agent do? (P1, P2)

Path: the **Diagnostics** toggle (desktop, off by default) shows the Inspector
plus Activity column. The Inspector has six tabs: `sequence`, `logs`,
`nodes`, `history`, `files` and `stats` (`ui/core/src/commands.js:10`). Stats
switch between session, fleet and users views (`portal.md:397-400`). The
history tab exports to an artifact ("Export as artifact"). On phones the
Diagnostics nav button cycles between inspector and activity
(`web-app.js:10786-10804`).

| Friction | Sev | Evidence |
|---|---|---|
| The diagnosis recipe is to "find the gap" in the sequence tab, then cross-check logs, then nodes. Users run the correlation by hand across three tabs. | 3 | `portal.md:402-410` |
| "Inspector" means the right-hand tab column in `portal.md:72`, but "the main conversation view" in `docker.md:231-233`. "nodes" is the tab id and "Node Map" the pane title. | 2 | `selectors.js:9378` |
| `files` (artifacts) is a diagnostics tab, yet producing a deliverable is a primary job (J5). | 3 | `commands.js:10` |
| Agent-tuning evidence (`debug_session`: events, metrics, retrieval and graph usage, orchestration stats and history in one bundle) exists only through MCP. | 2 | `mcp-local-setup.md:82-85` |
| The troubleshooting advice includes "hit your browser's reload" for stale data. | 2 | `portal.md:699-701` |

### J12 — Moving between portal and TUI (P1)

Both surfaces share one runtime and update within a poll cycle
(`portal.md:545-583`). They also share one controller and selector layer
(`packages/app/tui/src/app.js:3-4` imports `pilotswarm/ui-react` and
`pilotswarm/ui-core`). This keeps state names in line, so the redesign should
keep vocabulary in `ui-core` so that both surfaces benefit.

---

## 3. Feature parity: TUI vs portal vs MCP

Legend: **●** full, **◐** partial or read-only, **○** absent. "Portal" means
the live tree (`web/index.html:10` loads `src/main.jsx`, then
`ui-react/web-app.js`). The `web/src/components/*.tsx` tree, including
`SlashCommandMenu.tsx` and `HelpOverlay.tsx`, is not loaded and does not count.

| Capability | TUI | Portal | MCP | Notes and evidence |
|---|---|---|---|---|
| Create session (model → effort → context → agent) | ● `n`/`Shift+N` | ● ＋ | ● `create_session` (incl. workspace) | Only MCP can set the workspace at creation (`workspaces.md:49-53`) |
| Send, answer, queue | ● | ● | ● `send_message`, `send_and_wait`, `send_answer` | |
| Stop turn | ● `Ctrl+X` | ● ■ | ● `stop_turn` | |
| Steer (flagged) | ● `Ctrl+T` | ● ↪ | ● `steer_session_turn` | `CHANGELOG.md:96-110` |
| Cancel a queued message | ● `d` | ● ✕ | ● `cancel_pending_messages` | |
| Rename | ● `t` | ● Manage → General | ● `rename_session` | |
| Switch model | ● `Shift+M` (undocumented) | ● Manage → Switch model… | ● `switch_model` | `tui/src/app.js:730-732` |
| Regenerate context | ● `Shift+R` (undocumented) | ● Manage → Regenerate context… and Lifecycle modal | ● `regenerate_session` | Two portal entry points (`web-app.js:7032-7043, 13939-13946`) |
| Complete, cancel, delete | ● `d`/`c`/`Shift+D` | ● Terminate → Lifecycle | ● `complete_session`/`abort_session`/`delete_session` | Names differ per surface (J9) |
| Restart a system session | ● (admin `C`/`T`/`H`) | ● | ● `restart_system_session` | |
| Pin | ● `P` | ● | ○ | |
| Groups (private) | ● `Ctrl+G` | ● | ● `manage_session_group` | |
| Owner filter, Shared with me | ● `f` | ● | ◐ `list_sessions` filters | |
| Search sessions, sort modes | ○ | ● | ○ | `portal.md:40-63` |
| Multi-select bulk lifecycle | ◐ cancel only | ● complete, cancel, delete | ○ (one at a time) | `keybindings.md:47` |
| Visibility, targeted shares | ● `v`, `Shift+S` | ● Manage → Access | ● `set_session_visibility`, `grant_`/`revoke_`/`list_session_shares` | |
| Copy deep link | ○ | ● | ○ | |
| Authorization audit ("who accessed") | ○ | ○ | ○ | API only (`management-client.ts:1213`); promised by `security-and-sharing.md:144-147` |
| Sub-agent tree view | ● expand `+`/`-` | ● nested rows | ◐ `get_agent_tree`, `list_child_outcomes`, `get_session_tree_stats` | Spawning is agent-only everywhere |
| Native task cards (Explore, Task) | ◐ | ● | ○ | `portal.md:34-38` |
| Attach or upload artifact | ● `Ctrl+A`, files `u` | ● paperclip and drag | ● `upload_artifact` | |
| Artifact list, preview, download, delete | ● (`o` opens in the OS) | ● | ● `list_`/`get_`/`delete_artifact`, `copy_artifact`, `pin_artifact` | Copy and pin artifact are MCP-only (L: not found in portal labels) |
| Linked-item picker | ● `a` | ○ (doc says "typically") | ○ | `tui.md:261-264`; `portal.md:358-363` |
| Set, clear or retry workspace | ● `Shift+W`/`Shift+Y` (undocumented) | ● Manage → Workspace | ● `set_`/`get_`/`retry_session_workspace` | `tui/src/app.js:986-992` |
| Workspace file browser and editor, git | ○ | ● | ○ | `workspaces.md:182-240` |
| Canvas view, slots, unseen badge | ○ | ● | ○ | No canvas tools in `mcp/src/tools` |
| Canvas sharing (session, public link, KV edit access) | ○ | ● | ○ | `web-app.js:7863-8010` |
| Canvas app catalog browse | ○ | ○ | ○ | Agent-only (`canvas.md:229-231`) |
| MoA dashboards | ○ | ● | ○ | `master-of-agents.md:3-6` |
| Mobile layouts, Zen | n/a | ● | n/a | `mobile-focus.md` |
| Inspector: sequence, logs, nodes, history, stats | ● | ● (Diagnostics toggle, desktop) | ◐ `get_execution_history`, `get_session_events`, `get_session_metrics`, `get_fleet_overview`, `debug_session` | MCP has no node map or logs |
| Export execution history | ● history `a`, format `f` (undocumented) | ● Export as artifact | ● `export_execution_history` | |
| Stats: session, fleet, users | ● | ● | ◐ `get_fleet_overview` | |
| Theme picker | ● `Shift+T` (undocumented) | ● | n/a | |
| Help overlay | ● `?` (undocumented in guides) | ○ | ● `get_capabilities` | No in-app shortcut or help reference in the portal |
| My providers (add, update key, delete) | ● | ● | ● `manage_provider` | |
| Shared providers, system-agent overrides | ● (admin) | ● (admin) | ● | |
| Session defaults (my, cluster, system) | ● `u`/`l`/`s` | ● | ● `set_provider_default`, `set_model_default`, `set_system_model_default` | |
| Budgets: limits, allowances, holds, usage | ○ | ● Budget mode | ● `set_provider_limit`, `set_provider_allowance`, `provider_hold`, `get_provider_usage*` | Parity with HTTP and MCP is pinned by test (`docs/proposals/providers-and-budgets-surface.md:7-13`); the TUI is not part of it |
| Budget-paused sessions list | ○ | ◐ (a status label) | ● `list_paused_sessions` | `selectors.js:246` |
| Feature flags (mine, cluster, per user, audit) | ○ | ● Settings → Feature flags | ● 12 tools (`packages/sdk/src/feature-tools.ts:5-16`) | In MCP web mode admin feature tools are off (`mcp/src/tools/features.ts:15`) |
| Packages: list and browse | ◐ Admin → `a` | ● | ● | |
| Packages: upload, import, enable, scope, pin version, editors, delete | ○ (CLI `pilotswarm agents …`) | ● | ● 12 tools | `building-agent-packages.md:434-470` |
| Workers | ● (admin `w`) | ● (admin) | ● `list_workers` | |
| Facts store, knowledge graph, embedder | ○ | ○ | ● 20 tools | `mcp/src/tools/facts*.ts`, `graph.ts` |
| Session forking | ○ | ○ | ○ | Approved proposal, not shipped (`docs/README.md:71`; no `fork` op in `protocol.js`) |
| Send a custom session event | ○ | ○ | ● `send_session_event` | |

**What the matrix shows (H):**

1. **The portal is the most complete user surface**, but whole domains stay
   API- or MCP-only: knowledge (facts and graph), audit, `debug_session`,
   artifact copy and pin, paused-session lists and custom events. The
   redesign must either add a home for each one or say plainly that it is
   absent.
2. **The TUI has keys no guide documents:** `Shift+M`, `Shift+R`, `Shift+W`,
   `Shift+Y`, `Shift+T`, `?`, `{`/`}`, files `u`/`a` and history `f`/`a`
   (`tui/src/app.js:622-625, 730-732, 768-789, 845-852, 961, 981-992`).
   `keybindings.md` documents one that does not exist (`s`, line 60), and
   `tui.md:579` says `Shift+A` → `e` updates a key where `tui.md:485-486`
   says `Shift+U`.
3. **Portal-only capabilities are the visual ones:** canvas, MoA, the
   Workspace editor, mobile and Budget. These are also where most friction
   sits (J5, J6, J8, J10).

---

## 4. Domain glossary as users see it

| Term | What users should understand | Where it is inconsistent |
|---|---|---|
| **Session** | One durable agent conversation with a state badge (`README.md:27-38`). | MCP and API also call it an "orchestration" or "instance" in diagnostics. "Session" also names the main-view button ("Sessions — session list, chat and panels", `web-app.js:10726-10730`). |
| **Agent** | The persona or workflow a session runs: generic, named (`namespace:agent`) or system (`docs/architecture/session-creation-policy.md:58-75`). | Packages can now hold no agents (`building-agent-packages.md:24`), yet the API, CLI and MCP still say "agent package" and `pilotswarm agents push`. The UI says "Packages". "Master of **Agents**" contains sessions and canvases, not agents. |
| **Sub-agent / child session** | A session created by a parent through `spawn_agent`, nested in the tree, sharing the root's access (`security-and-sharing.md:82-92`). | The docs use "sub-agent", "child" and "children". Code uses `subAgents` and "child update digest". |
| **Native task (Explore, Task)** | Delegation inside one session, shown as a card (`portal.md:34-38`). | It collides with "task" in the general sense ("long-running task"), with `spawn_agent({ task })` and with the **Task** card label. Users get no explanation of how it differs from a sub-agent. |
| **System session / system agent** | Always-on framework agents (Sweeper, Resource Manager) owned by the system (`security-and-sharing.md:38-39, 134-138`). | Also called "service sessions (⚗ machinery)" in code comments (`web-app.js:6967`). |
| **State: waiting** | The session is suspended and uses no resources. | It covers a timer, a cron schedule, children (`awaiting_children`) and a budget hold (`budget_paused`), and only the first is in the user guide (`selectors.js:246-249`). The docker guide also mentions "compacting" (`docker.md:227`). |
| **idle / completed / cancelled / terminated** | The session is resting or closed. | The user's verbs vary: "Done" / "Mark Completed" / `complete_session`; "Cancel" / "Terminate" / `abort_session` (J9). |
| **Stop / Steer / Cancel** | Stop ends the current turn. Steer adds guidance to it. Cancel ends the whole session. | "Cancel" also means deleting a queued message ("Cancel selected pending prompt", `web-app.js:10346`) and the MCP tool `cancel_pending_messages`. |
| **Message receipts ○ ✓ ✓✓** | Pending, then queued, then sent. | Consistent across surfaces (H). |
| **Artifact** | A durable file attached to a session, referenced as `artifact://` (`portal.md:339`). | It appears in the "files" tab and is called "file" in the UI. |
| **Workspace** | The session's folders: the working folder plus up to four extra folders (`workspaces.md:14-24`). | The word is overloaded at least five ways: (1) the session's folders, (2) the main portal mode ("the normal workspace", `master-of-agents.md:37`, and the Workspace button), (3) the TUI main layout (`tui.md:30`), (4) the whole deployment ("everyone signed in to this workspace", `web-app.js:7049`), and (5) the canvas, called "a session's standing visual workspace" (`canvas.md:3`). |
| **Canvas / canvas slot / canvas app** | Up to five live HTML views per session. An "app" is a canvas with a manifest that can be reused or published (`canvas.md:3-8, 195-212`). | Canvas also hosts the Workspace tab (`web-app.js:8660-8662`). |
| **Group / folder** | Private organization of sessions, like mail folders (`security-and-sharing.md:94-112`). | It is "Group" in docs and toolbar but "Rename folder" in the tooltip (`web-app.js:6235`) and "Folders" in sort copy. It also collides with "folder" in the workspace sense. |
| **Visibility / share / grant / link** | Visibility applies to everyone. A grant is per person. A link is only a locator (`security-and-sharing.md:41-77, 122-132`). | `shared_read` versus "Shared · read"; the "General access" and "Share per person" labels; Copy link is separate from sharing. |
| **MoA (Master of Agents)** | Personal tiled dashboards of chats and canvases (`master-of-agents.md:3-12`). | The jargon acronym also appears in UI copy ("Back to MoA"). The docs call it a "workspace" too (`portal.md:20`). |
| **Inspector / Activity / Diagnostics** | The Inspector holds six tabs, Activity is the raw event stream, and Diagnostics is the desktop toggle that shows both (`web-app.js:10700-10711`). | `docker.md:231-233` calls the Inspector "the main conversation view". The tab `nodes` is titled "Node Map". |
| **Provider / budget / limit / allowance / hold** | A provider is a named credential. A limit is a token cap per period. An allowance is a user's percentage share. A hold pauses spending (`providers-and-budgets-surface.md:20-27`). | The surface contract bans "pool", "payer", "grant" and "quota" (line 27). The portal guide still uses "Providers & Budgets" (`portal.md:573`) where the button says "Budget". |
| **Settings / Admin Console** | One panel. | Its name depends on the user's role (`web-app.js:10602-10617`). |
| **Package** | Agents, skills, worker tools and MCP servers published as a unit (`building-agent-packages.md:14-21`). | See *Agent* above. |
| **Regenerate context** | Archive and distill the transcript, then rebuild the context; the session survives (`web-app.js:7035`). | It sits in both Manage session and the Lifecycle modal next to destructive actions. |
| **Dehydrate / rehydrate** | Runtime internals shown on purpose in sequence and docs (`README.md:55-60`). | Fine for P2. P1 needs "sleeping, no compute" in plain words. |

---

## 5. Prioritised UX principles and requirements

Ordered by user impact × frequency, with confidence noted. Each requirement
names the evidence it answers and a measurable signal for usability testing.

### Fix-now (must hold in the first redesign cut)

1. **One home per object, one name per concept (H).** Choose one term each
   for *workspace* (the session's folders only), *group* (not folder),
   *package* and the lifecycle verbs (Complete, Cancel, Delete). Use the
   same terms in the portal, TUI, MCP descriptions and docs. Put shared
   vocabulary in `ui-core` so both UIs inherit it.
   *Evidence:* §4 and J9. *Signal:* zero unprompted "what's the difference
   between X and Y" questions in testing.
2. **Start from intent, not configuration (H).** The new-session flow asks
   for the agent or the task first. Model, reasoning and context are optional
   and pre-filled from the user's default. The workspace (a repo or folder)
   can be chosen at creation. Show the no-provider state as an inline,
   actionable empty state that works on phones.
   *Evidence:* J1 and J5 (`WORKSPACE_SESSION_NOT_STARTED`).
   *Signal:* time to first sent prompt; number of dialogs.
3. **Explain every waiting state in place (H).** A session row and header
   say *what* the session waits on (timer, schedule, children, input, budget
   hold or workspace unavailable), *until when*, and *what the user can do*
   (answer, raise the limit, retry now). Users should not need the sequence
   tab to learn why.
   *Evidence:* J3 and `selectors.js:246-249`.
   *Signal:* first-click success on "why is this session not doing anything?".
4. **Treat deliverables as first-class (H).** Artifacts and workspace files
   get one top-level **Files** destination per session, with an explicit
   split between artifacts and folders. Do not hide them inside Diagnostics
   or behind the canvas toggle. Warn about unpushed clones before they expire.
   *Evidence:* J5 and J11.
5. **Keep session actions in one place on every surface (H).** Rename,
   model, workspace, sharing, copy link, regenerate and lifecycle sit in one
   consistent session menu, available in the main view, MoA panels and on
   phones. Destructive actions are separated from "change" actions and say
   what they cascade to.
   *Evidence:* J7, J9, `master-of-agents.md:65-66` and `web-app.js:13939-13959`.
6. **Show controls a user cannot use as disabled, with the reason (H).**
   Extend the existing "a disabled control has to say WHY" rule
   (`web-app.js:6225-6229`) to read-only viewers, flag-gated Steer and
   desktop-only admin features.

### Test-next (validate with 5 P1 and 3 P2 participants)

7. **Separate Configure from Spend (M).** Merge provider configuration and
   Budget into one Providers area with Keys, Defaults, Limits and Usage, or
   link the two in both directions. Use one name for the admin area whatever
   the role, and gate sections by role inside it.
   *Evidence:* J10.
8. **Organize diagnostics around a question (M).** Lead with "Why was this
   slow?", "Why did this fail?" and "Where is it running?", with each view
   correlating sequence, logs and nodes. Keep the raw six tabs for P2.
   *Evidence:* J11 and `portal.md:402-410`.
9. **Make the agent tree visible and explained (M).** Show sub-agents and
   native tasks in one tree or timeline with a legend ("child session"
   versus "in-session task"), digest timing, and the parent's control
   actions.
   *Evidence:* J4.
10. **Bring MoA into the main navigation (M).** Treat dashboards as saved
    views of sessions rather than a separate mode, so sharing and session
    actions are not lost when entering them. Consider shareable dashboards
    for P3.
    *Evidence:* J8.
11. **Make canvases discoverable (M).** Add a canvas gallery per session (the
    five slots with names) and an app catalog browser.
    *Evidence:* J6 and `canvas.md:229-231`.

### Watch and plan

12. **Decide on parity explicitly (H).** For each capability in §3 marked ○
    on the portal (knowledge store, audit trail, paused-session queue,
    artifact pin and copy, `debug_session` bundle), either add a home or
    record a deliberate exclusion. Add audit for owners first, because the
    docs already promise it.
13. **Make keyboard use discoverable on the web (M).** Add a portal help
    overlay listing the shortcuts that work. The TUI's `?` exists; the
    portal has none, although its guide claims TUI keys work
    (`portal.md:656-657`).
14. **Generate the docs from the UI, or test them against it (H).** At least
    nine guide statements no longer match the code: Share & settings, the
    Summary/Chat toggle, Linked items, the order of the agent picker, the `s`
    key, the Shift+A→e versus Shift+U contradiction, the Inspector meaning in
    `docker.md`, "slash commands" (`docs/README.md:18`; they exist only in the
    unloaded TSX tree), and hedges like "typically" and "depending on your
    version". A redesign that changes the IA must ship with
    screenshot-checked guides.
15. **Follow the phone rules (H).** The phone keeps parity for reading,
    steering, budget and files. Desktop-only features should be the
    exception, and each must be labelled as such.
    *Evidence:* `mobile-focus.md`; `web-app.js:10711-10719`.
16. **Clean up the legacy UI code (M).** Retire the unused
    `packages/app/web/src/components/*.tsx` / `App.tsx` tree. It is not loaded
    (`web/index.html:10`) and looks like a second implementation, which
    confuses future UI work.

---

## Open questions and next research

- **Validate the personas.** Interview 5–8 P1 users and 3 P2 operators.
  Screen for running at least 3 concurrent sessions per week or holding the
  admin role.
- **Usability test the redesign tasks**, phrased as goals: "start an agent
  to fix a typo in repo X", "find out why your report did not arrive this
  morning", "give a teammate read access to this investigation", "find the
  file the agent produced" and "stop the spending on provider Y".
- **Gather analytics if available:** how often Diagnostics, MoA, Budget and
  the Workspace tab are opened, and drop-off in the new-session modal chain.
  `getCurrentUserProfile` already stores "recently used" data
  (`portal.md:53-59`), which suggests some usage signals can be collected.
- **Limits of this study:** it is code- and docs-based, written by one
  researcher with no observed behaviour. The severity ratings are
  hypotheses.
