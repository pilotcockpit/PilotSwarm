import * as React from "react";
import { DropdownMenu as M } from "radix-ui";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuGroup = M.Group;

export function MenuContent({ className, align = "end", sideOffset = 6, ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={sideOffset}
        className={cn("z-(--z-overlay) min-w-[220px] overflow-hidden rounded-pane border border-line bg-overlay p-1 text-sm text-fg shadow-pop outline-none data-[state=open]:animate-pop", className)}
        {...props}
      />
    </M.Portal>
  );
}

export function MenuItem({ className, danger, icon, hint, children, ...props }: React.ComponentProps<typeof M.Item> & { danger?: boolean; icon?: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <M.Item
      className={cn(
        "flex min-h-[30px] items-center gap-2.5 rounded-control px-2 py-1 outline-none select-none data-[highlighted]:bg-accent-tint data-[highlighted]:shadow-[inset_2px_0_0_var(--accent)] data-[disabled]:opacity-45 [&_svg]:size-4 [&_svg]:text-muted",
        danger && "text-failed data-[highlighted]:bg-failed-tint data-[highlighted]:shadow-[inset_2px_0_0_var(--failed)] [&_svg]:text-failed",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block">{children}</span>
        {hint ? <span className={cn("block text-xs", danger ? "text-failed/80" : "text-faint")}>{hint}</span> : null}
      </span>
    </M.Item>
  );
}

export function MenuLabel({ className, ...props }: React.ComponentProps<typeof M.Label>) {
  return <M.Label className={cn("px-2 pb-1 pt-1.5 text-xs text-faint", className)} {...props} />;
}

export function MenuSeparator({ className, ...props }: React.ComponentProps<typeof M.Separator>) {
  return <M.Separator className={cn("my-1 h-px bg-line", className)} {...props} />;
}
