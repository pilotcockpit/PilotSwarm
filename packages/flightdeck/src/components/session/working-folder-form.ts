// The working-folder form is edited against a frozen baseline: the revision and the values it was
// loaded from. A refresh that brings a newer record never moves that baseline, so a save can never
// carry an old draft under a newer revision and silently overwrite someone else's change.

export interface Baseline { revision: number; root: string; folder: string }
export interface FormValues { root: string; folder: string; extrasTouched: boolean }

export const baselineOf = (revision: number, root: string, folder: string): Baseline => ({ revision, root: root.trim(), folder: folder.trim() });

/** Has the person changed anything from what they loaded? Compared with the frozen baseline, not the live record. */
export function isDirty(form: FormValues, baseline: Baseline | null): boolean {
  if (!baseline) return Boolean(form.root.trim());
  return form.root.trim() !== baseline.root || form.folder.trim() !== baseline.folder || form.extrasTouched;
}

export type SavePlan = { action: "save"; expectedRevision: number } | { action: "conflict" };

/**
 * What a Save does. The revision sent is always the one the form was loaded from. If the server has
 * moved on since, the person has to choose: "keep" saves over the newer record on purpose (against its
 * revision), anything else stops and shows the choice.
 */
export function planSave(baseline: Baseline | null, serverRevision: number | null, choice: "normal" | "keep" = "normal"): SavePlan {
  if (!baseline) return { action: "save", expectedRevision: serverRevision ?? 0 };
  if (serverRevision != null && serverRevision !== baseline.revision) {
    return choice === "keep" ? { action: "save", expectedRevision: serverRevision } : { action: "conflict" };
  }
  return { action: "save", expectedRevision: baseline.revision };
}

export interface FormInput { root: string; folder: string; extrasTouched: boolean; extras: Array<{ name: string; root: string; folder: string }> }
export interface WorkspacePayload { root: string; folder?: string; extra?: Record<string, { root: string; folder?: string }> }
export type SaveRequest = { action: "save"; expectedRevision: number; workspace: WorkspacePayload } | { action: "conflict" };

const trimSlashes = (v: string) => v.trim().replace(/\/+$/, "");

/**
 * The request a Save makes, or why it makes none.
 *
 * A conflict found here, on the client (the record moved on since the form was loaded), sends NOTHING:
 * the draft is not put under the newer revision, because that would replace someone else's change without
 * the person ever seeing it. They are shown "Keep my edits" or "Take theirs" first; only "Keep" sends, and
 * then against the revision they just looked at. If the record moves between this check and the server
 * receiving the request, the server refuses the old revision and the dialog shows the same choice.
 */
export function buildSave(form: FormInput, baseline: Baseline | null, serverRevision: number | null, choice: "normal" | "keep" = "normal"): SaveRequest {
  const plan = planSave(baseline, serverRevision, choice);
  if (plan.action === "conflict") return plan;
  const workspace: WorkspacePayload = { root: form.root.trim(), ...(form.folder.trim() ? { folder: trimSlashes(form.folder) } : {}) };
  if (form.extrasTouched) workspace.extra = Object.fromEntries(form.extras.filter((e) => e.name).map((e) => [e.name, { root: e.root.trim(), ...(e.folder.trim() ? { folder: trimSlashes(e.folder) } : {}) }]));
  return { action: "save", expectedRevision: plan.expectedRevision, workspace };
}
