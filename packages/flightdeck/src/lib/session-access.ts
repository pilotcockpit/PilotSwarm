/** Frontend hints only: the server authorizes every operation. */
interface AccessHints {
  owner?: unknown;
  visibility?: string;
  canWrite?: unknown;
  readOnly?: unknown;
}

/** The live adapter normalizes current ownership to `me`; the legacy `shared` URL filter means Others. */
export function matchesSessionOwner(session: AccessHints, filter: string): boolean {
  if (filter === "mine") return session.owner === "me";
  if (filter === "shared") return typeof session.owner === "string" && Boolean(session.owner) && session.owner !== "me";
  return true;
}

/** Explicit server capability wins over visibility and local ownership hints. */
export function sessionIsViewOnly(session: AccessHints): boolean {
  if (typeof session.canWrite === "boolean") return !session.canWrite;
  return session.readOnly === true || (session.visibility === "shared_read" && session.owner !== "me");
}

/** Keep failed targets selected after a partially successful bulk operation. */
export function failedMutationIds(ids: readonly string[], results: readonly PromiseSettledResult<unknown>[]): string[] {
  return ids.filter((_, index) => results[index]?.status !== "fulfilled");
}
