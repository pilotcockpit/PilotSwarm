import type { Agent } from "@/data/types";

// A package's agents form a small forest: an entry point is an agent no OTHER agent in the same set
// starts; `startedBy` names the agents that create a nested one. The shared portal picker uses the same
// rule (packages/app/ui/core/src/controller.js orderAgentsByComposition): a name that does not resolve
// inside the set is ignored, and an explicit `supportsDirectStart` always wins over the derived default.

export interface ComposedAgent extends Agent {
  depth: number;
  parentName: string | null;
  /** False for an agent that another agent creates: it is shown so the composition is visible, not started cold. */
  startable: boolean;
}

const key = (name: string | undefined) => String(name ?? "").trim().toLowerCase();

export function composeAgents(agents: Agent[]): ComposedAgent[] {
  const byName = new Map<string, Agent>();
  for (const a of agents) if (a?.name) byName.set(key(a.name), a);
  const parentOf = new Map<Agent, string>();
  const childrenOf = new Map<string, Agent[]>();
  for (const a of agents) {
    const self = key(a.name);
    const parents = (a.startedBy || []).map(key).filter((n) => n && byName.has(n) && n !== self);
    if (!parents.length) continue;
    // The first resolvable creator wins the nesting slot, so an agent started by two is shown once.
    parentOf.set(a, parents[0]);
    childrenOf.set(parents[0], [...(childrenOf.get(parents[0]) || []), a]);
  }
  const startable = (a: Agent) => (typeof a.supportsDirectStart === "boolean" ? a.supportsDirectStart : !parentOf.has(a));
  const out: ComposedAgent[] = [];
  const emitted = new Set<Agent>();
  const emit = (a: Agent, depth: number, parentName: string | null) => {
    if (emitted.has(a)) return; // also the cycle guard
    emitted.add(a);
    out.push({ ...a, depth, parentName, startable: startable(a) });
    for (const c of childrenOf.get(key(a.name)) || []) emit(c, depth + 1, a.name);
  };
  for (const a of agents) if (!parentOf.has(a)) emit(a, 0, null);
  // Anything left is part of a cycle with no entry point: show it flat rather than lose it.
  for (const a of agents) if (!emitted.has(a)) emit(a, 0, null);
  return out;
}
