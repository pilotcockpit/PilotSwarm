import * as React from "react";
import { StateGlyph } from "@/components/state";
import type { StateKey } from "@/data/state";
import { cn } from "@/lib/utils";

/**
 * One line of an admin health list: a state glyph, what is true, what it means, and the one action
 * that fixes it. The Overview, Knowledge and Maintenance pages all read the same way.
 */
export function StatusRow({ state, title, detail, action, className }: { state: StateKey; title: React.ReactNode; detail?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start gap-x-3 gap-y-2 border-t border-line-subtle px-4 py-3 first:border-t-0", className)}>
      <span className="mt-1.5"><StateGlyph state={state} pulse={false} /></span>
      <div className="min-w-0 flex-1 basis-60">
        <div className="text-sm font-medium">{title}</div>
        {detail ? <div className="text-sm text-muted">{detail}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:basis-full max-sm:pl-6">{action}</div> : null}
    </div>
  );
}
