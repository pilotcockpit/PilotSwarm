import { useOpMutation, useOpQuery } from "./use-op";

// Who can open a session. The API shapes (SessionAccessSnapshot, SessionShareInfo, KnownUserInfo)
// are flat and use `access: read | write`; screens speak in people and plain words.

export type Visibility = "private" | "shared_read" | "shared_write";
export type ShareAccess = "read" | "write";

export interface Person { provider: string; subject: string; email?: string | null; displayName?: string | null }
export interface Share extends Person { access: ShareAccess; grantedAt?: unknown; grantedByDisplay?: string | null }
export interface SessionAccessInfo {
  visibility: Visibility;
  /** owner | admin | collaborator | none */
  relation: string;
  canWrite: boolean;
  canManage: boolean;
  owner: Person | null;
}

const list = <T,>(raw: unknown, key: string): T[] => (Array.isArray(raw) ? (raw as T[]) : Array.isArray((raw as any)?.[key]) ? (raw as any)[key] : []);

export const personName = (p?: Partial<Person> | null) => String(p?.displayName || p?.email || p?.subject || "Someone");
export const samePerson = (a: Person, b: Person) => a.provider === b.provider && a.subject === b.subject;

export const sharingKeys = {
  access: (id: string) => ["sharing", id, "access"] as const,
  shares: (id: string) => ["sharing", id, "shares"] as const,
  users: ["sharing", "users"] as const,
};

export function useSessionAccess(id: string | undefined) {
  return useOpQuery<SessionAccessInfo>(sharingKeys.access(id || ""), "getSessionAccess", { sessionId: id }, {
    enabled: Boolean(id),
    staleTime: 15_000,
    select: (raw) => ({
      visibility: (raw?.visibility || "private") as Visibility,
      relation: String(raw?.relation || "none"),
      canWrite: raw?.canWrite === true,
      canManage: raw?.canManage === true,
      owner: raw?.owner || null,
    }),
  });
}

/** Targeted shares. Owner or admin only: callers pass enabled=false for everyone else. */
export function useSessionShares(id: string | undefined, enabled: boolean) {
  return useOpQuery<Share[]>(sharingKeys.shares(id || ""), "listSessionShares", { sessionId: id }, {
    enabled: Boolean(id) && enabled,
    staleTime: 10_000,
    select: (raw) => list<Share>(raw, "shares"),
  });
}

/** The member directory, for the people picker. Loaded only while the sheet is open. */
export function useKnownUsers(enabled: boolean) {
  return useOpQuery<Person[]>(sharingKeys.users, "listKnownUsers", { limit: 200 }, {
    enabled,
    staleTime: 5 * 60_000,
    select: (raw) => list<Person>(raw, "users"),
  });
}

export function useSetVisibility(id: string) {
  return useOpMutation<Visibility>("setSessionVisibility", {
    params: (visibility) => ({ sessionId: id, visibility }),
    invalidate: [sharingKeys.access(id), ["sessions"], ["session", id]],
  });
}

export function useGrantShare(id: string) {
  return useOpMutation<{ user: Person; access: ShareAccess }>("grantSessionShare", {
    params: ({ user, access }) => ({ sessionId: id, user: { provider: user.provider, subject: user.subject, email: user.email ?? undefined, displayName: user.displayName ?? undefined }, access }),
    invalidate: [sharingKeys.shares(id)],
  });
}

export function useRevokeShare(id: string) {
  return useOpMutation<Person>("revokeSessionShare", {
    params: (user) => ({ sessionId: id, user: { provider: user.provider, subject: user.subject } }),
    invalidate: [sharingKeys.shares(id)],
  });
}

/** One sentence per level, in the words people use. */
export const VISIBILITY_COPY: Record<Visibility, { label: string; detail: string }> = {
  private: { label: "Only people you add", detail: "Nobody else can open this session or its sub-agents." },
  shared_read: { label: "Anyone can view", detail: "Anyone signed in here can read the conversation, canvases and files. They cannot reply." },
  shared_write: { label: "Anyone can view and reply", detail: "Anyone signed in here can read it and send messages, answer questions and steer the agent." },
};

/** What the Share button says at a glance. */
export function audienceLabel(access: SessionAccessInfo | undefined, shares: Share[] | undefined): string {
  if (!access) return "Share";
  if (access.visibility === "shared_write") return "Anyone can reply";
  if (access.visibility === "shared_read") return "Anyone can view";
  if (!access.canManage) return access.relation === "none" ? "Share" : "Shared with you";
  const n = shares?.length ?? 0;
  return n ? (n === 1 ? "1 person" : `${n} people`) : "Only you";
}
