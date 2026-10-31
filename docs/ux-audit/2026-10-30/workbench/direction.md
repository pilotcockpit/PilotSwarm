# Overview: a workbench, not an admin console

The owner rejected the previous summary cards and generated spot illustration.
They explicitly request big reusable cards, more expressive motion, research
through immersive-web references, Impeccable audit/signoff, and autonomous
implementation without questions. That request supersedes the previous visual
approval and its restrained metric-strip direction. Other LLM edits, backend,
API and SDK implementation remain outside this work's write boundary.

## Concept and scope

Operate surface, code-led. Keep the existing React/Vite app, navigation, native
sans, semantic palette, actual data and guarded actions. This is a replacement
Overview composition, not a 3D marketing page or a framework migration. The
user's autonomous instruction replaces the skills' direction/approval questions.
No new paid generation, assets, dependencies, or third-party source are required.

The independent critics considered three materially different concepts:
Workbench (individual decisions, sessions and outputs), Project shelf (large
recent-session collection), and Review room (one decision with a selectable
queue). Workbench wins on useful work variety and direct decisions together.
The surface seed `000e737d` was run; its structure exploration was used as an
internal aid, with owner questions skipped under the explicit task instruction.
No owner design acceptance is claimed.

## First viewport contract

**THESIS:** An agent workspace is made of decisions and produced work, not a
report about agent counts. Show both actual objects immediately.

**OWN-WORLD:** PilotSwarm's durable mechanism means a task can pause for one
specific answer, then continue creating persistent output. The real question,
guarded answer choices, named agent and actual canvas make that mechanism
visible. No decorative object is asked to explain it.

**STORY:** Return → give the next direction → inspect something created →
unblock the other work → resume an ongoing session. This is a usable task path,
not an immersive marketing narrative or an artificial five-scene scroll.

**FORM:** Standard app rail and top bar; unboxed welcome; a large decision
article beside a real output link/preview; two recovery cards; a grid of ongoing
session cards; authentic output shelf; subordinate upcoming list. Large cards
have distinct content and different jobs, rather than identical feature tiles.

A welcoming 28px heading and a usable New session action lead directly to
two substantial work objects: a real decision card and a real recent-output
preview. Actual task title, readable question, meaningful answer choices and
agent identity establish the product. There are no metric tiles, generic
illustrations, decorative charts, or passive fleet reporting in the main view.
Other failures/holds remain visible in large recovery cards immediately below,
then ongoing sessions, further outputs and a quiet upcoming list. On phones,
the same objects stack without clipping or hiding the actions.

## Shared card contract and signature interaction

`WorkCard` extends the existing Card surface rather than defining competing
tokens. Its body/footer/identity slots serve decisions, recoveries, working
sessions and outputs. Articles keep separate linked titles and answer buttons;
single-destination cards are actual links. The shared radius is 14px, ordinary titles
18px and featured titles 22px, reading text 14–15px, actions at least 36px or 44px for coarse pointers.

The signature is **inspect the work itself**: a natural-scale crop of actual
document content expands into a reading surface, then returns to its card.
The native shared-element transition uses 360ms easing; its DOM update is
synchronous and waits briefly for real iframe ink rather than expanding a blank
frame. Keyboard and touch use the same Inspect action; closing restores focus.
Phones use a full-screen reading view. Reduced motion and browsers without the
transition API get the same view immediately. The reading view is explicitly
read-only: it preserves content/checked values while disabling document actions,
and retains the existing no-network policy and empty scriptless sandbox.

One short capped arrival sequence and 4px hover/focus lift remain secondary
feedback on whole-session links. Press settles a link; decisions stay stationary.
Reduced motion removes travel, staggering, preview scale and arrow movement.
Refreshes retain stable object keys. Featured decisions use content-led height,
so their scale comes from readable work rather than a stretched empty region.
Output cards use separate Inspect and navigation controls, never nested buttons
inside a full-card link. Native implementation references:
[Chrome View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions)
and [React DOM synchronization](https://react.dev/reference/react-dom/flushSync).

## Research ledger — inspected 30 October 2026

Product structure references were checked against primary documentation:

- [Linear My Issues](https://linear.app/docs/my-issues): pertinent work and a
  curated priority order; use actual decisions rather than summary metrics.
- [Asana Home](https://asana.com/features/project-management/home): meaningful
  task/project entry points and shortcuts. Adopt the work-object focus, not its
  branding or widget implementation.
- [Notion navigation](https://www.notion.com/help/navigate-with-the-sidebar):
  current content navigation, recents and agents. The old English Home help URL
  redirects; earlier full-page Home screenshots are not current evidence.

Live React Bits examples were inspected in the browser. These are mechanic
studies, not imported code, prompts, layouts or assets. No purchase or copying.

| Reference | Evidence and observed mechanic | What transfers / what stays out |
| --- | --- | --- |
| [Tilted Card](https://www.reactbits.dev/components/tilted-card) | Live preview: a substantial image card with layered depth and title/action anchored over its image. Partial interaction evidence; no mobile study of the reference. | Give real output media substantial presence. Keep reading text stable; omit glare and dramatic tilt. |
| [Stack](https://www.reactbits.dev/components/stack) | Live preview and click: layered cards physically separate, making a collection tangible. | Cards represent actual work objects with consistent geometry. Do not bury urgent work inside a flick stack. |
| [Spotlight Card](https://www.reactbits.dev/components/spotlight-card) | Live preview: title, identity and actions remain distinct within a generous card. Pointer-specific behavior not independently measured. | Clear card anatomy and focus response. Omit colored glows, fake stats and decorative halos. |
| [Animated Content](https://www.reactbits.dev/animations/animated-content) | Live preview: staggered content arrival with explicit pacing and substantial cards. | One bounded entry sequence with content visible by default. No scroll hijacking or repeated reveals. |
| [Folder](https://www.reactbits.dev/components/folder) | Live preview: actual document-shaped layers make the output collection recognizable. | Show actual sandboxed document previews; don't generate fake paper content or substitute a folder illustration. |

The existing UI's screenshot is the rejected baseline, not an authority for the
new composition. Native UI controls, status words, keyboard operation and phone
readability take precedence over any borrowed motion idea. The references'
assets and libraries were neither downloaded nor bundled.

## Safety and acceptance

Output thumbnails use the existing no-network document wrapper, an empty iframe
sandbox (scripts disabled), no referrer, no tab stop and an inert preview. They
are authentic available artifact content, never fabricated charts. File covers
show real filenames. Full artifact navigation keeps existing deep links.

No invented progress, completion estimates or last-visited claims. Failed,
stale, loading and successful-empty reads remain distinct. Pending-question
identity, destructive answer confirmation, sent feedback and retry remain bound
to the source session. All non-system work is within the existing accessible
catalog; UI presentation does not expand authorization.

Acceptance requires a fresh independent reviewer to inspect the actual large-card
composition, both themes, phone/desktop, meaningful content variety and motion
behavior. A token-guard pass or a consistency-only signoff is insufficient.
