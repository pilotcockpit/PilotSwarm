import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUp, Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { ProjectPicker } from "@/components/project-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useUi } from "@/shell/ui-state";
import { useGroups, useRefresh, useSource } from "@/data/source";
import { useModels, useProviders } from "@/data/source";

const LAST_PROJECT = "fd.startProject";
const remembered = () => { try { return localStorage.getItem(LAST_PROJECT) || ""; } catch { return ""; } };

/**
 * Start a session from the Overview: say what to do, pick the project, go. It starts a generic agent on the person's
 * default model, the way a first message does. Anything more (an agent, a model, a working folder) is the full New
 * session dialog, one click away and already holding what was typed. With nothing typed, or no provider to run on,
 * Start opens that dialog instead of making an empty session or failing.
 */
export function OverviewStart() {
  const { source } = useSource();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { openNewSession } = useUi();
  const { data: groups } = useGroups();
  const { data: providers } = useProviders();
  const { data: models } = useModels();
  const [prompt, setPrompt] = React.useState("");
  const [project, setProject] = React.useState(remembered);
  const [busy, setBusy] = React.useState(false);
  const inFlight = React.useRef(false);
  const projects = groups || [];
  // A project that has since been deleted is no project.
  const chosen = projects.some((g) => g.id === project) ? project : "";
  const noProvider = Boolean(providers && models && !providers.some((p) => p.usableByMe) && !models.some((m) => m.credentialAvailable !== false));

  const choose = (id: string) => { setProject(id); try { localStorage.setItem(LAST_PROJECT, id); } catch { /* storage unavailable */ } };
  const more = () => openNewSession({ prompt, group: chosen || null });
  const start = async () => {
    if (inFlight.current) return;
    if (!prompt.trim() || noProvider) { more(); return; }
    inFlight.current = true;
    setBusy(true);
    try {
      const id = await source.createSession({ prompt: prompt.trim(), agentName: null, model: null, reasoningEffort: null, groupId: chosen || null, workspace: null });
      setPrompt("");
      refresh();
      void navigate({ to: "/s/$sessionId", params: { sessionId: id } });
    } catch (e: any) {
      toast.error("Couldn't start the session", { description: e?.message });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <form
      aria-label="Start a session"
      onSubmit={(e) => { e.preventDefault(); void start(); }}
      className="flex max-w-2xl flex-col gap-2 rounded-work border border-line-strong bg-surface p-3 focus-within:border-accent"
    >
      <Textarea
        aria-label="What should we work on?"
        rows={2}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void start(); } }}
        placeholder="What should we work on?"
        className="min-h-12 resize-none border-0 bg-transparent p-1 text-base shadow-none focus-visible:ring-0"
      />
      <div className="flex flex-wrap items-center gap-2">
        <ProjectPicker value={chosen} onChange={choose} projects={projects} />
        <Button type="button" variant="quiet" size="sm" onClick={more} aria-label="More options" title="Choose an agent, a model or a working folder"><SlidersHorizontal className="sm:hidden" aria-hidden /><span className="max-sm:hidden">More options</span></Button>
        <Button type="submit" variant="primary" size="sm" className="ml-auto" disabled={busy} aria-label="Start session">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowUp aria-hidden />} Start
        </Button>
      </div>
    </form>
  );
}
