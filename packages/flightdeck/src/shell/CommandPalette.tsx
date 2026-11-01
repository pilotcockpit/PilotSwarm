import * as React from "react";
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bot, Brain, Copy, FileSearch, FolderInput, FolderOutput, Flag, Package, Paperclip, Search, House, KeyRound, Keyboard, LayoutGrid, MessagesSquare, Plus, RotateCcw, Share2, ShieldCheck, SlidersHorizontal, ToggleLeft, Wrench } from "lucide-react";
import { useAgents, useProfile, useSessions, useSource } from "@/data/source";
import { STATE_TONE, sessionState } from "@/data/state";
import { cn } from "@/lib/utils";
import { StateGlyph } from "@/components/state";
import { Kbd } from "@/components/ui/kbd";
import { useUi } from "./ui-state";
import { useThemeCommands } from "@/components/theme-setting";
import { requestIntent, useIntentNavigationGuard, type Intent } from "./intents";
import { sessionIsViewOnly } from "@/lib/session-access";

/** ⌘K finds anything: sessions, agents, areas, and actions. */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, openNewSession, setShortcutsOpen, restoreFocus } = useUi();
  const navigate = useNavigate();
  const { data: sessions } = useSessions();
  const { data: agents } = useAgents();
  const { data: profile } = useProfile();
  const themeCommands = useThemeCommands();
  const { mode, setMode } = useSource();
  const run = (fn: () => void) => () => { setPaletteOpen(false); fn(); };
  const go = (to: string, search?: Record<string, unknown>) => run(() => navigate({ to, search: search as any }));
  // A page-owned action: go where it lives, then ask that page to do it.
  // The intent is bound to the pathname it was asked of, so only that screen can take it.
  const act = (intent: Intent, to: string, search?: Record<string, unknown>) => run(() => { void navigate({ to, search: search as any }); requestIntent(intent, to); });
  useIntentNavigationGuard();
  const sessionId = useRouterState({ select: (s) => /^\/s\/([^/]+)/.exec(s.location.pathname)?.[1] ?? null });
  // Session actions need a session that has loaded and that you can open, not just a pathname that looks like one.
  const current = sessionId ? (sessions || []).find((s) => s.sessionId === sessionId && s.status !== "deleted") : undefined;
  const here = current ? `/s/${current.sessionId}` : null;
  const canReply = Boolean(current) && !sessionIsViewOnly(current!);
  const isAdmin = Boolean(profile?.isAdmin);

  const rows = React.useMemo(
    () => (sessions || []).slice().sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0)),
    [sessions],
  );

  return (
    <D.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim data-[state=open]:animate-fade" />
        <D.Content onCloseAutoFocus={restoreFocus} className="fixed left-1/2 top-[14vh] z-(--z-overlay) w-[calc(100vw-24px)] max-w-[620px] -translate-x-1/2 overflow-hidden rounded-dialog border border-line bg-overlay shadow-pop outline-none data-[state=open]:animate-pop" aria-describedby={undefined}>
          <D.Title className="sr-only">Command palette</D.Title>
          <Command label="Command palette" loop className="flex max-h-[64vh] flex-col">
            <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-faint" aria-hidden />
              <Command.Input
                autoFocus
                placeholder="Search sessions, agents, commands…"
                className="h-full w-full bg-transparent text-base text-fg outline-none placeholder:text-faint"
              />
            </div>
            <Command.List className="min-h-0 flex-1 overflow-y-auto p-1.5 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-faint">
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted">No matches. Try a session title, an agent or an area.</Command.Empty>
              {here ? (
                <Command.Group heading="This session">
                  <Item icon={<Share2 />} onSelect={act("share-session", here)} keywords={["access", "people", "visibility", "invite"]}>Share session…</Item>
                  <Item icon={<FolderInput />} onSelect={act("move-to-group", here)} keywords={["group", "organise"]}>Move session to group…</Item>
                  <Item icon={<Copy />} onSelect={run(() => { void navigator.clipboard?.writeText(`${window.location.origin}${here}`); toast.success("Link copied", { description: "People still need access to open it." }); })} keywords={["url", "link"]}>Copy session link</Item>
                  {canReply ? <Item icon={<Paperclip />} onSelect={act("attach-file", here, { view: "chat" })} keywords={["upload", "attachment", "image"]}>Attach file…</Item> : null}
                  <Item icon={<FileSearch />} onSelect={act("find-file", here, { view: "files", files: "folders" })} keywords={["file", "folder", "workspace", "find"]}>Go to file…</Item>
                  <Item icon={<Share2 />} onSelect={act("share-canvas", here, { view: "canvas" })} keywords={["canvas", "public", "link"]}>Share canvas…</Item>
                </Command.Group>
              ) : null}
              <Command.Group heading="Actions">
                <Item icon={<Plus />} onSelect={run(() => openNewSession())} shortcut="N">New session</Item>
                <Item icon={<KeyRound />} onSelect={act("add-provider", "/providers", { tab: "providers" })} keywords={["model", "key", "openai", "anthropic", "copilot", "azure"]}>Add provider…</Item>
                <Item icon={<Package />} onSelect={act("add-package", "/library", { tab: "packages" })} keywords={["agent", "upload", "install"]}>Add a package…</Item>
                <Item icon={<Keyboard />} onSelect={run(() => setShortcutsOpen(true))} shortcut="?">Keyboard shortcuts</Item>
                {themeCommands.map((c) => <Item key={c.value} icon={<c.icon />} onSelect={run(c.run)} keywords={c.keywords}>{c.label}</Item>)}
                <Item icon={<ToggleLeft />} onSelect={run(() => setMode(mode === "demo" ? "live" : "demo"))} keywords={["data", "demo", "live"]}>
                  {mode === "demo" ? "Use live data" : "Use demo data"}
                </Item>
              </Command.Group>
              {rows.length ? (
                <Command.Group heading="Recent sessions">
                  {rows.slice(0, 40).map((s) => {
                    const st = sessionState(s);
                    return (
                      <Item
                        key={s.sessionId}
                        value={`session ${s.title} ${s.agentId} ${s.sessionId}`}
                        icon={<StateGlyph state={st.key} pulse={false} />}
                        onSelect={go(`/s/${s.sessionId}`)}
                        meta={<span className={cn("text-xs font-medium", STATE_TONE[st.key])}>{st.word}</span>}
                      >
                        {s.title || "Untitled session"}
                      </Item>
                    );
                  })}
                </Command.Group>
              ) : null}
              <Command.Group heading="Go to">
                <Item icon={<House />} onSelect={go("/")} shortcut="G H">Home</Item>
                <Item icon={<MessagesSquare />} onSelect={go("/sessions")} shortcut="G S">Sessions</Item>
                <Item icon={<LayoutGrid />} onSelect={go("/boards")} shortcut="G B">Boards</Item>
                <Item icon={<FolderOutput />} onSelect={go("/outputs")} shortcut="G O">Outputs</Item>
                <Item icon={<Bot />} onSelect={go("/library")} shortcut="G L">Agent library</Item>
                <Item icon={<KeyRound />} onSelect={go("/providers", { tab: "providers" })} shortcut="G P" keywords={["providers", "spend", "limits", "usage"]}>Models &amp; spend</Item>
                <Item icon={<SlidersHorizontal />} onSelect={go("/providers", { tab: "defaults" })} keywords={["model", "default"]}>Default models</Item>
                <Item icon={<Package />} onSelect={go("/library", { tab: "packages" })} keywords={["packages", "versions"]}>Packages</Item>
                {isAdmin ? <Item icon={<ShieldCheck />} onSelect={go("/admin")} shortcut="G A">Admin</Item> : null}
                {isAdmin ? <Item icon={<Flag />} onSelect={go("/admin", { tab: "flags" })} keywords={["feature", "flags", "rollout"]}>Feature flags</Item> : null}
                {isAdmin ? <Item icon={<Brain />} onSelect={go("/admin", { tab: "knowledge" })} keywords={["facts", "graph", "embedder", "purge"]}>Knowledge health</Item> : null}
                {isAdmin ? <Item icon={<Wrench />} onSelect={go("/admin", { tab: "maintenance" })} keywords={["prune", "housekeeping", "clean"]}>Run maintenance…</Item> : null}
                {isAdmin ? <Item icon={<RotateCcw />} onSelect={go("/admin", { tab: "system" })} keywords={["restart", "system", "agent"]}>Restart system session…</Item> : null}
                <Item icon={<Flag />} onSelect={go("/settings", { tab: "flags" })} keywords={["feature", "preferences", "flags"]}>My feature preferences</Item>
                <Item icon={<SlidersHorizontal />} onSelect={go("/settings")}>Settings</Item>
              </Command.Group>
              {agents?.length ? (
                <Command.Group heading="Start with an agent">
                  {agents.map((a) => (
                    <Item key={a.name} value={`agent ${a.name} ${a.title}`} icon={<Bot />} onSelect={run(() => openNewSession({ agent: a.name }))} meta={<span className="font-mono text-xs text-faint">{a.name}</span>}>
                      {a.title || a.name}
                    </Item>
                  ))}
                </Command.Group>
              ) : null}
            </Command.List>
            <div className="flex shrink-0 items-center gap-3 border-t border-line px-3 py-2 text-xs text-faint">
              <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
              <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
              <span className="flex items-center gap-1"><Kbd>Esc</Kbd> close</span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function Item({ children, icon, onSelect, shortcut, meta, value, keywords }: { children: React.ReactNode; icon: React.ReactNode; onSelect: () => void; shortcut?: string; meta?: React.ReactNode; value?: string; keywords?: string[] }) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      className="flex h-9 cursor-default items-center gap-2.5 rounded-control px-2.5 text-sm text-fg pointer-coarse:h-11 outline-none data-[selected=true]:bg-accent-tint data-[selected=true]:shadow-[inset_2px_0_0_var(--accent)] [&_svg:not([data-state-glyph])]:size-4 [&_svg:not([data-state-glyph])]:text-muted"
    >
      <span className="grid w-4 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {meta}
      {shortcut ? <span className="flex gap-1">{shortcut.split(" ").map((k) => <Kbd key={k}>{k}</Kbd>)}</span> : null}
    </Command.Item>
  );
}
