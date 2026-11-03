import { registerDemoOps } from "./registry";

// Demo mode keeps the profile settings document in memory, so pins and dismissals behave as they do on a server
// (they survive a navigation, not a reload). It starts with the pins the demo sessions are known for.

let settings: Record<string, unknown> = { pinnedSessionIds: ["a1f0c2d4-0001-4c00-9000-000000000001", "a1f0c2d4-0009-4c00-9000-000000000009"] };

registerDemoOps(import.meta.url, {
  getCurrentUserProfile: () => ({ displayName: "Sam Lee", email: "sam.lee@contoso.com", provider: "entra", profileSettings: structuredClone(settings) }),
  setCurrentUserProfileSettings: ({ settings: next }) => {
    settings = structuredClone(next && typeof next === "object" ? next : {});
    return { profileSettings: structuredClone(settings) };
  },
});
