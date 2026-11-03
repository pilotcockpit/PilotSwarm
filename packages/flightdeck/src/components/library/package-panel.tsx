import * as React from "react";
import { Download, Globe, Lock, MoreHorizontal, Play, Replace, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, DisclosureButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Skeleton, Switch, Tag } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Markdown } from "@/components/chat";
import { DataReadNotice } from "@/components/empty";
import { useUi } from "@/shell/ui-state";
import { useAgents, useSessions } from "@/data/source";
import { creatablePackageAgents, notStartableReason } from "./package-eligibility";
import { describeManifest, manifestAgentsAsCatalog } from "./package-manifest";
import { MAKE_PRIVATE_CONSEQUENCES, TRUST_NOTE, VERSION_SWITCH_NOTE, copyIntoMine, enableCopy, updateShared } from "./package-rules";
import { composeAgents } from "@/lib/agent-composition";
import { saveBlob } from "@/lib/save-blob";
import { sessionState } from "@/data/state";
import { activeVersionIs } from "@/data/ops/undo-guards";
import { useSource } from "@/data/source";
import { adoption, describeFiles, isSamePerson, packageRights, packageSelector, usePackageActions, usePackageDetail, usePackageFile, usePackages, usePackageTree, useWorkerPackageState, type PackageSummary } from "@/data/ops/packages";
import type { Profile } from "@/data/types";
import { PackageFiles } from "./package-files";
import { PackageEditors } from "./package-editors";
import { VersionTimeline } from "./package-versions";
import { DeletePackageDialog, RepublishDialog } from "./package-actions";
import { ago, plural } from "@/lib/utils";

const Section = ({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) => (
  <section aria-label={title} className="flex flex-col gap-2">
    <div><h3 className="text-sm font-semibold">{title}</h3>{note ? <p className="mt-0.5 text-sm text-muted">{note}</p> : null}</div>
    {children}
  </section>
);

/** One package: whether it is on, what it gives agents, its versions, files and editors, and what you can do about it. */
export function PackagePanel({ pkg, onClose, profile, ownerName }: { pkg: PackageSummary; onClose: () => void; profile?: Profile | null; ownerName: string }) {
  const { source } = useSource();
  const rights = packageRights(pkg, profile);
  const detail = usePackageDetail(pkg, profile);
  const tree = usePackageTree(pkg, undefined, profile);
  const provides = React.useMemo(() => describeFiles((tree.data?.files ?? []).map((f) => f.path)), [tree.data]);
  const readme = usePackageFile(pkg, undefined, provides.readme, profile);
  const actions = usePackageActions(profile);
  const { data: everything } = usePackages();
  const workers = useWorkerPackageState(Boolean(profile?.isAdmin), everything);
  const fleet = profile?.isAdmin ? adoption(pkg, workers.data) : null;
  const copy = copyIntoMine(pkg);
  const update = updateShared(pkg, everything ?? []);
  const { openNewSession } = useUi();
  const { data: sessions } = useSessions();
  const agentCatalog = useAgents();
  const viewerOwns = isSamePerson(pkg.owner, profile);
  const launchable = creatablePackageAgents(pkg, agentCatalog.data || [], viewerOwns);
  // What the package contains comes from the manifest the server stored with the active version, not from file names.
  const contents = React.useMemo(() => describeManifest(pkg.active?.manifest), [pkg.active]);
  const startableNames = new Set(launchable.map((a) => a.name.toLowerCase()));
  const agentRows = contents.known
    ? composeAgents(manifestAgentsAsCatalog(contents, pkg.name)).map((a) => ({ name: a.name, title: a.title || a.name, depth: a.depth, parent: a.parentName, calledOnly: !a.startable, canStart: a.startable && startableNames.has(a.name.toLowerCase()) }))
    : provides.agents.map((name) => ({ name, title: name, depth: 0, parent: null as string | null, calledOnly: false, canStart: startableNames.has(name.toLowerCase()) }));
  const skillNames = contents.known ? contents.skills : provides.skills;
  const hasTools = contents.known ? contents.tools : provides.tools;
  const mcpNames = contents.known ? contents.mcpServers : provides.mcp ? ["MCP servers"] : [];
  const agentNames = agentRows.map((a) => a.name);
  const changelog = usePackageFile(pkg, undefined, provides.changelog, profile);
  const [browseVersion, setBrowseVersion] = React.useState<string | undefined>();
  const [scopeAsk, setScopeAsk] = React.useState(false);
  const [repub, setRepub] = React.useState(false);
  const [del, setDel] = React.useState(false);
  const [filesOpen, setFilesOpen] = React.useState(false);
  React.useEffect(() => { setBrowseVersion(undefined); setFilesOpen(false); }, [pkg.packageId]);

  const versions = detail.data?.versions ?? (pkg.active ? [pkg.active] : []);
  const liveSessions = (sessions ?? []).filter((s) => !s.isSystem && s.agentId && agentNames.includes(s.agentId) && ["running", "needs", "waiting"].includes(sessionState(s).key)).length;
  const editors = detail.data?.editors ?? [];
  const reasonLocked = rights.edit ? null : "Only the owner, an editor or an admin can change this package.";
  const sw = enableCopy(pkg, everything ?? []);
  const download = async () => {
    try {
      const { blob, filename } = await source.downloadPackage(pkg.name, { ...(pkg.active ? { semver: pkg.active.semver } : {}), scope: pkg.scope, ...(packageSelector(pkg, profile) as any) });
      saveBlob(blob, filename);
    } catch (e: any) { toast.error("The package could not be downloaded", { description: e?.message }); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent side="right" title={<span className="flex flex-wrap items-center gap-2"><span>{pkg.name}</span>{pkg.active ? <span className="font-mono text-sm font-normal text-muted">{pkg.active.semver}</span> : null}</span>} description={`${pkg.scope === "shared" ? "Shared with everyone" : pkg.owner && !rights.mine ? `${ownerName}'s private package` : "Private to you"} · published ${pkg.active ? ago(pkg.active.createdAt as any) : "never"}`}>
        <DialogBody className="flex flex-col gap-6 pb-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-6 flex-1 basis-56 items-start gap-3 pointer-coarse:min-h-11">
              <Switch checked={pkg.enabled} disabled={!rights.edit || actions.setEnabled.isPending} onCheckedChange={(v) => actions.setEnabled.mutate({ pkg, enabled: v })} aria-label={`${pkg.name} is available to sessions`} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{sw.label}</span>
                <span className="block text-xs text-muted">{reasonLocked ?? sw.help}</span>
              </span>
            </label>
            <Menu>
              <MenuTrigger asChild><Button aria-label={`Manage ${pkg.name}`}><MoreHorizontal /> Manage</Button></MenuTrigger>
              <MenuContent>
                {rights.owner ? (pkg.scope === "user"
                  ? <MenuItem icon={<Globe />} hint="Everyone can use it" onSelect={() => setScopeAsk(true)}>Share with everyone…</MenuItem>
                  : <MenuItem icon={<Lock />} hint="Only you can use it" onSelect={() => setScopeAsk(true)}>Make private…</MenuItem>) : null}
                {copy.available && versions.length ? <MenuItem icon={<Replace />} hint="Publish a version into your own copy, even if you cannot edit this one" onSelect={() => setRepub(true)}>Copy into my private package…</MenuItem> : null}
                {pkg.scope === "user" && rights.edit && versions.length ? <MenuItem icon={<Replace />} disabled={!update.available} hint={update.available ? "Publish a version into the shared package" : update.reason} onSelect={() => setRepub(true)}>Update the shared package…</MenuItem> : null}
                {pkg.active ? <MenuItem icon={<Download />} hint={`Version ${pkg.active.semver}`} onSelect={() => void download()}>Download package</MenuItem> : null}
                {rights.owner ? <><MenuSeparator /><MenuItem danger icon={<Trash2 />} onSelect={() => setDel(true)}>Delete package…</MenuItem></> : null}
              </MenuContent>
            </Menu>
          </div>

          {fleet?.errors.length ? (
            <Card tone="failed" className="p-3 text-sm" role="alert">
              <p className="font-semibold">{plural(fleet.errors.length, "worker")} could not install this version</p>
              <ul className="mt-1 list-disc pl-5">{fleet.errors.map((e) => <li key={e.worker}><span className="font-mono text-xs">{e.worker}</span>: {e.message}</li>)}</ul>
            </Card>
          ) : null}

          {detail.isError ? <DataReadNotice title="This package could not be read" onRetry={() => void detail.refetch()}>{(detail.error as Error)?.message}</DataReadNotice> : null}

          <Section title="What it gives agents" note={pkg.active?.manifest?.description as string | undefined}>
            {tree.isLoading && !contents.known ? <Skeleton className="h-16" /> : !agentRows.length && !skillNames.length && !hasTools && !mcpNames.length ? <p className="text-sm text-muted">{contents.known ? "This version declares no agents, skills, tools or MCP servers." : "This version does not report its contents."}</p> : (
              <div className="flex flex-col gap-3">
                {agentRows.length ? (
                  <ul className="divide-y divide-line-subtle rounded-pane border border-line">
                    {agentRows.map((a) => (
                      <li key={a.name} className="flex items-center gap-3 px-3 py-2" style={a.depth ? { paddingLeft: `${0.75 + Math.min(a.depth, 3) * 1.25}rem` } : undefined}>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{a.title}</span><span className="block text-xs text-muted">{a.calledOnly ? `Started by ${a.parent ?? "another agent"}, not on its own` : a.canStart ? "Agent" : agentCatalog.isLoading ? "Checking availability…" : notStartableReason(pkg, viewerOwns)}</span></span>
                        {a.calledOnly ? null : <Button size="sm" disabled={!a.canStart || agentCatalog.isLoading || agentCatalog.isError} onClick={() => { onClose(); openNewSession({ agent: a.name }); }}><Play /> Start session</Button>}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {agentCatalog.isError ? <DataReadNotice title="Couldn't check available agents" busy={agentCatalog.isFetching} onRetry={() => void agentCatalog.refetch()}>Try again before starting a session from this package.</DataReadNotice> : null}
                <div className="flex flex-wrap gap-1.5">
                  {skillNames.map((s) => <Tag key={`s-${s}`}>Skill · {s}</Tag>)}
                  {hasTools ? <Tag>Worker tools</Tag> : null}
                  {mcpNames.map((m) => <Tag key={`m-${m}`}>MCP · {m}</Tag>)}
                </div>
                {contents.zeroAgent ? <p className="text-sm text-muted">It defines no agents of its own, so it has no entry on the Agents tab. Start any session and ask for what you need: sessions find skills, tools and MCP servers in enabled packages. Another person&apos;s shared package is only loaded when a session is asked for it by name.</p> : null}
              </div>
            )}
          </Section>

          {provides.readme ? (
            <Section title="About">
              {readme.isLoading ? <Skeleton className="h-20" /> : <div tabIndex={0} role="region" aria-label="About this package (scrolls)" className="rounded-pane border border-line p-3 md:max-h-64 md:overflow-y-auto"><Markdown text={readme.data?.text ?? ""} /></div>}
            </Section>
          ) : null}

          {provides.changelog ? (
            <Section title="What changed">
              {changelog.isLoading ? <Skeleton className="h-20" /> : <div tabIndex={0} role="region" aria-label="Changelog (scrolls)" className="rounded-pane border border-line p-3 md:max-h-64 md:overflow-y-auto"><Markdown text={changelog.data?.text ?? ""} /></div>}
            </Section>
          ) : null}

          <Section title="Versions" note={versions.length > 1 ? `${VERSION_SWITCH_NOTE} You can undo a switch.` : undefined}>
            {detail.isLoading ? <Skeleton className="h-24" /> : <VersionTimeline pkg={pkg} versions={versions} canEdit={rights.edit} busy={actions.pin.isPending} onPin={(semver) => actions.pin.mutateAsync({ pkg, semver })} isActive={(semver) => activeVersionIs(source, packageSelector(pkg, profile), semver)()} />}
            {!rights.edit ? <p className="text-xs text-muted">{reasonLocked}</p> : null}
          </Section>

          <Section title="Files">
            <div>
              <DisclosureButton aria-expanded={filesOpen} onClick={() => setFilesOpen((v) => !v)} className="px-1 text-sm font-medium text-accent hover:underline">{filesOpen ? "Hide files" : `Browse files${tree.data ? ` (${plural(tree.data.files.length, "file")})` : ""}`}</DisclosureButton>
              {filesOpen && versions.length > 1 ? (
                <label className="ml-3 inline-flex items-center gap-2 text-xs text-muted">Version
                  <select value={browseVersion ?? ""} onChange={(e) => setBrowseVersion(e.target.value || undefined)} className="h-6 rounded-control border border-line-strong bg-surface px-1.5 text-xs text-fg pointer-coarse:h-11">
                    <option value="">Active</option>
                    {versions.map((v) => <option key={v.versionId} value={v.semver}>{v.semver}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
            {filesOpen ? <div className="mt-1"><PackageFiles pkg={pkg} semver={browseVersion} profile={profile} /></div> : null}
          </Section>

          {pkg.scope === "shared" ? (
            <Section title="Who can publish updates">
              <PackageEditors editors={editors} owner={pkg.owner} canManage={rights.owner} onGrant={(user) => actions.grant.mutateAsync({ pkg, user })} onRevoke={(user) => actions.revoke.mutateAsync({ pkg, user })} />
            </Section>
          ) : null}
          {pkg.scope === "user" ? <p className="text-sm text-muted">{rights.mine ? "Only you can see this package. To let others publish updates, share it first." : `Only ${ownerName} can see this package. You can see it as an admin.`}</p> : null}
        </DialogBody>

        <ConfirmDialog
          open={scopeAsk}
          onOpenChange={setScopeAsk}
          title={pkg.scope === "user" ? `Share ${pkg.name} with everyone?` : `Make ${pkg.name} private?`}
          description={pkg.scope === "user" ? "Anyone in this deployment will be able to start its agents and read its files." : "It stops being available to everyone else for new work."}
          consequences={pkg.scope === "user"
            ? ["You stay the owner and can make it private again.", "Fails if a shared package with this name already exists. Use Update the shared package instead.", TRUST_NOTE]
            : MAKE_PRIVATE_CONSEQUENCES}
          confirmLabel={pkg.scope === "user" ? "Share with everyone" : "Make private"}
          onConfirm={() => actions.setScope.mutateAsync({ pkg, scope: pkg.scope === "user" ? "shared" : "user" }).then(() => { if (pkg.scope === "shared") onClose(); })}
        />
        <RepublishDialog pkg={pkg} versions={versions} open={repub} onOpenChange={setRepub} onRepublish={(semver, targetScope) => actions.republish.mutateAsync({ pkg, semver, targetScope })} />
        <DeletePackageDialog pkg={pkg} versions={versions.length} liveSessions={liveSessions} open={del} onOpenChange={setDel} onDelete={() => actions.remove.mutateAsync({ pkg }).then(onClose)} />
      </DialogContent>
    </Dialog>
  );
}
