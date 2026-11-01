// Shapes Flight Deck reads from the Web API (/api/v1). Field names follow the
// server's payloads exactly; optional fields are absent on older servers.

export interface PendingQuestion {
  question: string;
  choices?: string[];
  allowFreeform?: boolean;
  iteration?: number;
  [key: string]: unknown;
}

export interface Session {
  sessionId: string;
  title?: string;
  agentId?: string;
  status?: string;
  orchestrationStatus?: string;
  createdAt?: number;
  updatedAt?: number;
  iterations?: number;
  parentSessionId?: string;
  rootSessionId?: string;
  isSystem?: boolean;
  model?: string;
  reasoningEffort?: string;
  contextTier?: string;
  error?: string;
  visibility?: string;
  groupId?: string | null;
  pendingQuestion?: PendingQuestion | null;
  cronActive?: boolean;
  cronInterval?: number | string | null;
  cronNextFireAt?: number | string | null;
  waitReason?: string | null;
  waitUntil?: number | string | null;
  activeChildCount?: number;
  pauseState?: Record<string, unknown> | null;
  workspace?: { root?: string; folder?: string; repo?: string; branch?: string } | null;
  /** The agent's own one-line status and a structured summary, when the server has written one. */
  shortSummary?: string | null;
  summaryState?: { intent?: string; summary?: string; blockers?: string[]; nextActions?: string[]; openQuestions?: string[] } | null;
  /** Demo-only enrichments the API does not carry yet (see capability-map B-items). */
  step?: string;
  spine?: SpineMark[];
  pinned?: boolean;
  unseenCanvas?: boolean;
  /** "me" when the viewer owns it, otherwise the owner's display name (normalised from the API's owner object). */
  owner?: string;
  [key: string]: unknown;
}

export type SpineMark = "run" | "sleep" | "fail" | "done" | "wait";

export interface SessionEvent {
  seq: number;
  sessionId: string;
  eventType: string;
  data?: Record<string, any>;
  createdAt?: string | number;
}

export interface Artifact {
  filename: string;
  size?: number;
  contentType?: string;
  updatedAt?: string | number;
  createdAt?: string | number;
  pinned?: boolean;
  sessionId?: string;
  [key: string]: unknown;
}

export interface ModelChangeOptions { reasoningEffort?: string | null; contextTier?: string | null }

export interface Model {
  qualifiedName: string;
  providerId: string;
  providerType?: string;
  modelName: string;
  description?: string;
  cost?: string;
  supportedReasoningEfforts?: string[];
  defaultReasoningEffort?: string;
  supportedContextTiers?: string[];
  defaultContextTier?: string;
  credentialAvailable?: boolean;
  unavailableReason?: string;
}

export interface Agent {
  name: string;
  title?: string;
  description?: string;
  initialPrompt?: string;
  tools?: string[];
  skills?: string[];
  source?: string;
  package?: string;
  packageName?: string;
  packageTitle?: string;
  packageSemver?: string;
  scope?: "shared" | "user";
  mine?: boolean;
}

export interface Provider {
  name: string;
  typeId: string;
  class: "shared" | "personal" | string;
  baseUrl?: string;
  allowancePct?: number;
  holdUntilUtc?: string | null;
  holdIndefinite?: boolean;
  hasCredential?: boolean;
  usableByMe?: boolean;
  isClusterDefault?: boolean;
  isMyDefault?: boolean;
  isSystemDefault?: boolean;
  ruleCount?: number;
  ownerDisplayName?: string | null;
  /** Token use this month and the tightest monthly limit, when the deployment reports them. */
  usage?: { month?: { used: number; limit?: number | null; model?: string | null } };
  limits?: Array<{ period: "day" | "week" | "month"; tokens: number; model?: string | null }>;
  [key: string]: unknown;
}

export interface UsageWindow { input: number; output: number; total: number; turns: number; sessions: number }
export interface UsageSummary {
  days: number;
  daily: Array<{ day: string; total: number; [key: string]: unknown }>;
  windows: { day: UsageWindow; week: UsageWindow; month: UsageWindow };
  models?: Array<{ model: string; total: number }>;
  [key: string]: unknown;
}

export interface Worker {
  workerNodeId: string;
  pool?: string;
  phase?: string;
  updatedAt?: string;
  registeredAt?: string;
  info?: { sdkVersion?: string; runtime?: { hostname?: string; pid?: number; substrate?: string }; capabilities?: Record<string, boolean> };
  health?: { uptimeS?: number; rssBytes?: number; activeSessions?: number; workerSlots?: { total?: number } };
  [key: string]: unknown;
}

export interface FeatureFlag {
  key: string;
  description?: string;
  type?: string;
  default?: unknown;
  value?: unknown;
  scope?: string;
  [key: string]: unknown;
}

export interface Profile {
  displayName?: string;
  email?: string | null;
  provider?: string;
  isAdmin?: boolean;
  [key: string]: unknown;
}

export interface Group { id: string; name: string; [key: string]: unknown }

export interface LogEntry { at?: string | number; level?: string; message?: string; workerNodeId?: string; [key: string]: unknown }

export interface CreateSessionInput {
  prompt: string;
  agentName?: string | null;
  model?: string | null;
  reasoningEffort?: string | null;
  groupId?: string | null;
  workspace?: { root: string; folder?: string } | null;
}

/** Everything the screens need, implemented by the live Web API and by demo fixtures. */
export interface DataSource {
  kind: "live" | "demo";
  label: string;
  listSessions(): Promise<Session[]>;
  getSession(id: string): Promise<Session | null>;
  getEvents(id: string): Promise<SessionEvent[]>;
  subscribe(id: string, onEvent: (e: SessionEvent) => void): () => void;
  /** `clientMessageId` makes a send idempotent: resend the same id when delivery is uncertain. */
  sendMessage(id: string, prompt: string, opts?: { enqueueOnly?: boolean; clientMessageId?: string }): Promise<void>;
  sendAnswer(id: string, answer: string, question?: PendingQuestion | null): Promise<void>;
  stopTurn(id: string): Promise<string>;
  steerTurn(id: string, text: string): Promise<string>;
  createSession(input: CreateSessionInput): Promise<string>;
  renameSession(id: string, title: string): Promise<void>;
  /** Switch the model a session uses from its next turn. `model` is the qualified name. */
  /** Options left out are preserved by the server; `null` clears one. They apply from the next turn. */
  setSessionModel(id: string, model: string, options?: ModelChangeOptions): Promise<void>;
  completeSession(id: string): Promise<void>;
  cancelSession(id: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
  listArtifacts(id: string): Promise<Artifact[]>;
  readArtifact(id: string, filename: string): Promise<string>;
  /** A bounded read for previews: at most `maxBytes` bytes of the document, and whether it was longer. */
  readArtifactPreview(id: string, filename: string, maxBytes: number): Promise<{ text: string; truncated: boolean }>;
  artifactUrl(id: string, filename: string): string | null;
  listModels(): Promise<Model[]>;
  listAgents(): Promise<Agent[]>;
  listProviders(): Promise<Provider[]>;
  usageSummary(): Promise<UsageSummary | null>;
  listWorkers(): Promise<Worker[]>;
  listFlags(): Promise<FeatureFlag[]>;
  listGroups(): Promise<Group[]>;
  profile(): Promise<Profile>;
  authzAudit(): Promise<any[]>;
  fleetStats(): Promise<any>;
  orchestrationStats(id: string): Promise<any>;
  executionHistory(id: string): Promise<any[]>;
  subscribeLogs(onEntry: (e: LogEntry) => void): () => void;
  connection(onChange: (state: ConnectionState) => void): () => void;
  /** Any Web API operation by name. Areas wrap it in hooks (data/ops/use-op.ts); demo mode answers from data/ops/*.demo.ts. */
  call<T = any>(op: string, params?: Record<string, unknown>): Promise<T>;
}

export type ConnectionState = "connected" | "reconnecting" | "offline";
