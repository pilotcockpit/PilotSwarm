**I would reject the draft’s phase-one scope.** It combines a navigation redesign with an incomplete attention system and unsafe preference synchronization. The strongest direction is a smaller sidebar, backed by trustworthy session discovery.

This is a source-based design discussion; live behavior and usability remain untested. No files were modified, generative APIs called, or additional reviewers invoked.

The material fact corrections are:

- **Question previews are partly available already.** The research memo’s “without pendingQuestion, task 1 cannot work” overstates the gap. Input-required events write the question into `waitReason`, which list DTOs expose. Choices and question identity still require detail. See [session-proxy.ts:4093](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/session-proxy.ts:4093) and [management-client.ts:432](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/management-client.ts:432).
- **“50 sub-agents” is not a lifetime tree-size ceiling.** The check limits concurrently running direct children per spawning session. Historical children and grandchildren can exceed 50 overall. The IA’s “reveal up to the 50 cap” is therefore wrong. See [agents.ts:808](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/orchestration_1_0_82/agents.ts:808).
- **Status exposure is not “Full.”** `pending` falls through to Idle in Flight Deck. See [state.ts:40](/Volumes/SSD/code/work/PilotSwarm/packages/flightdeck/src/data/state.ts:40) and [state.ts:85](/Volumes/SSD/code/work/PilotSwarm/packages/flightdeck/src/data/state.ts:85).
- **The audit and designer miss existing navigation affordances.** New session and Search already exist above Sessions; row pin controls exist. There is no inline sidebar filter, but search is not confined to `/sessions`: the command palette searches sessions. See [AppShell.tsx:100](/Volumes/SSD/code/work/PilotSwarm/packages/flightdeck/src/shell/AppShell.tsx:100), [sessions-sidebar.tsx:296](/Volumes/SSD/code/work/PilotSwarm/packages/flightdeck/src/components/sidebar/sessions-sidebar.tsx:296), and [CommandPalette.tsx:88](/Volumes/SSD/code/work/PilotSwarm/packages/flightdeck/src/shell/CommandPalette.tsx:88).
- **The proposed pause join is incomplete at scale.** `listPausedSessions` requests only 100 rows, without pagination. An admin’s results can consume that limit before personal filtering. See [management-client.ts:5089](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/management-client.ts:5089).
- **Page-one polling is not a reliable delta feed.** More than 200 changed sessions can displace unseen updates. Deletions and access revocations cannot be inferred from absence on page one. Mutable ordering also permits omissions during initial traversal. The cursor provides ordering, not snapshot consistency. See [cms-migrations.ts:513](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/cms-migrations.ts:513).
- **“Quiet for 20 minutes never invents stuck” is false.** A healthy long-running turn can lack catalog updates; summary writes can conceal inactivity. `lastActiveAt` already exists in CMS but is omitted from list DTOs; exposing it does not establish heartbeat semantics. See [cms.ts:130](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/cms.ts:130) and [management-client.ts:406](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/management-client.ts:406).
- **Others is not Shared with me for admins.** Current filtering means known owner other than “me.” A personal, access-scoped catalog already exists through `viewerOnly`; owner-specific filtering remains missing. See [session-access.ts:9](/Volumes/SSD/code/work/PilotSwarm/packages/flightdeck/src/lib/session-access.ts:9) and [runtime.js:700](/Volumes/SSD/code/work/PilotSwarm/packages/app/web/runtime.js:700).
- **The research arithmetic checks out; its recommendation remains hypothetical.** Scores, persona frequencies, severity ratings, folder demand, five-row caps, and duplication tolerance are judgments. The synthesis also overstates consensus: the researcher calls backend signals a precondition, while the draft proposes shipping their approximations first.
- **Competitor claims need narrower wording.** Claude pin relocation and “unread means finished” are unverified here. Current [Claude Code documentation](https://code.claude.com/docs/en/desktop#organize-and-find-sessions) describes grouping, sorting, and archive discovery. [Official OpenAI documentation](https://learn.chatgpt.com/docs/reference/commands#keyboard-shortcuts) confirms pinning, unread, archiving, and next-attention navigation. Neither establishes this proposed folder model.

My decisions on D1–D7:

| Decision | Recommendation, rationale, and reconsideration |
|---|---|
| **D1: Pin relocation** | **No relocation.** Placement and shortcuts are independent. But do not render three copies across Needs you, Pinned, and Recent: retain the pin marker and suppress redundant continuation rows. Test duplication comprehension before expanding it. |
| **D2: Finished work** | **Change:** one Completed/Cancelled lens on `/sessions`; retain folder membership. Cut per-folder Done folds and the sidebar-wide Done footer. Reconsider if frequent folder users demonstrably retrieve finished work within folders. |
| **D3: Cause grouping** | **Narrow:** group verified holds sharing provider, scope, reason, and reset condition. Identical error text does not prove one remedy. Failures remain individually inspectable. Broaden only after validating structured incident identities. |
| **D4: Advanced interactions** | **Cut most, rather than promise phase two.** Keep visible menus, search, and next-attention navigation. Hover peek, swipe, drag, and nine pin shortcuts need repeated-task evidence before funding. |
| **D5: Ordering** | **Change:** order continuation by `updatedAt` on entry, then settle it. Cut arbitrary five-minute buckets and automatic three-second resorting. Reconsider when meaningful-event timestamps and retrieval tests demonstrate improvement. |
| **D6: Stuck** | **Reject from Needs you.** “Quiet” still implies concern without evidence. Show last observed update in detail. Reconsider with heartbeat/progress semantics and task-specific thresholds. |
| **D7: Shared** | **Change:** a consistent Shared lens, primarily on `/sessions`; optional sidebar shortcut. Avoid a hidden sidebar scope filter changing everything. Reconsider if shared work dominates daily continuation. |

The overall model needs simplification. **Triage plus continuation is sound; Triage plus a mandatory Library tree is premature.** “Exactly one home” should mean *at most one private folder placement per viewer and root tree*. It should not dictate every navigation surface.

Queue-plus-home duplication is useful when one is an exception index and the other is stable retrieval. Three expanded lists repeating the same titles create noise. Twin-hover highlighting adds machinery to explain that noise.

Folders may belong in the sidebar as optional, flat navigation links opening a filtered page. I would initially cut their nested contents. Use a list for session switching; reserve hierarchy for inspecting delegation. Share state, identity, access, and counting definitions across surfaces—not an identical flattened rendering model. The page needs search, columns, filters, and bulk work.

My day-one expectation hypothesis for Claude Code/Codex users is: create, resume, search, see execution state, notice a request, and hide finished work. Manual filing should be optional. A Flight Deck folder must never imply a working directory or execution context.

The backend boundary is sharper than the draft admits:

- **Frontend-only:** corrected labels/count units, previews from available fields, stable positioning, bounded lists, keyboard navigation, and loaded-data descendant indicators.
- **Existing operations, frontend delivery:** folder rename/delete/description and metadata ordering. Metadata merges server-side, although simultaneous edits to the same ordering key still compete. See [cms-migrations.ts:6307](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/cms-migrations.ts:6307).
- **Unsafe synchronization:** the profile endpoint replaces settings. Classic portal normalization whitelists keys and rebuilds the document; new acknowledgement keys can disappear on a routine save, even without simultaneous requests. See [web-app.js:330](/Volumes/SSD/code/work/PilotSwarm/packages/app/ui/react/src/web-app.js:330) and [web-app.js:666](/Volumes/SSD/code/work/PilotSwarm/packages/app/ui/react/src/web-app.js:666). A patch endpoint alone cannot protect against old replacement writers. Use protected namespaces/version checks or a separate per-person store with atomic pin/ack operations. Keep expansion local.
- **Missing contracts:** reliable attention age and occurrence identity, complete pause discovery, meaningful activity, complete scoped search/counts, and deletion/revocation reconciliation. `sessionId + iterations + masked error` is a heuristic, not a guaranteed failure identifier. Opening must not silently acknowledge.

Operational failure cases must drive the design:

| Situation | Required behavior |
|---|---|
| **500 sessions** | Search beyond loaded rows; separate incomplete counts from totals. Virtualization improves rendering, not discovery correctness. |
| **0 sessions** | One creation action and explanation. Distinguish empty, filtered-empty, loading, and unavailable. |
| **Admin** | Personal scope by default; explicit Fleet scope. Preserve principal identities instead of relying on display labels. |
| **Phone** | Full-screen attention list, visible actions, preserved Back/scroll position; no dependence on hover or swipe. |
| **Failure storm** | Compact incident summary plus individual failures; questions remain reachable. No claim that one retry fixes all. |
| **Pinned + attention** | Attention row retains its pin; resolving attention preserves the pin and folder placement. |
| **Depth-two child** | Full root › child › grandchild context. Missing paged ancestors mean “not loaded,” not “orphan.” Never bury unresolved descendant attention under Done. |

My recommended design, in under 400 words:

Keep New session and Search at the top. Below, show **Needs you**, **Pinned**, and **Recent sessions**.

Needs you contains actionable questions and failures requiring investigation. Automatically recovering holds belong in a secondary waiting summary unless intervention is required. Each exception shows a reason, session title, and parent path when relevant. Cap the preview, with an explicit link to the complete queue. Never show “All clear” from incomplete or stale data.

Pinned is a stable personal watchlist. Recent sessions supports continuation, excludes redundant pinned roots, and settles while being used. The active session remains findable.

Folders are optional flat links opening `/sessions?folder=…`; management lives there. They retain membership regardless of status or pinning.

`/sessions` offers All, Needs you, Shared, and Completed/Cancelled lenses, with an explicit Fleet scope for administrators. Default results are searchable rows. Delegation expands on demand; matching descendants retain their ancestry.

Use consistent state meanings everywhere. Counts name their unit and scope. Read/unread, acknowledged, completed, and archived remain separate concepts.

Delivery should follow this order:

- **P0:** correct counts, ownership scope, pending state, available reasons, freshness, stable interaction, and empty states. Keep complete-catalog refresh until a replacement proves completeness. Test synthetic 0/40/500-session fixtures and failure storms. Measure missed actionable items, time to answer, wrong-session opens, payload size, and update latency.
- **P1:** complete attention/list contracts, safe personal persistence, scoped search/filter/counts, ancestor retrieval, and reconciliation. Measure cross-device consistency, lost updates, false-clear incidents, and discovery completeness.
- **P2:** optional folder links, incident grouping, and richer navigation only where observed demand justifies them. Measure retrieval success and repeat usage.

Only the owner can settle these product questions:

- **Primary audience: builder or fleet operator?** Recommend personal continuation first, explicit Fleet mode.
- **What clears a failure?** Recommend recovery or explicit acknowledgement; opening records reading only.
- **Who owns shared-session attention?** Recommend owner responsibility initially; delegated responsibility needs an explicit contract.
- **Must pins and acknowledgements roam?** Recommend yes, with safe persistence funded before promising it.
- **Are folders strategic?** Recommend optional until observed retrieval behavior supports greater prominence.

