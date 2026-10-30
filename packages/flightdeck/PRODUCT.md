# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product purpose

Flight Deck is the separate PilotSwarm browser dashboard for supervising durable
agent sessions. It runs beside the classic portal and uses its existing Web API.
It is a preview application, not a replacement deployment of the classic portal.

## Users and operating context

The working audience for this refresh is the person supervising several agent
tasks, with additional provider and fleet tools for administrators. This audience
is inferred from the existing routes and product documentation; no user interviews
or usage study were conducted in this task.

The main workflow is to inspect work needing attention, answer a specific pending
question, follow progress, and open the resulting files or canvases. Sessions may
wait for time, child agents, user input, or usage allowances.

## Capabilities and constraints

- Existing routes include Overview, Sessions, Boards/Fleet, Outputs, Agent library,
  Providers, Admin, and Settings. Preserve deep links and browser navigation.
- Boards are currently stored in this browser. Output discovery fans out across
  a bounded set of recent sessions; it is not a complete search of output history.
- Demo mode is explicit, synthetic, and isolated from live query caches.
- The server authorizes operations. UI visibility and owner labels are hints,
  not substitutes for effective access. Read the triage document before claiming
  that an API capability is missing.
- Some management operations intentionally hand off to the classic portal.
- This refresh changes frontend behavior and documentation only. Backend, public
  API, SDK, schema, and deployment changes require a separate task.

## Evidence on hand

- [Package behavior and local preview](README.md)
- [Visual system](DESIGN.md)
- [Current audit and captures](../../docs/ux-audit/2026-10-30/README.md)
- [API and SDK triage](../../docs/ux-audit/2026-10-30/api-sdk-triage.md)

## Product principles

1. Put the next human decision before routine telemetry.
2. Distinguish loading, unavailable, stale, empty, and current information.
3. Keep drafts, pending operations, and answers attached to their session.
4. Show actual output metadata; never substitute invented chart previews.
5. Preserve keyboard operation and usable phone layouts.
