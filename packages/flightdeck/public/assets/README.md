# Flight Deck assets

Overview uses authentic work content rather than decorative raster artwork. The
welcome and first-session onboarding are text and work-card compositions. The
existing swarm identity, Recursive code font and Lucide icons remain the UI assets.

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
raster illustration remains in the Overview composition.

See the [workbench direction](../../../../docs/ux-audit/2026-10-30/workbench/direction.md)
for the authorized design change. Documentation records source behavior and does
not establish fresh visual acceptance or runtime signoff.
