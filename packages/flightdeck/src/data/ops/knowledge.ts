import { useQuery } from "@tanstack/react-query";
import { useSource } from "@/data/source";
import { useOpMutation, useOpQuery } from "./use-op";

// What the fleet knows: facts agents stored (shared across sessions), the graph built from them, and
// the embedder that makes meaning-based search work. Everything here is admin or capability gated by
// the server; each hook reports `unavailable` instead of throwing so the page can say what is missing.

export interface FactsCapabilities { search: boolean; embedder: boolean; graph: boolean }
export interface FactsStatsRow { namespace: string; factCount: number; totalValueBytes: number; oldestCreatedAt: string | null; newestUpdatedAt: string | null }
export interface Tombstones { pendingTotal: number; unreconciled: number; ttlBlocked: number; oldestUnreconciledAgeSeconds: number | null; reconciledUnswept: number }
export interface EmbedderStatus { supported: boolean; running?: boolean; instanceId?: string; status?: string }
export interface GraphNamespace { namespace: string; archived: boolean; frontmatter: { name?: string; description: string }; createdAt?: string; updatedAt?: string; nodeCount?: number | null; edgeCount?: number | null }
export interface FoundFact { scopeKey: string; key: string; value: unknown; tags: string[]; shared: boolean; agentId: string | null; sessionId: string | null; updatedAt: string; score?: number }
export type SearchMode = "hybrid" | "lexical" | "semantic";

const K = {
  caps: ["knowledge", "capabilities"] as const,
  stats: ["knowledge", "stats"] as const,
  tombstones: ["knowledge", "tombstones"] as const,
  embedder: ["knowledge", "embedder"] as const,
  namespaces: ["knowledge", "namespaces"] as const,
};

export const useFactsCapabilities = () => useOpQuery<FactsCapabilities>(K.caps, "factsCapabilities", undefined, { staleTime: 60_000 });
export const useSharedFactsStats = () => useOpQuery<FactsStatsRow[]>(K.stats, "getSharedFactsStats", undefined, { select: (r) => (Array.isArray(r) ? r : r?.rows || []) });
export const useTombstones = () => useOpQuery<Tombstones>(K.tombstones, "getFactsTombstoneStats");

export function useEmbedder(enabled = true) {
  const { source } = useSource();
  return useQuery({ queryKey: K.embedder, queryFn: () => source.call<EmbedderStatus>("getEmbedderStatus"), enabled, refetchInterval: 10_000 });
}

/** Namespaces with their node and edge counts, read together so the list renders once. */
export function useNamespaces(enabled = true) {
  const { source } = useSource();
  return useQuery({
    queryKey: K.namespaces,
    enabled,
    queryFn: async (): Promise<GraphNamespace[]> => {
      const raw = await source.call("listGraphNamespaces", { includeDetails: true });
      const list: GraphNamespace[] = Array.isArray(raw) ? raw : raw?.namespaces || [];
      return Promise.all(list.map(async (n) => {
        try {
          const s = await source.call("graphStats", { namespace: n.namespace });
          return { ...n, nodeCount: s?.nodeCount ?? null, edgeCount: s?.edgeCount ?? null };
        } catch {
          return { ...n, nodeCount: null, edgeCount: null };
        }
      }));
    },
  });
}

export const useStartEmbedder = () => useOpMutation<void>("startFactsEmbedder", { params: () => ({}), invalidate: [K.embedder], success: "Embedder started" });
export const useStopEmbedder = () => useOpMutation<void>("stopFactsEmbedder", { params: () => ({ reason: "Stopped from Flight Deck" }), invalidate: [K.embedder], success: "Embedder stopped" });

export const useUpsertNamespace = () =>
  useOpMutation<{ namespace: string; name: string; description: string }>("upsertGraphNamespace", {
    params: (v) => ({ input: { namespace: v.namespace, frontmatter: { name: v.name || undefined, description: v.description } } }),
    invalidate: [K.namespaces],
    success: (_r, v) => `Saved ${v.namespace}`,
  });
export const useDeleteNamespace = () =>
  useOpMutation<{ namespace: string }>("deleteGraphNamespace", { params: (v) => ({ namespace: v.namespace }), invalidate: [K.namespaces], success: (_r, v) => `Deleted ${v.namespace}` });

export const useForcePurge = () =>
  useOpMutation<{ olderThanHours: number; onlyUnreconciled: boolean; keyPrefix?: string }, number>("forcePurgeFacts", {
    params: (v) => ({ input: { cutoff: new Date(Date.now() - v.olderThanHours * 3600_000).toISOString(), onlyUnreconciled: v.onlyUnreconciled, ...(v.keyPrefix ? { keyPrefix: v.keyPrefix } : {}) } }),
    invalidate: [K.tombstones, K.stats],
    success: (n) => (typeof n === "number" ? `Purged ${n} ${n === 1 ? "fact" : "facts"}` : "Purged"),
  });

/** Look something up. Meaning-based search needs the embedder; callers choose the mode, the server decides what it can do. */
export function useFactSearch(query: string, mode: SearchMode) {
  const { source } = useSource();
  return useQuery({
    queryKey: ["knowledge", "search", query, mode],
    enabled: query.trim().length > 0,
    queryFn: async (): Promise<FoundFact[]> => {
      const raw = await source.call("searchFacts", { query: query.trim(), opts: { mode, limit: 12, scope: "shared" } });
      return Array.isArray(raw) ? raw : raw?.facts || [];
    },
    staleTime: 30_000,
  });
}

export function factNamespaceLabel(ns: string) {
  const known: Record<string, string> = { skills: "Skills", asks: "Questions agents asked", intake: "Intake", config: "Configuration", "(other)": "Everything else" };
  return known[ns] || ns;
}
