import { registerDemoOps } from "./registry";

// Demo housekeeping: a prune that reports a count and a restart that can find the agent busy once.
// (Worker package state, `listAgentWorkerState`, is shared with the Library fixtures.)

let busyOnce = true;

registerDemoOps(import.meta.url, {
  restartSystemSession: ({ agentIdOrSessionId, options }) => {
    const disposition = options?.disposition || "complete";
    if (disposition === "complete" && busyOnce && /sweeper/i.test(String(agentIdOrSessionId))) {
      busyOnce = false;
      return { agentId: "sweeper", sessionId: String(agentIdOrSessionId), disposition, previousSessionExisted: true, skippedReason: "busy", startResults: [] };
    }
    if (options?.startReplacement === false) return { agentId: "agent", sessionId: String(agentIdOrSessionId), disposition, previousSessionExisted: true, retired: true, startResults: [] };
    return { agentId: "agent", sessionId: String(agentIdOrSessionId), disposition, previousSessionExisted: true, startResults: [{ status: "started" }] };
  },
  pruneDeletedSummaries: ({ olderThan }) => (new Date(olderThan).getTime() > Date.now() - 20 * 86_400_000 ? 41 : 17),
});
