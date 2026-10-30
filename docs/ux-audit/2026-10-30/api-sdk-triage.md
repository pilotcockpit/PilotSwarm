# Flight Deck API and SDK triage — 30 October 2026

This is a source-based triage record for the UX refresh. No backend, schema,
public API, SDK implementation, or model-provider behavior was changed for
this audit. Contract inspection establishes which operations and parameters
are exposed in this checkout; it does not establish production behavior,
performance, or permission enforcement. Proposed operations below require
product and API design decisions, not automatic implementation.

## Confirmed contract limitations

| ID | User impact and verified boundary | Triage proposal |
| --- | --- | --- |
| API-01 | **Cross-session output discovery is bounded.** The public artifact list requires one `sessionId`; no cross-session recent-artifacts/index operation is present in the current operations catalog. Flight Deck fans out over a bounded set of recent sessions, so an older session's recent output may be absent. This is not a complete output-history search. | Decide whether an authorized, paginated cross-session artifact index is needed. If adopted, define ordering, stable cursors, search, retention, ownership/sharing behavior, and canvas metadata. Do not infer access from a cached session list. |
| API-02 | **Server-side session filters are limited.** `listSessionsPage` already has keyset pagination, `includeDeleted`, `systemFilter`, and `viewerOnly`. It has no public `q`, state, agent, group, or wait-kind query parameter. Flight Deck's broader search/filtering remains client-side. | A scale requirement, not evidence of a broken API: decide which filters need server execution and define their interaction with cursors and viewer-scoped groups. Preserve the existing `viewerOnly` capability. |
| API-03 | **Audit inspection has a bounded window.** `listAuthzAudit` exposes `limit` and optional `sessionId`, with no cursor, date range, actor, or decision filter in its public contract. The current Flight Deck adapter requests 100 records. | Decide retention and investigation requirements before adding paging/filtering. Empty, forbidden, unavailable, and genuinely exhausted history must remain distinct. |

Evidence:

- API-01: [`listArtifacts` contract](../../../packages/sdk/api/src/protocol.js#L84),
  [current fan-out and result handling](../../../packages/flightdeck/src/routes/home.tsx#L203),
  [40-session limit disclosure](../../../packages/flightdeck/src/routes/outputs.tsx#L69).
- API-02: [`listSessionsPage` contract](../../../packages/sdk/api/src/protocol.js#L101),
  [management-client implementation](../../../packages/sdk/src/management-client.ts#L1088).
- API-03: [`listAuthzAudit` contract](../../../packages/sdk/api/src/protocol.js#L81),
  [management-client signature](../../../packages/sdk/src/management-client.ts#L1214),
  [Flight Deck audit request](../../../packages/flightdeck/src/data/live.ts#L239).

## Compound startup: an integration risk and a design decision

Flight Deck currently performs two operations: create the session, then send
the task as its first message. If creation succeeds and message submission
fails or its response is lost, the form can report a failed start even though
a durable session already exists. Starting again can create another session.
The new form's in-flight latch prevents simultaneous submissions; it does
not make this compound operation atomic or make a later retry idempotent.

The contract is more capable than a blanket “no initial-prompt API” claim:
`createSessionForAgent` already accepts `initialPrompt`. The current adapter
does not pass it. Generic `createSession` exposes neither `initialPrompt`
nor a creation-idempotency key in its declared parameters. `sendMessage`
already accepts `clientMessageIds` for message identity. This audit has not
proved atomicity or exactly-once execution for named-agent `initialPrompt`.

First consider an integration fix that preserves the returned session ID,
separates “session created” from “task delivery confirmed,” and retries an
uncertain first message with the same client message ID. Evaluate the existing
named-agent `initialPrompt` behavior before proposing another endpoint. A
uniform atomic/idempotent create-and-start operation is a **proposal requiring
a semantics decision**, not a confirmed backend defect.

Evidence: [current two-step adapter](../../../packages/flightdeck/src/data/live.ts#L148),
[generic and named-agent contracts](../../../packages/sdk/api/src/protocol.js#L66),
[`sendMessage` options](../../../packages/sdk/api/src/protocol.js#L70),
[form submission latch](../../../packages/flightdeck/src/routes/new-session.tsx#L70),
[frontend message-identity option](../../../packages/flightdeck/src/data/types.ts#L178).

## Existing capabilities to integrate before requesting backend work

| ID | Existing authoritative capability | Flight Deck integration limitation and next step |
| --- | --- | --- |
| INT-01 | **Provider-filtered usage exists.** `getProviderUsageSummary` accepts `days` and a comma-separated `providers` filter. Admins receive cluster usage; other viewers receive their own turns. | `DataSource.usageSummary()` has no query argument and calls the operation without parameters. The provider drawer therefore labels its chart as all-provider usage. Add adapter/query-key support for provider and reporting-window filters before claiming a missing backend endpoint. |
| INT-02 | **Effective session access exists.** `getSessionAccess` returns `visibility`, `relation`, `canWrite`, `canManage`, and `owner`. | The current source interface has no dedicated access read, and the live session adapter normalizes owner display without requesting this snapshot. Frontend visibility/owner hints are not canonical authorization. Integrate and refresh this operation for mutation affordances; keep the server authoritative, including targeted shares and admin scope. |
| INT-03 | **Creation policy exists.** `getSessionCreationPolicy` and `listCreatableAgents` are public operations. | Flight Deck reads the agent list but does not read creation policy through its source interface. Check generic-session permission and other declared creation rules before offering an unconditional generic-agent choice. This policy read does not itself prove worker readiness or credential connectivity; any broader readiness endpoint is a separate product proposal. |
| INT-04 | **Queued-message cancellation exists.** `cancelPendingMessage` accepts stable client message IDs. The SDK management client also implements it. | Flight Deck's source interface lacks cancellation and its local composer notices retain text rather than message IDs. “Dismiss notice” is deliberately not cancellation. Integrate stable IDs, durable receipt reconciliation, and this existing cancellation operation before offering a real Cancel action. Do not add a duplicate backend operation. |
| INT-05 | **Errors are lost in several adapter fallbacks.** Audit reads catch failures as `[]`; usage/fleet statistics catch them as `null`; some catalog reads similarly substitute empty arrays. | Screens cannot reliably distinguish no data from access denial or a failed read. Preserve typed failure state through the adapter and render retry or access recovery before interpreting those values as empty/zero. This is an adapter/error-propagation gap, not proof that the corresponding API lacks error responses. |

Evidence:

- INT-01: [public usage query and viewer scope](../../../packages/sdk/api/src/protocol.js#L299),
  [SDK summary method](../../../packages/sdk/src/management-client.ts#L5069),
  [argument-free source interface](../../../packages/flightdeck/src/data/types.ts#L196),
  [unfiltered live request](../../../packages/flightdeck/src/data/live.ts#L203).
- INT-02: [effective-access contract](../../../packages/sdk/api/src/protocol.js#L76),
  [SDK access method](../../../packages/sdk/src/management-client.ts#L1155),
  [live detail read](../../../packages/flightdeck/src/data/live.ts#L117),
  [frontend access hints](../../../packages/flightdeck/src/lib/session-access.ts#L16).
- INT-03: [agent list and creation policy](../../../packages/sdk/api/src/protocol.js#L211),
  [agent adapter](../../../packages/flightdeck/src/data/live.ts#L194),
  [new-session choices](../../../packages/flightdeck/src/routes/new-session.tsx#L133).
- INT-04: [cancellation contract](../../../packages/sdk/api/src/protocol.js#L73),
  [SDK cancellation method](../../../packages/sdk/src/management-client.ts#L4182),
  [current source methods](../../../packages/flightdeck/src/data/types.ts#L171),
  [composer notice and send handling](../../../packages/flightdeck/src/routes/session.tsx#L619).
- INT-05: [usage fallback](../../../packages/flightdeck/src/data/live.ts#L203),
  [profile/audit/fleet fallbacks](../../../packages/flightdeck/src/data/live.ts#L220).

## Suggested triage order

An additional SDK resilience review is warranted: `ApiClient.request()` awaits
`fetchImpl` without a request deadline or caller-provided abort signal in that
method's options. Its token lookup has a separate 12-second bound; that does not
bound the HTTP request. A connection that never settles can leave a screen in a
loading state. Decide cancellation/deadline semantics before changing the SDK,
and test a deliberately hanging response rather than treating this source
observation as proof of a production incident. Browser-only request blocking in
this audit did not produce a reliable rendered failure state and is not release
qualification. See [request implementation](../../../packages/sdk/api/src/api-client.js#L110).

1. Integrate canonical access and creation policy; preserve authorization and
   load-error distinctions. These affect whether an action should be offered.
2. Recover compound startup and retain stable queue/message identities. These
   affect duplicate work and whether the user's intended action actually ran.
3. Wire existing provider-filtered usage before expanding the usage API.
4. Decide scale requirements for cross-session outputs, session filtering,
   and audit investigation; design any new contracts against those requirements.

No item in this document authorizes backend changes, provider calls,
deployment, or data migration.
