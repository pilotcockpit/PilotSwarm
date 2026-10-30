import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUi } from "@/shell/ui-state";
import { useAgents, useGroups, useModels, useProviders, useRefresh, useSource } from "@/data/source";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { cardVariants } from "@/components/ui/card";
import { rovingKeyDown } from "@/lib/roving";

/**
 * Starting a session begins with the task, not the model: one sheet with the
 * prompt, the agent, and options that are collapsed but show their values.
 */
export function NewSessionSheet() {
  const { newSession, closeNewSession, restoreFocus } = useUi();
  return (
    <Dialog open={newSession.open} onOpenChange={(o) => !o && closeNewSession()}>
      {newSession.open ? (
        <DialogContent side="right" onCloseAutoFocus={restoreFocus} title="New session" description="Say what you want done. Everything else has a sensible default.">
          <NewSessionForm initialAgent={newSession.agent || null} initialPrompt={newSession.prompt || ""} onDone={closeNewSession} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function NewSessionForm({ initialAgent, initialPrompt, onDone }: { initialAgent: string | null; initialPrompt: string; onDone: () => void }) {
  const { source } = useSource();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: models } = useModels();
  const { data: providers } = useProviders();
  const { data: groups } = useGroups();
  const [prompt, setPrompt] = React.useState(initialPrompt);
  const [agent, setAgent] = React.useState<string | null>(initialAgent);
  const [optionsOpen, setOptionsOpen] = React.useState(false);
  const [model, setModel] = React.useState<string>("");
  const [effort, setEffort] = React.useState<string>("");
  const [repo, setRepo] = React.useState("");
  const [group, setGroup] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [allAgents, setAllAgents] = React.useState(false);

  const usable = (models || []).filter((m) => m.credentialAvailable !== false);
  const unavailable = (models || []).filter((m) => m.credentialAvailable === false);
  const chosenModel = usable.find((m) => m.qualifiedName === model);
  const noProvider = providers && models && !providers.some((p) => p.usableByMe) && usable.length === 0;
  const recent = (() => { try { return JSON.parse(localStorage.getItem("fd.recentAgents") || "[]") as string[]; } catch { return []; } })();
  const sortedAgents = (agents || []).slice().sort((a, b) => {
    const ra = recent.indexOf(a.name); const rb = recent.indexOf(b.name);
    return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
  });

  // Four choices at most until you ask for more: Generic plus your three most recent or first agents,
  // and always the one that is chosen, so a pick from the library never hides itself.
  const SHORT = 3;
  const shownAgents = allAgents ? sortedAgents : sortedAgents.filter((a, i) => i < SHORT || a.name === agent);
  const hiddenCount = sortedAgents.length - shownAgents.length;

  const submit = async () => {
    setBusy(true);
    try {
      const id = await source.createSession({
        prompt,
        agentName: agent,
        model: model || null,
        reasoningEffort: effort || null,
        groupId: group || null,
        workspace: repo.trim() ? { root: "main", folder: repo.trim() } : null,
      });
      if (agent) try { localStorage.setItem("fd.recentAgents", JSON.stringify([agent, ...recent.filter((r) => r !== agent)].slice(0, 6))); } catch { /* ignore */ }
      refresh();
      onDone();
      void navigate({ to: "/s/$sessionId", params: { sessionId: id } });
    } catch (e: any) {
      toast.error("Couldn't start the session", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  if (noProvider) {
    return (
      <DialogBody>
        <div className={cn(cardVariants({ enter: true }), "p-4")}>
          <KeyRound className="mb-2 size-5 text-muted" aria-hidden />
          <h3 className="text-base font-semibold">Add a model provider to start</h3>
          <p className="mt-1 text-sm text-muted">Sessions need a model. Either add your own key, or ask an admin to share a provider with you.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" onClick={() => { onDone(); void navigate({ to: "/providers" }); }}>Add your key</Button>
            <Button onClick={() => { onDone(); void navigate({ to: "/providers" }); }}>See shared providers</Button>
          </div>
        </div>
      </DialogBody>
    );
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <DialogBody className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ns-prompt">What should the agent do?</Label>
          <Textarea
            id="ns-prompt"
            autoFocus
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); } }}
            placeholder="For example: check last night's failed runs and tell me which ones need a retry."
            className="text-base"
          />
          <p className="text-xs text-faint">Optional. You can also start empty and write in the chat.</p>
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Agent</legend>
          {agentsLoading ? (
            <div className="grid gap-2 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[68px]" />)}</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Agent" onKeyDown={rovingKeyDown("radio")}>
              <AgentCard selected={agent === null} onSelect={() => setAgent(null)} title="Generic agent" name="default" description="General-purpose, with sub-agents, canvases and files." />
              {shownAgents.map((a) => (
                <AgentCard key={a.name} selected={agent === a.name} onSelect={() => setAgent(a.name)} title={a.title || a.name} name={a.name} description={a.description} recent={recent.includes(a.name)} />
              ))}
            </div>
          )}
          {hiddenCount > 0 || allAgents ? (
            <Button variant="quiet" size="sm" className="self-start" aria-expanded={allAgents} onClick={() => setAllAgents((v) => !v)}>
              {allAgents ? "Fewer agents" : `More agents (${hiddenCount})`}
            </Button>
          ) : null}
        </fieldset>

        <div className={cardVariants()}>
          <button type="button" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
            <span className="text-sm font-medium">Options</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted">
              {chosenModel ? chosenModel.modelName : "Your default model"}{effort ? ` · ${effort} effort` : ""} · {repo ? `folder ${repo}` : "no working folder"}{group ? ` · ${groups?.find((g) => g.id === group)?.name}` : ""}
            </span>
            <ChevronDown className={cn("size-4 text-muted transition-transform", optionsOpen && "rotate-180")} aria-hidden />
          </button>
          {optionsOpen ? (
            <div className="grid gap-4 border-t border-line p-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ns-model">Model</Label>
                <select id="ns-model" value={model} onChange={(e) => { setModel(e.target.value); setEffort(""); }} className="h-control rounded-control border border-line-strong bg-surface px-2 text-sm">
                  <option value="">Your default</option>
                  {usable.map((m) => <option key={m.qualifiedName} value={m.qualifiedName}>{m.modelName} · {m.providerId}</option>)}
                  {unavailable.length ? (
                    <optgroup label="Unavailable">
                      {unavailable.map((m) => <option key={m.qualifiedName} value={m.qualifiedName} disabled>{m.modelName} · {m.unavailableReason || "no credential"}</option>)}
                    </optgroup>
                  ) : null}
                </select>
              </div>
              {chosenModel?.supportedReasoningEfforts?.length ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="ns-effort">Reasoning effort</Label>
                  <select id="ns-effort" value={effort} onChange={(e) => setEffort(e.target.value)} className="h-control rounded-control border border-line-strong bg-surface px-2 text-sm">
                    <option value="">Model default ({chosenModel.defaultReasoningEffort || "medium"})</option>
                    {chosenModel.supportedReasoningEfforts.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="ns-folder">Working folder</Label>
                <Input id="ns-folder" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="None, or a folder name in your main working folder" />
              </div>
              {groups?.length ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="ns-group">Group</Label>
                  <select id="ns-group" value={group} onChange={(e) => setGroup(e.target.value)} className="h-control rounded-control border border-line-strong bg-surface px-2 text-sm">
                    <option value="">No group</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogBody>
      <DialogFooter>
        <span className="mr-auto hidden items-center gap-1 text-xs text-faint sm:flex"><Kbd>⌘</Kbd><Kbd>Enter</Kbd> to start</span>
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null} Start session</Button>
      </DialogFooter>
    </form>
  );
}

function AgentCard({ selected, onSelect, title, name, description, recent }: { selected: boolean; onSelect: () => void; title: string; name: string; description?: string; recent?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cn(cardVariants({ interactive: true, selected }), "flex min-h-[68px] items-start gap-2.5 p-2.5 text-left", !selected && "hover:bg-raised/50")}
    >
      <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-(--duration-fast)", selected ? "border-accent bg-accent text-accent-fg" : "border-line-strong")} aria-hidden>
        {selected ? <Check className="size-3 animate-pop" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{title}</span>
          {recent ? <span className="shrink-0 text-xs text-muted">recent</span> : null}
        </span>
        <span className="block truncate font-mono text-xs text-muted">{name}</span>
        {description ? <span className="mt-0.5 line-clamp-2 text-xs text-muted">{description}</span> : null}
      </span>
    </button>
  );
}
