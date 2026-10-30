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
