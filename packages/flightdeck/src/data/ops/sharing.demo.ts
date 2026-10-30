import { registerDemoOps } from "./registry";

// In-memory sharing state per session, so every flow in the Share sheet works with ?data=demo.
const people = [
  { provider: "demo", subject: "sam", email: "sam.lee@example.com", displayName: "Sam Lee" },
  { provider: "demo", subject: "priya", email: "priya.raman@example.com", displayName: "Priya Raman" },
  { provider: "demo", subject: "marcus", email: "marcus.webb@example.com", displayName: "Marcus Webb" },
  { provider: "demo", subject: "riya", email: "riya.kapoor@example.com", displayName: "Riya Kapoor" },
  { provider: "demo", subject: "mo", email: "mo.said@example.com", displayName: "Mo Said" },
  { provider: "demo", subject: "ana", email: "ana.costa@example.com", displayName: "Ana Costa" },
  { provider: "demo", subject: "tomas", email: "tomas.berg@example.com", displayName: "Tomás Berg" },
];
const me = people[0];
const VIEWER_ONLY = "a1f0c2d4-0007-4c00-9000-000000000007"; // owned by Riya, shared read-only
const SHARED_WRITE = "a1f0c2d4-0001-4c00-9000-000000000001";

type State = { visibility: string; shares: any[] };
const state = new Map<string, State>();
const stateFor = (id: string): State => {
  if (!state.has(id)) {
    state.set(id, {
      visibility: id === VIEWER_ONLY ? "shared_read" : id === SHARED_WRITE ? "shared_write" : "private",
      shares: id === VIEWER_ONLY ? [] : [{ ...people[1], access: "read", grantedAt: Date.now() - 3 * 86_400_000, grantedByDisplay: "Sam Lee" }],
    });
  }
  return state.get(id)!;
};

registerDemoOps(import.meta.url, {
  getSessionAccess: ({ sessionId }) => {
    const s = stateFor(sessionId);
    const viewer = sessionId === VIEWER_ONLY;
    return { sessionId, visibility: s.visibility, owner: viewer ? people[3] : me, relation: viewer ? "collaborator" : "owner", canWrite: !viewer, canManage: !viewer };
  },
  listSessionShares: ({ sessionId }) => stateFor(sessionId).shares.map((x) => ({ ...x })),
  listKnownUsers: () => people.map((p) => ({ ...p })),
  setSessionVisibility: ({ sessionId, visibility }) => { stateFor(sessionId).visibility = visibility; },
  grantSessionShare: ({ sessionId, user, access }) => {
    const s = stateFor(sessionId);
    const i = s.shares.findIndex((x) => x.provider === user.provider && x.subject === user.subject);
    const row = { ...(people.find((p) => p.subject === user.subject) || user), access, grantedAt: Date.now(), grantedByDisplay: "Sam Lee" };
    if (i >= 0) s.shares[i] = row; else s.shares.push(row);
  },
  revokeSessionShare: ({ sessionId, user }) => {
    const s = stateFor(sessionId);
    s.shares = s.shares.filter((x) => !(x.provider === user.provider && x.subject === user.subject));
  },
});
