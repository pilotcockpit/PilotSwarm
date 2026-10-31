import * as React from "react";
import { ChevronRight, File as FileIcon, Folder } from "lucide-react";
import { DisclosureButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Markdown } from "@/components/chat";
import { type PackageSummary, usePackageFile, usePackageTree } from "@/data/ops/packages";
import type { Profile } from "@/data/types";
import { bytes, cn } from "@/lib/utils";

interface Node { name: string; path: string; dir: boolean; size?: number; kids: Node[] }

function build(files: Array<{ path: string; size: number }>): Node[] {
  const root: Node = { name: "", path: "", dir: true, kids: [] };
  for (const f of files) {
    let at = root;
    const parts = f.path.split("/");
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/");
      let kid = at.kids.find((k) => k.name === part);
      if (!kid) { kid = { name: part, path, dir: i < parts.length - 1, size: i === parts.length - 1 ? f.size : undefined, kids: [] }; at.kids.push(kid); }
      at = kid;
    });
  }
  const sort = (n: Node) => { n.kids.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name)); n.kids.forEach(sort); };
  sort(root);
  return root.kids;
}

/** Read-only: the files exactly as workers install them. A tree to move around in, a preview to read from. */
export function PackageFiles({ pkg, semver, profile }: { pkg: PackageSummary; semver?: string; profile?: Profile | null }) {
  const tree = usePackageTree(pkg, semver, profile);
  const nodes = React.useMemo(() => build(tree.data?.files ?? []), [tree.data]);
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const [file, setFile] = React.useState<string | null>(null);
  React.useEffect(() => { setFile(null); }, [pkg.packageId, semver]);
  React.useEffect(() => { if (!file && tree.data?.files.length) setFile(tree.data.files.find((f) => /^readme/i.test(f.path))?.path ?? tree.data.files[0].path); }, [tree.data, file]);
  const preview = usePackageFile(pkg, semver, file, profile);

  const row = (n: Node, depth: number): React.ReactNode => (
    <li key={n.path}>
      {n.dir ? (
        <DisclosureButton aria-expanded={open.has(n.path)} onClick={() => setOpen((s) => { const x = new Set(s); x.has(n.path) ? x.delete(n.path) : x.add(n.path); return x; })} className="w-full px-1.5 text-sm hover:bg-raised" style={{ paddingLeft: `${depth * 0.875 + 0.375}rem` }}>
          <ChevronRight className={cn("size-3.5 shrink-0 text-muted transition-transform duration-(--duration-fast)", open.has(n.path) && "rotate-90")} aria-hidden />
          <Folder className="size-3.5 shrink-0 text-muted" aria-hidden />
          <span className="truncate">{n.name}</span>
        </DisclosureButton>
      ) : (
        <button type="button" aria-current={file === n.path ? "true" : undefined} onClick={() => setFile(n.path)} className={cn("focus-inset flex min-h-6 w-full items-center gap-1.5 rounded-control px-1.5 text-left text-sm transition-colors duration-(--duration-fast) hover:bg-raised pointer-coarse:min-h-11", file === n.path && "bg-raised font-medium")} style={{ paddingLeft: `${depth * 0.875 + 1.375}rem` }}>
          <FileIcon className="size-3.5 shrink-0 text-muted" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{n.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-faint">{bytes(n.size)}</span>
        </button>
      )}
      {n.dir && open.has(n.path) ? <ul>{n.kids.map((k) => row(k, depth + 1))}</ul> : null}
    </li>
  );

  if (tree.isLoading) return <Skeleton className="h-40" />;
  if (tree.isError) return <p role="alert" className="text-sm text-failed">The files could not be read: {(tree.error as Error)?.message}</p>;
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
      <ul aria-label="Package files" className="rounded-pane border border-line p-1 md:max-h-72 md:overflow-y-auto">{nodes.map((n) => row(n, 0))}</ul>
      <div className="min-w-0 rounded-pane border border-line">
        <p className="truncate border-b border-line px-3 py-1.5 font-mono text-xs text-muted">{file ?? "No file selected"}</p>
        <div className="max-h-72 overflow-auto p-3">
          {preview.isLoading ? <Skeleton className="h-24" /> : preview.isError ? <p className="text-sm text-failed">This file could not be read.</p> : preview.data?.binary ? <p className="text-sm text-muted">This is a binary file, so there is no preview.</p> : file && /\.md$/i.test(file) ? <Markdown text={preview.data?.text ?? ""} /> : <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5">{preview.data?.text ?? ""}</pre>}
          {preview.data?.truncated ? <p className="mt-2 text-xs text-muted">Showing the first 256 KB.</p> : null}
        </div>
      </div>
    </div>
  );
}
