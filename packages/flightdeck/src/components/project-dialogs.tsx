import * as React from "react";
import { toast } from "sonner";
import { useCreateGroup, useDeleteGroup, useRenameGroup } from "@/data/ops/groups";
import { DEFAULT_PROJECT_NAME } from "@/data/session-tree";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { plural } from "@/lib/utils";

/** Why a project name cannot be used, or null. "No project" is the derived group that holds everything unfiled. */
export function projectNameProblem(name: string, existing: readonly string[]): string | null {
  const n = name.trim();
  if (!n) return null; // empty is "not yet", not an error
  if (n.toLowerCase() === DEFAULT_PROJECT_NAME.toLowerCase()) return `“${DEFAULT_PROJECT_NAME}” is where sessions outside any project are listed. Choose another name.`;
  if (existing.some((e) => e.trim().toLowerCase() === n.toLowerCase())) return "You already have a project with that name.";
  return null;
}

/** Make a project: a name, nothing else. Projects are the person's own and private, so there is nothing to share or configure. */
export function NewProjectDialog({ open, onOpenChange, existing, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; existing: readonly string[]; onCreated?: (id: string, name: string) => void }) {
  const create = useCreateGroup();
  const [name, setName] = React.useState("");
  React.useEffect(() => { if (open) setName(""); }, [open]);
  const problem = projectNameProblem(name, existing);
  const ready = Boolean(name.trim()) && !problem;
  const submit = (e: React.FormEvent) => {
    // A dialog opened from inside a form (the new-session forms) is a child of it in the React tree: its submit must not reach that form.
    e.preventDefault();
    e.stopPropagation();
    if (!ready || create.isPending) return;
    const title = name.trim();
    create.mutate({ title }, {
      onSuccess: (g: any) => {
        toast.success(`Created ${title}`);
        onOpenChange(false);
        onCreated?.(String(g?.groupId ?? g?.id ?? ""), title);
      },
    });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent title="New project" description="A project is your own way to sort sessions. Nobody else sees it.">
        <form onSubmit={submit}>
          <DialogBody>
            <Field label="Name" error={problem ?? undefined}>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Release 0.9, Research, Docs…" aria-invalid={Boolean(problem)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" disabled={create.isPending} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!ready || create.isPending}>{create.isPending ? "Creating…" : "Create project"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Rename a project. The name rules are the same as for a new one, except that the project's own name is not "already taken". */
export function RenameProjectDialog({ project, onOpenChange, existing }: { project: { id: string; name: string } | null; onOpenChange: (open: boolean) => void; existing: readonly string[] }) {
  const rename = useRenameGroup();
  const [name, setName] = React.useState("");
  React.useEffect(() => { if (project) setName(project.name); }, [project]);
  const others = existing.filter((e) => e !== project?.name);
  const problem = projectNameProblem(name, others);
  const changed = name.trim() !== (project?.name ?? "");
  const ready = Boolean(name.trim()) && !problem && changed;
  const submit = (e: React.FormEvent) => {
    // A dialog opened from inside a form (the new-session forms) is a child of it in the React tree: its submit must not reach that form.
    e.preventDefault();
    e.stopPropagation();
    if (!project || !ready || rename.isPending) return;
    rename.mutate({ groupId: project.id, title: name.trim() }, { onSuccess: () => { toast.success("Renamed"); onOpenChange(false); } });
  };
  return (
    <Dialog open={Boolean(project)} onOpenChange={(o) => !rename.isPending && onOpenChange(o)}>
      <DialogContent title="Rename project" description="Only you see your projects.">
        <form onSubmit={submit}>
          <DialogBody>
            <Field label="Name" error={problem ?? undefined}>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-invalid={Boolean(problem)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" disabled={rename.isPending} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!ready || rename.isPending}>{rename.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Delete a project. Its sessions are not touched: they are listed under No project. */
export function DeleteProjectDialog({ project, sessionCount, onOpenChange, onDeleted }: { project: { id: string; name: string } | null; sessionCount: number; onOpenChange: (open: boolean) => void; onDeleted?: (id: string) => void }) {
  const del = useDeleteGroup();
  return (
    <ConfirmDialog
      open={Boolean(project)}
      onOpenChange={onOpenChange}
      title={`Delete ${project?.name ?? "project"}?`}
      description="This removes the project, not what is in it."
      consequences={[sessionCount ? `${plural(sessionCount, "session")} will be listed under No project; nothing is deleted or stopped.` : "It holds no sessions.", "If it is pinned, the pin goes too."]}
      confirmLabel="Delete project"
      tone="danger"
      onConfirm={async () => { if (project) { await del.mutateAsync({ groupId: project.id }); onDeleted?.(project.id); toast.success(`Deleted ${project.name}`); } }}
    />
  );
}
