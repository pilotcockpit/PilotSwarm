---
name: Flight Deck
description: A workbench for durable agent work, with shared operational controls.
colors:
  bg: "#f6f7f8"
  surface: "#ffffff"
  raised: "#eff1f3"
  overlay: "#ffffff"
  line: "#e3e5e8"
  line-subtle: "#eef0f2"
  line-strong: "#858b94"
  fg: "#111214"
  muted: "#565a61"
  faint: "#62666d"
  accent: "#1a5fcc"
  accent-fg: "#ffffff"
  live: "#09705f"
  waiting: "#855607"
  failed: "#b8293a"
  ok: "#1a6e46"
  needs: "#6b3fc2"
  dark-bg: "#0e0f11"
  dark-surface: "#141518"
  dark-raised: "#1b1c20"
  dark-overlay: "#202126"
  dark-line: "#26272c"
  dark-line-subtle: "#1d1e22"
  dark-line-strong: "#64666f"
  dark-fg: "#ececee"
  dark-muted: "#b3b5bd"
  dark-faint: "#9a9ca5"
  dark-accent: "#5c9dff"
  dark-accent-fg: "#0b1220"
  dark-live: "#3ec7b0"
  dark-waiting: "#e2a93b"
  dark-failed: "#f2666f"
  dark-ok: "#57c785"
  dark-needs: "#b497ff"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "36px"
  featured-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
  work-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
  featured-question:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.625
  prose:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "24px"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "20px"
  metadata:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  code:
    fontFamily: "\"Recursive Variable\", ui-monospace, \"SF Mono\", Menlo, monospace"
    fontSize: "12.5px"
    lineHeight: "18px"
    fontVariation: "\"MONO\" 1, \"CASL\" 0"
rounded:
  chip: "4px"
  control: "6px"
  pane: "8px"
  dialog: "10px"
  work: "14px"
spacing:
  base: "4px"
  sm: "8px"
  footer-block: "12px"
  md: "16px"
  work-body: "20px"
  featured-body: "24px"
  desktop-gutter: "28px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "30px"
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "30px"
  button-quiet:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "30px"
  button-danger:
    textColor: "{colors.failed}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "30px"
  button-link:
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0"
    height: "24px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "30px"
  chip:
    textColor: "{colors.muted}"
    typography: "{typography.metadata}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "26px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.pane}"
  work-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.work}"
    padding: "20px"
  work-action:
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
    height: "36px"
---

# Design System: Flight Deck

## Overview

**Creative North Star: "Work placed within reach."**

Flight Deck puts durable agent work within reach: a decision to answer, a task to follow, and an output to open. Overview uses substantial work cards with readable content, bounded arrivals and an actual output that expands into a reading view. The surrounding shell remains quiet, so real work and its state carry the emphasis.

This workbench extension retains the shared semantic palette, native controls, keyboard behavior and compact operational surfaces. Sessions, provider management, tables, logs and Admin can remain dense. Large work cards describe the Overview and output-entry pattern; they are not a mandate to replace every operational row.

**Key Characteristics:**

- Substantial cards for decisions, recoveries, sessions and outputs.
- Quiet semantic light and dark palettes.
- Native sans for reading; Recursive for code and comparable strings.
- Authentic artifact content and honest loading, stale and error states.
- Bounded movement with a complete reduced-motion alternative.

The source of truth is [src/styles.css](src/styles.css), together with the shared
[Card](src/components/ui/card.tsx), [WorkCard](src/components/ui/work-card.tsx)
and component sources. The frontmatter records the light palette and explicit
`dark-*` overrides, with the runtime semantic CSS variables selecting the theme.
The [workbench direction](../../docs/ux-audit/2026-10-30/workbench/direction.md)
records the authorized composition change and reference research. This document
records the implementation; fresh visual review and owner acceptance are separate.

## Colors

The palette combines cool neutral surfaces with a blue action accent and distinct
state hues. Components consume semantic variables, never raw palette classes.

### Primary

- **Action blue** (`accent`, `accent-fg`): links, focus, selection and primary actions.

### Secondary

- **Human-decision violet** (`needs`): the state asking for a person's answer.
- **Running teal**, **Waiting amber**, **Failure red**, **Passed green** (`live`, `waiting`, `failed`, `ok`): operational meanings, paired with words and glyphs. Completed sessions remain neutral.

### Neutral

- **Workspace ground / surface / raised / overlay** (`bg`, `surface`, `raised`, `overlay`): tonal depth, lowest to highest.
- **Rules / subtle rules / control borders** (`line`, `line-subtle`, `line-strong`): separations and component boundaries. Strong control borders are the contrast-bearing edge.
- **Primary / secondary / metadata ink** (`fg`, `muted`, `faint`): readable hierarchy. Use muted ink on tinted surfaces rather than faint.

Tints derive with `color-mix` from their semantic hue: 9% in light and 13% in dark.
They are not independent hand-tuned colors. Scrims and theme-specific shadows
remain CSS source tokens. Add a semantic role to light, dark and Tailwind's inline
theme together. Reuse existing roles before proposing another.

**The State Meaning Rule.** Accent marks action, selection and focus. State hues accompany a state word and glyph; they never decorate unrelated content.

## Typography

**Display and Body Font:** Native system sans, including the platform UI face.
**Code Font:** Recursive Variable with MONO 1 and CASL 0, then native mono fallbacks.

The native reading voice is deliberately retained across the application. Sentence
case, normal tracking and weights 400, 500 and 600/650 keep the hierarchy clear.
Counts use sans with tabular numerals. Text does not go below the 12px metadata floor.

### Hierarchy

- **Display:** Overview welcome, 28/36 and semibold.
- **Featured title:** the first decision card title, 22/28 and semibold.
- **Work title / section heading:** 18/24 and semibold; work titles use the source's `leading-snug` value (1.375) where applied.
- **Featured question:** 18px with relaxed line height (1.625), distinct from metadata and actions.
- **Prose:** ordinary question text, 15/24. Shared rendered prose uses 14/22 and a 72ch maximum.
- **Body:** descriptions, recoveries and Overview actions, 14/22.
- **Label:** compact controls, 13/20. **Metadata:** 12/16.
- **Code:** Recursive; rendered code blocks use 12.5/18.

**The Reading Voice Rule.** Use native sans for headings, questions, counts and prose. Use Recursive mono for IDs, agent/tool identifiers, paths, payloads and logs.

## Layout

### Shell layout

Sessions live in the sidebar, as in Claude Code and Codex. Top to bottom: New session, Search (⌘K), the page
links Overview, Boards, Outputs and Library, then the sessions list, which is the last block and scrolls on its
own. Its sections:

- **Needs you** (derived, always first): questions first, then holds the viewer can lift, then failures, for the
  viewer's own sessions only. It shows five rows and a link to the rest. Its count is a pill beside the heading and
  stays visible when the section is folded. Dismissing a failure is per occurrence.
- **Pinned**: pinned sessions and pinned projects, in pin order. A pin is a watchlist, not a move: the session is
  still listed in its project.
- **Projects**: the person's projects (five, then a link to all). The heading links to the Projects page; its chevron
  folds it; its actions are a menu and New project. A project row opens in place (one at a time) to five of its live
  trees, with New session in this project and Pin on hover; the project's attention count is a pill.
- **No project**: the derived group of sessions in none (or in a deleted one), as its own section with the same five-row
  preview and a New session with no project action.
- **Recents**: the most recently active sessions (12, "Show more"), in an order that settles, with "Refresh order"
  when it has moved. The session being viewed always has a row.

A session appears once per section it qualifies for, and the row for the open session is the only one marked as the
current page. **Every section loads folded**; what a person opens is kept for that visit only, not across loads.
Opening a session from a link opens just the place that draws it (its project, No project, Pinned, Needs you or
Recents) and selects it there.

Rows are two lines (state glyph and title; project, state and age), with a trailing time or sub-agent chip. Hover or
focus reveals pin and a menu (rename, pin, move to project, share, copy link, complete, cancel, delete with a
confirmation). The list is one tab stop with roving focus: arrows, Home and End move, Enter opens, `p` pins, `m` opens
the menu, Delete asks to delete. A row that moves between sections (a pin, a project change, a poll) keeps keyboard
focus on the same session, or on its neighbour if it is gone.

Pins, pinned projects and dismissed failures roam with the account: they are stored in the profile settings document
(pins under the classic portal's `pinnedSessionIds`, the rest under a `flightdeck` key), written through a queued
read-modify-write; the page shows a change at once and takes back only that change if the save fails. When the server
cannot store profile settings they stay in this browser, in keys scoped by data source and person, and the sidebar says
so. Stored values of the wrong shape read as the default. See open items S2 and S3 for the limits.

System sessions are not listed in the sidebar (they are in Admin). A sub-agent whose parent is not in the list is
listed as a root. The Needs-you count is announced politely when it changes. Providers, Admin (admins), Settings,
the theme and demo/live are in the account menu at the foot. Collapsed (and at tablet widths) the sidebar is an
icon rail with names as tooltips and accessible labels, and a count on Overview. On a phone it is a left drawer,
opened by the menu button or the Sessions tab; the bottom tabs stay.

A session has three zones: the top bar (the project when it is in one, then the title; a chevron menu, "Session
actions", with Rename, Pin, Move to project, Share, Copy link, Copy session ID, Export history, Complete, Cancel and
Delete; the state; Share), the view in the middle, and under the top bar one tab bar for the views: Chat, Context,
Canvas, Files, Delegation, Activity. There are no icon buttons for views and no More menu: the model and the working
folder are the chips under the message box, where they are shown. Context shows only what the server returned:
environment (agent, model, project, folder or repo, access, owner, started by, context tier, session ID), a context
meter, usage, what happens next with its schedule actions, sub-agents, outputs and a waiting question. On a phone the
tab bar is icons over labels at equal widths.

### Overview

Overview is where you act and see the pulse; it does not repeat the sidebar's lists or the Projects page.
It leads with the welcome, the paper-glider illustration the owner chose for that header, and a start box
(what to do, the project, Start; More options opens the full New session dialog). Then Needs you (a count pill
beside the title): the first item is a card that answers in place, the rest are one-line rows with the move that
clears them and Dismiss for failures, each saying which project it lives in. Running now and Coming next are
rows side by side. Beside the Needs you card, two separate sections: Canvases (the newest three, as small thumbnails, with All canvases) and Outputs (the newest files as rows, with All outputs). Capacity remains in the footer; system
failures are an administrator notice. First-session onboarding is the welcome and the start box.
There is no Overview summary metric strip. The only decorative images are the welcome illustration, the empty-state
illustrations on Boards and Outputs, and the Library header (`ProductIllustration`): empty alt text, explicit
dimensions, lazy loading, no motion.

The content container is capped at 1180px, with 16px phone gutters and 28px desktop
gutters. Major sections use a 32px gap. The desktop featured pair uses a 7:5 grid
with a 24px gap and aligns its objects at the top. The featured decision is
content-led, with no stretching or minimum height that leaves an empty body. Work
collections use 16px gaps and progress from one to two or three columns. Standard responsive thresholds used here are 640, 768 and 1024px.
Phones preserve the reading order, wrap long choices and keep actions visible.

There is one layout, not a density setting: 30px rows and controls and 14px/22px body text.
Coarse pointers raise rows and controls to 44px. Browser zoom is the way to make everything
larger; WorkCard reading and answer controls are sized for reading in any case.
All surfaces must reflow at 320px and remain usable at 200% zoom.

**Theme.** One control, set in three places from one implementation (`components/theme-setting.tsx`):
Settings > Appearance (System | Light | Dark), the account menu (a radio group with the current choice checked)
and the command palette (Theme: System, Theme: Light, Theme: Dark). There is no theme toggle in the top
bar. The default is System, which follows the browser live; the pre-paint script in `index.html` applies it so
there is no flash in either direction, and a stored explicit choice always wins. The phone More sheet shows
the same segmented control.

## Elevation & Depth

Depth comes first from tonal layers and hairline borders. Cards are flat at rest.
`shadow-pop` serves menus, popovers, dialogs, toasts and the command palette.
`shadow-lift` remains an interaction response of the generic Card, with distinct
light and dark values in CSS; it is not added to every work card.

**The Flat Rest Rule.** Surfaces rest without shadows. Floating controls use pop; ordinary interactive Card surfaces may use lift. WorkCard links signal reach through movement and border response.

Shared motion uses feedback at 120ms, panels at 180ms and ordinary arrivals at
260ms. Generic Card arrival staggers by 30ms, capped at index eight. The WorkCard
extension instead arrives once in 220ms, staggering by 25ms capped at 100ms.
Whole-card session links lift 4px on hover or keyboard focus and settle on press;
their directional arrow moves 2px. Link transitions are 140ms and arrow response
is 180ms. Decision and output articles with separate controls do not hover or lift.
The current output preview uses Inspect rather than a whole-card hover-scale
effect. Stable React keys preserve object identity on refresh.

The signature interaction is the actual output opening into a reading surface.
Native View Transitions use the single shared name `fd-output-inspection`, with
360ms emphasized easing on the group and old/new document snapshots; root content
does not animate. Closing reverses the relationship and returns focus to Inspect.
The implementation waits for the document load or a 500ms bound before capturing
the reading surface, and a revision guard prevents fast-close completion from
clearing a newer transition's ownership. No motion dependency is added.

Reduced motion removes WorkCard arrival, stagger and all interaction transforms,
including preview and arrow movement. Inspect opens the same reading dialog
immediately when View Transitions are unsupported or reduced motion is requested.
Shared arrivals keep only a fade, ambient pulses stop, and state/color feedback
remains. Ordinary menus/dialogs exit immediately; output inspection alone has its
explicit reversible document transition. No scroll hijacking or repeated reveal
sequence belongs to this system.

## Shapes

Shared primitives retain chip (4px), control (6px), pane (8px) and dialog (10px)
radii. WorkCard adds the larger work radius (14px), preserving Card's neutral
surface and border recipe. Status pills remain fully rounded. Work bodies use
20px padding, the featured decision uses 24px, and footers use 20px horizontally
with 12px vertically. Do not turn a row inside a panel into another boxed card.

## Components

### Buttons and fields

Use shared Button, Chip, Tabs, SideNavItem or Segmented instead of hand-built
button recipes. Button variants are primary, default, quiet, danger and link.
Buttons are 26px small and 30px medium; coarse pointers
receive 44px targets. Overview decision/recovery controls use a 36px minimum,
14px labels and wrapping text. They grow for long answers. No choice receives
primary styling unless the agent supplied a default. One primary action per screen
is the general restraint; first-session Start a session is the onboarding action.

Fields retain native input behavior, strong semantic borders, surface background,
control radius and visible focus. Input focus uses an accent border and 1px ring;
other interactive elements receive the global 2px accent outline. Rows and tabs
inset that outline. Credential controls remain password fields with autocomplete
off, and drafts clear after saving. Error and disabled states explain the reason.

### Shared Card and WorkCard

Card/cardVariants remains the base surface for panels, notices and options. Its
tones carry state meaning; selected options use accent. Panel remains suitable
for a static row list. Stat remains available for genuine divided figures on
operational surfaces, but does not define Overview's composition.

WorkCard extends that base with article/link semantics, the work radius and its
own bounded arrival. WorkCardBody, WorkCardFooter and AgentIdentity make a common
anatomy for decisions, recoveries, running sessions and outputs. Agent initials
come from the actual agent name and do not communicate state. A single-destination
session card is a real link through `asChild`. A decision card remains an article
with separate title navigation and answer controls. Output preview cards also
remain articles, with an Inspect button over the document cover and separate
title/footer navigation links. Avoid nested interactive targets.

### Artifact previews and inspection

[ArtifactPreview](src/components/artifact-preview.tsx) shows the actual available
HTML artifact in a 16:9 cover using the shared no-network document wrapper. Its
iframe is 100% wide and 300% high, clipped to show the document's natural-scale
opening; it is not a scaled miniature of the whole page. The iframe has an empty
sandbox (scripts disabled), no referrer, a negative tab index and an inert,
aria-hidden wrapper. The overlay Inspect button owns the preview action; title
and footer links open the output in its source session. Loading or failed HTML
disables Inspect. Non-HTML covers show real filenames and metadata.

[ArtifactInspector](src/components/artifact-inspector.tsx) mounts the actual
document in a read-only dialog. It preserves real document content and checked
values through its own DOMPurify instance, disables form controls, strips editable
and tab-stop attributes, removes link destinations and forbids scripts, embedded
frames/objects, forms and document metadata/link/base tags. The sanitized document
then receives the existing no-network wrapper and an empty iframe sandbox with
no referrer. This reading view does not implement interactive canvas/KV behavior;
Open output keeps the existing session deep link for that workflow.

The native shared-document transition is described under Elevation & Depth.
Focus returns to the Inspect trigger on close. At phone widths below 640px, the
dialog occupies the full viewport with square corners. Other sizes use the work
radius and a maximum 1024px reading dialog. No output media or chart is fabricated
to fill a cover; unavailable and loading content remain explicit.

### The composer

Under the message box sits one footer row that says what this conversation is running on. What cannot
change looks unchangeable; what can looks like a control.

- **Agent: fixed.** A plain label with initials and the agent's name. No chevron, no hover, no focus stop.
  The session's agent is set when it is created and the API has no operation to change it, so it is never
  offered as a choice. Its tooltip and screen-reader text say so.
- **Model chip: changeable.** `sonnet-5 · high`, with a chevron. It opens the one model picker
  (`components/model-picker.tsx`, also behind Change model in the title menu and the failed-turn Switch
  model action): models grouped by provider with the ones the workers can run first, then the reasoning
  effort and context window the chosen model supports, each with a Default that clears it. Options the
  person did not touch are not sent, so the server keeps them; an effort or window the new model does not
  offer is cleared. A change applies from the next turn: the toast says so and offers Undo (which first
  re-reads the session), and while a turn is running the footer repeats "applies to the next turn".
- **Working folder chip: changeable.** The last path segment, or No folder, opening the working-folder
  dialog. A warning dot and tooltip say when the folder is unavailable or messages are held for it.
- **Context meter.** A short bar and a percentage from `contextUsage`, hidden when the server returned
  nothing usable, amber from 80%, red and worded "over the limit" past 100%.
- **Right side.** Attach and Send; while a turn runs, Stop, Steer and Queue. The key hint appears only
  while the composer has focus and there is room (not below 640px), and never takes width from the chips.
- **Locked.** Viewers without write access, non-managers and system sessions see the model and folder as
  plain text with the reason; no dead controls.
- **Phones.** The chips fold into one Session settings button that opens a bottom sheet with the agent,
  the working folder and the same model picker.

The backend has no permission or approval mode, per-message model override, output style or fork, so the
footer offers none of them.

### State, chips and navigation

StatePill/StateLine pair word, glyph and meaning. Tag is noninteractive metadata;
Chip toggles a filter with `aria-pressed`; Badge counts navigation. Heading counts
are plain tabular text. Segmented changes a view in place, Tabs change panes, and
SideNav organizes Admin and Settings. Keep one level of each per surface.

The sidebar is for work; setup lives behind one account menu (see Shell layout). Demo mode is explicit and synthetic; the account menu shows its label and the way back to live data. Deep links
and browser history retain their behavior. Loading, successful-empty, error,
offline, stale, read-only and partial permission states remain distinct. UI
presentation does not widen server authorization. Reversible changes use Undo;
spending, wider access and irreversible actions explain their consequence and
use the existing confirmation controls.

## Do's and Don'ts

### Do:

- **Do** extend Card with WorkCard for substantial work objects and use its body/footer slots.
- **Do** keep decision and output articles stationary while their individual controls act.
- **Do** show actual output content or real file metadata, with loading and failure explained.
- **Do** keep dense rows and tables where comparison and management need them.
- **Do** preserve focus, keyboard operation, 44px touch targets and reduced-motion behavior.
- **Do** keep secrets masked, clear credential drafts after saving and keep tokens out of URLs, query keys, logs and toasts.

### Don't:

- **Don't** restore Overview metric-summary tiles, or add decorative illustrations beyond the welcome, the empty Boards and Outputs pages and the Library header.
- **Don't** invent charts, progress, forecasts or healthy verdicts for stale or failed reads.
- **Don't** nest answer or Inspect buttons in a whole-card link or animate the article around them.
- **Don't** introduce raw colors, new font dependencies, glass, glows or state-colored decoration.
- **Don't** treat a source-documentation pass as owner acceptance or runtime signoff.
