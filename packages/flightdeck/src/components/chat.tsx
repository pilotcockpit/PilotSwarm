import * as React from "react";
import { Link } from "@tanstack/react-router";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Bot, Check, ChevronRight, CircleSlash, GitBranch, LayoutPanelLeft, Loader2, MessageSquareQuote, Wrench, X } from "lucide-react";
import type { ChatItem } from "@ps/history";
import type { PendingQuestion } from "@/data/types";
import { useSessions } from "@/data/source";
import { sessionState } from "@/data/state";
import { StateGlyph } from "@/components/state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StructuredErrorCard } from "@/components/structured-error";
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

export function Transcript({ items, agentName, onOpenCanvas, errorActions }: { items: ChatItem[]; sessionId: string; agentName: string; onOpenCanvas: (slot?: number) => void; errorActions?: { onRetry: () => void; onSwitchModel: () => void } }) {
  // Fixes belong to the latest failure only; older ones are history.
  const lastWarningId = [...items].reverse().find((i) => i.kind === "session-warning")?.id;
  const groups = React.useMemo(() => groupCalls(items.filter((i) => i.role !== "canvas-update" || true)), [items]);
  let lastAt = 0;
  return (
    <ol className="flex flex-col gap-4" aria-label="Conversation">
      {groups.map((g, index) => {
        const at = g.kind === "item" ? Number(g.item.createdAt) || 0 : Number(g.items[0].createdAt) || 0;
        const showTime = at && (!lastAt || at - lastAt > 10 * 60_000);
        const sep = showTime ? (
          <li key={`t-${index}`} className="text-center text-xs text-faint" aria-hidden>
            {!lastAt || new Date(at).toDateString() !== new Date(lastAt).toDateString() ? `${dayLabel(at)} · ${clock(at)}` : clock(at)}
          </li>
        ) : null;
        if (at) lastAt = at;
        const node = g.kind === "calls"
          ? <CallRun key={`run-${g.items[0].id}`} items={g.items} />
          : g.kind === "spawns"
          ? <li key={`sp-${g.items[0].id}`}><SpawnBlock items={g.items} /></li>
          : <TranscriptItem key={g.item.id || index} item={g.item} agentName={agentName} onOpenCanvas={onOpenCanvas} errorActions={g.item.id === lastWarningId ? errorActions : undefined} />;
        return <React.Fragment key={`g-${index}`}>{sep}{node}</React.Fragment>;
      })}
    </ol>
  );
}

function TranscriptItem({ item, agentName, onOpenCanvas, errorActions }: { item: ChatItem; agentName: string; onOpenCanvas: (slot?: number) => void; errorActions?: { onRetry: () => void; onSwitchModel: () => void } }) {
  if (item.kind === "chat-call") return <li><ToolCall item={item} /></li>;
  if (item.kind === "native-task-group") return <li><NativeTasks item={item} /></li>;
  if (item.kind === "session-warning") {
    return <li className="ml-9"><StructuredErrorCard raw={item.text} compact onRetry={errorActions?.onRetry} onSwitchModel={errorActions?.onSwitchModel} /></li>;
  }
  if (item.kind === "canvas-update" || item.role === "canvas-update") {
    return (
      <li className="ml-9 flex items-center gap-3 rounded-pane border border-line bg-surface px-3 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-control bg-raised text-muted"><LayoutPanelLeft className="size-4" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Drew {item.note ? `“${item.note}”` : "the canvas"}</span>
          <span className="block text-xs text-muted">Canvas · revision {item.rev || 1}</span>
        </span>
        <Button size="sm" onClick={() => onOpenCanvas(1)}>Open</Button>
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
    return <li className="flex items-center gap-3 text-xs text-faint" role="separator"><span className="h-px flex-1 bg-line" />Context regenerated<span className="h-px flex-1 bg-line" /></li>;
  }
  if (item.kind === "canvas-action") {
    return <li className="ml-auto max-w-[85%] rounded-pane border border-line bg-raised px-3 py-1.5 text-xs text-muted">Canvas action · <span className="font-mono">{item.action}</span></li>;
  }
  if (item.role === "user") {
    return (
      <li className="ml-auto max-w-[85%] rounded-pane bg-raised px-3.5 py-2.5">
        <div className="mb-0.5 text-xs text-faint">{item.sender?.displayName && item.sender?.relation !== "self" ? item.sender.displayName : "You"}</div>
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
          <Markdown text={String(item.text || "")} className={cn(item.streaming && "after:ml-0.5 after:inline-block after:h-4 after:w-1.5 after:animate-pulse after:bg-live after:align-middle")} />
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
 * Tool-call block: tool icon, tool name (mono), a one-line argument summary,
 * status glyph and duration; expands to the payload. Spawns end with
 * child-session chips.
 */
export function ToolCall({ item }: { item: ChatItem }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const failed = item.status === "Failed";
  const done = item.status === "Done" || item.status === "Started";
  const spawn = item.category === "Agent" && item.result?.childSessionId;
  return (
    <div className={cn("ml-9 overflow-hidden rounded-pane border bg-surface", failed ? "border-failed/40" : "border-line")}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className="flex h-[34px] w-full items-center gap-2 px-3 text-left hover:bg-raised/60 pointer-coarse:h-11">
        {item.category === "Agent" ? <GitBranch className="size-3.5 shrink-0 text-muted" aria-hidden /> : <Wrench className="size-3.5 shrink-0 text-muted" aria-hidden />}
        <span className="shrink-0 font-mono text-[13px] text-fg">{item.name}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">{item.text}</span>
        {failed ? <X className="size-3.5 shrink-0 text-failed" aria-label="Failed" /> : done ? <Check className="size-3.5 shrink-0 text-ok" aria-label="Done" /> : <Loader2 className="size-3.5 shrink-0 animate-spin text-live" aria-label="Running" />}
        {callDuration(item) ? <span className="shrink-0 font-mono text-xs tabular-nums text-faint">{callDuration(item)}</span> : null}
        <ChevronRight className={cn("size-3.5 shrink-0 text-faint transition-transform", open && "rotate-90")} aria-hidden />
      </button>
      {spawn ? (
        <div className="flex flex-wrap gap-1.5 border-t border-line-subtle px-3 py-2">
          <Link to="/s/$sessionId" params={{ sessionId: item.result.childSessionId }} className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line px-2.5 text-xs text-accent hover:bg-raised pointer-coarse:h-11 pointer-coarse:px-3.5">
            <GitBranch className="size-3" aria-hidden /> {item.result.task || item.result.agentId || "Sub-agent"}
          </Link>
        </div>
      ) : null}
      {open ? (
        <div id={id} className="border-t border-line-subtle bg-bg px-3 py-2.5 font-mono text-xs leading-5 text-muted">
          <Payload label="Arguments" value={item.arguments} />
          {item.progress ? <Payload label="Progress" value={item.progress} /> : null}
          {item.result !== undefined ? <Payload label="Result" value={item.result} /> : null}
          {item.error ? <Payload label="Error" value={item.error} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** One block for sub-agents started together: the call line, then a chip per child that opens it. */
function SpawnBlock({ items }: { items: ChatItem[] }) {
  const { data: sessions } = useSessions();
  const byId = new Map((sessions || []).map((x) => [x.sessionId, x]));
  return (
    <div className="ml-9 overflow-hidden rounded-pane border border-line bg-surface">
      <div className="flex h-[34px] items-center gap-2 px-3">
        <GitBranch className="size-3.5 shrink-0 text-muted" aria-hidden />
        <span className="shrink-0 font-mono text-[13px] text-fg">spawn_agent{items.length > 1 ? ` ×${items.length}` : ""}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">{items.map((i) => i.result?.agentId).filter(Boolean).join(", ")}</span>
        <Check className="size-3.5 shrink-0 text-ok" aria-label="Started" />
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-line-subtle px-3 py-2">
        {items.map((i) => {
          const child = byId.get(i.result.childSessionId);
          const st = child ? sessionState(child) : null;
          return (
            <Link key={i.id} to="/s/$sessionId" params={{ sessionId: i.result.childSessionId }} className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line px-2.5 text-xs text-accent hover:bg-raised pointer-coarse:h-11 pointer-coarse:px-3.5">
              {st ? <StateGlyph state={st.key} className="size-2" /> : <GitBranch className="size-3" aria-hidden />}
              {i.result.task || i.result.agentId || "Sub-agent"}
              {st ? <span className="sr-only">, {st.word}</span> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Payload({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null || value === "") return null;
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-0.5 font-sans text-[11px] font-semibold text-faint">{label}</div>
      <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words">{text}</pre>
    </div>
  );
}

function CallRun({ items }: { items: ChatItem[] }) {
  const [open, setOpen] = React.useState(false);
  const failed = items.filter((i) => i.status === "Failed").length;
  const id = React.useId();
  return (
    <li>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className="ml-9 flex h-[30px] items-center gap-2 rounded-control px-2 text-xs text-muted hover:bg-raised hover:text-fg pointer-coarse:h-11">
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} aria-hidden />
        <Wrench className="size-3.5" aria-hidden />
        {items.length} tool calls
        {failed ? <span className="text-failed">· {failed} failed</span> : null}
      </button>
      {open ? <div id={id} className="mt-2 flex flex-col gap-2">{items.map((i) => <ToolCall key={i.id} item={i} />)}</div> : null}
    </li>
  );
}

function NativeTasks({ item }: { item: ChatItem }) {
  const tasks: any[] = Array.isArray(item.tasks) ? item.tasks : [];
  return (
    <div className="ml-9 rounded-pane border border-line bg-surface p-3">
      <div className="mb-2 text-xs font-semibold text-muted">In-session tasks</div>
      <ul className="flex flex-col gap-1.5">
        {(tasks.length ? tasks : [{ label: item.text || "Task" }]).map((t, i) => (
          <li key={t.id || i} className="flex items-center gap-2 text-sm">
            <span className={cn("size-1.5 rounded-full", t.status === "completed" ? "bg-ok" : t.status === "failed" ? "bg-failed" : "bg-live")} aria-hidden />
            <span className="truncate">{t.description || t.label || t.title || "Task"}</span>
            {t.status ? <span className="ml-auto text-xs text-faint">{t.status}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** An agent's question as an accent-tinted card, choices as buttons, "Reply in chat…" as the escape hatch. */
export function QuestionCard({ question, agentName, onAnswer, busy }: { question: PendingQuestion; agentName: string; onAnswer: (answer: string) => void; busy?: boolean }) {
  const [free, setFree] = React.useState(false);
  const [text, setText] = React.useState("");
  const choices = Array.isArray(question.choices) ? question.choices : [];
  return (
    <section aria-label="Question from the agent" className="rounded-pane border border-accent/45 bg-accent-tint p-4">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-accent">
        <MessageSquareQuote className="size-4" aria-hidden /> <span className="font-mono">{agentName}</span> is asking
      </div>
      <p className="text-base font-medium text-fg">{question.question}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {choices.map((c, i) => (
          <Button key={c} variant={i === 0 ? "primary" : "default"} disabled={busy} onClick={() => onAnswer(c)}>{c}</Button>
        ))}
        {question.allowFreeform !== false ? (
          free ? null : <Button variant="quiet" disabled={busy} onClick={() => setFree(true)}>Reply in chat…</Button>
        ) : null}
      </div>
      {free ? (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onAnswer(text.trim()); }}>
          <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Your answer" aria-label="Your answer" />
          <Button type="submit" variant="primary" disabled={!text.trim() || busy}>Send</Button>
        </form>
      ) : null}
    </section>
  );
}
