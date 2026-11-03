import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, GitBranch, GitCommit } from "lucide-react";
import { Button, DisclosureButton } from "@/components/ui/button";
import { EmptyState } from "@/components/empty";
import { Skeleton, Tag } from "@/components/ui/misc";
import { bytesFromBase64, readText, useFileCall, workspaceKeys } from "@/data/ops/workspace";
import { collapseDiff, diffLines } from "@/lib/line-diff";
import { ago, cn, plural } from "@/lib/utils";

interface GitFile { path: string; from?: string; letter: "M" | "A" | "D" | "R" | "C" | "U"; staged: boolean; unstaged: boolean; added: number | null; removed: number | null; staged_counts?: { added: number | null; removed: number | null } | null; unstaged_counts?: { added: number | null; removed: number | null } | null }

const LETTER: Record<GitFile["letter"], { word: string; tone: "ok" | "waiting" | "failed" | "neutral" | "accent" }> = {
  M: { word: "Changed", tone: "waiting" },
  A: { word: "Added", tone: "ok" },
  D: { word: "Deleted", tone: "failed" },
  R: { word: "Renamed", tone: "accent" },
  C: { word: "Conflict", tone: "failed" },
  U: { word: "New", tone: "ok" },
};

/**
 * What the agent (or you) changed in a git folder: the branch, every changed file with its line
 * counts, a readable diff for any of them, and recent commits. Read-only on purpose: moving the
 * repository is left to the agent and the terminal, because it runs in this folder too.
 */
export function ChangesView({ sessionId, folderId, onOpenFile }: { sessionId: string; folderId: string; onOpenFile: (path: string) => void }) {
  const call = useFileCall(sessionId);
  const [repo, setRepo] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<GitFile | null>(null);
  const [showLog, setShowLog] = React.useState(false);

  const repos = useQuery({ queryKey: [...workspaceKeys.all(sessionId), "git", folderId, "repos"], queryFn: () => call<{ top: boolean; repos: string[]; truncated?: boolean }>({ op: "git", folder: folderId, what: "repos" }), retry: false });
  const active = repo ?? (repos.data ? (repos.data.top ? "" : repos.data.repos[0] ?? null) : null);

  const status = useQuery({
    queryKey: [...workspaceKeys.all(sessionId), "git", folderId, "status", active],
    queryFn: () => call<any>({ op: "git", folder: folderId, what: "status", ...(active ? { repo: active } : {}) }),
    enabled: active != null,
    refetchInterval: 10_000,
    retry: false,
  });

  if (repos.isLoading || (active != null && status.isLoading)) return <div className="flex flex-col gap-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}</div>;
  if (repos.error || status.error) return <EmptyState title="Couldn't read the changes" className="h-full">{((repos.error || status.error) as Error).message}</EmptyState>;
  if (active == null || status.data?.repo === false) {
    return <EmptyState icon={<GitBranch />} title="This folder isn't a git repository" className="h-full">Git changes appear here when the folder, or a folder inside it, is a repository.</EmptyState>;
  }
  const s = status.data;
  if (!s?.available) return <EmptyState icon={<GitBranch />} title="Git isn't available for this folder" className="h-full">{s?.reason || "The server can't run git here."}</EmptyState>;

  if (file) return <FileDiff sessionId={sessionId} folderId={folderId} repo={active} file={file} onBack={() => setFile(null)} onOpenFile={onOpenFile} />;

  const files: GitFile[] = s.files || [];
  const staged = files.filter((f) => f.staged);
  const unstaged = files.filter((f) => f.unstaged && f.letter !== "U");
  const untracked = files.filter((f) => f.letter === "U");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-sm">
        <GitBranch className="size-4 text-muted" aria-hidden />
        <span className="font-mono font-medium">{s.branch || `detached at ${String(s.head || "").slice(0, 7)}`}</span>
        {s.ahead ? <Tag>{s.ahead} ahead</Tag> : null}
        {s.behind ? <Tag tone="waiting">{s.behind} behind</Tag> : null}
        {s.state ? <Tag tone="failed">{s.state === "merge" ? "Merging" : "Rebasing"}</Tag> : null}
        {(repos.data?.repos.length ?? 0) > 1 || (repos.data?.top === false && (repos.data?.repos.length ?? 0) > 0) ? (
          <select aria-label="Repository" value={active} onChange={(e) => { setRepo(e.target.value); setFile(null); }} className="ml-auto h-6.5 rounded-control border border-line-strong bg-surface px-1.5 text-xs">
            {repos.data!.repos.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        ) : null}
      </div>
      {files.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted">Nothing has changed since the last commit.</p>
      ) : (
        <>
          <Group title="Staged" files={staged} counts="staged_counts" onPick={setFile} />
          <Group title="Changed" files={unstaged} counts="unstaged_counts" onPick={setFile} />
          <Group title="New, not yet tracked" files={untracked} onPick={setFile} />
          {s.truncated ? <p className="px-3 py-2 text-xs text-muted">Showing the first changes only.</p> : null}
        </>
      )}
      <div className="border-t border-line px-3 py-2">
        <DisclosureButton aria-expanded={showLog} onClick={() => setShowLog((v) => !v)} className="text-sm font-medium text-muted"><GitCommit className="size-4" aria-hidden /> Recent commits</DisclosureButton>
        {showLog ? <CommitLog sessionId={sessionId} folderId={folderId} repo={active} /> : null}
      </div>
    </div>
  );
}

function Group({ title, files, counts, onPick }: { title: string; files: GitFile[]; counts?: "staged_counts" | "unstaged_counts"; onPick: (f: GitFile) => void }) {
  if (!files.length) return null;
  return (
    <section aria-label={title}>
      <h3 className="px-3 pb-1 pt-3 text-xs font-medium text-muted">{title} · {files.length}</h3>
      <ul>
        {files.map((f) => {
          const c = counts ? f[counts] : null;
          const meta = LETTER[f.letter];
          return (
            <li key={`${title}:${f.path}`}>
              <button type="button" onClick={() => onPick(f)} className="focus-inset flex min-h-9 w-full items-center gap-2 border-b border-line-subtle px-3 text-left text-sm transition-colors duration-(--duration-fast) hover:bg-raised pointer-coarse:min-h-11">
                <Tag tone={meta.tone}>{meta.word}</Tag>
                <span className="min-w-0 flex-1 truncate font-mono text-xs" title={f.from ? `${f.from} → ${f.path}` : f.path}>{f.path}</span>
                {c && (c.added != null || c.removed != null) ? (
                  <span className="shrink-0 text-xs tabular-nums"><span className="text-ok">+{c.added ?? 0}</span> <span className="text-failed">−{c.removed ?? 0}</span></span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CommitLog({ sessionId, folderId, repo }: { sessionId: string; folderId: string; repo: string }) {
  const call = useFileCall(sessionId);
  const log = useQuery({ queryKey: [...workspaceKeys.all(sessionId), "git", folderId, "log", repo], queryFn: () => call<any>({ op: "git", folder: folderId, what: "log", ...(repo ? { repo } : {}) }), retry: false });
  const [sha, setSha] = React.useState<string | null>(null);
  if (log.isLoading) return <Skeleton className="mt-2 h-16" />;
  const commits: any[] = log.data?.commits || [];
  if (!commits.length) return <p className="mt-2 text-sm text-muted">No commits yet.</p>;
  return (
    <ul className="mt-2">
      {commits.map((c) => (
        <li key={c.sha} className="border-b border-line-subtle last:border-b-0">
          <button type="button" aria-expanded={sha === c.sha} onClick={() => setSha(sha === c.sha ? null : c.sha)} className="focus-inset flex min-h-9 w-full items-baseline gap-2 text-left text-sm pointer-coarse:min-h-11">
            <span className="shrink-0 font-mono text-xs text-muted">{c.short}</span>
            <span className="min-w-0 flex-1 truncate">{c.subject}</span>
            <span className="shrink-0 text-xs text-muted">{c.author} · {ago(c.time * 1000)}</span>
          </button>
          {sha === c.sha ? <CommitFiles sessionId={sessionId} folderId={folderId} repo={repo} sha={c.sha} /> : null}
        </li>
      ))}
      {log.data?.more ? <li className="py-2 text-xs text-muted">Older commits aren't listed here.</li> : null}
    </ul>
  );
}

function CommitFiles({ sessionId, folderId, repo, sha }: { sessionId: string; folderId: string; repo: string; sha: string }) {
  const call = useFileCall(sessionId);
  const q = useQuery({ queryKey: [...workspaceKeys.all(sessionId), "git", folderId, "show", repo, sha], queryFn: () => call<any>({ op: "git", folder: folderId, what: "show", sha, ...(repo ? { repo } : {}) }), retry: false });
  if (q.isLoading) return <Skeleton className="mb-2 h-10" />;
  const files: GitFile[] = q.data?.files || [];
  return (
    <div className="mb-2 rounded-control bg-raised p-2 text-xs">
      {q.data?.commit?.body ? <p className="mb-2 whitespace-pre-wrap text-muted">{q.data.commit.body}</p> : null}
      {files.length ? (
        <ul>{files.map((f) => <li key={f.path} className="flex items-center gap-2 py-0.5"><Tag tone={LETTER[f.letter]?.tone || "neutral"}>{LETTER[f.letter]?.word || f.letter}</Tag><span className="min-w-0 flex-1 truncate font-mono">{f.path}</span>{f.added != null ? <span className="tabular-nums"><span className="text-ok">+{f.added}</span> <span className="text-failed">−{f.removed ?? 0}</span></span> : null}</li>)}</ul>
      ) : <p className="text-muted">{plural(0, "file")} changed.</p>}
    </div>
  );
}

/** One file against what git last saw: only the changed lines, with a little context. */
function FileDiff({ sessionId, folderId, repo, file, onBack, onOpenFile }: { sessionId: string; folderId: string; repo: string; file: GitFile; onBack: () => void; onOpenFile: (path: string) => void }) {
  const call = useFileCall(sessionId);
  const full = repo ? `${repo}/${file.path}` : file.path;
  const q = useQuery({
    queryKey: [...workspaceKeys.all(sessionId), "git", folderId, "diff", repo, file.path, file.letter],
    retry: false,
    queryFn: async () => {
      const before = file.letter === "U" || file.letter === "A" ? { exists: false } : await call<any>({ op: "git", folder: folderId, what: "file", rev: "HEAD", path: file.from ?? file.path, ...(repo ? { repo } : {}) });
      let after = "";
      let binary = false;
      if (file.letter !== "D") {
        const r = await call<any>({ op: "read", folder: folderId, path: full });
        const b = bytesFromBase64(r.contentBase64);
        const t = readText(b);
        if (!t) binary = true; else after = t.text;
      }
      if (before.binary || before.tooLarge) binary = true;
      return { binary, ...diffLines(before.exists ? before.text ?? "" : "", after) };
    },
  });
  const rows = React.useMemo(() => (q.data ? collapseDiff(q.data.lines) : []), [q.data]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-10 items-center gap-2 border-b border-line px-3">
        <Button variant="quiet" size="icon-sm" aria-label="Back to the changes" onClick={onBack}><ArrowLeft /></Button>
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium" title={full}>{file.path}</span>
        {file.letter !== "D" ? <Button size="sm" onClick={() => onOpenFile(full)}>Open file</Button> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {q.isLoading ? <div className="p-3"><Skeleton className="h-32" /></div> : q.error ? <p className="p-3 text-sm text-failed">Couldn't build the comparison. {(q.error as Error).message}</p>
          : q.data?.binary ? <EmptyState title="Binary or very large file" className="h-full">There's no line comparison for this file.</EmptyState>
          : rows.length === 0 ? <p className="p-3 text-sm text-muted">No line changes.</p>
          : (
            <div className="py-1 font-mono text-xs leading-5">
              {q.data?.coarse ? <p className="px-3 py-1 font-sans text-muted">A large change: shown as a full replacement.</p> : null}
              {rows.map((r, i) => r.type === "skip"
                ? <div key={i} className="bg-raised px-3 text-center font-sans text-muted">{plural(r.count, "unchanged line")}</div>
                : (
                  <div key={i} className={cn("grid grid-cols-[3rem_1.25rem_1fr] pr-3", r.type === "add" && "bg-ok-tint", r.type === "del" && "bg-failed-tint")}>
                    <span className="select-none pr-2 text-right tabular-nums text-muted">{r.type === "del" ? r.a : r.b}</span>
                    <span aria-hidden className={cn("select-none text-center", r.type === "add" && "text-ok", r.type === "del" && "text-failed")}>{r.type === "add" ? "+" : r.type === "del" ? "−" : ""}</span>
                    <span className="whitespace-pre-wrap break-all"><span className="sr-only">{r.type === "add" ? "Added: " : r.type === "del" ? "Removed: " : ""}</span>{r.text || " "}</span>
                  </div>
                ))}
            </div>
          )}
      </div>
    </div>
  );
}
