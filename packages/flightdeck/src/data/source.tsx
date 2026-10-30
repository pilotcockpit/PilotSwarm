import * as React from "react";
import { announceAnswerRejected } from "@/lib/answer-rejection";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { appendEventToHistory, buildHistoryModel, type HistoryModel } from "@ps/history";
import { createLiveSource } from "./live";
import { createDemoSource } from "./demo";
import { usePref } from "@/shell/prefs";
import type { ConnectionState, DataSource, Session } from "./types";

// One owner per resource. Flight Deck has no controller of its own: server
// data lives in TanStack Query, keyed by data source, and transcripts are the
// shared ui/core history projection fed by the session's event stream.

export type DataMode = "live" | "demo";

const MODE_KEY = "fd.data";

function readMode(): DataMode {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("data");
    if (fromUrl === "demo" || fromUrl === "live") {
      localStorage.setItem(MODE_KEY, fromUrl);
      return fromUrl;
    }
    return localStorage.getItem(MODE_KEY) === "demo" ? "demo" : "live";
  } catch {
    return "live";
  }
}

interface SourceContext {
  source: DataSource;
  mode: DataMode;
  setMode: (mode: DataMode) => void;
}

const Ctx = React.createContext<SourceContext | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<DataMode>(readMode);
  const source = React.useMemo(() => (mode === "demo" ? createDemoSource() : createLiveSource()), [mode]);
  // A fresh cache per source: demo rows must never leak into live screens.
  const client = React.useMemo(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 2_000, retry: 1, refetchOnWindowFocus: mode === "live" } } }),
    [source],
  );
  const setMode = React.useCallback((next: DataMode) => {
    try { localStorage.setItem(MODE_KEY, next); } catch { /* storage unavailable */ }
    setModeState(next);
  }, []);
  const value = React.useMemo(() => ({ source, mode, setMode }), [source, mode, setMode]);
  return (
    <Ctx.Provider value={value}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </Ctx.Provider>
  );
}

export function useSource() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useSource outside DataProvider");
  return ctx;
}

// ── Queries ──────────────────────────────────────────────────────────────
// The session list re-reads every 4s: the Web API does not push list changes
// yet (capability map B-item "push session-list changes over the WebSocket").

export function useSessions() {
  const { source } = useSource();
  // A hidden tab only keeps polling when it has been asked to notify: that is the one job that needs it.
  const [notify] = usePref<"on" | "off">("fd.notify", "off");
  return useQuery({ queryKey: ["sessions"], queryFn: () => source.listSessions(), refetchInterval: 4_000, refetchIntervalInBackground: notify === "on" });
}

export function useSessionRow(id: string | undefined): Session | undefined {
  const { data } = useSessions();
  return React.useMemo(() => data?.find((s) => s.sessionId === id), [data, id]);
}

export function useSession(id: string | undefined) {
  const { source } = useSource();
  const row = useSessionRow(id);
  const detail = useQuery({ queryKey: ["session", id], queryFn: () => source.getSession(id!), enabled: Boolean(id), refetchInterval: 4_000 });
  // The list row carries the failure text the detail read omits; the detail
  // carries live orchestration status. Merge so every surface agrees.
  const merged = React.useMemo<Session | undefined>(() => {
    if (!row && !detail.data) return undefined;
    const d = detail.data || {};
    const next = { ...(row || {}), ...d } as Session;
    if (row?.error && !("error" in d) && (d as Session).status !== "running") next.error = row.error;
    if (row?.error && (d as Session).status === "idle" && row.status === "error") next.status = "error";
    return next;
  }, [row, detail.data]);
  return {
    session: merged,
    loading: detail.isLoading && !row,
    missing: !detail.isLoading && !detail.isError && !row && !detail.data,
    error: detail.error,
    isError: detail.isError,
    retry: detail.refetch,
    refreshing: detail.isFetching,
  };
}

export function useTranscript(id: string | undefined) {
  const { source } = useSource();
  const [history, setHistory] = React.useState<HistoryModel | null>(null);
  const [retryAttempt, setRetryAttempt] = React.useState(0);
  const retry = React.useCallback(() => setRetryAttempt((n) => n + 1), []);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!id) return;
    let active = true;
    let model: HistoryModel | null = null;
    const pending: any[] = [];
    setHistory(null);
    setError(null);
    const unsubscribe = source.subscribe(id, (event) => {
      if (!active) return;
      // Before buffering: a refusal that lands while the history is still loading is news too.
      announceAnswerRejected(id, event);
      if (!model) { pending.push(event); return; }
      if (event.seq && model.lastSeq && event.seq <= model.lastSeq) return;
      model = appendEventToHistory(model, event);
      setHistory(model);
    });
    source
      .getEvents(id)
      .then((events) => {
        if (!active) return;
        const known = new Set(events.map((e) => e.seq));
        model = buildHistoryModel([...events, ...pending.filter((e) => !known.has(e.seq))]);
        model.lastSeq = Math.max(0, ...events.map((e) => Number(e.seq) || 0));
        setHistory(model);
      })
      .catch((e) => active && setError(e?.message || String(e)));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [id, source, retryAttempt]);
  return { history, error, loading: !history && !error, retry };
}

export function useArtifacts(id: string | undefined) {
  const { source } = useSource();
  return useQuery({ queryKey: ["artifacts", id], queryFn: () => source.listArtifacts(id!), enabled: Boolean(id), refetchInterval: 8_000 });
}

export const useModels = () => { const { source } = useSource(); return useQuery({ queryKey: ["models"], queryFn: () => source.listModels(), staleTime: 60_000 }); };
export const useAgents = () => { const { source } = useSource(); return useQuery({ queryKey: ["agents"], queryFn: () => source.listAgents(), staleTime: 60_000 }); };
export const useProviders = () => { const { source } = useSource(); return useQuery({ queryKey: ["providers"], queryFn: () => source.listProviders() }); };
export const useUsage = () => { const { source } = useSource(); return useQuery({ queryKey: ["usage"], queryFn: () => source.usageSummary(), staleTime: 30_000 }); };
export const useWorkers = () => { const { source } = useSource(); return useQuery({ queryKey: ["workers"], queryFn: () => source.listWorkers(), refetchInterval: 15_000 }); };
export const useFlags = () => { const { source } = useSource(); return useQuery({ queryKey: ["flags"], queryFn: () => source.listFlags() }); };
export const useGroups = () => { const { source } = useSource(); return useQuery({ queryKey: ["groups"], queryFn: () => source.listGroups(), staleTime: 30_000 }); };
export const useProfile = () => { const { source } = useSource(); return useQuery({ queryKey: ["profile"], queryFn: () => source.profile(), staleTime: 300_000 }); };

export function useConnection(): ConnectionState {
  const { source } = useSource();
  const [state, setState] = React.useState<ConnectionState>("reconnecting");
  React.useEffect(() => source.connection(setState), [source]);
  return state;
}

/** Re-read the session list and one session after a write. */
export function useRefresh() {
  const client = useQueryClient();
  return React.useCallback(
    (id?: string) => {
      void client.invalidateQueries({ queryKey: ["sessions"] });
      if (id) void client.invalidateQueries({ queryKey: ["session", id] });
    },
    [client],
  );
}
