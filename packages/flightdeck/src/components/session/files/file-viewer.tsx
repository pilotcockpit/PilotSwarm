import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2, Pencil, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { CanvasFrame } from "@/canvas/CanvasFrame";
import { Markdown } from "@/components/chat";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { Segmented } from "@/components/ui/tabs";
import { Skeleton, Tag } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/empty";
import { FILE_CODES, IMAGE_TYPES, base64FromBytes, baseName, bytesFromBase64, errorCode, extOf, fileErrorText, looksBinary, readText, textToBase64, useFileCall, workspaceKeys } from "@/data/ops/workspace";
import { bytes as formatBytes, cn } from "@/lib/utils";
import { clearDraft, draftKey, getDraft, isDirty, setDraft as storeDraft } from "./drafts";

const MAX_RENDERED_LINES = 5000;

export function downloadBlob(name: string, data: Uint8Array, type = "application/octet-stream") {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

type Loaded = { bytes: Uint8Array; etag: string; size: number; readOnly: boolean };

/**
 * One file: a faithful preview first (images, rendered markdown, a sandboxed page, text with line
 * numbers), and for text an Edit mode that saves against the version it read. If the file changed
 * underneath, nothing is overwritten silently: the person chooses to keep their version or take
 * the new one. Unsaved edits are reported to the parent, which guards navigation.
 */
export function FileViewer({ sessionId, folderId, path, readOnly, onBack, onDirtyChange, onGone }: {
  sessionId: string;
  folderId: string;
  path: string;
  readOnly: boolean;
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onGone: () => void;
}) {
  const call = useFileCall(sessionId);
  const qc = useQueryClient();
  const name = baseName(path);
  const ext = extOf(name);
  const dKey = draftKey(sessionId, folderId, path);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  // What the edit started from, frozen when Edit was pressed (or restored with a draft). A refetch,
  // Refresh or the agent's own save never changes it: saving is checked against these bytes' etag.
  const [editBase, setEditBase] = React.useState<{ etag: string; text: string; bom: boolean; crlf: boolean } | null>(null);
  const [restored, setRestored] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [conflict, setConflict] = React.useState<{ etag: string | null } | null>(null);
  const [face, setFace] = React.useState<"preview" | "source">("preview");
  const key = [...workspaceKeys.all(sessionId), "file", folderId, path] as const;

  const file = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Loaded> => {
      const r = await call<any>({ op: "read", folder: folderId, path });
      return { bytes: bytesFromBase64(r.contentBase64), etag: r.etag, size: r.size, readOnly: Boolean(r.readOnly) };
    },
    retry: false,
    refetchInterval: editing ? false : 10_000,
    refetchOnWindowFocus: !editing,
  });

  const loaded = file.data;
  const text = React.useMemo(() => (loaded && !looksBinary(loaded.bytes) ? readText(loaded.bytes) : null), [loaded]);
  const canEdit = Boolean(text) && !readOnly && !loaded?.readOnly;
  const dirty = editing && editBase != null && draft !== editBase.text;

  React.useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  // Opening a file picks up an unsaved draft left behind earlier (another tab, folder or session visit).
  React.useEffect(() => {
    const d = getDraft(dKey);
    setConflict(null);
    if (d) {
      setEditBase({ etag: d.etag, text: d.baseText, bom: d.bom, crlf: d.crlf });
      setDraft(d.text);
      setEditing(true);
      setFace("source");
      setRestored(isDirty(d));
    } else {
      setEditing(false);
      setEditBase(null);
      setRestored(false);
      setFace("preview");
    }
  }, [dKey]);
  React.useEffect(() => { if (file.error && errorCode(file.error) === FILE_CODES.NOT_FOUND) onGone(); }, [file.error, onGone]);

  // While editing, watch for the file changing on disk (the agent works in these folders too).
  const changedUnderneath = useQuery({
    queryKey: [...key, "stat"],
    queryFn: async () => (await call<any>({ op: "stat", folder: folderId, path })).etag as string,
    enabled: editing,
    refetchInterval: 8_000,
    retry: false,
  });
  const stale = editing && editBase != null && changedUnderneath.data != null && changedUnderneath.data !== editBase.etag;

  const startEdit = () => {
    if (!text || !loaded) return;
    const base = { etag: loaded.etag, text: text.text, bom: text.bom, crlf: text.crlf };
    setEditBase(base);
    setDraft(base.text);
    setEditing(true);
    setFace("source");
    setRestored(false);
    storeDraft({ sessionId, folderId, path, text: base.text, baseText: base.text, etag: base.etag, bom: base.bom, crlf: base.crlf });
  };
  const edit = (value: string) => {
    setDraft(value);
    if (editBase) storeDraft({ sessionId, folderId, path, text: value, baseText: editBase.text, etag: editBase.etag, bom: editBase.bom, crlf: editBase.crlf });
  };
  const finish = () => { clearDraft(dKey); setEditing(false); setEditBase(null); setRestored(false); setConflict(null); };
  const discard = () => finish();

  const write = async (ifMatch: string | null) => {
    if (!editBase) return;
    setSaving(true);
    try {
      const body = textToBase64(draft, { bom: editBase.bom, crlf: editBase.crlf });
      const r = await call<any>({ op: "write", folder: folderId, path, contentBase64: body, ifMatch });
      toast.success("Saved", { description: name });
      finish();
      qc.setQueryData(key, (old: Loaded | undefined) => (old ? { ...old, bytes: bytesFromBase64(body), etag: r.etag, size: r.size } : old));
      void qc.invalidateQueries({ queryKey: [...workspaceKeys.all(sessionId), "dir"] });
    } catch (e: any) {
      if (errorCode(e) === FILE_CODES.CONFLICT) setConflict({ etag: e?.etag ?? e?.body?.etag ?? null });
      else toast.error("Couldn't save", { description: fileErrorText(e) });
    } finally {
      setSaving(false);
    }
  };
  // Always the etag the edit started from: if the file moved on since, the server says so and the person chooses.
  const save = () => { if (editBase && dirty && !saving) void write(editBase.etag); };
  const takeTheirs = async () => { finish(); await qc.invalidateQueries({ queryKey: key }); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && editing) { e.preventDefault(); save(); }
    if (e.key === "Escape" && editing && !dirty) discard();
  };

  const download = () => { if (loaded) downloadBlob(name, loaded.bytes); };
  const imageType = IMAGE_TYPES[ext];
  const isMd = /^(md|markdown|mdx)$/.test(ext);
  const isHtml = /^html?$/.test(ext);

  const body = (() => {
    if (file.isLoading) return <div className="p-3"><Skeleton className="h-40" /></div>;
    if (file.error) {
      const code = errorCode(file.error);
      return (
        <EmptyState title={code === FILE_CODES.TOO_LARGE ? "Too large to open here" : "Couldn't open this file"} className="h-full">
          {fileErrorText(file.error)}
        </EmptyState>
      );
    }
    if (!loaded) return null;
    if (editing) {
      return (
        <textarea
          aria-label={`Editing ${name}`}
          value={draft}
          onChange={(e) => edit(e.target.value)}
          spellCheck={false}
          wrap="off"
          autoFocus
          className="block size-full min-h-48 resize-none bg-surface p-3 font-mono text-xs leading-5 text-fg outline-none"
        />
      );
    }
    if (imageType) return <ImageView bytes={loaded.bytes} type={imageType} name={name} />;
    if (!text) return <EmptyState title="No preview for this file" className="h-full">{loaded.size ? `${formatBytes(loaded.size)} of ` : ""}binary data. Download it to open it elsewhere.<span className="mt-3 block"><Button onClick={download}><Download /> Download</Button></span></EmptyState>;
    if (face === "preview" && isMd) return <div className="p-4"><Markdown text={text.text} /></div>;
    if (face === "preview" && isHtml) return <CanvasFrame html={text.text} title={name} />;
    return <SourceView text={text.text} />;
  })();

  const previewable = Boolean(text) && (isMd || isHtml);
  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-1">
        <Button variant="quiet" size="icon-sm" className="sm:hidden" aria-label="Back to the file list" onClick={onBack}><ArrowLeft /></Button>
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium" title={path}>{name}</span>
        {dirty ? <Tag tone="waiting">Unsaved</Tag> : readOnly || loaded?.readOnly ? <Tag>Read-only</Tag> : null}
        {loaded ? <span className="hidden text-xs tabular-nums text-muted sm:inline">{formatBytes(loaded.size)}</span> : null}
        {previewable && !editing ? <Segmented label="View" value={face} onChange={setFace} options={[{ value: "preview", label: isMd ? "Preview" : "Page" }, { value: "source", label: "Source" }]} /> : null}
        {editing ? (
          <>
            <Button size="sm" onClick={discard} disabled={saving}><RotateCcw /> Discard</Button>
            <Button size="sm" variant="primary" onClick={save} disabled={!dirty || saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Save</Button>
          </>
        ) : (
          <>
            {canEdit ? <Button size="sm" onClick={startEdit}><Pencil /> Edit</Button> : text && (readOnly || loaded?.readOnly) ? <Tooltip content="You can read this file but not change it"><span><Button size="sm" disabled><Pencil /> Edit</Button></span></Tooltip> : null}
            <Button size="sm" variant="quiet" onClick={download} disabled={!loaded} aria-label={`Download ${name}`}><Download /> <span className="max-sm:hidden">Download</span></Button>
          </>
        )}
      </div>
      {restored && !stale && !conflict ? (
        <p role="status" className={cn(cardVariants({ tone: "accent" }), "m-2 px-3 py-2 text-sm")}>Your unsaved changes from earlier are back.</p>
      ) : null}
      {stale && !conflict ? (
        <div role="status" className={cn(cardVariants({ tone: "waiting" }), "m-2 flex flex-col gap-2 px-3 py-2 text-sm")}>
          <p>This file changed on disk since you started editing. Saving asks whether to keep your version or take theirs.</p>
          <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void takeTheirs()} disabled={saving}>Reload the file and discard my edits</Button></div>
        </div>
      ) : null}
      {conflict ? (
        <div role="alert" className={cn(cardVariants({ tone: "waiting" }), "m-2 flex flex-col gap-2 px-3 py-2 text-sm")}>
          <p><strong>Someone changed this file first.</strong> The agent or another person saved it while you were editing.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void write(conflict.etag)} disabled={saving}>Keep my version</Button>
            <Button size="sm" onClick={() => void takeTheirs()} disabled={saving}>Take theirs and discard mine</Button>
          </div>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">{body}</div>
    </div>
  );
}

function SourceView({ text }: { text: string }) {
  const lines = React.useMemo(() => text.replace(/\r\n/g, "\n").split("\n"), [text]);
  const shown = lines.length > MAX_RENDERED_LINES ? lines.slice(0, MAX_RENDERED_LINES) : lines;
  if (text === "") return <p className="p-3 text-sm text-muted">This file is empty.</p>;
  return (
    <div>
      <pre className="grid grid-cols-[auto_1fr] py-2 font-mono text-xs leading-5 text-fg">
        <code className="select-none pl-3 pr-3 text-right tabular-nums text-muted" aria-hidden>{shown.map((_, i) => i + 1).join("\n")}</code>
        <code className="whitespace-pre pr-3">{shown.join("\n")}</code>
      </pre>
      {lines.length > shown.length ? <p className="border-t border-line px-3 py-2 text-xs text-muted">Showing the first {MAX_RENDERED_LINES.toLocaleString()} of {lines.length.toLocaleString()} lines. Download the file to see the rest.</p> : null}
    </div>
  );
}

function ImageView({ bytes, type, name }: { bytes: Uint8Array; type: string; name: string }) {
  // An SVG is shown from a data: address: a blob: address has this page's origin, so an SVG opened
  // from it could run its script as the portal. A data: document has no origin.
  const src = React.useMemo(() => (type === "image/svg+xml" ? `data:${type};base64,${base64FromBytes(bytes)}` : URL.createObjectURL(new Blob([bytes as BlobPart], { type }))), [bytes, type]);
  React.useEffect(() => () => { if (src.startsWith("blob:")) URL.revokeObjectURL(src); }, [src]);
  return <div className="grid min-h-full place-items-center bg-raised p-4"><img src={src} alt={name} className="max-h-[70vh] max-w-full object-contain" /></div>;
}
