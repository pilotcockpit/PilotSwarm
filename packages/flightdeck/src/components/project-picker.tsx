import * as React from "react";
import { Command } from "cmdk";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { ProjectIcon } from "@/components/project-icon";
import { NewProjectDialog } from "@/components/project-dialogs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/misc";
import { DEFAULT_PROJECT_NAME } from "@/data/session-tree";
import { cn } from "@/lib/utils";

/**
 * Choose the project a new session is filed in: a chip showing the current one, which opens a searchable list of the
 * person's projects with "New project" and "Don't work in a project" at the bottom. An empty value is no project.
 * A project made here is chosen at once.
 */
export function ProjectPicker({ value, onChange, projects, className }: { value: string; onChange: (id: string) => void; projects: ReadonlyArray<{ id: string; name: string }>; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  // A project made a moment ago may not be in the list yet; keep its name until it is.
  const [made, setMade] = React.useState<{ id: string; name: string } | null>(null);
  const current = projects.find((p) => p.id === value) ?? (made && made.id === value ? made : null);
  const choose = (id: string) => { onChange(id); setOpen(false); };
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="default" size="sm" className={cn("max-w-full", className)} aria-label={`Project: ${current?.name ?? DEFAULT_PROJECT_NAME}. Change it`}>
            <ProjectIcon className="size-3.5" />
            <span className="min-w-0 truncate">{current?.name ?? DEFAULT_PROJECT_NAME}</span>
            <ChevronDown className="!size-3 shrink-0" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" onOpenAutoFocus={(e) => e.stopPropagation()}>
          <Command label="Choose a project" className="flex max-h-[min(24rem,70vh)] flex-col">
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 shrink-0 text-faint" aria-hidden />
              <Command.Input autoFocus placeholder="Search projects" className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-faint pointer-coarse:h-12" />
            </div>
            <Command.List className="min-h-0 flex-1 overflow-y-auto p-1.5">
              <Command.Empty className="px-2.5 py-3 text-sm text-muted">No project matches.</Command.Empty>
              {projects.map((p) => (
                <Row key={p.id} value={p.name} onSelect={() => choose(p.id)}>
                  <ProjectIcon className="text-muted" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.id === value ? <Check className="size-4 shrink-0 text-accent" aria-label="Chosen" /> : null}
                </Row>
              ))}
              <div className="my-1 h-px bg-line" role="separator" />
              {/* These stay while the list is filtered. */}
              <Row value="new project create" forceMount onSelect={() => { setOpen(false); setCreating(true); }}>
                <Plus className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="flex-1">New project</span>
              </Row>
              <Row value="no project none dont work in a project" forceMount onSelect={() => choose("")}>
                <X className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="flex-1">Don't work in a project</span>
                {!value ? <Check className="size-4 shrink-0 text-accent" aria-label="Chosen" /> : null}
              </Row>
            </Command.List>
          </Command>
        </PopoverContent>
      </Popover>
      <NewProjectDialog open={creating} onOpenChange={setCreating} existing={projects.map((p) => p.name)} onCreated={(id, name) => { if (id) { setMade({ id, name }); onChange(id); } }} />
    </>
  );
}

function Row({ children, value, onSelect, forceMount }: { children: React.ReactNode; value: string; onSelect: () => void; forceMount?: boolean }) {
  return (
    <Command.Item value={value} onSelect={onSelect} forceMount={forceMount} className="flex min-h-9 cursor-default items-center gap-2.5 rounded-control px-2.5 text-sm outline-none pointer-coarse:min-h-11 data-[selected=true]:bg-accent-tint">
      {children}
    </Command.Item>
  );
}
