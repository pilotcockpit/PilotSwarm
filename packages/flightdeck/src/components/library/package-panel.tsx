import * as React from "react";
import { Globe, Lock, MoreHorizontal, Play, Replace, Trash2 } from "lucide-react";
import { Button, DisclosureButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Skeleton, Switch, Tag } from "@/components/ui/misc";
import { Markdown } from "@/components/chat";
import { DataReadNotice } from "@/components/empty";
import { useUi } from "@/shell/ui-state";
import { useSessions } from "@/data/source";
import { sessionState } from "@/data/state";
import { describeFiles, packageRights, usePackageActions, usePackageDetail, usePackageFile, usePackages, usePackageTree, type PackageSummary } from "@/data/ops/packages";
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
  const rights = packageRights(pkg, profile);
  const detail = usePackageDetail(pkg, profile);
  const tree = usePackageTree(pkg, undefined, profile);
  const provides = React.useMemo(() => describeFiles((tree.data?.files ?? []).map((f) => f.path)), [tree.data]);
  const readme = usePackageFile(pkg, undefined, provides.readme, profile);
  const actions = usePackageActions(profile);
  const { data: everything } = usePackages();
  // Updating the shared package needs one to exist; copying a shared one into your own is always possible.
  const canRepublish = pkg.scope === "shared" || Boolean(everything?.some((p) => p.scope === "shared" && p.name === pkg.name));
  const { openNewSession } = useUi();
  const { data: sessions } = useSessions();
  const [browseVersion, setBrowseVersion] = React.useState<string | undefined>();
  const [scopeAsk, setScopeAsk] = React.useState(false);
  const [repub, setRepub] = React.useState(false);
  const [del, setDel] = React.useState(false);
  const [filesOpen, setFilesOpen] = React.useState(false);
  React.useEffect(() => { setBrowseVersion(undefined); setFilesOpen(false); }, [pkg.packageId]);

  const versions = detail.data?.versions ?? (pkg.active ? [pkg.active] : []);
  const liveSessions = (sessions ?? []).filter((s) => !s.isSystem && s.agentId && provides.agents.includes(s.agentId) && ["running", "needs", "waiting"].includes(sessionState(s).key)).length;
  const editors = detail.data?.editors ?? [];
  const reasonLocked = rights.edit ? null : "Only the owner, an editor or an admin can change this package.";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent side="right" title={<span className="flex flex-wrap items-center gap-2"><span>{pkg.name}</span>{pkg.active ? <span className="font-mono text-sm font-normal text-muted">{pkg.active.semver}</span> : null}</span>} description={`${pkg.scope === "shared" ? "Shared with everyone" : pkg.owner && !rights.mine ? `${ownerName}'s private package` : "Private to you"} · published ${pkg.active ? ago(pkg.active.createdAt as any) : "never"}`}>
        <DialogBody className="flex flex-col gap-6 pb-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-6 flex-1 basis-56 items-start gap-3 pointer-coarse:min-h-11">
              <Switch checked={pkg.enabled} disabled={!rights.edit || actions.setEnabled.isPending} onCheckedChange={(v) => actions.setEnabled.mutate({ pkg, enabled: v })} aria-label={`${pkg.name} is available to sessions`} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{pkg.enabled ? "Available to sessions" : "Turned off"}</span>
                <span className="block text-xs text-muted">{reasonLocked ?? (pkg.enabled ? "Workers pick up changes in about 20 seconds." : "Its agents, skills and tools are hidden from new work.")}</span>
              </span>
            </label>
            {rights.edit || rights.owner ? (
              <Menu>
                <MenuTrigger asChild><Button aria-label={`Manage ${pkg.name}`}><MoreHorizontal /> Manage</Button></MenuTrigger>
                <MenuContent>
                  {rights.owner ? (pkg.scope === "user"
                    ? <MenuItem icon={<Globe />} hint="Everyone can use it" onSelect={() => setScopeAsk(true)}>Share with everyone…</MenuItem>
                    : <MenuItem icon={<Lock />} hint="Only you can use it" onSelect={() => setScopeAsk(true)}>Make private…</MenuItem>) : null}
                  {rights.edit && canRepublish && versions.length ? <MenuItem icon={<Replace />} hint={pkg.scope === "user" ? "Publish a version into the shared package" : "Publish a version into your own copy"} onSelect={() => setRepub(true)}>{pkg.scope === "user" ? "Update the shared package…" : "Copy into my private package…"}</MenuItem> : null}
                  {rights.owner ? <><MenuSeparator /><MenuItem danger icon={<Trash2 />} onSelect={() => setDel(true)}>Delete package…</MenuItem></> : null}
                </MenuContent>
              </Menu>
            ) : null}
          </div>

          {detail.isError ? <DataReadNotice title="This package could not be read" onRetry={() => void detail.refetch()}>{(detail.error as Error)?.message}</DataReadNotice> : null}

          <Section title="What it gives agents" note={pkg.active?.manifest?.description as string | undefined}>
            {tree.isLoading ? <Skeleton className="h-16" /> : !provides.agents.length && !provides.skills.length && !provides.tools && !provides.mcp ? <p className="text-sm text-muted">Nothing readable in the files yet.</p> : (
              <div className="flex flex-col gap-3">
                {provides.agents.length ? (
                  <ul className="divide-y divide-line-subtle rounded-pane border border-line">
                    {provides.agents.map((a) => (
                      <li key={a} className="flex items-center gap-3 px-3 py-2">
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{a}</span><span className="block text-xs text-muted">Agent</span></span>
                        <Button size="sm" disabled={!pkg.enabled} title={pkg.enabled ? undefined : "Turn the package on to start sessions"} onClick={() => { onClose(); openNewSession({ agent: a }); }}><Play /> Start session</Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {provides.skills.map((s) => <Tag key={s}>Skill · {s}</Tag>)}
                  {provides.tools ? <Tag>Worker tools</Tag> : null}
                  {provides.mcp ? <Tag>MCP servers</Tag> : null}
                </div>
              </div>
            )}
          </Section>

          {provides.readme ? (
            <Section title="About">
              {readme.isLoading ? <Skeleton className="h-20" /> : <div className="rounded-pane border border-line p-3 md:max-h-64 md:overflow-y-auto"><Markdown text={readme.data?.text ?? ""} /></div>}
            </Section>
          ) : null}

          <Section title="Versions" note={versions.length > 1 ? "Switching is instant for new work. Running turns finish first, and you can undo it." : undefined}>
            {detail.isLoading ? <Skeleton className="h-24" /> : <VersionTimeline pkg={pkg} versions={versions} canEdit={rights.edit} busy={actions.pin.isPending} onPin={(semver) => actions.pin.mutateAsync({ pkg, semver })} />}
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
          description={pkg.scope === "user" ? "Anyone in this deployment will be able to start its agents and read its files." : "It stops being available to everyone else."}
          consequences={pkg.scope === "user"
            ? ["You stay the owner and can make it private again.", "Fails if a shared package with this name already exists. Use Update the shared package instead."]
            : ["Editors lose access.", liveSessions ? `${plural(liveSessions, "session")} of yours use its agents and keep running.` : "Other people's sessions that use its agents fail on their next turn."]}
          confirmLabel={pkg.scope === "user" ? "Share with everyone" : "Make private"}
          onConfirm={() => actions.setScope.mutateAsync({ pkg, scope: pkg.scope === "user" ? "shared" : "user" }).then(() => { if (pkg.scope === "shared") onClose(); })}
        />
        <RepublishDialog pkg={pkg} versions={versions} open={repub} onOpenChange={setRepub} onRepublish={(semver, targetScope) => actions.republish.mutateAsync({ pkg, semver, targetScope })} />
        <DeletePackageDialog pkg={pkg} versions={versions.length} liveSessions={liveSessions} open={del} onOpenChange={setDel} onDelete={() => actions.remove.mutateAsync({ pkg }).then(onClose)} />
      </DialogContent>
    </Dialog>
  );
}
