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

/** "report.csv" taken becomes "report (2).csv": never overwrite a file the session already has. */
function uniqueName(name: string, taken: Set<string>) {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let n = 2; n < 100; n++) if (!taken.has(`${stem} (${n})${ext}`)) return `${stem} (${n})${ext}`;
  return `${stem}-${newId().slice(0, 6)}${ext}`;
}

export function useAttachments(sessionId: string) {
  const { source } = useSource();
  const [items, setItems] = React.useState<Attachment[]>([]);
  const itemsRef = React.useRef<Attachment[]>([]);
  itemsRef.current = items;

  const revoke = (a: Attachment) => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); };
  // A different session starts with an empty tray.
  React.useEffect(() => () => { itemsRef.current.forEach(revoke); setItems([]); }, [sessionId]);

  const patch = (id: string, change: Partial<Attachment>) => setItems((cur) => cur.map((a) => (a.id === id ? { ...a, ...change } : a)));

  const add = React.useCallback(async (files: File[]) => {
    const incoming = files.filter(Boolean);
    if (!incoming.length) return;
    const known = await source.listArtifacts(sessionId).catch(() => []);
    const taken = new Set<string>([...known.map((a) => a.filename), ...itemsRef.current.map((a) => a.artifact)]);
    let images = itemsRef.current.filter((a) => a.kind === "image" && a.status !== "error");
    let imageBytes = images.reduce((n, a) => n + a.size, 0);
    let fileCount = itemsRef.current.filter((a) => a.kind === "file" && a.status !== "error").length;
    const staged: Array<{ item: Attachment; file: File }> = [];
    const rejected: string[] = [];
    for (const file of incoming) {
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
      const base = isImage ? `attach-${newId().slice(0, 8)}.${extFor(type, file.name)}` : safeName(file.name || `file.${extFor(type, "")}`);
      const artifact = uniqueName(base, taken);
      taken.add(artifact);
      const item: Attachment = { id: newId(), name: file.name || artifact, artifact, size: file.size, type: type || "application/octet-stream", kind: isImage ? "image" : "file", status: "uploading", ...(isImage ? { previewUrl: URL.createObjectURL(file) } : {}) };
      if (isImage) { images = [...images, item]; imageBytes += file.size; } else fileCount += 1;
      staged.push({ item, file });
    }
    if (rejected.length) toast.warning(rejected.length === 1 ? rejected[0] : "Some files were not added", { description: rejected.length === 1 ? undefined : rejected.join(". ") + "." });
    if (!staged.length) return;
    setItems((cur) => [...cur, ...staged.map((s) => s.item)]);
    await Promise.all(staged.map(async ({ item, file }) => {
      try {
        const content = toBase64(new Uint8Array(await file.arrayBuffer()));
        await source.call("uploadArtifact", { sessionId, filename: item.artifact, content, contentType: item.type, contentEncoding: "base64" });
        patch(item.id, { status: "ready" });
      } catch (e: any) {
        patch(item.id, { status: "error", error: e?.message || "Upload failed" });
      }
    }));
  }, [source, sessionId]);

  const remove = React.useCallback((id: string) => {
    const gone = itemsRef.current.find((a) => a.id === id);
    if (!gone) return;
    revoke(gone);
    setItems((cur) => cur.filter((a) => a.id !== id));
    // Best effort: a writer who cannot manage files keeps the upload, which is harmless.
    if (gone.status === "ready") void source.call("deleteArtifact", { sessionId, filename: gone.artifact }).catch(() => undefined);
  }, [source, sessionId]);

  /** After a successful send the files belong to the conversation: clear the tray, keep the uploads. */
  const clear = React.useCallback(() => { itemsRef.current.forEach(revoke); setItems([]); }, []);

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
  const names = built.attachments.map((a) => a.filename).join(", ");
  await source.sendMessage(sessionId, built.prompt + (names ? `\n[${built.attachments.length} image${built.attachments.length === 1 ? "" : "s"} attached: ${names}]` : ""), opts);
}
