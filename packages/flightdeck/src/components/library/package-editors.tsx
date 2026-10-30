import * as React from "react";
import { Search, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/utils";
import { isSamePerson, type PackageEditor, type Principal, useKnownUsers } from "@/data/ops/packages";

const label = (p: Principal) => p.displayName || p.email || p.subject || "Unknown";

/**
 * People who may publish updates to a shared package. Adding is search then click, with no form;
 * removing is one click with Undo, because both are reversible.
 */
export function PackageEditors({ editors, owner, canManage, onGrant, onRevoke }: {
  editors: PackageEditor[];
  owner: Principal | null;
  canManage: boolean;
  onGrant: (user: Principal) => Promise<unknown>;
  onRevoke: (user: Principal) => Promise<unknown>;
}) {
  const [q, setQ] = React.useState("");
  const users = useKnownUsers(canManage);
  const matches = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return (users.data ?? [])
      .filter((u) => !isSamePerson(u, owner) && !editors.some((e) => isSamePerson(e, u)))
      .filter((u) => `${u.displayName ?? ""} ${u.email ?? ""}`.toLowerCase().includes(needle))
      .slice(0, 5);
  }, [q, users.data, editors, owner]);

  const add = async (u: Principal) => {
    try { await onGrant(u); setQ(""); } catch { /* reported */ }
  };
  const remove = async (u: Principal) => {
    try {
      await onRevoke(u);
      toast(`${label(u)} can no longer publish`, { action: { label: "Undo", onClick: () => void onGrant(u) } });
    } catch { /* reported */ }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">Editors can publish new versions, switch versions and turn the package on or off. Only the owner and admins can share it, delete it or change this list.</p>
      <ul className="divide-y divide-line-subtle rounded-pane border border-line">
        {owner ? <li className="flex items-center gap-2.5 px-3 py-2"><Avatar who={owner} /><span className="min-w-0 flex-1 truncate text-sm">{label(owner)}</span><span className="text-xs text-muted">Owner</span></li> : null}
        {editors.map((e) => (
          <li key={`${e.provider}:${e.subject}`} className="flex items-center gap-2.5 px-3 py-2">
            <Avatar who={e} />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm">{label(e)}</span>{e.grantedByDisplay ? <span className="block truncate text-xs text-muted">Added by {e.grantedByDisplay}</span> : null}</span>
            <span className="text-xs text-muted">Editor</span>
            {canManage ? <Button variant="quiet" size="icon-sm" aria-label={`Remove ${label(e)} as an editor`} onClick={() => void remove(e)}><UserMinus /></Button> : null}
          </li>
        ))}
        {!editors.length ? <li className="px-3 py-2 text-sm text-muted">No editors yet. Only the owner and admins can publish.</li> : null}
      </ul>
      {canManage ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" placeholder="Add an editor by name or email" aria-label="Add an editor by name or email" role="combobox" aria-expanded={matches.length > 0} aria-autocomplete="list" autoComplete="off" />
          {q.trim() ? (
            <ul role="listbox" aria-label="People" className="mt-1 overflow-hidden rounded-pane border border-line bg-overlay shadow-pop">
              {matches.map((u) => (
                <li key={`${u.provider}:${u.subject}`} role="option" aria-selected={false}>
                  <button type="button" onClick={() => void add(u)} className="focus-inset flex min-h-9 w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-raised pointer-coarse:min-h-11"><Avatar who={u} /><span className="min-w-0 flex-1 truncate">{label(u)}</span>{u.email && u.displayName ? <span className="truncate text-xs text-muted">{u.email}</span> : null}</button>
                </li>
              ))}
              {!matches.length ? <li className="px-3 py-2 text-sm text-muted">{users.isLoading ? "Looking…" : "No one matches. They need to have signed in once."}</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Avatar({ who }: { who: Principal }) {
  return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-tint text-xs font-semibold text-accent" aria-hidden>{initials(label(who))}</span>;
}
