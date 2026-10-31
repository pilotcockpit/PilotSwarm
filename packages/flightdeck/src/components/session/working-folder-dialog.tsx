import * as React from "react";
import { FolderOpen, Loader2, Plus, RotateCw, X } from "lucide-react";
import { Button, DisclosureButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton, Tag } from "@/components/ui/misc";
import { cardVariants } from "@/components/ui/card";
import { baselineOf, buildSave, isDirty as formIsDirty, planSave, type Baseline } from "./working-folder-form";
import { errorCode, useRetryWorkspace, useSetWorkspace, useWorkspaceFolders, useWorkspaceView } from "@/data/ops/workspace";
import { cn, plural } from "@/lib/utils";

type Extra = { name: string; root: string; folder: string };

/** The reason a folder path can't be used, or null. Relative to the root; empty means the root itself. */
export function folderPathError(value: string): string | null {
  const v = value.trim();
  if (v.length > 4096) return "That path is too long.";
  if (v.startsWith("/")) return "Use a path inside the root, without a leading /.";
  if (v.split("/").some((p) => p === "..")) return "A path can't go up with ..";
  if (v.includes("\0")) return "That path has a character that isn't allowed.";
  return null;
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;

function workspaceProblem(code: string, message: string): string {
  switch (code) {
    case "WORKSPACE_REVISION_CONFLICT": return "Someone else changed the working folder first. Your edits are still here: load their version, or save again to replace it.";
    case "WORKSPACE_ROOT_UNKNOWN": return "That root isn't one this deployment knows. Pick one from the list.";
    case "WORKSPACE_FOLDER_MISSING": return "That folder doesn't exist under the root. Create it first, or pick another.";
    case "WORKSPACE_PATH_INVALID": return "That path isn't allowed.";
    case "WORKSPACE_CHECK_TIMEOUT":
    case "WORKSPACE_ATTACH_TIMEOUT": return "The worker took too long to open the folder.";
    case "WORKSPACE_ATTACH_FAILED": return message || "The worker couldn't open the folder.";
    case "WORKSPACE_BUSY": return "The session is busy. Try again between turns.";
    default: return message || code;
  }
}

/**
 * Where this session's agent works. Shows what is true now (ready, waiting on a folder, or the
 * default home folder), explains a held-up session in words, and lets the owner point the session
 * somewhere else. A change applies between turns; the dialog says when it is still pending.
 */
export function WorkingFolderDialog({ sessionId, open, onOpenChange }: { sessionId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const view = useWorkspaceView(sessionId, { enabled: open });
  const folders = useWorkspaceFolders(sessionId);
  const save = useSetWorkspace(sessionId);
  const retry = useRetryWorkspace(sessionId);
  const w = view.data;
  const record = w?.workspace ?? null;

  const [root, setRoot] = React.useState("");
  const [folder, setFolder] = React.useState("");
  const [extras, setExtras] = React.useState<Extra[]>([]);
  const [extrasTouched, setExtrasTouched] = React.useState(false);
  const [showExtras, setShowExtras] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const loadedRevision = React.useRef<number | null>(null);
  // What the form was loaded from: its revision and values, frozen until it is loaded again.
  const [baseline, setBaseline] = React.useState<Baseline | null>(null);
  const [conflict, setConflict] = React.useState(false);
  // With no record yet there are no baseline values, but the revision still has to be frozen.
  const [baselineRevision, setBaselineRevision] = React.useState<number | null>(null);
  // Set when the record changed on the server while the form holds unsaved edits: the edits stay, and
  // the person decides whether to load the new version.
  const [remoteRevision, setRemoteRevision] = React.useState<number | null>(null);
  const dirtyRef = React.useRef(false);

  const load = React.useCallback(() => {
    if (!w) return;
    loadedRevision.current = w.revision;
    setRemoteRevision(null);
    setConflict(false);
    setProblem(null);
    const r0 = record?.root ?? w.defaults?.workingFolder?.root ?? "";
    const f0 = record?.folder ?? w.defaults?.workingFolder?.folder ?? "";
    setBaseline(record ? baselineOf(w.revision, record.root, record.folder ?? "") : null);
    setBaselineRevision(w.revision);
    setRoot(r0);
    setFolder(f0);
    const ex = Object.entries(record?.extra ?? {}).map(([name, e]) => ({ name, root: e.root, folder: e.folder ?? "" }));
    setExtras(ex);
    setExtrasTouched(false);
    setShowExtras(ex.length > 0);
  }, [w, record]);
  // Load the form from the server's record when the dialog opens. If the record changes under a form
  // with unsaved edits, keep the edits and say so instead of replacing them.
  React.useEffect(() => {
    if (!open || !w || loadedRevision.current === w.revision) return;
    if (loadedRevision.current != null && dirtyRef.current) { setRemoteRevision(w.revision); return; }
    load();
  }, [open, w, load]);
  React.useEffect(() => { if (!open) { loadedRevision.current = null; setRemoteRevision(null); setConflict(false); setBaseline(null); setBaselineRevision(null); setProblem(null); } }, [open]);

  const knownRoots = React.useMemo(() => {
    const set = new Set<string>(folders.data?.roots ?? []);
    if (record?.root) set.add(record.root);
    if (w?.defaults?.workingFolder?.root) set.add(w.defaults.workingFolder.root);
    for (const e of extras) if (e.root) set.add(e.root);
    return [...set];
  }, [folders.data, record, w, extras]);

  const folderError = folderPathError(folder);
  const extraErrors = extras.map((e, i) =>
    !e.name && !e.root ? null
    : !NAME_RE.test(e.name) ? "Name: letters, digits, . _ - (up to 32)."
    : extras.findIndex((x) => x.name === e.name) !== i ? "That name is used twice."
    : !e.root.trim() ? "Pick a root."
    : folderPathError(e.folder),
  );
  const dirty = formIsDirty({ root, folder, extrasTouched }, baseline);
  const valid = root.trim().length > 0 && !folderError && extraErrors.every((e) => !e);
  dirtyRef.current = dirty;

  /** The baseline the save is checked against: the loaded record, or just its revision when there is no record yet. */
  const frozen = (): Baseline | null => baseline ?? (baselineRevision != null ? { revision: baselineRevision, root: "", folder: "" } : null);

  const send = async (choice: "normal" | "keep") => {
    if (!w) return;
    setProblem(null);
    // "Keep my edits" overwrites what is on the server now, so it must use the revision the server has NOW:
    // the one on screen can be older than the change that raised the conflict.
    const serverRevision = choice === "keep" ? ((await view.refetch()).data?.revision ?? w.revision) : w.revision;
    const request = buildSave({ root, folder, extrasTouched, extras }, frozen(), serverRevision, choice);
    // A detected conflict sends nothing: the person chooses first (see buildSave).
    if (request.action === "conflict") { setConflict(true); return; }
    setConflict(false);
    save.mutate({ expectedRevision: request.expectedRevision, workspace: request.workspace }, {
      onSuccess: () => { loadedRevision.current = null; },
      onError: (e: any) => {
        // The server is the backstop: if it moved between our last read and this save, ask, don't overwrite.
        if (errorCode(e) === "WORKSPACE_REVISION_CONFLICT") setConflict(true);
        else setProblem(workspaceProblem(errorCode(e), e?.message));
        void view.refetch();
      },
    });
  };
  const apply = () => send("normal");
  const clear = async () => {
    if (!w) return;
    const plan = planSave(frozen(), w.revision);
    if (plan.action === "conflict") { setConflict(true); throw new Error("The working folder changed since you opened this. Review it first."); }
    await save.mutateAsync({ expectedRevision: plan.expectedRevision, workspace: null }).catch((e: any) => { throw new Error(workspaceProblem(errorCode(e), e?.message)); });
    loadedRevision.current = null;
  };

  const pending = w && w.turnRevision != null && w.turnRevision < w.revision;
  const where = [root.trim(), folder.trim()].filter(Boolean).join(" / ");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title="Working folder" description="The folder this session's agent reads and writes. It opens before each turn.">
          <DialogBody className="flex flex-col gap-4">
            {view.isLoading ? <Skeleton className="h-24" /> : view.error ? (
              <p role="alert" className="text-sm text-failed">Couldn't read this session's folder. {(view.error as Error).message}</p>
            ) : w ? (
              <>
                <section aria-label="Current state" className={cn(cardVariants({ tone: w.status === "unavailable" ? "waiting" : "neutral" }), "flex flex-col gap-2 p-3")}>
                  <div className="flex flex-wrap items-center gap-2">
                    {w.status === "ready" ? <Tag tone="live">Ready</Tag> : w.status === "unavailable" ? <Tag tone="waiting">Can't open it</Tag> : <Tag>Default folder</Tag>}
                    {pending ? <Tag tone="accent">Change applies next turn</Tag> : null}
                    <span className="min-w-0 truncate font-mono text-xs text-muted">{w.path || (record ? [record.root, record.folder].filter(Boolean).join(" / ") : "your own folder")}</span>
                  </div>
                  {w.status === "unavailable" ? (
                    <div className="flex flex-col gap-2 text-sm">
                      <p>
                        {w.heldPrompts ? <><strong>{plural(w.heldPrompts, "message")}</strong> {w.heldPrompts === 1 ? "is" : "are"} waiting.</> : "Nothing is waiting."}{" "}
                        The agent can't start until its folder opens.
                      </p>
                      {w.lastError ? <p className="text-muted">{workspaceProblem(w.lastError.code, w.lastError.message)}</p> : null}
                      <div><Button size="sm" onClick={() => retry.mutate()} disabled={retry.isPending}>{retry.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />} Retry now</Button></div>
                    </div>
                  ) : w.status === "none" ? (
                    <p className="text-sm text-muted">No folder is set, so the agent works in your own folder. Set one to point it at a project.</p>
                  ) : null}
                  {w.adopted && (w.adopted.agents.length || w.adopted.skills.length) ? (
                    <p className="text-xs text-muted">
                      Picked up from the folder: {[w.adopted.agents.length ? plural(w.adopted.agents.length, "agent") : "", w.adopted.skills.length ? plural(w.adopted.skills.length, "skill") : ""].filter(Boolean).join(" and ")}.
                    </p>
                  ) : null}
                </section>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Root" hint={knownRoots.length ? undefined : "The named location the folder lives under."}>
                    <Input value={root} onChange={(e) => setRoot(e.target.value)} list="wf-roots" placeholder={knownRoots[0] || "e.g. work"} autoComplete="off" spellCheck={false} />
                  </Field>
                  <Field label="Folder inside the root" hint="Leave empty to use the root itself." error={folderError}>
                    <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="e.g. projects/flight-deck" autoComplete="off" spellCheck={false} className="font-mono" />
                  </Field>
                  <datalist id="wf-roots">{knownRoots.map((r) => <option key={r} value={r} />)}</datalist>
                </div>
                {where ? <p className="-mt-2 text-xs text-muted">The agent will work in <span className="font-mono text-fg">{where}</span>.</p> : null}

                <div>
                  <DisclosureButton aria-expanded={showExtras} onClick={() => setShowExtras((v) => !v)} className="text-sm font-medium text-muted">
                    <FolderOpen className="size-4" aria-hidden /> Additional folders{extras.length ? ` (${extras.length})` : ""}
                  </DisclosureButton>
                  {showExtras ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <p className="text-xs text-muted">Other folders the agent can read and write next to its working folder, such as shared notes or a second repository.</p>
                      {extras.map((e, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          <div className="grid grid-cols-[1fr_1fr_1.4fr_auto] items-center gap-2 max-sm:grid-cols-2">
                            <Input aria-label={`Extra folder ${i + 1} name`} value={e.name} placeholder="name" onChange={(ev) => { setExtras(extras.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x))); setExtrasTouched(true); }} spellCheck={false} />
                            <Input aria-label={`Extra folder ${i + 1} root`} value={e.root} placeholder="root" list="wf-roots" onChange={(ev) => { setExtras(extras.map((x, j) => (j === i ? { ...x, root: ev.target.value } : x))); setExtrasTouched(true); }} spellCheck={false} />
                            <Input aria-label={`Extra folder ${i + 1} path`} value={e.folder} placeholder="folder" className="font-mono" onChange={(ev) => { setExtras(extras.map((x, j) => (j === i ? { ...x, folder: ev.target.value } : x))); setExtrasTouched(true); }} spellCheck={false} />
                            <Button variant="quiet" size="icon-sm" aria-label={`Remove extra folder ${e.name || i + 1}`} onClick={() => { setExtras(extras.filter((_, j) => j !== i)); setExtrasTouched(true); }}><X /></Button>
                          </div>
                          {extraErrors[i] ? <p role="alert" className="text-xs text-failed">{extraErrors[i]}</p> : null}
                        </div>
                      ))}
                      <div><Button size="sm" onClick={() => { setExtras([...extras, { name: "", root: root.trim(), folder: "" }]); setExtrasTouched(true); }}><Plus /> Add a folder</Button></div>
                    </div>
                  ) : null}
                </div>

                {conflict ? (
                  <div role="alert" className={cn(cardVariants({ tone: "waiting" }), "flex flex-col gap-2 px-3 py-2 text-sm")}>
                    <p><strong>The working folder changed while you were editing.</strong> Your edits are still here. Saving now would replace their change.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => send("keep")} disabled={save.isPending}>Keep my edits and save</Button>
                      <Button size="sm" onClick={load} disabled={save.isPending}>Take theirs and discard mine</Button>
                    </div>
                  </div>
                ) : null}
                {remoteRevision != null && !conflict ? (
                  <div role="status" className={cn(cardVariants({ tone: "waiting" }), "flex flex-col gap-2 px-3 py-2 text-sm")}>
                    <p>The working folder was changed elsewhere. Your edits here are kept.</p>
                    <div><Button size="sm" onClick={load}>Load their version and discard my edits</Button></div>
                  </div>
                ) : null}
                {problem ? <p role="alert" className="text-sm text-failed">{problem}</p> : null}
              </>
            ) : null}
          </DialogBody>
          <DialogFooter>
            {record ? <Button variant="quiet" className="mr-auto" onClick={() => setConfirmClear(true)} disabled={save.isPending}>Use my default folder</Button> : null}
            <Button onClick={() => onOpenChange(false)}>Close</Button>
            <Button variant="primary" onClick={apply} disabled={!w || !dirty || !valid || save.isPending}>{save.isPending ? <Loader2 className="animate-spin" /> : null} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Use your default folder?"
        description="The agent goes back to working in your own folder from its next turn."
        consequences={["Files in the current working folder stay where they are.", ...(record?.extra && Object.keys(record.extra).length ? [`${plural(Object.keys(record.extra).length, "additional folder")} will be detached.`] : [])]}
        confirmLabel="Use default folder"
        onConfirm={clear}
      />
    </>
  );
}
