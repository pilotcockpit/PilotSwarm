# 06 — Usability, accessibility and UX-copy audit

**Scope:** PilotSwarm browser portal, `dev` branch, v0.8.7, at `http://localhost:3001`
(auth disabled, no LLM credentials, 4 local workers). **Date:** 2026-10-30.
**Method:** two passes. The static pass read source, CSS and the user guides. The live pass drove the
running app with Playwright 1.62 (Chromium) and ran scripted checks:

- the accessibility tree (`ariaSnapshot`);
- a 45-stop Tab walk that recorded computed focus styles;
- an in-page WCAG luminance scan of all visible text, run under all 20 themes;
- non-text contrast of control boundaries;
- target sizes at 1440 and 390 px;
- reflow at 320 px, and 720×450 as the equivalent of 200 % zoom;
- `prefers-reduced-motion`.

I also walked real flows end to end. I created a session and sent a prompt (it failed, as expected
without credentials), then renamed, terminated and deleted it. Other flows covered were MoA build-out,
budget, admin, add provider, theme picker, search, and the keyboard shortcuts.
**Standards:** Nielsen's 10 heuristics with the 0–4 severity scale; WCAG 2.2 AA; the craft-ux live-audit
quick-reject list; ux-copy patterns (what happened, why, how to fix).

**Evidence:** screenshots live in `research/screens/`. `d*`/`m01` come from the earlier capture
(`capture-log.txt`); the files this audit added are listed in the appendix. `file:line` citations are
relative to `packages/app/` unless they say otherwise. Siblings `02-portal-ui-inventory.md`,
`04-journeys-and-parity.md` (glossary §4) and `05-visual-critique.md` cover inventory, journeys and visual
direction; this document does not repeat them and links to them where it builds on them.

**What I could not verify live:**

- A real streaming turn: no credentials, so I could not test steer/stop, tool-call cards, sub-agent
  trees, canvas content or native task cards while running.
- The Workspace files tab: it is gated by `portalWorkspaceFiles`, and I did not change feature flags.
- A real screen reader: the findings come from the accessibility tree, not VoiceOver/NVDA output.

These items are marked *static* or *unverified* where they appear.

**Severity keys.**

- **Nielsen:** 0 none · 1 cosmetic · 2 minor · 3 major · 4 catastrophe.
- **WCAG:** 🔴 blocks a user group · 🟡 degrades · 🟢 polish.
- Rendered conditions appear in brackets, e.g. `[390px]`.

---

## Executive summary

The portal is powerful and unusually well instrumented, and it is very hard to operate without already
knowing it. Five problems dominate.

1. **A failed turn deletes the evidence.** The provider error shows in chat as a `WARNING` with a raw
   worker exception (env var names, `runTurnV4`, `GenericFailure`). After the retries run out, the chat
   reverts to the splash and the user's own prompt disappears from the transcript. The session shows
   **Idle**, and only the Activity log keeps truncated JSON. There is no retry, no "what to do", and no
   lasting failed state. *(flow-first-prompt-3s → flow-error-session-settled)*
2. **There are four dialog systems, and the main one is not a dialog to assistive tech.** The shared
   ModalLayer (new session, filter, theme, terminate, confirm) has no `role="dialog"` or `aria-modal`,
   and focus never moves into it. Manage session (the share overlay) also ignores Escape and lets Tab
   walk into the obscured page behind it. MoA, budget and admin dialogs, by contrast, are correct.
3. **Status disagrees across surfaces.** Within seconds the same session read **Error** in the main
   view, **Idle** in its MoA panel, "(unknown)" and then "(idle)" in the child list, and "Showing linked
   sess…" in the header. Timestamps mix local time (Activity `00:37:39`) with UTC (Event History
   `07:38:26`).
4. **The UI is icon-only and the keyboard model cannot be discovered.** There are 12 or more icon-only
   buttons in the shell and the inspector. About 20 single-letter global shortcuts exist (`n`, `r`, `c`,
   `d`, `D`, `[`, `]`…), but the portal has no help, no command palette and no slash commands. The
   `?`/Keybindings modal exists only in the TUI (`tui/src/app.js:962`), and `keybindings.md` documents
   the TUI.
5. **Mobile and zoom are second-class.** At 390 px:
   - the Admin Console cannot be reached;
   - session rows are 22 px tall and overflow (404 px wide in a 390 px viewport);
   - chrome takes about 300 of 844 px before content starts.

   At 200 % zoom the chat viewport is about 60 px tall.

Plenty is done well and should be kept. Icon buttons have accessible names (0 unnamed controls found).
Destructive actions are confirmed. Default-theme text contrast passes almost everywhere. The Feature
flags page is a model of plain-language settings copy. The MoA and budget dialogs are properly modal.
Reduced-motion is honored, and 320 px reflow has no horizontal scroll.

---

## 1. Nielsen heuristic findings by surface

Heuristics: **H1** visibility of system status · **H2** match with the real world · **H3** user control
and freedom · **H4** consistency and standards · **H5** error prevention · **H6** recognition over recall ·
**H7** flexibility and efficiency · **H8** aesthetic and minimalist design · **H9** error recovery ·
**H10** help and documentation.

### 1.1 Shell, header and global navigation

| # | Finding | H | Sev | Evidence | Fix direction |
|---|---|---|---|---|---|
| S1 | Each header control is a bare icon: New, Filter, Back, Forward, Canvas, Diagnostics, Sessions, MoA, Budget, Admin and Theme. Meaning is available only on hover tooltip or to screen readers. "Filter" sits next to "New", but it filters by *owner*, not by text. | H6, H4 | 3 | d01, a11y-focus-tab4-header | Use labeled primary navigation for the 4 destinations (Sessions, Boards, Usage, Settings) and an icon+label for New session. Move canvas and diagnostics toggles into the session view they control. |
| S2 | The brand block reads "PILOTSWARM / Auth disabled". A security state appears as a subtitle, and the header status slot shows unrelated transient text ("Select a model for…", "Showing linked sess…", "Deleted 06760567"), truncated, in 10 px type. | H1, H8 | 2 | d02, flow-first-prompt-3s, after-delete | Use one toast/announcement region for transient events. Move auth mode into the account menu, plus an environment badge if needed. |
| S3 | The document title is always "PilotSwarm" whatever the view or session. | H1 | 1 | a1 run | `"<session title> · PilotSwarm"`, `"Usage · PilotSwarm"`. |
| S4 | Back/Forward buttons in the app header duplicate the browser's buttons and use Option+−/Option++. | H4 | 2 | aria snapshot | Rely on the URL and history (deep links per view) and drop the custom pair. |
| S5 | The connection state is a tiny "Connected" pill on desktop, but a full-width dismissible "Connected" banner on mobile that pushes content down. | H8, H4 | 2 | d01 vs m01, mob-390-home | Show connectivity only when degraded ("Reconnecting…", "Offline — changes will sync"). |

### 1.2 Sessions list and tree

| # | Finding | H | Sev | Evidence | Fix direction |
|---|---|---|---|---|---|
| L1 | A new session is named by its GUID prefix ("06760567"), and nothing prompts for a name. Rows pack id · age · model:effort · `—` with no column meaning. "—" means "no status/last message" but reads like a minus/collapse control. | H2, H6 | 3 | flow-first-prompt-45s, mob-390-home | Auto-title from the first prompt, editable inline. Use a two-line row: title on top, then status chip · agent · relative time. Render an empty value as nothing, not "—". |
| L2 | The row toolbar (Pin, Group, Manage, Copy link, Terminate) changes meaning and enabled state with the selected row. For a system session the same slots become "System sessions are managed by administrators" (disabled-looking but focusable) and "Restart this system session". | H4, H6 | 3 | d01 vs after-delete aria | Use a per-row overflow menu (⋯) plus a context menu, keeping actions next to the row they affect. Hide actions that do not apply instead of keeping them as focusable explanation buttons. |
| L3 | A second, separate list at the bottom of the pane ("▸ — 1m ago (idle)") is unlabeled. It shows the child/linked session of the selection; its status changed from "(running)" to "(unknown)" to "(idle)" during one failure. | H1, H8 | 3 | d01, flow-first-prompt-3s, flow-error-session-settled | Show sub-agents nested in the tree, with a "Sub-agents (n)" disclosure and real status chips. |
| L4 | The sort modes are three bare icons (clock, pulse, bookmark) with a separate "Refresh session order" button. Choosing a mode "applies once", so the order then drifts from the selected mode without telling the user. | H1, H6 | 2 | portal.md:58-73, d01 | Use a labeled sort menu ("Sort: Recently used ▾"). Re-sort live, or show a "Reorder (3 changed)" affordance. |
| L5 | Searching for a term with no matches shows `No sessions matched "zzzz-nonexistent". 0 matches ×` — which is good. The filter dialog, though, labels the current user "Me (Unknown User)" when auth is disabled (`ui/core/src/selectors.js:9227`). | H2 | 2 | search-no-results, d03 | Say "Me (local, sign-in off)". Add "Clear filters" to the empty result. |
| L6 | Owner filter, text search and sort are three controls in three places: the header Filter icon, the bottom search field and the bottom icon row. | H4, H7 | 2 | d01, d03 | Put one filter bar at the top of the list: search, owner chips and sort together. |

### 1.3 Creating a session

| # | Finding | H | Sev | Evidence | Fix direction |
|---|---|---|---|---|---|
| C1 | Creation takes three modals in a row: model, then reasoning effort, then agent. **Every step's primary button says "Create Session"**, but only the last one creates. Users are likely to think the first click created the session (inferred). | H4, H1 | 3 | d02, flow-new-session-step2, flow-new-session-step3 | Use one sheet: agent first (the user's intent), with model and effort as defaulted fields under "Advanced". Single CTA "Start session". |
| C2 | The order is the reverse of user intent: the user picks a provider/model before choosing *what* the session is for. Agent details say "Model: anthropic-wif:claude-opus-5" as if fixed. | H2 | 3 | flow-new-session-step3 | Agent → (optional) model override. Show "Uses Claude Opus 5 · change". |
| C3 | Model rows read `· claude-opus-5 [high]`, where `[high]` is the *cost tier*. The next step offers *reasoning effort* "high", and details show "Default reasoning: medium". The same word carries two meanings in two adjacent steps. | H2, H4 | 3 | d02, flow-new-session-step2 | Show cost as "$$$" or "Higher cost" and effort as "Thinking: Medium (default)". Never put a bare bracketed level after a name. |
| C4 | Provider ids show twice ("anthropic-wif (anthropic-wif)"), and "wif" is unexplained jargon. The description "No API key: the worker authenticates with its own workload identity" is accurate but irrelevant to an operator at that moment. | H2, H8 | 2 | d02 | Show the provider's display name ("Anthropic"), and put the auth method in admin only. |
| C5 | Nothing warns that the chosen provider cannot work: the worker is missing credentials, which the system knows (the error names the missing env vars). The picker happily offers four models, none of which can run. | H5 | 4 | d02 + flow-first-prompt-3s | Run a provider health preflight and mark unusable models ("Not configured — ask an admin"). Block or warn before creation. |

### 1.4 Chat, composer and the failure experience

| # | Finding | H | Sev | Evidence | Fix direction |
|---|---|---|---|---|---|
| E1 | **The prompt and the error disappear after retries.** At t+3 s chat shows `WARNING … Activity 'runTurnV4' JS execution failed: GenericFailure, Error: Provider "anthropic-wif" authenticates with workload identity, but the worker is missing ANTHROPIC_FEDERATION_RULE_ID, … (retry 1/3 in 15s)`, with the user's message stuck in "queued prompts: 1 queued". After the retries the transcript shows only the splash, the prompt is gone, the status reads **Idle**, and the sequence diagram says "No events yet". | H1, H9 | 4 | flow-first-prompt-3s, -45s, flow-error-session-settled, flow-error-session-diagnostics | Make failures durable transcript items: the user bubble stays and is marked "Not sent — model unavailable", next to an error card (copy in §3.3) with **Retry**, **Switch model** and **Copy details**. The session status should become "Needs attention", not Idle. |
| E2 | Raw worker internals reach end users: activity names, error classes, env var names and the retry schedule. The severity label is "WARNING" for what is, to the user, a hard failure. | H9, H2 | 4 | flow-first-prompt-45s | Write a plain-language message with the technical detail behind a disclosure, which admins see expanded. Map severity to user impact. |
| E3 | The splash ("Start interacting with this session to replace the splash screen.", `ui/core/src/history.js:1768`) stays after the user *has* interacted, and it appears in every new session, including in MoA panels. The ASCII logo is about 200 px tall in a work surface. | H8, H1 | 2 | flow-first-prompt-3s, moa-one-panel | Show an empty-state with 3 starter prompts and the agent's purpose. Never re-show the splash once a message exists. |
| E4 | The composer placeholder changes to "Type a message and press Enter to queue it behind the pending batch" (`web-app.js:9978`). "Pending batch" is internal, and the Send glyph changes from `❯` to `+` without a label change visible to sighted users. | H2, H1 | 2 | flow-first-prompt-3s | Use "Message (will send after the current reply)" and a visible "Queued · 1" chip with Cancel. |
| E5 | The label "YOU" sits on the left of the composer like a terminal prompt. Receipts ○ ✓ ✓✓ are consistent (good), but only the docs explain them. | H6, H10 | 1 | d01 | Give receipt glyphs a tooltip and accessible text ("Queued", "Delivered"). |
| E6 | There are no slash commands or command palette. Typing `/` does nothing (d10). Session actions (rename, switch model, stop, share) live only in icon toolbars or single-key shortcuts. | H7 | 3 | d10-slash-menu | Add a ⌘K command palette and `/` commands in the composer (`/model`, `/rename`, `/stop`, `/share`, `/canvas`). |

### 1.5 Diagnostics / Inspector / Activity

| # | Finding | H | Sev | Evidence | Fix direction |
|---|---|---|---|---|---|
| D1 | The six inspector tabs are icon-only (Sequence, Logs, Node Map, "Duroxide Event History", Files, Stats). The Files tab adds a second row of six more icon-only actions. The selected tab state is not exposed: these are plain buttons with no `aria-selected` or `aria-pressed`. | H6, H4 | 3 | d05, inspector-files-tab | Use a labeled tablist (`role=tab`, `aria-selected`) with text labels, and keep icons optional. |
| D2 | Copy is full of internals: "STATS v1.0.82 · h17 · 7.7 KB · q0 · kv0", "Activity [current session v8]", "session.affinity_released", "Duroxide Event History", "OrchestrationStarted / ActivityScheduled". This is fine for P2 admins and opaque for P1 operators. | H2 | 2 | d05, inspector-duroxide-history | Use two layers. "Timeline" is human-readable ("Turn failed: model not configured"). "Engine trace" is opt-in and holds today's views. |
| D3 | Activity lines truncate the one useful field ("Error: Provider \"anthrop..."), with no expand. | H9 | 3 | flow-error-session-diagnostics | Expand per entry; copy JSON; link the entry to the chat turn. |
| D4 | Timestamps are inconsistent: Activity uses local `[00:37:39]`, Event History uses UTC `07:38:26.483`, and Budget says "TODAY (UTC)". | H4 | 2 | inspector-duroxide-history | One time zone everywhere (local, with UTC on hover), and relative time in lists. |
| D5 | Empty states are truncated with an ellipsis: "No exported files f… s… Agents must write/export art…" and "No events yet - interact with this s…". | H8 | 2 | inspector-files-tab, d10 | Wrap empty-state copy; never truncate instructions. |

### 1.6 Canvas and Workspace pane

| # | Finding | H | Sev | Evidence | Fix direction |
|---|---|---|---|---|---|
| V1 | The canvas empty state ("Nothing on the canvas yet. Ask the agent to draw — a dashboard, a chart, a diagram…") is good copy, but the pane header is an unlabeled icon plus two unlabeled controls ("Zen mode", "Full screen canvas"). "Zen" is jargon. | H2, H6 | 1 | d04 | Use "Focus mode" or "Hide chat". Title the pane "Canvas". |
| V2 | *Static:* workspace row actions (new file, upload, download, rename, delete) are `display:none` until hover or focus-within, and are 20×20 px (`web/src/index.css:10333-10349`). They are invisible on touch and fail 2.5.8. Row state (unsaved draft, agent editing, git status) is carried by colored dots with `title` only (`ui/react/src/workspace-pane.js:2231-2239`). | H6 | 3 | static | Keep the actions in an always-visible ⋯ menu. Give state badges text or `aria-label`, and a legend. |
| V3 | The canvas and Workspace tab share one pane, and the Workspace tab exists only when a feature flag is on, so the UI shape changes per deployment without explanation. | H4 | 2 | `web-app.js:8662-8669` | Make Files a first-class session tab and show disabled tabs with an explanation. |

### 1.7 Master of Agents (MoA)

| # | Finding | H | Sev | Evidence | Fix direction |
|---|---|---|---|---|---|
| M1 | The name "Master of Agents" and abbreviation "MoA" do not say what it is (tiled dashboards of sessions/canvases). The empty board is "Empty panel" plus a bare `+`, with no explanation. | H2, H10 | 3 | d06, mob-390-moa | Rename to **Boards** ("Board 1"). Empty state: "Pin sessions and canvases side by side. Add a session ▸". |
| M2 | An untitled session's panel is titled "Session" (`web/src/moa/MoaWorkspace.jsx:692,788`), so two panels can both read "Session". | H6 | 3 | moa-one-panel | Use the same title rule as the list (auto-title), plus an agent badge. |
| M3 | **Status mismatch:** the panel showed **Idle** with the splash while the same session's main view showed **Error**, a stuck queued prompt and a WARNING. | H1 | 4 | moa-one-panel vs flow-first-prompt-45s | Use a single session-status selector for all surfaces. |
| M4 | Adding a panel takes 4 steps (`+` → pick session → choose "Show: Session chat" → `✓`). The confirm is an icon-only check ("Use chat"), and "Show" has a single option. | H7, H6 | 2 | moa-add-panel-click, moa-picker-selected | One click on a session adds it. Show the canvas choice only when canvases exist. |
| M5 | When a panel's session is deleted, the panel silently becomes "Empty panel", with no "Session deleted" notice. | H1 | 2 | budget-agents (accidental MoA capture after delete) | Show a tombstone: "This session was deleted · Remove panel". |
| M6 | The header swaps out its center controls in MoA mode (eraser "Clear MoA layout", zen) and adds tabs and a "Dashboard options" sliders icon. The same header thus has two different layouts. | H4 | 2 | d06 | Keep the global nav stable and put board controls in a board toolbar. |

### 1.8 Budget ("Providers & Budgets")

| # | Finding | H | Sev | Evidence | Fix direction |
|---|---|---|---|---|---|
| B1 | The nav icon is a **$** and the column says "MY SPEND", but every value is in *tokens* ("0 / ∞", "Peak 0 tokens/day"). Cells have no units. | H2 | 3 | d07, budget-provider-selected | Use "Usage" and "Token limit", with units on every number ("0 / no limit tokens"). Show cost only if it is computed. |
| B2 | "0 / ∞" uses a math symbol for "no limit". "in 0 out 0 cache r 0 w 0" is abbreviated legend copy. | H2 | 2 | budget-provider-selected | "No limit"; "Input · Output · Cache read · Cache write". |
| B3 | "Edit usage policy" is an icon-only wrench that appears only after a provider row is selected; until then the page shows the oddly placed note "No provider selected". | H6 | 2 | d07, budget-provider-selected | Use a row action "Set limits…". |
| B4 | The range chips look different in two tabs (white filled 14d/30d/90d in Cluster summary, outlined in Providers). An empty chart renders five "0" y-ticks. | H4, H8 | 1 | budget-cluster-summary, budget-provider-selected | Use one segmented-control component, and a designed empty chart state. |

### 1.9 Admin Console

| # | Finding | H | Sev | Evidence | Fix direction |
|---|---|---|---|---|---|
| A1 | The Add-provider dialog for type *github-copilot* uses the placeholder `azure-prod` for the name, and "Add provider" stays disabled with no message saying what is missing. Required fields are not marked. | H5, H9 | 2 | d13 | Use a type-aware placeholder and inline validation ("Name is required"). Mark optional fields only ("Base URL (optional)" already does this). |
| A2 | Admin navigation items are buttons without `aria-current`. The heading hierarchy jumps (Admin Console h2 → Model Providers h3, but Feature flags is h2 inside the same console). | H4 | 1 | a15/a23 aria | Use `nav` + `aria-current="page"` and a consistent h1/h2 structure. |
| A3 | Feature flags is the strongest page in the product. It shows saved vs pending state, "Use cluster setting (currently Off)", explicit Save/Discard, and a delivery receipt ("4 of 4 reporting workers updated"). Use it as the pattern for all settings. | — | 0 (positive) | d12-admin-2 | Reuse it for budgets, defaults and providers. |
| A4 | The Admin Console is not reachable at all on mobile (no button). | H7 | 3 | capture-log mobile buttons, a7 | Put Settings in the mobile overflow menu. |
| A5 | "Unrestricted admin access" in the header, and "Packages · SHARED 0 · USER 0" as nav sub-items, read as status, not navigation. | H8 | 1 | d11 | Show counts as badges on the "Packages" item. |

### 1.10 Theme picker

| # | Finding | H | Sev | Evidence | Fix direction |
|---|---|---|---|---|---|
| T1 | There are 20 themes, several of them novelty (SpongeBob, DOOM, Windows 95, WinAMP). Ten of the 20 have at least one text-contrast failure on the home view, five of them badly (1.58–3.62:1, §2.1), and the picker gives no accessibility signal. "Mobile" is an unlabeled-purpose checkbox. | H8, H5 | 2 | d08, theme-* | Offer a curated set (Light, Dark, High contrast, System), with novelty themes under "More", each AA-verified. Label: "Use a separate theme on phones". |
| T2 | Selecting a theme previews it globally. After my scripted session ended mid-preview, the next page load briefly rendered with the previewed theme (observed once, not reproduced). | H3 | 2 | zoom200 first capture (replaced) | Scope the preview to the tab; persist only on Apply. *Unverified root cause.* |

### 1.11 Help and documentation

| # | Finding | H | Sev | Evidence | Fix direction |
|---|---|---|---|---|---|
| H1 | The portal has no help, keybinding sheet or onboarding. `keybindings.md` documents the **TUI**. The help modal exists only in the TUI (`tui/src/app.js:962`). | H10, H7 | 3 | grep `OPEN_HELP` | `?` should open a shortcuts sheet, and the command palette should list shortcuts. Add a first-run tour of 3 cards. |
| H2 | The guide contradicts the UI. `docs/user-guide/portal.md:90-91` says "Click **New** (top-left of the Sessions pane). The agent picker dialog opens", but New is in the header and opens a *model* picker first. Line 114 describes the inspector tabs as text "along the top right"; they are icons. Line 117 suggests right-click on a session row; no context menu exists (inferred from aria tree). | H10 | 2 | portal.md | Regenerate the guide from the redesigned UI and add screenshot-based tests for doc claims. |

---

## 2. WCAG 2.2 AA findings

### 2.1 Contrast (1.4.3 text, 1.4.11 non-text)

I scanned the home view under each theme by previewing it through the picker. The scan checked every
visible text node and alpha-blended through ancestor backgrounds.

| Element / theme | FG | BG | Ratio | Need | Result |
|---|---|---|---|---|---|
| Workspace Dark (default), body text, muted `#8b949e` on `#0d1117` | `#8b949e` | `#0d1117` | 6.2 | 4.5 | ✅ |
| Default, muted on modal `#161b22` | `#8b949e` | `#161b22` | 5.62 | 4.5 | ✅ |
| Default, relative time ("5min") on the **selected** session row | `#8b949e` | `rgb(50,46,34)` | **4.41** | 4.5 | ❌ 🟡 (desktop and 390 px) |
| Default, composer textarea boundary at rest | `rgba(39,46,55,.6)` | page | **1.14** | 3.0 (1.4.11) | ❌ 🟡: the input's edge is effectively invisible |
| Default, Send button boundary | `#1f4b7a` | page | 1.94 | 3.0 | ⚠️ the glyph identifies it, so it passes on glyph contrast |
| Default, textarea focus halo `rgba(47,129,247,.2)` | — | — | 1.29 | 3.0 | ✅ only because the border also changes colour on focus |
| Gruvbox Dark, splash and brand lines | — | — | **2.69** | 4.5 | ❌ |
| DOOM | — | — | **3.29** | 4.5 | ❌ |
| Cobalt2 | — | — | **3.62** | 4.5 | ❌ |
| Hacker X – Matrix, splash and session-row model label | — | — | **3.11 / 3.34** | 4.5 | ❌ |
| MS-DOS 2.0, splash line | — | — | **1.58** | 4.5 | ❌ |
| Dracula, selected-row timestamp | — | — | 3.78 | 4.5 | ❌ |
| GitHub Light, model label "claude-opus-5:medium" | — | — | 4.17 | 4.5 | ❌ |
| Hacker X – Orion Prime, Duroxide, timestamp | — | — | 4.13 / 4.38 | 4.5 | ❌ marginal |
| Windows 95, pane titles | white | blue gradient | 1.82 measured | — | ⚠️ measurement artifact (gradient title bars); visually passes |
| Catppuccin, GitHub Dark, High Contrast Mono, Noctis, Noctis Obscuro, Rust, SpongeBob, Terminal Green, WinAMP | | | 0 failures | | ✅ |

Limits of this scan:

- It covered the home view only, so hover, disabled, chart and tool-card states are not included.
- It did not cover glyph contrast of icons.
- Syntax colours and the splash palettes are theme-defined (`ui/core/src/themes/*.js`) and need a token gate in CI.

### 2.2 Names, roles, values (4.1.2) and structure (1.3.1, 2.4.x)

| # | Issue | SC | Sev | Evidence | Fix |
|---|---|---|---|---|---|
| W1 | The ModalLayer modals (new session ×3 steps, filter, theme, terminate picker, confirm dialogs) are a bare `div.ps-modal` with no `role="dialog"`, `aria-modal` or accessible name (`ui/react/src/web-app.js:13612, 13646, 13772, 13816…`). A screen reader user is not told a dialog opened. | 4.1.2, 1.3.1 | 🔴 | a4/a5 | Use one Dialog primitive with `role=dialog`, `aria-modal`, `aria-labelledby`, initial focus, focus trap and focus return. Reuse what `MoaWorkspace.jsx:281` and the budget sheet (`web-app.js:11644-11693`) already do. |
| W2 | Selection in picker lists (model, effort, agent, theme, filter) is conveyed by CSS class only. Buttons are named "· claude-opus-5 [high]" with no `aria-selected`/`aria-pressed`, and the filter uses literal `[x]` / `[ ]` text instead of checkboxes. | 4.1.2 | 🔴 | a5, d03 | Use `role=listbox`/`option` + `aria-selected` for lists and real checkboxes for the filter. Remove decorative "·" and padding spaces from the names. |
| W3 | The inspector tab buttons and the admin nav buttons expose no selected/current state. | 4.1.2 | 🟡 | a1, a23 | Inspector: `role=tab`, `aria-selected`. Admin nav: `aria-current="page"`. |
| W4 | The main workspace has **zero headings**. Panes (Sessions, Chat, Canvas, Inspector, Activity) are unlabeled `header`s; only Canvas is a named region. | 1.3.1, 2.4.6 | 🟡 | a1 (`headings: []`) | Give each pane a heading or a named `region`, and add a visually hidden h1 per view. |
| W5 | The ASCII splash and logo (█▀█ ╔═╗ …) are exposed as text. The chat scroll panel is `aria-live="polite"` over the whole transcript (`web-app.js:7418`), so screen readers read box-drawing glyphs, and streaming output is likely to be over-announced (*unverified*: no streaming). | 1.1.1, 4.1.3 | 🟡 | a1 aria snapshot | Mark decorative art `aria-hidden`. Use `role="log"` on the message list and announce turn completion and errors through a dedicated status region. Make errors `role="alert"`. |
| W6 | The session tree is not a tree. Rows are buttons; only one row exposes `aria-expanded`; "[+4]" child counts are bare text. The selected row does carry `aria-current` (good). | 1.3.1, 4.1.2 | 🟡 | a16 | Use `role=tree`/`treeitem` with `aria-level`, `aria-expanded` and `aria-setsize`, or a list of disclosures. |
| W7 | The resize handles are focusable `<button>`s, 1 px wide, with no `role="separator"`, `aria-valuenow` or orientation. (The MoA separator does have the role; it is inconsistent.) Arrow keys do resize (+48 px), which is good. | 4.1.2 | 🟢 | a14 | Use `role=separator`, `aria-orientation`, `aria-valuenow/min/max`. |
| W8 | Status and state glyphs carry meaning without text: ⚙ (system), ★/○ (agent kind), `—`, `[+4]`, ○ ✓ ✓✓ receipts, and the workspace git/agent dots (`title` only). | 1.1.1, 1.3.3 | 🟡 | d01, workspace-pane.js:2231-2239 | Give each glyph a visually hidden label; do not rely on `title`. |
| W9 | Page title is static (see S3). | 2.4.2 | 🟢 | — | — |
| W10 | The permission combobox in Manage → Access has no accessible name (`combobox:` with options can read / can write). | 4.1.2, 3.3.2 | 🟡 | manage-session-access aria | Label it "Permission". |

### 2.3 Keyboard and focus (2.1.x, 2.4.3, 2.4.7, 2.4.11)

| # | Issue | SC | Sev | Evidence | Fix |
|---|---|---|---|---|---|
| K1 | **Focus never enters ModalLayer dialogs.** After opening New session, 10 presses of Tab all stayed on the header trigger. Arrows and Enter work only because a global key handler drives the modal. The Close, Cancel, search and sort buttons cannot be reached by Tab. After Escape, focus jumps to a session row, not the trigger. | 2.4.3, 2.1.1 | 🔴 | a4 | Dialog primitive (W1) with focus-in, trap and return-to-trigger. |
| K2 | **Manage session ignores Escape** and does not hold focus. Focus stays on the trigger, and Tab walks into controls *behind* the overlay ("Recently used"…), so focus lands on obscured elements. A pointer user cannot click the background either (the overlay intercepts it). | 2.1.2 (escape), 2.4.11 | 🔴 | a17/a18 (`web-app.js:6458, 6970`) | Same Dialog primitive; Escape closes. |
| K3 | **Character-key shortcuts** fire page-wide whenever focus is not in a text field: `n` new, `r` refresh, `a` artifacts, `p` prompt, `c` cancel, `d` done, `D` delete, `m`, `h`/`l`, `g`/`G`, `[ ] { }` resize (`web-app.js:14244-14380`). They cannot be turned off or remapped. Destructive ones are confirmed (good: `d` → "Complete session "06760567"?"), but `n`, `r` and the resize keys act immediately. A speech-input user who says a word can trigger them. | 2.1.4 | 🟡 | a20, shortcut-d-confirm | Add a setting to turn off single-key shortcuts, or require a modifier; scope them to the focused pane. |
| K4 | **Focus visibility is inconsistent.** There are 4 different indicators: the browser default `auto 1px #005fcc` on most buttons, a 2 px `#79c0ff` outline on sort buttons, a 1 px inset amber shadow on session rows, and a border colour change on inputs. On the resize handles the indicator is a tiny dot colour change (`web/src/index.css:1153-1159`). I captured nothing visible. | 2.4.7 | 🟡 | a11y-resize-handle-focused, a2 | Use one focus token (2 px, ≥3:1 against both adjacent colours, offset 2 px) applied via `:focus-visible` everywhere. Draw a visible handle on focus. |
| K5 | The Tab order inside the Sessions pane jumps from the row toolbar to rows, then to the bottom sort/search controls, then to the child list. Scroll panels are focusable `div`s whose accessible name is their whole content (the ASCII art). | 2.4.3 | 🟢 | a2 stops 10-13, 27 | Give scroll regions a short `aria-label` ("Chat transcript"). Put search before the list. |
| K6 | Positive: modal search fields support Escape/Enter/arrows; the drag-reorder has an Escape cancel; columns resize by keyboard. | — | — | — | Keep these. |

### 2.4 Target size (2.5.8, 24×24 minimum)

| Control | Size | Result |
|---|---|---|
| Desktop header buttons | 44×44 | ✅ |
| Sessions row toolbar | 32×28 desktop, 30×28 at 390 | ✅ (AA), below 44 for touch |
| **Session rows at 390 px** | 404×**22** | ❌ 🟡; they also overflow the 390 px viewport |
| **"Dismiss message" (mobile Connected banner)** | **20×22** | ❌ 🟡 |
| Workspace row actions (static) | **20×20**, hover-only | ❌ 🟡 |
| Resize handles | 1 px wide (hit area about 7 px) | ⚠️ passes through the keyboard equivalent exception; use a 8–12 px hit area |
| Canvas header Zen/Full screen | 26×26 | ✅ (AA) |

### 2.5 Reflow, zoom, motion

- **1.4.10 Reflow (320 px):** no horizontal scroll (✅). The layout stacks.
- **200 % zoom (720×450 CSS px):** passes 1.4.10, but the chat viewport is about 60 px tall below the
  banner, toolbar and session list, which is barely usable (`zoom200-720x450.png`, usability severity 3).
  The search FAB overlaps the selected session row.
- **Mobile 390 px:** about 300 of 844 px is chrome (brand, Connected banner, 8-icon toolbar, Sessions
  header) before chat starts (`mob-390-home.png`).
- **2.3.3 / reduced motion:** four `prefers-reduced-motion` blocks exist (`web/src/index.css:942, 2629,
  6988, 9096`), and no animations run at idle under either setting (✅). Streaming and spinner motion is
  unverified.
- **1.4.12 Text spacing / 1.4.4 resize:** the type scale is small. CSS has 76 declarations below 12 px
  (8.5–11.5 px), including uppercase micro-labels with letter-spacing ("SESSIONS", "MY SESSION DEFAULT",
  "ACTIVITY [CURRENT SESSION V8]"). These pass AA but hurt readability; the redesign should set 12 px as
  the floor.

### 2.6 Input assistance (3.3.x)

- **3.3.1 / 3.3.3:** Add provider disables Submit without saying why (A1). The provider error in chat
  names env vars but not who can fix it, or how (E1/E2).
- **3.3.2:** Add-provider fields are properly labelled (✅, `role=dialog` too). Manage → Name shows an
  empty field with placeholder "Session title" rather than the current name, so the user cannot see what
  they are renaming.
- **3.3.4 Error prevention:** delete, complete and cancel are all confirmed (✅). The confirm dialogs'
  secondary button is labelled **"Cancel"**, while "Cancel Session" is one of the destructive actions in
  the preceding picker. That is a real risk of misreading (see §3).

---

## 3. UX-copy findings

### 3.1 Jargon and internals shown to operators

| Shown today | Where | Problem | Proposed |
|---|---|---|---|
| `Activity 'runTurnV4' JS execution failed: GenericFailure, Error: …missing ANTHROPIC_FEDERATION_RULE_ID…` | chat WARNING | internal code path and env vars | See §3.3 |
| `STATS v1.0.82 · h17 · 7.7 KB · q0 · kv0` | inspector | unexplained abbreviations | "Engine 1.0.82 · 17 events · 7.7 KB · queue 0 · keys 0" (admin trace only) |
| `Duroxide Event History`, `OrchestrationStarted`, `session.affinity_released` | inspector | engine vocabulary | "Engine trace" (admin) |
| `anthropic-wif (anthropic-wif)` | model picker | duplicate id, "wif" | "Anthropic (workload identity)" in admin only; "Anthropic" for operators |
| `[high]` after a model name | model picker | collides with effort "high" | "Higher cost" |
| `Zen mode`, `mobile zen` | canvas, mobile | metaphor | "Focus mode" |
| `Master of Agents`, `MoA 1`, "Clear MoA layout" | header | acronym, and it holds sessions, not agents | "Boards", "Board 1", "Clear board" |
| `queue it behind the pending batch` | composer | internal | "Sends after the current reply" |
| `Showing linked session outside your current filters.` (`ui/core/src/selectors.js:1693`) | header status, truncated | truncated to "Showing linked sess…" | Inline chip in the list: "Hidden by filters · Show" |
| `Me (Unknown User)` (`selectors.js:9227`) | filter | auth-off artefact | "Me (local)" |
| `0 / ∞`, "cache r", "w" | budget | symbol and abbreviations | "0 of no limit", "Cache read", "Cache write" |
| `Unrestricted admin access`, `Auth disabled` | headers | state presented as a title | Account menu: "Signed in as … · Admin" / "Sign-in is off (local mode)" |

### 3.2 Inconsistent terms for the same thing

| Concept | Variants observed | Standard |
|---|---|---|
| End a session normally | Done (`d`), Mark Completed (picker), Complete Session / Complete (confirm), complete_session | **Complete** |
| Stop a session for good | Cancel Session, Terminate (picker title), Cancel Sessions (bulk), abort | **End session** (and drop "Terminate" as a title for a menu that also holds Complete) |
| Remove a session | Delete Session, Hard Delete Sessions, Hard Delete & Restart | **Delete** (with "permanently" in the confirm copy) |
| Dismiss a dialog | Cancel, Close, ✕, Done | **Cancel** only where it means "discard changes"; otherwise **Close**. Never "Cancel" next to "Cancel Session". |
| Start a session | New session, Create Session (on 3 steps), New (docs), `n` | **New session** (entry) → **Start session** (single CTA) |
| The multi-pane view | Master of Agents, MoA, dashboard, workspace (docs) | **Board** |
| Usage tracking | Budget (button), Providers & Budgets (title), My spend (column), tokens (values) | **Usage** (nav), "Token limits" (policy) |
| Diagnostics | Diagnostics (toggle), Inspector, Sequence, Activity, Logs | **Activity** (human timeline) + **Trace** (engine detail) |
| State of a failed session | WARNING, Error (sr status), Idle, (unknown) | **Needs attention**, with a reason |
| Workspace | session folders, main mode, deployment, canvas (see 04 §4) | **Files** for session folders; never use "workspace" for anything else |
| Group / folder | Group (toolbar), folder (tooltip, sort copy) | **Folder** (users' mental model, mail-like) |

### 3.3 Error-message rewrite: the failed-turn case

The structure is what happened + why + how to fix, with the technical detail available but secondary.

> **Couldn't reach Claude Opus 5**
> This workspace's Anthropic connection isn't set up on the workers, so your message wasn't sent.
> **Switch model** · **Retry** · Ask an admin to finish setting up Anthropic in Settings › Providers.
> ▸ Technical details (worker `local-0`, missing ANTHROPIC_FEDERATION_RULE_ID, … · Copy)

While the retry runs, the inline status reads "Retrying in 15 s (1 of 3)… · Cancel". It does not live in
the error text. After the retries the card stays, and the user's message stays marked "Not sent".

Other rewrites:

- **Terminate picker** (`web-app.js:13917-13923`). The untitled fallback produces "What should happen to
  "this session"?", which wrongly quotes a placeholder. Rewrite as **"End or delete 06760567?"**, then the
  options: **Complete** (keeps history, marks done) · **End now** (stops any running work) ·
  **Delete permanently…**. The secondary button becomes **Keep session**.
- **Delete confirm:** "Delete session "06760567"? This action cannot be undone. [Cancel] [Delete]" →
  **"Delete '06760567' and its 0 sub-agents? Its transcript and files will be removed. [Keep] [Delete
  permanently]"**. After deleting, show a toast with **Undo** for 10 s if the backend can support a soft
  delete; otherwise say plainly that it is gone.
- **Add provider disabled:** add helper text beside the button, "Enter a name and token to continue".
- **Empty states:**
  - Files: "No files yet. Files the agent saves or exports appear here."
  - Sequence: "Nothing has run yet. Send a message to see each step here."
  - Board: "Put sessions side by side. Add a session ▸".

### 3.4 Terminology standard (proposal)

This standard is for adoption by the redesign. It is compatible with `04-journeys-and-parity.md` §4.

1. **Session**: one durable conversation with an agent. Title it automatically from the first prompt.
   Never show a GUID as the name; put the id in details.
2. **Agent**: what the session is for (generic or named). **Sub-agent**: a session started by another
   session; it is never called a "child" in the UI.
3. **Model** + **Thinking level** (Low/Medium/High/Max); the API term "reasoning effort" stays in admin.
   **Cost tier** is shown as $–$$$.
4. **Status** (one vocabulary, every surface): *Starting · Working · Waiting (until 14:05) · Needs you ·
   Needs attention (error) · Idle · Completed · Ended*.
5. **Message states:** *Sending · Queued · Delivered · Not sent*.
6. **Stop** (this reply) · **Steer** (guide this reply) · **Complete** (finish the session) · **End**
   (abort the session) · **Delete** (remove permanently).
7. **Board** (formerly MoA) · **Canvas** (an agent-drawn view) · **Files** (session folders and exports).
8. **Usage** (tokens) · **Token limit** · **Provider** (a configured model connection) · **Settings**
   (the admin console; the admin-only sections are badged).
9. **Activity** (human timeline) · **Trace** (engine events, admin).
10. **Time:** local time in the UI everywhere, with UTC in tooltips, and relative time in lists.

---

## 4. Task-flow friction (measured, desktop 1440 unless noted)

"Clicks" counts pointer activations. "Keys" counts the fastest keyboard route that I verified or that
the source supports.

| # | Core task | Clicks today | Keys today | Confusion points | Target |
|---|---|---|---|---|---|
| T1 | Start a session and send the first message | **4** (+ → Create Session → Create Session → Create Session) + typing + Enter | `n`, Enter ×3, type, Enter | Three identically labelled CTAs; model before purpose; `[high]` ambiguity; no warning that the provider can't run; no name prompt | 1 click ("New session" → agent default preselected → type → Enter) |
| T2 | Understand why the first message failed | Read the WARNING, then it disappears. Recovery: diagnostics toggle (1) → read truncated Activity → Logs tab (2) → scroll | `l` to move focus, `m` to cycle tabs (undiscoverable) | Raw stack text; status becomes "Idle"; the prompt vanishes; MoA shows "Idle" | 0: a persistent error card with an action |
| T3 | Retry after an error | No retry control. Retype the whole prompt. | — | Prompt lost | 1 (Retry) |
| T4 | Rename a session | 3 (select row → wrench "Manage session" → type into an *empty* field → Save) | `t` with focus in the sessions region (undiscoverable) | Field does not show the current name; "Manage" is a wrench icon | Inline rename (double-click / F2), 1 |
| T5 | Find a session | 1 (type in "Find a session…") | none (no shortcut to focus search) | Search is at the bottom; owner filter is a separate header icon | `/` or ⌘K focuses search at the top |
| T6 | End or delete a session | 4 (select → Terminate icon → Delete Session → Delete) | `D`, Enter | Picker titled "Terminate" holds Complete; "Cancel" means two things; feedback is a truncated header line, with no undo | 2 (row ⋯ → Delete… → confirm), with a toast |
| T7 | Share a session read-only with the team | 5 (select → wrench → Access tab → "Shared · read" radio → Apply) | — (Escape does not close; Tab escapes into the page) | Sharing lives under "Manage"; the permission combobox is unlabelled | 3 (Share button → choose → Done) |
| T8 | Put two sessions side by side | **8** (MoA → + → session → ✓ → Split right → + → session → ✓) | none practical | "Master of Agents"; icon-only ✓; one-option "Show" select; panels titled "Session" | 3 (Board → add A → add B) |
| T9 | Check token usage for a provider | 2 (Budget $ icon → provider row) | — | "Spend" and $ for tokens; ∞; abbreviations | 1 |
| T10 | Add a model provider | 3 + typing (Settings gear → Add provider → fill → Add provider) | — | Disabled CTA with no reason; wrong placeholder; **impossible on mobile** | Same clicks, with inline validation and a health check after saving |
| T11 | Change theme | 3 (Theme → pick → Apply Theme) | — | 20 themes, 10 with AA failures | 2 |
| T12 | Learn the keyboard shortcuts | not possible in the portal | `?` does nothing | The docs describe the TUI | `?` sheet + palette |

---

## 5. Top 15 must-fix issues for the redesign (ranked)

Ranking weighs how many users are blocked, how often it happens, and whether data or trust is lost.

1. **Failed turns must be durable and recoverable** (E1, E2, T2, T3). Keep the user's message, show a
   plain-language error card with Retry, Switch model and Copy details, and set the status to "Needs
   attention". Today the prompt silently disappears. *Nielsen 4.*
2. **One accessible Dialog primitive for every modal** (W1, K1, K2). It needs `role=dialog`,
   `aria-modal`, a name, focus-in, a focus trap, Escape to close and focus return. Retire ModalLayer's
   `div.ps-modal` and the share overlay. *WCAG 🔴 2.4.3 / 2.1.2 / 4.1.2.*
3. **A single source of truth for session status** across list, chat, MoA, the child list and the
   header (M3, L3, 3.2 status vocabulary). *Nielsen 4.*
4. **Provider health preflight in session creation** (C5). Never offer a model the workers cannot run.
   Say who can fix it. *Nielsen 4.*
5. **Collapse session creation to one step, agent first** (C1–C3, T1). One "Start session" CTA, with
   model and thinking level as defaulted advanced fields. Remove the `[high]` ambiguity. *Nielsen 3.*
6. **Labelled navigation and a command palette** (S1, D1, E6, H1, T12). Use text labels for the 4
   destinations, ⌘K with all actions and shortcuts, `/` commands in the composer, and a `?` shortcut
   sheet. *Nielsen 3.*
7. **Make single-key shortcuts safe** (K3). Allow turning them off or requiring a modifier, and scope them
   to the focused pane. *WCAG 🟡 2.1.4.*
8. **Accessible selection semantics** (W2, W3, W6). Listbox/option for pickers, real checkboxes for
   filters, tablists for the inspector, a tree for sessions, and `aria-current` for nav. *WCAG 🔴/🟡 4.1.2.*
9. **A unified, visible focus indicator** (K4). One 2 px token at ≥3:1, on every control including the
   resize handles and session rows. Raise composer and input boundaries to ≥3:1 (1.14:1 today). *WCAG 🟡
   2.4.7 / 1.4.11.*
10. **Human titles and readable session rows** (L1, M2). Auto-title sessions, use a two-line row with a
    status chip, and remove GUIDs, "—" and bracket counts from the primary line. *Nielsen 3.*
11. **Two-layer diagnostics** (D2–D4). A human Activity timeline linked to chat turns, and an opt-in
    engine Trace. Expandable entries and one time zone. *Nielsen 3.*
12. **Phone parity and density** (A4, §2.4, §2.5). Settings reachable on mobile, session rows ≥44 px,
    no overflow, chrome ≤120 px, and the Connected banner shown only when offline. The same applies at
    200 % zoom. *Nielsen 3 / WCAG 🟡 2.5.8.*
13. **A terminology standard applied everywhere** (§3.2, §3.4). Complete / End / Delete; Board; Usage;
    Files; one "Cancel" meaning; rewrite the confirm and terminate copy. *Nielsen 3.*
14. **Theme governance** (T1, §2.1). A curated AA-verified set plus High Contrast, novelty themes
    opt-in, and a CI contrast gate per theme token set. Fix the 4.41:1 selected-row timestamp in the
    default theme. *WCAG 🟡 1.4.3.*
15. **Structure and screen-reader hygiene** (W4, W5, W8). Pane headings and named regions,
    `aria-hidden` ASCII art, `role=log` for the transcript with a separate status/alert region, and text
    alternatives for every status glyph. Align the user guide with the UI (H2). *WCAG 🟡 1.3.1 / 4.1.3.*

---

## Appendix A. Live-audit evidence added by this pass

All files are in `research/screens/`:

- **Focus:** `a11y-focus-tab4-header.png`, `a11y-focus-tab13-sessions.png`,
  `a11y-resize-handle-focused.png` (no visible ring).
- **Session creation and the failed turn:** `flow-new-session-step2.png` (reasoning step),
  `flow-new-session-step3.png` (agent step), `flow-new-session-created.png`,
  `flow-first-prompt-{3,10,25,45}s.png` (WARNING, stuck queue), `flow-error-session-settled.png` (prompt
  gone, Idle), `flow-error-session-diagnostics.png` (only Activity JSON remains).
- **Boards:** `moa-add-panel-click.png`, `moa-picker-selected.png`, `moa-one-panel.png` (Idle/"Session"
  mismatch), `moa-split-right.png`.
- **Mobile, reflow and zoom:** `mob-390-home.png`, `mob-390-sessions-tap.png`, `mob-390-moa.png`,
  `reflow-320.png`, `zoom200-720x450.png`.
- **Themes:** `theme-{doom,github-light,high-contrast-mono,spongebob,windows-95}.png`.
- **Sessions and dialogs:** `search-no-results.png`, `manage-session-modal.png`,
  `manage-session-access.png`, `terminate-picker.png`, `shortcut-d-confirm.png`, `delete-confirm.png`,
  `after-delete.png`.
- **Inspector:** `inspector-{files-tab,node-map,duroxide-history,stats,logs}.png`.
- **Budget:** `budget-cluster-summary.png`, `budget-provider-selected.png`. `budget-agents.png` is
  mislabelled: a locator matched "Master of Agents", so it shows the MoA board after the session was
  deleted, which is evidence for M5.

**Side effects:** I created one test session (`06760567…`) in the local database and deleted it through
the UI. I left one empty two-panel MoA board ("MoA 1") in the local profile. The theme was previewed but
never applied, and the default `workspace-dark` theme was confirmed afterwards. I made no product source
changes, no git changes, and no LLM or external API calls.
