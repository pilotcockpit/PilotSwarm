V2 is close. The remaining blockers are persistence semantics, actionable-state classification, and guarantees about descendants. This is source-based review; runtime behavior remains untested. No files changed, generative APIs called, or reviewers invoked.

1. **Persistence: recommend A; B works as storage, but is not invisible or conflict-safe.**

   Your merge claim is correct: `metadata || metadataPatch` merges **top-level keys** server-side. Nested objects and arrays replace wholesale; concurrent pin-array writes can lose changes. See [cms-migrations.ts:6307](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/cms-migrations.ts:6307).

   B’s specific consequences:

   - **Empty survival/listing:** yes. Creation requires no members, and listing uses left joins without a nonempty condition. An owned empty group appears with zero counts. See [creation:5698](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/cms-migrations.ts:5698), [listing:2121](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/cms-migrations.ts:2121).
   - **Privacy:** viewer-scoped listing excludes other users’ groups, including for admins. This is organizational privacy, not absolute administrative isolation: direct unscoped listing exists, and resource admins bypass group-management authorization. See [runtime.js:458](/Volumes/SSD/code/work/PilotSwarm/packages/app/web/runtime.js:458).
   - **Classic/TUI compatibility:** they would display it and offer it as a move target. The shared controller converts every group into a row and maps every group into the picker. Ordinary metadata should not itself crash those paths, but “invisible” is false. See [controller.js:115](/Volumes/SSD/code/work/PilotSwarm/packages/app/ui/core/src/controller.js:115), [controller.js:6730](/Volumes/SSD/code/work/PilotSwarm/packages/app/ui/core/src/controller.js:6730).
   - **Lazy creation:** possible, but list-then-create is racy. There is no per-user reserved-purpose uniqueness contract; random IDs permit duplicates.
   - **Size:** no metadata-specific bound in the table/procedure. The portal’s default request-body limit is 2 MB, which does not bound accumulated metadata across patches. See [schema:4925](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/cms-migrations.ts:4925), [server.js:78](/Volumes/SSD/code/work/PilotSwarm/packages/app/web/server.js:78).
   - **Placement:** metadata references move nothing. Accidentally placing sessions into this ordinary group still moves their whole trees.
   - **Cleanup:** deleting the group deletes its preferences and clears placements, without deleting sessions. Session deletion does not prune arbitrary metadata references. User deletion also needs explicit group cleanup: the group-owner user FK lacks cascade. See [deletion:2146](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/cms-migrations.ts:2146), [ownership:5644](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/cms-migrations.ts:5644).

   Making B honest requires reserved identity, atomic creation, exclusion from ordinary listings, placement rejection, protected deletion, and concurrency handling. That is substantial backend work disguised as reuse.

   **Smallest honest A:** one separate navigation-preferences document and revision per user, with authenticated read and compare-and-swap write/reset operations; bounded payload, schema version, explicit conflict response. This can be columns on the existing user record rather than a general KV platform. Keep expansion local. C is simply the labelled browser-local fallback; it does not deliver roaming.

2. **Folders: accept bounded inline expansion, with a second bound on folder rows.**

   With **zero folders**, omit the section and its empty state; creation remains available on `/sessions`.

   With **12 folders**, show the first five in personal order, collapsed, then **All 12 folders**. Allow one expanded folder at a time, revealing up to five root rows plus **Open in Sessions**. Clicking the name opens the filtered page; the disclosure button expands.

   Preview membership must not subtract pinned/attention roots. Otherwise “five members” means five leftovers again. Counts should say **trees**; an attention chip counts actionable sessions across those trees. Today’s group aggregates count root states, so they cannot provide that descendant chip: [cms-migrations.ts:2111](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/cms-migrations.ts:2111).

   Both five-row limits are design hypotheses, not research findings.

3. **Needs you: capability must describe the remedy, and `error` is ambiguous.**

   Correct “their own provider, or an admin.” **Admins cannot manage another person’s personal provider.** Shared providers require admin; personal providers require their owner. The existing usage grid returns server-derived `manageable`; use it rather than reconstructing permission from class. See [authorization:10068](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/cms-migrations.ts:10068), [manageable:14450](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/cms-migrations.ts:14450).

   Available data includes provider `ownerUserId`, session owner principal, and Flight Deck’s admin flag. However, Flight Deck replaces session ownership with a display label, matching subject **or email**. Preserve provider+subject identity before owner-scoping attention: [live.ts:18](/Volumes/SSD/code/work/PilotSwarm/packages/flightdeck/src/data/live.ts:18).

   Provider management is only one remedy. Changing the session’s model requires `session:manage`, separately from provider authority: [protocol.js:107](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/api/src/protocol.js:107). Require a known permitted action and, for switching, a usable alternative. Unknown capability means **Waiting**, with no intervention CTA. Timed automatic resets normally remain Waiting.

   The failure rules must be:

   - Confirmed `failed`/failed orchestration: investigate.
   - Explicit nonretryable/auth stop, or exhausted retries that actually park: investigate.
   - Scheduled retry, workspace retry, or durable handoff: recovering.
   - `lastError` while running: diagnostic history, not independently actionable.

   Generic retries publish `error`; returned turn errors also write catalog `error` before retry handling. See [turn.ts:304](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/orchestration_1_0_82/turn.ts:304), [session-proxy.ts:4675](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/session-proxy.ts:4675). Crucially, `retriesExhausted:true` can precede automatic handoff and continuation: [turn.ts:160](/Volumes/SSD/code/work/PilotSwarm/packages/sdk/src/orchestration_1_0_82/turn.ts:160).

   Neither list nor detail DTO exposes sufficient recovery disposition. Do not classify by error wording. Until that contract exists, show ambiguous errors as **Error—recovery state unavailable**, inspectable but excluded from confirmed Needs-you totals.

4. **Recent: freeze positions, not information or membership indefinitely.**

   Keep status, reason, and completion changes live in place. Count distinct changed sessions in a persistent **N updated · Refresh order** control; it must remain reachable after pointer/focus leaves. Do not imply unread messages.

   When a visible running session completes, show **Completed** immediately and retain its position until explicit reconciliation or the next sidebar entry. Remove it then, provided it has no unresolved descendant attention.

   **Retain the active session while selected**, even when terminal; pinned terminal sessions remain pinned. Failed sessions follow attention rules rather than disappearing. Add an explicit `/sessions` Activity sort for operators who want movement. Existing polling can support these presentation rules without a new feed: [source.tsx:74](/Volumes/SSD/code/work/PilotSwarm/packages/flightdeck/src/data/source.tsx:74).

5. **Delegation: separate parent state from descendant exceptions.**

   Render, for example: **Release build · Running** / **3 running descendants · 1 failed descendant**. Keep the root’s state truthful; make the failure chip open the affected descendants.

   The failed child independently appears in Needs you as **Release build › Research › Child**, regardless of parent expansion, folder, pinning, or terminal status.

   This requires discovery over the complete authorized catalog, not visible rows. P0 can retain full-catalog refresh and derive descendants before display filtering. Once paginated, require server aggregation plus complete attention discovery. Current `withChildCounts` only counts loaded direct children and treats idle as active; it cannot fulfill this promise: [live.ts:60](/Volumes/SSD/code/work/PilotSwarm/packages/flightdeck/src/data/live.ts:60). Failed-child discovery is a release gate.

6. **Remaining cuts and unsupported claims.**

   A safe store alone does not make dismissals safe: require a failure-occurrence identifier so dismissing yesterday’s failure cannot hide tomorrow’s identical one. Until then, make dismissal temporary and clear it on observed recovery.

   Defer sidebar hold grouping until structured causes and complete pause discovery exist. Replace “honest folder attention chips” in UI-only P0 with the explicit full-catalog dependency above.

**VERDICT: SIGN OFF WITH CHANGES**

**Required changes:** adopt A/C persistence boundaries; capability-based holds; explicit recovery/unknown states; occurrence-scoped dismissal; bounded folders; live status with deferred reordering/removal; active-row retention; complete descendant discovery before release.

**Owner decisions:** confirm personal-first scope, whether roaming is required for initial release, and whether the proposed five-folder preview adequately meets the grouped-sidebar expectation.