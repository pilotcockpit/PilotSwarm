import type { Agent } from "@/data/types";

// What a package CONTAINS, read from the manifest the server stored with the active version
// (packages/sdk/src/agent-package-format.ts: agents[] with names from the agent files' frontmatter,
// skills[], mcpServers[], hasTools). File names are never read for this: the server decides what an
// agent is called, and in manifest mode only declared files ship at all.

export interface ManifestAgent { name: string; title?: string; description?: string; startedBy?: string[]; supportsDirectStart?: boolean }
export interface PackageContents {
  /** False when the version carries no manifest detail at all (an older package): say "not reported", never "nothing". */
  known: boolean;
  agents: ManifestAgent[];
  skills: string[];
  mcpServers: string[];
  tools: boolean;
  /** A package that defines no agents: its skills, tools and MCP servers are found by any session instead. */
  zeroAgent: boolean;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : (x as any)?.name)).filter((x): x is string => typeof x === "string" && !!x) : []);

export function describeManifest(manifest: Record<string, any> | null | undefined): PackageContents {
  const known = Boolean(manifest && (Array.isArray(manifest.agents) || Array.isArray(manifest.skills) || Array.isArray(manifest.mcpServers) || "hasTools" in manifest));
  const agents: ManifestAgent[] = (Array.isArray(manifest?.agents) ? manifest!.agents : []).filter((a: any) => a?.name).map((a: any) => ({
    name: String(a.name), title: a.title || undefined, description: a.description || undefined,
    startedBy: Array.isArray(a.startedBy) ? a.startedBy : undefined,
    supportsDirectStart: typeof a.supportsDirectStart === "boolean" ? a.supportsDirectStart : undefined,
  }));
  const skills = strings(manifest?.skills);
  const mcpServers = strings(manifest?.mcpServers);
  const tools = Boolean(manifest?.hasTools);
  return { known, agents, skills, mcpServers, tools, zeroAgent: known && !agents.length && (skills.length > 0 || mcpServers.length > 0 || tools) };
}

/** The manifest's agents as catalog entries, so composition (nesting, who can be started) reads the same everywhere. */
export const manifestAgentsAsCatalog = (c: PackageContents, packageName: string): Agent[] => c.agents.map((a) => ({ ...a, source: "package", packageName }));
