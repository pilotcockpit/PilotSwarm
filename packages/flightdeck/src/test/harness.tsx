import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SourceContextProvider } from "@/data/source";

/** A stub source whose call() answers with wire shapes and records every request. */
export function stubSource(answers: Record<string, unknown | ((params: any) => unknown)>) {
  const calls: Array<{ op: string; params: any }> = [];
  const source = {
    kind: "live", label: "stub",
    call: async (op: string, params?: any) => {
      calls.push({ op, params });
      const a = answers[op];
      return typeof a === "function" ? (a as (p: any) => unknown)(params) : a;
    },
  } as any;
  return { source, calls };
}

export function newClient() { return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } }); }

/** Everything the data hooks need around a component: a query client and a source. */
export function Providers({ source, client, children }: { source: any; client?: QueryClient; children: React.ReactNode }) {
  const qc = React.useMemo(() => client ?? newClient(), [client]);
  return (
    <QueryClientProvider client={qc}>
      <SourceContextProvider value={{ source, mode: "demo", setMode: () => undefined }}>{children}</SourceContextProvider>
    </QueryClientProvider>
  );
}
