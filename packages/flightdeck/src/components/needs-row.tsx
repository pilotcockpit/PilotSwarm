import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, MessageSquareReply } from "lucide-react";
import { toast } from "sonner";
import { useRefresh, useSource } from "@/data/source";
import { DESTRUCTIVE_CHOICE, describeError, pauseSentence, sessionState } from "@/data/state";
import type { Session } from "@/data/types";
import { StateGlyph } from "@/components/state";
import { Button } from "@/components/ui/button";
import { ago, cn, plural } from "@/lib/utils";

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * One session that needs you, with the move that clears it where it stands.
 * A question shows its choices as buttons; none is pre-selected as "recommended" unless the agent
 * said so, and a choice that sounds destructive asks once more. Failures offer their fix; holds
 * point at the provider.
 */
export function NeedsRow({ session: s }: { session: Session }) {
  const st = sessionState(s);
  const navigate = useNavigate();
  const { source } = useSource();
  const refresh = useRefresh();
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<string | null>(null);
  const open = () => navigate({ to: "/s/$sessionId", params: { sessionId: s.sessionId } });
  const q = s.pendingQuestion;

  const answer = async (choice: string) => {
    setConfirming(null);
    setSent(choice);
    try {
      await source.sendAnswer(s.sessionId, choice, q);
      toast.success("Answer sent", { description: `${s.title}: ${choice}` });
      refresh(s.sessionId);
    } catch (e: any) {
      setSent(null);
      toast.error("Couldn't send the answer", { description: e?.message });
    }
  };

  let body: React.ReactNode;
  let actions: React.ReactNode = null;
  let below: React.ReactNode = null;
  if (st.key === "needs") {
    body = <>“{q?.question || s.shortSummary || "The agent asked a question."}”</>;
    const choices = Array.isArray(q?.choices) ? q!.choices! : [];
    below = (
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {confirming ? (
          <>
            <span className="text-sm">Send “{confirming}”?</span>
            <Button size="sm" variant="danger" onClick={() => answer(confirming)}>Send</Button>
            <Button size="sm" variant="quiet" onClick={() => setConfirming(null)}>Cancel</Button>
          </>
        ) : sent ? (
          <span className="text-sm text-muted" role="status">Sent “{sent}”. Waiting for the agent…</span>
        ) : (
          <>
            {choices.map((c) => (
              <Button key={c} size="sm" onClick={() => (DESTRUCTIVE_CHOICE.test(c) ? setConfirming(c) : answer(c))}>{c}</Button>
            ))}
            <Button size="sm" variant="quiet" onClick={open}><MessageSquareReply /> {choices.length ? "Reply…" : "Answer"}</Button>
          </>
        )}
      </div>
    );
  } else if (st.key === "failed") {
    const err = describeError(s.error);
    body = <>{err.headline}{err.detail ? `: ${lowerFirst(err.detail)}` : "."}</>;
    actions = (
      <>
        {err.provider ? <Button size="sm" onClick={() => navigate({ to: "/providers", search: { provider: err.provider } })}>Fix provider</Button> : null}
        <Button
          size="sm"
          variant="quiet"
          title="Asks the agent to retry its last step; it appears in the chat"
          onClick={async () => {
            try { await source.sendMessage(s.sessionId, "Please retry the last step."); toast.success("Asked to retry", { description: s.title }); refresh(s.sessionId); }
            catch (e: any) { toast.error("Couldn't retry", { description: e?.message }); }
          }}
        >
          Retry
        </Button>
      </>
    );
  } else {
    body = pauseSentence(s) || "Paused by a usage limit.";
    actions = <Button size="sm" onClick={() => navigate({ to: "/providers" })}>Open provider</Button>;
  }
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 border-t border-line-subtle px-4 py-3 first:border-t-0">
      <StateGlyph state={st.key} className="mt-1.25" />
      <div className="min-w-0 flex-1 basis-[240px]">
        <Link to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="text-sm font-semibold underline-offset-2 hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">{s.title}</Link>
        <p className="mt-0.5 text-sm text-fg/85">{body}</p>
        {below}
        <p className="mt-1 text-xs text-faint">{s.agentId} · {ago(s.updatedAt)}</p>
      </div>
      {actions ? <div className="ml-5.5 flex shrink-0 flex-wrap items-center gap-1.5 self-center sm:ml-0 sm:justify-end">{actions}</div> : null}
    </div>
  );
}

/**
 * Several sessions failing for one cause are one problem. The group says so once, offers the
 * one fix, and opens to the sessions it covers.
 */
export function FailureGroup({ sessions }: { sessions: Session[] }) {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const err = describeError(sessions[0]?.error);
  const id = React.useId();
  return (
    <div className="border-t border-line-subtle first:border-t-0">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
        <StateGlyph state="failed" className="mt-1.25" />
        <div className="min-w-0 flex-1 basis-[240px]">
          <p className="text-sm font-semibold">{plural(sessions.length, "session")} failed for the same reason</p>
          <p className="mt-0.5 text-sm text-fg/85">{err.headline}{err.detail ? `: ${lowerFirst(err.detail)}` : "."}</p>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((v) => !v)}
            className="mt-1 inline-flex min-h-6 items-center gap-1 rounded-chip text-xs text-muted hover:text-fg pointer-coarse:min-h-11"
          >
            <ChevronRight className={cn("size-3.5 transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden />
            {open ? "Hide" : "Show"} {sessions.length} sessions
          </button>
        </div>
        <div className="ml-5.5 flex shrink-0 flex-wrap items-center gap-1.5 self-center sm:ml-0">
          {err.provider ? <Button size="sm" onClick={() => navigate({ to: "/providers", search: { provider: err.provider } })}>Fix provider</Button> : null}
        </div>
      </div>
      {open ? (
        <ul id={id} className="animate-fade border-t border-line-subtle bg-bg/60">
          {sessions.map((s) => (
            <li key={s.sessionId} className="border-t border-line-subtle first:border-t-0">
              <Link to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="focus-inset flex min-h-9 items-center gap-2 px-4 py-1.5 pl-11.5 text-sm hover:bg-raised/70 pointer-coarse:min-h-11">
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span className="shrink-0 text-xs text-faint">{s.agentId} · {ago(s.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
