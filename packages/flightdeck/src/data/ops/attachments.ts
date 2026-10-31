import * as React from "react";
import { toast } from "sonner";
import { useSource } from "@/data/source";
import type { DataSource } from "@/data/types";
import { newId } from "@/lib/utils";

// What a person can put in front of an agent from the composer.
//
// Images (png, jpeg, gif, webp) go to the model as real attachments: at most 4 per message, 4 MB
// each, 8 MB together (the SDK's own caps). Anything else is uploaded as a session file and the
// message points the agent at it (`artifact://`), so a CSV or a PDF works too. Both are uploaded the
// moment they are added, so Send is instant and a problem shows on the chip, not after you press it.

export const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const IMAGE_MAX_COUNT = 4;
export const IMAGE_MAX_TOTAL = 8 * 1024 * 1024;
// The upload route accepts an 8 MB JSON body; base64 adds a third.
export const FILE_MAX_BYTES = 5 * 1024 * 1024;
export const FILE_MAX_COUNT = 6;

export type AttachmentKind = "image" | "file";
export interface Attachment {
  id: string;
  name: string;
  /** The name it has in the session's files. */
  artifact: string;
  size: number;
  type: string;
  kind: AttachmentKind;
  status: "uploading" | "ready" | "error";
  error?: string;
  previewUrl?: string;
}

export const formatBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

function toBase64(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

const extFor = (type: string, name: string) => ({ "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" } as Record<string, string>)[type] || (name.includes(".") ? name.split(".").pop()! : "bin");
const safeName = (name: string) => name.replace(/[^\w.\- ()]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "file";

/**
 * Every upload gets its own stored name: "report.csv" is stored as "report-3f9a1c2e.csv". Two chips for
 * the same file, a removed chip re-added, and a late cleanup of a cancelled upload can then never touch
 * one another's file, and nothing the session already has is ever overwritten. The person still sees
 * the original name on the chip and in the message.
 */
function storedName(name: string, taken: Set<string>, makeId: () => string) {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let tries = 0; tries < 20; tries++) {
    const candidate = `${stem}-${makeId().replace(/[^0-9a-z]/gi, "").slice(0, 8)}${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem}-${Date.now().toString(36)}${ext}`;
}

export interface AttachmentPlan { staged: Array<{ item: Attachment; file: File }>; rejected: string[] }

/**
 * Decide, without awaiting anything, which of `incoming` join the tray. `existing` is the tray as it
 * is right now, including files another add() already reserved, so two adds in flight can never pick
 * the same name or break the count and size limits together. `known` is the session's current files.
 */
export function planAttachments(incoming: File[], existing: Attachment[], known: Iterable<string>, make: { newId: () => string; previewUrl?: (file: File) => string }): AttachmentPlan {
  const taken = new Set<string>([...known, ...existing.map((a) => a.artifact)]);
  let images = existing.filter((a) => a.kind === "image" && a.status !== "error");
  let imageBytes = images.reduce((n, a) => n + a.size, 0);
  let fileCount = existing.filter((a) => a.kind === "file" && a.status !== "error").length;
  const staged: AttachmentPlan["staged"] = [];
  const rejected: string[] = [];
  for (const file of incoming.filter(Boolean)) {
    const type = (file.type || "").toLowerCase();
    const isImage = IMAGE_TYPES.has(type);
    if (file.size === 0) { rejected.push(`${file.name || "That file"} is empty`); continue; }
    if (isImage) {
      if (file.size > IMAGE_MAX_BYTES) { rejected.push(`${file.name || "Image"} is over ${formatBytes(IMAGE_MAX_BYTES)}`); continue; }
      if (images.length >= IMAGE_MAX_COUNT) { rejected.push(`Only ${IMAGE_MAX_COUNT} images fit in one message`); continue; }
      if (imageBytes + file.size > IMAGE_MAX_TOTAL) { rejected.push(`Images together are over ${formatBytes(IMAGE_MAX_TOTAL)}`); continue; }
    } else {
      if (file.size > FILE_MAX_BYTES) { rejected.push(`${file.name || "File"} is over ${formatBytes(FILE_MAX_BYTES)}`); continue; }
      if (fileCount >= FILE_MAX_COUNT) { rejected.push(`Only ${FILE_MAX_COUNT} files fit in one message`); continue; }
    }
    const base = isImage ? `attach-${make.newId().slice(0, 8)}.${extFor(type, file.name)}` : safeName(file.name || `file.${extFor(type, "")}`);
    const artifact = isImage ? base : storedName(base, taken, make.newId);
    taken.add(artifact);
    const item: Attachment = { id: make.newId(), name: file.name || artifact, artifact, size: file.size, type: type || "application/octet-stream", kind: isImage ? "image" : "file", status: "uploading", ...(isImage && make.previewUrl ? { previewUrl: make.previewUrl(file) } : {}) };
    if (isImage) { images = [...images, item]; imageBytes += file.size; } else fileCount += 1;
    staged.push({ item, file });
  }
  return { staged, rejected };
}

/** What is left in the tray after a send: only the attachments that were part of it go. */
export const withoutSent = (items: Attachment[], sentIds: Iterable<string>) => { const sent = new Set(sentIds); return items.filter((a) => !sent.has(a.id)); };

type AttachmentSource = Pick<DataSource, "call" | "listArtifacts">;

/** What an upload needs from its surroundings; the hook supplies React state, tests supply plain objects. */
export interface UploadDeps {
  source: AttachmentSource;
  sessionId: string;
  patch: (id: string, change: Partial<Attachment>) => void;
  /** True (once) if the chip was removed or the session left while this upload ran. */
  takeCancelled: (id: string) => boolean;
  read: (file: File) => Promise<Uint8Array>;
}

/**
 * Upload one staged attachment. A cancelled upload cleans up after itself, and only ever deletes the
 * exact stored name it created: names are unique per upload, so a replacement for the same file is untouched.
 */
export async function uploadOne({ item, file }: { item: Attachment; file: File }, d: UploadDeps) {
  let uploaded = false;
  try {
    const content = toBase64(await d.read(file));
    await d.source.call("uploadArtifact", { sessionId: d.sessionId, filename: item.artifact, content, contentType: item.type, contentEncoding: "base64" });
    uploaded = true;
    if (d.takeCancelled(item.id)) {
      await d.source.call("deleteArtifact", { sessionId: d.sessionId, filename: item.artifact }).catch(() => undefined);
      return;
    }
    d.patch(item.id, { status: "ready" });
  } catch (e: any) {
    if (d.takeCancelled(item.id)) return;
    d.patch(item.id, { status: uploaded ? "ready" : "error", error: e?.message || "Upload failed" });
  }
}

export interface AddDeps extends UploadDeps {
  getTray: () => Attachment[];
  setTray: (next: Attachment[]) => void;
  /** False once the session was left or the tray unmounted. */
  alive: () => boolean;
  notify: (rejected: string[]) => void;
  make: { newId: () => string; previewUrl?: (file: File) => string };
}

/** Add files to the tray: list the session's files, decide synchronously, then upload what was staged. */
export async function addAttachments(files: File[], d: AddDeps) {
  const incoming = files.filter(Boolean);
  if (!incoming.length) return;
  const known = await d.source.listArtifacts(d.sessionId).catch(() => []);
  // The listing can land after the person left: do not start uploads for a tray that no longer exists.
  if (!d.alive()) return;
  // No await from here to setTray: a second add() that was waiting on the same listing runs after
  // this one and sees these reservations, so counts and sizes are decided once.
  const { staged, rejected } = planAttachments(incoming, d.getTray(), known.map((a) => a.filename), d.make);
  if (rejected.length) d.notify(rejected);
  if (!staged.length) return;
  d.setTray([...d.getTray(), ...staged.map((s) => s.item)]);
  await Promise.all(staged.map((st) => uploadOne(st, d)));
}

export function useAttachments(sessionId: string) {
  const { source } = useSource();
  const [items, setItems] = React.useState<Attachment[]>([]);
  const itemsRef = React.useRef<Attachment[]>([]);
  itemsRef.current = items;
  // Uploads whose chip was removed (or whose session was left) while they ran: delete them when they land.
  const cancelled = React.useRef(new Set<string>());
  // Bumped whenever the session changes or the tray unmounts; an add() started before that is dropped.
  const generation = React.useRef(0);

  const revoke = (a: Attachment) => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); };
  const setTray = (next: Attachment[]) => { itemsRef.current = next; setItems(next); };
  // A different session starts with an empty tray.
  React.useEffect(() => () => {
    generation.current += 1;
    for (const a of itemsRef.current) { revoke(a); if (a.status === "uploading") cancelled.current.add(a.id); }
    itemsRef.current = [];
    setItems([]);
  }, [sessionId]);

  const patch = (id: string, change: Partial<Attachment>) => setItems((cur) => cur.map((a) => (a.id === id ? { ...a, ...change } : a)));

  const add = React.useCallback(async (files: File[]) => {
    const mine = generation.current;
    await addAttachments(files, {
      source, sessionId, patch,
      takeCancelled: (id) => cancelled.current.delete(id),
      read: async (f) => new Uint8Array(await f.arrayBuffer()),
      getTray: () => itemsRef.current,
      setTray,
      alive: () => generation.current === mine,
      notify: (rejected) => toast.warning(rejected.length === 1 ? rejected[0] : "Some files were not added", { description: rejected.length === 1 ? undefined : rejected.join(". ") + "." }),
      make: { newId, previewUrl: (f) => URL.createObjectURL(f) },
    });
  }, [source, sessionId]);

  const remove = React.useCallback((id: string) => {
    const gone = itemsRef.current.find((a) => a.id === id);
    if (!gone) return;
    revoke(gone);
    setTray(itemsRef.current.filter((a) => a.id !== id));
    if (gone.status === "uploading") cancelled.current.add(id);
    // Best effort: a writer who cannot manage files keeps the upload, which is harmless.
    else if (gone.status === "ready") void source.call("deleteArtifact", { sessionId, filename: gone.artifact }).catch(() => undefined);
  }, [source, sessionId]);

  /** After a successful send the sent files belong to the conversation: clear those chips, keep the uploads and any chip added since. */
  const clear = React.useCallback((sentIds?: string[]) => {
    const keep = sentIds ? withoutSent(itemsRef.current, sentIds) : [];
    for (const a of itemsRef.current) if (!keep.includes(a)) revoke(a);
    setTray(keep);
  }, []);

  const ready = items.filter((a) => a.status === "ready");
  return { items, add, remove, clear, ready, uploading: items.some((a) => a.status === "uploading"), hasFailed: items.some((a) => a.status === "error") };
}

/** The message text and image refs for what is in the tray. */
export function buildAttachedMessage(sessionId: string, prompt: string, ready: Attachment[]) {
  const images = ready.filter((a) => a.kind === "image");
  const files = ready.filter((a) => a.kind === "file");
  const refs = files.map((a) => `[Attached file: ${a.name} — artifact://${sessionId}/${a.artifact}]`);
  const text = prompt.trim() || (images.length && !files.length ? "See the attached image." : "See the attached file.");
  return {
    prompt: refs.length ? `${refs.join("\n")}\n\n${text}` : text,
    attachments: images.map((a) => ({ filename: a.artifact, contentType: a.type, sizeBytes: a.size })),
  };
}

/** Send a message with its attachments. Live goes through the Web API; demo has no model to show images to. */
export async function sendWithAttachments(source: DataSource, sessionId: string, built: ReturnType<typeof buildAttachedMessage>, opts?: { enqueueOnly?: boolean }) {
  if (source.kind === "live") {
    await source.call("sendMessage", { sessionId, prompt: built.prompt, options: { clientMessageIds: [newId()], ...(opts?.enqueueOnly ? { enqueueOnly: true } : {}), ...(built.attachments.length ? { attachments: built.attachments } : {}) } });
    return;
  }
  // Demo has no model to look at images, so show them the way the classic portal writes every attachment: one marker line each.
  const markers = built.attachments.map((a) => `[Attached file: ${a.filename} — artifact://${sessionId}/${a.filename}]`);
  await source.sendMessage(sessionId, markers.length ? `${markers.join("\n")}\n\n${built.prompt}` : built.prompt, opts);
}
