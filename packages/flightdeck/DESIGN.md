---
name: Flight Deck
description: An operator's instrument panel for durable agents. Quiet neutral chrome; colour means agent state and nothing else.
colors:
  light:
    bg: "#f6f7f8"
    surface: "#ffffff"
    raised: "#eff1f3"
    overlay: "#ffffff"
    line: "#e3e5e8"
    line-subtle: "#eef0f2"
    line-strong: "#858b94"
    fg: "#111214"
    muted: "#565a61"
    faint: "#6a6e75"
    accent: "#1a5fcc"
    live: "#09705f"
    waiting: "#855607"
    failed: "#b8293a"
    ok: "#1a6e46"
  dark:
    bg: "#0e0f11"
    surface: "#141518"
    raised: "#1b1c20"
    overlay: "#202126"
    line: "#26272c"
    line-subtle: "#1d1e22"
    line-strong: "#64666f"
    fg: "#ececee"
    muted: "#a1a3ab"
    faint: "#8b8d95"
    accent: "#5c9dff"
    live: "#3ec7b0"
    waiting: "#e2a93b"
    failed: "#f2666f"
    ok: "#57c785"
typography:
  family: "Recursive Variable (sans voice MONO 0, mono voice MONO 1)"
  xs: "12/16"
  sm: "13/20"
  base: "14/22"
  prose: "15/24"
  lg: "18/24"
  xl: "22/28"
rounded:
  chip: "4px"
  control: "6px"
  pane: "8px"
  dialog: "10px"
spacing:
  base: "4px"
  density: "Compact (default) row 30 / control 30 / body 13; Comfortable row 36 / control 32 / body 14"
motion:
  fast: "120ms"
  base: "180ms"
  slow: "260ms"
  ease-out: "cubic-bezier(0.2, 0, 0, 1)"
  emphasized: "cubic-bezier(0.16, 1, 0.3, 1)"
---

# Design System: Flight Deck

The source of truth for tokens is [`src/styles.css`](src/styles.css). This file says what they mean and how to use them. The original rationale and research are in [`docs/proposals/ux-redesign/design-system.md`](../../docs/proposals/ux-redesign/design-system.md).

## 1. Overview

**Creative North Star: "The instrument panel."** Flight Deck is a place to supervise agents that keep working while nobody is watching. The chrome is quiet and neutral so that the one thing that changes, an agent's state, is the loudest thing on screen. Density is high but calm: rows, not tiles; tone steps, not shadows; one accent.

It explicitly rejects: monospace for the whole UI, ASCII boxes and bracket tags, uppercase tracked labels, rainbow accents, glow and glass, hero-metric tiles, text under 12px.

## 2. Tokens and how they are layered

Two tiers. Components read **only** the semantic tier.

| Tier | Where | Rule |
|---|---|---|
| Hues | `:root` and `.dark` in `styles.css` | The only place a hex value is written. |
| Derived | `--*-tint`, `--scrim` | Computed from a hue with `color-mix`; never written by hand. `--tint` is the strength (9% light, 13% dark). |
| Utilities | `@theme inline` | Exposes tokens to Tailwind: `bg-surface`, `text-muted`, `rounded-pane`, `shadow-lift`, `animate-enter`, `ease-emphasized`. |

To change a colour, change the hue once. To add a role, add it in `:root`, `.dark` and `@theme inline` together, then document it here. Do not add a token for a single local value; if a value repeats three times with the same intent, promote it.

**Guard.** `npm run tokens:check` (also run by `npm run build`) fails on raw colours, Tailwind default-palette classes (`bg-white`, `text-red-500`), colour escapes (`bg-[#fff]`), and text under 12px. Arbitrary size values (`h-[26px]`) are held to a ratchet in `scripts/token-guard.baseline.json`: the count per file may only go down. Re-baseline with `npm run tokens:check -- --update` only after review. A justified exception takes a `token-ok: <reason>` comment on the same line.

## 3. Colour

**Colour means agent state and nothing else.** One accent marks selection, focus, links and the single primary action on a screen.

| Role | Use |
|---|---|
| `bg` → `surface` → `raised` → `overlay` | Layers, lowest to highest. Separate layers by a tone step first, a hairline second, a shadow last. |
| `line-subtle` / `line` / `line-strong` | Row rules / pane and card borders / control borders (the one that must meet 3:1). |
| `fg` / `muted` / `faint` | Text, secondary text, meta. `faint` is the floor for readable text. |
| `accent` | Selection, focus ring, links, primary action. Never decoration. |
| `live` / `waiting` / `failed` / `ok` / `needs` | Running / waiting / failed / passed / needs you. Always paired with a glyph and a word, never colour alone. |

Completed sessions are neutral grey: done is not news.

## 4. Typography

One variable family. Sans voice for chrome and prose; Mono voice for IDs, agent and tool names, paths, payloads, logs and every number that must line up (`tabular-nums`). Weights 400, 550, 600/650. Sentence case everywhere. Steps are the six in the frontmatter; do not write arbitrary `text-[Npx]`.

## 5. Shape and elevation

Radius: `chip` 4, `control` 6, `pane` 8 (cards, panels, notices), `dialog` 10. Pills only for status.

**Flat at rest.** Surfaces carry no shadow. Two shadows exist:

- `shadow-pop`: things that float (menus, popovers, dialogs, toasts, the palette).
- `shadow-lift`: the hover response of an interactive card. It never appears at rest.

## 6. Components

### Card (`components/ui/card.tsx`)

The one surface recipe. Panel, notice, tile, option card and tool-call block are all `Card` or `cardVariants`. Do not hand-write `rounded-pane border border-line bg-surface`.

| Prop | Meaning |
|---|---|
| `tone` | `neutral`; `failed`, `waiting`, `accent` for notices and questions. Tone carries state meaning, so do not use it for decoration. |
| `interactive` | The whole surface is the target. Hover: stronger border and `shadow-lift`. Press: settles 1px. |
| `selected` | A chosen option in a radio group. |
| `clip` | Clip children to the radius (lists, tables, thumbnails). |
| `enter` | Arrive with a short rise and fade, once, on mount. |
| `index` | Stagger a set of cards 30ms apart, capped at eight steps. |

Use `Panel` (`components/empty.tsx`) for a static container of rows. Use `Stat` for a divided strip of figures, not a grid of big-number tiles.

Rules: no nested cards; no icon-over-heading-over-text card grids as page structure; no coloured side stripes thicker than 1px; a row inside a card is a row, not another card.

### Others

Button (primary is one per screen), Segmented, Tabs, Menu, Dialog and sheet, Popover, Tooltip, Command palette, Toast, EmptyState, StatePill, StateGlyph, DurableSpine. See their files; each reads tokens only.

## 7. Motion

Motion explains state and relationship. It is never decoration, and routine feedback is never slower than 180ms.

| Job | Token | Used for |
|---|---|---|
| Feedback | 120ms, `ease-out-fd` | Hover, press, colour and border changes, chevrons. |
| Panels | 180ms, `ease-emphasized` | `animate-pop`: menus, popovers, dialogs, the palette, tooltips (`animate-fade`). |
| Arrival | 260ms, `ease-emphasized` | `animate-enter`: cards, panels and notices as they mount; `animate-sheet`: the right-hand sheet. |

Rules:

- Only `transform` and `opacity` animate, plus colour, border-colour and shadow on small surfaces. Never width, height or position.
- Arrivals use `backwards` fill, so content is visible in its natural state if an animation never runs.
- Exits are instant. Do not add exit animations to menus or dialogs.
- One ambient motion exists: the Running pulse while a turn streams. Nothing else loops except spinners.
- `prefers-reduced-motion`: travel and scale go to zero (`--fd-rise`, `--fd-scale`, `--fd-slide`), so arrivals become a plain fade; pulses stop; colour and state changes remain.
- Do not stagger long lists. Stagger only a set that arrives as a set (cards in a grid), capped at eight.

## 8. States every view designs for

Loading (skeleton rows after 300ms, not spinners), empty (says what will appear and offers the one action), error (structured, retryable), offline, read-only (disabled with the reason), partial permission.

## 9. Accessibility floor

Text 4.5:1; large text and control borders 3:1. Visible 2px accent focus ring on every interactive element (inset inside rows, tabs and rail links). Targets 24px minimum, 44px on coarse pointers. Reflow at 320px and 200% zoom. State is never colour alone. Reduced motion is honoured as in section 7.

## 10. Do and don't

- Do reach for a token, then a scale step, then ask for a new token. Don't reach for `[Npx]`.
- Do separate layers by tone. Don't add a resting shadow.
- Do put state in glyph + word + colour. Don't colour a decoration with a state hue.
- Do use `Card` for any boxed surface. Don't re-spell its classes.
- Do keep one primary button per screen. Don't use the accent for emphasis.
