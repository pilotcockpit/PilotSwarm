# 02 — Portal UI inventory and UX / code-health audit

Status: research input for the [portal UX redesign](../frontend-stack.md). Snapshot of
branch `dev` at `2a50ca25`, 2026-10-30. Read-only audit: nothing was built, run or
changed. Every claim cites a file and line. Where a statement is an inference rather
than something read directly in code, it says so.

## How to read the citations

File names are unique inside the portal, so citations use the short name. Paths:

| Short name | Path | Lines |
|---|---|---|
| `index.html` | `packages/app/web/index.html` | 12 |
| `main.jsx` / `App.jsx` | `packages/app/web/src/` | 10 / 1003 |
| `deep-link.js` | `packages/app/web/src/lib/deep-link.js` | 147 |
| `browser-transport.js` | `packages/app/web/src/browser-transport.js` | 124 |
| `MoaWorkspace.jsx`, `moa.css`, `pane-layout.js`, `use-pane-drag.js` | `packages/app/web/src/moa/` | 958 / 274 / 104 / 96 |
| `use-view-navigation.js`, `view-history.js`, `CompactViewNavigation.jsx` | `packages/app/web/src/navigation/` | 175 / 63 / 19 |
| `index.css` | `packages/app/web/src/index.css` | 11,112 |
| `web-app.js` | `packages/app/ui/react/src/web-app.js` | 16,516 |
| `workspace-pane.js`, `workspace-editor.js`, `workspace-markdown.js` | `packages/app/ui/react/src/` | 3,068 / 437 / 114 |
| `components.js`, `platform.js` | `packages/app/ui/react/src/` (TUI renderer) | 2,575 / 15 |
| `feature-flags-panel.js`, `native-task-card.js`, `chat-call-line.js`, `chat-status.js`, `use-controller-state.js` | `packages/app/ui/react/src/` | 188 / 96 / 17 / 60 / 38 |
| `controller.js`, `reducer.js`, `selectors.js`, `state.js`, `layout.js`, `commands.js`, `store.js`, `moa.js` | `packages/app/ui/core/src/` | 12,139 / 4,495 / 9,775 / 847 / 342 / 117 / 31 / 77 |
| `themes/*.js` | `packages/app/ui/core/src/themes/` (20 themes + helpers) | 1,763 total |
| docs | `docs/user-guide/{portal,master-of-agents,workspaces,keybindings}.md` | 710 / 154 / 272 / 184 |

## Summary of findings

1. **The live portal is one React tree built with `React.createElement`, mostly in one
   16.5k-line file.** `index.html:10` → `main.jsx` → `App.jsx` → `PilotSwarmWebApp`
   (`web-app.js:15695`). The whole `web/src/components/**.tsx`, `web/src/hooks/*.ts(x)`,
   `main.tsx`, `App.tsx` and `lib/{api,format,theme}.ts` tree is **dead code**: nothing imports it,
   it depends on `react-router-dom` and Tailwind classes that are not installed, and it
   has not changed since v0.4.0 (`630ff638`, 2026-07-03). `web/public/app.js` +
   `public/index.html` are a still older xterm.js portal, also dead.
2. **Rendering is terminal-shaped.** ui-core selectors produce "lines" of colored "runs"
   (`{text, color: "cyan"}`) sized in character cells, shared with the Ink TUI. The web
   measures a character width at runtime to publish a fake terminal viewport
   (`web-app.js:15706-15760`). Panel titles are ANSI color names (`web-app.js:4244`). A
   rebuilt frontend can reuse the controller, reducer and data logic, but not the
   presentation selectors as they stand.
3. **There is no URL routing.** The address bar never changes as you navigate (the only
   `history.replaceState` is the chromeless flag, `deep-link.js:142`). Browser Back leaves
   the app. A custom 10-entry view history in `sessionStorage` (`view-history.js:2`) with
   its own toolbar arrows and `Alt+-`/`Alt++` stands in for it, desktop only.
4. **Many features are reachable only by keyboard, by hidden gestures, or not at all from
   the UI.** Linked items (`a`), multi-select (Cmd/Ctrl/Shift-click only), and expand or
   collapse of a parent (click an already-active row) have no visible control. The user
   guide describes several controls that do not exist: right-click menus, a "select mode"
   toggle, a Summary/Chat toggle, swipe between panes, an Admin "menu", a paperclip that
   takes any file.
5. **Dialogs are inconsistent and mostly inaccessible.** About 20 modal types render
   through `ModalLayer` (`web-app.js:13415`) without `role="dialog"`, `aria-modal`, a focus
   trap or focus return. Global key handlers capture Tab inside them. MoA's own `Modal`
   (`MoaWorkspace.jsx:253`) does all of this correctly, and so does the Workspace tab
   (`workspace-pane.js:2812-2862`). There are at least six dialog implementations.
6. **Styling is one 11k-line global stylesheet.** It has 443 theme-specific override
   lines, 63 `!important`, about 50 distinct font sizes (down to 9.5px), no spacing tokens,
   and a monospace font for the entire UI. The theme model is an ANSI terminal palette
   mapped onto about 35 CSS variables at runtime (`web-app.js:1024-1075`).
7. **Tests are extensive but miss the parts a redesign needs.** 111 ui/core test files
   (17k lines), 22 web unit tests and 59 Playwright specs (13.5k lines) exist. The
   Playwright suite is **not run in CI** (`pr-checks.yml:85` runs only
   `npm test --workspace=pilotswarm`). There are no axe or accessibility assertions and no
   visual baselines.

---

## 0. What is live and what is dead

### 0.1 Entry chain (live)

| Step | Evidence |
|---|---|
| `index.html` loads `/src/main.jsx` | `index.html:10` |
| `main.jsx` renders `App.jsx` in `StrictMode`, imports `index.css` | `main.jsx:1-10` |
| `App.jsx` imports `PilotSwarmWebApp`, `createWebPilotSwarmController` from `pilotswarm/ui-react` (Vite alias → `ui/react/src/index.js`) | `App.jsx:6`, `vite.config.ts` alias block |
| `ui/react/src/index.js` re-exports `platform.js`, `use-controller-state.js`, `components.js` (TUI) **and** `web-app.js` (web) | `ui/react/src/index.js:1-4` |
| Server serves `web/dist` with SPA fallback; `index.html` no-store | `server.js:114-117,359-371` |
| Vite manual chunks: `react`, `msal`, `pilotswarm` (ui-core + ui-react) | `vite.config.ts` `manualChunks` |

### 0.2 Dead or legacy code

| Code | Why it is dead | Evidence |
|---|---|---|
| `web/src/main.tsx`, `App.tsx`, `components/**` (22 files, 998 lines), `hooks/*.ts(x)` (6 files), `lib/api.ts`, `lib/format.ts`, `lib/theme.ts` | Not referenced from the live chain. Imports `react-router-dom`, which is not installed in root or package `node_modules`. Uses Tailwind classes (`bg-[#16213e]`) with no Tailwind installed. Last touched in v0.4.0 | `main.tsx:3`, `App.tsx:1`, `components/chat/SlashCommandMenu.tsx:17`, `git log` → `630ff638` |
| `web/public/app.js` + `public/index.html` (731 lines) | xterm.js "terminal-in-browser" portal from `docs/proposals/portal-web-experience.md`. Imports `/xterm/...`, which is not served. **Inference:** Vite copies `public/` into `dist/`, so `app.js` probably ships at `/app.js`, and `public/index.html` collides with the built `index.html` | `public/app.js:1-4`, `public/index.html:7` |
| In `web-app.js`: `ChatFocusOverlay` + `CHAT_FOCUS_PANES`, `StatusStrip`, `RowResizeHandle`, `DeleteProviderSheet`, `AdminGhcpSection`, `SidebarGlyph`, `InspectorPaneGlyph`, `ActivityPaneGlyph`, `getPortalLinkOrigins` | Defined, never referenced (one occurrence each in the repo) | `web-app.js:9629-9673, 10421, 10997, 12595, 15603, 6616, 6642, 6648, 218` |
| `UI_COMMANDS` the web never dispatches: `TOGGLE_SELECT_MODE`, `CYCLE_SESSION_VISIBILITY`, `OPEN_SHARE_SESSION`, `OPEN_SWITCH_MODEL_PICKER`, `TOGGLE_PANE_FULLSCREEN`, `OPEN_HELP` | TUI-only paths. The `help` and `shareSession` modal types have no renderer in `ModalLayer` | `commands.js:12-117`, `controller.js:7797,11908`; no match in `web-app.js` |
| `tsconfig.json` | Covers `src`, but no script type-checks it, and the live code is `.js`/`.jsx` | `tsconfig.json`, `package.json` scripts |

**Slash commands:** the live portal has none. The only slash menu is the dead
`SlashCommandMenu.tsx:1-8` (`/models`, `/model`, `/info`, `/done`, `/new`, `/help`).
Neither the controller nor any selector parses `/`-prefixed prompts. A grep for `"/help"`,
`"/model"` and similar across `ui/` and `tui/src` returned nothing.

---

## 1. Surface inventory

Columns: **Surface** · **Purpose** · **How reached** · **Controller / API** · **Code**.
"Controller" means `PilotSwarmUiController` methods or `UI_COMMANDS` (`commands.js:12`).
Transport calls are `HttpApiTransport` methods behind `/api/v1`, wrapped by
`browser-transport.js`.

### 1.1 Pre-workspace gates (App.jsx)

| Surface | Purpose | Reached | Controller / API | Code |
|---|---|---|---|---|
| Portal config fetch | Branding, auth config, link origins, `workspaceFiles` flag, page title, favicon | Always, first | `GET /api/portal-config`; sets module globals `setPortalWorkspaceFiles`, `setPortalLinkOrigins` | `App.jsx:130-188, 940-942` |
| Loading gate | "Preparing your workspace" card (copy configurable via `portal.ui.loadingMessage/loadingCopy`) | While config or auth load | none | `App.jsx:323-332, 962-968` |
| Startup failure | Same card with title "Portal startup failed" and the error text | Config fetch error | none | `App.jsx:328-329, 970-976` |
| Sign-in gate | Branded card + "Sign In" button (label configurable) | `!auth.signedIn` | `usePortalAuth().signIn` (MSAL / proxy / dev) | `App.jsx:350-380, 978-986` |
| Dev persona picker | Pick a test persona (initials, name, role chip); red "DEV AUTH" banner | `auth.config.provider === "dev"` | `signIn(user.id)` | `App.jsx:334-348, 354-377` |
| Access denied | "Access denied for …" + Sign Out | `auth.forbidden` | `signOut` | `App.jsx:382-400, 988-996` |
| Deep-link stash | Saves `?session=…` across a redirect sign-in | Sign-in gate visible | `sessionStorage[pilotswarm.portal.deepLinkSession]` | `App.jsx:40-67, 935-940`, `deep-link.js:12` |
| Canvas share viewer | Read-only, live, token-only canvas in a sandboxed iframe. Strip "Shared canvas — live, view only". Gone state "This canvas link is no longer valid." | `?canvasShare=<token>` (bypasses auth) | `/api/canvas-share/*` fetches + share-scoped WS; KV writes refused | `App.jsx:749-928, 949-955` |
| Persistent dev banner | "DEV AUTH — not for production · signed in as …", survives chrome hiding | `auth.provider === "dev"` | — | `App.jsx:688-692` |
| Build-freshness button | "↻ New build — reload" when the served bundle differs from this tab's | Polls `/` every 60 s | `fetch("/")` | `App.jsx:420-459, 497-504` |

No first-run onboarding or tour exists. The only "splash" is terminal-markup ASCII art
rendered as the chat body when no conversation is loaded (`selectors.js:2057, 2691-2730`,
`web-app.js:894-906, 4129`). It is configurable via `portal.branding.splash/splashMobile`
(`App.jsx:604-608`).

### 1.2 App shell, header and toolbar

| Surface | Purpose | Reached | Controller / API | Code |
|---|---|---|---|---|
| `PortalHeader` | Brand mark (theme icon or logo), kicker title, identity (name + email, "(*)" prefix for admins), version label, status text, stale-build button, sign-out | Always (hidden from layout when chromeless) | `auth.signOut` | `App.jsx:461-555` |
| Header portal slots | `#ps-header-toolbar-slot`, `#ps-toolbar-meta-slot`, `#ps-toolbar-signout-slot`. Found by `getElementById` in a `requestAnimationFrame` loop, then `createPortal` | Desktop | — | `App.jsx:463-479, 492-547`, `web-app.js:10593-10599, 10855-10882` |
| Status text | Transient string from `ui.statusText` / connection, shown truncated in the header with a tooltip | Any `ui/status` dispatch | `usePortalControllerStatusText` | `App.jsx:223-252, 506-510` |
| Mobile status row | Dismissible status row under the header (desktop hides it via CSS) | `≤920px` | local state | `App.jsx:557-570, 726-731` |
| **Desktop toolbar** (portalled into the header) | Three zones. **Left:** MoA status slot or the maximized-canvas slot. **Centre** (`role="navigation"`): `[New, Filter] · [Back, Forward] · [Canvas, Diagnostics]`. **Right:** `[meta] [Workspace, MoA, Budget, Admin/Settings] │ [Theme] [Sign out]` | Always, desktop | see the buttons below | `web-app.js:10591-10883` (`ACTIONS`/`PANELS`/`MODES` at `10825-10828`) |
| — New session (＋) | Opens the model → reasoning → context-tier → agent chooser chain | Toolbar; key `n`; `Shift+N` is caught but does nothing (below) | `OPEN_MODEL_PICKER` → `openModelPicker` → `openReasoningEffortPicker` → `openContextTierPicker` → `openSessionAgentPicker` | `web-app.js:10632-10636`, `controller.js:7236-7491, 9180-9231` |
| — Filter (funnel) | Session owner filter dialog | Toolbar | `OPEN_SESSION_FILTER` → modal `sessionOwnerFilter` | `web-app.js:10638-10642, 13752-13812` |
| — Theme (contrast glyph) | Theme picker (grouped list + "Mobile" touch-scale checkbox) | Toolbar; `Shift+T` | `OPEN_THEME_PICKER` | `web-app.js:10644-10648, 13531-13550, 14154-14157` |
| — Canvas toggle | Desktop: open/close the canvas column. Phone: overlay the canvas on chat. Corner badges: green "loaded", yellow "unseen revision" | Toolbar | `ui/canvasOpen` | `web-app.js:10655-10686, 10764-10775` |
| — Budget (coin) | Providers & Budgets surface (replaces the workspace) | Toolbar (desktop + phone) | `openBudget` / `closeBudget` | `web-app.js:10689-10698` |
| — Diagnostics (bug) | Inspector + Activity column (desktop only; off by default) | Toolbar | `ui/diagnosticsOpen` | `web-app.js:10705-10711` |
| — Admin console / Settings (cog) | Same panel, labelled "Admin console" for admins and "Settings" otherwise. **Desktop only** | Toolbar | `OPEN_ADMIN_CONSOLE` / `CLOSE_ADMIN_CONSOLE` | `web-app.js:10715-10721, 10606-10617` |
| — Workspace mode | Return to sessions/chat. Tooltip says "Sessions — session list, chat and panels" | Toolbar, desktop | `OPEN_WORKSPACE` | `web-app.js:10726-10732` |
| — Master of Agents | Enter MoA ("Back to MoA" after focusing a panel) | Toolbar (when MoA has loaded) | `moa.open()` | `web-app.js:10735-10743` |
| — Back / Forward | View history; tooltip names the destination and shortcut | Toolbar (desktop); `Alt/Option + -/+` | `useViewNavigation` | `web-app.js:10745-10752`, `use-view-navigation.js:170-175`, `view-history.js:50-63` |
| `IconButton` | The toolbar primitive: icon only, label in a portalled tooltip (hover delay; long-press 450 ms on touch); suppresses the iOS callout | Everywhere | — | `web-app.js:10435-10589` |
| **Mobile toolbar** | One inline row. Left: actions (new, filter, theme, canvas, budget). Right: MoA + **Main** (cycles split → chat → sessions) + **Diagnostics** (toggles inspector ↔ activity) | `≤920px` | local `mobilePane`, `mobileMainLayout` | `web-app.js:10771-10821, 16475-16499` |
| Chromeless strip | "<title> · Live canvas", compact back/forward, faint "Show chrome" | `?show_chrome=false` | `writeShowChromeParam(true)` | `App.jsx:583-595, 693-711`, `deep-link.js:115-145` |

### 1.3 Workspace mode: Sessions pane

`SessionPane` (`web-app.js:5439-6444`) is mounted on desktop (column 1), on phone
("Main" layouts), in the mobile search `<dialog>`, in MoA's session picker (with
`selection`) and in MoA's control panel (`actionsOnly`).

| Surface / control | Purpose | Reached | Controller / API | Code |
|---|---|---|---|---|
| Panel header "Sessions" (yellow) | Title + action strip | — | — | `web-app.js:6287-6297` |
| Pin / Unpin | Pin a top-level non-system session | Header icon (disabled with an explanatory tooltip otherwise) | `PIN_SESSION` | `web-app.js:6170-6180` |
| Folder (group) | "New group" / "Move this session to a group" / "Move N selected…" with a count badge | Header icon; `Ctrl+G` | `OPEN_MOVE_TO_GROUP` → `sessionGroupPicker`, `sessionGroupName` modals | `web-app.js:6181-6194`, `14391-14394` |
| Manage (wrench) | Opens **Manage session** (`SessionModifyModal`); for a group row it renames the folder | Header icon | local `manageOpen`; `OPEN_RENAME_SESSION` for groups | `web-app.js:6195-6218` |
| Copy link | Copies `?session=<id>` and **opens a modal** confirming the copy, with per-origin rows and a "private" warning | Header icon | `buildSessionLinkUrl`, `getSessionAccess` | `web-app.js:6219-6233, 6446-6471` |
| Terminate / Restart | Lifecycle chooser (`terminatePicker`) → confirm | Header icon; keys `c` / `d` / `Shift+D` | `OPEN_TERMINATE_PICKER`, `pickTerminateAction`, `CANCEL/DONE/DELETE_SESSION` | `web-app.js:6234-6246, 13914-13968`, `controller.js:10608, 11480, 11605` |
| Bulk state | "N selected" label + ✕ clear | Cmd/Ctrl-click, Shift-click rows (no visible toggle) | `sessions/selectMode`, `selectToggle`, `CLEAR_SESSION_SELECTION` | `web-app.js:6158-6168, 6060-6085` |
| Session list | Tree of rows: pinned, groups (🗂), system (⚙), children nested with rails | — | `selectSessionRows` (ui-core) | `web-app.js:6310-6346` |
| `SessionListRow` | `<button>` per row. Click selects; clicking the **already active** parent or group toggles expand. Drag to reorder or file into a folder (only in "Saved" sort, not on touch) | Click, keys `j/k/↑/↓`, PageUp/Down | `sessions/expand|collapse`, drag handlers | `web-app.js:4899-5030, 6045-6090` |
| `SessionRowContent` | Status dot, owner avatar (initials + hue), title, badges (canvas mark, visibility, wait countdown, child counts) | — | selectors | `web-app.js:5031-5357` |
| Drag ghost | "Release to file here / remove from folder / move here / cancel" | Drag a row | — | `web-app.js:6250-6268` |
| Sort modes | Recently used / Recently updated / Saved order (icon buttons, `aria-pressed`) + Refresh order | Below the list | `sessions/sortMode`, `refreshSessions` + `sessions/refreshSort` | `web-app.js:6347-6376` |
| Find a session | Inline search on desktop; on phones a search icon opens a modal `<dialog>` overlay | Below the list | `SessionSearchControl`, `sessions/filterQuery` | `web-app.js:5358-5437, 6377-6388, 6416-6427` |
| `SessionDetailBox` | Collapsible "Show/Hide session details": title, status, model, owner, wait reason, budget pause button | Under the list (desktop default; phones only in "sessions" layout) | `ui/sessionDetailCollapsed`, `openBudget` | `web-app.js:4675-4866, 6389-6402` |
| Empty state | "No sessions yet." / `No sessions matched "<q>".` (no call to action) | Empty list | — | `web-app.js:6335-6338` |

**Manage session modal** (`SessionModifyModal`, `web-app.js:6817-7113`). Tabs: **General**
(Name + Save, Model + "Switch model…", Workspace: Set…/Clear/Retry now/Files, Context:
"Regenerate context…") and **Access** (General access radio: Private / Shared·read /
Shared·write; Special access: people search, grant read/write, Remove; Apply). It uses
`transport.renameSession`, `getSessionAccess`, `listSessionShares`, `listKnownUsers`,
`setSessionVisibility`, `grantSessionShare`, `revokeSessionShare` **directly from the
component** (`web-app.js` has 37 `controller.transport.*` calls), plus `OPEN_SET_WORKSPACE`,
`CLEAR_WORKSPACE`, `RETRY_WORKSPACE`, `OPEN_WORKSPACE_FILES`, `REGENERATE_SESSION`.

### 1.4 Workspace mode: Chat pane

`ChatPane` (`web-app.js:7233-7440`), rendered through `ScrollLinesPanel`
(`web-app.js:4437-4674`).

| Surface | Purpose | Reached | Controller / API | Code |
|---|---|---|---|---|
| Chat title + right meta | Session title (⚙ for system), right-side status (animated dots) | — | `selectChatPaneChrome` (returns ANSI-colored runs) | `selectors.js` `selectChatPaneChrome`, `web-app.js:7393-7397` |
| `SessionHeaderStatus` | `role="status"` "Session status" chip | — | `selectStatusBar` | `web-app.js:7132-7147` |
| Transcript blocks | Typed blocks: `nativeTasks` (Explore/Task cards), `chatCallGroup` (collapsed tool-call lines), `turnControl` (Stop/Steer outcome), `group`, `assistantPreview` (cards), `imageAttachments`, `preserve` (splash art), `code`, `card`, `table` | — | `selectChatLines` (`selectors.js:3198`) → `buildStructuredBlocks` | `web-app.js:3801-4243` (`StructuredBlockList` `4085-4243`) |
| Line types | `Runs`, `SystemNoticeLine`, `ChatActivityRun`, `CanvasActionLine`, memoized `Line`, `ArtifactLink` (with type glyph), Mermaid, tables with CSV copy | — | — | `web-app.js:1501-1900, 2144-2490` |
| Pending question | `ask_user` question rendered as a **system markdown message** listing "Choices:" as bullets; the user must type the answer in the composer (placeholder "Answer…") | Session `input_required` | `buildPendingQuestionMessage` (`selectors.js:1724-1755`); `sendAnswer` path | `web-app.js:9935, 9969, 10227` |
| History loader | Pull at the top to load older events; manual "load older" button; "Loading earlier messages…" `role="status"` | Scroll to top | `EXPAND_HISTORY`, `getSessionEventsBefore` | `web-app.js:7149-7188, 7424-7436` |
| Outbox strip | Queued / pending prompts (○ / ✓) pinned above the composer; click to select (Steer / delete) | Prompts queued during a turn | `selectOutboxOverlayLines`, `selectPreviousPendingPrompt` | `web-app.js:7190-7231, 7342-7344` |
| Read-only notice | "You have view access… Ask <owner> for write access" / "⚗ Service session" | No write access or service session | `useActiveSessionAccess` → `transport.getSessionAccess` | `web-app.js:7346-7365` |
| Navigation error | "This session was not found or has not been shared with you" + Retry | Failed deep link | `selectNavigationError`, `setNavigationIntent` | `web-app.js:7371-7390` |
| Enter mobile zen | Expand icon in the chat header on phones | Phone | `moa.openMobileZen` | `web-app.js:7399` |
| **Composer** (`PromptComposer`) | Auto-growing textarea (no visible label; placeholder only); image chips; Attach (📎, **images only**, `accept="image/*"`); Cancel/Delete queued; Stop ■; Steer ↪ (feature `sessions.steering`; on phones a hold menu "Steer now / Queue", `role="menu"`); Send (busy "Uploading…"); kept-steer text Restore/Discard; turn-control notice with Retry/Dismiss | Always, unless read-only | `setPrompt`, `SEND_PROMPT`, `STOP_TURN`, `STEER_TURN`, `stageImageFiles`, `acceptPromptReferenceAutocomplete` (Tab completes `artifact://` / `@` references) | `web-app.js:9711-10420` (textarea `10236-10262`, attach `10318-10338`, stop `10353-10360`, steer menu `9800-9912`) |

### 1.5 Workspace mode: right side (desktop)

The right block holds up to two optional columns (canvas, diagnostics), or the artifact
reader in place of both (`web-app.js:16179-16216, 16341-16424`).

| Surface | Purpose | Reached | Controller / API | Code |
|---|---|---|---|---|
| **Artifact reader** (`ArtifactTakeoverPane`) | Full-height preview of one artifact beside chat: ← / → between artifacts, copy link, download, close (Esc) | Click an `artifact://` link; `?session&artifact`; Files "open" | `revealArtifact`, `closeArtifactPane`, `downloadArtifact` | `web-app.js:7455-7596` |
| Previews | Markdown (+ front matter, mermaid), CSV/TSV table, HTML (rendered/source, fit-width, zoom), image, PDF/binary metadata | Inside the reader, Files, mobile overlay | `getArtifactMetadata`, `downloadArtifact` | `web-app.js:1902-2143, 2491-2880, 2881-3100, 3100-3420` |
| **Canvas pane** | Side pane with tabs **Canvas \| Workspace** (Workspace only if `portal.workspaceFiles`). Canvas: `name · rev N`, slot prev/choose/next (1–5), zoom, Share, Zen, Full screen; blank state "Nothing on the canvas yet." | Toolbar canvas toggle; `?view=canvas[&slot][&max=1]`; an agent "present"/flip | `ui/canvasOpen`, `canvas/flip`, `ui/canvasZen`, `ui/canvasMaximized`, `ui/rightPaneMode` | `web-app.js:8647-8878` (tabs `8647-8663`, header `8725-8835`, blank `8862`) |
| `CanvasFrame` | Sandboxed iframe host with postMessage bridge (state mirror, KV, canvas actions) | Inside the canvas | canvas plane WS, `canvas-actions.js` | `web-app.js:8139-8646` |
| **Share canvas dialog** | Tabs **Session access** (deep link, "Hide page chrome" checkbox, "Who can edit inside this app") and **Anyone with link** (mint, rotate or remove a public token) | Canvas header share icon | share-link API | `web-app.js:7878-8072` (`role="dialog"` without `aria-modal`, `7966`) |
| Canvas maximized | The canvas covers the workspace; its controls are portalled into the toolbar's left slot; Esc steps down | Full-screen button | `ui/canvasMaximized` | `web-app.js:8766-8792, 16217-16244` |
| Canvas zen | Chat becomes a rail (260–720px, stored per session); session list and diagnostics hidden | Zen button | `ui/canvasZen`, `canvasPrefs[sid].zenRailPx` | `web-app.js:16218-16221, 16288-16291` |
| **Workspace tab** (`WorkspacePane`) | Session folders: tree with search, upload/new file/new folder/select several/zip download/refresh; CodeMirror editor with find/save; markdown Edit/Preview; git: Changes (staged/unstaged, "since" picker), Commits, commit detail, diff (side-by-side/inline, prev/next change); conflict dialogs (Compare / Keep mine / Take theirs / Keep both; file deleted; file exists; delete; checkout commit) | Canvas pane "Workspace" tab; Manage → Workspace → Files | `transport.sessionWorkspaceFiles`, `listSessionWorkspaceFolders`, etc. Local React state only, not the store | `workspace-pane.js:746-3068` (dialogs `2812-2870`, toolbar `2930-2950`) |
| **Diagnostics column** | Inspector (top) + Activity (bottom), resizable split | Toolbar bug button | `ui/diagnosticsOpen` | `web-app.js:16389-16424` |
| Inspector tabs (icon-only) | Sequence · Logs · Node Map · Duroxide Event History · Files · Stats (Files hidden if the transport cannot browse artifacts) | Click; `m` / ← / → when inspector focused | `selectInspectorTab`, `INSPECTOR_TABS` (`commands.js:10`) | `web-app.js:131-152, 678-682, 8879-8900` |
| — Sequence | Swim-lane sequence lines with turn dividers (expand/select turn) | Tab | `selectInspector`, `sequenceExpandedTurns` | `web-app.js:4312-4436` |
| — Logs | Worker log tail; Tail toggle; Filter dialog | Tab; `t`, `f` | `TOGGLE_LOG_TAIL` (`startLogTail`), `OPEN_LOG_FILTER` | `web-app.js:9476-9492` |
| — Node Map | Workers and sessions; clicking a node scopes the Activity pane | Tab | `selectNodeMapView`, `listWorkers` | `web-app.js:4283-4311` |
| — Duroxide Event History | Execution history; Refresh, Export as artifact, Format dialog | Tab; `r`, `a`, `f` | `REFRESH_EXECUTION_HISTORY`, `EXPORT_EXECUTION_HISTORY`, `OPEN_HISTORY_FORMAT` | `web-app.js:9493-9506` |
| — Files | Artifact list (mark with Cmd/Shift-click; Delete marked, Clear marks), Upload, Download, Copy link, Delete, Open locally, Filter (session / all); preview detaches into the Activity slot | Tab; keys `u`, `a`, `x`, `o`, `f`, `v`, `j/k` | `OPEN_ARTIFACT_UPLOAD`, `DOWNLOAD_SELECTED_FILE`, `DELETE_SELECTED_FILE`, `OPEN_SELECTED_FILE`, `OPEN_FILES_FILTER`, `TOGGLE_FILE_PREVIEW_FULLSCREEN` | `web-app.js:8902-9293` (actions `8990-9070`) |
| — Stats | Session / Fleet / Users views (◉ ⬢ ⚇ icon buttons) | Tab; `f` cycles | `setStatsViewMode`, `getSessionMetricSummary`, `getFleetStats`, `getUserStats` | `web-app.js:9507-9518` |
| Activity pane | Live event stream; doubles as worker details for Node Map | Diagnostics column; phone tab | `selectActivityPane`, `selectWorkerDetailsPane` | `web-app.js:9549-9633` |
| Files fullscreen | Inspector fills the workspace (desktop); full-viewport overlay on phones | `v` in Files | `files.fullscreen` | `web-app.js:16169, 16426-16433, 16509-16511` |
| Resizers | Session↔chat, chat↔right, zen rail, canvas↔diagnostics, inspector↕activity, legacy column; arrow keys on focused seams | Drag; keys `[ ] { }` | `ui/layout*Adjust` | `web-app.js:10910-11500` |

### 1.6 Modal layer (`ModalLayer`, `web-app.js:13415-14052`)

All of these render as `.ps-modal-backdrop > .ps-modal`. Keys are handled globally in
`useKeyboardShortcuts` (`web-app.js:14164-14235`): ↑/↓ (and j/k), Enter, Esc, Tab and
Shift+Tab switch "panes", y/n in confirm.

| Modal type | Purpose | Opened by | Code |
|---|---|---|---|
| `confirm` (17 call sites) | Confirm or alert; destructive styling for delete | Lifecycle, file delete, admin actions… | `web-app.js:13638-13690`, `controller.js` (17 × `type: "confirm"`) |
| `themePicker` | Grouped theme list (VS Code / Retro / Others) + details + "Mobile" checkbox | Toolbar, `Shift+T` | `web-app.js:13692-13697, 13531-13550` |
| `modelPicker` | Step 1 of new session: models grouped by provider | ＋, `n` | `web-app.js:13698-13700`, `controller.js:7489` |
| `reasoningEffortPicker` | Step 2 (skipped if one option) | after model | `web-app.js:13701-13703`, `controller.js:7393` |
| `contextTierPicker` | Step 3 (skipped if one option) | after effort | `web-app.js:13704-13706`, `controller.js:7428` |
| `sessionAgentPicker` | Step 4: agent list with search, sort, usage counts, collapsible package groups | after tier | `web-app.js:13707-13745`, `controller.js:7236` |
| `sessionGroupPicker` / `sessionGroupName` | Move to group / New group name | Folder button, `Ctrl+G` | `web-app.js:13746-13748, 13847-13879` |
| `artifactPicker` ("linked items") | Every `artifact://` and URL in the current chat | **Key `a` only** | `web-app.js:13749-13751, 14321-14324`, `controller.js:5324` |
| `sessionOwnerFilter` | People + "Shared with me" toggles with full-text people search | Filter button | `web-app.js:13752-13812` |
| `renameSession` | Rename (also folders) | `t` in sessions; group Manage | `web-app.js:13814-13846` |
| `sessionWorkspace` | Set the workspace (`root/folder`) | Manage → Workspace → Set… | `web-app.js:13880-13913` |
| `terminatePicker` ("Session Lifecycle") | Regenerate Context / Mark Completed / Cancel Session / Delete Session (bulk and system-restart variants) → then `confirm` | Terminate button | `web-app.js:13914-13968` (inline hex `#94a3b8` at `13934`) |
| `artifactUpload` | Upload by typing a **path** (TUI-style) | Files "Upload" / `u` when the transport only supports path uploads | `web-app.js:13971-13996` |
| `logFilter`, `filesFilter`, `historyFormat` | Two-pane filter / format lists | `f` on the relevant tab | `web-app.js:13998-14050` |
| `DistillerModelPickers` | Model pickers for the regen distiller | Admin | `web-app.js:14053-14115` |
| `ScopedModalLayer` | The same layer bound to an isolated MoA panel controller | MoA panels | `web-app.js:14117-14123` |

Dialogs outside `ModalLayer`: `SessionModifyModal` (`.ps-share-overlay`),
`SessionLinkModal`, `CanvasShareDialog`, `BudgetSheet` (`role="dialog" aria-modal`,
`web-app.js:11693`), `AdminAddPackageDialog` (`web-app.js:15195-15360`),
`CreateProviderSheet`/`EditProviderSheet` (BudgetSheet), MoA `Modal`
(`MoaWorkspace.jsx:253-285`), Workspace-tab `ps-ws-dialog`
(`workspace-pane.js:2812-2862`) and the native `<dialog>` session search
(`web-app.js:6416`).

### 1.7 Budget surface ("Providers & Budgets")

`ProviderBudgetView` (`web-app.js:13094-13413`) **replaces** the workspace under the header.

| Surface | Purpose | Controller / API | Code |
|---|---|---|---|
| Header + Refresh | "Refresh providers and budgets" | `getProviderStatus`, `getProviderUsage*` | `web-app.js:13302` |
| Tabs (`role="tablist"`): Providers · Cluster summary · Agents | The comment says "Two tabs"; there are three. The active tab is read with `controller.getState()` **during render** (not reactive) | `setBudgetTab` | `web-app.js:13397-13411` |
| Providers table | Meters per provider and model, token-kind bars, holds, blocked marker, day chart, system spend | `ProviderTable`, `ProviderDayChart`, `ProviderSystemSpend` | `web-app.js:11809-12168` |
| Edit sheet | Limits / Allowance (admin, shared) / Hold (admin): period, scope (all models / one model), tokens, share per person, hold mode and end time | `setProviderLimit`, `removeProviderLimit`, `setProviderAllowance`, `setProviderHold` | `web-app.js:12170-12454` |
| Create / update provider sheet | Name, type, auth, base URL, access | `CreateProviderSheet` (also used by Admin) | `web-app.js:12456-12593` |
| Cluster summary | KPIs (today / 7d / 30d), providers picker (`role="listbox"`), stacked chart, sparkline | `getProviderUsageSummary` | `web-app.js:12829-13092` |
| Agents | Tokens per day by agent, window segment, include toggles | `getProviderUsageAgents` | `web-app.js:12652-12846` |

### 1.8 Admin console / Settings

`AdminConsolePanel` (`web-app.js:14495-14688`) replaces the workspace. It is the same
panel for everyone; admins get more sections. The toolbar omits it on phones
(`web-app.js:10712-10721`), so its mobile drill-in branch (`14636-14660`) is reachable only
by opening it on desktop and then narrowing the window.

| Section (settings tree, `selectors.js:4865-4883`) | Purpose | Controller / API | Code |
|---|---|---|---|
| Model Providers → My Providers | Personal credentials, My Session Default, Update Key, system-use toggle | `listProviders`, `setMyDefault`, `setCurrentUserGitHubCopilotKey`, `setProviderSystemUse` | `web-app.js:15383-15600` |
| Model Providers → Shared Providers (admin) | Cluster / system defaults, system-agent overrides, distiller models | `setClusterDefault`, `setSystemModelDefault`, `setSystemSessionModel`, `restartSystemSession` | `web-app.js:15438-15600, 14053` |
| Feature flags | Per-user / deployment toggles with drafts | `getMyFeatureFlags` | `feature-flags-panel.js:1-188`, `web-app.js:14504` |
| Packages (tree id `agents`) | Package list (owner chip or "S" shared), "+ Add package"; detail; editors; package file workspace with preview; download `.tgz` | `listAgentPackages`, `uploadAgentPackage`, `setAgentPackageScope`, `getAgentPackageFile`, `saveAgentPackageDownload` | `web-app.js:14753-15360` |
| Workers (admin) | Worker registry | `listWorkers`, `ADMIN_WORKERS_REFRESH` | `web-app.js:14690-14751` |
| Layout | Resizable nav column (`role="separator"`), main, optional package workspace column | local `wsLayout` | `web-app.js:14662-14687` |

### 1.9 Master of Agents (MoA)

`MoaWorkspace.jsx`. Mounted by `App.jsx:737` once the profile has loaded; while it is
active, `PilotSwarmWebApp` is `suspended` (only toolbar + modals render,
`web-app.js:16467-16469`). MoA "active" lives in hook state (`MoaWorkspace.jsx:231`),
not in the store.

| Surface | Purpose | Code |
|---|---|---|
| Dashboard tabs (desktop, portalled into the toolbar flanks) | Up to 5 named dashboards; overflow collapses to a picker; ＋ add; sliders "Dashboard options" (rename, delete with confirm, message-box mode: per-chat vs shared) | `MoaWorkspace.jsx:130-205, 617-690`, `moa.js:2` |
| Status slot | Save status (hidden unless failed: "Save failed · Retry") | `MoaWorkspace.jsx:634`, `web-app.js:16106-16111` |
| Panel tree | Up to 16 panels per dashboard; split right/below; resizable dividers (keyboard arrows, Home/End) | `pane-layout.js`, `MoaWorkspace.jsx:588-610`, `moa.js:3` |
| Empty panel | ＋ "Add first MoA panel"; right-click opens the picker | `MoaWorkspace.jsx:851` |
| Session picker | The shared `SessionPane` in selection mode + "Use chat" / "Use canvas N"; ＋ create a new session inline | `MoaWorkspace.jsx:287-310, 537-576` |
| `LivePanel` | Isolated controller per panel (own transport and subscription); chat or pinned canvas; title-bar status; compact composer (per-chat) or shared composer; focused panel shows split / focus / control-panel buttons | `MoaWorkspace.jsx:311-536` |
| Panel control menu | Session group (manage, trash → lifecycle), details, Panel layout group (replace, split, close) | `MoaWorkspace.jsx:859-900` |
| Pane drag | Drag a title bar: centre swaps, edge splits 50/50, Shift at a T-junction extends; shaded preview; Undo toast | `use-pane-drag.js`, `geometry.js`, `MoaWorkspace.jsx` |
| Toolbar centre | Clear layout (eraser, with confirm), Enter zen | `MoaWorkspace.jsx` (`"Clear MoA layout"`, `"Enter zen"`) |
| MoA zen | Hides header and toolbar; "Exit zen" handle; Esc | `App.jsx:686`, `MoaWorkspace.jsx` |
| Focus panel | Leaves MoA into the normal workspace for that session ("Back to MoA" returns) | `useMoa.returnTo`, `web-app.js:10737` |
| Phone MoA | One panel at a time; minimap ("Panel map"); swipe left/right; dashboard ▼ picker; panel control menu | `MoaWorkspace.jsx` (`"Open panel map"`, `"Switch MoA dashboard"`), `moa.css:139-274` |
| Mobile Zen | Restore control + searchable session picker + transcript + compact composer | `MoaWorkspace.jsx:905-958` |

### 1.10 Phone and compact layouts (≤920px)

| Surface | Purpose | Code |
|---|---|---|
| `MobileWorkspace` | Main pane in three layouts: split (list + chat), chat only, sessions only (+ detail box). Cycled by tapping Main again | `web-app.js:7764-7787, 16486-16491` |
| Diagnostics panes | Inspector, or Activity, full-screen. Node Map stacks inspector + activity | `web-app.js:16440-16447` |
| `MobileCanvasLayer` | The canvas over chat; kept mounted across pane switches; body scroll lock | `web-app.js:7597-7627, 15885-15932, 16459-16465` |
| `MobileArtifactOverlay` | Full-viewport artifact reader with prev/next | `web-app.js:7628-7763, 16509-16511` |
| Keyboard takeover | Hides header and toolbar while the soft keyboard is up and the composer is focused | `web-app.js:7724-7754, 15867`, `index.css:922-935` |
| Visual-viewport height | `--ps-app-height` and `--ps-app-top` from `visualViewport` | `App.jsx:190-221, 943-945` |
| Search overlay | Session search as a modal `<dialog>` | `web-app.js:6416-6427` |
| Admin console | **Not offered** on phones | `web-app.js:10712-10721` |

### 1.11 Keyboard shortcuts actually implemented in the portal

Global `keydown` on `window` (`web-app.js:14125-14437`). Shortcuts are ignored in
inputs and in `[data-own-keys]` regions (`14136-14141`). "Focus region" is a store value
(`FOCUS_REGIONS`, `commands.js:1-8`), not DOM focus.

| Key | Action | Scope | Line |
|---|---|---|---|
| `Shift+T` | Theme picker | global | 14154 |
| `Shift+N` | `preventDefault`, then **nothing** (falls through) | global | 14159-14161 |
| `n` | New session flow | global | 14249 |
| `r` | Refresh | not prompt | 14244 |
| `p` | Focus prompt | global | 14326 |
| `a` | Linked-items picker | global | 14321 |
| `c` / `d` / `Shift+D` | Cancel / Complete / Delete active session (each confirms) | global | 14331-14344 |
| `h` / `l` | Focus left / right region | not prompt | 14431-14440 |
| `[` `]` `{` `}` | Grow left / right pane, shrink / grow session pane | global | 14351-14369 |
| `j/k`, `↑/↓` | Move session / scroll / move file | by region | 14381-14389, 14455-14476 |
| `PageUp/Down`, `Ctrl+U/D` | Page | sessions, desktop | 14396-14419 |
| `g` / `Shift+G` | Top / bottom | desktop | 14421-14429 |
| `t` | Rename session | sessions | 14406 |
| `Ctrl+G` | Move to group | sessions | 14391 |
| `m`, `←/→` | Cycle inspector tab | inspector | 14346, 14371-14380 |
| Files: `u`/`Ctrl+A` upload, `a` download, `x` delete, `o` open locally, `f` filter, `v` fullscreen | | inspector/files | 14252-14294 |
| Logs `t` tail, `f` filter; History `f` format, `r` refresh, `a` export; Stats `f` | | inspector | 14286-14319 |
| `Esc` | Focus sessions; steps down from full screen to zen to normal | desktop | 14477-14484, 16226-16244 |
| `Alt/Option + -` / `+` | View Back / Forward (also in the composer) | desktop | `view-history.js:50-63` |
| Composer: `Enter` send (newline on touch keyboards), `Tab` accept reference, `↑/↓` select queued prompt, `Esc` leave queued edit | | prompt | 10268-10300 |
| Modal: `↑↓ j k`, `Enter`, `Esc`, `Tab`/`Shift+Tab` = pane switch, `y/n` confirm | | modal | 14164-14235 |
| MoA: `Tab`/`Shift+Tab` cycle panels clockwise; `Esc` cancels drag or exits zen | | MoA | `master-of-agents.md:53-58, 148` |
| Workspace tab: `F2` rename, `Delete`, `Ctrl/⌘+F`, `Ctrl/⌘+S`, tree arrows | | Workspace | `workspaces.md:200-212` |

No `?` help overlay, no command palette and no Stop shortcut exist in the portal (the
TUI's `Ctrl+X` is not wired, `docs/user-guide/keybindings.md:13`). `keybindings.md` is
TUI-only (its title, line 1). Portal users have no keyboard reference except a
one-line "many of the TUI keys work" (`portal.md:656-657`).

TUI keys **not** implemented in the portal: `f` (owner filter in sessions), `P`, `v`,
`V`, `Space`, `+ / = / -`, `s`, `e`, `Shift+S`, `Shift+A`, `q`, `Tab` focus cycling,
`Ctrl+T`/`Alt+T` steer, all Admin Console letter keys
(`keybindings.md:29-48, 60-61, 147-170` against `web-app.js:14125-14437`).

### 1.12 Settings and preferences inventory

There is no settings page for display preferences. They are scattered:

| Preference | Where set | Persisted | Code |
|---|---|---|---|
| Theme | Theme picker | Profile (server) | `web-app.js:322-325` |
| Touch scale ("Mobile" checkbox) | Theme picker footer | Profile (`touchScale`, `touchScaleMobile`) | `web-app.js:13531-13550, 341-346, 1015-1022` |
| Sort mode, usage history, manual order, pins, collapsed ids, owner filter | Sessions pane | Profile | `web-app.js:320-372` |
| Pane sizes (`layoutAdjustments`) | Drag seams, `[ ] { }` | Profile | `web-app.js:354-356`, `state.js` |
| Canvas / diagnostics open, side tab, zen, rail width | Toolbar / canvas header | Profile (`desktopPanes`, `canvasPrefs`); per-session per-device `sessionViews` | `state.js:351-356`, `web-app.js:15858` |
| Session detail collapsed, agent-picker usage | Detail box, picker | Profile | `web-app.js:326-340` |
| MoA dashboards, message-box mode | MoA | Profile (`moa`) | `web-app.js:322, 16100-16112` |
| View history | Back/Forward | `sessionStorage`, per account | `use-view-navigation.js:40-48` |
| Workspace-tab view per session | Workspace tab | `localStorage` | `workspace-pane.js:584-660` |
| Phone pane / Main layout | Mobile toolbar | **Not persisted** (React state) | `web-app.js:15759, 15831` |

The profile is polled every 5 s (`PROFILE_SETTINGS_POLL_MS`, `web-app.js:118`) and saved by
effects inside `PilotSwarmWebApp`. Legacy browser-storage keys are migrated
(`web-app.js:120-130`).

### 1.13 Empty, loading and error states (sample of literal copy)

| State | Copy | Code |
|---|---|---|
| Loading gate | "Preparing your workspace" / "Connecting the shared workspace and live session feeds..." | `App.jsx:328-330` |
| Startup failed | "Portal startup failed" + raw error | `App.jsx:328-329` |
| No sessions | "No sessions yet." (no button) | `web-app.js:6338` |
| Search miss | `No sessions matched "<q>".` | `web-app.js:6337` |
| Chat empty / loading | Splash art + "Loading conversation…" footer | `selectors.js:2057`, `e2e/loading-splash.spec.mjs` |
| Older history | "Loading earlier messages…" (`role="status"`) | `web-app.js:7161-7168` |
| Canvas blank | "Nothing on the canvas yet." | `web-app.js:8862` |
| Share link gone | "This canvas link is no longer valid." | `App.jsx:910-913` |
| Preview | "No preview content." / "Loading image preview…" / "Could not load the image preview. Use Download…" / "Loading source…" | `web-app.js:2713, 2945, 3422` |
| Packages | "No packages yet…" / "Loading packages…" / "Loading package…" / "Loading files…" | `web-app.js:14807-14854, 15110` |
| Admin load error | `role="alert"` banner | `web-app.js:14655, 14666` |
| Feature flags | "Loading feature settings…" (`role="status"`) | `feature-flags-panel.js:184` |
| Workspace git | "Loading the changes…", "No commits yet.", "Nothing changed since…" | `workspace-pane.js:2400-2576` |
| Generic action failure | One status string in the header (truncated; no toast; not a live region) | `App.jsx:506-510`, `web-app.js` (`ui/status`) |

---

## 2. Navigation and information architecture

### 2.1 Tree as built

```
/  (single URL; query params only on entry)
├── ?canvasShare=<token> ─────────────── CanvasShareView (no auth, read-only iframe)
└── App gates: Loading → Startup failed | Sign-in (dev personas) | Access denied
    └── PortalWorkspace
        ├── Header  [brand · identity | toolbar slot | version · status · stale-build | sign-out]
        │   └── Toolbar (desktop, portalled)
        │       ├── centre:  New · Filter │ ◀ Back ▶ Forward │ Canvas · Diagnostics
        │       └── right:   Workspace · MoA · Budget · Admin/Settings │ Theme │ Sign-out
        ├── MODE: Workspace  (default)
        │   ├── Sessions column  (full | compact 190px | hidden 48px; hidden in canvas zen)
        │   │   ├── header: Pin · Folder · Manage · Copy link · Terminate
        │   │   ├── list (tree: pinned, folders, system, children)
        │   │   ├── sort modes · refresh · Find a session
        │   │   └── Session details (collapsible)
        │   ├── Chat column  [transcript · outbox strip · composer]
        │   └── Right block (each optional, off by default)
        │       ├── Artifact reader  (takes over the right block)
        │       ├── Side pane: [Canvas | Workspace] tabs
        │       │   ├── Canvas → slots 1–5 · zoom · Share dialog · Zen · Full screen
        │       │   └── Workspace → tree · editor · git (Changes, Commits, diff)
        │       └── Diagnostics: Inspector [Sequence, Logs, Node Map, History, Files, Stats]
        │                         ⇕ Activity (or detached file preview)
        ├── MODE: Budget        [Providers | Cluster summary | Agents]  (+ edit/create sheets)
        ├── MODE: Admin/Settings [Model Providers › Mine/Shared | Feature flags | Packages › … | Workers]
        ├── MODE: MoA           [dashboard tabs ≤5] → panel tree ≤16 → chat | canvas panels
        │   ├── MoA zen (header hidden)
        │   └── Focus panel → Workspace (Back to MoA)
        └── Overlays: ModalLayer (~20 types), Manage session, Link copied, Share canvas, …
```

Phone (≤920px):

```
Header (+ dismissible status row)
Toolbar row: New · Filter · Theme · Canvas · Budget  ║  MoA · Main(cycle) · Diagnostics(toggle)
├── Main: split → chat only → sessions only       (tap Main again to cycle)
├── Diagnostics: Inspector ⇄ Activity              (tap the bug again to flip)
├── Canvas layer over everything (toolbar canvas is the only way in or out)
├── Budget (replaces the content)
├── MoA phone: one panel, minimap, swipe, dashboard ▼
├── Mobile Zen (from the chat header expand icon)
└── no Admin/Settings, no Back/Forward
```

### 2.2 Modes are mutually exclusive flags, not routes

Workspace, Budget, Admin and MoA are separate flags: `ui.budgetOpen`, `admin.visible`,
MoA hook state and the canvas full-screen flag. The toolbar reconciles them
(`web-app.js:10822-10853`; "while the canvas is full screen, any other button first drops
full screen", `10833-10846`). The rule that only one mode is open at a time is enforced in
the controller (`ui/core/test/toolbar-modes.test.mjs:1-10`). The phone pane is a fourth,
separate local state (`web-app.js:15831`).

### 2.3 Back/forward view history

- 10 entries, per tab, per account and site, in `sessionStorage` (`view-history.js:2`,
  `use-view-navigation.js:40-48`).
- An entry captures the mode, session, dashboard and panel, MoA zen, canvas
  open/slot/maximized/zen, diagnostics, and the artifact (`use-view-navigation.js:6-18`,
  `view-history.js:4-16`).
- Only "deliberate destinations" are recorded. Background refresh does not create entries
  (`portal.md:659-664`).
- Desktop only. The phone has no Back/Forward controls or shortcuts
  (`web-app.js:10745`, `portal.md:664`).
- It is **not integrated with browser history**. The browser Back button leaves the app.

### 2.4 Deep links (entry only; never written back while navigating)

`deep-link.js:44-110`:

| Param | Effect |
|---|---|
| `session=<id>` | Select the session; a not-found or not-shared session shows the nav-error state; a session outside current filters shows a notice |
| `artifact=<file>` | Desktop: chat + artifact reader side by side. Phone: full-screen overlay (`App.jsx:666-672`) |
| `view=full` | Artifact full screen |
| `view=canvas`, `slot=N`, `max=1` | Land with the canvas (slot) and optionally maximized (`App.jsx:642-656`) |
| `show_chrome=false` | Chromeless strip; "Show chrome" restores and rewrites the URL (`App.jsx:693-711`) |
| `canvasShare=<token>` | Public read-only viewer (`App.jsx:949-955`) |

Switching sessions never updates `?session=`, so the address bar is stale after the first
click. "Copy link" exists to compensate (`web-app.js:6219-6233`). `document.title` is the
static deployment title (`App.jsx:177-180`) and never names the session.

### 2.5 Zen, maximize, chromeless: three overlapping "focus" concepts

| Name | What it hides | Exit | Code |
|---|---|---|---|
| Canvas **full screen** (maximize) | Everything except the canvas; controls move into the toolbar | Restore button, Esc | `web-app.js:8766-8792, 16217` |
| Canvas **zen** | Session list and diagnostics; chat becomes a rail | Zen button, Esc | `web-app.js:16218-16221` |
| **MoA zen** | Header and MoA toolbar | "Exit zen", Esc | `MoaWorkspace.jsx`, `App.jsx:686` |
| **Mobile zen** | Everything but transcript, composer and picker | Restore control | `MoaWorkspace.jsx:905` |
| **Chromeless** (`show_chrome=false`) | Portal header | "Show chrome" | `App.jsx:583-595` |
| Files **fullscreen** | Workspace replaced by the inspector | `v` / Esc | `web-app.js:16169, 16426` |

---

## 3. State architecture

### 3.1 Layers

```
ui/core (framework-free, shared with the TUI)
  state.js        createInitialState (≈18 top-level slices: branding, docs, auth, ui, connection,
                  sessions, history, outbox, turnControl, orchestration, executionHistory,
                  files, canvas, logs, sessionStats, fleetStats, budget, admin)   state.js:351-847
  store.js        31-line Redux-like store: reducer + Set of listeners          store.js:1-31
  reducer.js      appReducer, 200 action cases (admin/ 59, ui/ 40, sessions/ 22,
                  files/ 21, budget/ 21, canvas/ 9, …)                          reducer.js
  controller.js   PilotSwarmUiController: 380 methods; 117 distinct transport methods;
                  handleCommand switch with 94 UI_COMMANDS cases               controller.js:1713, 11786
  selectors.js    87 exports; most return terminal "lines"/"runs" view models   selectors.js
  commands.js     UI_COMMANDS, FOCUS_REGIONS, INSPECTOR_TABS                    commands.js
  layout.js       character-cell layout (computeLegacyLayout)                   layout.js
  moa.js, session-tree.js, session-sort.js, session-search.js, history.js, formatting.js,
  context-usage.js, canvas-actions.js, native-tasks.js, repo-*.js, portal-links.js, themes/
ui/react
  use-controller-state.js   useControllerSelector(controller, selector, isEqual) over
                            store.subscribe (not useSyncExternalStore)      use-controller-state.js:15-38
  web-app.js                the entire web view layer + web-only effects (profile sync,
                            viewport probe, keyboard, theme → CSS vars)
  components.js + platform.js   the Ink TUI renderer (UiPlatformProvider)    components.js:40, platform.js
web/src
  App.jsx                   auth gates, header, controller + transport construction
  browser-transport.js      HttpApiTransport (/api/v1 + WS) + browser download helpers
  moa/, navigation/         MoA and view history (consume ui-core + ui-react)
```

### 3.2 How React is driven

- `createWebPilotSwarmController({ transport, mode: "remote", branding, docs })`
  (`web-app.js:15675`, called at `App.jsx:603-615`). It builds the store and controller.
  `controller.start({ initialSessionId })` starts polling and subscriptions
  (`App.jsx:629-683`).
- Components subscribe with `useControllerSelector`, 57 call sites in `web-app.js`. Several
  subscribe to **the whole state** (`s => s`): `web-app.js:7133`,
  `MoaWorkspace.jsx:288, 622, 906`. Every dispatch then re-renders those trees.
- Components call `controller.dispatch(...)` directly (86 times in `web-app.js`, 34 in
  MoA) **and** `controller.getState()` in handlers and even during render (32 + 30 times;
  for example the budget tab, `web-app.js:13401-13410`). Actions are therefore typed as
  string literals spread across two layers.
- Components also call `controller.transport.*` directly (37 times in `web-app.js`: session
  access, shares, known users, providers, models, profile settings). `WorkspacePane` keeps
  all of its data in local React state plus transport calls and never touches the store
  (`workspace-pane.js:746-760`).
- Configuration reaches the view through **module-level mutable globals** set from
  `App.jsx`: `portalLinkOrigins`, `portalWorkspaceFiles` (`web-app.js:212-231`,
  `App.jsx:158, 940-942`).
- Layout coupling goes through DOM ids and portals: the header slots and MoA toolbar
  flanks are found with `getElementById`, and polled with `requestAnimationFrame` until
  they exist (`App.jsx:470-479`, `MoaWorkspace.jsx:632-634`).
- The web publishes a **fake terminal size** to the store (`ui/viewport` in character
  cells, from a measured monospace glyph) so that ui-core's width-dependent selectors
  wrap correctly (`web-app.js:15700-15760`). The inspector re-measures and re-dispatches
  per pane (`web-app.js:9440-9470`).

### 3.3 Platform separation

- ui-core contains no DOM access. The `window` / `document` matches are comments or
  variable names (`selectors.js:6459` and similar). It is genuinely host-agnostic.
- ui-core is **not presentation-agnostic**. Selectors emit ANSI color names, `{bold}` /
  `{cyan-fg}` markup and character widths (587 `text:` / `color:` literals in
  `selectors.js`). `selectChatPaneChrome` returns `buildPaneTitleRuns("Chat", "cyan")`.
- ui-react mixes two hosts in one package: `components.js` is Ink-only and
  `web-app.js` is DOM-only. Both are exported from the same `index.js`.
- Web-only policy lives in the view layer rather than ui-core: profile-settings
  normalization and sync (`web-app.js:317-400`), the keyboard map (`14125`), mobile layout
  state, and theme application.

### 3.4 Reusable by a rebuilt frontend

| Keep as is | Keep, but wrap or refactor | Replace |
|---|---|---|
| `store.js`, `reducer.js` slices (sessions, history, outbox, turnControl, canvas, files, budget, admin), `controller.js` data and command methods, `session-tree.js`, `session-sort.js`, `session-search.js`, `moa.js` (dashboard model, `MOA_MAX_*`), `canvas-actions.js`, `native-tasks.js`, `context-usage.js`, `portal-links.js`, `repo-*.js`, `deep-link.js`, `view-history.js` (as a model), `pane-layout.js` + `geometry.js` (MoA layout math, unit-tested), `browser-transport.js`, `use-pane-drag.js` | `selectors.js`: split pure data selectors (rows, access, budget views, admin views, node map VM) from line/run renderers. `useControllerSelector` → `useSyncExternalStore`. `UI_COMMANDS` → typed action creators. Theme palettes → semantic tokens. Profile-settings sync → move into ui-core | `web-app.js`, `index.css`, `moa.css`, `MoaWorkspace.jsx` view code, `layout.js` cell math for the web, the dead TSX tree, `public/` |

`workspace-pane.js` and `workspace-editor.js` (CodeMirror, git UI) are comparatively recent
(2 commits) and self-contained. They are worth porting rather than rewriting.

---

## 4. Styling and theming

### 4.1 Files and size

| File | Lines | `@media` | `@container` | `!important` | hex literals | `font-size: Npx` | `z-index` | theme-specific lines |
|---|---|---|---|---|---|---|---|---|
| `index.css` | 11,112 | 31 | 4 | 63 | 307 | 149 | 34 | 443 |
| `moa.css` | 274 | 3 | 3 | 5 | 29 | 4 | 6 | 17 |
| `compact-view-navigation.css` | 4 | — | — | — | — | — | — | — |

Plus 53 inline `style: {…}` objects and 14 hex literals in `web-app.js` (for example
`#94a3b8` at `web-app.js:13934`), and 8 inline `style=` attributes in
`MoaWorkspace.jsx`.

### 4.2 Tokens

- **Color:** about 35 `--ps-*` variables are set on `:root` **at runtime by JS** from the
  active theme (`applyDocumentTheme`, `web-app.js:1024-1075`). These are page, surface,
  foreground, muted, border, selection, highlight, modal set, accent / success / warning /
  danger (mapped from ANSI cyan / green / yellow / red), and 13 code-syntax roles. CSS
  derives elevation with `color-mix` (`--ps-chrome`, `--ps-chat-card-*`, `--ps-rail`,
  `index.css:1-90`).
- **Type:** three sizes (`--ps-font-size-chat` 14.5px, `-base` 13.5px, `-dense` 12.5px) and
  two line-heights (`index.css:21-35`). They are bypassed by about 50 distinct literal
  sizes, from 9.5px up to 22px: 40 × 12px, 28 × 11px, 15 × 11.5px, 12 × 10px, 8 × 9.5px,
  plus rem and em variants.
- **Font:** the whole UI is monospace (`html, body, #root { font-family: ui-monospace… }`,
  `index.css:129-140`). `--ps-ui-font` exists only in the win95, ms-dos and rust theme
  blocks (`index.css:5514, 5718, 7580`).
- **Spacing:** none. The most frequent literals are 8px (96), 6px (93), 4px (65), 10px (46),
  2px (39), 12px (35), with 7, 5, 3 and 1px also common.
- **Radius:** `--ps-radius-sm` 6px and `-md` 8px, alongside many literal radii (`999px`
  resizers and others).
- **Touch scale:** `:root[data-ps-touch="1"]` raises the type ramp and sets
  `--ps-control-min-height: 44px` (`index.css:676-686`). It is **opt-in** through the
  "Mobile" checkbox in the theme picker.

### 4.3 Themes (20)

Registry: `themes/index.js:22-62`. The default is `workspace-dark`
(`themes/index.js:66`). Groups (`helpers.js:12-16`):

- **VS Code** (10): catppuccin-mocha, cobalt2, dracula, github-dark, github-light,
  gruvbox-dark, hacker-x-matrix, hacker-x-orion-prime, noctis, noctis-obscuro.
- **Retro** (5): doom, ms-dos, terminal-green, winamp, win95.
- **Others** (5): duroxide, high-contrast-mono, rust, spongebob, workspace-dark (the default).

Each theme is an ANSI terminal palette (`page`, `terminal` with 16 colors, `tui` surface
and selection; see `github-light.js:3-62`). Retro themes add extensive per-component CSS
overrides keyed on `:root[data-ps-theme="…"]`: win95 133 lines, ms-dos 81, spongebob 49,
rust 48, doom 46, winamp 46, duroxide 19, workspace-dark 12, terminal-green 6. They also
override MoA in `moa.css`.

Contrast, computed locally from the theme files with the repo's own `contrastRatio`:

- Foreground on surface is at least 9:1 everywhere.
- `muted` equals `border` in most themes, so "muted text" and "hairline" are the same color.
- In noctis and noctis-obscuro, muted text is about 10:1, which is barely distinguishable
  from body text.
- Border on surface is **1.26:1 in the default theme**, 1.45 in github-light and 1.73 in
  rust. Pane boundaries in the default theme do not meet the 3:1 non-text contrast
  guideline (WCAG 1.4.11).

Owner-avatar dark hues switch on the **OS** `prefers-color-scheme`, not the app theme
(`index.css:6521`). A dark app theme on a light OS therefore uses the light-ground hues.

Existing guard tests: every `--ps-*` the CSS reads must be published
(`web/test/theme-tokens.test.mjs:44-106`), and selection text must meet contrast
(`web/test/selection-contrast.test.mjs:76-145`), and code colors must reach 4.5:1
(`code-colors.js`, `ui/core/test/code-colors.test.mjs`).

### 4.4 Breakpoints and responsive model

The JS and CSS breakpoints disagree:

| Source | Value |
|---|---|
| `MOBILE_BREAKPOINT` (phone layout) | 920px (`web-app.js:92`) |
| `PHONE_MEDIA_QUERY` | 600px (`web-app.js:94`) |
| `TOUCH_KEYBOARD_MEDIA_QUERY` | `(hover:none) and (pointer:coarse)` (`web-app.js:97`) |
| Literal `(max-width: 920px)` in JS | `web-app.js:416, 2228, 5445, 15683`, `App.jsx:668` |
| `MOA_BREAKPOINT` | 920 (`moa.js:4`) |
| CSS | 920 (12×), `min-width: 921` (4×), `919.98` (1×), 720 (3×), 640, 620, 600 (3×), 420; `pointer: coarse/fine`; MoA container queries at 330, 640px width and 48px height |

Desktop column sizing mixes character-cell `fr` ratios from `computeLegacyLayout` with
pixel constants (`PORTAL_SESSION_COMPACT_COLUMN_PX` 190, `PORTAL_MIN_CHAT_COLUMN_PX` 224,
canvas and diagnostics default pixels; `web-app.js:100-106, 16246-16253`).

### 4.5 Consistency verdict

The color system is coherent: one palette publishes variables and elevation is derived.
Everything else is ad hoc: type sizes, spacing, radii, z-index and component variants.
`.ps-mini-button`, `.ps-toolbar-button`, `.ps-modal-button`, `.ps-artifact-pane-btn`,
`.ps-canvas-max-btn`, `.portal-secondary-button` and `.ps-ws-*` buttons are separate
families. The retro themes are effectively reskins maintained as hundreds of override
rules, and any redesign must budget for them or deliberately drop them.

---

## 5. UX problems

### 5.1 Discoverability and hidden features

1. **Linked items** (every artifact and URL in the chat) is keyboard-only (`a`,
   `web-app.js:14321`). The user guide says "typically a Linked items affordance… icon or
   sidebar toggle" (`portal.md:360-363`). There isn't one.
2. **Multi-select** has no visible mode. It is Cmd/Ctrl-click and Shift-click only
   (`web-app.js:6060-6085`; macOS Ctrl-click via `onContextMenu`, `4985-4989`). The guide
   promises "a checkbox toggle or a 'select mode' button" (`portal.md:226-229, 299, 651`).
   `TOGGLE_SELECT_MODE` is never dispatched by the web.
3. **Expand or collapse a parent** happens by clicking a row that is *already active*
   (`web-app.js:6056`). There is no chevron button and no `aria-expanded`.
4. **No context menus.** The guide says "Right-click … to rename" and "Row menu → Rename /
   Pin / Cancel" (`portal.md:117-118, 645-650`). Session rows have no right-click menu
   (`web-app.js:4985-4989` only handles Ctrl-click). MoA panels do have one
   (`MoaWorkspace.jsx:790`), which is inconsistent.
5. **Sharing is buried.** The guide says "open the **Share** button in the Sessions pane
   toolbar → Share & settings" (`portal.md:251-254, 649`). In reality it is the wrench
   **Manage** button → **Access** tab (`web-app.js:6195-6218, 6962-6963`).
6. **Diagnostics are off by default** and behind a bug icon (`web-app.js:10699-10711`).
   The guide's "Layout overview" still describes "three panes … Inspector — right column"
   (`portal.md:65-75`), and Scenario 6 is built around inspector tabs that a new user
   cannot see.
7. **Icon-only everything.** Inspector tabs, toolbar, sort modes and canvas controls are
   all icons with hover or long-press tooltips (`web-app.js:8879-8899, 10624-10626`).
   Glyphs such as ◉ ⬢ ⚇ (stats), ⇣ ■ (tail), ⇩ (export) and ↻ are not self-explanatory
   (`web-app.js:9476-9518`).
8. **Touch scale** ("Mobile" checkbox) hides in the theme picker footer
   (`web-app.js:13531-13550`). Phone users get 44px targets only if they find it.
9. **Ask-user choices are not clickable.** Choices render as a bullet list and the user is
   told to "Reply with one of the choices above in the prompt below"
   (`selectors.js:1729-1745`).
10. **Copy link opens a modal** after every copy (`web-app.js:6226-6231, 6446-6471`). It is
    a toast presented as a dialog.
11. **Keyboard reference.** There is no in-app help (`OPEN_HELP` has no web renderer) and
    no portal keybinding doc.

### 5.2 Overloaded or confusing controls

1. **Header toolbar density.** Desktop shows 11 controls plus status, version and stale
   build in one bar (`web-app.js:10822-10880`). Theme, a rare action, sits in the
   permanent right cluster next to the mode switches.
2. **Phone "Main" button** cycles three hidden layouts with one glyph
   (`web-app.js:10781-10790`), and the **phone Diagnostics** button flips between two panes
   (`10791-10803`). The state lives only in tooltips.
3. **New session is a chain of up to four modals:** model → reasoning effort → context
   tier → agent (`controller.js:7236-7491, 9180-9231`). There is no single form and no
   summary of choices.
4. **Lifecycle is two steps with shifting vocabulary.** Terminate (icon) → "Session
   Lifecycle" dialog → Regenerate Context / Mark Completed / Cancel Session / Delete Session
   → confirm (`web-app.js:13914-13968`). Regenerate also lives in Manage → Context
   (`web-app.js:7033-7043`). A code comment says it "moved to Manage session"
   (`web-app.js:6725`), yet it is still in the picker.
5. **Provider management is split** between Settings → Model Providers (create, update key,
   defaults) and Budget → Providers (limits, allowance, hold, create sheet), with shared
   sheets (`web-app.js:14585-14633, 13230, 12456`).
6. **Two upload paths with different rules.** The composer attaches images only
   (`web-app.js:10321, 10334`). Files → Upload takes any file, or a typed **path** on some
   transports (`web-app.js:13971-13996`). The guide promises a paperclip that takes any file
   (`portal.md:337-345`).
7. **Six "focus" modes** (§2.5), each with its own name, glyph and exit.

### 5.3 Modal overuse and inconsistency

- About 20 `ModalLayer` types, plus Manage session, Link copied, Share canvas, Budget
  sheets, Add package, Create provider, MoA dialogs, Workspace-tab dialogs and the
  `<dialog>` search. That is at least 6 dialog implementations, each with its own backdrop
  class (`.ps-modal-backdrop`, `.ps-share-overlay`, `.ps-budget-sheet`,
  `.ps-moa-backdrop`, `.ps-ws-dialog`, native `dialog`).
- Two-pane "list + details" modals are used for simple choices (theme, filters, model)
  (`web-app.js:13552-13636`).

### 5.4 Terminology

| Concept | Names used |
|---|---|
| The sessions/chat view | "Workspace" mode (`OPEN_WORKSPACE`), tooltip "Sessions — session list, chat and panels" (`web-app.js:10729`), "Main" on phone; `.ps-workspace` CSS. **Also** "Workspace" = session folders tab (`web-app.js:8647-8663`) **and** admin package "workspace" (`15062`) **and** "Preparing your workspace" (`App.jsx:328`) |
| Settings | "Admin console" (admins) vs "Settings" (users), same panel (`web-app.js:10606-10617`); history label always "Settings" (`use-view-navigation.js:21`); guide: "Admin / settings menu" |
| Session grouping | "group", "folder", "🗂", "Move to a group", "Rename folder", "New group" (`web-app.js:6181-6215`) |
| Ending a session | Terminate, Session Lifecycle, Mark Completed, Complete, Done (`d`), Cancel, Delete, Hard Delete, Restart (`web-app.js:6234-6246, 13914-13968`, `portal.md:304-310`) |
| Inspector | "Diagnostics" (toolbar) = Inspector + Activity; the tab "Duroxide Event History" is "history" in docs (`web-app.js:135`, `portal.md:393`) |
| Packages | Settings tree id `agents`, label "Packages" (`selectors.js:4870`); TUI "Agent Packages" |
| Artifacts | Files, artifacts, linked items, artifact reader, preview |
| MoA | Master of Agents, MoA, dashboards, panels/panes (the guide uses both) |
| Zen | Canvas zen, MoA zen, mobile zen (three different behaviors) |

### 5.5 Accessibility

1. **Dialogs.** `ModalLayer` dialogs have no `role="dialog"`, `aria-modal`, labelled title,
   focus trap or focus restore (`web-app.js:13611-14006`; only 2 `role: "dialog"` in the
   file, `7966`, `11693`). The global handler hijacks **Tab** inside modals for "pane
   next/prev" (`14176-14184`), so Tab cannot reach the footer buttons in the normal order.
   The MoA `Modal` (`MoaWorkspace.jsx:253-285`) is the in-repo pattern to copy.
2. **Single-character global shortcuts** with no modifier and no off switch: `c` cancel,
   `d` complete, `Shift+D` delete, `n`, `r`, `a`, `p`, `[ ] { }`
   (`web-app.js:14244-14369`). This fails WCAG 2.1.4 (Character Key Shortcuts). Speech
   input users can trigger destructive confirms.
3. **Pinch zoom is disabled:** `maximum-scale=1` in the viewport meta (`index.html:5`).
   This fails WCAG 1.4.4 (Resize text).
4. **Session tree semantics.** Rows are `<button aria-selected>`, which is invalid on a
   button. There is no `role="tree"`/`treeitem`, no `aria-level` and no `aria-expanded`.
   Roving `tabIndex` is used (`web-app.js:4949-4959`). Nesting is visual only.
5. **Panels are unnamed regions.** `Panel` renders `<section>` with a non-heading title div
   (`web-app.js:4244-4280`). There are no landmarks besides header, main and the toolbar
   `navigation`.
6. **Live regions.** The whole chat scroll body is `aria-live="polite"`
   (`web-app.js:4549, 7418`), so streaming output will be very noisy for screen readers.
   The header status text, which carries errors, is not a live region (`App.jsx:506-510`).
7. **Composer has no accessible name** beyond the placeholder (`web-app.js:10236-10262`).
8. **Focus visibility.** 17 `outline: none/0` rules (`index.css:1154-10455`). Several
   replace the outline with a border or box-shadow, but `.ps-artifact-pane:focus`,
   `.ps-manage-tab:focus` and the rust and spongebob composer `:focus` rules rely on subtle
   color changes (`index.css:2983, 4697, 7709, 7897`).
9. **Low non-text contrast** for pane borders in the default theme (1.26:1, §4.3). Tiny type
   (9.5–11px) appears in many places (§4.2).
10. **Tooltips** are hover-delay or long-press only. The `role="tooltip"` element is not
    linked to its button with `aria-describedby` (`web-app.js:10563-10589`); the button does
    carry `aria-label`. Icon-only controls rely on these tooltips for meaning.
11. **Reduced motion** is honored only in 4 places (`index.css:942, 2629, 6988, 9096`).
12. **No automated accessibility tests:** 0 axe usages in 59 Playwright specs.

### 5.6 Mobile

1. Settings / Admin console is unavailable on phones (`web-app.js:10712-10721`). A user
   whose provider key expires cannot fix it from a phone. Budget is available.
2. There is no back navigation on mobile (§2.3). Pane state is not persisted and not
   linkable (`web-app.js:15759, 15831`).
3. The canvas toggle is the **only** way out of the phone canvas (`web-app.js:10649-10654`).
4. Hit targets are small unless touch scale is on (`index.css:676-686`). Long-press is
   needed to learn what icons mean.
5. On a touch keyboard, `Enter` inserts a newline and only the Send button sends
   (`web-app.js:10244-10247, 10296`). This is reasonable, but it differs from desktop.
6. Doc drift: "collapses panes into a stack you swipe between" (`portal.md:74-75, 670`)
   and "on mobile, swipe" for inspector tabs (`portal.md:644`). Swipe navigation exists
   only in MoA phone mode; the workspace uses toolbar cycles.
7. Breakpoint disagreement: 920 (JS and CSS) vs 600 (phone composer, outbox) vs CSS 720,
   640, 620 and 420 (§4.4). Tablets between 600 and 920 get phone navigation with
   desktop-ish composer behavior.

### 5.7 Doc and code drift (user guide claims with no matching UI)

| Claim | Reality |
|---|---|
| Summary / Chat toggle "in the top toolbar" (`portal.md:653`) | Not in the toolbar defs (`web-app.js:10627-10752`). A comment still says the toggle "lives on the top toolbar" (`7397-7398`) |
| "Admin / settings menu → Model Providers" (`portal.md:654`) | A single cog button; no menu |
| "New (top-left of the Sessions pane)" (`portal.md:90, 636`) | ＋ is in the header centre cluster |
| Steer via `Ctrl+T` (keybindings) | TUI only |

---

## 6. Code-health risks for the redesign

1. **Giant files.** `web-app.js` is 16,516 lines and holds 145 components, 119 `useEffect`
   / `useLayoutEffect`, 119 `useState` and 6 portals. With `controller.js` (12,139),
   `index.css` (11,112), `selectors.js` (9,775) and `reducer.js` (4,495) that is 54k lines
   in 5 files. They are hotspots: `web-app.js` and `index.css` each had 64 commits since
   2026-08-01; `controller.js` 36, `selectors.js` 39, `reducer.js` 32.
2. **No types or JSX in the live view.** Everything uses `React.createElement` in `.js`. MoA
   is JSX but extremely dense: 62 lines over 200 characters, with a maximum of 1,435 (for
   example `MoaWorkspace.jsx:790`).
3. **Layer leaks.** Component → `controller.transport` (37 calls). Component →
   `controller.getState()` during render. Module-global config. DOM-id portal slots
   discovered by polling. Profile persistence inside a view component.
4. **Terminal-shaped view models.** Presentation selectors emit color names and fixed
   character widths, and the web fakes a terminal viewport. Any non-monospace or
   proportional design breaks wrapping assumptions such as `contentWidth` and
   `getPortalInspectorContentWidth`.
5. **Per-render work.** Whole-state subscriptions in MoA and `web-app.js:7133`. A custom
   `useControllerSelector` with `useState` + `subscribe`, not `useSyncExternalStore`, is
   prone to tearing under concurrent rendering (inference).
6. **Dead code** (§0.2) inflates the surface and misleads: the TSX tree looks like the app
   but is not.
7. **CSS coupling.** Global class names (`ps-*`) are shared by the TUI-derived line renderer
   and the newer widgets. 443 theme-override lines depend on exact DOM structure, so any
   markup change silently breaks retro themes. `:has()` selectors drive layout
   (`index.css:927-935`).
8. **Tests.**
   - `ui/core/test`: 111 files, about 17k lines. Mostly reducer, controller and selector
     tests. 15 import ui-react; `app-render-smoke.test.mjs` server-renders components to
     catch render crashes (`app-render-smoke.test.mjs:1-12`). About 10 tests `readFileSync`
     the source and regex it (`active-row-reveal`, `manage-button-affordance`,
     `touch-scale`, `session-drag-gestures`, …), which ties them to file layout and will
     break on any rewrite.
   - `web/test`: 22 files, about 3.5k lines. Router, auth/security, MoA geometry, view
     history, theme tokens, selection contrast, build freshness.
   - `web/test/e2e`: 59 Playwright specs, about 13.5k lines, against a hermetic stub
     server (`stub-server.mjs`, 337 lines). They assert computed styles and geometry, with
     no screenshots (`playwright.config.mjs:3-6`), including mobile, toolbar fit, MoA,
     history and composer. They are **not in CI** (`.github/workflows/pr-checks.yml:85`
     runs only `npm test --workspace=pilotswarm`; no workflow mentions Playwright or
     `test:e2e`). The suite asserts selectors like `.ps-toolbar-button`, so it will need
     to be rewritten alongside the UI. Its stub server and scenarios are the most reusable
     part.
   - No accessibility or axe tests, no visual regression baselines, and no component-level
     interaction tests outside Playwright.
9. **Shared TUI coupling.** `components.js` (TUI) and `web-app.js` both consume the same
   selectors, so changing selector shapes for the web breaks the Ink TUI. A redesign
   should add new web view-model selectors next to the TUI's rather than mutate shared ones.
10. **Feature gating is scattered.** `sessions.steering`, `portal.workspaceFiles`,
    transport capability probes (`supportsArtifactBrowser`, `supportsPathArtifactUploads`,
    `supportsPromptImageAttachments`) and admin-only rows are checked inline in components
    (`web-app.js:163-180, 226, 10037`).

## 7. Inputs for the redesign (derived from the above)

- The data and command layer (store, reducer, controller, transport) is reusable. Wrap it
  behind typed hooks and actions, and add URL routes over it: `/s/:id`, canvas slot,
  artifact, `/budget`, `/settings/*`, `/boards/:id`. Retire the custom view history.
- Write new web view-model selectors (pure data) instead of reusing line/run selectors.
  Keep `selectChatLines` structured-block building only where it already produces typed
  blocks (`buildStructuredBlocks` output in `web-app.js:4085-4243`).
- Inventory to preserve (each needs a visible, non-keyboard path): linked items,
  multi-select, expand/collapse, move to group, lifecycle actions, history export, log
  tail and filter, files filter, touch scale, sharing.
- Consolidate: one dialog primitive (MoA `Modal` behavior), one button family, one
  breakpoint set, semantic tokens for type, space, radius and elevation, one provider
  management surface, one "focus" concept, one name for "workspace".
- Add accessibility and visual gates to CI (Playwright + axe), and put the existing e2e
  suite in CI before rewriting it, so parity can be measured.
