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

Overview leads with welcome and New session, then a featured decision alongside a
recent real output. Recovery cards, work in motion, more outputs and a quiet
upcoming list follow. Capacity remains in the footer; system failures are an
administrator notice. First-session onboarding is a text/work-card composition.
There is no Overview summary metric strip or decorative hero image.

The content container is capped at 1180px, with 16px phone gutters and 28px desktop
gutters. Major sections use a 32px gap. The desktop featured pair uses a 7:5 grid
with a 24px gap and aligns its objects at the top. The featured decision is
content-led, with no stretching or minimum height that leaves an empty body. Work
collections use 16px gaps and progress from one to two or three columns. Standard responsive thresholds used here are 640, 768 and 1024px.
Phones preserve the reading order, wrap long choices and keep actions visible.

Shared operational density remains compact by default: 30px rows and controls;
comfortable mode uses 36px rows and 32px controls. Coarse pointers raise both to
44px. This density setting does not compress WorkCard reading or answer controls.
All surfaces must reflow at 320px and remain usable at 200% zoom.

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
Compact buttons retain 26px small and density-driven medium sizes; coarse pointers
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

### State, chips and navigation

StatePill/StateLine pair word, glyph and meaning. Tag is noninteractive metadata;
Chip toggles a filter with `aria-pressed`; Badge counts navigation. Heading counts
are plain tabular text. Segmented changes a view in place, Tabs change panes, and
SideNav organizes Admin and Settings. Keep one level of each per surface.

The rail groups Work, Build and Manage and carries connection state and the signed-in
person. Demo mode is explicit and synthetic; show its label and exit. Deep links
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

- **Don't** restore Overview metric-summary tiles or generated decorative illustrations.
- **Don't** invent charts, progress, forecasts or healthy verdicts for stale or failed reads.
- **Don't** nest answer or Inspect buttons in a whole-card link or animate the article around them.
- **Don't** introduce raw colors, new font dependencies, glass, glows or state-colored decoration.
- **Don't** treat a source-documentation pass as owner acceptance or runtime signoff.
