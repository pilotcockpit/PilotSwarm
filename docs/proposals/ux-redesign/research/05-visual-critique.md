# 05 — Visual critique and direction

Status: research, 2026-10-30. Part of the portal UX redesign. It pairs with
[`../frontend-stack.md`](../frontend-stack.md), which picks Tailwind v4, Lucide, React Flow and cmdk.

**Method.** I followed two skills. From `design-taste-frontend` I used the app-screens run: the
inspector and lint in `--app` mode, and a dealt style for each of the three directions. From
a design-critique skill I used critique mode: Nielsen scoring, persona walk-throughs and the detector with a
live overlay. The detector pass (Assessment B) ran in an isolated sub-agent. I ran the design review
(Assessment A) in this context. Partial degradation: B's results came back before A was finished,
so A is not fully unanchored. I did not save the critique snapshot,
because the brief limits writes to this research folder.

**Evidence.** The original captures are `screens/d01..d13` and `m01` (see `capture-log.txt`). I added
these, all at 1440×900 against `localhost:3001` with no LLM credentials:

| File | What |
|---|---|
| `d20-session-tree-expanded.png` | Session list squeezed by an open canvas and an open inspector |
| `d21-inspector-logs.png` … `d25-inspector-stats.png` | Inspector tabs: Logs, Node Map, Duroxide Event History, Files, Stats |
| `d26-session-details.png` | Same state with the canvas hidden (no details drawer appeared) |
| `d27-moa-add-panel.png` | MoA "add panel" session picker |
| `d30-theme-github-light.png`, `d31-theme-win95.png`, `d32-theme-duroxide.png` | The same screen in three themes. The theme was restored to Workspace Dark afterwards. |

**Measurements I relied on:**

- **Detector, CLI.** The CLI found 15 `side-tab` findings. About 7 are true positives.
- **Detector, live overlay.**
  - Home: 10px text, a 3.9:1 placeholder, tight leading and 4 nested cards.
  - Admin: 2.4:1 disabled text and a flat type ratio of 1.13.
- **Taste inspector `--app`.** 6 FAIL, 3 WARN:
  - Emoji used as icons.
  - A radial-gradient shell.
  - Text under 11px.
  - No h1.
  - Micro-labels.
  - Text against the screen edge.
  - 11 icons in tinted squares.
  - A 595px blank band in the session list.
- **Taste lint `--app`.** 56 FAIL and 141 WARN.
- **`index.css` statistics.**
  - 11,112 lines, with 315 `font-size` declarations across 15 px values, including 8.5, 9, 9.5, 10 and 10.5.
  - 10 border radii, 92 `box-shadow`, 38 `text-transform: uppercase` and 63 `!important`.
  - 142 unique hex colours, despite the token layer.
  - 443 `[data-ps-theme=…]` overrides.

**Limits.** No agent turn can complete, so I never saw a real transcript, a tool call, a sub-agent tree
with live children, a canvas app or a populated board rendered. I critiqued those surfaces from their CSS
(`.ps-chat-call`, `.ps-activity-run`, `.ps-native-task*`, `moa.css`) and say so where it applies. Session `06760567` in later captures was created by a parallel research
pass (`flow-new-session-*.png`), not by this one.

**Shared state.** Theme preference is shared portal state. I switched themes at about 00:42 and restored
Workspace Dark. Captures taken around then by other passes (`theme-*.png`) may overlap with mine.

---

## 0. Verdict in one paragraph

The portal is not the usual AI SaaS template, and that is to its credit. It is a faithful port of a
terminal UI: one monospace stack for everything, the 16-colour ANSI palette as the colour system, ASCII
art, `[x]` checkboxes, `[+4]` brackets, `▸` disclosures, `YOU` prompts and fieldset boxes drawn around
`STATS`. That fidelity gives it real identity, and it is also why the browser version is hard to work in.
Prose is set in a code face. Colour is spent on decoration instead of status. Every destination is an
unlabelled 44px icon square. The product's actual superpower, durable execution with replayable
histories, timers and sub-agent trees, is shown as raw text dumps. The fix is not "make it a SaaS
dashboard". Keep the instrument-panel soul and give it real typography, a status-only colour budget and
a visible spine for durable execution.

**Design health: 18/40 (Poor band).** The functional depth would score Good. The visual system and
information architecture pull it down.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Running and connected states exist but are shown as 10–11px text (`Connected` under the version pill, `(running)` in the footer strip). Turn failures appear as raw activity errors (d01). |
| 2 | Match system / real world | 2 | `orch`, `h16 · q0 · kv0`, `session.affinity_released`, `MoA`, `[current session v7]` are internals shown as UI (d05, d25). |
| 3 | User control and freedom | 3 | Back/forward history, Esc everywhere, and a theme preview that you can cancel (d08). |
| 4 | Consistency and standards | 1 | Three different splash renderings (d01/d04/d27). The selection colour is blue, gold, purple, cyan or light-blue fill depending on the surface. Tabs come in four styles (d07, d12-2, d05, d06). |
| 5 | Error prevention | 2 | Terminate (trash) sits in the same 5-button strip as pin and link (desktop-fold). Feature flags use a Save/Discard model while other admin views act instantly. |
| 6 | Recognition rather than recall | 1 | 11 header icons, 6 inspector icons, 5 list-action icons and 4 sort icons, all unlabelled (d01, d05). |
| 7 | Flexibility and efficiency | 3 | Number keys in the Node Map, Option+arrow history, slash commands, MoA layouts and 20 themes. |
| 8 | Aesthetic and minimalist design | 1 | The ANSI rainbow, the ASCII wordmark over every empty session, boxes in boxes, and a 10–15.8px size soup. |
| 9 | Error recovery | 1 | `Activity 'runTurnV4' JS execution failed: GenericFailure…` and a list of env-var names. There is no plain sentence and no "Configure provider" action (d01, d05). |
| 10 | Help and documentation | 2 | Admin helper copy and the canvas empty state are good. Nothing explains a sub-agent, a board or a durable timer. |

**Cognitive load: 5 of 8 checks fail.** The failures are single focus, visual hierarchy, minimal
choices, recognition and progressive disclosure. The header alone offers 13 equal-weight choices.

---

## 1. Critique per surface

### 1.1 Shell and header (d01, d04, d05, d20, desktop-fold)

**Hierarchy**

- The brand slot reads `PILOTSWARM / Auth disabled`. A deployment's auth mode takes the subtitle slot that should name the scope (cluster, workspace, environment) (d01).
- The connection state is an 11px `Connected` tucked under a `v0.8.7` pill. It is the most important system status in an operator tool and it gets the least weight.
- The primary job, starting a session, is a `+` square with the same weight as Filter, Back and Theme.

**Navigation mixed with toggles**

- The right cluster mixes four destinations (Sessions, Master of Agents, Budget, Admin) with one preference (Theme).
- The centre cluster mixes actions (new session, filter), history (back/forward) and pane toggles (canvas, diagnostics).
- All 13 are identical 44px rounded squares with a 1px border. The inspector counts 11 icons in tinted squares, a top tell of generated dashboards.
- The active destination is told apart only by a blue outline.

**Ornament**

- The shell has a radial-gradient glow (`.portal-app-shell`, inspector FAIL).
- The header uses `backdrop-filter: blur(20px)` and the gate card has a `blur(18px)` glass card (lint `glass`). The palette is already opaque, so the blur adds nothing.

**Layout under load**

- With the canvas and diagnostics open, the session list collapses to about 100px. Names truncate to `PilotS` and `Pilo…`, and the list toolbar wraps onto three rows (d05, d20).
- The index of everything you operate becomes the first casualty.
- There is no rule that folds the list to a rail with status glyphs before it gets unreadable.

**Glyphs as icons**

- `⚙`, `📎` and `❯` are text glyphs and emoji standing in for icons (inspector `emoji` FAIL). They render differently per OS and do not inherit stroke weight.

### 1.2 Session list and sub-agent tree (d01, d20, d27, m01)

**The tree is the product's core idea, and it is hidden**

- Sub-agents collapse into a cyan `[+4]` suffix. Clicking it in my test did not expand anything.
- No indentation rails, no per-child status and no way to see the shape of the swarm (d20).

**Row grammar is terminal shorthand**

- A row reads `⚙ PilotSwarm [+4] —`.
- The em dash stands for "no status". The gear means "system". The gold text means "system" again.
- The selected row gets a gold 1px outline and a gold tint (d01). Elsewhere, selection is blue (d02), purple (d05 inspector tab) or a light-blue fill (d06 MoA tab).

**Colour carries no stable meaning**

- Gold means system session.
- Cyan means a count.
- Green means the model name (d27: `claude-opus-5:medium` in green), and green also means ready.
- An operator cannot learn "green = healthy" because green is also a label colour.

**Actions are disconnected from rows**

- A 5-icon strip above the list acts on the selected session: pin, group, manage, link, terminate.
- It puts a destructive action at the same weight as Copy link (desktop-fold).
- For system sessions the strip changes meaning, to `Restart this system session`, with no visual change.

**Controls in the wrong place**

- Search sits at the bottom of the list (`Find a session…`), below the sort toggles.
- Under it, a details strip reads `▸ — 11s ago (running)`.
- Search belongs at the top, where the eye starts, and the details strip duplicates the row.

**Empty space**

- The list panel has a 595px blank band (inspector `panel-void`). The same frame either starves (d20) or sprawls (d01).

### 1.3 Chat and transcript (d01, d04, d05, d10, m01, plus CSS)

**Splash**

- An empty session shows the ASCII wordmark, about 300px tall, over the transcript.
- It has three different renderings depending on width: 7-colour block letters (d01), green pixel letters (d04) and ASCII box-drawing (d27).
- Under it, an 8-colour tagline row (`Agents · Infrastructure · Maintenance · Monitoring / Spawn · Steer · Sweep · Scale`) and an instruction about the UI ("Start interacting with this session to replace the splash screen").
- It is charming once. On the twentieth new session it is 300px of noise above the composer.

**Typography of prose**

- Agent replies are long-form reading, and they are set in `ui-monospace` at 14.5px with `line-height: 1.24rem` (about 1.28).
- The detector flags the leading as tight.
- Mono prose runs about 15–20% more characters per line, wraps sooner, and turns identifiers into ragged walls. In d05 the warning card wraps one sentence into 14 lines.

**Errors**

- The failure is shown as `WARNING 00:32:43` over the raw activity message, retry count included (d01).
- The same error appears again in the Activity pane as escaped JSON (`\"anthrop...`, d05).
- No plain sentence, no owner ("provider anthropic-wif can't authenticate") and no action ("Open provider settings").
- Worse, a parallel pass's capture shows a first prompt that failed and then settled to `idle`. The
  transcript went back to the bare splash, with no user message and no error
  (`flow-error-session-settled.png`). The only trace of the failure is in the Activity pane.

**Composer**

- A 10px uppercase `YOU` label, terminal prompt cosplay, sits beside the input.
- The placeholder is 3.9:1 (detector). The send button is a `❯` glyph.
- The model and agent the message will go to are not shown at the composer. They live in the truncated session row (`claude-o…`).
- In the three-column state the composer is about 200px wide and the placeholder wraps (d10).
- Typing `/` showed no visible menu in d10 at that width. The `SlashCommandMenu` uses a Tailwind `shadow-lg` and `font-mono` from a parallel `.tsx` tree.

**Tool calls and activity runs (CSS only, not rendered)**

- The structure is thoughtful. Consecutive calls group into one `.ps-activity-run` card with a latest-call preview, a chevron and a capped scroll viewport. Native tasks get tabular-figure meta. Comments explain every decision.
- The visual grammar is still text glyphs:
  - `▸`/`▾` set through `content:`.
  - A `.82em` uppercase tag.
  - The status in muted text.
  - The payload as `pre-wrap` mono with a 2px left rule.
- Nothing tells a `bash` call from a `spawn_agent` call at a glance.
- Nothing puts duration in a right-aligned column.
- Nothing shows the parent/child link when a call spawns a sub-agent.

### 1.4 Canvas (d04, d05)

**Good**

- The empty state is one of the best moments in the product: "Nothing on the canvas yet. Ask the agent to draw — a dashboard, a chart, a diagram — or it will draw when it has something worth showing." It is quiet, centred and tells you what the surface is for. Keep the copy.

**Weak**

- The pane header is a lone monitor icon with two unlabelled controls. When a canvas exists, nothing says which agent drew it, when, or that it runs sandboxed.
- The canvas pane is visually identical to the inspector pane, so a drawn app does not read as an artifact.

### 1.5 Inspector and diagnostics (d05, d21–d25)

**Tabs**

- Six icon-only tabs: Sequence, Logs, Node Map, History, Files and Stats.
- The active tab gets a purple outline, which is not the accent used anywhere else.
- Tooltips are the only labels (d22 shows one overlapping the content).

**Sequence (d05)**

- It is a CSS-drawn ASCII fieldset (`┌ STATS ┐` with `v1.0.82 · h16 · 10.0 KB · q0 · kv0`), a `TIME orch` header underlined with literal `--------`, and one truncated log line.

**Node Map (d22)**

- It is not a map. It is a numbered list (`1 ● cal-0 ready default 1 se…`) clipped at the pane's right edge.
- The worker detail below is a good key-value block. Its `Memory` value wraps into the label column.
- The `EXECUTING (1)` label is uppercase cyan with a full-width blue bar.

**History (d23)**

- This is the most valuable view in the product: the Duroxide event history.
- It is shown as `#1 07:33:28.310 OrchestrationStarted` followed by indented YAML-ish keys and truncated JSON input.
- No timeline, no grouping of schedule→complete pairs, no visual for timers or retries.
- This is where PilotSwarm differs from every other agent console, and it reads like `kubectl describe`.

**Stats (d25)**

- Cyan labels, a `TOKENS` ASCII box, `Hit Ratio —`, and `Created Oct 30, 2026, 12:32:4…` truncated mid-timestamp.

**Activity pane**

- Raw event lines (`[session.affinity_released] {"error":…}`) with escaped quotes and no level, colour or filter.
- The pane title `ACTIVITY [CURRENT SESSION V7]` exposes an internal version counter.

**Logs (d21)**

- Honest about being disabled ("no K8S_CONTEXT/KUBECONFIG…") but in orange body text with no link to setup.

### 1.6 Master of Agents board (d06, d27)

**Empty board (d06)**

- 1,400×780px of near-black with a 54px dashed `+` in the centre and a panel titled `Empty panel`.
- The panel border is 2px, mixed 35% toward the foreground: the heaviest line in the app on its emptiest screen.
- The only light element is the `MoA 1` tab, a light-blue fill used nowhere else.

**Toolbar**

- Eraser, back, forward and fullscreen, all unlabelled.
- The eraser meaning "clear layout" is undiscoverable.

**Add panel (d27)**

- It reuses the whole session list inside a modal, leaving about 600px empty.
- The confirm control is a grey checkmark icon next to a `Show: Session chat` select, which is easy to miss.

**Naming**

- "Master of Agents" / "MoA" is jargon. The concept is a board or wall of live sessions.

### 1.7 Budget (d07)

**Header**

- A circled ring icon beside `Providers & Budgets Usage and limits` on a faint gradient header band.

**Table**

- A grouped cyan `MY SPEND` header over uppercase tracked `DAY / WEEK / MONTH` headers and an uppercase `SHARED` pill.
- Uppercase tracked headers are the tell the app-screen study flags as louder than the data.
- Values read `0 / ∞`. Infinity for "no limit" is clever and reads like an error or a division bug. Write `No limit`.

**Frame**

- The table stops at 1,068px and leaves 360px dead on the right.
- `No provider selected` beside a wrench in a box is a detail-pane affordance with no visible selection model.

### 1.8 Admin console (d11, d12-1…5, d13)

**Best surface**

- This is the best-composed surface. It has a labelled settings sidebar, real tables and plain-language state.
- Workers (d12-4) is the strongest screen in the product:
  - A real table.
  - `—` for a missing p99.
  - Pale `ready` pills.
  - A `4 live / 4 registered` subline.
- Feature flags copy is excellent: "Off for you. Following the cluster setting. Cluster setting: Off. Personal settings allowed."

**Nesting**

- Page ground → `Admin Console` card → settings frame → panel → card: four nested frames (detector `nested-cards`).
- The `Admin Console` h-title and `Unrestricted admin access` take a full 70px row to say where you are.

**Type**

- The scale is flat. The detector measured body 14.9 / h4 15.5 / h3 17.2 / h2 19.4px, a largest adjacent step of 1.13.
- The 9.5px uppercase sub-labels `SHARED 0` / `USER 0` fall below the 11px floor.

**Buttons**

- `Add provider` (d11) is the only white-filled, black-text button in the app.
- `Refresh settings`, tabs and radio pills are all 1px-bordered boxes of similar weight (d12-2).
- Disabled `Save changes` / `Discard changes` are 2.4:1 (detector).

**Width**

- My Providers sits in a 624px column next to 480px of nothing (d11).

**Form (d13)**

- Uppercase micro-labels (`NAME`, `TYPE`, `GITHUB COPILOT TOKEN`) and 11px helper text.
- The name placeholder `azure-prod` is wrong for a GitHub Copilot provider.

### 1.9 Modals (d02, d03, d08)

**Keep**

- A consistent two-column modal grammar: list on the left, details on the right, keyboard legend (`Space toggle  Esc close`).
- The theme preview with apply and cancel is a real interaction design.

**Problems**

- **Terminal idioms:**
  - The filter's checkboxes are the text `[x]` and `[ ]` (d03).
  - The theme list says `Workspace Dark [current]`.
  - Models read `· claude-opus-5 [high]`.
- **Duplication:** the model picker repeats the provider id (`anthropic-wif (anthropic-wif)`).
- **Model details:** cost and reasoning are strings (`Cost: high`). A scale glyph would let you compare four models at a glance (d02).
- **Empty space:** every modal is fixed at about 900×630, so short lists leave 250–400px empty (d02, d03).
- **Stray control:** a `Mobile` checkbox inside the theme picker (d08).

### 1.10 Mobile (m01)

**Good**

- The composer is at the bottom, in the thumb zone.

**Problems**

- The brand block doubles in size.
- A `Connected` banner with a close button takes a full row.
- Eight equal icon squares fill two rows.
- The sessions card gets about 150px, with a floating round search button inside it.
- The chat card opens with the ASCII splash again.
- The inspector reports text at 12px from the edge and 10px micro-labels.

### 1.11 Theme system (d08, d30, d31, d32)

**Works**

- Twenty themes shared with the TUI.
- Duroxide (d32) is a genuinely good brand theme: measured oxide `#a35838` kept for chrome, `#d2764a` for text-safe accent, and the watermark mark.
- Win95 (d31) is a committed homage.

**Fails**

- GitHub Light (d30) shows that the chrome was designed dark-first. Pastel header bands appear (`Sessions` on a sand band, `Sequence` on a lavender band), the ASCII rainbow turns muddy, and the composer gutter gains a grey gradient.
- Themes reach into components through 443 selector overrides. Every component change has to be tested 20 times, and themes can drift (the `side-tab` findings in win95 and workspace-dark rules).

### 1.12 "AI default" and terminal cosplay: the tells to remove

These are the 2025–26 tells of a generated developer tool. This UI has them because it is a TUI port, not
because of a template, but they read the same to a newcomer:

1. Monospace for all text, including prose and labels (100% of text nodes).
2. Tiny uppercase letter-spaced labels: `SESSIONS`, `SEQUENCE`, `ACTIVITY`, `MY SPEND`, `NAME`.
3. The ANSI rainbow as decoration: the 8-colour tagline, a cyan count, a green model name and a gold system row.
4. CSS-drawn ASCII boxes (`STATS`, `TOKENS`) and `--------` underlines.
5. Bracket tags `[+4]`, `[current]`, `[high]`, `[x]`, plus `▸` and `❯` glyph controls.
6. Unlabelled icon squares everywhere.
7. A radial glow and backdrop blur on an opaque UI.
8. Raw internals as copy: `h16 · q0 · kv0`, `affinity_released`, `v7`.

---

## 2. Worth keeping

1. **Power-user density and keyboard culture.** Number keys in the Node Map, Option+arrow history, slash commands, Esc and Space legends in modals, and three-pane monitoring. The redesign must stay at least this fast. Comfortable is a density setting, not the default.
2. **TUI parity as a brand promise.** The same controller drives a terminal and a browser. Keep the terminal lineage in the type (a mono axis for data) and in the keyboard model, not in ASCII ornament.
3. **The theme system's architecture**, not its reach: `createTheme({ page, terminal, tui })`, measured brand themes (Duroxide's oxide comments are design writing at its best), `contrastRatio()` in `helpers.js`, and palette-derived elevation (`--ps-chrome: color-mix(surface 94%, foreground 6%)`). Keep the derivation idea and move it into a semantic token tier (§4).
4. **The PilotSwarm wordmark as an artifact.** The block-letter mark is real brand equity. Use it once, on the sign-in gate, the about dialog and the TUI, in one colour. Do not use it on every empty session.
5. **The copy voice of the admin console and canvas empty state.** It is plain, specific and honest ("Following the cluster setting", "Settings delivery: 4 of 4 reporting workers updated", "will draw when it has something worth showing").
6. **The two-column modal grammar** (list + detail + key legend) and the live theme preview.
7. **The structural model of transcripts.** Activity runs that close on assistant prose, chronological order, native tasks anchored to dispatch, and capped scroll viewports. The bones are right; the skin is the problem.
8. **Workers table (d12-4)** as the reference for every table: honest dash, pale status pill, live/registered subline.

---

## 3. Three directions

All three share one non-negotiable idea: **the durable spine**. PilotSwarm's difference from LangSmith,
OpenHands or a chat UI is durable execution. Every session is an orchestration with a replayable event
history, timers, retries and child orchestrations (sub-agents). Each direction must draw that spine:

- **In the tree:** as a thin per-row ribbon of recent events.
- **In the transcript:** as the link from a tool call to the sub-agent it spawned.
- **In the History tab:** as a proper waterfall.

The competitor test passes: no other agent console has durable timers and replay to draw.

The type, palette and shell for each direction were dealt by `draw.mjs --app --kind devtools` and then
fitted to this product. Contrast numbers are measured on the direction's surface/ground.

### Direction A: Flight Deck (dark-first, light first-class)

**Concept**

- The operator's instrument panel: a calm near-black cockpit where colour means one thing only, the state of an agent.
- Chrome is grey. Selection is a single 1px accent line exactly as wide as its label, the dealt `data-terminal` move.
- Status is a glyph plus a word plus a hue, never hue alone.
- The terminal lineage survives in the type: one variable family with a **MONO axis**, so prose and data are cousins rather than strangers.

**References**

| Product | What it lends |
|---|---|
| Linear (dark) | Keyboard-first density, the quiet grey chrome |
| Warp | Command blocks: each tool call is a block with a header, status and duration |
| Temporal Web UI and Honeycomb | Event history as a waterfall |
| Grafana 11 | Panels on one ground with 1px rules |
| Bloomberg Launchpad | The board as a wall of live tiles |

**Typography**

- **Recursive** (Google Fonts, variable: `MONO 0–1, CASL 0–1, wght 300–1000, slnt, CRSV`), one family:
  - **Recursive Sans Linear** (`MONO 0, CASL 0`) for chrome and prose.
  - **Recursive Mono Linear** (`MONO 1, CASL 0`) for IDs, tool names, payloads, logs and every figure.
- Fallbacks: `ui-sans-serif, system-ui` / `ui-monospace, SFMono-Regular, Menlo`.
- One file, two voices, a direct line to the TUI. The house rule allows mono for IDs, keys, code and figures, and that is exactly its job here.

**Colour**

| Role | Dark | Light | Contrast (dark / light) |
|---|---|---|---|
| ground | `#0e0f11` | `#f6f7f8` | |
| surface (panes) | `#141518` | `#ffffff` | |
| raised (hover, cards) | `#1b1c20` | `#eff1f3` | |
| overlay (menus, dialogs) | `#202126` | `#ffffff` + shadow | |
| line | `#26272c` | `#e3e5e8` | |
| line-subtle (row rules) | `#1d1e22` | `#eef0f2` | |
| line-strong (controls) | `#3a3b42` | `#c3c7cd` | |
| text | `#ececee` | `#111214` | 15.5 / 18.7 |
| text-muted | `#a1a3ab` | `#565a61` | 7.3 / 6.9 |
| text-faint (meta) | `#8b8d95` | `#6a6e75` | 5.5 / 5.1 |
| accent (selection, focus, primary) | `#5c9dff` | `#1d6ae0` | 6.7 / 5.0 |
| live (running) | `#3ec7b0` | `#0b7d6c` | 8.7 / 5.0 |
| waiting (timer, input needed) | `#e2a93b` | `#94610a` | 8.7 / 5.3 |
| failed | `#f2666f` | `#c42d3a` | 6.0 / 5.6 |
| ok (passed checks) | `#57c785` | `#1e7b4f` | 8.6 / 5.3 |

The accent continues today's GitHub blue (`#58a6ff`), so muscle memory carries over. The ground moves
off GitHub navy (`#0d1117`) to a true neutral. Completed sessions are neutral grey, not green: done is not
news.

**Density and spacing**

- 4px base: `2 4 6 8 12 16 20 24 32 40 48`.
- Dense mode (default): body 13/20, tree rows on a 28px pitch, table rows 36px, controls 28px.
- Comfortable mode: 14/22, 32px tree, 40px table, 32px controls.
- Transcript prose is always 15/24 at a maximum of 72ch.
- Type scale: `12 · 13 · 14 · 15 · 18 · 22`. The h1 is 18/600, because an operator console has no hero.

**Radius and elevation**

- Tight and bimodal: chip 4, control 6, pane 8, dialog 10. Pills only for status.
- No shadow at rest. Elevation is the ground → surface → raised tone step.
- Only menus, popovers, the command palette and dialogs cast a shadow: `0 8px 24px rgb(0 0 0 / .45)` dark, `0 8px 24px rgb(16 18 20 / .12)` light.

**Iconography**

- Lucide, 16px, 1.5px stroke, in `text-muted`.
- Every nav destination has an icon and a label.
- Icon-only buttons are allowed only inside dense toolbars, and need a tooltip with a shortcut.
- Status glyphs are a fixed set drawn as SVG, not emoji:
  - `●` live, pulsing at 0.6 Hz only while streaming, with reduced-motion off.
  - `◔` waiting.
  - `✕` failed.
  - `✓` ok.
  - `○` idle.
  - `■` completed.

**Surfaces**

- **Shell**
  - A 56px labelled rail is optional. The default is a 232px labelled sidebar: workspace switcher, then Sessions, Boards, Budget, Admin.
  - A 40px top bar holds the breadcrumb (`Cluster › PilotSwarm › researcher-2`), a centred `⌘K` search and the connection state as a word with a dot.
  - New session is the one filled accent button.
- **Session tree**
  - Rows on a 28px pitch: status glyph, name in Sans 13, model as a muted Mono 12 suffix, elapsed in tabular Mono, right-aligned.
  - A 48×6px **durable spine** shows the last 16 events as ticks: live, waiting as a hatched bar, failed, completed.
  - Children are indented 12px with a 1px rail and expand inline.
  - The selected row takes the 1px accent line on its left edge and a `raised` fill. Not gold.
- **Transcript**
  - User turns are right-aligned plain text on `raised`, with no `YOU` label.
  - Agent prose is Sans 15/24, 72ch.
  - Each tool call is a **block**: a 32px header with the tool icon, the tool name in Mono, a one-line argument summary in muted text, the status glyph and the duration in right-aligned tabular Mono.
  - Expanding a block shows the payload in a Mono 12.5 code frame with JSON syntax colours from `code-colors.js`.
  - A `spawn_agent` block ends with a child chip (`→ researcher-2 ● live`) that jumps to the child.
  - Runs of more than 3 calls fold into `7 tool calls · 41s · 1 failed`.
- **Logs**
  - A virtualized table: time (Mono 12, tabular), level (`INF`, `WRN`, `ERR` in Mono; only WRN and ERR coloured), source and message.
  - The sticky filter row uses chips.
- **History (signature)**
  - A horizontal waterfall per orchestration, with lanes for activities, timers and sub-orchestrations.
  - Retries show as stacked attempts. Replay boundaries are a dashed 1px line.
  - Clicking a bar opens the raw event in a side sheet.
- **Canvas**
  - A sheet with a 32px title bar: `Canvas · drawn by researcher-2 · 2m ago · sandboxed`.
  - The iframe sits flush, with its own scroll. An empty canvas keeps today's copy.
- **Board (MoA)**
  - Renamed **Board**. Tiles on the ground with 1px lines and a 28px tile header (status glyph, session name, spine, cost so far).
  - The focused tile gets the 1px accent line.
  - An empty board shows a 3-up grid of suggested tiles drawn from live sessions.

### Direction B: Run Book (light-first, editorial)

**Concept**

- The transcript is a document an operator audits after the fact, like a flight recorder transcribed into a printed run book.
- The chrome holds no colour at all (the dealt `achromatic-ledger` move): the one primary is near-black, the one data hue marks the live or current thing, and status is small signals in the margin.
- Tool calls become **sidenotes** in a right gutter, keyed to the sentence that triggered them.

**References**

| Product | What it lends |
|---|---|
| Tufte-style sidenotes | Tool calls in the margin |
| Observable notebooks | Cells as figures |
| Stripe Dashboard and Stripe Docs | Ink chrome, the one blue |
| iA Writer | Reading measure |
| Linear changelog pages | Editorial rhythm |
| Notion | The outline-as-navigation tree |

**Typography**

- **Newsreader** (Google Fonts, opsz 6–72) for agent prose at 17/28.
- **Instrument Sans** (Google Fonts) for all chrome at 14/20.
- Code blocks only in `ui-monospace`, not a loaded third face.
- A serif for reading is the bold choice. It makes transcripts feel authored and calm, and it puts the most distance between this product and every other dev tool.

**Colour**

| Role | Light | Dark |
|---|---|---|
| ground | `#f4f5f3` (cool paper, not cream) | `#121314` |
| surface | `#ffffff` | `#1a1b1d` |
| raised | `#ecedeb` | `#232427` |
| line | `#e2e3e0` | `#2a2b2e` |
| text | `#16181a` (17.8:1) | `#ebeae6` (14.3:1) |
| text-muted | `#5a5d60` (6.6:1) | `#a3a29d` (6.7:1) |
| primary | `#16181a` fill, white label | `#ebeae6` fill, `#121314` label |
| data hue (live, current) | `#1d5fbf` (6.1:1) | `#7aa7ec` (7.0:1) |
| failed | `#b4232f` (6.5:1) | `#ef6b6b` (5.7:1) |
| ok | `#22744a` (5.7:1) | `#62c08a` (7.7:1) |

**Density and spacing**

- Sparse. 4px base with 8/16/24/40/64 steps.
- Section gap 40, card padding 24, row 44, controls 36.
- The transcript column is centred at 68ch with a 240px sidenote gutter.

**Radius and elevation**

- Square to soft. Cards 8, controls 6, figures 2 (square, like printed plates). No shadows at all; dialogs get one tone step and a 1px line.

**Iconography**

- Phosphor Light at 18px (thinner, more editorial than Lucide), used sparingly, mostly in the sidebar.

**Surfaces**

| Surface | Run Book treatment |
|---|---|
| Sub-agent tree | A table-of-contents outline on the left, numbered as data (`2.3 researcher-2`), with the current section in ink and the rest in muted grey |
| Tool calls | Margin notes `14:02:11 bash · 3.2s ✓` with the payload in a popover |
| Logs | An appendix: a full-width table in Instrument Sans with tabular figures |
| Canvases | Figures with captions (`Fig. 3: cost by provider, drawn by analyst-1 at 14:02`) |
| Board | A contact sheet of session cards |

**Weakness**

- It is beautiful for reading and review, and slow for watching 30 live agents. A serif at 17px costs density on a monitoring wall.

### Direction C: Workbench (IDE-shaped, both themes)

**Concept**

- The portal is an IDE for agents. Sessions open as editor tabs, the sub-agent tree is the explorer, and tool output and logs live in a bottom panel.
- The canvas is a preview tab. A board is a split editor group.
- The dealt `framed-sheet` move: one tinted L-frame (sidebar plus 48px top bar, no rule between them) holds white sheets inset 8px with a 1px edge and no shadow.

**References**

| Product | What it lends |
|---|---|
| VS Code and Zed | Tabs, explorer, bottom panel, split groups |
| Vercel dashboard | Framed sheet |
| GitHub Primer | Tables, labels |
| Raycast | Command palette as the hub |
| JetBrains Fleet | Calm multi-pane |

**Typography**

- **IBM Plex Sans** for chrome and prose at 14/20 (15/24 in the transcript).
- **IBM Plex Mono** for IDs, keys, tool output and figures.
- Plex's industrial drawing suits "durable runtime" and has real tabular figures.

**Colour**

| Role | Light | Dark |
|---|---|---|
| frame | `#eef1f3` | `#0f1113` |
| sheet | `#ffffff` | `#16191c` |
| raised | `#f4f6f8` | `#1d2124` |
| active | `#ebedee` | `#23272b` |
| line | `#e8eaec` | `#262a2e` |
| text | `#131416` (18.4:1) | `#e8eaec` (14.6:1) |
| text-muted | `#5d5f60` (6.4:1) | `#a0a5ab` (7.1:1) |
| accent (teal, tab underline, main series) | `#1b6c80` (6.0:1) | `#4fb3c8` (7.2:1) |
| failed | `#c4242a` (5.8:1) | `#ee6a6a` (5.8:1) |
| ok | `#1e7b4f` (5.3:1) | `#5cc28c` (8.0:1) |

**Density and spacing**

- Medium. Gap 24, padding 24, rows 32 in trees and 40 in tables, controls 32.
- The sheet radius is 16 at the window edge. Inner cards are 8 and controls 6.

**Iconography**

- Lucide or Codicons at 16px. Codicons would make it read literally as VS Code, so prefer Lucide.

**Surfaces**

| Surface | Workbench treatment |
|---|---|
| Tool calls | Rows in an Output panel docked under the transcript, filterable by tool, with a "problems" count badge for failures |
| Logs | The same panel's second tab |
| Sub-agent tree | Explorer rows with twisties, file-tree idiom |
| Canvas | A preview tab with a split-to-side button |
| Board | 2×2 editor groups |

**Weakness**

- It is familiar to the point of being someone else's product.
- It invites feature sprawl: panels within panels, the same nested-frame problem the admin console has now.
- It says "VS Code extension" rather than "PilotSwarm".

### Recommendation: Direction A, Flight Deck

1. **The audience works in long, live sessions.** Developers and operators keep many agents running for hours, beside terminals, often at night. A neutral dark cockpit with colour reserved for agent state is the most legible way to watch 30 things at once. Run Book optimises for reading one thing after the fact. Workbench optimises for editing.
2. **It keeps the brand instead of discarding it.** PilotSwarm's identity is terminal-native (TUI parity, ASCII mark, 20 themes). Recursive's MONO axis carries that lineage into a real typographic system. Run Book throws the heritage away. Workbench lends it to Microsoft.
3. **It makes the moat visible.** The durable spine, in tree rows, tool-call blocks and the History waterfall, is the one element no competitor can copy. Flight Deck's status-only colour budget is what makes a 6px ribbon readable.
4. **It is the shortest path from today.** The accent stays blue, dark stays the default, density stays high, the keyboard model stays, and themes map onto its semantic tokens. Users will feel it as "the same tool, finally finished", not as a migration.
5. **It fits the chosen stack.** Lucide, React Flow (History waterfall, node map), cmdk (`⌘K` hub), react-resizable-panels (tree, transcript, inspector with fold-to-rail rules) and Tailwind v4 `@theme` (§4) are all already in `frontend-stack.md`.

What Flight Deck explicitly rejects:

- ASCII boxes, bracket tags, uppercase tracked labels, the rainbow tagline, glyph icons, glass and glow.
- Gold or purple selection.
- More than one accent.
- Any text under 12px.

---

## 4. Design tokens for Flight Deck

There are two tiers:

- **Primitives** live in the theme files and keep `createTheme({ page, terminal, tui })` working for the TUI.
- **Semantic tokens** are the only thing components read.

The two shipped themes, **PilotSwarm Dark** and **PilotSwarm Light**, set the semantic tier directly. The
ported themes (Dracula, Catppuccin, Gruvbox…) go through a mapper:

| Semantic token | Source |
|---|---|
| `--ps-color-bg` | `page.background` |
| `--ps-color-fg` | `page.foreground` |
| `--ps-color-accent` | `terminal.blue` |
| `--ps-color-live` | `terminal.cyan` |
| `--ps-color-waiting` | `terminal.yellow` |
| `--ps-color-failed` | `terminal.red` |
| `--ps-color-ok` | `terminal.green` |
| surfaces | derived with today's `color-mix` toward `fg` |

Every result is checked with `contrastRatio()` and must reach 4.5:1.

Costume themes (Win95, Winamp, MS-DOS, Doom, SpongeBob) may additionally set `data-ps-skin`. A skin may
style only an allowlist of hooks (`shell`, `pane-header`, `button`, `tab`, `scrollbar`). That replaces the
443 open-ended overrides.

```css
/* tokens.css — import before Tailwind utilities. Works as plain CSS; the @theme block exposes the same
   values as Tailwind v4 utilities (bg-surface, text-muted, border-line, rounded-control, font-mono…).
   `@theme inline` makes utilities emit var(--ps-…) directly, so a theme switch on :root repaints them. */

@import "tailwindcss";

/* Fonts: one variable family, two voices.
   <link href="https://fonts.googleapis.com/css2?family=Recursive:slnt,wght,CASL,CRSV,MONO@-15..0,300..800,0..1,0..1,0..1&display=swap" rel="stylesheet">
   Self-host the woff2 in dist/ for air-gapped clusters; Google Fonts is for development only. */

@theme inline {
  /* Type */
  --font-sans: "Recursive", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "Recursive", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --text-xs: 12px;   --text-xs--line-height: 16px;
  --text-sm: 13px;   --text-sm--line-height: 20px;   /* dense body, tree, tables */
  --text-base: 14px; --text-base--line-height: 22px; /* comfortable body, controls */
  --text-prose: 15px; --text-prose--line-height: 24px; /* transcript prose, max 72ch */
  --text-lg: 18px;   --text-lg--line-height: 24px;   /* h1: screen or object name */
  --text-xl: 22px;   --text-xl--line-height: 28px;   /* rare: sign-in, empty-board title */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* Spacing: 4px base. Tailwind v4 multiplies --spacing, so p-3 = 12px, gap-4 = 16px. */
  --spacing: 4px;

  /* Radius: tight and bimodal; pills for status only */
  --radius-chip: 4px;
  --radius-control: 6px;
  --radius-pane: 8px;
  --radius-dialog: 10px;
  --radius-pill: 999px;

  /* Elevation: only things that float */
  --shadow-overlay: var(--ps-shadow-overlay);

  /* Semantic colours, resolved per theme below */
  --color-bg: var(--ps-color-bg);
  --color-surface: var(--ps-color-surface);
  --color-raised: var(--ps-color-raised);
  --color-overlay: var(--ps-color-overlay);
  --color-line: var(--ps-color-line);
  --color-line-subtle: var(--ps-color-line-subtle);
  --color-line-strong: var(--ps-color-line-strong);
  --color-fg: var(--ps-color-fg);
  --color-muted: var(--ps-color-muted);
  --color-faint: var(--ps-color-faint);
  --color-accent: var(--ps-color-accent);
  --color-accent-fg: var(--ps-color-accent-fg);
  --color-live: var(--ps-color-live);
  --color-waiting: var(--ps-color-waiting);
  --color-failed: var(--ps-color-failed);
  --color-ok: var(--ps-color-ok);
  --color-live-tint: var(--ps-color-live-tint);
  --color-waiting-tint: var(--ps-color-waiting-tint);
  --color-failed-tint: var(--ps-color-failed-tint);
  --color-ok-tint: var(--ps-color-ok-tint);
}

/* PilotSwarm Light: the full palette on bare :root, so nothing depends on a theme attribute existing. */
:root {
  color-scheme: light;
  --ps-color-bg: #f6f7f8;
  --ps-color-surface: #ffffff;
  --ps-color-raised: #eff1f3;
  --ps-color-overlay: #ffffff;
  --ps-color-line: #e3e5e8;
  --ps-color-line-subtle: #eef0f2;
  --ps-color-line-strong: #c3c7cd;
  --ps-color-fg: #111214;        /* 18.7:1 on surface */
  --ps-color-muted: #565a61;     /*  6.9:1 */
  --ps-color-faint: #6a6e75;     /*  5.1:1, meta and placeholders */
  --ps-color-accent: #1d6ae0;    /*  5.0:1, selection line, focus ring, primary fill */
  --ps-color-accent-fg: #ffffff;
  --ps-color-live: #0b7d6c;      /*  5.0:1 */
  --ps-color-waiting: #94610a;   /*  5.3:1 */
  --ps-color-failed: #c42d3a;    /*  5.6:1 */
  --ps-color-ok: #1e7b4f;        /*  5.3:1 */
  --ps-color-live-tint: #e3f5f1;
  --ps-color-waiting-tint: #fbf1dc;
  --ps-color-failed-tint: #fdeaec;
  --ps-color-ok-tint: #e2f4ea;
  --ps-shadow-overlay: 0 8px 24px rgb(16 18 20 / 0.12);

  /* Density: dense is the default; [data-density="comfortable"] relaxes it */
  --ps-row-tree: 28px;
  --ps-row-table: 36px;
  --ps-control: 28px;
  --ps-body: 13px;
  --ps-spine-width: 48px;
  --ps-spine-height: 6px;
  --ps-selection-line: 1px;      /* the one selection mark, as wide as its label */
  --ps-motion-fast: 120ms;
  --ps-motion-base: 180ms;
  --ps-ease: cubic-bezier(0.2, 0, 0, 1);
}

/* PilotSwarm Dark: the default for new installs. Follows the OS unless the user picked explicitly. */
@media (prefers-color-scheme: dark) {
  :root:not([data-ps-theme="pilotswarm-light"]) {
    color-scheme: dark;
    --ps-color-bg: #0e0f11;
    --ps-color-surface: #141518;
    --ps-color-raised: #1b1c20;
    --ps-color-overlay: #202126;
    --ps-color-line: #26272c;
    --ps-color-line-subtle: #1d1e22;
    --ps-color-line-strong: #3a3b42;
    --ps-color-fg: #ececee;      /* 15.5:1 on surface */
    --ps-color-muted: #a1a3ab;   /*  7.3:1 */
    --ps-color-faint: #8b8d95;   /*  5.5:1 */
    --ps-color-accent: #5c9dff;  /*  6.7:1 */
    --ps-color-accent-fg: #0e0f11;
    --ps-color-live: #3ec7b0;    /*  8.7:1 */
    --ps-color-waiting: #e2a93b; /*  8.7:1 */
    --ps-color-failed: #f2666f;  /*  6.0:1 */
    --ps-color-ok: #57c785;      /*  8.6:1 */
    --ps-color-live-tint: #12302b;
    --ps-color-waiting-tint: #2e2514;
    --ps-color-failed-tint: #33181c;
    --ps-color-ok-tint: #15291e;
    --ps-shadow-overlay: 0 8px 24px rgb(0 0 0 / 0.45);
  }
}
:root[data-ps-theme="pilotswarm-dark"] {
  color-scheme: dark;
  --ps-color-bg: #0e0f11;
  --ps-color-surface: #141518;
  --ps-color-raised: #1b1c20;
  --ps-color-overlay: #202126;
  --ps-color-line: #26272c;
  --ps-color-line-subtle: #1d1e22;
  --ps-color-line-strong: #3a3b42;
  --ps-color-fg: #ececee;
  --ps-color-muted: #a1a3ab;
  --ps-color-faint: #8b8d95;
  --ps-color-accent: #5c9dff;
  --ps-color-accent-fg: #0e0f11;
  --ps-color-live: #3ec7b0;
  --ps-color-waiting: #e2a93b;
  --ps-color-failed: #f2666f;
  --ps-color-ok: #57c785;
  --ps-color-live-tint: #12302b;
  --ps-color-waiting-tint: #2e2514;
  --ps-color-failed-tint: #33181c;
  --ps-color-ok-tint: #15291e;
  --ps-shadow-overlay: 0 8px 24px rgb(0 0 0 / 0.45);
}

:root[data-density="comfortable"] {
  --ps-row-tree: 32px;
  --ps-row-table: 40px;
  --ps-control: 32px;
  --ps-body: 14px;
}

/* Global defaults */
html { font-family: var(--font-sans); font-size: var(--ps-body); background: var(--color-bg); color: var(--color-fg);
       font-variation-settings: "MONO" 0, "CASL" 0; }
.font-mono, code, kbd, pre, .ps-id, .ps-num { font-family: var(--font-mono); font-variation-settings: "MONO" 1, "CASL" 0; }
.ps-num, td.num { font-variant-numeric: tabular-nums; }
.ps-prose { font-size: 15px; line-height: 24px; max-width: 72ch; }
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
```

**Usage rules that go with the tokens**

| Area | Rule |
|---|---|
| Status | `{ glyph, word, colour }` comes from one map (`live ● Running`, `waiting ◔ Waiting on timer · 4m`, `failed ✕ Failed`, `ok ✓ Passed`, `idle ○ Idle`, `done ■ Completed`). Status colour appears on the glyph and the word only. Tints are for pills and the failed-row background, never for panels. |
| Accent | Used for the selection line, the focus ring, the one filled primary per screen (New session; Send in the composer) and links. Never for a label, a count or a model name. |
| Labels | Sentence case, 12px minimum, `--color-muted`. No `text-transform: uppercase` anywhere except a 3-letter log level in mono. |
| Errors | One plain sentence naming the owner and the fix, then an action button, then a `Details` disclosure holding the raw message. In-place in the block that failed. |
| Empty session | A single-colour wordmark at 24px tall at most, the model and agent, and three suggested prompts. The full ASCII splash moves to the sign-in gate. |
| Layout folding | The session list folds to a 56px status rail below 240px instead of truncating names. The inspector folds to a tab in the transcript header below 1,280px when the canvas is open. |

---

## 5. Persona red flags (walk-through: start a session, watch it spawn sub-agents, diagnose a failure)

**Alex, power user**

- There is no `⌘K`. Navigation needs 13 unlabelled header icons.
- The tree's `[+4]` does not expand on click.
- History events cannot be filtered.
- Tool calls cannot be compared by duration, because no duration column exists.

**Sam, keyboard and screen-reader user**

- Destinations are icon-only, though they do have accessible names.
- Text renders at 10px (`Sessions`, `Sequence`, `Activity`).
- The placeholder is 3.9:1 and disabled admin buttons are 2.4:1.
- Status is colour-only in the tree (gold = system).
- `[x]` text checkboxes rely on the reader parsing brackets.

**Priya, on-call platform operator (project persona: runs 20–40 agents across a cluster, glances between incidents)**

- She cannot see which agents are failing without opening each one. The tree carries no per-row status.
- The failure in d01 names env vars, but not the provider screen to fix them in.
- On the board, 2px grey borders and the 54px `+` give her nothing to scan.
- `0 / ∞` on Budget makes her check whether limits are broken.

## 6. Priority issues

1. **[P1] Status is not visible where operators look.**
   - The tree has no per-row state or spine.
   - Errors are raw strings.
   - Connection is 11px text.
   - Fix: the status map, the durable spine and an in-place error pattern (§4).
   - Commands: the clarify pass, the harden pass.
2. **[P1] Monospace for all text and a size soup of 15 values (8.5–22px).**
   - Fix: Recursive with the MONO axis, a 6-step scale and a 12px floor.
   - Command: the typeset pass.
3. **[P1] Navigation is unlabelled icons, and destinations are mixed with pane toggles.**
   - Fix: a labelled sidebar for destinations, a top bar for scope and `⌘K`, and toolbars grouped per pane.
   - Command: the layout pass.
4. **[P2] Colour has no meaning.**
   - The ANSI rainbow is used decoratively, selection takes five different colours, and the shell has a gradient and glass.
   - Fix: a one-accent, status-only budget.
   - Command: the quieter pass.
5. **[P2] The three-column squeeze and the empty board.**
   - Fix: fold rules, a minimum width for the list, and an empty board seeded from live sessions.
   - Commands: the adapt pass, the onboard pass.

## 7. Questions for the owner

1. **Default theme.** Should new installs default to PilotSwarm Dark, with the 18 ported and retro themes moved under a "More themes" group? Or should Workspace Dark stay the default during migration?
2. **Splash.** Should the ASCII wordmark live only on the sign-in gate and the TUI (recommended)? Or should a single-colour version stay on empty sessions?
3. **Naming.** Can "Master of Agents / MoA" become "Boards" in the UI? Code and route names can stay.
