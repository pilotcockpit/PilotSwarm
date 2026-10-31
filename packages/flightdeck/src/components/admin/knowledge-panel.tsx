import * as React from "react";
import { ChevronRight, MoreHorizontal, Plus, Search } from "lucide-react";
import { EmptyState, Panel, SectionTitle } from "@/components/empty";
import { Button, DisclosureButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Skeleton, Tag } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/tabs";
import { StatusRow } from "@/components/admin/status-row";
import { TypedConfirmDialog } from "@/components/admin/typed-confirm";
import { factNamespaceLabel, useDeleteNamespace, useEmbedder, useFactSearch, useFactsCapabilities, useForcePurge, useNamespaces, useSharedFactsStats, useStartEmbedder, useStopEmbedder, useTombstones, useUpsertNamespace, type FoundFact, type GraphNamespace, type SearchMode } from "@/data/ops/knowledge";
import { ago, bytes, cn, plural } from "@/lib/utils";

/**
 * Admin > Knowledge. The page leads with whether the knowledge store is healthy (is search working, is the
 * embedder running, is anything stuck), then what is in it, the graph built from it, and a box to look
 * something up. Only what this store can actually do is shown; the rest says why it is missing.
 */
export function KnowledgeHealth() {
  const caps = useFactsCapabilities();
  if (caps.isLoading) return <Skeleton className="h-64" />;
  if (caps.error || !caps.data) {
    return <Panel><EmptyState title="Knowledge isn't available">{(caps.error as any)?.message || "This deployment has no facts store configured."}</EmptyState></Panel>;
  }
  const c = caps.data;
  return (
    <div className="flex flex-col gap-6">
      <HealthRows hasEmbedder={c.embedder} search={c.search} />
      <SharedStats />
      {c.graph ? <Namespaces /> : <section><SectionTitle>Graph</SectionTitle><Panel><EmptyState title="No graph configured">Facts are stored and searchable, but no graph is built from them on this deployment.</EmptyState></Panel></section>}
      <LookUp canSearchByMeaning={c.embedder} />
    </div>
  );
}

function age(seconds: number | null) {
  if (seconds == null) return "";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} minutes`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} hours`;
  return `${Math.round(seconds / 86_400)} days`;
}

function HealthRows({ hasEmbedder, search }: { hasEmbedder: boolean; search: boolean }) {
  const embedder = useEmbedder(hasEmbedder);
  const tomb = useTombstones();
  const start = useStartEmbedder();
  const stop = useStopEmbedder();
  const [confirmStop, setConfirmStop] = React.useState(false);
  const [purge, setPurge] = React.useState(false);
  const e = embedder.data;
  const t = tomb.data;
  return (
    <Panel enter>
      <StatusRow
        state={search ? "running" : "waiting"}
        title={search ? "Search is on" : "Keyword lookup only"}
        detail={hasEmbedder ? "Agents can find facts by words and by meaning." : "This store has no embedder, so searches match words, not meaning."}
      />
      {hasEmbedder ? (
        e?.supported === false ? (
          <StatusRow state="completed" title="No embedder on this store" detail="Meaning-based search needs an enhanced facts store." />
        ) : (
          <StatusRow
            state={e?.running ? "running" : "waiting"}
            title={embedder.isLoading ? "Checking the embedder…" : e?.running ? "Embedder is running" : "Embedder is stopped"}
            detail={e?.running ? "New and changed facts are turned into searchable vectors in the background." : "Meaning-based search only finds facts embedded before it stopped. New facts are found by words until you start it."}
            action={e ? (e.running
              ? <Button size="sm" onClick={() => setConfirmStop(true)} disabled={stop.isPending}>Stop</Button>
              : <Button size="sm" variant="primary" onClick={() => start.mutate(undefined as never)} disabled={start.isPending}>Start</Button>) : null}
          />
        )
      ) : null}
      {t ? (
        t.pendingTotal === 0 ? (
          <StatusRow state="running" title="Nothing is waiting to be cleaned up" detail="Deleted facts are swept automatically once the graph has read them." />
        ) : (
          <StatusRow
            state={t.unreconciled > 0 ? "waiting" : "completed"}
            title={`${plural(t.pendingTotal, "deleted fact")} waiting to be cleaned up`}
            detail={<>{t.unreconciled} not read by the graph yet{t.oldestUnreconciledAgeSeconds != null ? ` (oldest ${age(t.oldestUnreconciledAgeSeconds)})` : ""}, {t.ttlBlocked} held by the safety window. They are swept automatically; purge now only to free space or if the graph reader is stuck.</>}
            action={<Button size="sm" onClick={() => setPurge(true)}>Purge…</Button>}
          />
        )
      ) : null}
      <ConfirmDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title="Stop the embedder?"
        description="Facts added from now on won't be searchable by meaning until it is started again."
        consequences={["Keyword search keeps working.", "Existing embeddings are kept."]}
        confirmLabel="Stop embedder"
        onConfirm={() => stop.mutateAsync(undefined as never)}
      />
      {t ? <PurgeDialog open={purge} onOpenChange={setPurge} unreconciled={t.unreconciled} total={t.pendingTotal} /> : null}
    </Panel>
  );
}

function PurgeDialog({ open, onOpenChange, unreconciled, total }: { open: boolean; onOpenChange: (o: boolean) => void; unreconciled: number; total: number }) {
  const purge = useForcePurge();
  const [scope, setScope] = React.useState<"unreconciled" | "all">("unreconciled");
  const [hours, setHours] = React.useState("6");
  const [prefix, setPrefix] = React.useState("");
  const upTo = scope === "unreconciled" ? unreconciled : total;
  return (
    <TypedConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Purge deleted facts now"
      description="Permanently removes soft-deleted facts instead of waiting for the automatic sweep."
      phrase="purge"
      confirmLabel={`Purge up to ${upTo}`}
      consequences={[
        `Removes up to ${plural(upTo, "fact")} deleted more than ${hours} ${Number(hours) === 1 ? "hour" : "hours"} ago${prefix ? ` under “${prefix}”` : ""}. This can't be undone.`,
        scope === "all" ? "Includes facts the graph has already read, which would have been swept anyway." : "The graph never learns these were deleted, so evidence built from them can linger until its next full rebuild.",
      ]}
      onConfirm={() => purge.mutateAsync({ olderThanHours: Number(hours), onlyUnreconciled: scope === "unreconciled", keyPrefix: prefix.trim() || undefined })}
    >
      <Segmented
        label="Which deleted facts"
        value={scope}
        onChange={setScope}
        options={[{ value: "unreconciled", label: `Not read by the graph (${unreconciled})` }, { value: "all", label: `All deleted (${total})` }]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Deleted more than"><SelectHours value={hours} onChange={setHours} /></Field>
        <Field label="Only keys starting with" hint="Optional"><Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="skills/" autoComplete="off" /></Field>
      </div>
    </TypedConfirmDialog>
  );
}

function SelectHours({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-control w-full rounded-control border border-line-strong bg-surface px-2 text-sm text-fg focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent">
      <option value="1">1 hour ago</option>
      <option value="6">6 hours ago</option>
      <option value="24">1 day ago</option>
      <option value="168">7 days ago</option>
    </select>
  );
}

function SharedStats() {
  const { data, isLoading } = useSharedFactsStats();
  if (isLoading) return <Skeleton className="h-28" />;
  const rows = (data || []).filter((r) => r.factCount > 0);
  const total = rows.reduce((n, r) => n + r.factCount, 0);
  return (
    <section aria-label="Shared knowledge">
      <SectionTitle count={total}>Shared knowledge</SectionTitle>
      <Panel enter>
        {rows.length ? rows.map((r) => (
          <div key={r.namespace} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 border-t border-line-subtle px-4 py-2.5 text-sm first:border-t-0">
            <span className="font-medium max-sm:basis-full sm:min-w-40 sm:flex-1">{factNamespaceLabel(r.namespace)}</span>
            <span className="tabular-nums">{plural(r.factCount, "fact")}</span>
            <span className="w-20 text-right tabular-nums text-muted">{bytes(r.totalValueBytes)}</span>
            <span className="w-28 whitespace-nowrap text-right text-xs text-faint">{r.newestUpdatedAt ? `updated ${ago(r.newestUpdatedAt)}` : ""}</span>
          </div>
        )) : <EmptyState title="No shared facts yet">Facts agents store for everyone to reuse appear here.</EmptyState>}
      </Panel>
    </section>
  );
}

function Namespaces() {
  const { data, isLoading } = useNamespaces();
  const [editing, setEditing] = React.useState<GraphNamespace | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<GraphNamespace | null>(null);
  const remove = useDeleteNamespace();
  return (
    <section aria-label="Graph namespaces">
      <SectionTitle count={data?.length} action={<Button size="sm" onClick={() => setEditing("new")}><Plus /> Add</Button>}>Graph namespaces</SectionTitle>
      {isLoading ? <Skeleton className="h-32" /> : (
        <Panel enter>
          {data?.length ? data.map((n) => (
            <div key={n.namespace} className="flex items-start gap-3 border-t border-line-subtle px-4 py-3 first:border-t-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{n.frontmatter?.name || n.namespace}</span>
                  <span className="font-mono text-xs text-muted">{n.namespace}</span>
                  {n.archived ? <Tag>Archived</Tag> : null}
                </div>
                <p className="mt-0.5 max-w-[68ch] text-sm text-muted">{n.frontmatter?.description}</p>
                <p className="mt-1 text-xs tabular-nums text-faint">{n.nodeCount != null ? `${n.nodeCount.toLocaleString()} nodes · ${(n.edgeCount ?? 0).toLocaleString()} edges` : "Counts unavailable"}{n.updatedAt ? ` · updated ${ago(n.updatedAt)}` : ""}</p>
              </div>
              <Menu>
                <MenuTrigger asChild><Button variant="quiet" size="icon-sm" aria-label={`Actions for ${n.namespace}`}><MoreHorizontal /></Button></MenuTrigger>
                <MenuContent>
                  <MenuItem onSelect={() => setEditing(n)}>Edit description</MenuItem>
                  <MenuItem danger onSelect={() => setDeleting(n)}>Delete…</MenuItem>
                </MenuContent>
              </Menu>
            </div>
          )) : <EmptyState title="No namespaces yet" action={<Button onClick={() => setEditing("new")}><Plus /> Add a namespace</Button>}>A namespace is a corpus agents can search as a graph. Describe when to use it so agents pick the right one.</EmptyState>}
        </Panel>
      )}
      {editing ? <NamespaceDialog key={editing === "new" ? "new" : editing.namespace} target={editing} onClose={() => setEditing(null)} existing={(data || []).map((n) => n.namespace)} /> : null}
      {deleting ? (
        <TypedConfirmDialog
          open
          onOpenChange={(o) => !o && setDeleting(null)}
          title={`Delete ${deleting.namespace}?`}
          phrase={deleting.namespace}
          confirmLabel="Delete namespace"
          consequences={[
            deleting.nodeCount != null ? `Removes the namespace and its ${plural(deleting.nodeCount, "node")} and ${plural(deleting.edgeCount ?? 0, "edge")}.` : "Removes the namespace and everything in it.",
            "The facts it was built from are not deleted.",
            "This can't be undone.",
          ]}
          onConfirm={() => remove.mutateAsync({ namespace: deleting.namespace })}
        />
      ) : null}
    </section>
  );
}

const NAMESPACE_ID = /^[a-z0-9][a-z0-9/_-]*$/;

function NamespaceDialog({ target, onClose, existing }: { target: GraphNamespace | "new"; onClose: () => void; existing: string[] }) {
  const edit = target !== "new" ? target : null;
  const save = useUpsertNamespace();
  const [id, setId] = React.useState(edit?.namespace || "");
  const [name, setName] = React.useState(edit?.frontmatter?.name || "");
  const [description, setDescription] = React.useState(edit?.frontmatter?.description || "");
  const idError = !edit && id ? (!NAMESPACE_ID.test(id) ? "Use lowercase letters, numbers, / _ and -." : existing.includes(id) ? "That namespace already exists." : null) : null;
  const ready = Boolean(id && description.trim() && !idError);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={edit ? `Edit ${edit.namespace}` : "Add a namespace"} description="A namespace is a corpus agents can search as a graph.">
        <form onSubmit={(e) => { e.preventDefault(); if (ready) save.mutate({ namespace: id, name: name.trim(), description: description.trim() }, { onSuccess: onClose }); }}>
          <DialogBody className="flex flex-col gap-3">
            <Field label="Namespace" hint="The id agents use, like acme/services. Can't be changed later." error={idError}>
              <Input value={id} onChange={(e) => setId(e.target.value.trim())} readOnly={Boolean(edit)} disabled={Boolean(edit)} className="font-mono" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Name" hint="Optional. A friendlier label."><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></Field>
            <Field label="When should an agent use it?" hint="Agents read this to choose between namespaces."><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!ready || save.isPending}>{edit ? "Save" : "Add namespace"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function preview(v: unknown) {
  const text = typeof v === "string" ? v : JSON.stringify(v);
  return text.length > 180 ? `${text.slice(0, 180)}…` : text;
}

function LookUp({ canSearchByMeaning }: { canSearchByMeaning: boolean }) {
  const [draft, setDraft] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<SearchMode>("hybrid");
  const results = useFactSearch(query, mode);
  return (
    <section aria-label="Look something up">
      <SectionTitle>Look something up</SectionTitle>
      <Panel enter>
        <form className="flex flex-col gap-3 p-4" onSubmit={(e) => { e.preventDefault(); setQuery(draft); }} role="search">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative block min-w-56 flex-1">
              <span className="sr-only">Search shared facts</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What do the agents know about…" className="pl-8" autoComplete="off" />
            </label>
            <Button type="submit" disabled={!draft.trim()}>Search</Button>
          </div>
          <Segmented
            label="How to match"
            value={mode}
            onChange={setMode}
            options={[
              { value: "hybrid", label: "Best match" },
              { value: "lexical", label: "Exact words" },
              { value: "semantic", label: "Meaning", disabled: !canSearchByMeaning, title: canSearchByMeaning ? undefined : "Needs the embedder" },
            ]}
          />
        </form>
        {query ? (
          <div className="border-t border-line">
            {results.isLoading ? <div className="p-4"><Skeleton className="h-16" /></div> : results.error ? <p className="p-4 text-sm text-failed">{(results.error as any)?.message || "The search failed."}</p> : results.data?.length ? results.data.map((f) => <FactResult key={f.scopeKey} fact={f} />) : <EmptyState title="No facts match">Try fewer words, or switch to Best match.</EmptyState>}
          </div>
        ) : null}
      </Panel>
    </section>
  );
}

function FactResult({ fact }: { fact: FoundFact }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border-t border-line-subtle px-4 py-2.5 first:border-t-0">
      <DisclosureButton aria-expanded={open} onClick={() => setOpen((v) => !v)} className="w-full gap-2 text-sm">
        <ChevronRight className={cn("size-3.5 shrink-0 text-muted transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden />
        <span className="min-w-0 flex-1 truncate font-mono text-sm">{fact.key}</span>
        {fact.score != null ? <span className="shrink-0 text-xs tabular-nums text-faint">{Math.round(fact.score * 100)}%</span> : null}
      </DisclosureButton>
      {!open ? <p className="ml-5.5 truncate text-sm text-muted">{preview(fact.value)}</p> : <pre className="ml-5.5 mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-control bg-raised p-2.5 font-mono text-xs">{typeof fact.value === "string" ? fact.value : JSON.stringify(fact.value, null, 2)}</pre>}
      <p className="ml-5.5 mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-faint">
        {fact.tags?.map((t) => <Tag key={t}>{t}</Tag>)}
        {fact.agentId ? <span>by {fact.agentId}</span> : null}
        <span>updated {ago(fact.updatedAt)}</span>
      </p>
    </div>
  );
}
