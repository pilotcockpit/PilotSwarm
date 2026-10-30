import * as React from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowUp, LayoutGrid, Maximize2, MessagesSquare, Minimize2, Plus, LayoutPanelLeft, X } from "lucide-react";
import { TopBar } from "@/shell/AppShell";
import { useRefresh, useSessions, useSource, useTranscript } from "@/data/source";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { rovingKeyDown } from "@/lib/roving";
import { sessionState } from "@/data/state";
import type { PendingQuestion, Session } from "@/data/types";
import { DurableSpine, StatePill, StateGlyph } from "@/components/state";
import { EmptyState, Panel } from "@/components/empty";
import { Markdown } from "@/components/chat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/tabs";
import { useCanvases } from "./session-views";
import { CanvasFrame } from "@/canvas/CanvasFrame";
import { cn } from "@/lib/utils";
import { cardVariants } from "@/components/ui/card";
import { FleetWall } from "./fleet";

// Boards (was Master of Agents): saved tiled views of chats and canvases.
// Up to five boards of sixteen tiles, as today. Stored in this browser so the
// classic portal's boards are never overwritten while both are compared.

type Tile = { id: string; sessionId: string; kind: "chat" | "canvas"; slot?: number };
type Board = { id: string; name: string; tiles: Tile[] };
const KEY = "fd.boards.v2";
const MAX_BOARDS = 5;
const MAX_TILES = 16;

function load(): Board[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); if (Array.isArray(v) && v.length) return v; } catch { /* ignore */ }
  return [{ id: "b1", name: "Board 1", tiles: [] }];
}

const route = getRouteApi("/boards");

export function BoardsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const [boards, setBoards] = React.useState<Board[]>(load);
  const [picker, setPicker] = React.useState(false);
  const [focus, setFocus] = React.useState<string | null>(null);
  const stripRef = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(0);
  const { data: sessions } = useSessions();
  // Fleet is a view of the same page: ?board=fleet. Boards stay as they were.
  const fleet = search.board === "fleet";
  const board = boards.find((b) => b.id === search.board) || boards[0];
  React.useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(boards)); } catch { /* ignore */ } }, [boards]);
  React.useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFocus(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  // Seed a first board from what is live, so the page is useful on first visit.
  React.useEffect(() => {
    if (!sessions?.length || boards.some((b) => b.tiles.length)) return;
    // A useful first board: a live canvas next to the chats that need you or are working.
    const live = sessions.filter((s) => !s.isSystem && ["running", "waiting", "needs"].includes(sessionState(s).key));
    const rank = (s: Session) => ({ needs: 0, running: 1, waiting: 2 } as Record<string, number>)[sessionState(s).key] ?? 3;
    const withCanvas = live.find((s) => s.unseenCanvas && sessionState(s).key !== "needs") || live.find((s) => s.unseenCanvas);
    const chats = live.slice().sort((a, b) => rank(a) - rank(b)).slice(0, withCanvas ? 3 : 4);
    if (!chats.length) return;
    const tiles: Tile[] = [
      ...(withCanvas ? [{ id: "t-canvas", sessionId: withCanvas.sessionId, kind: "canvas" as const, slot: 1 }] : []),
      ...chats.map((s, j) => ({ id: `t${j}`, sessionId: s.sessionId, kind: "chat" as const })),
    ];
    setBoards((bs) => bs.map((b, i) => (i === 0 ? { ...b, tiles } : b)));
  }, [sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (fn: (b: Board) => Board) => setBoards((bs) => bs.map((b) => (b.id === board.id ? fn(b) : b)));
  const byId = new Map((sessions || []).map((s) => [s.sessionId, s]));
  const focused = board.tiles.find((t) => t.id === focus);

  return (
    <>
      <TopBar
        crumbs={fleet ? [{ label: "Boards", to: "/boards" }, { label: "Fleet" }] : [{ label: "Boards", to: "/boards" }, { label: board.name }]}
        actions={fleet ? null : <Button onClick={() => setPicker(true)} disabled={board.tiles.length >= MAX_TILES}><Plus /> Add tile</Button>}
      />
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2 md:px-5">
        <Segmented label="Boards view" value={fleet ? "fleet" : "boards"} onChange={(v) => navigate({ search: v === "fleet" ? { board: "fleet" } : {} })} options={[{ value: "boards", label: "Boards" }, { value: "fleet", label: "Fleet" }]} />
        {fleet ? <span className="hidden text-xs text-faint md:inline">Every session, most urgent first. Arrow keys move between sessions.</span> : null}
        {fleet ? null : <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" role="tablist" aria-label="Boards" onKeyDown={rovingKeyDown("tab")}>
        {boards.map((b) => (
          <button key={b.id} role="tab" aria-selected={b.id === board.id} tabIndex={b.id === board.id ? 0 : -1} onClick={() => navigate({ search: { board: b.id } })} className={cn("focus-inset h-[28px] pointer-coarse:h-11 shrink-0 rounded-control px-2.5 text-sm font-medium", b.id === board.id ? "bg-raised text-fg shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-muted hover:text-fg")}>
            {b.name} <span className="text-xs tabular-nums text-faint">{b.tiles.length}</span>
          </button>
        ))}
        {boards.length < MAX_BOARDS ? (
          <Button variant="quiet" size="sm" onClick={() => { const id = `b${Date.now()}`; setBoards((bs) => [...bs, { id, name: `Board ${bs.length + 1}`, tiles: [] }]); void navigate({ search: { board: id } }); }}><Plus /> New board</Button>
        ) : null}
        <span className="ml-auto hidden shrink-0 text-xs text-faint md:inline">{board.tiles.length} of {MAX_TILES} tiles · F focuses a tile, Esc returns</span>
        </div>}
      </div>
      {fleet ? <FleetWall /> : (
      <div className="min-h-0 flex-1 overflow-auto p-3 md:p-4">
        {board.tiles.length === 0 ? (
          <Panel className="mx-auto max-w-[720px]">
            <EmptyState icon={<LayoutGrid />} title="An empty board" action={<Button variant="primary" onClick={() => setPicker(true)}><Plus /> Add tile</Button>}>
              Put chats and canvases side by side to watch several sessions at once. Each tile keeps the session's state, Open and menu.
            </EmptyState>
          </Panel>
        ) : focused ? (
          <div className="h-full">
            <BoardTile tile={focused} session={byId.get(focused.sessionId)} focused onFocus={() => setFocus(null)} onRemove={() => { update((b) => ({ ...b, tiles: b.tiles.filter((t) => t.id !== focused.id) })); setFocus(null); }} />
          </div>
        ) : (
          // Phones: one tile at a time, swiped sideways with snap; wider screens tile them.
          <div className="flex h-full flex-col gap-2">
          <div ref={stripRef} onScroll={(e) => { const el = e.currentTarget; setVisible(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }} className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto max-md:-mx-3 max-md:px-3 md:grid md:auto-rows-[minmax(280px,1fr)] md:grid-cols-2 md:overflow-visible 2xl:grid-cols-3">
            {board.tiles.map((t) => (
              <BoardTile key={t.id} tile={t} session={byId.get(t.sessionId)} onFocus={() => setFocus(t.id)} onRemove={() => update((b) => ({ ...b, tiles: b.tiles.filter((x) => x.id !== t.id) }))} />
            ))}
          </div>
          {/* Phones: which tile of how many, and a tap target per tile. */}
          <div className="flex items-center justify-center gap-2 md:hidden" aria-label={`Tile ${visible + 1} of ${board.tiles.length}`}>
            {board.tiles.map((t, i) => (
              <button key={t.id} type="button" aria-label={`Show tile ${i + 1}`} aria-current={i === visible ? "true" : undefined} onClick={() => stripRef.current?.scrollTo({ left: i * (stripRef.current?.clientWidth || 0), behavior: "smooth" })} className="grid size-11 place-items-center">
                <span className={cn("block size-2 rounded-full", i === visible ? "bg-accent" : "bg-line-strong")} />
              </button>
            ))}
            <span className="text-xs tabular-nums text-muted">{visible + 1} of {board.tiles.length}</span>
          </div>
          </div>
        )}
      </div>
      )}
      <TilePicker open={picker} onOpenChange={setPicker} sessions={(sessions || []).filter((s) => !s.isSystem)} onPick={(tile) => { update((b) => ({ ...b, tiles: [...b.tiles, { ...tile, id: `t${Date.now()}` }] })); setPicker(false); }} />
    </>
  );
}

function BoardTile({ tile, session, focused = false, onFocus, onRemove }: { tile: Tile; session?: Session; focused?: boolean; onFocus: () => void; onRemove: () => void }) {
  return (
    <section
      tabIndex={0}
      onKeyDown={(e) => { if (e.key.toLowerCase() === "f" && e.target === e.currentTarget) { e.preventDefault(); onFocus(); } }}
      aria-label={`${session?.title || "Session"} ${tile.kind}`}
      className={cn(cardVariants({ clip: true, enter: true }), "flex h-full min-h-0 w-full shrink-0 snap-center flex-col max-md:w-[calc(100vw-24px)]")}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        {tile.kind === "canvas" ? <LayoutPanelLeft className="size-3.5 shrink-0 text-muted" aria-hidden /> : <MessagesSquare className="size-3.5 shrink-0 text-muted" aria-hidden />}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{session?.title || "Session not found"}</span>
        {session ? <DurableSpine marks={session.spine} className="hidden xl:inline-flex" /> : null}
        {session ? <StatePill state={sessionState(session)} size="sm" showReason={false} className="max-sm:hidden" /> : null}
        {/* Phones: the glyph alone, so the title keeps its room. */}
        {session ? <span className="sm:hidden"><StateGlyph state={sessionState(session).key} /><span className="sr-only">{sessionState(session).word}</span></span> : null}
        {session ? <Button size="sm" variant="quiet" asChild><Link to="/s/$sessionId" params={{ sessionId: session.sessionId }} search={tile.kind === "canvas" ? { view: "canvas", slot: tile.slot } : undefined}>Open</Link></Button> : null}
        <Button size="icon-sm" variant="quiet" className="max-md:hidden" aria-label={focused ? "Leave focus" : "Focus this tile"} onClick={onFocus}>{focused ? <Minimize2 /> : <Maximize2 />}</Button>
        <Button size="icon-sm" variant="quiet" aria-label="Remove tile" onClick={onRemove}><X /></Button>
      </header>
      <div className="min-h-0 flex-1">
        {!session ? <EmptyState title="This session is gone" className="h-full">It may have been deleted.</EmptyState> : tile.kind === "canvas" ? <CanvasTile session={session} slot={tile.slot} /> : <ChatTile session={session} />}
      </div>
    </section>
  );
}

function ChatTile({ session }: { session: Session }) {
  const { history } = useTranscript(session.sessionId);
  const { source } = useSource();
  const refresh = useRefresh();
  const ref = React.useRef<HTMLDivElement>(null);
  const [text, setText] = React.useState("");
  const [answered, setAnswered] = React.useState<string | null>(null);
  const items = (history?.chat || []).filter((i) => i.role === "user" || i.role === "assistant").slice(-8);
  const st = sessionState(session);
  const question = st.key === "needs" && session.pendingQuestion && answered !== session.pendingQuestion.question ? session.pendingQuestion : null;
  React.useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [items.length, question]);
  const send = async (prompt: string, asAnswer = false) => {
    try {
      if (asAnswer && session.pendingQuestion) { await source.sendAnswer(session.sessionId, prompt, session.pendingQuestion); setAnswered(session.pendingQuestion.question); }
      else await source.sendMessage(session.sessionId, prompt, st.key === "running" ? { enqueueOnly: true } : undefined);
      setText("");
      refresh(session.sessionId);
    } catch (e: any) { toast.error("Couldn't send", { description: e?.message }); }
  };
  const closed = st.key === "completed" || st.key === "cancelled";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        <ol className="flex flex-col gap-2.5">
          {items.map((i) => (
            <li key={i.id} className={cn("text-sm", i.role === "user" ? "ml-6 rounded-control bg-raised px-2.5 py-1.5" : "")}>
              {i.role === "user" ? <span className="whitespace-pre-wrap">{i.text}</span> : <Markdown text={String(i.text || "")} className="text-sm" />}
            </li>
          ))}
        </ol>
        {question ? <TileQuestion question={question} onAnswer={(a) => send(a, true)} /> : null}
        {st.key === "running" ? <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><StateGlyph state="running" /> {session.step || "Working"}…</p> : null}
      </div>
      {closed ? null : (
        <form className="flex shrink-0 gap-1.5 border-t border-line p-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void send(text.trim()); }}>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={st.key === "running" ? "Queue a message…" : `Message ${session.agentId || "the agent"}…`} aria-label={`Message ${session.title}`} className="h-8" />
          <Button type="submit" size="sm" variant={text.trim() ? "primary" : "default"} disabled={!text.trim()} aria-label="Send"><ArrowUp /></Button>
        </form>
      )}
    </div>
  );
}

function CanvasTile({ session, slot }: { session: Session; slot?: number }) {
  const { canvases, loading } = useCanvases(session.sessionId);
  const c = canvases.find((x) => x.slot === slot) || canvases[0];
  if (loading) return null;
  if (!c) return <EmptyState title="No canvas" className="h-full">This session has not drawn a canvas yet.</EmptyState>;
  return <CanvasFrame html={c.html} title={c.name} zoom={0.85} />;
}

function TilePicker({ open, onOpenChange, sessions, onPick }: { open: boolean; onOpenChange: (v: boolean) => void; sessions: Session[]; onPick: (t: Omit<Tile, "id">) => void }) {
  const [kind, setKind] = React.useState<"chat" | "canvas">("chat");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add tile" description="Pick a session, then its chat or a canvas.">
        <div className="px-5 pb-2"><Segmented label="Tile type" value={kind} onChange={setKind} options={[{ value: "chat", label: "Chat" }, { value: "canvas", label: "Canvas" }]} /></div>
        <DialogBody className="flex flex-col gap-1">
          {sessions.map((s) => (
            <button key={s.sessionId} type="button" onClick={() => onPick({ sessionId: s.sessionId, kind, slot: kind === "canvas" ? 1 : undefined })} className="flex h-10 items-center gap-2.5 rounded-control px-2.5 text-left hover:bg-raised">
              <StateGlyph state={sessionState(s).key} pulse={false} />
              <span className="min-w-0 flex-1 truncate text-sm">{s.title}</span>
              <span className="font-mono text-xs text-faint">{s.agentId}</span>
            </button>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A question inside a tile: the text and its choices, set on a tinted strip rather than a card
 * (a tile is already a card). No choice is pre-styled as the answer; the agent's words decide.
 */
function TileQuestion({ question, onAnswer }: { question: PendingQuestion; onAnswer: (answer: string) => void }) {
  const choices = Array.isArray(question.choices) ? question.choices : [];
  return (
    <section aria-label="Question from the agent" className="mt-3 rounded-control bg-needs-tint px-3 py-2.5">
      <p className="text-sm font-medium text-fg">{question.question}</p>
      {choices.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {choices.map((c) => <Button key={c} size="sm" onClick={() => onAnswer(c)}>{c}</Button>)}
        </div>
      ) : null}
    </section>
  );
}
