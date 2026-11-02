# Flight Deck, 1 November 2026

What was designed, built, audited and decided on this day, and where the evidence is. The shipped
behaviour is described in [the Flight Deck README](../../../packages/flightdeck/README.md) and
[CHANGELOG](../../../CHANGELOG.md); what is not done is in
[OPEN-ITEMS.md](../../../packages/flightdeck/OPEN-ITEMS.md). This folder is the record of why.

## Contents

| Folder | What it holds |
|---|---|
| [Design record](../../proposals-impl/flightdeck-sessions-navigation.md) | The projects and sessions-navigation design as built: concepts, behaviour, derivation rules, persistence, decisions and alternatives. The AI-assisted working notes behind it (backend audit, role memos, two Codex review rounds, the owner's answers) are [archived](../../_archive/flightdeck-sessions-navigation/README.md). |
| [overview-graphic](overview-graphic/) | The Overview welcome illustration and its checks. |
| [page-illustrations](page-illustrations/) | Illustrations for the empty Boards and Outputs pages and the Library header, the prompts used, and two rejected directions. |
| [metadata](metadata/) | Page titles, descriptions, `noindex` headers, icons and social images, and how they were verified. |

## What changed

- **Projects.** A backend session group is a Project in the UI; sessions in none are the derived **No project**.
  One derivation drives the sidebar and the new Projects page. Pins, pinned projects and dismissals roam.
- **Sidebar.** Needs you, Pinned, Projects, No project, Recents; loads folded; counts and icons shared with the page.
- **Overview, session header, composer, tabs, working-folder dialog.** See the CHANGELOG entry.
- **Audit of every page** (below), a Codex review of the staged change, and a full update of the Playwright suite.

## Audit of every page

**Method.** Scripted checks over 14 views (Overview, Projects, the six session views, Boards, Outputs, Library,
Providers, Admin, Settings) at phone (375), tablet (820) and desktop (1280) widths in light and dark, run in the
demo data: contrast of every text node, accessible names of controls, heading order, landmarks, duplicate ids,
sideways overflow, target sizes, console errors; the Impeccable design detector (0 anti-patterns); and screenshots
of the main pages and the New session dialog. Touch targets were measured under touch emulation.

**Found and fixed.** Folded rail links had no accessible name (tablet); the page heading repeated the current-page
marker; Outputs and the 404 page skipped a heading level and the sidebar headings sat at the wrong level; underline
tabs and segmented items were under 44 px on touch; the six session tabs did not fit a phone; the Projects filters
took five rows on a phone; the first load was 990 kB. A Codex review then found eight defects (a nested form
submit, folder names the SDK rejects, a pin migration that could lose pins, overlapping optimistic writes, a stale
read overwriting a saved write, pinned sub-agents missing, deep links to hidden sessions, worker-only locations),
all fixed with tests.

**Not covered.** Real devices and assistive technology (open item V6b); a live backend (V5, V8, V9); the empty
first-run Overview (V10). The audit is automated checks plus screenshots, not a user study.

## Provenance of generated images

The welcome and page illustrations were made with built-in image generation and exported to optimised WebP; the
prompts are in [page-illustrations/prompts.json](page-illustrations/prompts.json) and the overview README. They are
decorative (empty alt text) and meant to carry no third-party marks. They are committed with the rest of the package
under the repository's MIT licence; whether that is right for generated artwork is for the owner to confirm before
anything is proposed upstream (open item Q7). The brand mark, icons and variable font are in [assets/brand](../../../assets/brand/README.md); the font
carries its own SIL OFL text.
