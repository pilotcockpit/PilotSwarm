# Flight Deck UX → SDK coverage, 30 October 2026

The current UX has real SDK operations behind most server actions, including
Library package publishing, versions, files and editor permissions. It is **not
fully integrated**: several controls use incomplete session hints and the canvas
host omits existing interactive APIs. Group/flag response normalization has
since been corrected in frontend source; other gaps below remain.
Browser preferences and agent requests must remain identified as such.

This is a static audit of the current shared `dev` checkout, based at
`37cadb2c`, including concurrent uncommitted Flight Deck changes. This audit agent wrote only this
document; root-agent frontend corrections are reviewed in the closing section. No backend/API/SDK implementation, staging, commit,
browser mutation, database test or model call was performed. Existing audit
documents are inputs, not evidence of current behavior. Code pointers identify
this snapshot and may move while the other session edits the same files.

## Evidence and interpretation

- **SDK** means a current public operation or bespoke SDK transport method is
  connected in source. It does not mean a real server accepted the request.
- **Local** means browser memory/storage, navigation, clipboard or rendering.
- **Agent request** means a real `sendMessage` request asks an agent to act;
  delivery is not proof of the requested outcome.
- **Gap** distinguishes an existing API not integrated from a missing public
  contract. Neither is authorization to change the backend.

Flight Deck imports the actual `ApiClient` from `pilotswarm-sdk/api`
(`packages/flightdeck/src/data/live.ts:1`, `packages/flightdeck/vite.config.ts:27`). `DataSource.call` forwards to
`ApiClient.call`, which builds requests from the SDK's `OPERATIONS` catalog
(`packages/sdk/api/src/api-client.js:157`, `packages/sdk/api/src/protocol.js:321`). It does not
dispatch invented live RPC names. Per-area wrappers are in
`packages/flightdeck/src/data/ops/`; `packages/flightdeck/src/data/ops/use-op.ts:10` and `:26` preserve operation
errors and invalidate affected query keys.

An AST scan traversed **144 non-test JS/TS/TSX files** under Flight Deck `src`,
including all routes, components and operation adapters. The current SDK has
**178 catalog operations**. There are **111 distinct catalog operation-name
string references** in production source; this is a reference count, not a
completion percentage. Demo registrations contain **85 names: 83 real catalog
operations and two local fixture helpers**. The only unknown literal names in
the operation-call scan were `providers.rows` and `providers.models`, both
explicitly guarded by `source.kind === "demo"`
(`packages/flightdeck/src/data/ops/providers.ts:81`, `:93`). Dynamic provider and flag operation branches
were inspected; their names are real catalog operations. Direct calls with
literal parameter objects had no keys absent from their declared operation
parameters. This limited check does not validate nested payloads or response
semantics.

Fresh query caches are created per data source (`packages/flightdeck/src/data/source.tsx:48`); demo
registrations are loaded from `packages/flightdeck/src/data/ops/index.ts:2`. A missing demo operation
throws (`packages/flightdeck/src/data/ops/registry.ts:24`) rather than sending a live request. Fixtures
can still conceal shape/behavior differences; see the findings below.

Source pointers below are repository-relative; bare follow-on filenames and
line numbers refer to the file already named in that sentence or table row.

## Coverage matrix

### Overview, navigation, sessions and boards

| Visible action/data | UI → source/hook | Actual SDK operation(s) | Result and limits |
| --- | --- | --- | --- |
| Overview review counts, work cards, coming-next rows, navigation badges; session list, owner/state/agent/search/sort filters; Fleet wall | `packages/flightdeck/src/routes/home.tsx:26`; `packages/flightdeck/src/routes/sessions.tsx:38`; `packages/flightdeck/src/routes/fleet.tsx:23`; `packages/flightdeck/src/shell/AppShell.tsx:24` → `useSessions` → `live.listSessions` | `listSessions`; `getAuthContext()` for owner normalization | SDK rows, polled every 4 s. Filtering/tree reconstruction happens locally. List rows are not full live details; schedule/hold coverage is incomplete (F4). Uses unpaged listing despite an existing paging API (F11). |
| Review answer choices; Boards answers; session question card | `packages/flightdeck/src/components/needs-row.tsx:44`; `packages/flightdeck/src/routes/boards.tsx:188`; `components/chat.tsx` → `AnswerChoices`/`useGuardedAnswer`; `live.sendAnswer` | `getSession`; `sendAnswer` with `expectedQuestion` and `requireQuestionMatch: true` | Real guarded answer path. Fresh-read comparison precedes sending; `session.answer_rejected` is observed. Strict server behavior depends on the session's orchestration version; an API 200 is not proof the answer ran. |
| Failure Retry / Ask to retry | `packages/flightdeck/src/components/needs-row.tsx:21`; `packages/flightdeck/src/routes/session.tsx:568`; `packages/flightdeck/src/lib/retry.ts:15` | `sendMessage` with a stable `clientMessageId` across an uncertain retry | Agent request. It asks the agent to retry; it does not restart or replay a failed turn. The shared in-flight/ref guard is present. Keep it when changing review cards. |
| Open provider/admin/session/output; state facet, expand a failure group | Overview components, session rows and shell palette | No separate server mutation; destination reads use operations in this matrix | Local navigation/disclosure. Counts refer to accessible source rows, not an independently verified fleet total. |
| Recent output card and real preview | `packages/flightdeck/src/routes/home.tsx:204`, `:251` → `useRecentOutputs`, `readArtifact`; `components/artifact-preview.tsx` and `components/artifact-inspector.tsx` | `listArtifacts` per session; `downloadArtifact` for canvas HTML | Real artifact records and content. Overview inspects at most 8 recent non-system sessions. Files get a file representation; HTML is a sandboxed document preview. Failures/partial results have retry notices. Inspect opens a local read-only reading view of this same fetched HTML; its sanitizer disables form controls and links. It does not invoke or claim the absent canvas write/command bridge (F5). No synthetic content or generated preview image is required. |
| Output collection, canvases/files tabs, filename/session/agent search | `packages/flightdeck/src/routes/outputs.tsx:18` → `useRecentOutputs(mine, 40)` | `listSessions`; `listArtifacts`; `downloadArtifact` for canvas title | SDK aggregation, bounded to 40 recent accessible non-system sessions. UI discloses the bound; search is only over fetched results. A complete cross-session artifact index is absent (A1). |
| New session from shell, Library or empty states; model/effort/group/folder options | `packages/flightdeck/src/routes/new-session.tsx:35` → `useAgents`, `useModels`, `useProviders`, `useGroups`, `source.createSession` | `listCreatableAgents`, `listModels`, `listProviders`, `getProviderUsageGrid`; `createSession` or `createSessionForAgent`, then `sendMessage` | Real operations, with an in-flight submit latch. Creation policy is not read (F3), startup recovery is incomplete (F8), and folder options retain a server-root assumption (F12). Group identity normalization is corrected (F2). |
| Grouped session display; move to existing/new group; remove from group | `packages/flightdeck/src/routes/sessions.tsx:80`; `components/session/move-to-group.tsx` → `useGroupOptions`, `useCreateGroup`, `usePlaceInGroup` | `listSessionGroups`, `createSessionGroup`, `placeSessionsInGroup` | Move dialog normalizes `groupId/title` correctly and accepts `null` for ungrouped. General `useGroups` now receives the same normalized identity/title shape (F2 corrected). No group rename/delete control is currently connected. |
| Complete/Cancel/Delete one or selected sessions | `packages/flightdeck/src/routes/session.tsx:425`; `packages/flightdeck/src/routes/sessions.tsx:262` → DataSource lifecycle methods | `completeSession`, `cancelSession`, `deleteSession` | Real individual requests. Bulk uses `Promise.allSettled` and retains failed selections. No atomic bulk/cascade-preview contract (A4). `deleteSession` is cancel + **soft delete** per catalog, not a proven hard erase. Access controls still use hints (F1). |
| Create/select a board; add/remove/focus chat/canvas tiles | `packages/flightdeck/src/routes/boards.tsx:33`, `:56` | Board CRUD: none. Tile content: `getSession`, event reads/subscriptions, artifact reads | Local `fd.boards.v2`, at most five boards/sixteen tiles. Browser storage is explicitly disclosed. These are not shared or server-saved boards. |
| Chat tile prompt | `packages/flightdeck/src/routes/boards.tsx:194` | `sendMessage` (`enqueueOnly` when running) | Real prompt; permission hints and uncertain-send identity need the same follow-up as chat (F1/F8). |

### Session chat, sharing, canvas, files and activity

| Visible action/data | UI → source/hook | Actual SDK operation(s) | Result and limits |
| --- | --- | --- | --- |
| Session detail/header, transcript and timeline | `packages/flightdeck/src/data/source.tsx:87`, `:112`; `packages/flightdeck/src/data/session-stream.ts:33` | `getSession`, newest `getSessionEventsBefore`; `ApiClient.subscribeSession`; reconnect `getSessionEvents` paging | Initial transcript is newest 400 events; timeline displays at most 200 loaded events. Reconnect replay merges/deduplicates and retries failed gap reads. There is no older-history paging UI despite the existing API. |
| Rename; change model | `packages/flightdeck/src/routes/session.tsx:274`; `packages/flightdeck/src/components/model-switch.tsx:43` | `renameSession`; `setSessionModel` | SDK-backed manage operations. They must use `canManage`, not inferred writability (F1). |
| Send, queue, steer, stop | `packages/flightdeck/src/routes/session.tsx:658` → DataSource methods | `sendMessage` with `enqueueOnly`/`clientMessageIds`; `steerSessionTurn`; `stopSessionTurn` | Real turn control; explicit stop/steer outcomes are handled. Regular sends generate a new message identity per attempt (F8). Steering availability is learned by refusal rather than current effective flags/`acceptsTurnControl`. |
| Attach image/file, paste/drop, remove uploading chip | `components/session/attachment-tray.tsx`; `packages/flightdeck/src/data/ops/attachments.ts:116` | `listArtifacts`, `uploadArtifact`, best-effort `deleteArtifact`; `sendMessage` with image refs or `artifact://` text | Images carry `filename/contentType/sizeBytes`; non-images are agent-readable file references. Unique stored filenames prevent cleanup of another upload. Local chip removal is not guaranteed remote deletion for a writer lacking manage access. Limits remain JSON/base64-bound (A5). |
| Run now / Pause schedule | `packages/flightdeck/src/components/session/schedule-actions.tsx:16` | `sendMessage` containing the explicit request | Agent request, disclosed in the UI. No public schedule pause/resume/fire API is present (A2); a delivered request does not prove a timer changed. |
| Share audience; people picker; change visibility, grant/revoke role; Undo | `packages/flightdeck/src/components/session/share-sheet.tsx:32`; `packages/flightdeck/src/data/ops/sharing.ts:31` | `getSessionAccess`, `listSessionShares`, `listKnownUsers`, `setSessionVisibility`, `grantSessionShare`, `revokeSessionShare` | Canonical access **is integrated in Share**. Undo is another real mutation. Other session controls do not consume the same snapshot (F1). Access-history operation exists but has no Share-history view. |
| Copy session URL, full width, view/tab/split layout, zoom, external-link confirmation | Shell/session/canvas components | None needed | Local browser actions. Copy success should mean clipboard completion; several session copy handlers toast before awaiting it. |
| Display canvas slots and names, refresh artifact HTML | `packages/flightdeck/src/routes/session-views.tsx:36`, `:113` → `useArtifacts`, `readArtifact`, `CanvasFrame` | `listArtifacts`, `downloadArtifact` | Reads real `canvas.html` through `canvas5.html`; derives name from HTML. It does **not** wire the existing canvas live/KV/workspace bridge (F5). |
| Create/rotate/remove public canvas link; change who may edit inside canvas | `packages/flightdeck/src/components/session/share-canvas-dialog.tsx:63`; `packages/flightdeck/src/data/ops/canvas-share.ts:16` | `readCanvasKv`, `getCanvasShareLink`, `resetCanvasShareLink`, `removeCanvasShareLink`, `setCanvasKvAccess` | Real policy/link mutations, owner/admin gate derived from server relation. Raw token is component-lived and returned once. Public viewing is delegated to the classic portal, not implemented by Flight Deck. Policy controls do not supply the absent in-frame bridge (F5). |
| Files → Outputs list, preview, download | `packages/flightdeck/src/routes/session-views.tsx:124`, `:217` | `listArtifacts`, `downloadArtifact`; bespoke `/api/v1/sessions/:id/artifacts/:filename/download` | Real output download URL. No visible standalone Output upload, delete or retention-pin control; composer supplies uploads. Existing APIs already provide deletion, pin, base64 reads and cross-session copy (coverage omission, not missing contract). |
| Working folder settings; extra folders; retry held messages | `components/session/working-folder-dialog.tsx`; `packages/flightdeck/src/data/ops/workspace.ts:179` | `getSessionWorkspace`, `listSessionWorkspaceFolders`, `setSessionWorkspace` with `expectedRevision`, `retrySessionWorkspace` | Real revision-aware writes and explicit conflict choices. Actual root availability, ownership and held-message recovery are not live verified. |
| Folder browse/search; new file/folder; read/edit/save; upload/overwrite; rename/delete; download/zip | `packages/flightdeck/src/components/session/files/folder-pane.tsx:64`; `packages/flightdeck/src/components/session/files/file-viewer.tsx:65`; `packages/flightdeck/src/data/ops/workspace.ts:167` | `sessionWorkspaceFiles` with `list/find/stat/read/write/mkdir/move/delete/zip` | Real SDK file RPC. Etag `ifMatch` controls existing-file writes; drafts/unsaved guards are local. Owner-only files capability differs from session read/write. No database/file bypass. |
| Changes: repos, status, commits, commit details, working diff | `packages/flightdeck/src/components/session/files/changes-view.tsx:33` | `sessionWorkspaceFiles` with `op: git`, `what: repos/status/log/show/file`, plus `read` | SDK-backed read operations. Checkout/restore are not exposed; do not describe that as a missing backend operation. |
| Delegation tree, open child, stop child turn | `packages/flightdeck/src/routes/session-views.tsx:246` | `listSessions`; `stopSessionTurn` | Reconstructs tree locally. `listChildOutcomes` and `getChildOutcome` exist but are not read (F10). In-session native tasks are not added to this tree despite empty-state copy mentioning them. |
| Activity Logs | `packages/flightdeck/src/routes/session-views.tsx:374` → `subscribeLogs` | `ApiClient.subscribeLogs` (fleet-wide live stream) | UI discloses fleet-wide scope, but does not query `getLogConfig` or surface stream denial. No history/replay is available; member gating/error handling is incomplete (F6). |
| Activity Details: Numbers, Where it runs, durable history/export | `packages/flightdeck/src/routes/session-views.tsx:422`, `:442`, `:461` | `listWorkers`, `getOrchestrationStats`, `getExecutionHistory`, `exportExecutionHistory`; download via artifacts | Real operations with important fallbacks/role mismatches (F6/F7). Not full metric/memory telemetry. Where it runs explicitly says it shows the whole fleet, not session placement. |

### Library packages — explicit create/update/file/version/editor/adoption coverage

Package operations are present in all relevant public SDK layers. Current
management methods are in `packages/sdk/src/management-client.ts:5136` onward;
web-mode methods are in `packages/sdk/src/web/web-management-client.ts:455`
onward. `packages/sdk/api/src/protocol.js:217`–`:242` is the table contract.
An old repository instruction saying packages have zero management methods
and no artifact download is **stale** against this checkout.

| Visible action/data | UI → hook | Actual public operation(s) | Result and limits |
| --- | --- | --- | --- |
| Agents list, capability disclosure, usage badges, Start session | `packages/flightdeck/src/components/library/agent-rows.tsx:17` → `useAgents`, `useSessions`, `openNewSession` | `listCreatableAgents`, `listSessions`; then `createSessionForAgent` | Catalog-backed creation path. Tools are supplied when the catalog reports them; absent skills are not invented. Package-row Start now uses catalog names/version/scope and selected-copy ownership, with loading/error states disabled (F9 partially corrected). |
| Package list/search/Shared/Yours/Turned off; open package | `packages/flightdeck/src/routes/library.tsx:27`; `packages/flightdeck/src/components/library/package-list.tsx:33` → `usePackages` | `listAgentPackages` | Real summaries: active version/hash/manifest, owner/scope, enabled, shadowed, canEdit. Admins see all user packages. Yours now filters using the same ownership predicate as its count (F9 partially corrected). |
| Package metadata and complete version/editor lists | `packages/flightdeck/src/components/library/package-panel.tsx:30` → `usePackageDetail` | `getAgentPackage` | Detail carries `versions`, `activeVersionId`, `editors`; adapter resolves active version. Normal reads include name/scope plus other-owner selector for admins. Editor list need not separately call `listAgentPackageEditors`. |
| README/About, browse active or historic files, select text/binary file | `packages/flightdeck/src/components/library/package-panel.tsx:32`; `packages/flightdeck/src/components/library/package-files.tsx:34` → `usePackageTree`, `usePackageFile` | `getAgentPackageTree`, `getAgentPackageFile`, with optional `semver` and copy selector | Real tarball tree and content. Text is capped at 256 KB; binary content is identified, not text-rendered. No inline source editor is promised: editing means publish another complete version. Read failures must not become empty capabilities/About (F7). |
| Add package; choose folder/ZIP or drag/drop; preflight preview; Only me/Everyone | `packages/flightdeck/src/components/library/add-package.tsx:19`; `packages/flightdeck/src/components/library/package-source.ts:67` → `useUploadPackage` | Browser file analysis, then `uploadAgentPackage({files:[{path,contentBase64}],scope})` | The **same real operation creates a package or publishes/activates an update**. No invented `createPackage`/`updatePackage` op. Plugin name/version come from the uploaded files; server validates and packs. Local decoded content limit 2 MB; ZIP intake cap 4 MB. `noop` is shown distinctly. |
| Update existing package/version | Add dialog target/outcome preview (`packages/flightdeck/src/components/library/add-package.tsx:49`, `:58`) | `uploadAgentPackage` | Publish a complete file set with a new plugin version; server resolves caller-owned/shared target and may refuse rights/version conflicts. There is no per-file package write API integrated. |
| Turn on/off | `packages/flightdeck/src/components/library/package-panel.tsx:59` → `usePackageActions.setEnabled` | `setAgentPackageEnabled` with source copy selector | Real enabled state; does not prove workers applied it. Mutation invalidates package and agent catalogs. |
| Switch version / Roll back / Undo | `packages/flightdeck/src/components/library/package-versions.tsx:22` → `usePackageActions.pin` | `pinAgentPackageVersion` with `semver` and source copy selector | Undo sends the prior semver; stored publication and worker adoption are separate. No server revision compare is supplied by this contract. |
| Share with everyone / Make private | `packages/flightdeck/src/components/library/package-panel.tsx:140` → `usePackageActions.setScope` | `setAgentPackageScope` | Direction selects source copy: user→shared or shared→user. Owner selectors are forwarded for admin source selection. An existing shared package is updated by republish, not promote. |
| Update shared package / Copy into my private package | `packages/flightdeck/src/components/library/package-actions.tsx:74` → `usePackageActions.republish` | `republishAgentPackageVersion` | Publishes an existing version's exact bytes into the other scope; owner/admin/editor rules remain server-side. Source implied by `targetScope`. |
| Add/remove editor; Undo removal | `packages/flightdeck/src/components/library/package-editors.tsx:20` → `useKnownUsers`, `grant`, `revoke` | `listKnownUsers`, `grantAgentPackageEditor`, `revokeAgentPackageEditor` | Shared-copy-only editor contract, intentionally name+user (no missing scope parameter). Detail refresh supplies editor list. Directory failure currently looks like no match (F7). |
| Delete package | `packages/flightdeck/src/components/library/package-actions.tsx:13` → `usePackageActions.remove` | `deleteAgentPackage` with copy selector | Typed package-name confirmation. Session impact count is an inference from agent names, not an authoritative package dependency preview (F9/A4). |
| Worker adoption count/status and post-publication polling | `packages/flightdeck/src/components/library/package-list.tsx:18`, `:43`; `packages/flightdeck/src/data/ops/packages.ts:134`, `:204`; `packages/flightdeck/src/data/ops/adoption.ts:103` | `listAgentWorkerState` (**hard admin only**); refresh `listCreatableAgents` and package reads | Admin adoption is genuinely API-backed. Pending changes poll every 5 s for up to 120 s; member path refreshes catalog without obtaining worker state. These timers are local, not acknowledgements. Copy/owner settlement still has a limitation (F9). |
| Download full package/version | No visible action in current package panel | Existing `ApiClient.downloadAgentPackageResponse`; `HttpApiTransport.downloadAgentPackage`; management `downloadAgentPackage` | Existing backend/SDK capability omitted from this UX. Add a frontend action if desired; do not file a missing-download API request. |

### Providers, administration and settings

| Visible action/data | UI → source/hook | Actual SDK operation(s) | Result and limits |
| --- | --- | --- | --- |
| Provider list, status/badges, monthly use, limits grid, area totals | `packages/flightdeck/src/routes/providers.tsx:24`; `packages/flightdeck/src/data/ops/providers.ts:75`; `packages/flightdeck/src/data/live.ts:200` | `listProviders`, `getProviderUsageGrid`, `getProviderUsageSummary` | Real configuration/usage. Status is configuration + observed session failure, not a provider connection test. Aggregate summary is unfiltered intentionally; drawer usage is now filtered correctly. |
| Provider drawer Usage chart and model breakdown | `components/providers/provider-sheet.tsx`; `packages/flightdeck/src/data/ops/providers.ts:115` | `getProviderUsage({provider,days,dimension:"model"})` | Provider-specific operation with response normalizer `packages/flightdeck/src/data/ops/contracts.ts:11`. Prior INT-01 claim that drawer uses unfiltered usage is stale. |
| Add personal/shared provider; replace credential | `packages/flightdeck/src/components/providers/add-provider.tsx:69`; `packages/flightdeck/src/components/providers/provider-sheet.tsx:144` → `useCreateProvider`, `useRotateKey` | `getModelsByProvider`; `createMyProvider` / `createProvider`; `updateMyProviderCredential` / `updateSharedProviderCredential` | Real provider persistence. Key fields are masked/cleared before awaiting writes. No live credential connectivity is established by this audit. |
| Remove provider; optionally clear routing/default dependencies first | `packages/flightdeck/src/components/providers/provider-sheet.tsx:123` | `clearProviderRoutingDependencies`, `deleteMyProvider` / `deleteProvider` | Two real operations, not atomic. If removal fails after clearing routing, defaults may already have changed; report that partial outcome. |
| Set/change/remove provider or model token limit; Undo removal | `packages/flightdeck/src/components/providers/limits.tsx:41`, `:48`, `:121` | `setProviderLimit`, `removeProviderLimit` | Existing typed contract; exact integer editing present. Personal/shared manage rights are gated from UI data; server remains authoritative. |
| Allowance; hold until/custom/indefinite/release; permit system use | `packages/flightdeck/src/components/providers/limits.tsx:166`, `:195`; `packages/flightdeck/src/components/providers/provider-sheet.tsx:90` | `setProviderAllowance`, `setProviderHold`, `setProviderSystemUse` | Real admin mutations; release does not independently prove all paused sessions resumed. |
| Paused-work list; open source session/provider; raise allowed limit | `components/providers/paused.tsx`; `packages/flightdeck/src/data/ops/providers.ts:125` | `listPausedSessions`; subsequent limit/hold operations above | Real pause records; bounded list and no attention-feed cursor (A1/A3). Demo reads richer fixture pause state directly. |
| User/cluster/system default; reasoning; system-agent override/clear; optional restart | `packages/flightdeck/src/components/providers/defaults.tsx:57`; `packages/flightdeck/src/data/ops/providers.ts:200` | `getModelDefaults`, `listModels`, `setModelDefault`, `setSystemModelDefault`, `setSystemSessionModel`, `clearSystemSessionModel` | Real default tuples and Undo mutations. Some edits force `contextTier:null`, even when an existing context choice is not displayed. Optional system restart outcome still needs checking live. |
| Legacy system Copilot key migration | `packages/flightdeck/src/components/providers/legacy-key.tsx:18` | `getLegacyProviderMigrationStatus`, `adoptLegacySystemGitHubCopilotKey` | Existing admin migration API; not a model probe. Demo status hides the banner and has no adopt mutation fixture; that flow is not demo-tested merely because the screen renders. |
| Admin Overview, Workers, installed package matrix, Cluster usage, Access & audit | `packages/flightdeck/src/routes/admin.tsx:31`, `:73`, `:98`, `:125`, `:166`; `packages/flightdeck/src/components/admin/worker-packages.tsx:15` | `listWorkers`, `listSessions`, `listFeatureFlags`, `getClusterFeatureFlags`, `listAgentWorkerState`, `getFleetStats`, `listAuthzAudit` | Real APIs; access is server-enforced. Flag count adapter is corrected in frontend source (F2); remaining fallbacks hide read failures (F7). Audit requests last 100 records, no posture verification. Profile-loading gate has a gap (F6). |
| Cluster on/off/allow overrides/reset; person overrides; history; worker delivery | `packages/flightdeck/src/components/admin/flags-panel.tsx:21`; `packages/flightdeck/src/data/ops/flags.ts:67`, `:140` | `getClusterFeatureFlags`, `getUserFeatureFlags`, `listFeatureFlagUsers`, `listFeatureFlagChanges`; `setClusterFeatureFlag`, `resetClusterFeatureFlag`, `setUserFeatureFlag`, `unsetUserFeatureFlag`; `listWorkers` | Real revision-bound writes and Undo, with conflicts surfaced. Dedicated flag pages use correct `featureKey/effective` view; the separate Overview adapter does not. Delivery uses ready/recent worker-reported revisions. |
| Restart system session; restart failed batch; stop/delete/remove without replacement | `packages/flightdeck/src/components/admin/system-sessions-panel.tsx:32`, `:125` → `useRestartSystemSession` | `restartSystemSession` with `disposition`, `startReplacement`, reason | Real operational API. Individual result distinguishes skipped/retired/start failures; batch failure can stop the loop after earlier successes. No atomic batch promise. |
| Knowledge health, stats/tombstones; embedder start/stop; lookup; graph namespaces edit/delete; purge | `components/admin/knowledge-panel.tsx`; `packages/flightdeck/src/data/ops/knowledge.ts:25` | `factsCapabilities`, `getSharedFactsStats`, `getFactsTombstoneStats`, `getEmbedderStatus`, `startFactsEmbedder`, `stopFactsEmbedder`, `searchFacts`, `listGraphNamespaces`, `graphStats`, `upsertGraphNamespace`, `deleteGraphNamespace`, `forcePurgeFacts` | Real capabilities/operations; capability and error states matter. Purge preview is a broad upper bound, not server dry run (A6). Node/edge editing and session memory views are absent, not new backend requirements. |
| Maintenance prune summaries | `packages/flightdeck/src/components/admin/maintenance-panel.tsx:42` → `usePruneSummaries` | `pruneDeletedSummaries` with timestamp | Real admin deletion of old summary records; typed confirmation. A returned numeric count is shown. |
| Settings profile; personal feature choices and Undo | `packages/flightdeck/src/routes/settings.tsx:71`; `packages/flightdeck/src/components/settings/personal-flags.tsx:16` | `getCurrentUserProfile`, `getAuthContext()`; `getMyFeatureFlags`, `setMyFeatureFlag`, `unsetMyFeatureFlag` | Profile read-only; flags server-persisted and revision-aware. No editable-profile operation is implied by this screen. |
| Theme, keyboard help, notifications, Live/Demo, recent agents, rail/split state, seen markers | `packages/flightdeck/src/routes/settings.tsx:55`, `:82`, `:94`; `shell/prefs.ts`; `shell/notifications.tsx`; `packages/flightdeck/src/routes/session.tsx:623` | Preference writes: none. Notifications read `listSessions` through normal polling | Local browser choices. Background notifications require this app/tab to remain running; no push/service-worker delivery is connected. `setCurrentUserProfileSettings` exists but is not used. |
| Sign-in/bootstrap/admission recovery | `packages/flightdeck/src/main.tsx:8`; `packages/flightdeck/src/data/live.ts:75`, `:97`, `:222` | Only `getAuthContext()`/profile reads are connected; SDK also has `getAuthConfig()` and `getBootstrap()` | Auth-disabled or externally authenticated proxy arrangements may work. Flight Deck has no auth discovery/token acquisition/admission gate of its own (F13). |

## Frontend findings — current status and existing API integrations

1. **F1 — Effective access is isolated in Share, not applied across controls.**
   `packages/flightdeck/src/data/ops/sharing.ts:31` reads canonical `getSessionAccess`, but
   `packages/flightdeck/src/data/source.tsx:87` returns list/detail merges without that snapshot.
   `packages/flightdeck/src/lib/session-access.ts:16`, `packages/flightdeck/src/routes/session.tsx:433`, `:648`, Boards and
   Overview act on hints. Raw management views do not return `canWrite` or
   `canManage` (`packages/sdk/src/management-client.ts:1383`); runtime returns
   them separately (`packages/app/web/runtime.js:1118`). A targeted writer to
   `shared_read` can be incorrectly blocked, while a private read grantee may
   see send/manage controls. Minimal follow-up: share one canonical access
   query across detail/list action hooks, fail closed while unresolved, and
   distinguish write from manage. Existing API, not a new endpoint.

2. **F2 — Corrected in frontend source; live integration unverified.**
   `packages/flightdeck/src/data/live-normalizers.ts:6` maps SDK
   `{groupId,title}` to the common `{id,name}` group view.
   `normalizeFeatureFlags` at `:11` reads row-keyed `featureKey`,
   `defaultEnabled` and `effective`, preserving explicit `false` through
   nullish-coalescing rather than falling back to the default. Current
   `packages/flightdeck/src/data/live.ts:212` calls both normalizers and no
   longer converts flag/group read failures to empty results. This matches
   current `FeatureView` (`packages/sdk/src/feature-store.ts:11`) and
   `SessionGroupRow` reads (`packages/sdk/src/management-client.ts:1470`). The fixture tests
   cover group identity, effective true and explicit false. This is an
   independently inspected frontend mapping correction, not proof that any
   live server accepted the reads or that a denied read is rendered everywhere.

3. **F3 — New-session eligibility ignores an existing public policy.**
   `packages/flightdeck/src/routes/new-session.tsx:136` always offers Generic. No production call
   reads `getSessionCreationPolicy`, which exists at SDK `packages/sdk/api/src/protocol.js:212`.
   A preselected named agent is not revalidated against the current catalog at
   submission; package-row selection itself is now catalog-guarded (F9). Follow-up: use declared policy and catalog
   eligibility; retain authoritative server refusal. This is separate from
   worker/model readiness, for which no single readiness contract is present.

4. **F4 — Overview schedule/hold/enrichment data is not in the list used to
   build it.** `sessionViewFromCmsRow` returns `waitReason` and summaries,
   **not** cron fields, `pendingQuestion`, `pauseState`, `waitUntil`, `spine`,
   `step` or `unseenCanvas` (management `:406`). `HomePage` classifies those list
   rows before reading detail (`packages/flightdeck/src/routes/home.tsx:35`); only needs-you cards read
   detail. Thus real questions can have choices, but Coming next cannot obtain
   cron timing merely from the current list, holds may be absent, and unseen
   canvas badges are fixture-only. `getSession` does supply cron/question data
   (`packages/sdk/src/management-client.ts:1406`); `listPausedSessions` supplies real holds.
   Follow-up: compose bounded existing reads or omit unavailable enrichments;
   label unknown data and keep counts tied to returned sessions. A consolidated
   attention feed is optional upstream design, not permission to invent data.

5. **F5 — Canvas display/link policy is wired; interactive canvas behavior is
   not.** `packages/flightdeck/src/canvas/CanvasFrame.tsx:21` handles only external-link messages. It
   receives no session/slot/source; no in-frame `canvas-kv`, workspace call,
   command or live-event bridge is installed. The classic host implements these
   paths (`packages/app/ui/react/src/web-app.js:8315`, `:8461`). Existing
   `readCanvasKv/writeCanvasKv`, `canvasWorkspace`, `getCanvasLive` and SDK
   canvas subscriptions should be integrated if interactive apps are claimed.
   Follow-up: reuse audited bridge contracts with per-message/session access
   checks and error replies. Until then, describe Flight Deck as a static
   sandboxed document viewer; changing edit policy does not enable interaction
   here. No backend extension is needed for those existing capabilities.

6. **F6 — Fleet/admission-dependent views lack complete gates and recovery.**
   `CapacityLine` always calls `useWorkers` (`packages/flightdeck/src/components/capacity-line.tsx:12`),
   and Activity Nodes does the same (`packages/flightdeck/src/routes/session-views.tsx:422`), although
   `listWorkers` is hard admin-only (`packages/sdk/api/src/protocol.js:220`). Logs subscribes without
   `getLogConfig` and cannot distinguish forbidden/unavailable from waiting.
   `AdminPage` renders its content while profile is still undefined
   (`packages/flightdeck/src/routes/admin.tsx:36`). Follow-up: wait for resolved role/access, gate fleet
   reads, and render capability/denial/retry states using existing APIs. No
   claim is made about a real deployment's enforcement from these UI hints.

7. **F7 — Empty fallbacks and hidden errors still obscure SDK failure.**
   `packages/flightdeck/src/data/live.ts:206` and the profile, audit, fleet,
   orchestration-stats and execution-history methods still catch failures as
   null/empty defaults. Flag/group reads now propagate errors (F2 corrected).
   Canvas artifact failures become “No canvas yet” or blank HTML
   (`packages/flightdeck/src/routes/session-views.tsx:36`); Files output-list errors become an empty
   state (`:126`, `:182`). Package About/capability reads ignore their errors
   (`packages/flightdeck/src/components/library/package-panel.tsx:81`, `:104`), and editor directory
   failure becomes “No one matches” (`packages/flightdeck/src/components/library/package-editors.tsx:69`). Follow-up:
   preserve query errors and offer retry/access recovery. Overview output
   aggregation already preserves failures; do not regress that implementation.

8. **F8 — Startup and ordinary resend lack durable attempt recovery.**
   `packages/flightdeck/src/data/live.ts:150` creates then sends; if send fails, the created ID is lost to
   the form. Named creation already accepts `initialPrompt` in `packages/sdk/api/src/protocol.js:67`
   but this adapter does not use it. Composer requests carry text, then live
   send generates a fresh ID on each retry (`packages/flightdeck/src/routes/session.tsx:681`;
   `packages/flightdeck/src/data/live.ts:133`; `packages/flightdeck/src/data/ops/attachments.ts:233`). There is no durable pending
   queue reconciliation/cancel action despite `cancelPendingMessage`.
   Follow-up: retain the created session ID and first-message attempt ID;
   retain message IDs across uncertain sends; reconcile delivery and use
   existing cancellation only when identified. Keep `useRetry`'s stable-ID
   behavior. Atomic generic create-and-start remains an API design decision.

9. **F9 — Launch/filter corrections verified in source; impact/adoption open.**
   `packages/flightdeck/src/components/library/package-list.tsx:51` now applies
   the same `packageRights(...).mine` predicate as its Yours count. Package
   starts use the real catalog name/title through
   `packages/flightdeck/src/components/library/package-eligibility.ts:5` and
   `packages/flightdeck/src/components/library/package-panel.tsx:43`.
   Disabled/shadowed/no-active packages, absent metadata, scope/version
   mismatches, loading and catalog error states cannot start from these rows.
   Private copies additionally require explicit selected-copy ownership from
   `isSamePerson(pkg.owner, profile)`, so an unresolved profile fails closed.
   This review caught an initial same-name/same-version collision: an admin
   viewing someone else's private copy could otherwise borrow their own
   `mine:true` catalog row. The selected-copy ownership guard and regression
   case now cover that scenario. These are frontend availability guards,
   not proof of server authorization or worker adoption.

   Remaining: session-impact counts at
   `packages/flightdeck/src/components/library/package-panel.tsx:53` match
   filename-derived agent names, not selected package identity; “No running
   sessions” is not proven. Adoption target lookup still ignores
   `ownerSubject` (`packages/flightdeck/src/data/ops/adoption.ts:94`) even
   though pending keys carry it, so multiple admin-visible user copies can
   select the wrong active target. Qualify inferred impact counts and match
   adoption targets by owner. A full authoritative dependency preview would
   need separately designed upstream support.

10. **F10 — Delegation/results and Activity telemetry omit existing APIs.**
    `packages/flightdeck/src/routes/session-views.tsx:246` infers children from the catalog and tells a
    completed row to open for its verdict, but never reads `getChildOutcome` or
    `listChildOutcomes`. Activity Stats only reads orchestration stats and
    session fields (`:461`); existing `getSessionMetricSummary`,
    `getSessionTreeStats`, `getSessionSkillUsage`, facts/retrieval/graph stats
    can supply richer reporting without new backend endpoints. Follow-up:
    connect only the displayed measures/result fields; trim unsupported copy.

11. **F11 — Scale gaps include unintegrated paging as well as absent filters.**
    `packages/flightdeck/src/data/live.ts:116` uses unpaged `listSessions`; `useSessions` polls it every 4 s.
    `listSessionsPage` already exposes keyset cursors/systemFilter/viewerOnly
    (`packages/sdk/api/src/protocol.js:101`). Transcript has no older-history affordance even though
    `getSessionEventsBefore` exists. Follow-up: wire current paging before
    proposing broader query/filter contracts. No live latency/load conclusion
    follows from this source review.

12. **F12 — New-session working folder assumes a server root.**
    `packages/flightdeck/src/routes/new-session.tsx:81` hardcodes `{root:"main",folder:repo}`. The SDK
    accepts the payload but does not guarantee a root called main; the existing
    working-folder dialog reads server roots/defaults. Follow-up: use supported
    roots/defaults or defer folder selection until that information is read.

13. **F13 — Live authentication discovery is incomplete.**
    `packages/flightdeck/src/main.tsx:8` mounts the app directly; `packages/flightdeck/src/data/live.ts:75` supplies ApiClient only
    `apiUrl`, with no access-token getter or unauthorized/forbidden hooks.
    `getAuthConfig/getBootstrap` exist; Flight Deck does not use them. Follow-up:
    integrate deployment-auth discovery and the corresponding auth gate, or
    explicitly constrain the preview to the supported none/proxy/dev setup.
    Do not infer sign-in/authorization success from a healthy endpoint.

## Missing or deliberately local contracts — upstream triage only

| ID | Boundary verified in current catalog | Safe current behavior / decision needed |
| --- | --- | --- |
| A1 | No cross-session artifact/canvas catalog; artifacts require sessionId. | Keep bounded recent-session aggregation and disclosures. A full outputs index needs scope/cursor/search/ordering design. |
| A2 | No public schedule pause/resume/fire/cancel operation; no exact failed-turn replay operation. | Keep honest agent-message controls and outcome language. Direct schedule/replay semantics require separate design. |
| A3 | Session page API has pagination but no text/state/agent/group query filters; audit has limit/sessionId but no cursor/filter history. No unified attention feed. | Client filters and bounded audit are usable with disclosures. Integrate existing paging first, then decide scale requirements. |
| A4 | No public atomic bulk lifecycle/cascade or package-session dependency preview; no reopen operation for completed/cancelled session. | Report each actual lifecycle result; qualify descendant/impact estimates. Current lifecycle UI does not advertise a false server Undo. |
| A5 | Artifact uploads use JSON/base64. Protocol describes 2 MB while actual middleware grants a larger artifact body cap; no public streamed upload/progress operation is connected. | Keep explicit UX caps; do not treat the protocol description as proof of the live server's limit. No provider connection-test operation exists either. |
| A6 | `forcePurgeFacts` has no public dry-run parameter. | Describe local broad counts as “up to”, not an exact matching/purge result. Real returned purge count is authoritative after the authorized action. |
| A7 | No dedicated server Board resource/version contract; no canvas app catalog operation. | Boards are browser-saved. Library links to Outputs instead of inventing app discovery. Existing profile settings replacement is an available persistence primitive, not a board concurrency contract. |
| A8 | Package fleet adoption is hard admin-only; no redacted author/editor adoption endpoint. | Show worker adoption only to admins; catalog refresh for a member does not prove adoption. Any broader report is a separately scoped API proposal. |
| A9 | Session-list/enrichment pushes are not provided as a catalog topic; fleet log tail is live-only. | Poll supported reads, disclose freshness; do not promise catch-up for logs or backend-proven unseen canvas state. Canvas-specific live data is already available and separately unintegrated (F5). |

## Reconciliation with earlier inputs

- `api-sdk-triage.md` INT-01 is superseded for the **provider drawer**, which now
  uses filtered `getProviderUsage`; the area summary remains all-provider.
- INT-02 is partly superseded: Share uses `getSessionAccess` today; the broader
  action-gating gap remains F1. INT-03/04/05 and startup recovery remain open.
- `OPEN-ITEMS.md` G3 overstates missing `waitReason`: current CMS list rows
  return that field. Cron/question/pause/enrichment limits remain as in F4.
- Current public package management methods and binary download invalidate the
  older blanket “no management methods/no package download” statements.
- The capability map is a proposed destination, not implemented parity. Reads
  such as `listSessionsPage`, `getSessionCreationPolicy`, `getCanvasLive`,
  `listChildOutcomes` and many telemetry operations appear there but are not
  thereby wired in Flight Deck.
- Live validation remains open (`OPEN-ITEMS.md` V5). Demo and fixture tests do
  not establish live parameter acceptance, permissions, rollout timing, auth
  recovery, race behavior, provider connectivity, or production readiness.

## Checks actually performed

1. Ran `python3 ~/.agent-skills/scripts/agent_policy.py context --cwd "$PWD"`;
   read resolved owner policy, complete project contract, shared repository
   instructions, CONTRIBUTING and custom-UX integration guide.
2. Inspected `git status --short`, `git diff --cached --stat`, and
   `git worktree list`; stayed on shared `dev`, preserving existing staging.
3. Used `rg --files`, `rg -n`, `cat`, and `sed -n` across Flight Deck routes,
   components, data/ops/live/DataSource and corresponding SDK protocol,
   ApiClient, management/web-management, runtime and classic canvas handlers.
4. Ran credential-free `node --input-type=module` inline scripts using installed
   TypeScript's `createSourceFile`/`forEachChild` to scan every non-test source
   file for literal operation names, operation calls, parameter keys, demo
   registration object keys and dynamic call sites; compared against imported
   `OPERATIONS`. Results and the scan's limitations are recorded above.
5. Verified this document's source paths and line references and ran a
   whitespace check on the new document. No runtime tests, network requests,
   provider calls, staging, privacy-index scan or live integration test ran for
   this document-only audit.

## Follow-up source review of frontend corrections

Independently inspected the root agent's new group/flag normalizers, package
eligibility helper, package-panel wiring, Yours predicate, current Agent type
metadata, and dynamic demo catalog plus associated fixture tests. The demo
catalog now reads enabled, unshadowed active fixture copies and canonical
frontmatter agent names with package name/scope/active semver; it remains a
fixture and does not establish real worker/catalog convergence. Re-ran the
credential-free AST name scan: 144 non-test files, 178 catalog operations, 111
operation-name references; the only unknown calls remain the two explicitly
demo-guarded provider helpers. No live request or runtime test was performed by
this audit agent. Any fixture-test execution reported by the root remains
fixture evidence, not live authorization or rollout qualification.

F2 is source-corrected. F9 Yours filtering and catalog/selected-copy launch
guards are source-corrected; impact estimates and owner-aware adoption remain
open as described in F9.
F1, F3–F8 and F10–F13 remain open. The new read-only output Inspector reads
actual stored artifact HTML and deliberately disables document actions; it does
not close F5 or add a backend requirement. Priorities remain shared canonical
access/policy, canvas capability truthfulness, preserved read errors and
recoverable message identity. Backend changes stay in separately approved
triage work.
