import * as React from "react";
import { Tooltip as T } from "radix-ui";
import { cn } from "@/lib/utils";

export const TooltipProvider = T.Provider;

export function Tooltip({ content, children, side = "top", className }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left"; className?: string }) {
  if (!content) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className={cn("z-[60] max-w-[280px] rounded-control border border-line bg-overlay px-2 py-1 text-xs text-fg shadow-pop data-[state=delayed-open]:animate-fade data-[state=instant-open]:animate-fade", className)}>
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
