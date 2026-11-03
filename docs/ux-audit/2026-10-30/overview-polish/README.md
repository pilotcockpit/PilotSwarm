# Overview refinement — 30 October 2026

**Superseded:** the owner rejected this composition and its generated artwork.
Its reviewer approvals below are historical and do not establish owner acceptance.
The replacement is recorded in [the workbench direction](../workbench/direction.md).

This pass responds to the owner's readability and visual-quality feedback.
Two fresh independent Impeccable reviewers agreed that the earlier visual
signoff was too generous: 13px descriptions, 12px/26px actions, the code-like
typeface, duplicated state markers, and remedies on opposing sides of a row
made the dashboard feel rough despite using shared components.

## Implemented

- Native system sans for ordinary UI text; Recursive remains for code.
  Default body is 14/22. Overview uses 15/24 task titles and 18/24 section
  headings, with 12/16 metadata.
- Personalized welcome and an original, transparent coordination illustration,
  delivered as a 23 KB WebP. The art stays out of triage, yields on phones,
  and does not duplicate first-session artwork.
- A compact, linked summary for Attention, In progress, Waiting and Finished.
  Counts use the accessible non-system session list. Waiting includes holds;
  Finished includes completed/cancelled. Attention overlaps those states and
  is not a disjoint KPI. Loading uses skeletons without active links; failed
  reads hide unavailable values or label cached values stale.
- Every attention row follows task/state → explanation → actions → agent/time.
  One state pill replaces duplicated markers. Buttons use 14px labels and a
  32px minimum, grow for long choices, and retain a 44px coarse-pointer minimum.
  Existing question identity, destructive-answer confirmation and retry
  behavior are preserved. No recommendation is invented.
- Progress/waiting lists match the non-system work scope. Admin system failures
  still have their notice; system management remains in Admin. Capacity is a
  quiet footer, allowing decisions to lead the workspace.

## Verification and evidence

- Production workspace build, type check, token guard and distribution guard:
  passed after the first implementation; repeated after the final refinements.
- Targeted theme-toggle and session-stream suites: 12 tests passed.
- Rendered all attention actions at the same 32px height and 14px label size.
- Clicked each summary: three running sessions, three waiting sessions
  including the hold, two completed sessions, and attention anchored immediately
  below the top bar.
- Repeated theme clicks alternated the document theme and matching sun/moon
  icon. The previously reported stuck-toggle fix is already in the concurrent
  checkout's committed source; this pass confirmed its browser behavior.
- Checked desktop and phone layouts in both themes. Phone DOM was 390 × 844;
  an extreme 278px CSS-width check also had no page overflow. The browser's
  140% zoom produces a reduced phone bitmap inside the screenshot canvas;
  DOM measurements establish the actual layout width. The viewport override
  was reset, and the preview was returned to its original light mode.
- Two independent design reviewers approved the scoped final source and
  screenshots. This is visual/source review, not independent end-to-end
  qualification of every unavailable, empty, or authorization state.

Final captures: [desktop light](desktop-light-final.jpg),
[desktop dark](desktop-dark-final.jpg), [phone light](mobile-light-final.jpg),
[phone dark](mobile-dark-final.jpg). Earlier files in this folder preserve the
first inspection round. Source-level edge-state review supplements the rendered
demo captures; no live backend mutation or generative provider call was used.

## Boundaries and remaining triage

No backend, API or SDK implementation changed. This overview needs no new
endpoint. Existing scale/error-propagation/integration concerns remain in
[API/SDK triage](../api-sdk-triage.md); the bounded recent-output discovery
and adapter fallback limitations still apply. No new backend defect was
established by this visual pass.

Another LLM is actively changing tests, dialogs, libraries and data adapters in
this checkout. Those files were left untouched. Our edit scope is Home,
NeedsRow, the new OverviewWelcome component, the font/default-body tokens,
design/asset documentation, the new asset, and this evidence folder.

Required Claude review failed before producing a review: CLI response
“Not logged in · Please run /login,” exit 4. Run record:
`20261030-191314-36356`. No Claude signoff is claimed and this pass was not
committed or pushed by this session.
