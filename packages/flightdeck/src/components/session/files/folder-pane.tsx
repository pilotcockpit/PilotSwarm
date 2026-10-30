import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ChevronRight, Download, File as FileIcon, FilePlus, Folder as FolderIcon, FolderPlus, Link2, Loader2, MoreHorizontal, Pencil, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import type { Session } from "@/data/types";
import { EmptyState } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Skeleton, Tag } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import { FILE_CODES, base64FromBytes, baseName, bytesFromBase64, checkName, dirOf, errorCode, fileErrorText, isDirEntry, joinPath, useFileCall, workspaceKeys, type DirEntry, type FoldersInfo, type WorkspaceFolder } from "@/data/ops/workspace";
import { ago, bytes as formatBytes, cn, plural } from "@/lib/utils";
import { ChangesView } from "./changes-view";
import { FileViewer, downloadBlob } from "./file-viewer";
import { dirtyDrafts } from "./drafts";
import { isEditable } from "./keys";

type Add = null | { kind: "file" | "dir" };

/**
 * One working folder, browsed the way people already think about files: a list you drill into, a
 * breadcrumb to climb back out, a search box that finds anything by name across the whole folder,
 * and a viewer that opens beside the list. Editing, uploads and deletes are one step away and
 * never silent: edits save against the version read, replaces and deletes ask first, and
 * unsaved work is protected when you navigate. A folder you can't write to shows no dead controls.
 */
export function FolderPane({ session, info, folder, openWorkingFolder }: { session: Session; info: FoldersInfo; folder: WorkspaceFolder; openWorkingFolder: () => void }) {
  const sessionId = session.sessionId;
  const call = useFileCall(sessionId);
  const qc = useQueryClient();
  const [dir, setDir] = React.useState("");
  const [openPath, setOpenPath] = React.useState<string | null>(null);
  const [view, setView] = React.useState<"files" | "changes">("files");
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [adding, setAdding] = React.useState<Add>(null);
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<{ path: string; isDir: boolean } | null>(null);
  const [replace, setReplace] = React.useState<Array<{ file: File; path: string }> | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [guarded, setGuarded] = React.useState<null | (() => void)>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  // A different folder starts at its top.
  // A draft left behind in this folder brings its file back, so unsaved work is where it was left.
  React.useEffect(() => {
    const draft = dirtyDrafts(sessionId, folder.id)[0];
    setDir(draft ? dirOf(draft.path) : "");
    setOpenPath(draft ? draft.path : null);
    setView("files"); setQuery(""); setAdding(null); setRenaming(null);
  }, [folder.id, sessionId]);
  React.useEffect(() => { const t = window.setTimeout(() => setDebounced(query.trim()), 250); return () => window.clearTimeout(t); }, [query]);

  const listing = useQuery({
    queryKey: workspaceKeys.dir(sessionId, folder.id, dir),
    queryFn: () => call<{ entries: DirEntry[]; truncated: boolean; readOnly: boolean }>({ op: "list", folder: folder.id, path: dir }),
    refetchInterval: 10_000,
    retry: false,
    enabled: folder.available,
  });
  const found = useQuery({
    queryKey: [...workspaceKeys.all(sessionId), "find", folder.id, debounced],
    queryFn: () => call<{ matches: Array<{ path: string; kind: string }>; truncated: boolean }>({ op: "find", folder: folder.id, path: "", query: debounced }),
    enabled: folder.available && debounced.length >= 2,
    retry: false,
  });
  const readOnly = Boolean(listing.data?.readOnly);
  const refresh = () => qc.invalidateQueries({ queryKey: [...workspaceKeys.all(sessionId)] });

  /** Run something that might lose unsaved edits only after asking. */
  const guard = (go: () => void) => (dirty ? setGuarded(() => go) : go());
  const goDir = (path: string) => guard(() => { setDir(path); setOpenPath(null); setQuery(""); setAdding(null); setRenaming(null); });
  const openFile = (path: string) => guard(() => { setOpenPath(path); setDir(dirOf(path)); setQuery(""); setView("files"); });

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try { await fn(); if (done) toast.success(done); await refresh(); } catch (e: any) { toast.error("That didn't work", { description: fileErrorText(e) }); } finally { setBusy(false); }
  };

  const create = (name: string) => {
    const bad = checkName(name);
    if (bad) { toast.error(bad); return; }
    const path = joinPath(dir, name.trim());
    void act(async () => {
      if (adding?.kind === "dir") await call({ op: "mkdir", folder: folder.id, path });
      else { await call({ op: "write", folder: folder.id, path, contentBase64: "", ifMatch: null }); setOpenPath(path); }
      setAdding(null);
    });
  };
  const rename = (from: string, name: string) => {
    const bad = checkName(name);
    if (bad) { toast.error(bad); return; }
    const toPath = joinPath(dirOf(from), name.trim());
    if (toPath === from) { setRenaming(null); return; }
    void act(async () => { await call({ op: "move", folder: folder.id, path: from, toPath }); if (openPath === from) setOpenPath(toPath); setRenaming(null); }, "Renamed");
  };
  const remove = async () => {
    if (!toDelete) return;
    await call({ op: "delete", folder: folder.id, path: toDelete.path, recursive: toDelete.isDir });
    if (openPath && (openPath === toDelete.path || openPath.startsWith(`${toDelete.path}/`))) setOpenPath(null);
    toast.success(`Deleted ${baseName(toDelete.path)}`);
    await refresh();
  };
  const download = (path: string) => void act(async () => {
    const r = await call<any>({ op: "read", folder: folder.id, path });
    downloadBlob(baseName(path), bytesFromBase64(r.contentBase64));
  });
  const downloadZip = (path: string) => void act(async () => {
    const r = await call<any>({ op: "zip", folder: folder.id, path });
    downloadBlob(`${baseName(path) || folder.name}.zip`, bytesFromBase64(r.contentBase64), "application/zip");
  });

  const upload = async (files: File[], replaceExisting = false) => {
    const clash: Array<{ file: File; path: string }> = [];
    let ok = 0;
    setBusy(true);
    try {
      for (const f of files) {
        const path = joinPath(dir, f.name);
        if (f.size > info.maxBytes) { toast.error(`${f.name} is too large`, { description: `This server accepts files up to ${formatBytes(info.maxBytes)}.` }); continue; }
        const contentBase64 = base64FromBytes(new Uint8Array(await f.arrayBuffer()));
        try {
          if (replaceExisting) {
            const st = await call<any>({ op: "stat", folder: folder.id, path });
            await call({ op: "write", folder: folder.id, path, contentBase64, ifMatch: st.etag });
          } else await call({ op: "write", folder: folder.id, path, contentBase64, ifMatch: null });
          ok++;
        } catch (e: any) {
          if (errorCode(e) === FILE_CODES.EXISTS) clash.push({ file: f, path });
          else toast.error(`Couldn't upload ${f.name}`, { description: fileErrorText(e) });
        }
      }
      if (ok) toast.success(`Uploaded ${plural(ok, "file")}`);
      if (clash.length) setReplace(clash);
      await refresh();
    } finally { setBusy(false); }
  };

  // ── keyboard: arrows move through the list, Enter opens, Backspace climbs ──
  const onListKey = (e: React.KeyboardEvent) => {
    // Only the list's own rows steer: never keys typed into a field, the editor or a menu.
    if (isEditable(e.target)) return;
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])];
    const i = rows.indexOf(e.target as HTMLElement);
    if (i < 0 && e.key === "Backspace") return;
    if (e.key === "ArrowDown" && rows.length) { e.preventDefault(); rows[Math.min(rows.length - 1, i + 1)]?.focus(); }
    else if (e.key === "ArrowUp" && rows.length) { e.preventDefault(); rows[Math.max(0, i - 1)]?.focus(); }
    else if (e.key === "Home" && rows.length) { e.preventDefault(); rows[0].focus(); }
    else if (e.key === "End" && rows.length) { e.preventDefault(); rows.at(-1)?.focus(); }
    else if (e.key === "Backspace" && dir) { e.preventDefault(); goDir(dirOf(dir)); }
  };

  if (!folder.available) {
    return (
      <EmptyState icon={<FolderIcon />} title={folder.opened ? "This server doesn't show that folder" : "The agent hasn't opened this folder yet"} className="h-full"
        action={folder.id === "working" ? <Button onClick={openWorkingFolder}>Working folder settings</Button> : undefined}>
        {folder.opened ? `Its root, “${folder.root}”, isn't served here, so its files can't be browsed.` : "A folder opens on the session's first turn, or after you change it. Send a message to start one."}
      </EmptyState>
    );
  }

  const searching = debounced.length >= 2;
  const crumbs = dir ? dir.split("/") : [];
  const entries = listing.data?.entries ?? [];

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => { if (!readOnly && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => { if (readOnly) return; e.preventDefault(); setDragging(false); const files = [...e.dataTransfer.files]; if (files.length) void upload(files); }}
    >
      {dragging ? <div className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-pane border-2 border-dashed border-accent bg-accent-tint text-sm font-medium">Drop to upload to {dir || folder.name}</div> : null}

      <div className={cn("flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-1.5", openPath && view === "files" && "max-sm:hidden")}>
        <div className="relative min-w-32 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a file or folder by name" aria-label="Find a file or folder by name" className="pl-7 pr-7" />
          {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-1 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-chip text-muted hover:text-fg"><X className="size-3.5" /></button> : null}
        </div>
        {info.git ? <Segmented label="Show" value={view} onChange={(v) => guard(() => setView(v))} options={[{ value: "files", label: "Files" }, { value: "changes", label: "Changes" }]} /> : null}
        <Button variant="quiet" size="icon-sm" aria-label="Refresh" onClick={() => void refresh()}><RefreshCw className={cn(listing.isFetching && "motion-safe:animate-spin")} /></Button>
        {!readOnly && view === "files" ? (
          <Menu>
            <MenuTrigger asChild><Button size="sm" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <FilePlus />} New</Button></MenuTrigger>
            <MenuContent>
              <MenuItem icon={<FilePlus />} onSelect={() => setAdding({ kind: "file" })}>New file</MenuItem>
              <MenuItem icon={<FolderPlus />} onSelect={() => setAdding({ kind: "dir" })}>New folder</MenuItem>
              <MenuItem icon={<Upload />} onSelect={() => fileInput.current?.click()} hint="Or drop files onto the list">Upload files…</MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Download />} onSelect={() => downloadZip(dir)}>Download this folder as .zip</MenuItem>
            </MenuContent>
          </Menu>
        ) : null}
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; if (files.length) void upload(files); }} />
      </div>

      {view === "changes" ? (
        <ChangesView sessionId={sessionId} folderId={folder.id} onOpenFile={openFile} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {!searching ? (
            <nav aria-label="Folder path" className={cn("flex min-h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-line-subtle px-2 text-sm", openPath && "max-sm:hidden")}>
              {dir ? <Button variant="quiet" size="icon-sm" aria-label="Up one folder" onClick={() => goDir(dirOf(dir))}><ArrowUp /></Button> : null}
              <Crumb onClick={() => goDir("")} current={!dir}>{folder.name}</Crumb>
              {crumbs.map((c, i) => (
                <React.Fragment key={i}>
                  <ChevronRight className="size-3.5 shrink-0 text-muted" aria-hidden />
                  <Crumb onClick={() => goDir(crumbs.slice(0, i + 1).join("/"))} current={i === crumbs.length - 1}>{c}</Crumb>
                </React.Fragment>
              ))}
              {readOnly ? <Tag className="ml-auto">Read-only</Tag> : null}
            </nav>
          ) : null}

          <ul ref={listRef} onKeyDown={onListKey} className={cn("min-h-0 shrink-0 overflow-y-auto", openPath ? "max-h-[38%] border-b border-line max-sm:hidden" : "flex-1")} aria-label={searching ? "Search results" : `Contents of ${dir || folder.name}`}>
            {searching ? (
              found.isLoading ? <li className="p-3"><Skeleton className="h-9" /></li>
              : found.error ? <li className="p-3 text-sm text-failed">Search failed. {fileErrorText(found.error)}</li>
              : (found.data?.matches ?? []).length === 0 ? <li className="p-6 text-center text-sm text-muted">Nothing named like “{debounced}” in this folder.</li>
              : (
                <>
                  {found.data!.matches.map((m) => (
                    <li key={m.path}>
                      <button type="button" data-row onClick={() => (m.kind === "dir" ? goDir(m.path) : openFile(m.path))} className="focus-inset flex min-h-9 w-full items-center gap-2.5 border-b border-line-subtle px-3 text-left text-sm hover:bg-raised pointer-coarse:min-h-11">
                        {m.kind === "dir" ? <FolderIcon className="size-4 shrink-0 text-muted" aria-hidden /> : <FileIcon className="size-4 shrink-0 text-muted" aria-hidden />}
                        <span className="min-w-0 flex-1 truncate"><span className="font-medium">{baseName(m.path)}</span>{dirOf(m.path) ? <span className="ml-2 font-mono text-xs text-muted">{dirOf(m.path)}</span> : null}</span>
                      </button>
                    </li>
                  ))}
                  {found.data!.truncated ? <li className="px-3 py-2 text-xs text-muted">Showing the first matches. Type more of the name to narrow it.</li> : null}
                </>
              )
            ) : listing.isLoading ? (
              <li className="flex flex-col gap-2 p-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}</li>
            ) : listing.error ? (
              <li><EmptyState title="Couldn't open this folder" className="py-8" action={<Button onClick={() => void listing.refetch()}>Try again</Button>}>{fileErrorText(listing.error)}</EmptyState></li>
            ) : (
              <>
                {adding ? <li><NameRow icon={adding.kind === "dir" ? <FolderIcon className="size-4 text-muted" aria-hidden /> : <FileIcon className="size-4 text-muted" aria-hidden />} label={adding.kind === "dir" ? "New folder name" : "New file name"} initial="" onSubmit={create} onCancel={() => setAdding(null)} /></li> : null}
                {entries.length === 0 && !adding ? (
                  <li>
                    <EmptyState icon={<FolderIcon />} title="This folder is empty" className="py-8" action={!readOnly ? <Button onClick={() => setAdding({ kind: "file" })}><FilePlus /> New file</Button> : undefined}>
                      {readOnly ? "There's nothing here to show." : "Create a file, or drop files onto this list to upload them."}
                    </EmptyState>
                  </li>
                ) : null}
                {entries.map((e) => {
                  const path = joinPath(dir, e.name);
                  const isDir = isDirEntry(e);
                  if (renaming === path) return <li key={path}><NameRow icon={isDir ? <FolderIcon className="size-4 text-muted" aria-hidden /> : <FileIcon className="size-4 text-muted" aria-hidden />} label={`Rename ${e.name}`} initial={e.name} onSubmit={(n) => rename(path, n)} onCancel={() => setRenaming(null)} /></li>;
                  const unreachable = e.kind === "link" && (e.target === "outside" || e.target === "missing");
                  return (
                    <li key={path} className={cn("group flex items-center border-b border-line-subtle", openPath === path && "bg-raised")}>
                      <button
                        type="button"
                        data-row
                        disabled={unreachable}
                        aria-current={openPath === path ? "true" : undefined}
                        onClick={() => (isDir ? goDir(path) : openFile(path))}
                        className="focus-inset flex min-h-9 min-w-0 flex-1 items-center gap-2.5 px-3 text-left text-sm transition-colors duration-(--duration-fast) hover:bg-raised disabled:opacity-60 pointer-coarse:min-h-11"
                      >
                        {e.kind === "link" ? <Link2 className="size-4 shrink-0 text-muted" aria-hidden /> : isDir ? <FolderIcon className="size-4 shrink-0 text-muted" aria-hidden /> : <FileIcon className="size-4 shrink-0 text-muted" aria-hidden />}
                        <span className="min-w-0 flex-1 truncate">{e.name}{unreachable ? <span className="ml-2 text-xs text-muted">{e.target === "outside" ? "points outside this folder" : "broken link"}</span> : null}</span>
                        {!isDir && e.size ? <span className="shrink-0 text-xs tabular-nums text-muted max-sm:hidden">{formatBytes(e.size)}</span> : null}
                        <span className="w-14 shrink-0 text-right text-xs text-muted max-sm:hidden">{e.mtimeMs ? ago(e.mtimeMs) : ""}</span>
                      </button>
                      <Menu>
                        <MenuTrigger asChild><Button variant="quiet" size="icon-sm" className="mr-1 shrink-0" aria-label={`Actions for ${e.name}`}><MoreHorizontal /></Button></MenuTrigger>
                        <MenuContent>
                          <MenuItem icon={isDir ? <FolderIcon /> : <FileIcon />} onSelect={() => (isDir ? goDir(path) : openFile(path))}>Open</MenuItem>
                          {isDir ? <MenuItem icon={<Download />} onSelect={() => downloadZip(path)}>Download as .zip</MenuItem> : <MenuItem icon={<Download />} onSelect={() => download(path)}>Download</MenuItem>}
                          {!readOnly && !e.readOnly ? (
                            <>
                              <MenuSeparator />
                              <MenuItem icon={<Pencil />} onSelect={() => setRenaming(path)}>Rename</MenuItem>
                              <MenuItem icon={<Trash2 />} danger onSelect={() => setToDelete({ path, isDir })}>Delete…</MenuItem>
                            </>
                          ) : null}
                        </MenuContent>
                      </Menu>
                    </li>
                  );
                })}
                {listing.data?.truncated ? <li className="px-3 py-2 text-xs text-muted">This folder has more items than can be listed. Use search to find a file by name.</li> : null}
              </>
            )}
          </ul>

          {openPath ? (
            <FileViewer
              key={`${folder.id}:${openPath}`}
              sessionId={sessionId}
              folderId={folder.id}
              path={openPath}
              readOnly={readOnly}
              onBack={() => guard(() => setOpenPath(null))}
              onDirtyChange={setDirty}
              onGone={() => { toast("That file is gone", { description: baseName(openPath) }); setOpenPath(null); void refresh(); }}
            />
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(v) => !v && setToDelete(null)}
        title={`Delete ${toDelete ? baseName(toDelete.path) : ""}?`}
        description="This removes it from the folder. The agent will be told at its next turn."
        consequences={toDelete?.isDir ? ["The folder and everything inside it is deleted.", "There is no undo from here."] : ["There is no undo from here."]}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
      />
      <ConfirmDialog
        open={Boolean(replace)}
        onOpenChange={(v) => !v && setReplace(null)}
        title={replace && replace.length === 1 ? `Replace ${replace[0].file.name}?` : `Replace ${replace?.length ?? 0} files?`}
        description="Files with these names already exist in this folder."
        consequences={replace?.slice(0, 6).map((r) => r.file.name)}
        confirmLabel="Replace"
        onConfirm={async () => { const r = replace!; setReplace(null); await upload(r.map((x) => x.file), true); }}
      />
      <ConfirmDialog
        open={Boolean(guarded)}
        onOpenChange={(v) => !v && setGuarded(null)}
        title="Discard your unsaved changes?"
        description="You have edits to this file that haven't been saved."
        confirmLabel="Discard changes"
        tone="danger"
        onConfirm={() => { const go = guarded; setGuarded(null); setDirty(false); go?.(); }}
      />
    </div>
  );
}

function Crumb({ children, onClick, current }: { children: React.ReactNode; onClick: () => void; current: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-current={current ? "page" : undefined} className={cn("focus-inset inline-flex min-h-6 max-w-56 shrink-0 items-center truncate rounded-chip px-1.5 text-sm transition-colors duration-(--duration-fast) hover:text-fg pointer-coarse:min-h-11", current ? "font-semibold text-fg" : "text-muted")}>
      {children}
    </button>
  );
}

function NameRow({ icon, label, initial, onSubmit, onCancel }: { icon: React.ReactNode; label: string; initial: string; onSubmit: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = React.useState(initial);
  return (
    <form className="flex items-center gap-2.5 border-b border-line-subtle px-3 py-1" onSubmit={(e) => { e.preventDefault(); onSubmit(value); }}>
      {icon}
      <Input autoFocus aria-label={label} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onCancel(); } }} onFocus={(e) => { if (initial) e.currentTarget.setSelectionRange(0, initial.lastIndexOf(".") > 0 ? initial.lastIndexOf(".") : initial.length); }} spellCheck={false} autoComplete="off" className="h-8" />
      <Button type="submit" size="sm" variant="primary" disabled={!value.trim()}>{initial ? "Rename" : "Create"}</Button>
      <Button type="button" size="sm" variant="quiet" onClick={onCancel}>Cancel</Button>
    </form>
  );
}
