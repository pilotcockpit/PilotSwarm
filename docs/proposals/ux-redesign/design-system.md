# Flight Deck design system

Status: proposal, 2026-10-30. Part of the [portal UX redesign](./README.md).
The full token file, contrast checks and the rationale for this direction
are in [research/05-visual-critique.md](./research/05-visual-critique.md)
§3–4. The [prototype](./mocks/index.html) implements this system.

## Direction

An operator's instrument panel. Chrome is quiet and neutral; **colour means
agent state and nothing else**. One accent (blue) marks selection, focus,
links and the single primary action on a screen. The terminal heritage lives
in the type: one variable family, Recursive, whose MONO axis gives prose and
data two related voices.

Rejected on purpose: monospace for the whole UI, ASCII boxes and bracket
tags, uppercase tracked labels, rainbow accents, gold or purple selection,
glow and glass, text under 12px.

## Tokens

Two tiers. Components read only the semantic tier.

| Tier | Where | Examples |
|---|---|---|
| Primitives | Theme files in `packages/app/ui/core/src/themes/*` (the TUI keeps using them) | `page.background`, `terminal.blue` |
| Semantic | CSS custom properties, exposed to Tailwind v4 through `@theme inline` | `--color-surface`, `--color-live`, `--radius-control` |

Shipped themes **Flight Deck Dark** (default) and **Flight Deck Light** set
the semantic tier directly. The 18 classic themes map onto it through a
mapper (`terminal.blue → accent`, `cyan → live`, `yellow → waiting`,
`red → failed`, `green → ok`), and every result is checked for 4.5:1
contrast. Costume themes (Win95, MS-DOS…) may style only an allowlist of
hooks (`shell`, `pane-header`, `button`, `tab`, `scrollbar`).

### Colour

| Role | Dark | Light | Use |
|---|---|---|---|
| bg | `#0e0f11` | `#f6f7f8` | App ground |
| surface | `#141518` | `#ffffff` | Panes, rail, tables |
| raised | `#1b1c20` | `#eff1f3` | Hover, selected row, user message |
| overlay | `#202126` | `#ffffff` | Menus, dialogs, palette |
| line / line-subtle / line-strong | `#26272c` / `#1d1e22` / `#3a3b42` | `#e3e5e8` / `#eef0f2` / `#c3c7cd` | Dividers, row rules, control borders |
| fg / muted / faint | `#ececee` / `#a1a3ab` / `#8b8d95` | `#111214` / `#565a61` / `#6a6e75` | Text, secondary text, meta |
| accent | `#5c9dff` | `#1d6ae0` | Selection, focus, links, primary button |
| live | `#3ec7b0` | `#0b7d6c` | Running |
| waiting | `#e2a93b` | `#94610a` | Waiting (timer, schedule, sub-agents, hold) |
| failed | `#f2666f` | `#c42d3a` | Failed |
| ok | `#57c785` | `#1e7b4f` | Passed checks |

Each state colour has a `-tint` for pills and the failed-row background.
Completed sessions are neutral grey: done is not news.

### Type

Recursive, self-hosted in `dist/` (Google Fonts only in development), with
`ui-sans-serif` / `ui-monospace` fallbacks.

| Token | Size / line | Use |
|---|---|---|
| xs | 12 / 16 | Meta, captions, badges |
| sm | 13 / 20 | Default body in compact density, tables, tree rows |
| base | 14 / 22 | Comfortable body, controls, chat messages |
| prose | 15 / 24 | Long agent replies, max 72ch |
| lg | 18 / 24 | Screen or object title (h1) |
| xl | 22 / 28 | Sign-in, first-run titles only |

Sans voice (`MONO 0`) for chrome and prose; Mono voice (`MONO 1`) for IDs,
agent and tool names, paths, payloads, logs and every number that lines up
(`tabular-nums`). Weights 400, 550, 600/650. Sentence case everywhere.

### Space, size, shape

- Spacing on a 4px base: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48.
- Density: **Compact** (default; rows 28–30px, controls 28–30px, body 13px)
  and **Comfortable** (rows 32–40px, controls 32px, body 14px), switched in
  Settings → Appearance.
- Radius: chip 4, control 6, pane 8, dialog 10; full pills only for status.
- Elevation: none at rest; tone steps (bg → surface → raised) separate
  layers. Only menus, popovers, the palette and dialogs cast a shadow.
- Icons: Lucide, 16px, 1.6 stroke, `muted` colour. Every destination has an
  icon **and** a label; icon-only buttons appear only in dense toolbars and
  always have a tooltip and an accessible name.

## Signature elements

- **State = glyph + word + colour.** One map drives every surface:
  Running ● (pulses only while streaming, off with reduced motion), Waiting ◔,
  Needs you ◆, Failed ✕, Idle ○, Completed ■, Passed ✓. The reason follows
  the word: "Waiting · on 2 sub-agents · since 14:02".
- **Durable spine.** A 48×12px strip of the last 16 durable events (running,
  sleeping, failed, done) on session rows, tile headers and the Agents tree.
  It makes PilotSwarm's durable execution visible at a glance.
- **Tool-call block.** A 34px header with tool icon, tool name (Mono), a
  one-line argument summary, status glyph and duration; expands to the
  payload. Spawns end with child-session chips; runs of more than three calls
  fold into "7 tool calls · 41s · 1 failed".
- **Question card.** An agent's `ask_user` renders as an accent-tinted card
  with its choices as buttons and "Reply in chat…" as the escape hatch.
- **Structured error.** One sentence naming the cause, the fixes as buttons,
  the raw message behind "Show details". Never a raw stack in the chat.

## Components

Built on React Aria Components (or Radix), styled with the tokens:

| Component | Notes |
|---|---|
| Button | primary (one per screen), default, quiet, danger; 26 / 30 / 34px |
| Icon button | 32px target minimum on desktop, 44px on touch |
| Chip / filter chip | `aria-pressed`; used for filters and suggested prompts |
| Segmented control | View switches inside a pane (Outputs · Folders, Timeline · Logs…) |
| Tabs | Companion-pane views; underline in accent |
| Menu | One per object (session ⋯, canvas ⋯, row ⋯); danger section last, with cascade notes |
| Dialog | One primitive: role, label, focus trap, focus return, Esc |
| Command palette | cmdk; sessions, actions, go-to, shortcuts |
| Table | Sticky header, 36–40px rows, numeric columns right-aligned and tabular |
| Tree | Sessions, files, agents; arrow-key navigation, `aria-expanded` |
| Toast | Sonner; result + optional Undo; announced politely |
| Split pane | react-resizable-panels; keyboard-resizable separator |
| Empty state | What will appear here, and the one action that makes it appear |

## States every view designs for

Loading (skeleton rows, not spinners, after 300ms), empty (explains and
offers the next step), error (structured, retryable), offline / reconnecting
(rail status; banner only after 5s), read-only (controls disabled with the
reason), and partial permission (for example Folders owner-only).

## Accessibility floor

- Text 4.5:1, large text and meaningful borders/focus 3:1, checked for every
  theme in CI.
- Visible focus ring (2px accent, 2px offset) on every interactive element.
- Targets at least 24×24px (44px on touch).
- Landmarks per area, skip link, headings in order.
- Live regions only for new messages, toasts and the connection status.
- No single-key shortcut performs a destructive action; all shortcuts are
  listed under `?` and can be turned off.
- Reflow at 320px and 200% zoom without losing the composer.
- `prefers-reduced-motion` stops pulses and slides.

## Motion

120ms for hover and press, 180ms for panels and dialogs, easing
`cubic-bezier(.2, 0, 0, 1)`. Only one ambient motion exists: the Running
pulse while a turn streams.
