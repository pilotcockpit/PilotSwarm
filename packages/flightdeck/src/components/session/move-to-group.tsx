import * as React from "react";
import { Command } from "cmdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { ProjectIcon } from "@/components/project-icon";
import type { Session } from "@/data/types";
import { useCreateGroup, useGroupOptions, usePlaceInGroup } from "@/data/ops/groups";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { notifyUndo } from "@/lib/undo";

/** Which group a session sits in right now: this tab's own placement first, then what the list says. */
export function useCurrentGroupId(session: Session): string | null {
  // Reactive on purpose: moving writes the key, and every reader (menu hint, dialog check) follows.
  const { data: placed } = useQuery<string | null>({ queryKey: ["groups", "placement", session.sessionId], queryFn: () => null, enabled: false, staleTime: Infinity });
  return placed !== undefined ? placed : ((session.groupId ?? (session as any).viewerGroupId ?? null) as string | null);
}

/**
 * Move a session to a group in one step: type to search, press Enter to move, or type a new name
 * and choose Create. Moving is private to you and changes nothing for anyone else, so there is no
 * confirmation, only an undo.
 */
export function MoveToGroupDialog({ session, open, onOpenChange }: { session: Session; open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const { data: groups, isLoading } = useGroupOptions(open);
  const create = useCreateGroup();
  const place = usePlaceInGroup();
  const current = useCurrentGroupId(session);
  const [query, setQuery] = React.useState("");
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (!open) setQuery(""); }, [open]);
  const typed = query.trim();
  const exact = (groups || []).some((g) => g.name.toLowerCase() === typed.toLowerCase());
  const treeNote = session.parentSessionId ? "This is a sub-agent: its whole session tree moves with it." : null;

  const move = (groupId: string | null, name: string) => {
    const previous = current;
    place.mutate({ groupId, sessionIds: [session.sessionId] }, {
      onSuccess: () => {
        qc.setQueryData(["groups", "placement", session.sessionId], groupId);
        onOpenChange(false);
        notifyUndo(groupId ? `Moved to ${name}` : "Taken out of its project", () => place.mutate({ groupId: previous, sessionIds: [session.sessionId] }, { onSuccess: () => qc.setQueryData(["groups", "placement", session.sessionId], previous) }), { description: session.title, resource: `group:${session.sessionId}` });
      },
    });
  };
  const createAndMove = () => {
    create.mutate({ title: typed }, { onSuccess: (g: any) => move(String(g?.groupId ?? g?.id), String(g?.title ?? typed)) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Move to project" onOpenAutoFocus={(e) => { e.preventDefault(); input.current?.focus(); }} description={treeNote || "Projects are your own way to sort sessions. Nobody else sees them."}>
        <Command label="Move to project" className="flex max-h-[60vh] flex-col px-5 pb-4 pt-2">
          <Command.Input
            ref={input}
            value={query}
            onValueChange={setQuery}
            placeholder="Search projects, or name a new one"
            className="h-control w-full rounded-control border border-line-strong bg-surface px-2.5 text-sm text-fg outline-none placeholder:text-faint focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
          />
          <Command.List className="mt-2 min-h-0 flex-1 overflow-y-auto">
            {isLoading ? <div className="px-2.5 py-3 text-sm text-muted">Loading projects…</div> : null}
            {!isLoading && !groups?.length && !typed ? <div className="px-2.5 py-3 text-sm text-muted">You have no projects yet. Type a name to make the first one.</div> : null}
            {(groups || []).map((g) => (
              <Item key={g.id} value={g.name} onSelect={() => g.id !== current && move(g.id, g.name)}>
                <ProjectIcon className="text-muted" />
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
                {g.count != null ? <span className="text-xs tabular-nums text-faint">{g.count}</span> : null}
                {g.id === current ? <Check className="size-4 text-accent" aria-label="Current project" /> : null}
              </Item>
            ))}
            {typed && !exact ? (
              <Item value={`create ${typed}`} onSelect={createAndMove}>
                <ProjectIcon className="text-muted" />
                <span className="min-w-0 flex-1 truncate">Create “{typed}” and move here</span>
              </Item>
            ) : null}
            {current ? (
              <Item value="no project remove unfile take out" onSelect={() => move(null, "")}>
                <ProjectIcon className="text-muted" />
                <span className="flex-1">Take out of its project</span>
              </Item>
            ) : null}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Item({ children, value, onSelect }: { children: React.ReactNode; value: string; onSelect: () => void }) {
  return (
    <Command.Item value={value} onSelect={onSelect} className={cn("flex min-h-9 cursor-default items-center gap-2.5 rounded-control px-2.5 text-sm outline-none pointer-coarse:min-h-11 data-[selected=true]:bg-accent-tint")}>
      {children}
    </Command.Item>
  );
}
