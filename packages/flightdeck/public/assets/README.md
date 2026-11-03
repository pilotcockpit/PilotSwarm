# Flight Deck assets

## Identity and browser assets

Editable logo, app-icon and social-card masters live in the repository-level
[`assets/brand/`](../../../../assets/brand/README.md). Runtime SVG logos are in
`public/brand/`, social PNGs in `public/social/`, and manifest icons in
`public/icons/`. Conventional favicon, Apple icon and manifest filenames live
directly in `public/`. This directory contains page illustrations and output media.
See the brand guide for export sizes, source-font licensing and regeneration.

Overview uses authentic work content for output previews. Its welcome also has
a compact paper-flight illustration requested by the owner on 1 November 2026.
The existing swarm identity, Recursive code font and Lucide icons remain the UI assets.

## Welcome illustration

`welcome-paper-flight.webp` is an original image generated with the built-in
image-generation tool, then exported to a 624×416 WebP for the 208px maximum
display width. Transparent alpha lets the cobalt glider and ivory documents sit
on both themes. It is decorative (`alt=""`, hidden from assistive technology),
has explicit dimensions, adds no interaction, and represents no live SDK state.
The primary New session action stays with the welcome copy; the art shrinks on
phones. This narrow owner-requested addition supersedes the earlier no-art
direction for the welcome only. It does not replace real output previews.

Generation brief: an elegant folded cobalt paper glider lifting from three ivory
document sheets, a small ochre tab, tactile matte paper, clean transparent
silhouette, no legible text, metrics, logo or mascot. A second image-tool pass
requested removal of diffuse background haze. Original generations remain in
the author's machine, not in the repository; the optimized final asset lives here.

## Page illustrations

The owner's follow-up request extends the same paper/cobalt/ivory palette to
Library and selected empty states. These are compact orientation assets, not
status visualizations or substitutes for real artifact previews:

| Asset | Placement | Export |
| --- | --- | --- |
| `library-paper-guide.webp` | Library introduction, Agents and Packages | 624×416, 32,834 bytes |
| `outputs-paper-portfolio.webp` | Genuine empty Outputs collection, without a search query | 624×571, 45,108 bytes |
| `boards-paper-panels.webp` | Empty board only | 624×416, 24,164 bytes |

[`ProductIllustration`](../../src/components/product-illustration.tsx) centralizes
their paths, intrinsic dimensions, responsive sizing, lazy decoding/loading and
decorative accessibility treatment. Empty states accept an illustration slot;
other callers keep their existing icons. Read failures and search misses do not
receive an illustration. Populated Outputs and Boards show actual work. Provider
settings, spend tables, logs and Admin retain their data-focused treatments.

The first Library filing-box image was rejected by the owner and replaced with
the lighter open field guide. Its original generation is retained outside the
public directory. See the [page illustration record and exact generation prompts](../../../../docs/ux-audit/2026-11-01/page-illustrations/README.md).

## Authentic output media

Output cards may show the actual available HTML artifact through
[`ArtifactPreview`](../../src/components/artifact-preview.tsx). It uses the shared
no-network document wrapper, an empty iframe sandbox with scripts disabled,
`referrerPolicy="no-referrer"`, `tabIndex={-1}`, and an inert, aria-hidden preview
wrapper. The iframe stays at natural width (100%) and three cover heights (300%),
so the cover crops the opening of the real document instead of shrinking an
entire page. Preview content comes from the source session's artifact, not a
generated screenshot, illustration or invented chart. Loading and failed reads
remain explicit.

Output cards are articles: Inspect opens the real reading preview, while separate
title/footer links open the source output.
[`ArtifactInspector`](../../src/components/artifact-inspector.tsx) uses a native
360ms shared-document View Transition (`fd-output-inspection`), reversing on close
and returning focus to Inspect. Its snapshot waits for iframe load or a 500ms
bound, with revision ownership guarding fast close/reopen. Reduced motion and
browsers without View Transitions open the same dialog immediately; phones use
the full viewport.

The reading document uses an isolated DOMPurify instance to preserve actual text
and checked data while disabling controls, removing link destinations, scripts,
embedded frames and editable behavior. It then receives the existing no-network
wrapper and empty iframe sandbox with no referrer. This is a read-only preview;
interactive canvas/KV support remains in the source session. No new dependency
or backend API is part of this media path.

Non-HTML file covers show actual filenames and file-type metadata. Do not fill
missing preview content with decorative documents, fake graphs or invented progress.
Keep customer and session content within its authorized data source; do not copy
private artifacts into this public static directory as demo media.

## Retired generated artwork

The owner rejected the generic generated spot illustrations and the earlier
admin-console summary direction on 30 October 2026. Both the first-session PNG
and compact welcome WebP have been removed from the shipped UI/public assets.
They are historical explorations, not approved branding or current deliverables.
Source generations are preserved outside this public directory. No decorative
raster illustration from that exploration remains in the Overview composition.

See the [workbench direction](../../../../docs/ux-audit/2026-10-30/workbench/direction.md)
for the authorized design change. Documentation records source behavior and does
not establish fresh visual acceptance or runtime signoff.
