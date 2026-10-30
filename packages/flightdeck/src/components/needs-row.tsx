import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Loader2, MessageSquareReply } from "lucide-react";
import { toast } from "sonner";
import { useRefresh, useSession, useSource } from "@/data/source";
import { describeError, pauseSentence, sessionState } from "@/data/state";
import type { PendingQuestion, Session } from "@/data/types";
import { AnswerChoices } from "@/components/answer-choices";
import { StateGlyph } from "@/components/state";
import { Button } from "@/components/ui/button";
import { useRetry } from "@/lib/retry";
import { ago, cn, plural } from "@/lib/utils";

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Asks the agent to retry. There is no restart operation, so the request is a chat message and says so. */
const retryMessage = () => "Please retry the last step.";
function RetryButton({ session: s }: { session: Session }) {
  const { retry, busy } = useRetry(s.sessionId, retryMessage, s.title);
  return (
    <Button size="sm" variant="quiet" disabled={busy} title="Asks the agent to retry its last step; it appears in the chat" onClick={() => void retry()}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : null} Retry
    </Button>
  );
}

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
  const open = () => navigate({ to: "/s/$sessionId", params: { sessionId: s.sessionId } });
  // The session list carries no question. Read the session itself while it waits on you.
  const detail = useSession(st.key === "needs" ? s.sessionId : undefined).session;
  const q = detail?.pendingQuestion ?? s.pendingQuestion ?? null;

  // The answer travels with the question it answers; the control reports a failure.
  const answer = async (choice: string, question: PendingQuestion) => {
    await source.sendAnswer(s.sessionId, choice, question);
    toast.success("Answer sent", { description: `${s.title}: ${choice}` });
    refresh(s.sessionId);
  };

  let body: React.ReactNode;
  let actions: React.ReactNode = null;
  let below: React.ReactNode = null;
  if (st.key === "needs") {
    body = <>“{q?.question || s.shortSummary || "The agent asked a question."}”</>;
    const choices = Array.isArray(q?.choices) ? q!.choices! : [];
    below = q ? (
      <AnswerChoices
        sessionId={s.sessionId}
        question={q}
        onAnswer={answer}
        className="mt-2.5"
        extra={<Button size="sm" variant="quiet" onClick={open}><MessageSquareReply /> {choices.length ? "Reply…" : "Answer"}</Button>}
      />
    ) : (
      <div className="mt-2.5"><Button size="sm" variant="quiet" onClick={open}><MessageSquareReply /> Answer</Button></div>
    );
  } else if (st.key === "failed") {
    const err = describeError(s.error);
    body = <>{err.headline}{err.detail ? `: ${lowerFirst(err.detail)}` : "."}</>;
    actions = (
      <>
        {err.provider ? <Button size="sm" onClick={() => navigate({ to: "/providers", search: { provider: err.provider } })}>Fix provider</Button> : null}
        <RetryButton session={s} />
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
 * Several sessions failing for one cause are one problem. The group says so once and opens to the
 * sessions it covers, each with its own detail and its own Retry.
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
          <p className="text-sm font-semibold">{plural(sessions.length, "session")} failed with the same error</p>
          <p className="mt-0.5 text-sm text-fg/85">{err.headline}{err.detail ? `: ${lowerFirst(err.detail)}` : "."}</p>
          <Button variant="quiet" size="sm" className="-ml-2 mt-1 text-muted" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
            <ChevronRight className={cn("transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden />
            {open ? "Hide" : "Show"} {sessions.length} sessions
          </Button>
        </div>
        <div className="ml-5.5 flex shrink-0 flex-wrap items-center gap-1.5 self-center sm:ml-0">
          {err.provider ? <Button size="sm" onClick={() => navigate({ to: "/providers", search: { provider: err.provider } })}>Fix provider</Button> : null}
        </div>
      </div>
      {open ? (
        <ul id={id} className="animate-fade border-t border-line-subtle bg-bg/60">
          {sessions.map((s) => {
            const e = describeError(s.error);
            return (
              <li key={s.sessionId} className="flex items-center gap-1 border-t border-line-subtle pr-3 first:border-t-0">
                <Link to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="focus-inset flex min-h-11 min-w-0 flex-1 flex-col justify-center px-4 py-1.5 pl-11.5 text-sm hover:bg-raised/70 sm:min-h-10">
                  <span className="truncate font-medium">{s.title}</span>
                  <span className="truncate text-xs text-muted">{e.detail || e.headline} · {s.agentId} · {ago(s.updatedAt)}</span>
                </Link>
                <RetryButton session={s} />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
