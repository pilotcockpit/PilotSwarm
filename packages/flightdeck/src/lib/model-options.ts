import { modelShort } from "@/data/state";
import type { Model, ModelChangeOptions, Session } from "@/data/types";
import { sessionIsViewOnly } from "@/lib/session-access";

// What a session lets a person change from the composer: its model, and with it the reasoning effort and the
// context tier. Pure helpers, so the rules (what a model supports, what a change sends) are tested without a screen.

/** The session's agent is fixed when it is created; there is no operation to change it. */
export const AGENT_FIXED_NOTE = "The agent is set when a session is created";

export interface ModelSelection { model: string; effort: string | null; tier: string | null }

export const supportedEfforts = (m?: Model | null): string[] => (Array.isArray(m?.supportedReasoningEfforts) ? m!.supportedReasoningEfforts! : []);
export const supportedTiers = (m?: Model | null): string[] => (Array.isArray(m?.supportedContextTiers) ? m!.supportedContextTiers! : []);
export const isUsable = (m: Model) => m.credentialAvailable !== false;

/** Why the composer shows the model and folder as plain text, or null when the person may change them. */
export function settingsLockedReason(session: Partial<Pick<Session, "isSystem" | "canWrite" | "canManage" | "visibility" | "owner">>): string | null {
  if (session.isSystem) return "System sessions use the models set in Models & spend";
  if (sessionIsViewOnly(session as Session)) return "View-only access: you can read this session but not change it";
  if (session.canManage === false) return "Only the owner or an admin can change this";
  return null;
}

/** A selection that the chosen model can honour: an effort or tier it does not offer becomes "none". */
export function normaliseSelection(sel: ModelSelection, model: Model | undefined): ModelSelection {
  const efforts = supportedEfforts(model);
  const tiers = supportedTiers(model);
  return {
    model: sel.model,
    effort: sel.effort && efforts.includes(sel.effort) ? sel.effort : null,
    tier: sel.tier && tiers.includes(sel.tier) ? sel.tier : null,
  };
}

export function currentSelection(session: Pick<Session, "model" | "reasoningEffort" | "contextTier">): ModelSelection {
  return { model: session.model || "", effort: session.reasoningEffort ?? null, tier: session.contextTier ?? null };
}

// ── The picker's state: what the person TOUCHED, apart from what the server says ─────────────────────────────
// Untouched fields always show the server's current value (a poll updates them); a touched field keeps the
// person's choice. Without this split a poll arriving mid-edit would either reset the choice or, worse, turn an
// untouched field into an explicit write of a stale value.

export type PickerField = "model" | "effort" | "tier";
const FIELDS: PickerField[] = ["model", "effort", "tier"];
export interface PickerState {
  choice: Partial<ModelSelection>;
  touched: Partial<Record<PickerField, boolean>>;
  /** The server's value for a field at the moment it was first touched: what the person was looking at. */
  base: Partial<Record<PickerField, string | null>>;
}
export const emptyPicker = (): PickerState => ({ choice: {}, touched: {}, base: {} });

/** What the picker shows and would send: the person's choice where they made one, the server's value elsewhere. */
export function effectiveSelection(server: ModelSelection, st: PickerState): ModelSelection {
  return {
    model: st.touched.model ? (st.choice.model ?? server.model) : server.model,
    effort: st.touched.effort ? (st.choice.effort ?? null) : server.effort,
    tier: st.touched.tier ? (st.choice.tier ?? null) : server.tier,
  };
}

export function touchField(server: ModelSelection, st: PickerState, field: PickerField, value: string | null): PickerState {
  return {
    choice: { ...st.choice, [field]: value },
    touched: { ...st.touched, [field]: true },
    base: st.touched[field] ? st.base : { ...st.base, [field]: server[field] },
  };
}

/** Choosing a model also clears an effort or tier the new model does not offer: that clearing is the person's change too. */
export function pickModel(server: ModelSelection, st: PickerState, model: string, info: Model | undefined): PickerState {
  let next = touchField(server, st, "model", model);
  const eff = effectiveSelection(server, next);
  const fixed = normaliseSelection(eff, info);
  if (fixed.effort !== eff.effort) next = touchField(server, next, "effort", fixed.effort);
  if (fixed.tier !== eff.tier) next = touchField(server, next, "tier", fixed.tier);
  return next;
}

/** Fields the person changed whose server value is no longer the one they were looking at: someone else changed it. */
export function changedElsewhere(server: ModelSelection, st: PickerState): PickerField[] {
  return FIELDS.filter((f) => st.touched[f] && st.base[f] !== server[f]);
}

/** The tuple to send, checked against the model's CURRENT capabilities (the list may have refreshed since the choice). */
export function finalSelection(server: ModelSelection, st: PickerState, info: Model | undefined): ModelSelection {
  return normaliseSelection(effectiveSelection(server, st), info);
}

export const sameTuple = (a: ModelSelection, b: ModelSelection) => a.model === b.model && (a.effort ?? null) === (b.effort ?? null) && (a.tier ?? null) === (b.tier ?? null);

export interface ModelChange { model: string; options: ModelChangeOptions; changed: boolean }

/**
 * What to send for a selection. An option the person did not change is LEFT OUT, so the server keeps the
 * session's value (sending the model's default would silently override it). `null` clears one.
 */
export function changeRequest(session: Pick<Session, "model" | "reasoningEffort" | "contextTier">, sel: ModelSelection): ModelChange {
  const cur = currentSelection(session);
  const options: ModelChangeOptions = {};
  if (sel.effort !== cur.effort) options.reasoningEffort = sel.effort;
  if (sel.tier !== cur.tier) options.contextTier = sel.tier;
  return { model: sel.model, options, changed: sel.model !== cur.model || "reasoningEffort" in options || "contextTier" in options };
}

/** Models grouped by provider, the ones the workers can run first. */
export function groupModels(models: Model[]): Array<{ providerId: string; models: Model[]; usable: number }> {
  const groups = new Map<string, Model[]>();
  for (const m of models) groups.set(m.providerId, [...(groups.get(m.providerId) || []), m]);
  return [...groups].map(([providerId, list]) => ({ providerId, models: [...list].sort((a, b) => Number(isUsable(b)) - Number(isUsable(a))), usable: list.filter(isUsable).length }))
    .sort((a, b) => Number(b.usable > 0) - Number(a.usable > 0));
}

/** "sonnet-5 · high": the model without its vendor prefix, then the effort when one is set. */
export function modelChipLabel(session: Pick<Session, "model" | "reasoningEffort">): string {
  const name = modelShort(session.model).replace(/^claude-/, "");
  return session.reasoningEffort ? `${name} · ${session.reasoningEffort}` : name;
}

/** The last path segment of the working folder, or null when there is none. */
export function folderChipLabel(workspace: { root?: string; folder?: string } | null | undefined, path?: string | null): string | null {
  const full = String(path || [workspace?.root, workspace?.folder].filter(Boolean).join("/") || "").replace(/\/+$/, "");
  if (!full) return null;
  return full.split("/").filter(Boolean).pop() || full;
}

/**
 * What the folder chip says. The session's own working folder wins; failing that the deployment's default folder
 * (reported as `defaults.workingFolder`) is said to be the default; failing that there is none. `loaded` is false
 * until the workspace view has been read: then the session's own record is the best we have, but once the view is
 * in, an authoritative `workspace: null` means NO folder, however the session list row last looked.
 */
export function folderChip(view: { workspace?: { root?: string; folder?: string } | null; path?: string | null; defaults?: { workingFolder?: { root?: string; folder?: string } | null } | null } | null | undefined, fallback: { root?: string; folder?: string } | null | undefined): { label: string; isDefault: boolean } {
  if (!view) { const l = folderChipLabel(fallback, null); return { label: l ?? "No folder", isDefault: false }; }
  const own = folderChipLabel(view.workspace, view.path);
  if (own) return { label: own, isDefault: false };
  const dflt = folderChipLabel(view.defaults?.workingFolder, null);
  if (dflt) return { label: `Default: ${dflt}`, isDefault: true };
  return { label: "No folder", isDefault: false };
}

/** A reason to warn on the folder chip, or null when the folder is fine (or there is none). */
export function folderWarning(view: { status?: string; heldPrompts?: number; lastError?: { message?: string } | null } | null | undefined): string | null {
  if (!view) return null;
  if (view.status === "unavailable") return view.lastError?.message ? `Folder unavailable: ${view.lastError.message}` : "Folder unavailable";
  if ((view.heldPrompts ?? 0) > 0) return `${view.heldPrompts} message${view.heldPrompts === 1 ? " is" : "s are"} waiting for the folder`;
  return null;
}
