import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { DisclosureButton } from "@/components/ui/button";
import { CountPill } from "@/components/count-pill";
import { cn } from "@/lib/utils";

/**
 * A top-level sidebar section: its name with a chevron after it, which folds the section (with `to`, the name is a link
 * to that page and only the chevron folds); a dot on the right
 * when something inside wants a look (shown while it is folded, since open sections show their own rows); and,
 * on hover or focus, its actions (a menu, a new-session button). Always visible on touch screens.
 */
export function SectionHeading({ id, title, badge, open, onToggle, dot, actions, to, search, onNavigate }: {
  id: string;
  title: string;
  /** A count that asks for attention, in a pill at the right edge: always visible, open or folded, so it also does the dot's job. */
  badge?: { count: number; label: string };
  open: boolean;
  onToggle: () => void;
  /** Says what the dot means, for people who cannot see it ("2 sessions need you"). Null: no dot. */
  dot?: string | null;
  actions?: React.ReactNode;
  /** Makes the name a link to this page. */
  to?: "/projects";
  /** Filters to open the page with. */
  search?: { project?: string };
  onNavigate?: () => void;
}) {
  return (
    <div className="group/head flex items-center gap-0.5">
      <h2 id={id} className="flex min-w-0 flex-1 items-center">
        {to ? (
          <>
            <Link to={to} search={search} onClick={onNavigate} className="focus-inset inline-flex min-h-8 min-w-0 items-center rounded-control px-1.5 text-sm font-medium text-muted hover:bg-raised/60 hover:text-fg pointer-coarse:min-h-11"><span className="truncate">{title}</span></Link>
            <DisclosureButton aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${title}`} onClick={onToggle} className="size-7 shrink-0 justify-center rounded-control px-0 text-muted hover:bg-raised/60 hover:text-fg pointer-coarse:size-11">
              <ChevronRight className={cn("size-3.5 shrink-0 transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden />
            </DisclosureButton>
          </>
        ) : (
          <DisclosureButton aria-expanded={open} onClick={onToggle} className="w-full gap-1 rounded-control px-1.5 text-sm font-medium text-muted hover:bg-raised/60 hover:text-fg">
            <span className="truncate">{title}</span>
            <ChevronRight className={cn("size-3.5 shrink-0 transition-transform duration-(--duration-fast)", open && "rotate-90")} aria-hidden />
          </DisclosureButton>
        )}
      </h2>
      {actions ? <div className="flex shrink-0 items-center opacity-0 transition-opacity duration-(--duration-fast) group-hover/head:opacity-100 group-focus-within/head:opacity-100 pointer-coarse:opacity-100">{actions}</div> : null}
      {badge && badge.count > 0 ? (
        <CountPill count={badge.count} label={badge.label} className="mx-1.5" />
      ) : dot && !open ? <span className="mx-2 size-2 shrink-0 rounded-full bg-accent" role="img" aria-label={dot} title={dot} /> : <span className="mx-2 size-2 shrink-0" aria-hidden />}
    </div>
  );
}
