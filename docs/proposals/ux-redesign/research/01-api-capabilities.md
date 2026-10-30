# 01 — Portal Web API and backend capability catalog

Research input for the portal UX redesign. Audited on branch `dev` at `2a50ca25`
(2026-10-30). This is a read-only audit: no code was run against a live deployment.
**Code is the source of truth.** Where the docs disagree with the code, §6 lists the difference.

## How to read this

**Path abbreviations used in citations (`X:line`)**

| Key | File |
|---|---|
| P | `packages/sdk/api/src/protocol.js` — the operations table, the single contract source (178 operations) |
| RT | `packages/app/web/api/router.js` — generates `/api/v1` from P |
| S | `packages/app/web/server.js` — bespoke and legacy routes, body limits, WS mount |
| R | `packages/app/web/runtime.js` — `PortalRuntime.call()`, the single dispatch and authz chokepoint |
| WS | `packages/app/web/api/ws.js` — the WebSocket server |
| LP / CP | `packages/app/web/api/live-plane.js` / `canvas-plane.js` — Postgres LISTEN relays |
| AZ | `packages/app/web/authz.js` |
| AU | `packages/app/web/auth/**` (`index.js`, `config.js`, `authz/engine.js`, `providers/*.js`) |
| SA | `packages/sdk/api/src/session-authz.js` |
| AS | `packages/sdk/api/src/admin-scope.js` |
| AD | `packages/sdk/api/src/admin-diagnostics.js` |
| HT | `packages/sdk/api/src/http-api-transport.js` — the browser's data layer (`BrowserPortalTransport` extends it) |
| AC | `packages/sdk/api/src/api-client.js` — fetch and WS client, reconnect, live-plane sequencing |
| T | `packages/app/tui/src/node-sdk-transport.js` — the server-side transport the runtime calls |
| M | `packages/sdk/src/management-client.ts` |
| `src/…` | `packages/sdk/src/…` |
| C | `packages/app/ui/core/src/controller.js` |
| W | `packages/app/ui/react/src/web-app.js` |
| H / SEL | `packages/app/ui/core/src/history.js` / `selectors.js` |

**The "UI" column** says whether the portal exposes the capability today:

| Value | Meaning |
|---|---|
| **YES** `C:n` | The portal calls it; the citation is the first call site |
| **PARTIAL** | Called only indirectly or internally, or exposed in a limited way |
| **NO** | The browser transport has a method, but no UI code calls it |
| **NO-T** | Not even the browser transport (HT) exposes it. The UI cannot call it without new client code |

The NO / NO-T values come from a grep of `packages/app/ui` and `packages/app/web/src` (tests excluded) for every operation name and transport method.

**Access classes** come from P:18-34 and are enforced in `R._authorizeCall` (R:278-353):

| Class | Who may call |
|---|---|
| `authed` | Any admitted caller |
| `session:list` | Viewer-scoped listing |
| `session:read` / `session:write` | Read or write access to the session tree |
| `session:manage` / `session:destroy` / `session:share` | Owner or admin |
| `session:files` | Owner only — admins get no special access (SA:83-94) |
| `session:copy` | Read access on the source and write access on the target (R:339-345) |
| `canvas:read` / `canvas:write` | Session read, then the canvas policy decides (R:321-323) |
| `group:list` / `group:manage` | Group owner, or admin |
| `facts:read` / `facts:write` | See R:444-456 |
| `authz:audit` | Admin; an owner may read audit for one of their own sessions (R:330-337) |
| `fleet:read` | Admin observability |
| `fleet:admin` | Admin — a hard gate at RT:206 and R:303 |

---

## 1. Capability catalog by domain

There are 178 JSON operations. Routes are the operation's `path` under `/api/v1`. Every JSON response is wrapped as `{ok:true,result}` or `{ok:false,error:{code,message,…}}` (RT:17, RT:64-70).

### 1.0 Platform, bootstrap and auth (bespoke routes)

| Capability (user terms) | Route | Auth | Notes | UI |
|---|---|---|---|---|
| Health / readiness | `GET /api/v1/health` (RT:126-128); legacy `GET /api/health` (S:181-189) | public | `{started, mode, apiVersion, authz}`. The **authz posture is public**: adminScope, ownershipEnforced, defaultVisibility, systemVisibility (R:247-251) | no |
| Auth discovery | `GET /api/v1/auth/config` (RT:130-136); legacy `/api/auth-config` (S:205-213) | public | `{enabled, provider, displayName, client}`. Dev provider adds `banner` and a persona roster (AU providers/dev.js:107-116). Entra adds `client{clientId, authority, redirectUri}` (entra.js:63-73). Proxy: `client:null` (proxy.js:129-139) | YES (sign-in) |
| Portal branding and config | `GET /api/portal-config` — **legacy only, no `/api/v1` equivalent** (S:191-203) | public | `{portal:{branding{title, pageTitle, splash, logoUrl, faviconUrl}, ui{loadingMessage, loadingCopy}, auth{signInTitle, …}, docs, linkOrigins?, workspaceFiles}, auth}` (`packages/app/tui/src/plugin-config.js:167-251`, S:137-142) | YES `web/src/App.jsx:131` |
| Branding assets | `GET /api/portal-assets/:assetName` (S:348-357) | public | logo and favicon, cached 1 h | YES |
| Who am I | `GET /api/v1/auth/me` (RT:141-143) | authed | `{principal{provider, subject, email, displayName, tenantId, groups, roles}, authorization{allowed, role, reason, matchedGroups}}` (AU authz/engine.js:170-203) | YES |
| Bootstrap | `GET /api/v1/bootstrap` (RT:145-152; R:619-657) | authed | `{mode, workerCount, logConfig, defaultModel, modelsByProvider (provider_type), creatableAgents (baked + shared only), sessionCreationPolicy, authz{…}, apiVersion, auth}`. A 403 here flips the app to the "access denied" gate (AC:119-126) | YES |
| Worker count / log config | `GET /system/workers`, `GET /system/log-config` (P:305-306) | authed | The UI reads both from bootstrap, not the ops (HT:91-97). Log config: `{available, availabilityReason}` — kubectl / in-cluster / local dir (T:929-965) | PARTIAL (C:2622, C:2634 via bootstrap) |
| Legacy RPC | `POST /api/rpc {method, params}` (S:299-315) | authed | Same dispatcher as `/api/v1`; still mounted ("deprecation window", S:294-296) | not used by portal (`web/src/browser-transport.js:13-18`) |

### 1.1 Sessions and chat

| Capability | Operation → route | Access | Inputs | States / errors | UI |
|---|---|---|---|---|---|
| List my sessions (paged) | `listSessionsPage` → `GET /management/sessions` (P:101) | session:list | `limit` (1–200, default 50, R:44), `cursor{updatedAt, sessionId}` (JSON query), `includeDeleted`, `systemFilter` (`all\|only\|exclude`), `viewerOnly` | Keyset paging: `{sessions, hasMore, nextCursor}`. Bad cursor throws a 400-classified message (R:43-69) | YES `C:203`. The UI **walks every page every 4 s** (C:202-231, C:2645-2656) |
| List sessions (flat) | `listSessions` → `GET /sessions` (P:65) | session:list | — | Unfiltered for admins and when enforcement is off (R:677-680) | PARTIAL (fallback only, C:204) |
| Get session view | `getSession` → `GET /sessions/:id` (P:68) | session:read | — | Live status, `viewerGroupId`, `pendingQuestion`, `cron*`, `contextUsage`, `acceptsTurnControl` (M:1381-1427) | YES `C:2799` |
| Create session | `createSession` → `POST /sessions` (P:66; R:912-924) | session:create | `model`, `reasoningEffort` (`none\|minimal\|low\|medium\|high\|xhigh\|max`), `contextTier` (`default\|long_context`) (`src/model-providers.ts:23,31`), `groupId` (must be the caller's own, R:531-539), `visibility`, `workspace{root, folder?}` | `MODEL_AMBIGUOUS` (400, with `candidates` `provider:model`), `MODEL_UNRESOLVED` (400) (`src/provider-catalog.ts:40-55`). Owner is server-stamped | YES `C:6627` |
| Create session for an agent | `createSessionForAgent` → `POST /sessions/for-agent` (P:67; R:925-942) | session:create | `agentName`, `title`, `splash`, `splashMobile`, `initialPrompt`, plus all createSession inputs | Subject to the creation policy: allowlist or open, `allowGeneric`, `defaultAgent` (`src/types.ts:1255-1271`). Response omits `contextTier` (T:1415-1420) | YES `C:6638` |
| List agents I can start | `listCreatableAgents` → `GET /agents` (P:211) | authed | — | `{name, title, description, splash, initialPrompt, tools, source: builtin\|package, packageName/Semver, scope, mine, ownerLabel}` (T:361-385, 643-722) | YES `C:7247` |
| Creation policy | `getSessionCreationPolicy` → `GET /session-creation-policy` (P:212) | authed | — | — | PARTIAL (bootstrap copy only) |
| Send a message | `sendMessage` → `POST /sessions/:id/messages` (P:70; R:1078-1110) | session:write | `prompt`, `options{enqueueOnly?, clientMessageIds?, attachments?:[{filename}], origin?}` | Fire-and-forget; progress arrives as events. Sender is server-stamped (R:1562-1574). Attachments: ≤4 images, ≤4 MB each, ≤8 MB total, png/jpeg/gif/webp only (`src/types.ts:2055-2067`), else `INVALID_ATTACHMENT`. Terminal session → 409 "cannot accept new messages". Body ≤ 2 MB. `[canvas-action] ` prefix is restricted to writers (R:1091-1104) | YES `C:2312` |
| Answer the agent's question | `sendAnswer` → `POST /sessions/:id/answers` (P:71; R:1111-1115) | session:write | `answer`, `options.expectedQuestion{question, iteration}` | Binds only if the text and iteration match; otherwise it runs as a plain message (`src/orchestration/queue.ts:1297-1318`). Choices are not enforced server-side | YES `C:9444`. Choices render as a text list, not buttons (SEL:1724-1757) |
| Cancel queued messages | `cancelPendingMessage` → `POST /sessions/:id/cancel-pending` (P:73) | session:write | `clientMessageIds[]` | Emits `pending_messages.cancelled` | YES `C:1947` (outbox) |
| Send a custom event | `sendSessionEvent` → `POST /sessions/:id/events` (P:72) | session:write | `eventName`, `data` | — | **NO-T** |
| Stop the running turn | `stopSessionTurn` → `POST /management/sessions/:id/stop-turn` (P:105; R:1245-1256) | session:write | `options{reason?, timeoutMs? (default 30 s, max 300 s), requestId?}` | **Blocking.** Outcomes: `stopped \| too_late \| no_active_turn \| timeout(+controlSeq) \| stop_forced`. Idempotent on `requestId` (M:332-341, 2610-2652) | YES `C:11359` |
| Steer the running turn | `steerSessionTurn` → `POST /management/sessions/:id/steer` (P:106) | session:write and the `sessions.steering` flag | `options{text, requestId, replacesClientMessageId?}` | `accepted{steerId, turn, repeat?}` or a refusal: `no_turn \| legacy_turn \| not_found \| too_many \| request_id_reused \| steering_disabled \| already_received` (`src/types.ts:1847-1917`). Final outcome comes later as an event (§2.4) | YES `C:11034` |
| Rename | `renameSession` → `PATCH /management/sessions/:id` (P:102) | session:manage | `title` | — | YES (SEL:6145) |
| Cancel session | `cancelSession` → `POST …/cancel` (P:103) | session:manage | — | — | YES (`ui/core/commands.js:74`) |
| Complete session | `completeSession` → `POST …/complete` (P:104) | session:manage | `reason` | — | YES `C:9087` |
| Delete session (cancel + soft delete) | `deleteSession` → `DELETE /sessions/:id` (P:69) | session:destroy | — | Policy may protect system sessions (`deletion.protectSystem`) | YES (`commands.js:77`) |
| Switch model mid-session | `setSessionModel` → `POST …/model` (P:107) | session:manage | `options{model, reasoningEffort?, contextTier?}` | Emits `session.model_changed` | YES `C:7752` |
| Regenerate transcript (epoch rebirth) | `regenerateSession` → `POST …/regenerate` (P:138) | session:manage | `options` (force, handoff, instructions ≤ 4000 chars) | **Enqueue, then observe.** Returns `{attemptId}`. Refusal reasons: `too_young` (<5 turns, forceable), `already_pending`, `cooldown` (6 h), `epoch_unsettled`. System sessions → `REGENERATE_UNSUPPORTED` 409 (M:2440-2549) | YES `W:6968` |
| Session status snapshot | `getSessionStatus` → `GET …/status` (P:110) | session:read | — | `{customStatus, customStatusVersion, orchestrationStatus}` (M:3303-3320) | **NO-T** (the UI derives status from getSession and events) |
| Long-poll for status change | `waitForStatusChange` → `GET …/status/wait` (P:111; R:1207-1224) | session:read | `afterVersion`, `timeoutMs` (default 25 s, 1–300 s) | A timeout returns the unchanged status, not an error | **NO-T** |
| Latest turn response | `getLatestResponse` → `GET …/latest-response` (P:112) | session:read | — | — | **NO-T** |
| Event replay (catch-up) | `getSessionEvents` → `GET …/events` (P:115) | session:read | `afterSeq`, `limit`, `eventTypes` (JSON array) | The correctness path after a WS reconnect | YES `C:3050` |
| Event history (scroll back) | `getSessionEventsBefore` → `GET …/events-before` (P:116) | session:read | `beforeSeq`, `limit`, `eventTypes` | — | YES `C:2200` |
| Raw orchestration history | `getExecutionHistory` → `GET …/execution-history` (P:114) | session:read | `executionId` | Break-glass audited (R:124-133) | YES `C:5154` (History tab) |
| Export execution history to an artifact | `exportExecutionHistory` → `POST …/export-execution-history` (P:109) | session:manage | — | Returns `{filename: execution-history-<id8>-<ts>.json, artifactLink, sizeBytes}` (T:1923-1958) | YES (`commands.js:93`) |
| Orchestration stats | `getOrchestrationStats` → `GET …/orchestration-stats` (P:113) | session:read | — | Refreshed every 20 s (C:96) | YES `C:3281` |
| Session footprint / context health | `getSessionFootprint` → `GET …/footprint` (P:131) | session:read | — | `assessment.level` `ok\|elevated\|degraded\|rebuilding`; `recommendation` `none\|regenerate\|prune-events`; `regenEligibility`; cached 15 s (`src/footprint.ts:35-86`) | **NO-T** |

### 1.2 Sub-agents, spawn tree, groups

| Capability | Operation → route | Access | Notes | UI |
|---|---|---|---|---|
| Child outcomes under a parent (structured result, verdict, summary) | `listChildOutcomes` → `GET /management/sessions/:parentSessionId/child-outcomes` (P:151) | session:read on the parent | Row: `{childSessionId, parentSessionId, contractJson, resultJson, verdict, summary, completedAt}` (`src/cms.ts:302-312`) | **NO** |
| One child outcome | `getChildOutcome` → `GET /management/child-outcomes/:childSessionId` (P:152) | session:read on the child | — | **NO** |
| Tree rollups: stats, skill, facts, retrieval | `getSessionTreeStats` (P:140), `getSessionTreeSkillUsage` (P:142), `getSessionTreeFactsStats` (P:144), `getSessionTreeRetrievalUsage` (P:147) | session:read | `since` filter on the usage ops | YES (stats, skill, facts at `C:3345-3357`); retrieval **NO-T** |
| Spawn tree itself | Derived from the session list's parent ids (`ui/core/src/session-tree.js`) | — | There is no tree endpoint; the tree is rebuilt client-side from the full catalog | YES |
| Native in-worker tasks | Live topic `native-tasks` → synthetic `session.native_tasks_tick` (HT:731-743); durable `native.task_updated` | session:read | Needs the `copilot.native_tasks` flag | YES (`ui/core/src/native-tasks.js:165-227`) |
| List my groups (private per user) | `listSessionGroups` → `GET /management/session-groups` (P:155; R:681-684) | group:list | Everyone, admins included, sees only their own groups | YES `C:2754` |
| Create group | `createSessionGroup` → `POST /management/session-groups` (P:156) | authed | `input{title, description}`; owner server-stamped (R:685-689) | YES (`commands.js:22`) |
| Rename or describe group | `updateSessionGroup` → `PATCH …/:groupId` (P:157) | group:manage | `patch` | YES `C:6772` |
| Delete group (sessions untouched) | `deleteSessionGroup` → `DELETE …/:groupId` (P:158) | group:manage | — | YES `C:11652` |
| Place sessions in a group / ungroup | `placeSessionsInGroup` → `POST …/place` (P:159; R:507-529) | authed, plus read access per session | `groupId` (null = ungroup), `sessionIds` | YES `C:6666` |
| Deprecated aliases | `assignSessionsToGroup`, `moveSessionsToGroup`, `cancelSessionGroup`, `completeSessionGroup` (P:160-163) | — | `assign…` and `move…` are referenced only as fallbacks behind `placeSessionsInGroup` (C:6826-6831) | PARTIAL (dead fallback) / cancel and complete **NO** |
| Cron / scheduled wakes | **No operation.** State is visible only through session fields `cronActive, cronInterval, cronReason, cronKind, cronNextFireAt, cronTimezone, cronMaxFires, cronFiresCompleted` (M:475-482) and `session.cron_*` events | — | You cannot list, edit, pause or cancel a schedule from the API | Display only (SEL:124, 950-952; H:1287-1320) |

### 1.3 Workspaces and files

Feature gates:
- **`PORTAL_WORKSPACE_ROOTS`.** Unset → `listSessionWorkspaceFolders.enabled=false` and every file op returns `WORKSPACE_FILES_DISABLED` 503 (M:1997, 2021). `portal.workspaceFiles` in `/api/portal-config` mirrors it (S:141).
- **`PORTAL_WORKSPACE_MAX_FILE_MB`** (default 20).
- **`PORTAL_WORKSPACE_REQUIRE_MARKER`** (default true; a `.pilotswarm-export` marker is required).
- **Git**: enabled only when `PORTAL_CANVAS_COMMANDS_RUNNER=local` and `git` is in `PORTAL_CANVAS_COMMANDS_ALLOW` (`src/canvas-workspace.ts:439-445`, M:1996).

| Capability | Operation → route | Access | Inputs / behavior | States / errors | UI |
|---|---|---|---|---|---|
| Read the session's workspace binding | `getSessionWorkspace` → `GET …/workspace` (P:132) | session:read | — | `{workspace, revision, turnRevision, path, extraPaths, status: none\|ready\|unavailable, lastError, heldPrompts, adopted{agents, skills}, defaults}`. `turnRevision < revision` means a change is pending until the next turn (M:1864-1986) | YES `C:3360` |
| Set or clear the workspace | `setSessionWorkspace` → `PUT …/workspace` (P:133; R:725-730) | session:manage | `expectedRevision` (optimistic), `workspace{root, folder, extra{name:{root, folder, required}}}` or null; ≤4 extras; names `^[a-z0-9][a-z0-9_-]{0,31}$`; `work` reserved (`src/workspace-check.ts:20-189`) | **Blocking**, default 120 s (1–300 s), applied between turns. Timeout → `{status:"pending", commandId}`. Errors: `WORKSPACE_REVISION_CONFLICT` 409 (with current revision), `WORKSPACE_PATH_INVALID` 400, `WORKSPACE_SESSION_NOT_STARTED` 409, and 422 for `ROOT_UNKNOWN`, `FOLDER_MISSING`, `CHECK_TIMEOUT`, `ATTACH_TIMEOUT`, `ATTACH_FAILED`, `BUSY`, `UNAVAILABLE` (`src/types.ts:536-546`, M:1844) | YES `W:6831` (SessionWorkspace modal) |
| Retry a stuck workspace now | `retrySessionWorkspace` → `POST …/workspace/retry` (P:134; R:731-735) | session:write | `options.timeoutMs` (default 60 s) | `{retried}`; `{status:"pending"}` on timeout. The automatic backoff is 30 s, 2 min, 5 min, then every 15 min | YES `C:7081` |
| List folders for the Workspace pane | `listSessionWorkspaceFolders` → `GET …/workspace/folders` (P:135) | **session:files (owner only)** | — | `{enabled, maxBytes, git, folders[{id: working\|extra:<n>, name, role, root, folder, opened, available}], roots[]}` | YES `ui/react/src/workspace-pane.js:748` |
| File operations | `sessionWorkspaceFiles` → `POST …/workspace/files` (P:136) | session:files | `call{op, folder, path, …}`. `op` ∈ list (≤5000 entries) · stat · read · find (`query` ≤200 chars, ≤200 matches) · write (`contentBase64`, `ifMatch` etag or null for create-only, `createParents`) · mkdir · move (`toFolder?`, `toPath`) · delete (`recursive`) · zip (`path` or `paths[≤500]`). Git: `what` ∈ status · log (pages of 50) · show · file (≤5 MB text) · compare · repos · checkout (`needsStash`) · restore | Each call runs in a child process with a 30 s deadline; 2 heavy and 6 light ops run concurrently; a 10 s queue wait → BUSY. Errors (`src/workspace-files.ts:56-105`): `WORKSPACE_FILES_` + DISABLED 503, FOLDER_UNKNOWN 404, NOT_OPENED 409, ROOT_UNAVAILABLE 503, PATH_INVALID 400, OUTSIDE 400, NOT_FOUND 404, EXISTS 409, CONFLICT 409 (+current `etag`), READ_ONLY 403, TOO_LARGE 413 (+`size`), NOT_A_FILE/NOT_A_FOLDER 400, NOT_EMPTY 409, TIMEOUT 504, BUSY 503, IO 500. Git checkout and restore are refused while a turn runs. Writes emit `session.workspace_files_changed`. Body cap ≈ `ceil(MB×1.4)+1` MB (S:88-94) | YES (Workspace pane; editor, diff, git) |
| Canvas app file and command access | `canvasWorkspace` → `POST …/canvas-workspace` (P:137) | session:files | `slot`, `call{op: info\|list\|stat\|read\|write\|mkdir\|move\|delete\|zip\|watch\|run, path:"<folder>/<path>"}`, checked against the manifest's `workspace` block | `run`: typed params, no shell, 1–60 s timeout, ≤1 MB output, ≤4 concurrent. Errors `CANVAS_WS_*`: UNDECLARED, DENIED, PROGRAM_NOT_ALLOWED and COMMANDS_DISABLED 403; FOLDER_UNKNOWN and COMMAND_UNKNOWN 404; PARAM_INVALID 400; BUSY 429; RUN_FAILED 422; TIMEOUT 504 (`src/canvas-workspace.ts:41-681`) | YES `W:8292` (canvas bridge) |
| Repo import of agent packages (browser-side) | No server op; uses the viewer's own GitHub PAT or ADO token (`web/src/browser-transport.js:97-105`, `ui/core/src/repo-import.js:1-298`) | — | ≤2 MB; skips `node_modules` and `.git` | YES (Add package dialog) |

### 1.4 Artifacts (session files)

Caps: text ≤ 1 MB; binary ≤ 10 MB, configurable via `PILOTSWARM_ARTIFACT_BINARY_MAX_BYTES` (`src/session-store.ts:105-106, 137-140`). Over the cap → `ARTIFACT_TOO_LARGE` 413 with `{maxBytes, actualBytes}`.

Content types are sniffed: a mismatch → `ARTIFACT_CONTENT_TYPE_MISMATCH` 400 with `{declaredType, detectedType}`, and binary content with no type → `ARTIFACT_CONTENT_TYPE_REQUIRED`.

Metadata: `{filename, sizeBytes, contentType, isBinary, uploadedAt, source(agent|user|system|file|copy), sha256?, sourceDetail?, pinned?}` (`src/session-store.ts:75-90`).

| Capability | Operation → route | Access | Notes | UI |
|---|---|---|---|---|
| List artifacts | `listArtifacts` → `GET /sessions/:id/artifacts` (P:84) | session:read | Cached client-side for 10 s (C:1611) | YES `W:172` |
| Metadata | `getArtifactMetadata` → `GET …/:filename/meta` (P:85); legacy `/api/sessions/…/meta` (S:332-346) | session:read | — | YES `C:5253` |
| Read as text | `downloadArtifact` → `GET …/:filename/text` (P:86) | session:read | Break-glass audited | YES `C:5243` |
| Download binary | `GET /api/v1/sessions/:id/artifacts/:filename/download` (RT:155-168); legacy `/api/sessions/…/download` (S:317-330) | session:read | Streams `Content-Disposition: attachment`; the browser saves it through a blob anchor (`web/src/browser-transport.js:20-36`) | YES |
| Read as base64 (bounded) | `readArtifactBase64` → `GET …/:filename/base64` (P:96) | session:read | `maxBytes` default 256 KB, max 1 MB; `truncated` flag (T:1698-1710) | **NO** |
| Upload | `uploadArtifact` → `PUT /sessions/:id/artifacts/:filename` (P:87) | session:write | `content` (base64 for binary), `contentType`, `contentEncoding`. Route body cap 8 MB (S:84). Portal uploads are recorded with `source:"agent"` (T:1883-1888) | YES `C:2136` (via `uploadArtifactFromFile`) |
| Delete | `deleteArtifact` → `DELETE …/:filename` (P:88) | session:manage | — | YES `W:176` |
| Copy across sessions | `copyArtifact` → `POST /artifacts/copy` (P:97) | session:copy | `fromSessionId`, `fromFilename`, `toSessionId`, `toFilename` | **NO** |
| Pin / unpin (survives retention sweeps) | `setArtifactPinned` → `PUT …/:filename/pinned` (P:98) | session:manage | Pinned artifacts survive `deleteArtifacts` unless `includePinned` (`src/blob-store.ts:1057-1070`) | **NO** |
| Agent "present artifact" | Event `session.artifact_presented {filename, fullscreen, note}` | — | Opens the Files preview automatically (C:6449) | YES |
| Deep link to an artifact | `?session=<id>&artifact=<file>&view=full\|canvas` (`web/src/lib/deep-link.js:34-40`) | — | — | YES |

### 1.5 Canvas (agent-authored live HTML surfaces)

Slots are integers 1–5 (R:1713-1719). The files are `canvas.html` and `canvas2.html` … `canvas5.html` (`src/canvas-support.ts:13-18`).

| Capability | Operation → route | Access | Notes | UI |
|---|---|---|---|---|
| Live canvas state snapshot | `getCanvasLive` → `GET …/canvas-live` (P:117) | session:read | Rows `{slot, seq, docRev, docSha, payload, updatedBy, updatedAt}`; `[]` before the data plane exists (M:3187-3193) | PARTIAL (only inside HT's canvas mirror, HT:640-641) |
| Live canvas pushes | WS `subscribeCanvas` → `canvasLive {slot, seq, kind: data\|doc\|kv, patch?}` (WS:224-248; CP:76-90) | session:read | Not in the `WS_CLIENT_MESSAGES` constant (P:44-45) | YES (via HT) |
| Read KV store | `readCanvasKv` → `GET …/canvas-kv` (P:124) | canvas:read | `slot`, `prefix`, `limit` (≤200), `after` cursor, `key`. Returns `{entries[{key, v, by, at, rev}], nextAfter, me{relation, canWrite}, policy, manifestKv}` (`src/canvas-kv.ts:254-292`) | YES `W:8234` |
| Write KV store | `writeCanvasKv` → `POST …/canvas-kv` (P:125; R:1311-1325) | canvas:write | `ops[1..50]{op: put\|delete, key (≤200 chars), value (≤16 KB), ifMatch (rev; 0 = must not exist)}`. Per canvas: ≤1000 keys, ≤2 MB | **Rate limits**: 10 writes/s per viewer, 50/s per canvas → `RATE_LIMITED` 429. Each op is answered individually: FORBIDDEN, CONFLICT(rev), INVALID_KEY, TOO_LARGE, QUOTA. `req/*` rows from read-only viewers are capped to `status:"suggested"` | YES `W:8261` |
| Who may write the KV | `setCanvasKvAccess` → `PUT …/canvas-kv/access` (P:126) | session:share | `slot`, `access: owner\|readers\|link`; audited (R:1326-1341) | YES `W:7933` |
| Public view link: status | `getCanvasShareLink` → `GET …/canvas-share-link` (P:127) | session:share | Never returns the token | YES `W:7918` |
| Public view link: mint or rotate | `resetCanvasShareLink` → `POST …/canvas-share-link/reset` (P:128) | session:share | The raw token is returned **once**; the old link dies immediately; audited | YES `W:7947` |
| Public view link: remove | `removeCanvasShareLink` → `POST …/canvas-share-link/remove` (P:129) | session:share | — | YES `W:7959` |
| Link-holder doors (no sign-in) | `GET /api/canvas-share/doc?t=` (CSP sandboxed HTML), `/live?t=`, `/kv?t=` (read-only) (S:243-292); WS `?canvasShare=<token>` may only `subscribeCanvas` (WS:35-71, 158-191) | token | All failures → 404. Open sockets re-check the token every 60 s and close with 4403 | YES (`web/src/App.jsx:769-782`) |
| Canvas actions (UI → agent) | `sendMessage` with the `"[canvas-action] " + JSON{action, data}` prefix | session:write | Client side: ≤3 actions per 3 s, payload ≤8 KB, responseContract-validated (`ui/core/src/canvas-actions.js:27-140`). The comment at R:1080 says "CREATOR-only", but the code admits all writers (R:1098-1100) | YES |
| Canvas app publish | Event `session.canvas_app_published` | — | Rendered only as a generic activity line | PARTIAL |

### 1.6 Agents and agent packages

Packages are uploaded as inline files: ≤2000 files, ≤2 MB decoded, route body 4 MB (S:87; M:5307-5360). `plugin.json` is required; `name` must be a DNS label and `version` strict semver.

Validation failure → `VALIDATION_FAILED` 400 with `error.validation{ok, errors[{code, message, file?}], warnings[]}` (`src/agent-package-format.ts`, `web/api/error-detail.js:19`).

Versions are immutable: the same semver with different bytes → `CONFLICT`, and the same sha → `noop`.

**Scope shadowing:** one name can be a shared package and several user copies at once. Every `:name` op takes `scope` (`shared|user`), and admins may add `ownerProvider` and `ownerSubject` (P:221-228; R:21-30).

| Capability | Operation → route | Access | Notes | UI |
|---|---|---|---|---|
| List packages | `listAgentPackages` → `GET /agent-packages` (P:217) | authed | Shared plus my user-scope; admins see all | YES `C:4206` |
| Publish (upload) | `uploadAgentPackage` → `POST /agent-packages/upload` (P:218) | authed (creator, editor or admin checked in SQL) | `files[{path, contentBase64}]`, `scope` | YES `C:4414` |
| Package detail and version history | `getAgentPackage` → `GET /agent-packages/:name` (P:229) | authed | — | YES `C:4243` |
| Browse a package's files | `getAgentPackageTree` (P:230), `getAgentPackageFile` (P:231) | authed | `semver` (defaults to active), `filePath`; preview ≤256 KB, binary flagged | YES `C:4252`, `C:4262` |
| Download a `.tgz` | `GET /agent-packages/:name/download` (RT:170-195) | authed | Headers `x-pilotswarm-package-version` and `-sha256` | YES `W:14839` |
| Promote or demote | `setAgentPackageScope` → `PUT …/scope` (P:232) | creator or admin | Running agents unaffected | YES `C:4351` |
| Enable or disable fleet-wide | `setAgentPackageEnabled` → `PUT …/enabled` (P:233) | creator, editor or admin | — | YES `C:4371` |
| Pin the active version (rollback) | `pinAgentPackageVersion` → `PUT …/active` (P:234) | creator, editor or admin | The fleet converges on the next epoch poll (~20 s, `src/worker.ts:317`) | YES `C:4367` |
| Delete package | `deleteAgentPackage` → `DELETE …/:name` (P:235) | creator or admin | Live sessions using it fail resolution on their next turn | YES `C:4374` |
| Editors: grant, revoke, list | `grantAgentPackageEditor` (P:239), `revokeAgentPackageEditor` (P:240), `listAgentPackageEditors` (P:241) | owner or admin; list: anyone who can see the package | Audited as `share_change` (R:977-1008) | grant/revoke YES `C:4378-4381`; list **NO** (editors come from the detail view) |
| Republish into the other scope | `republishAgentPackageVersion` → `POST …/republish` (P:242) | creator or admin | "THE update path" for a shared package | YES `C:4361` |
| Fleet adoption per worker | `listAgentWorkerState` → `GET /agent-packages/worker-state` (P:219) | fleet:admin | Projected (redacted) for cluster-scoped admins (R:962-965; AD:23-29) | YES `C:4214` |
| Worker registry | `listWorkers` → `GET /workers` (P:220) | fleet:admin | Pool, phase, liveness, health (rss, heap, event-loop p99, slots, activeSessions), package and feature-flag delivery state (AD:66-82) | YES `C:4178` (Admin → Workers) |
| System agents | `pilotswarm` (root), `sweeper` (cron 6 h), `facts-manager` (cron 6 h), `resourcemgr`, `token-manager` (cron 30 min) (`packages/sdk/plugins/mgmt/agents/*.agent.md`) | — | System sessions are read-only for non-admins (SA:108-114) | YES (session list, system filter) |
| Restart a system agent | `restartSystemSession` → `POST /management/sessions/:agentIdOrSessionId/restart-system` (P:108) | fleet:admin | `options{disposition: complete\|terminate\|hard_delete, startReplacement?}`; `SYSTEM_AGENT_LOADED` 409 while a live worker loads it (M:2799-3067) | YES `C:10664` |

### 1.7 Model providers, models, defaults and budgets

**Provider types:** `github | azure | openai | openai-proxy | anthropic | anthropic-wif | foundry-wif` (`src/model-providers.ts:130`). A provider's type must be one of the deployment's config ids, else `PROVIDER_INVALID`.

**Classes:** `shared` (admin-managed, anyone may spend) or `personal` (owner only).

**Credentials** are a bare string or `{value|apiKey|githubToken|token|key, apiVersion?}`. `env:` pointers are refused, and `*-wif` types store no key (`src/provider-store.ts:271-323`).

**Errors:** `PROVIDER_NOT_FOUND` 404, `PROVIDER_FORBIDDEN` 403, `PROVIDER_CONFLICT` 409, `PROVIDER_INVALID` 400, `PROVIDER_IN_USE` 409 (R:162-171). The database procedures decide every permission; the portal only reshapes the call (R:1380-1395).

| Capability | Operation → route | Access | Notes | UI |
|---|---|---|---|---|
| Models I can use (runtime instances) | `listModels` → `GET /models` (P:208) | authed | `ModelSummary{qualifiedName <instance>:<model>, providerId, providerType, modelName, description, cost, supportedReasoningEfforts, defaultReasoningEffort, supportedContextTiers, defaultContextTier, contextWindowSizes, credentialAvailable}` (M:538-559, 5522-5547) | YES `C:3526` |
| Model templates by provider type | `getModelsByProvider` → `GET /models/by-provider` (P:209) | authed | `catalogKind=provider_type` | PARTIAL (from bootstrap; `C:3521-3524`) |
| Deployment default model | `getDefaultModel` → `GET /models/default` (P:210) | authed | — | PARTIAL (bootstrap) |
| Providers I can see | `listProviders` → `GET /providers` (P:271) | authed | `ProviderRow{name, typeId, class, owner, baseUrl, allowancePct, hold*, hasCredential, usableByMe, systemUseEnabled, systemEligible, isClusterDefault, isMyDefault, isSystemDefault, ruleCount}` (`src/provider-store.ts:66-87`) | YES `C:3515` |
| Limit status | `getProviderStatus` → `GET /providers/status` (P:272) | authed | `names` comma list. `{ruleId, period, modelQualified, limitTokens, usedTokens, ceilingTokens, yourUsedTokens, windowStartUtc, resetsAtUtc}` (`src/provider-budgets.ts:32-46`) | YES `C:7539` |
| Budget table (usage grid) | `getProviderUsageGrid` → `GET /providers/usage-grid` (P:276) | authed | Rows per provider and per model-scoped limit; day/week/month cells with used and quota, mine and everyone's (`src/provider-store.ts:110-166`) | YES `C:4802`; refresh every 60 s (W:13154) |
| Cluster usage summary | `getProviderUsageSummary` → `GET /providers/usage-summary` (P:299) | authed | `days` 1–365 (default 14), `providers`. Admin: whole cluster; others: own turns | YES `C:4713` |
| Usage by agent | `getProviderUsageAgents` → `GET /providers/usage-agents` (P:300) | authed | Per-agent per-day series | YES `C:4690` |
| Where tokens went (drill-down) | `getProviderUsage` → `GET /providers/usage` (P:301) | authed | `dimension: session\|user\|provider\|model\|agent`; filters `days, mine, ownerUserId, provider, model, sessionId, chargeClass (user\|system\|unattributed), limit` → `{totals, daily, breakdown, truncated}` | YES `C:4839` |
| Sessions paused on budget | `listPausedSessions` → `GET /providers/paused` (P:302) | authed | Pause kind `limit\|allowance\|hold\|no_provider`; ≤100 rows; admins fleet-wide (`src/provider-budgets.ts:30-61`) | YES `C:4803` (also drives the `budget_paused` display status, SEL:208-218) |
| Create shared provider | `createProvider` → `POST /management/providers` (P:277) | fleet:admin | `name, type, credentials, baseUrl` | YES (dynamic op, C:3577-3585) |
| Rotate shared key | `updateSharedProviderCredential` → `PUT /management/providers/:name/credential` (P:278) | fleet:admin | — | YES (C:3594-3606) |
| Delete shared provider | `deleteProvider` → `DELETE /management/providers/:name` (P:279) | fleet:admin | Returns how many sessions now wait on the name; `PROVIDER_IN_USE` if defaults or overrides reference it | YES (C:3609-3614) |
| Personal providers: create, rotate, delete | `createMyProvider` (P:280), `updateMyProviderCredential` (P:281), `deleteMyProvider` (P:282) | authed (owner) | — | YES |
| Clear defaults and overrides that reference a provider | `clearProviderRoutingDependencies` → `POST /providers/:name/clear-routing` (P:283) | authed (admin for shared) | The remedy for `PROVIDER_IN_USE` | **NO** |
| Set or remove a token limit | `setProviderLimit` → `PUT /providers/:name/limit` (P:284); `removeProviderLimit` → `DELETE` (P:285) | admin (shared) / owner (personal) | `period day\|week\|month`, `model?`, `tokens ≥0`; returns `seededTokens`; wakes paused sessions | YES `C:5095`, `C:5103` |
| Per-person allowance % | `setProviderAllowance` (P:286) | fleet:admin | 1–100, shared only | YES `C:5115` |
| Hold (pause new turns) | `setProviderHold` (P:287) | fleet:admin | `untilUtc` (future) or `release`; neither = indefinite | YES `C:5127` |
| Model defaults read | `getModelDefaults` (P:289); compatibility `getDefaults` (P:288) | authed | `{userSession, clusterSession, system{configured, effective, error}, systemOverrides[]}`; effective source `user_default\|cluster_default\|system_default\|first_available` | YES `C:3515`, `C:7542` |
| Set my or cluster default | `setModelDefault` (P:290); compatibility `setMyDefault` (P:298), `setClusterDefault` (P:297, deprecated) | authed; cluster = admin | Null tuple clears | YES `C:3627`, `C:5140-5148` |
| System-session default (+ restart existing) | `setSystemModelDefault` (P:294) | fleet:admin | `restartExisting:false\|{disposition}` → `restart{requested, affected, restarted, failures[]}` (M:4863-4910) | YES `C:3640` |
| Per-system-agent model override | `setSystemSessionModel` (P:295), `clearSystemSessionModel` (P:296) | fleet:admin | Pushes `set_model` to the live session | YES `C:3653`, `C:3666` |
| Allow system sessions to use my personal provider | `setProviderSystemUse` (P:291) | fleet:admin | The calling admin's own provider only | YES `C:3618` |
| Legacy GHCP key migration status | `getLegacyProviderMigrationStatus` (P:292) | fleet:admin | `{regularKeys, migratedRegularKeys, systemKeyPresent, systemKeyAdopted}` | **NO** |
| Adopt the legacy System GHCP key | `adoptLegacySystemGitHubCopilotKey` (P:293) | fleet:admin | — | **NO** |
| Per-user GitHub Copilot key | `setCurrentUserGitHubCopilotKey` → `PUT /me/github-copilot-key` (P:247) | authed | null clears. Missing key → `GHCP_KEY_MISSING` 400, raised at **turn time**, not create time (`src/session-manager.ts:2133-2140`) | YES `C:4572` |
| System GitHub Copilot key and status | `setSystemGitHubCopilotKey` (P:248), `getSystemGitHubCopilotKeyStatus` (P:249) | fleet:admin | `{configured, changedBy, changedAt}` | YES `C:4572`, `C:3493` |

### 1.8 Sharing, access and audit

| Capability | Operation → route | Access | Notes | UI |
|---|---|---|---|---|
| My access to a session | `getSessionAccess` → `GET /sessions/:id/access` (P:76; R:1120-1145) | session:read | `{rootSessionId, isSystem, visibility, owner, relation: owner\|admin\|collaborator\|none, canWrite, canManage, viewerGroupId, enforced}` | YES `W:288` |
| Set tree visibility | `setSessionVisibility` → `PUT …/visibility` (P:77) | session:share (always enforced) | `private\|shared_read\|shared_write`; audited | YES `C:8672` |
| Grant a person read or write | `grantSessionShare` → `POST …/shares` (P:78) | session:share | `user{provider, subject, email?, displayName?}`, `access read\|write` | YES `C:8879` |
| Revoke a grant | `revokeSessionShare` → `POST …/shares/revoke` (P:79) | session:share | — | YES `C:8824` |
| List grants | `listSessionShares` → `GET …/shares` (P:80) | session:share | — | YES `C:8713` |
| Member directory (share autocomplete) | `listKnownUsers` → `GET /management/users` (P:171) | authed | `{provider, subject, email, displayName}[]`; `limit` | YES `C:8844` |
| Authorization audit trail | `listAuthzAudit` → `GET /management/authz-audit` (P:81) | authz:audit | `limit`, `sessionId`. Decisions recorded: `deny`, `would_deny`, `break_glass`, `share_change`, plus feature-flag set/unset (R:278-436; `src/migrations/feature-flags-0077.ts:142-157`) | **NO** |
| Copy session link | Client-only (`?session=`), with multi-origin variants via `PORTAL_LINK_ORIGINS` (`web/config.js:22-80`; W:247) | — | A link locates; it does not grant | YES |

### 1.9 Admin console, feature flags and users

**Feature-flag catalog** (`src/feature-flags.ts:2-31`):

| featureKey | Default | User override allowed | Notes |
|---|---|---|---|
| `copilot.native_tasks` | off | yes | — |
| `agents.base_v2` | off | yes | Forced off unless native tasks is on (`feature-flags.ts:81-85`) |
| `sessions.steering` | off | **no** | — |
| `debug.enable_model_event_logging` | off | yes | — |

Every mutation needs `expectedRevision` (int64 string) and `requestId` (1–128 chars):
- A replay with the same input returns the stored receipt.
- A different input under the same `requestId` → `FEATURE_CONFLICT`.
- A stale revision → `FEATURE_CONFLICT` "reload before saving".
- No feature store configured → `FEATURE_UNAVAILABLE` 503 (`src/feature-store.ts:91-98`; `feature-flags-0077.ts:104-127`).

| Capability | Operation → route | Access | Notes | UI |
|---|---|---|---|---|
| Flag catalog | `listFeatureFlags` → `GET /management/features/catalog` (P:252) | authed | Same as cluster read (M:5156-5157) | PARTIAL (the UI uses `getClusterFeatureFlags`) |
| Cluster policy: read, set, reset | `getClusterFeatureFlags` (P:254), `setClusterFeatureFlag` (P:255), `resetClusterFeatureFlag` (P:256) | read authed; write fleet:admin | `enabled`, `allowUserOverride`, `expectedRevision`, `requestId` | YES `C:4079`, `C:4108` |
| My preferences: read, set, unset | `getMyFeatureFlags` (P:258), `setMyFeatureFlag` (P:259), `unsetMyFeatureFlag` (P:260) | authed | A locked cluster policy wins; the view flags `userOverrideIgnored` | YES `C:4081`, `C:4110` |
| Another user's preferences | `getUserFeatureFlags` (P:261), `setUserFeatureFlag` (P:262), `unsetUserFeatureFlag` (P:263) | fleet:admin | `userId` is the **numeric** users-table id | YES `C:4080`, `C:4109` |
| Find users to manage | `listFeatureFlagUsers` (P:253) | fleet:admin | `query` | YES `C:4045` |
| Feature change history | `listFeatureFlagChanges` (P:264) | fleet:admin | ≤200 rows | **NO** |
| Per-flag delivery to workers | Derived from `listWorkers` state `feature-flags` | fleet:admin | updated / pending / loading / unsupported / unknown (`ui/react/src/feature-flags-panel.js:10-44`) | YES |
| My profile | `getCurrentUserProfile` → `GET /me/profile` (P:245; R:764-769) | authed (needs a principal, else `PORTAL_AUTH_REQUIRED`) | `{userId, provider, subject, email, displayName, profileSettings, githubCopilotKeySet, isAdmin, adminScope, capabilities{clusterManagement, fleetAccounting, userResourceBypass, systemSessionAdmin}}` | YES `W:15960` |
| Save my UI settings | `setCurrentUserProfileSettings` → `PATCH /me/profile/settings` (P:246) | authed | **Replaces** the whole settings object. Keys: `moa, themeId, touchScale, layoutAdjustments.*, pinnedSessionIds, sessionOrder, sessionSortMode, sessionUsedAt, collapsedSessionIds, activeSessionId, rightPaneMode, desktopPanes, canvasPrefs, sessionViews, agentPickerUsage, sessionOwnerFilter, sessionDetailCollapsed` (W:478-541) | YES `W:666`; polled every 5 s (W:118) |
| Prune summaries of deleted sessions | `pruneDeletedSummaries` (P:175) | fleet:admin | `olderThan` | **NO** |

Admin Console sections in the portal today (W:14495-14560, W:14753-14810):
- Settings tree → Providers (mine / shared)
- Feature flags
- Agents (packages) — detail, editors and workspace preview
- Workers
- GHCP key editor (W:15603)

There is no Audit, Users, Facts, Graph or Schedules section.

### 1.10 Observability, telemetry and logs

| Capability | Operation → route | Access | Notes | UI |
|---|---|---|---|---|
| Per-session metric summary | `getSessionMetricSummary` (P:130) | session:read | Refreshed every 20 s | YES `C:3331` |
| Tokens by model | `getSessionTokensByModel` (P:139) | session:read | — | YES `C:3342` |
| Skill usage (session) | `getSessionSkillUsage` (P:141) | session:read | `since` | YES `C:3348` |
| Facts stats (session) | `getSessionFactsStats` (P:143) | session:read | — | YES `C:3354` |
| Retrieval usage (session and tree) | `getSessionRetrievalUsage` (P:146), `getSessionTreeRetrievalUsage` (P:147) | session:read | `since` | **NO-T** |
| Graph node usage, edge-search usage, recent searches | `getSessionGraphNodeUsage` (P:148), `getSessionGraphEdgeSearchUsage` (P:149), `getSessionGraphSearches` (P:150) | session:read | `limit, nodeKeyLike, kind, since` | **NO-T** |
| Fleet stats | `getFleetStats` (P:166) | fleet:read | Content-redacted projection for cluster-scoped admins (R:750-756; AD:9-21) | YES `C:3371`; refreshed every 30 s |
| Fleet skill and retrieval usage | `getFleetSkillUsage` (P:167), `getFleetRetrievalUsage` (P:168) | fleet:read | Cluster-scoped admins are refused (R:289-292) | YES `C:3390-3393` |
| Fleet graph node usage | `getFleetGraphNodeUsage` (P:169) | fleet:read | — | **NO-T** |
| Per-user stats | `getUserStats` (P:170) | fleet:read | Redacted projection (AD:2-7) | YES `C:3387` |
| Shared facts and tombstone stats | `getSharedFactsStats` (P:172), `getFactsTombstoneStats` (P:173) | fleet:read | `ttlSeconds` | YES `C:3396-3399` |
| Noisiest event emitters | `getTopEventEmitters` (P:174) | fleet:read | `since` **required**, `limit` 1–100 (R:71-83) | **NO** |
| Live log tail (fleet-wide) | WS `subscribeLogs` → `logEntry {id, time, podName, level, orchId, sessionId, category: activity\|orchestration\|log, rawLine, message}` (WS:366-382; T:185-210) | admin, but **open to all users while enforcement is off** (R:1633-1646) | Live only: no history, no catch-up. Availability from `getLogConfig` | YES `C:9370` (Inspector → Logs) |

Inspector tabs: `sequence, logs, nodes, history, files, stats` (`ui/core/src/commands.js:10`).

### 1.11 Facts store and knowledge graph (agent memory)

**Facts** are persistent key/value memory with two scopes: `shared:<key>` and `session:<id>:<key>`. `agentId` is attribution only (`src/facts-store.ts:13-90`).

**The graph** is an optional node/edge index over facts, with namespaces ("corpora") and a non-deletable `default` partition (`src/graph-store.ts:1-37`).

Every operation below is **NO-T**: nothing in `packages/app/ui` or `web/src` calls `/facts` or `/graph`.

| Capability | Operation → route | Access |
|---|---|---|
| Store capabilities | `factsCapabilities` → `GET /facts/capabilities` (P:178) | authed |
| Read facts | `readFacts` → `GET /facts` (P:179; R:859-865) | facts:read (non-admins: shared only, or session-gated) |
| Store fact(s) | `storeFact` → `POST /facts` (P:180) | facts:write (shared, or sessions I can write; R:444-456) |
| Delete fact / pattern | `deleteFact` → `POST /facts/delete` (P:181) | facts:write |
| Search facts (lexical, semantic, hybrid) | `searchFacts` → `POST /facts/search` (P:182) | facts:read; enhanced store only (`FACTS_ENHANCED_UNSUPPORTED` 409) |
| Similar facts | `similarFacts` → `POST /facts/similar` (P:183) | facts:read; enhanced |
| Embedder status / start / stop | `getEmbedderStatus` (P:186), `startFactsEmbedder` (P:187), `stopFactsEmbedder` (P:188) | status authed; start and stop fleet:admin |
| Force-purge soft-deleted facts | `forcePurgeFacts` (P:189) | fleet:admin |
| Search nodes / edges, neighbourhood | `searchGraphNodes` (P:192), `searchGraphEdges` (P:193), `graphNeighbourhood` (P:194) | authed (`GRAPH_UNSUPPORTED` 409 when absent) |
| Upsert / delete node / edge | P:195-198 | authed |
| Graph stats, namespaces list / get | P:199-201 | authed |
| Register / delete namespace | `upsertGraphNamespace` (P:204), `deleteGraphNamespace` (P:205) | fleet:admin |

### 1.12 Master of Agents (MoA) and client-only capabilities

MoA is a browser-only tiled dashboard:
- ≤5 dashboards and ≤16 panels; each panel is a session chat or a canvas.
- Saved in `profileSettings.moa` (`ui/core/src/moa.js:2-41`; `web/src/moa/MoaWorkspace.jsx`).
- No server API of its own, and no sharing.

Other client-only features with no server state:
- Themes
- View history (back and forward)
- Pinned and ordered sessions (stored in profile settings)
- Deep links (`web/src/lib/deep-link.js`)
- Mobile layouts

---

## 2. Realtime model

### 2.1 Endpoints and auth

| Endpoint | Notes |
|---|---|
| `WS /api/v1/ws` (P:41) | The product endpoint |
| `WS /portal-ws` (legacy) | Also accepts `theme` and answers `themeAck` (S:391-394; WS:392-394) |

- **Auth:** a Bearer header or the subprotocol `["access_token", encodeURIComponent(token)]` (AU index.js:171-194; AC:271-280). A proxy provider authenticates from request headers.
- **Close codes:** 4401 unauthorized, 4403 forbidden or revoked link, 1013 slow consumer (WS:298-300).
- **Readiness:** the server sends `{type:"ready"}` on connect. Messages that arrive before auth resolves are buffered and replayed (WS:39-47, 132-141).

### 2.2 Client → server messages (WS:143-395)

| Message | Payload | Limits |
|---|---|---|
| `subscribeSession` / `unsubscribeSession` | `{sessionId}` | session:read gate. **≤64 distinct subscribed sessions per socket** (WS:152-157) |
| `subscribeCanvas` / `unsubscribeCanvas` | `{sessionId}` | Plane must be available, else `error scope:canvas`. **Missing from the `WS_CLIENT_MESSAGES` constant** (P:44) |
| `subscribeLive` / `unsubscribeLive` | `{sessionId, topics[≤16]}` | Topic regex `^[a-z][a-z0-9_.:-]{0,63}$`. A resubscribe replaces the topic set (WS:260-348) |
| `subscribeLogs` / `unsubscribeLogs` | `{}` | Admin gate (dark-launch permissive) |
| `publishLive` | — | Always refused: "live publishing is server-only" (WS:361-364) |
| `theme` | `{themeId}` | Legacy socket only |

### 2.3 Server → client messages

| Message | Shape | UI meaning |
|---|---|---|
| `ready` | — | Socket usable |
| `subscribedSession` / `subscribedCanvas` / `subscribedLive` / `subscribedLogs` | ids / topics | Subscription acknowledged. A `subscribedLive` follows the snapshot burst |
| `sessionEvent` | `{sessionId, event:{seq, sessionId, eventType, data, createdAt, workerNodeId?}}` (`src/cms.ts:24-30`) | A durable event (§2.4) |
| `live` | `{sessionId, topic, seq, kind: snapshot\|patch\|signal\|unavailable, data?, updatedAt?}` (LP:51-58) | Ephemeral last-value state. The client applies JSON merge-patches and refetches via `getLive` on a seq gap (AC:409-508) |
| `canvasLive` | `{sessionId, slot, seq, kind: data\|doc, patch?}` or `{slot, kind:"kv", key, rev, op: put\|delete, value?}` (CP:76-90) | Canvas tick or KV change. A big patch is a pointer: fetch `getCanvasLive` |
| `logEntry` | `{entry}` (§1.10) | Log tail line |
| `error` | `{scope: session\|canvas\|live\|logs\|share, sessionId?, code?:"ACCESS_REVOKED", error}` | Access is revalidated every 5 s per subscribed session. On revocation the server unsubscribes and sends `ACCESS_REVOKED` "Session not found." (WS:96-119, 126-130); the client turns it into a synthetic `session.access_revoked` (AC:294-310) |

### 2.4 What the UI must render

The browser transport merges the streams into **one session event feed** (HT:630-758). Durable events are joined by synthetic, never-persisted ones:

| Synthetic event | Source |
|---|---|
| `assistant.live_tick` | Live topic `turn` → `{phase: live\|idle, streamId, messageId, text, reasoningId, reasoningText, truncated?}` (`src/live-turn.ts:11-19`). Published only when `PILOTSWARM_LIVE_TURN=1` (`src/session-proxy.ts:4041`) — **streaming preview text is a deployment toggle** |
| `session.native_tasks_tick` | Live topic `native-tasks` → `{version, ownerId, turnIndex, revision, phase, tasks[], truncated?}` (`src/native-task-observer.ts:34-43`) |
| `session.canvas_data` | Canvas mirror. Legacy durable canvas ticks are suppressed while the plane feeds the slot |
| `session.canvas_kv` | KV change, posted into the canvas iframe |
| `session.canvas_plane_released` | Plane lost; durable events resume |
| `session.access_revoked` | See §2.3 |

**Durable event families the backend emits** (full detail in the backing research; key emitters in `src/session-proxy.ts`, `src/orchestration/*.ts`, `src/managed-session.ts`, plus SQL turn-control migrations):

| Family | Event types | Current UI treatment |
|---|---|---|
| Transcript | `user.message` (`clientMessageIds`, `sender`, `attachments`, `budgetQueued`/`workspaceQueued`), `assistant.message`, `assistant.reasoning`, `system.message`, `assistant.intent` | Chat bubbles and activity (H:1488-1517) |
| Turn | `session.turn_started`, `session.turn_completed` (stats: tokens, tools, duration, resultType), `session.turn_stopped`, `assistant.turn_start/_end`, `assistant.usage`, `session.usage_info`, `session.compaction_start/_complete` | Partly dedicated, partly generic; context meter (`ui/core/src/context-usage.js:111-185`) |
| Tools | `tool.execution_start/_complete/_partial_result/_progress`, `external_tool.*`, `skill.invoked`, `hook.*`, `permission.*` | Call lines (`ui/core/src/chat-activity.js:5-10`) |
| Questions | `session.input_required_started` (`question, choices, allowFreeform, questionIteration`) | Question card; composer switches to answer mode |
| Waits / cron | `session.wait_started/_completed`, `session.cron_started/_fired`, `session.cron_at_scheduled/_started/_fired/_completed/_cancelled` | Activity lines; `cron_waiting` display status |
| Turn control | `user.steer`, `user.stop`, `session.control_outcome` (`delivered\|carried\|not_delivered\|stopped\|too_late`), `session.steer_confirmed`, `session.carried_steers_closed`, `pending_messages.cancelled`, `session.message_duplicate_suppressed`, `session.fifo_overflow` | Turn-control chips (H:74-180) |
| Model / regenerate | `session.model_changed`, `session.model_resolved`, `session.model_mismatch`, `session.regenerate_requested/_refused/_failed`, `session.epoch_committed`, `session.regenerated` | Model chip; regenerate refused or failed shown inline; the rest generic |
| Sub-agents | `session.agent_spawned`, `session.child_update_suppressed`, `session.child_cleanup_completed`, `subagent.started/_configured/_completed/_failed`, `native.task_updated`, `native.<type>` | Spawn lines, native task cards |
| Budget | `session.budget_paused` (`kind, provider, resetsAtUtc, content`) | **Generic grey line** (status comes from `listPausedSessions`) |
| Workspace | `session.workspace_changed/_unavailable/_available/_adopted/_defaults/_opened/_released/_files_changed/_files_noted` | **All generic**. The pane reads `getSessionWorkspace` instead |
| Canvas / artifacts | `session.canvas_updated/_data/_presented/_app_published`, `session.artifact_presented` | Canvas state; auto-open preview |
| Lifecycle / infra | `session.hydrated/_dehydrated/_affinity_released/_lossy_handoff/_snapshot_*`, `session.prompt_layers/_sections`, `runtime.tool_call_as_text`, `runtime.required_tool_not_invoked`, `runtime.attachment_dropped`, `session.error`, `session.warning`, `session.truncation`, `session.title_changed`, `session.todos_changed` | Error card for `session.error`; the rest generic or hidden |

**Hidden by the UI:** `native.*` (other than tasks), `assistant.usage`, `session.info`, `session.idle`, `session.usage_info`, `pending_messages.*`, `abort`, `assistant.turn_end` (H:1124-1146).

**Generic fallback:** a grey `[eventType] text` line (H:1406-1412).

### 2.5 Subscription and consistency model

- **Acceleration, not truth.** WS delivery speeds things up. After any reconnect the client must replay `getSessionEvents?afterSeq=` (WS:16-18; AC:517-530 calls `onResubscribe`).
- **Live-plane values are ephemeral.** On subscribe the server sends a `snapshot` burst before deltas (WS:289-337). On a database LISTEN reconnect every subscriber gets `unavailable` and then a fresh snapshot (LP:135-145).
- **Canvas plane is a pure fan-out.** Browsers detect seq gaps and resync through REST (CP:4-18).
- **Client reconnect** uses a **fixed 1.5 s delay with no backoff or jitter** (AC:4, 245-255). A 4401 close calls `onUnauthorized`; a 4403 close calls `onForbidden` (AC:364-371).
- **Nothing outside sessions is pushed.** No session-list, budget, provider, package, feature-flag or worker updates arrive over the socket; the UI polls:

| What | Interval | Source |
|---|---|---|
| Session catalog (full page walk) | 4 s | C:2645 |
| Profile settings | 5 s | W:118 |
| Orchestration and session stats | 20 s | C:96-97 |
| Fleet stats | 30 s | C:98 |
| Steering flag | 30 s | C:462 |
| Provider table | 60 s | W:13154 |
| Outbox recheck | 10 s | C:105 |

---

## 3. Roles and permission model

### 3.1 Admission (who gets in) — AU authz/engine.js:60-168

- **Providers** (AU index.js:8-18; config.js:56-80):
  - `none` — auth off.
  - `entra` — JWT, JWKS.
  - `proxy` — signed assertion (default Cloudflare Access) or trusted headers, which require `PORTAL_AUTH_PROXY_TRUST_HEADERS=true`.
  - `dev` — fake personas `dev:<id>`; needs `PORTAL_AUTH_DEV_ALLOW=true` and refuses to start alongside Entra.
- **Role resolution, in order:**
  1. A token `roles[]` claim decides alone: `admin` beats `user`; anything else is denied.
  2. Otherwise the email allowlists `PORTAL_AUTHZ_ADMIN_GROUPS` and `PORTAL_AUTHZ_USER_GROUPS`.
  3. Otherwise `PORTAL_AUTHZ_DEFAULT_ROLE`, which defaults to `none` = deny.
- **No-auth** deployments give every caller the synthetic principal `none/unknown` with role **`anonymous`**, which is treated as **admin** everywhere (RT:98-105; R:663-667).
- **Denial UX:** a 401 drives re-auth. A 403 from `/auth/me` or `/bootstrap` shows the "access denied" gate. Any other 403 is inline (AC:105-127).

### 3.2 Roles and deployment posture

| Concept | Values | Effect |
|---|---|---|
| Role | `admin`, `user`, `anonymous` (= admin), none (denied) | `fleet:admin` ops: admin only, always enforced (RT:206-209; R:303-307) |
| Admin scope (`AUTHZ_ADMIN_SCOPE`) | `unrestricted` (default) or `cluster` | `cluster`: admins manage the cluster and system sessions, but get **no bypass into users' private resources** and receive redacted fleet diagnostics. Requires enforcement and real auth (AS:14-30; R:289-292, 669-671) |
| Ownership enforcement (`AUTHZ_ENFORCE_OWNERSHIP`) | **default `false` (dark launch)** | When off, would-be denials are only audited as `would_deny` and allowed through, **except** `session:share`, `session:files`, canvas-action sends and `fleet:admin`, which are always enforced (AZ:25-29; R:375). `fleet:read` ops and the log tail are open to plain users when off (R:303, 1643) |
| Default visibility (`SESSIONS_DEFAULT_VISIBILITY`) | `private` (default), `shared_read`, `shared_write` | Applied at create (R:920) |
| System-session visibility (`SESSIONS_SYSTEM_VISIBILITY`) | `read` (default) or `admin` | `read`: everyone can read system sessions; only admins interact. `admin`: hidden, every class answers 404 (SA:108-114) |

**The UI should surface this posture.** `bootstrap.authz` and `getSessionAccess.enforced` tell the client whether "private" is really enforced.

### 3.3 Session relations (SA:59-142; R:1120-1145)

| Relation | read | write (send, answer, steer, stop, upload, retry workspace) | manage (rename, cancel, complete, model, regenerate, workspace set, delete artifact, export history) | destroy | share (visibility, grants, canvas KV access, canvas link) | files (Workspace pane, canvas-ws) |
|---|---|---|---|---|---|---|
| Owner | yes | yes | yes | yes | yes | yes (not on system sessions) |
| Admin (unrestricted scope) | yes, break-glass audited on private sessions | yes | yes | yes | yes | **no** |
| Admin (cluster scope) | system sessions only | system only | system only | system only | system only | no |
| Collaborator with a `write` grant, or the tree is `shared_write` | yes | yes | no ("Only the session owner … can do this") | no | no | no |
| Collaborator with a `read` grant, or the tree is `shared_read` | yes | no ("ask <owner> for write access") | no | no | no | no |
| Anyone else | **404 Not Found** (no existence oracle) | 404 | 404 | 404 | 404 | 404 |
| Any user, system session (visibility `read`) | yes | no ("managed by administrators") | no | no | no | no |

- Grants and visibility apply to the **tree root**, so a sub-agent inherits its root's access.
- **Archive (raw session tar)** access is owner or admin only, never a share (SA:158-175).

### 3.4 Other resource permission models

| Resource | Model |
|---|---|
| **Session groups** | Private per user. Even admins see only their own. Placement needs read access to the session; the target group must be the caller's own (R:458-539) |
| **Agent packages** | Scope `shared` (deployment-wide) or `user` (private). Creator or admin: scope, delete, editors. Editors (shared only): publish, republish, pin, enable. Visibility: shared plus own; admins see all. Enforced in SQL (P:221-242) |
| **Providers** | Shared: admin manages, everyone spends (subject to allowance). Personal: owner only; admins can see but not use another person's (`usableByMe:false`). All decided in SQL (R:1380-1395) |
| **Canvas KV** | Floor is session read. Writers always write. Read-only viewers write only when both the owner policy (`readers\|link`) and the app manifest (`kv.write:"viewers"`) allow it. Reserved prefixes `cfg/`, `evt/`, `ui/<id>`. `req/*` rows from read-only viewers are capped to `suggested` (`src/canvas-kv.ts:133-214`) |
| **Canvas public link** | Bearer token is read-only: doc, live state, KV read, canvas WS pings |
| **Feature flags** | Cluster: admin. My preferences: any user, if the cluster allows overrides. Other users' preferences: admin |
| **Facts** | Non-admins read shared facts (or session facts with session read) and write shared facts or facts of sessions they can write. Admins are unrestricted (R:444-456, 859-873) |
| **Graph** | Data plane: any admitted user. Namespaces: admin |
| **Audit** | Admin fleet-wide; owners for one of their sessions |

**Admin capability flags for UI gating:** `getCurrentUserProfile.capabilities = {clusterManagement, fleetAccounting, userResourceBypass, systemSessionAdmin}` (AS:32-39). The UI should gate on these, not on the raw role.

---

## 4. Backend constraints the UI must respect

### 4.1 Envelope and errors

- **Success:** `{ok:true, result}`.
- **Failure:** `{ok:false, error:{code, message, candidates?, validation?, etag?, size?}}` (`web/api/error-detail.js:12-23`).
- **5xx messages are replaced** with "Internal server error" unless the error sets `expose:true`. Workspace TIMEOUT and BUSY do (`error-detail.js:15`).
- **HTTP status** comes from the code map (RT:20-46), then `error.status`, then a **message regex**:
  - "is not started / terminal orchestration / cannot accept new messages / already" → 409;
  - "must be / is required / not found / Unsupported / Unknown model …" → 400.
- Unknown `/api/v1` paths return an enveloped 404 (RT:221-226).
- **Id params are validated:** `^[\w:.-]{1,200}$`, no `..` (RT:81-96).

**Codes the UI must handle:**

| Area | Codes |
|---|---|
| General | `INVALID_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `INTERNAL_ERROR`, `RATE_LIMITED` (429) |
| Models | `MODEL_AMBIGUOUS` (+candidates), `MODEL_UNRESOLVED`, `GHCP_KEY_MISSING` |
| Artifacts | `INVALID_ATTACHMENT`, `ARTIFACT_TOO_LARGE`, `ARTIFACT_CONTENT_TYPE_MISMATCH`, `ARTIFACT_CONTENT_TYPE_REQUIRED` |
| Lifecycle | `REGENERATE_UNSUPPORTED`, `SYSTEM_AGENT_LOADED` |
| Capability mismatch | `FACTS_ENHANCED_UNSUPPORTED`, `GRAPH_UNSUPPORTED` |
| Packages | `VALIDATION_FAILED` (+validation) |
| Workspace | `WORKSPACE_*`, `WORKSPACE_FILES_*` (+etag / size), `CANVAS_WS_*` |
| Providers | `PROVIDER_*` |
| Feature flags | `FEATURE_CONFLICT`, `FEATURE_UNAVAILABLE` |
| Auth | `PORTAL_AUTH_REQUIRED`, `PORTAL_ADMIN_REQUIRED` |

Package-registry refusals (`AGENT_PACKAGE_*`) map to FORBIDDEN, NOT_FOUND, CONFLICT or INVALID_REQUEST.

### 4.2 Size caps

| Item | Cap | Source |
|---|---|---|
| Any JSON body | 2 MB — this includes prompts and steers | S:95; tests `web/test/api-router.test.mjs:404-421` |
| Artifact upload body | 8 MB envelope | S:84 |
| Artifact content | text 1 MB, binary 10 MB | `src/session-store.ts:105-106` |
| **Effective binary upload from the portal** | **≈ 5.9 MB.** A base64 body inflates by 4/3, so the 8 MB envelope is hit before the 10 MB cap (inference from S:84 and the caps) | — |
| Image attachments | ≤4 per message, ≤4 MB each, ≤8 MB total; png, jpeg, gif, webp | `src/types.ts:2055-2067` |
| Agent package | ≤2 MB decoded, ≤2000 files, 4 MB body | S:87; M:5307-5360 |
| Workspace file | `PORTAL_WORKSPACE_MAX_FILE_MB` (20); git file view ≤5 MB; zip total ≤ max | — |
| Canvas KV | key ≤200 chars, value ≤16 KB, ≤1000 keys / 2 MB per canvas, ≤50 ops per write, page ≤200 | — |
| Canvas action | payload ≤8 KB; string fields ≤2048 chars | — |
| Canvas manifest | first 4 KB of the document | — |
| Live-plane payload | 256 KiB; NOTIFY inline data ≤7900 bytes, otherwise a pointer | `src/cms-migrations.ts:14786-14820` |
| Native-tasks payload | trimmed to 240 KB | — |
| Steer / regenerate text | Regenerate handoff and instructions ≤4000 chars | — |

### 4.3 Pagination and limits

| Read | Limit |
|---|---|
| `listSessionsPage` | Keyset `cursor{updatedAt, sessionId}`; limit 1–200 (default 50). **No server-side text search, owner filter or status filter** — only `systemFilter`, `includeDeleted`, `viewerOnly` |
| Events | `afterSeq` / `beforeSeq` + `limit`; optional `eventTypes` filter |
| `readCanvasKv` | `after` cursor, ≤200 |
| Workspace `list` | ≤5000 entries, `truncated` |
| Workspace `find` | ≤200 matches |
| Git `log` | pages of 50 (`skip`) |
| `listAuthzAudit`, `listFeatureFlagChanges` | `limit` only (≤200); **no cursor** |
| `listPausedSessions` | capped at 100, no cursor |
| `getProviderUsage` | `limit` + `truncated`; usage summaries `days` 1–365 |
| `getTopEventEmitters` | `limit` 1–100, `since` required |
| `listKnownUsers` | `limit` only |

### 4.4 Rate limits and concurrency

- **Canvas KV writes:** 10/s per viewer per session and 50/s per canvas, counted per op (R:1318-1323, 1722-1740). This is the **only server rate limit**. It is in-process, so it is per portal replica.
- **Workspace files:** 2 heavy and 6 light ops concurrently; a 10 s queue wait fails with BUSY. Canvas-ws `run`: ≤4 concurrent.
- **WS:** ≤64 sessions per socket; ≤16 live topics per session; a slow consumer (>128 queued or >1 MB buffered) is closed with 1013.
- **Client side:** canvas actions ≤3 per 3 s.

### 4.5 Long-running and async semantics

| Op | Behavior | UI implication |
|---|---|---|
| `setSessionWorkspace` | Holds the request up to 120 s (max 300 s); may return `pending` + `commandId` | Needs a "waiting for the turn to finish" state and a pending result |
| `retrySessionWorkspace` | Holds up to 60 s | Same |
| `stopSessionTurn` | Holds up to 30 s; `timeout` with `controlSeq` means accepted, outcome arrives later as `session.control_outcome` | Two-phase Stop UI |
| `steerSessionTurn` | Immediate accept or refuse; delivery later via events | Pending → Delivered / Carried / Not delivered chips |
| `waitForStatusChange` | Long-poll, 25 s default | Unused by the portal (WS instead) |
| `regenerateSession` | Returns `attemptId` at once; progress through events | Progress UI keyed on `attemptId` |
| `sendMessage` | Fire-and-forget; idempotent on `clientMessageIds` (duplicates among the last 20 suppressed); `enqueueOnly` | Optimistic outbox with cancel |
| `setSystemModelDefault` with `restartExisting` | Synchronous fan-out; returns `failures[]` | Show a per-agent result list |
| Package publish / pin / enable | Synchronous registry write; fleet converges on a ~20 s epoch poll | Show convergence through `listAgentWorkerState` / `listWorkers` |
| Feature-flag write | Synchronous; workers apply on the next ~20 s poll | Per-flag delivery status exists |

### 4.6 Idempotency and optimistic concurrency

| Mechanism | Ops |
|---|---|
| `requestId` | `stopSessionTurn`, `steerSessionTurn` (`request_id_reused`), feature-flag writes (stored receipt) |
| `clientMessageIds` | Message dedupe and cancel |
| `expectedRevision` | `setSessionWorkspace` (int), feature flags (int64 string) |
| `ifMatch` | Workspace writes (sha256 etag; null = create-only), canvas KV (`rev`; 0 = must not exist) |
| Idempotent by design | Package editor revoke; package publish of the same bytes (`noop`) |
| **No concurrency control** | `setCurrentUserProfileSettings` replaces the whole settings object. Two tabs or devices race (last write wins, polled every 5 s) |

---

## 5. Gaps: capabilities with no or poor UI, and API issues that hurt UX

### 5.1 Capabilities with no UI (designers must decide whether to expose them)

| # | Capability | Ops | Status | Why it matters |
|---|---|---|---|---|
| G1 | **Knowledge: facts and graph browser** | 22 ops (§1.11) | NO-T | Agents' shared memory is invisible and uneditable. Admins cannot run the embedder or purge |
| G2 | **Session context health** | `getSessionFootprint` | NO-T | The UI offers Regenerate with no eligibility or "why now" signal, although the backend computes `recommendation: regenerate` and `regenEligibility` |
| G3 | **Sub-agent results** | `listChildOutcomes`, `getChildOutcome` | NO | Structured verdicts and summaries of child agents are never shown; the spawn tree shows only status |
| G4 | **Audit trail** | `listAuthzAudit` | NO | Owners cannot see who break-glassed their private session or who changed sharing; admins have no audit view. Feature changes are audited but `listFeatureFlagChanges` also has no UI |
| G5 | **Artifact pin and copy** | `setArtifactPinned`, `copyArtifact`, `readArtifactBase64` | NO | Pinning protects files from retention sweeps; no way to move a file between sessions |
| G6 | **Schedules (cron)** | none exist | API gap | You can see that a schedule is active, but there is no list, cancel or pause across sessions. The only remedies are chat, Stop or Complete |
| G7 | **Retrieval and graph telemetry** | 6 ops (§1.10) | NO-T | Tuner-grade diagnostics: what the agent searched and found |
| G8 | **Provider hygiene** | `clearProviderRoutingDependencies`, `getLegacyProviderMigrationStatus`, `adoptLegacySystemGitHubCopilotKey` | NO | Deleting a provider that a default uses fails with `PROVIDER_IN_USE`, and the fix has no button. Legacy key adoption is CLI or MCP only |
| G9 | **Fleet hygiene** | `getTopEventEmitters`, `pruneDeletedSummaries`, `forcePurgeFacts` | NO / NO-T | Admin maintenance is reachable only from MCP (`packages/app/mcp/src/tools/system.ts`, `observability.ts`) |
| G10 | **Custom session events** | `sendSessionEvent` | NO-T | Integration hook (e.g. external triggers) with no UI |
| G11 | **Group bulk actions** | `cancelSessionGroup`, `completeSessionGroup` (deprecated) | NO | Bulk cancel / complete of a group exists in MCP (`manage_session_group`) but not in the portal |

**MCP and TUI comparison.** The MCP server exposes everything in G1–G11 (`packages/app/mcp/src/tools/*.ts`), so the portal is a subset of MCP. The TUI shares the same controller and is itself a subset of the portal (no MoA, no feature panel).

### 5.2 Poor UI exposure of existing data

| Area | Problem |
|---|---|
| **Questions** | `choices` render as a text list; there are no choice buttons and no `allowFreeform=false` enforcement (SEL:1724-1757; W:9935) |
| **Generic grey lines** | Many backend states render only as `[eventType] text` (H:1406-1412): `session.budget_paused`, all `session.workspace_*`, `session.regenerate_requested` / `session.regenerated`, `session.model_resolved` / `session.model_mismatch`, `session.fifo_overflow`, `session.child_cleanup_completed`, `runtime.attachment_dropped` (an image silently not sent to the model!), `session.canvas_app_published`, `session.warning` / `session.truncation`, `session.title_changed`, `session.todos_changed`. The UI also has handlers for events with no current emitter: `session.rehydrated`, `session.cron_cancelled`, `assistant.streaming_progress` |
| **Status gaps** | Workspace waits (`customStatus.gate:"workspace"`) have no distinct display status; they read as `waiting`. Regeneration reads as `running` plus `regenStage`. Display statuses the UI derives: `budget_paused`, `cron_waiting`, `awaiting_children` (SEL:113-136) |
| **Streaming preview** | `assistant.live_tick` exists only when the deployment sets `PILOTSWARM_LIVE_TURN=1` (`src/session-proxy.ts:4041`). The UI must also look right without token streaming |
| **Enforcement posture** | The `enforced` flag, `defaultVisibility` and `adminScope` are not explained to users. With the default (enforcement off), "private" sessions are not actually protected for direct-id access, and plain users can open the fleet log tail and fleet stats |
| **Package editors** | Editors come from the detail payload; `listAgentPackageEditors` is unused. Selector complexity (`scope` + owner) leaks into UX whenever names collide |

### 5.3 API and platform issues that hurt UX

| # | Issue | Evidence |
|---|---|---|
| Q1 | **No push for the session catalog.** The UI walks all pages every 4 s; cost grows with history size, and changes appear with up to 4 s lag | C:202-231, C:2645 |
| Q2 | **No server-side search or filtering of sessions** (text, owner, status, agent, group). Filters are client-side, so the full catalog must be loaded | P:101 |
| Q3 | **Profile settings are a whole-object replace with no revision**, polled every 5 s: cross-tab and cross-device lost updates for layout, pins and MoA dashboards | P:246; W:118, 527-529 |
| Q4 | **Oversized bodies likely return an Express HTML error page, not the envelope.** The 413 handler lives inside the `/api/v1` router (RT:228-242), but body parsers are app-level (S:81-96). Tests mount their own app-level error handler, so they don't catch this (`web/test/api-router.test.mjs:387`). Inference — verify | — |
| Q5 | **Effective portal upload ceiling ≈ 5.9 MB binary**, not the advertised 10 MB (base64 inside an 8 MB envelope). Uploads are base64-in-JSON: no multipart, progress, resume or streaming | S:84 |
| Q6 | **Status codes partly derived from error-message regexes** (RT:52-62). Wording changes can silently turn a 400 into a 500 with a masked message. `PORTAL_ADMIN_REQUIRED` has no status mapping (R:782-795): a 500 on `/api/rpc` if ever reached | — |
| Q7 | **WS reconnect: fixed 1.5 s, no backoff or jitter** — a thundering herd after a portal restart. The log tail has no catch-up | AC:4 |
| Q8 | **Contract drift.** `WS_CLIENT_MESSAGES` / `WS_SERVER_MESSAGES` omit `subscribeCanvas`, `unsubscribeCanvas`, `subscribedCanvas`, `canvasLive` (P:44-45; WS:224-258). `docs/api/reference.md:30-33,68-77` says 2 MB for everything, omits canvas WS messages, the error extras (`candidates`, `validation`, `etag`, `size`), `authz` in health, and the `dev` auth provider | — |
| Q9 | **Legacy surfaces still mounted:** `/api/rpc`, `/portal-ws`, `/api/sessions/:id/artifacts/*`, `/api/health`, `/api/auth-config`, `/api/auth/me`, `/api/bootstrap`. The SPA still depends on legacy **`/api/portal-config`**, which has no `/api/v1` equivalent | S:181-346; `web/src/App.jsx:131` |
| Q10 | **Dead scaffolding in `packages/app/web/src`.** `main.tsx`, `App.tsx`, `hooks/useWebSocket.ts`, `hooks/PortalContext.tsx`, `lib/api.ts` and `components/layout/*.tsx` describe a WS chat protocol (`createSession`, `send`, `toolCall`, `sessionList`) that does not exist. `index.html` loads `main.jsx` → `App.jsx`. Designers and devs should not treat `lib/api.ts` as the contract | `web/index.html:10`; `web/src/lib/api.ts:1-103` |
| Q11 | **Deprecated group ops still referenced as fallbacks.** `assignSessionsToGroup` and `moveSessionsToGroup` (P:160, 163) are used only when `placeSessionsInGroup` is absent, which the browser transport never is (C:6826-6831) | — |
| Q12 | **Comment and code disagree on canvas actions:** "creator-only" in the comment, all writers in the code. Designers should follow the code: any writer | R:1080 vs R:1098-1100 |
| Q13 | **Two model catalogs with different meanings:** `listModels` = runtime provider instances; `getModelsByProvider` / bootstrap `modelsByProvider` = provider-type templates. Pickers built on the bootstrap list show models the viewer may not be able to run (`credentialAvailable`, `usableByMe`) | P:208-209 |
| Q14 | **`GHCP_KEY_MISSING` surfaces at turn time, not create time.** A session can be created and then fail on its first send | `src/session-manager.ts:2133-2140` |
| Q15 | **Opaque 404 by design** for sessions you cannot read (no existence oracle). The UI cannot distinguish "deleted" from "never shared with you"; a revoked share arrives as "Session not found." (WS:113). Copy must handle this gracefully | — |
| Q16 | **Health endpoint is public and discloses authz posture** (adminScope, ownershipEnforced, visibilities) | RT:126-128; S:181-189 |
| Q17 | **Uploaded artifacts are recorded with `source:"agent"`**, because the portal sends no source. "Uploaded by you" cannot be distinguished from agent output in Files | T:1883-1888 |

---

## 6. Appendix: quick index of every operation by UI status

- **NO-T — 38 operations the browser transport does not expose:**
  - Session status and events: `sendSessionEvent`, `getSessionStatus`, `waitForStatusChange`, `getLatestResponse`, `getSessionFootprint`.
  - Retrieval and graph telemetry: `getSessionRetrievalUsage`, `getSessionTreeRetrievalUsage`, `getSessionGraphNodeUsage`, `getSessionGraphEdgeSearchUsage`, `getSessionGraphSearches`, `getFleetGraphNodeUsage`.
  - The 22 facts and graph operations.
  - Read through bootstrap instead: `getModelsByProvider`, `getDefaultModel`, `getSessionCreationPolicy`, `getLogConfig`, `getWorkerCount`.
- **NO — transport method exists but the UI never calls it:**
  - `listAuthzAudit`
  - `readArtifactBase64`, `copyArtifact`, `setArtifactPinned`
  - `listChildOutcomes`, `getChildOutcome`
  - `cancelSessionGroup`, `completeSessionGroup`
  - `getTopEventEmitters`, `pruneDeletedSummaries`
  - `listAgentPackageEditors`, `listFeatureFlagChanges`
  - `clearProviderRoutingDependencies`, `getLegacyProviderMigrationStatus`, `adoptLegacySystemGitHubCopilotKey`
- **PARTIAL:**
  - `listSessions` (fallback)
  - `getCanvasLive`, `getLive` (internal resync)
  - `listFeatureFlags` (the UI uses the cluster read)
  - `assignSessionsToGroup`, `moveSessionsToGroup` (deprecated)
- **YES:** every other operation, with call sites cited in §1.

**Method.** I read `server.js`, `router.js`, `ws.js`, both planes, the auth stack, `runtime.js`, every `packages/sdk/api/src` file, and the relevant SDK sources and docs. UI exposure comes from greps of `packages/app/ui` and `packages/app/web/src`. The deep event catalog (§2.4), the workspace/artifact/canvas limits (§1.3–1.5, §4.2) and the flags/providers/MCP comparison (§1.7, §1.9, §5.1) were gathered by three parallel read-only research passes, and their key numbers were spot-checked against source (`src/session-store.ts:105-106`, `src/types.ts:2053-2067`, `src/feature-flags.ts:2-31`, `src/session-proxy.ts:4041`).
