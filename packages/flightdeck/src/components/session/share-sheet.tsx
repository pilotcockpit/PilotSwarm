import * as React from "react";
import { Command } from "cmdk";
import { Check, ChevronDown, Globe, Link2, Lock, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import type { Session } from "@/data/types";
import {
  audienceLabel, personName, samePerson, useGrantShare, useKnownUsers, useRevokeShare, useSessionAccess, useSessionShares, useSetVisibility, VISIBILITY_COPY,
  type Person, type Share, type ShareAccess, type Visibility,
} from "@/data/ops/sharing";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Skeleton, Tag } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, initials } from "@/lib/utils";
import { notifyUndo } from "@/lib/undo";

const RANK: Record<Visibility, number> = { private: 0, shared_read: 1, shared_write: 2 };
const ACCESS_WORD: Record<ShareAccess, string> = { read: "Can view", write: "Can reply" };

function Avatar({ person }: { person: Person }) {
  return <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-tint text-xs font-semibold text-accent" aria-hidden>{initials(personName(person))}</span>;
}

/**
 * The Share control in the session header. Its label is the audience, so the answer to "who can see
 * this?" is on screen without opening anything: "Only you", "3 people", "Anyone can view".
 */
export function ShareButton({ session, onOpen }: { session: Session; onOpen: () => void }) {
  const { data: access } = useSessionAccess(session.sessionId);
  const { data: shares } = useSessionShares(session.sessionId, Boolean(access?.canManage));
  const label = audienceLabel(access, shares);
  const wide = label !== "Share";
  return (
    <Tooltip content={wide ? "Who can open this session" : undefined}>
      <Button aria-label={wide ? `Share. Now: ${label}` : "Share"} onClick={onOpen}>
        {access?.visibility === "private" || !access ? (shares?.length ? <Users /> : <Share2 />) : <Globe />}
        <span className="max-xl:hidden">{label}</span>
      </Button>
    </Tooltip>
  );
}

export function ShareSheet({ session, open, onOpenChange }: { session: Session; open: boolean; onOpenChange: (open: boolean) => void }) {
  const link = `${window.location.origin}/s/${session.sessionId}`;
  const { data: access, isLoading, isError } = useSessionAccess(session.sessionId);
  const manage = Boolean(access?.canManage);
  const copy = () => { void navigator.clipboard?.writeText(link); toast.success("Link copied", { description: "People still need access to open it." }); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" title={`Share “${session.title || "Untitled session"}”`} description="Everyone with access can open this session and its sub-agents.">
        <DialogBody className="flex flex-col gap-5">
          <div className="flex gap-2">
            <Input readOnly value={link} aria-label="Session link" className="min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button className="shrink-0" onClick={copy}><Link2 /> Copy link</Button>
          </div>
          {isLoading ? <Skeleton className="h-40" /> : isError || !access ? (
            <p role="alert" className="text-sm text-failed">Couldn't read who has access. Close this and try again.</p>
          ) : manage ? <ManagePanel session={session} /> : <ViewerPanel session={session} />}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** Someone who cannot change sharing: say who owns it, what they may do and why. No dead buttons. */
function ViewerPanel({ session }: { session: Session }) {
  const { data: access } = useSessionAccess(session.sessionId);
  if (!access) return null;
  const why = access.visibility === "private"
    ? "The owner shared it with you directly."
    : access.visibility === "shared_read"
      ? "The owner lets anyone signed in here view it."
      : "The owner lets anyone signed in here view and reply.";
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="share-you">
        <h3 id="share-you" className="mb-1.5 text-sm font-semibold">Your access</h3>
        <Card className="p-3 text-sm">
          <p className="font-medium">{access.canWrite ? "You can view and reply" : "You can view only"}</p>
          <p className="mt-0.5 text-muted">{why}{access.canWrite ? "" : " Ask the owner if you need to reply."}</p>
        </Card>
      </section>
      {access.owner ? (
        <section aria-labelledby="share-owner">
          <h3 id="share-owner" className="mb-1.5 text-sm font-semibold">Owner</h3>
          <div className="flex items-center gap-2.5"><Avatar person={access.owner} /><div className="min-w-0"><div className="truncate text-sm">{personName(access.owner)}</div>{access.owner.email ? <div className="truncate text-xs text-muted">{access.owner.email}</div> : null}</div></div>
        </section>
      ) : null}
      <p className="text-xs text-muted">Only the owner or an admin can see who else has access or change it.</p>
    </div>
  );
}

function ManagePanel({ session }: { session: Session }) {
  const id = session.sessionId;
  const { data: access } = useSessionAccess(id);
  const { data: shares, isLoading } = useSessionShares(id, true);
  const grant = useGrantShare(id);
  const revoke = useRevokeShare(id);
  const setVisibility = useSetVisibility(id);
  const [widen, setWiden] = React.useState<Visibility | null>(null);
  const visibility = access?.visibility || "private";
  const rows = shares || [];

  const addPerson = (user: Person) => {
    grant.mutate({ user, access: "read" }, {
      onSuccess: () => notifyUndo(`${personName(user)} can view this session`, () => revoke.mutate(user)),
    });
  };
  const changeRole = (share: Share, next: ShareAccess) => {
    if (share.access === next) return;
    const prev = share.access;
    grant.mutate({ user: share, access: next }, {
      onSuccess: () => notifyUndo(`${personName(share)}: ${ACCESS_WORD[next].toLowerCase()}`, () => grant.mutate({ user: share, access: prev })),
    });
  };
  const removePerson = (share: Share) => {
    revoke.mutate(share, {
      onSuccess: () => notifyUndo(`Removed ${personName(share)}`, () => grant.mutate({ user: share, access: share.access })),
    });
  };
  const choose = (next: Visibility) => {
    if (next === visibility) return;
    if (RANK[next] > RANK[visibility]) { setWiden(next); return; }
    const prev = visibility;
    setVisibility.mutate(next, {
      onSuccess: () => notifyUndo(next === "private" ? "Now only people you add can open it" : "Replies are off for everyone else", () => setVisibility.mutate(prev)),
    });
  };

  return (
    <>
      <section aria-labelledby="share-people" className="flex flex-col gap-3">
        <h3 id="share-people" className="text-sm font-semibold">People with access</h3>
        <PersonPicker exclude={[...rows, ...(access?.owner ? [access.owner] : [])]} onPick={addPerson} />
        <ul className="flex flex-col">
          {access?.owner ? (
            <li className="flex min-h-11 items-center gap-2.5 border-t border-line-subtle py-1.5 first:border-t-0">
              <Avatar person={access.owner} />
              <div className="min-w-0 flex-1"><div className="truncate text-sm">{personName(access.owner)}</div>{access.owner.email ? <div className="truncate text-xs text-muted">{access.owner.email}</div> : null}</div>
              <Tag>Owner</Tag>
            </li>
          ) : null}
          {isLoading ? <li className="py-2"><Skeleton className="h-8" /></li> : rows.map((share) => (
            <li key={`${share.provider}:${share.subject}`} className="flex min-h-11 items-center gap-2.5 border-t border-line-subtle py-1.5">
              <Avatar person={share} />
              <div className="min-w-0 flex-1"><div className="truncate text-sm">{personName(share)}</div>{share.email && share.displayName ? <div className="truncate text-xs text-muted">{share.email}</div> : null}</div>
              <Menu>
                <MenuTrigger asChild><Button size="sm" variant="quiet" aria-label={`${personName(share)}: ${ACCESS_WORD[share.access]}. Change`}>{ACCESS_WORD[share.access]} <ChevronDown /></Button></MenuTrigger>
                <MenuContent className="w-64">
                  <MenuItem icon={share.access === "read" ? <Check /> : <span />} hint="Reads the conversation, canvases and files" onSelect={() => changeRole(share, "read")}>Can view</MenuItem>
                  <MenuItem icon={share.access === "write" ? <Check /> : <span />} hint="Also sends messages, answers questions, steers" onSelect={() => changeRole(share, "write")}>Can reply</MenuItem>
                  <MenuSeparator />
                  <MenuItem danger onSelect={() => removePerson(share)}>Remove access</MenuItem>
                </MenuContent>
              </Menu>
            </li>
          ))}
        </ul>
        {!isLoading && !rows.length ? <p className="text-sm text-muted">Only you can open this session. Add people above, or open it up to everyone below.</p> : null}
      </section>

      <section aria-labelledby="share-general" className="flex flex-col gap-2">
        <h3 id="share-general" className="text-sm font-semibold">Everyone else</h3>
        <div role="radiogroup" aria-labelledby="share-general" className="flex flex-col gap-2">
          {(Object.keys(VISIBILITY_COPY) as Visibility[]).map((v) => {
            const selected = v === visibility;
            const Icon = v === "private" ? Lock : Globe;
            return (
              <Card
                key={v}
                as="div"
                interactive
                selected={selected}
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => choose(v)}
                onKeyDown={(e) => {
                  const order = Object.keys(VISIBILITY_COPY) as Visibility[];
                  const i = order.indexOf(visibility);
                  if (e.key === " " || e.key === "Enter") { e.preventDefault(); choose(v); }
                  if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); choose(order[Math.min(order.length - 1, i + 1)]); }
                  if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); choose(order[Math.max(0, i - 1)]); }
                }}
                className="flex items-start gap-2.5 p-3"
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", selected ? "text-accent" : "text-muted")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{VISIBILITY_COPY[v].label}</span>
                  <span className="block text-xs text-muted">{VISIBILITY_COPY[v].detail}</span>
                </span>
                {selected ? <Check className="size-4 shrink-0 text-accent" aria-label="Selected" /> : null}
              </Card>
            );
          })}
        </div>
      </section>

      <ConfirmDialog
        open={widen != null}
        onOpenChange={(o) => !o && setWiden(null)}
        title={widen === "shared_write" ? "Let anyone view and reply?" : "Let anyone view this session?"}
        description={widen ? VISIBILITY_COPY[widen].detail : undefined}
        consequences={["It includes this session's sub-agents, canvases and files.", "You can narrow it again at any time."]}
        confirmLabel={widen === "shared_write" ? "Allow replies" : "Allow viewing"}
        onConfirm={async () => { if (widen) await setVisibility.mutateAsync(widen); }}
      />
    </>
  );
}

/**
 * Search the member directory and add on pick: one step, default role "Can view", changed in the
 * list. Suggestions open under the field only while it is in use, so the list below never jumps.
 */
function PersonPicker({ exclude, onPick }: { exclude: Person[]; onPick: (p: Person) => void }) {
  const { data: users, isLoading } = useKnownUsers(true);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const candidates = (users || []).filter((u) => !exclude.some((e) => samePerson(e, u)));
  return (
    <Command
      label="Add people"
      shouldFilter
      className="relative"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); }
        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) setOpen(true);
      }}
    >
      <Command.Input
        value={query}
        onClick={() => setOpen(true)}
        onValueChange={(v) => { setQuery(v); setOpen(true); }}
        placeholder="Add people by name or email"
        className="h-control w-full rounded-control border border-line-strong bg-surface px-2.5 text-sm text-fg outline-none placeholder:text-faint focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
      />
      <Command.List
        hidden={!open}
        onMouseDown={(e) => e.preventDefault()}
        className="absolute inset-x-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-control border border-line bg-overlay p-1 shadow-pop data-[hidden=true]:hidden"
      >
        {isLoading ? <div className="px-2.5 py-2 text-sm text-muted">Loading people…</div> : null}
        <Command.Empty className="px-2.5 py-3 text-sm text-muted">No one matches. Only people who have signed in here can be added.</Command.Empty>
        {candidates.map((u) => (
          <Command.Item
            key={`${u.provider}:${u.subject}`}
            value={`${personName(u)} ${u.email || ""}`}
            onSelect={() => { onPick(u); setQuery(""); setOpen(false); }}
            className="flex min-h-9 cursor-default items-center gap-2.5 rounded-control px-2 text-sm outline-none pointer-coarse:min-h-11 data-[selected=true]:bg-accent-tint"
          >
            <Avatar person={u} />
            <span className="min-w-0 flex-1 truncate">{personName(u)}</span>
            {u.email && u.displayName ? <span className="min-w-0 max-w-[45%] truncate text-xs text-muted">{u.email}</span> : null}
          </Command.Item>
        ))}
      </Command.List>
    </Command>
  );
}
