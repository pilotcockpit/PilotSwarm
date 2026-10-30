import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSource } from "@/data/source";

/**
 * Read through any Web API operation. `key` is the cache key (start it with the area, e.g.
 * ["providers", "limits"]); the same key is what a mutation invalidates.
 */
export function useOpQuery<T = any>(key: QueryKey, op: string, params?: Record<string, unknown>, opts?: { enabled?: boolean; staleTime?: number; select?: (raw: any) => T; refetchInterval?: number | false | ((query: any) => number | false) }) {
  const { source } = useSource();
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const raw = await source.call(op, params);
      return (opts?.select ? opts.select(raw) : raw) as T;
    },
    enabled: opts?.enabled,
    staleTime: opts?.staleTime,
    refetchInterval: opts?.refetchInterval,
  });
}

/**
 * Write through any Web API operation, then refresh what it changed. Failures toast with the
 * server's own words (never a credential: callers must not put secrets in `describe`).
 */
export function useOpMutation<V = any, R = any>(op: string | ((v: V) => string), opts: { params?: (v: V) => Record<string, unknown>; invalidate?: QueryKey[]; success?: string | ((r: R, v: V) => string | null); failure?: string; onSuccess?: (r: R, v: V) => void }) {
  const { source } = useSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => (await source.call(typeof op === "function" ? op(v) : op, opts.params ? opts.params(v) : (v as any))) as R,
    onSuccess: (r, v) => {
      for (const key of opts.invalidate || []) void qc.invalidateQueries({ queryKey: key });
      const msg = typeof opts.success === "function" ? opts.success(r, v) : opts.success;
      if (msg) toast.success(msg);
      opts.onSuccess?.(r, v);
    },
    onError: (e: any) => toast.error(opts.failure || "That didn't work", { description: e?.message }),
  });
}

/**
 * A read described as data: where it caches, which operation, with what parameters, and how its wire
 * answer becomes what a screen reads. Hooks run it with useOpRequest; tests run the same object with
 * runRequest and a stubbed `call`, so the mapping that ships is the mapping that is tested.
 */
export interface OpRequest<T> { key: QueryKey; op: string; params?: Record<string, unknown>; select?: (raw: any) => T }

export async function runRequest<T>(source: { call: (op: string, params?: Record<string, unknown>) => Promise<any> }, req: OpRequest<T>): Promise<T> {
  const raw = await source.call(req.op, req.params);
  return (req.select ? req.select(raw) : raw) as T;
}

export function useOpRequest<T>(req: OpRequest<T>, opts?: { enabled?: boolean; staleTime?: number; refetchInterval?: number | false | ((query: any) => number | false) }) {
  const { source } = useSource();
  return useQuery({ queryKey: req.key, queryFn: () => runRequest(source, req), enabled: opts?.enabled, staleTime: opts?.staleTime, refetchInterval: opts?.refetchInterval });
}
