import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// One dialog primitive: role, label, focus trap, focus return and Esc come
// from Radix. Sheets are the same primitive anchored to the right edge.
export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  side = "center",
  hideClose = false,
  onCloseAutoFocus,
  ...props
}: Omit<React.ComponentProps<typeof D.Content>, "title"> & { title: React.ReactNode; description?: React.ReactNode; side?: "center" | "right"; hideClose?: boolean }) {
  // Most dialogs here are opened from code (a menu item, a button's handler), with no Trigger for Radix
  // to hand focus back to. Remember what had focus when this opened and return it on close.
  const invoker = React.useRef<Element | null>(null);
  if (invoker.current === null && typeof document !== "undefined") invoker.current = document.activeElement;
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim data-[state=open]:animate-fade" />
      <D.Content
        className={cn(
          "fixed z-(--z-overlay) flex flex-col border border-line bg-overlay text-fg shadow-pop outline-none",
          side === "center" &&
            "left-1/2 top-[12vh] max-h-[76vh] w-[calc(100vw-24px)] max-w-[520px] -translate-x-1/2 rounded-dialog data-[state=open]:animate-pop",
          side === "right" &&
            "inset-y-0 right-0 h-full w-full max-w-[600px] border-y-0 border-r-0 sm:rounded-l-dialog data-[state=open]:animate-sheet",
          className,
        )}
        {...props}
        onCloseAutoFocus={(e) => {
          onCloseAutoFocus?.(e);
          if (e.defaultPrevented) return;
          const el = invoker.current;
          if (el instanceof HTMLElement && el !== document.body && el.isConnected) { e.preventDefault(); el.focus(); }
        }}
      >
        <div className="flex items-start gap-3 px-5 pb-1 pt-4">
          <div className="min-w-0 flex-1">
            <D.Title className="text-lg font-semibold">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>}
          </div>
          {hideClose ? null : (
            <D.Close className="-mr-1 mt-0.5 inline-flex size-8 items-center justify-center rounded-control pointer-coarse:size-11 text-muted transition-colors duration-(--duration-fast) hover:bg-raised hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </D.Close>
          )}
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-3", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-end gap-2 border-t border-line px-5 py-3", className)} {...props} />;
}
