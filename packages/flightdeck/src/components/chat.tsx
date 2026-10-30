import * as React from "react";
import { cardVariants } from "@/components/ui/card";
import { toast } from "sonner";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Bot, Check, ChevronRight, CircleSlash, GitBranch, LayoutPanelLeft, Loader2, MessageSquareQuote, Wrench, X } from "lucide-react";
import type { ChatItem } from "@ps/history";
import type { PendingQuestion } from "@/data/types";
import { useSessions } from "@/data/source";
import { SessionChip } from "@/components/session-chip";
import { Tag } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StructuredErrorCard } from "@/components/structured-error";
import { AnswerChoices } from "@/components/answer-choices";
import { questionKey } from "@/data/state";
import { clock, cn, dayLabel } from "@/lib/utils";

marked.setOptions({ gfm: true, breaks: false });

export function Markdown({ text, className }: { text: string; className?: string }) {
  const html = React.useMemo(() => DOMPurify.sanitize(marked.parse(String(text || ""), { async: false }) as string), [text]);
  return <div className={cn("prose-fd", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

type Group = { kind: "item"; item: ChatItem } | { kind: "calls"; items: ChatItem[] } | { kind: "spawns"; items: ChatItem[] };

const isSpawn = (i: ChatItem) => i.kind === "chat-call" && i.category === "Agent" && i.result?.childSessionId;

/** Runs of more than three tool calls fold into one line: "7 tool calls · 41s · 1 failed". */
function groupCalls(items: ChatItem[]): Group[] {
  const out: Group[] = [];
  let run: ChatItem[] = [];
  const flush = () => {
    if (run.length > 3) out.push({ kind: "calls", items: run });
    else run.forEach((item) => out.push({ kind: "item", item }));
    run = [];
  };
  for (const item of items) {
    if (item.kind === "chat-call" && item.category !== "Agent") run.push(item);
    else if (isSpawn(item)) {
      flush();
      const last = out[out.length - 1];
      // Sub-agents started together read as one block ending in their chips.
      if (last?.kind === "spawns") last.items.push(item);
      else out.push({ kind: "spawns", items: [item] });
    } else { flush(); out.push({ kind: "item", item }); }
  }
  flush();
  return out;
}

const itemAt = (g: Group) => (g.kind === "item" ? Number(g.item.createdAt) || 0 : Number(g.items[0].createdAt) || 0);

/**
 * The conversation. Messages are the content; tool calls, sub-agent starts and canvas
 * updates are quiet log rows between them, so twenty calls do not become twenty boxes.
 * `lastSeenAt` (ms) puts a "New since you were here" divider before the first newer item.
 */
export function Transcript({ items, agentName, onOpenCanvas, errorActions, lastSeenAt }: { items: ChatItem[]; sessionId: string; agentName: string; onOpenCanvas: (slot?: number) => void; errorActions?: { onRetry: () => void; onSwitchModel: () => void }; lastSeenAt?: number }) {
  // Fixes belong to the latest failure only; older ones are history.
  const lastWarningId = [...items].reverse().find((i) => i.kind === "session-warning")?.id;
  const groups = React.useMemo(() => groupCalls(items), [items]);
  const newFrom = React.useMemo(() => {
    if (!lastSeenAt) return -1;
    const first = groups.findIndex((g) => itemAt(g) > lastSeenAt);
    // Nothing before it means the whole session is new to this reader: no divider.
    return first > 0 ? first : -1;
  }, [groups, lastSeenAt]);
  let lastAt = 0;
  return (
    <ol className="flex flex-col gap-3" aria-label="Conversation">
      {groups.map((g, index) => {
        const at = itemAt(g);
        const showTime = at && (!lastAt || at - lastAt > 10 * 60_000);
        const sep = showTime ? (
          <li key={`t-${index}`} className="text-center text-xs text-faint">
            <time dateTime={new Date(at).toISOString()}>
              {!lastAt || new Date(at).toDateString() !== new Date(lastAt).toDateString() ? `${dayLabel(at)} · ${clock(at)}` : clock(at)}
            </time>
          </li>
        ) : null;
        if (at) lastAt = at;
        const divider = index === newFrom ? (
          <li key={`n-${index}`} className="flex items-center gap-3 text-xs font-medium text-accent" role="separator" aria-label="New since you were here">
            <span className="h-px flex-1 bg-accent/40" />New since you were here<span className="h-px flex-1 bg-accent/40" />
          </li>
        ) : null;
        const node = g.kind === "calls"
          ? <CallRun key={`run-${g.items[0].id}`} items={g.items} />
          : g.kind === "spawns"
          ? <li key={`sp-${g.items[0].id}`}><SpawnRow items={g.items} /></li>
          : <TranscriptItem key={g.item.id || index} item={g.item} agentName={agentName} onOpenCanvas={onOpenCanvas} errorActions={g.item.id === lastWarningId ? errorActions : undefined} />;
        return <React.Fragment key={`g-${index}`}>{divider}{sep}{node}</React.Fragment>;
      })}
    </ol>
  );
}

function TranscriptItem({ item, agentName, onOpenCanvas, errorActions }: { item: ChatItem; agentName: string; onOpenCanvas: (slot?: number) => void; errorActions?: { onRetry: () => void; onSwitchModel: () => void } }) {
  if (item.kind === "chat-call") return <li><ToolRow item={item} /></li>;
  if (item.kind === "native-task-group") return <li><NativeTasks item={item} /></li>;
  if (item.kind === "session-warning") {
    return <li className="ml-9"><StructuredErrorCard raw={item.text} compact onRetry={errorActions?.onRetry} onSwitchModel={errorActions?.onSwitchModel} /></li>;
  }
  if (item.kind === "canvas-update" || item.role === "canvas-update") {
    return (
      <li className="ml-9 flex min-h-8 items-center gap-2 text-sm">
        <LayoutPanelLeft className="size-4 shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 flex-1 truncate">Drew <span className="font-medium">{item.note ? `“${item.note}”` : "the canvas"}</span> <span className="text-muted">· revision {item.rev || 1}</span></span>
        <Button size="sm" variant="quiet" onClick={() => onOpenCanvas(1)}>Open</Button>
      </li>
    );
  }
  if (item.role === "turn-control" || item.kind === "turn-control") {
    return (
      <li className="flex items-center justify-center gap-2 text-xs text-muted">
        <CircleSlash className="size-3.5" aria-hidden /> {item.text || item.label || "Turn control"}
      </li>
    );
  }
  if (item.role === "epoch-divider") {
    return <li className="flex items-center gap-3 text-xs text-muted" role="separator"><span className="h-px flex-1 bg-line" />Context regenerated<span className="h-px flex-1 bg-line" /></li>;
  }
  if (item.kind === "canvas-action") {
    return <li className="ml-auto max-w-[85%] rounded-pane bg-raised px-3 py-1.5 text-xs text-muted">Canvas action · <span className="font-mono">{item.action}</span></li>;
  }
  if (item.role === "user") {
    return (
      <li className="ml-auto max-w-[85%] rounded-pane bg-raised px-3.5 py-2.5">
        <div className="mb-0.5 text-xs text-muted">{item.sender?.displayName && item.sender?.relation !== "self" ? item.sender.displayName : "You"}</div>
        <div className="whitespace-pre-wrap text-base text-fg">{item.text}</div>
      </li>
    );
  }
  if (item.role === "assistant") {
    return (
      <li className="flex gap-2.5">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-control border border-line bg-surface text-muted" title={agentName}><Bot className="size-3.5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <span className="sr-only">{agentName}:</span>
          <Markdown text={String(item.text || "")} className={cn(item.streaming && "motion-safe:after:animate-pulse after:ml-0.5 after:inline-block after:h-4 after:w-1.5 after:bg-live after:align-middle")} />
        </div>
      </li>
    );
  }
  return <li className="ml-9 text-sm text-muted">{String(item.text || "")}</li>;
}

function callDuration(item: ChatItem) {
  const ms = Number(item.durationMs) || 0;
  return ms ? (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`) : "";
}

/**
 * One tool call as a single log row: icon, name, argument summary, status, duration.
 * The row expands to the payload. A failed call is promoted: its name and status turn
 * the failed colour and its error shows without opening the row; the background stays
 * neutral so text contrast does not drop.
 */
export function ToolRow({ item }: { item: ChatItem }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const failed = item.status === "Failed";
  const done = item.status === "Done" || item.status === "Started";
  const errorText = failed ? String(item.error?.message ?? item.error ?? "") : "";
  return (
    <div className="ml-9">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-8 w-full items-center gap-2 rounded-control px-2 text-left text-sm transition-colors duration-(--duration-fast) hover:bg-raised pointer-coarse:min-h-11"
      >
        <Wrench className={cn("size-3.5 shrink-0", failed ? "text-failed" : "text-muted")} aria-hidden />
        <span className={cn("shrink-0 font-mono text-sm", failed ? "font-medium text-failed" : "text-fg")}>{item.name}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">{item.text}</span>
        {failed ? <Tag tone="failed"><X aria-hidden />Failed</Tag> : done ? <Check className="size-3.5 shrink-0 text-ok" aria-label="Done" /> : <Loader2 className="size-3.5 shrink-0 animate-spin text-live" aria-label="Running" />}
        {callDuration(item) ? <span className="w-11 shrink-0 text-right text-xs tabular-nums text-muted">{callDuration(item)}</span> : null}
        <ChevronRight className={cn("size-3.5 shrink-0 text-muted transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden />
      </button>
      {failed && errorText && !open ? <p className="ml-7 mt-0.5 line-clamp-2 text-xs text-failed">{errorText}</p> : null}
      {open ? (
        <div id={id} className="ml-7 mt-1 animate-fade rounded-control bg-raised px-3 py-2.5 font-mono text-xs leading-5 text-muted">
          <Payload label="Arguments" value={item.arguments} />
          {item.progress ? <Payload label="Progress" value={item.progress} /> : null}
          {item.result !== undefined ? <Payload label="Result" value={item.result} /> : null}
          {item.error ? <Payload label="Error" value={item.error} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Sub-agents started together: one log row, then a chip per child that opens it. */
function SpawnRow({ items }: { items: ChatItem[] }) {
  const { data: sessions } = useSessions();
  const byId = new Map((sessions || []).map((x) => [x.sessionId, x]));
  return (
    <div className="ml-9">
      <div className="flex min-h-8 items-center gap-2 px-2 text-sm">
        <GitBranch className="size-3.5 shrink-0 text-muted" aria-hidden />
        <span className="shrink-0 font-mono text-sm text-fg">spawn_agent{items.length > 1 ? ` ×${items.length}` : ""}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">{items.map((i) => i.result?.agentId).filter(Boolean).join(", ")}</span>
        <Check className="size-3.5 shrink-0 text-ok" aria-label="Started" />
      </div>
      <div className="ml-7 flex flex-wrap gap-1.5 pb-1">
        {items.map((i) => (
          <SessionChip key={i.id} sessionId={i.result.childSessionId} label={i.result.task || i.result.agentId || "Sub-agent"} session={byId.get(i.result.childSessionId)} />
        ))}
      </div>
    </div>
  );
}

function Payload({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null || value === "") return null;
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-0.5 font-sans text-xs font-semibold text-muted">{label}</div>
      <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words">{text}</pre>
    </div>
  );
}

/** More than three calls in a row fold into one quiet line; failures stay visible beneath it. */
function CallRun({ items }: { items: ChatItem[] }) {
  const [open, setOpen] = React.useState(false);
  const failedItems = items.filter((i) => i.status === "Failed");
  const total = items.reduce((n, i) => n + (Number(i.durationMs) || 0), 0);
  const id = React.useId();
  return (
    <li>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className="ml-9 flex min-h-8 items-center gap-2 rounded-control px-2 text-sm text-muted transition-colors duration-(--duration-fast) hover:bg-raised hover:text-fg pointer-coarse:min-h-11">
        <ChevronRight className={cn("size-3.5 transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden />
        <Wrench className="size-3.5" aria-hidden />
        <span>{items.length} tool calls{total ? ` · ${callDuration({ durationMs: total } as unknown as ChatItem)}` : ""}</span>
        {failedItems.length ? <span className="font-medium text-failed">· {failedItems.length} failed</span> : null}
      </button>
      {open ? <div id={id} className="mt-1 flex flex-col gap-0.5">{items.map((i) => <ToolRow key={i.id} item={i} />)}</div> : failedItems.length ? <div className="mt-1 flex flex-col gap-0.5">{failedItems.map((i) => <ToolRow key={i.id} item={i} />)}</div> : null}
    </li>
  );
}

function NativeTasks({ item }: { item: ChatItem }) {
  const tasks: any[] = Array.isArray(item.tasks) ? item.tasks : [];
  return (
    <div className="ml-9 px-2">
      <div className="mb-1 text-xs font-medium text-muted">In-session tasks</div>
      <ul className="flex flex-col gap-1">
        {(tasks.length ? tasks : [{ label: item.text || "Task" }]).map((t, i) => (
          <li key={t.id || i} className="flex items-center gap-2 text-sm">
            <span className={cn("size-1.5 shrink-0 rounded-full", t.status === "completed" ? "bg-ok" : t.status === "failed" ? "bg-failed" : "bg-live")} aria-hidden />
            <span className="truncate">{t.description || t.label || t.title || "Task"}</span>
            {t.status ? <span className="ml-auto text-xs text-muted">{t.status}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * An agent's question as an accent-tinted card with its choices as buttons and "Reply in chat…"
 * as the escape hatch. Only a choice the agent marked recommended is styled as primary.
 * A choice that sounds destructive asks "Send it?" first, in the same place.
 */
export function QuestionCard({ sessionId, question, agentName, onAnswer, busy }: { sessionId: string; question: PendingQuestion; agentName: string; onAnswer: (answer: string, question: PendingQuestion) => void | Promise<void>; busy?: boolean }) {
  return <QuestionCardBody key={questionKey(sessionId, question)} sessionId={sessionId} question={question} agentName={agentName} onAnswer={onAnswer} busy={busy} />;
}

function QuestionCardBody({ sessionId, question, agentName, onAnswer, busy }: { sessionId: string; question: PendingQuestion; agentName: string; onAnswer: (answer: string, question: PendingQuestion) => void | Promise<void>; busy?: boolean }) {
  const [free, setFree] = React.useState(false);
  const [text, setText] = React.useState("");
  return (
    <section aria-label="Question from the agent" className={cn(cardVariants({ tone: "accent", enter: true }), "p-4")}>
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-accent">
        <MessageSquareQuote className="size-4" aria-hidden /> <span className="font-mono">{agentName}</span> is asking
      </div>
      <p className="text-base font-medium text-fg">{question.question}</p>
      <AnswerChoices
        sessionId={sessionId}
        question={question}
        size="md"
        busy={busy}
        onAnswer={onAnswer}
        className="mt-3"
        extra={question.allowFreeform !== false && !free ? <Button variant="quiet" disabled={busy} onClick={() => setFree(true)}>Reply in chat…</Button> : null}
      />
      {free ? (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) Promise.resolve(onAnswer(text.trim(), question)).catch((err: any) => toast.error("Couldn't send your answer", { description: err?.message })); }}>
          <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Your answer" aria-label="Your answer" />
          <Button type="submit" variant="primary" disabled={!text.trim() || busy}>Send</Button>
        </form>
      ) : null}
    </section>
  );
}
