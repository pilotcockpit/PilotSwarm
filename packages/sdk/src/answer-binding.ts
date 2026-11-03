/**
 * A strictly bound answer must name the question it answers: an object with a non-empty
 * `question` string (and an `iteration` number when supplied). Anything else would let the
 * orchestration decide what it meant, which is exactly what strict binding exists to prevent.
 * Shared with the web client so both fail before any request or enqueue.
 *
 * @internal
 */
export function assertStrictAnswerBinding(expected: unknown): void {
    const q = expected as { question?: unknown; iteration?: unknown } | null | undefined;
    const ok = q !== null && typeof q === "object"
        && typeof q.question === "string" && q.question.length > 0
        && (q.iteration === undefined || (typeof q.iteration === "number" && Number.isFinite(q.iteration)));
    if (!ok) {
        throw new Error(
            "sendAnswer: requireQuestionMatch needs an expectedQuestion { question, iteration? } with the non-empty text of the question the answer was written for. " +
            "Pass it as observed, or drop requireQuestionMatch to answer whichever question is open.",
        );
    }
}
