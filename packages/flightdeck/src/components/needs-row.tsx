import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, ChevronRight, Loader2, MessageSquareReply, X } from "lucide-react";
import { toast } from "sonner";
import { useRefresh, useSession, useSource } from "@/data/source";
import { describeError, pauseSentence, sessionState } from "@/data/state";
import type { PendingQuestion, Session } from "@/data/types";
import { AnswerChoices } from "@/components/answer-choices";
import { StateGlyph, StatePill } from "@/components/state";
import { Button } from "@/components/ui/button";
import { AgentIdentity, WorkCard, WorkCardBody, WorkCardFooter } from "@/components/ui/work-card";
import { ProjectIcon } from "@/components/project-icon";
import { useRetry } from "@/lib/retry";
import { ago, cn, plural } from "@/lib/utils";

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
// Overview actions use a reading-size label and a shared baseline; touch targets remain 44px.
const actionClass = "h-auto min-h-9 max-w-full whitespace-normal px-3 py-1.5 text-base pointer-coarse:min-h-11";

/** Asks the agent to retry. There is no restart operation, so the request is a chat message and says so. */
const retryMessage = () => "Please retry the last step.";
function RetryButton({ session: s, compact = false }: { session: Session; compact?: boolean }) {
  const { retry, busy } = useRetry(s.sessionId, retryMessage, s.title);
  return (
    <Button className={compact ? undefined : actionClass} size={compact ? "sm" : undefined} variant="quiet" disabled={busy} title="Asks the agent to retry its last step; it appears in the chat" onClick={() => void retry()}>
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
export function NeedsRow({ session: s, index = 0, featured = false }: { session: Session; index?: number; featured?: boolean }) {
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
        size="md"
        className="mt-5 gap-2 [&_button]:h-auto [&_button]:min-h-9 [&_button]:max-w-full [&_button]:whitespace-normal [&_button]:px-3 [&_button]:py-1.5 [&_button]:text-base [&_button]:text-left pointer-coarse:[&_button]:min-h-11"
        extra={<Button className={actionClass} variant="quiet" onClick={open}><MessageSquareReply /> {choices.length ? "Reply…" : "Answer"}</Button>}
      />
    ) : (
      <div className="mt-3"><Button className={actionClass} variant="quiet" onClick={open}><MessageSquareReply /> Answer</Button></div>
    );
  } else if (st.key === "failed") {
    const err = describeError(s.error);
    body = <>{err.headline}{err.detail ? `: ${lowerFirst(err.detail)}` : "."}</>;
    actions = (
      <>
        {err.provider ? <Button className={actionClass} onClick={() => navigate({ to: "/providers", search: { provider: err.provider } })}>Fix provider</Button> : null}
        <RetryButton session={s} />
      </>
    );
  } else {
    body = pauseSentence(s) || "Paused by a usage limit.";
    actions = <Button className={actionClass} onClick={() => navigate({ to: "/providers" })}>Open provider</Button>;
  }
  return (
    <WorkCard index={index} className={featured ? "flex flex-col" : undefined}>
      <WorkCardBody className={featured ? "flex-1 p-6" : undefined}>
        <div className="mb-3"><StatePill state={st} showReason={false} /></div>
        <h3 className={cn("font-semibold leading-snug", featured ? "text-xl" : "text-lg")}>
          <Link to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="break-words underline-offset-2 hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">{s.title}</Link>
        </h3>
        <p className={cn("mt-3 max-w-prose break-words text-muted", featured ? "text-lg leading-relaxed" : st.key === "needs" ? "text-prose" : "text-base")}>{body}</p>
        {below}
        {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </WorkCardBody>
      <WorkCardFooter>
        <AgentIdentity name={s.agentId} /><span className="tabular-nums">{ago(s.updatedAt)}</span>
        <Link to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="ml-auto inline-flex min-h-6 items-center gap-1 hover:text-fg hover:underline pointer-coarse:min-h-11">Open session <ArrowUpRight className="size-3.5" aria-hidden /></Link>
      </WorkCardFooter>
    </WorkCard>
  );
}

/**
 * Several sessions failing for one cause are one problem. The group says so once and opens to the
 * sessions it covers, each with its own detail and its own Retry.
 */
export function FailureGroup({ sessions, index = 0, compact = false }: { sessions: Session[]; index?: number; compact?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const err = describeError(sessions[0]?.error);
  const id = React.useId();
  const Wrap = compact ? CompactWrap : WorkCard;
  return (
    <Wrap index={index}>
      <div className={cn("flex items-start gap-3", compact ? "px-4 py-3" : "px-5 py-4")}>
        <StateGlyph state="failed" className="mt-1.25" />
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-prose font-semibold">{plural(sessions.length, "session")} failed with the same error</p>
          <p className="mt-2 max-w-prose break-words text-base text-muted">{err.headline}{err.detail ? `: ${lowerFirst(err.detail)}` : "."}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {err.provider ? <Button className={actionClass} onClick={() => navigate({ to: "/providers", search: { provider: err.provider } })}>Fix provider</Button> : null}
            <Button variant="quiet" className={actionClass} aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
              <ChevronRight className={cn("transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden />
              {open ? "Hide" : "Show"} {sessions.length} sessions
            </Button>
          </div>
        </div>
      </div>
      {open ? (
        <ul id={id} className="animate-fade border-t border-line-subtle bg-bg/60">
          {sessions.map((s) => {
            const e = describeError(s.error);
            return (
              <li key={s.sessionId} className="flex items-center gap-1 border-t border-line-subtle pr-3 first:border-t-0">
                <Link to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="focus-inset flex min-h-11 min-w-0 flex-1 flex-col justify-center px-4 py-1.5 pl-11.5 text-sm hover:bg-raised/70 sm:min-h-10 pointer-coarse:min-h-11">
                  <span className="truncate font-medium">{s.title}</span>
                  <span className="truncate text-xs text-muted">{e.detail || e.headline} · {s.agentId} · {ago(s.updatedAt)}</span>
                </Link>
                <RetryButton session={s} />
              </li>
            );
          })}
        </ul>
      ) : null}
    </Wrap>
  );
}

/** A row of the attention list, not a card of its own. */
function CompactWrap({ children }: { children: React.ReactNode; index?: number }) {
  return <div className="border-t border-line-subtle first:border-t-0">{children}</div>;
}

/**
 * One line of the Needs you list, for everything after the first (which is a card that answers in place): what and
 * why, where it lives, and the move that clears it. A question opens its session to be answered; a failure offers its
 * fix and can be dismissed until it fails again; a hold points at the provider.
 */
export function AttentionRow({ session: s, project, onDismiss }: { session: Session; project?: string | null; onDismiss?: () => void }) {
  const st = sessionState(s);
  const navigate = useNavigate();
  const err = st.key === "failed" ? describeError(s.error) : null;
  const reason = st.key === "needs" ? s.pendingQuestion?.question || (typeof s.waitReason === "string" ? s.waitReason : "") || "The agent asked a question." : err ? `${err.headline}${err.detail ? `: ${lowerFirst(err.detail)}` : "."}` : pauseSentence(s) || "Paused by a usage limit.";
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 border-t border-line-subtle px-4 py-3 first:border-t-0">
      <StateGlyph state={st.key} hold={st.waitKind === "hold"} className="mt-1.5" />
      <div className="min-w-0 flex-1 basis-56">
        <Link to="/s/$sessionId" params={{ sessionId: s.sessionId }} className="block break-words text-sm font-medium underline-offset-2 hover:underline pointer-coarse:min-h-11">{s.title || "Untitled session"}</Link>
        <p className="mt-0.5 line-clamp-2 break-words text-sm text-muted">{st.key === "needs" ? `“${reason}”` : reason}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-faint">
          {project ? <span className="inline-flex items-center gap-1"><ProjectIcon className="size-3" />{project}</span> : null}
          {s.agentId ? <span>{s.agentId}</span> : null}
          <span className="tabular-nums">{ago(s.updatedAt)}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {st.key === "needs" ? <Button size="sm" onClick={() => navigate({ to: "/s/$sessionId", params: { sessionId: s.sessionId } })}><MessageSquareReply /> Answer</Button> : null}
        {err?.provider ? <Button size="sm" onClick={() => navigate({ to: "/providers", search: { provider: err.provider } })}>Fix provider</Button> : null}
        {st.key === "failed" ? <RetryButton session={s} compact /> : null}
        {st.key !== "needs" && st.key !== "failed" ? <Button size="sm" onClick={() => navigate({ to: "/providers" })}>Open provider</Button> : null}
        {onDismiss ? <Button variant="quiet" size="icon-sm" aria-label={`Dismiss ${s.title}`} title="Dismiss until it fails again" onClick={onDismiss}><X /></Button> : null}
      </div>
    </div>
  );
}
