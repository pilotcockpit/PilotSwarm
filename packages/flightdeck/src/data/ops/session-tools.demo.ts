import { registerDemoOps } from "./registry";

registerDemoOps({
  exportExecutionHistory: ({ sessionId }) => ({ filename: `execution-history-${String(sessionId).slice(0, 8)}.json`, sizeBytes: 18_432 }),
});
