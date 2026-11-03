# Bug: a stale bound answer runs as an ordinary prompt, so a choice meant for one question can execute under another

**Status:** Fixed in orchestration `1.0.83` (opt-in; see [Fix](#fix))
**Filed:** 2026-10-30
**Component:** `pilotswarm-sdk` durable session orchestration (`processAnswer`), management client `sendAnswer`, web client and Web API `sendAnswer`
**Affected versions:** orchestration `1.0.73` through `1.0.82` (every released SDK that registers them, including 0.8.7)
**Severity:** Medium. No new privilege is involved (answering needs `session:write`, and any writer may already answer), but an answer that is a command in disguise can run against a question it was not written for. Destructive choices ("Delete old files", "Roll back now") are the worst case.

## Symptom

An agent asks a question with choices. A client renders the choices and the
person clicks one. Between the client reading the question and the answer being
processed, the open question changes: another writer answered it, the agent
asked a newer one, or the client was reconnecting on stale state. The answer
message still carries the `expectedQuestion` it was written for, and it no longer
matches. The orchestration does not discard it. It runs the raw answer text as an
ordinary user prompt:

```
t0  agent asks Q1: "Delete old files?"     choices: Delete old files | Keep them
t1  client A reads Q1 and renders the buttons
t2  another writer answers Q1 → "Keep them"; the agent asks Q2: "Archive the report?"
t3  client A's click arrives: { answer: "Delete old files", expectedQuestion: Q1 }
    result: the agent receives the user prompt "Delete old files" while Q2 is open.
            Q2 stays open. Nobody asked for the deletion.
```

The text is not lost, which is the point of the current design, but it is
interpreted as a fresh instruction instead of as an answer to a question that no
longer exists.

## Root cause

`processAnswer` (`packages/sdk/src/orchestration/queue.ts`) compares
`answerItem.expectedQuestion` with `pendingInputQuestion`. When they differ it
does not close the open question and uses `String(answerItem.answer)` as the
prompt for `processPrompt`:

```ts
const question = matchesQuestion ? pending : undefined;
...
const answerPrompt = question
    ? `The user was asked: "${question}"\nThe user responded...: "${answerItem.answer}"`
    : String(answerItem.answer);
```

This leniency is deliberate: a reconnecting client or a second writer must not
silently lose a person's words, and existing callers such as the TUI depend on it. The defect is that
there is no way for a caller to say "run this only if it is still the answer to
that question". Every answer is both "an answer" and "a message to forward".

A client-side re-check just before sending narrows the window but cannot close
it, because the answer travels through the durable messages queue and is
processed later. Only the orchestration can make the decision at the moment the
answer is consumed.

## Fix

Added as an **opt-in** so existing callers are unchanged.

- `sendAnswer(sessionId, answer, { expectedQuestion, requireQuestionMatch: true })`
  on the management client, the web client, and the Web API operation.
- Orchestration `1.0.83`: an answer that set `requireQuestionMatch: true` runs a
  turn only when all three hold: a valid binding (an `expectedQuestion` object with
  a non-empty `question` string), an open question, and the same question text
  (and the same iteration when one was given). Otherwise it runs **no turn**, the
  open question and its hold timer are left as they were, and the session records
  `session.answer_rejected`.

| Binding presented | without the flag (any version) / 1.0.82 | with the flag on 1.0.83 |
|---|---|---|
| matches the open question | answered | answered |
| stale (other question or iteration) | ordinary prompt | rejected, `stale-question` |
| valid, but nothing is being asked | ordinary prompt | rejected, `no-open-question` |
| omitted, `null`, `{}` or no `question` text | ordinary prompt | rejected, `invalid-binding` |

`session.answer_rejected` data: `{ reason, expectedQuestion, currentQuestion }`.

Design points worth reviewing:

1. **Never guess a binding for a strict answer.** The two answer stash sites (`drain`
   and the pre-dispatch sweep) used to fill a missing `expectedQuestion` from the
   current question. For a strict answer they keep it as supplied (or `null`), so
   `processAnswer` rejects it. A first implementation that only compared fields
   let `{ expectedQuestion: {} }` with no open question match (`undefined ===
   undefined`) and run the answer anyway; this was found in review and is covered
   by regression tests.
2. **Fail closed in the clients too.** The management and web clients throw before
   any enqueue or request when the flag is set without a valid `expectedQuestion`
   (`assertStrictAnswerBinding`, `packages/sdk/src/answer-binding.ts`).
3. **The portal server forwards the flag only when it is exactly `true`.**
   `packages/app/web/runtime.js` rebuilds the answer options field by field.
4. **Replay safety.** The new branch changes the yields `processAnswer` makes (a
   recorded event instead of a turn), so `1.0.82` is frozen in
   `orchestration_1_0_82/` and in-flight sessions keep replaying on it. It is
   byte-identical to the previous latest except `CURRENT_ORCHESTRATION_VERSION`.
5. **Lenient behaviour is unchanged** for callers that do not set the flag, for old
   persisted FIFO entries, and for `1.0.82` and older sessions.

Documented in [Orchestration Design, Bound answers (1.0.83)](../architecture/orchestration/design.md#bound-answers-1083)
and the [API reference](../api/reference.md).

## Compatibility and rollout

- No schema or database change. The flag is an optional message field and an
  optional method option.
- The flag is honoured only by sessions running `1.0.83`. Workers must roll to a
  build that registers `1.0.83`; a session upgrades at its next continue-as-new.
  Until then a session on `1.0.82` ignores the flag and stays lenient, and a
  queued entry created there cannot become strict afterwards. Callers should keep
  re-reading the open question just before sending as defence in depth.

## Tests

- `packages/sdk/test/local/answer-binding.test.js` (orchestration harness, 20
  tests): matching strict answer runs; stale answer on `1.0.83` runs no turn and
  records the event; no open question; `{}`, omitted and `null` bindings; a
  strict entry persisted in the FIFO and dispatched later; the open question and
  its hold timer survive rejection; lenient answers unchanged; frozen `1.0.82`
  replay control.
- `packages/sdk/test/unit/answer-binding-client.test.mjs`: management and web
  clients refuse a strict answer without a valid binding and make no request;
  valid bindings are forwarded.
- `packages/app/web/test/answer-binding-forward.test.mjs`: the portal forwards
  the flag only when it is exactly `true`.
- `packages/sdk/test/unit/orchestration-freeze-1-0-82.test.mjs` and the updated
  latest-version guards for the freeze.

## Not verified

- Replay against real persisted Duroxide history and a live worker upgrade
  (`1.0.82` to `1.0.83` through continue-as-new). The harness tests use a fake
  durable context.
- The PostgreSQL-backed suites.
- Durability of the rejection event follows the existing best-effort
  `recordSessionEvent` path.

## Acceptance

- A strict answer bound to question A, delivered while question B is open, runs no
  turn, records one `session.answer_rejected` with `reason: "stale-question"`, and
  leaves B open with its timer.
- A strict answer with no usable binding is rejected at the client and, if sent
  raw, at the orchestration with `reason: "invalid-binding"`.
- A strict answer that matches the open question behaves exactly like today.
- A non-strict answer behaves exactly as on `1.0.82`.
