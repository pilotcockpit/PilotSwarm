import * as React from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useRefresh, useSource } from "@/data/source";
import type { Session } from "@/data/types";
import { sessionIsViewOnly } from "@/lib/session-access";
import { plural } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRenameDraft } from "@/lib/rename-draft";

// Actions on one session that two surfaces offer: the sidebar row menu and the session's title menu.
// Each dialog is rendered only while it is open, so a long list does not mount dozens of them.

export type CloseKind = "complete" | "cancel" | "delete";

export const canManage = (s: Session) => !(sessionIsViewOnly(s) || s.canManage === false);
/** Rename, complete, cancel and delete. The SDK refuses all four on a system session; those are restarted instead. */
export const canModify = (s: Session) => canManage(s) && !s.isSystem;
export const sessionLink = (id: string) => `${window.location.origin}/s/${id}`;
export function copySessionLink(id: string) {
  void navigator.clipboard?.writeText(sessionLink(id));
  toast.success("Link copied");
}

/** Complete, cancel or delete, after saying what it does. Closing the dialog is the caller's state. */
export function SessionCloseDialog({ session, kind, childCount = 0, onOpenChange, onCloseAutoFocus }: { session: Session; kind: CloseKind | null; childCount?: number; onOpenChange: (open: boolean) => void; onCloseAutoFocus?: (e: Event) => void }) {
  const { source } = useSource();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const onThisSession = useRouterState({ select: (s) => s.location.pathname === `/s/${session.sessionId}` });
  const [busy, setBusy] = React.useState(false);
  const inFlight = React.useRef(false);
  const run = async (k: CloseKind) => {
    if (inFlight.current || !canModify(session)) return;
    inFlight.current = true;
    setBusy(true);
    try {
      if (k === "complete") await source.completeSession(session.sessionId);
      if (k === "cancel") await source.cancelSession(session.sessionId);
      if (k === "delete") await source.deleteSession(session.sessionId);
      refresh(session.sessionId);
      onOpenChange(false);
      toast.success(k === "complete" ? "Session completed" : k === "cancel" ? "Session cancelled" : "Session deleted", { description: session.title });
      if (k === "delete" && onThisSession) void navigate({ to: "/sessions" });
    } catch (e: any) {
      toast.error("That didn't work", { description: e?.message });
    } finally { inFlight.current = false; setBusy(false); }
  };
  const cascade = childCount ? `Also ${kind === "delete" ? "deletes" : "cancels"} ${plural(childCount, "sub-agent")}.` : "";
  return (
    <Dialog open={Boolean(kind)} onOpenChange={(o) => !o && !busy && onOpenChange(false)}>
      {kind ? (
        <DialogContent title={kind === "complete" ? "Complete this session?" : kind === "cancel" ? "Cancel this session?" : "Delete this session?"} onCloseAutoFocus={onCloseAutoFocus}>
          <DialogBody>
            <p className="text-sm text-muted">
              {kind === "complete" && "It closes as done. The transcript, canvases and outputs stay. "}
              {kind === "cancel" && "It closes as abandoned and stops any running turn. "}
              {kind === "delete" && "It disappears from every list and stops. Session facts are removed; a deleted summary is kept until an admin prunes it. "}
              {cascade ? <strong className="font-semibold text-fg">{cascade}</strong> : null}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button disabled={busy} onClick={() => onOpenChange(false)}>Keep it</Button>
            <Button disabled={busy} variant={kind === "complete" ? "primary" : "danger"} onClick={() => run(kind)}>
              {busy ? "Updating session…" : kind === "complete" ? "Complete" : kind === "cancel" ? "Cancel session" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

/**
 * Rename in a small dialog, for places where the title is not an editable heading (the sidebar).
 * The draft starts from the title as it was when the dialog opened and is never replaced by a poll: if the
 * session is renamed by someone else meanwhile, the dialog says so and offers their title, and saving still
 * means what the person typed.
 */
export function SessionRenameDialog({ session, open, onOpenChange }: { session: Session; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { source } = useSource();
  const refresh = useRefresh();
  const current = session.title || "";
  const draft = useRenameDraft(current, open);
  const [busy, setBusy] = React.useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const outcome = draft.outcome();
    if (outcome.kind === "noop") return onOpenChange(false);
    setBusy(true);
    try { await source.renameSession(session.sessionId, outcome.next); refresh(session.sessionId); toast.success("Renamed"); onOpenChange(false); }
    catch (err: any) { toast.error("Couldn't rename", { description: err?.message }); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent title="Rename session">
        <form onSubmit={save}>
          <DialogBody className="flex flex-col gap-2">
            <Field label="Title"><Input autoFocus value={draft.text} onChange={(e) => draft.setText(e.target.value)} maxLength={200} /></Field>
            {draft.changedUnderneath ? (
              <p role="status" className="text-sm text-muted" data-title-changed>
                Someone renamed this to “{current}” while you were typing. Saving replaces it with your title.{" "}
                <Button type="button" variant="link" size="sm" onClick={draft.useTheirs}>Use theirs</Button>
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy || !draft.text.trim()}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
