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

/** The most additional folders a session can have (the SDK's MAX_WORKSPACE_EXTRAS). */
export const MAX_EXTRAS = 4;

export interface FormExtra { name: string; root: string; folder: string; /** false: the turn runs without it when it cannot be opened. Absent means true. */ required?: boolean }
export interface FormInput { root: string; folder: string; extrasTouched: boolean; extras: FormExtra[] }
export interface WorkspacePayload { root: string; folder?: string; extra?: Record<string, { root: string; folder?: string; required?: boolean }> }

/** Names the SDK refuses for an additional folder (workspace-check.ts): "work", which canvas apps use for the working folder, and anything every object already has ("constructor", ...). */
const reservedName = (name: string) => name === "work" || Object.prototype.hasOwnProperty.call(Object.prototype, name);

/**
 * A name for an additional folder, from where it points: the last part of its path (or its root), cleaned up to
 * what the SDK accepts (lowercase letters, digits, _ and -, up to 32, starting with a letter or digit, and not a
 * reserved name) and made different from the names already taken. Empty when there is nothing to base it on.
 */
export function deriveExtraName(root: string, folder: string, taken: readonly string[]): string {
  const base = (folder.trim().split("/").filter(Boolean).pop() || root.trim()).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^[^a-z0-9]+/, "").replace(/-+$/, "").slice(0, 28);
  if (!base) return "";
  let name = base;
  for (let n = 2; taken.includes(name) || reservedName(name); n++) name = `${base}-${n}`;
  return name;
}
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
  if (form.extrasTouched) workspace.extra = Object.fromEntries(form.extras.filter((e) => e.name).map((e) => [e.name, { root: e.root.trim(), ...(e.folder.trim() ? { folder: trimSlashes(e.folder) } : {}), ...(e.required === false ? { required: false } : {}) }]));
  return { action: "save", expectedRevision: plan.expectedRevision, workspace };
}
