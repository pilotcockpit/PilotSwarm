import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createFocusReturn } from "./focus-return";
import { DialogUndoHost } from "@/lib/undo";

// One dialog primitive: role, label, focus trap, focus return and Esc come
// from Radix. Sheets are the same primitive anchored to the right edge.
export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const inToast = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("[data-sonner-toaster]"));

export function DialogContent({
  className,
  children,
  title,
  description,
  side = "center",
  hideClose = false,
  undoHost = true,
  onCloseAutoFocus,
  onPointerDownOutside,
  onInteractOutside,
  ...props
}: Omit<React.ComponentProps<typeof D.Content>, "title"> & { title: React.ReactNode; description?: React.ReactNode; side?: "center" | "right" | "left"; hideClose?: boolean; undoHost?: boolean }) {
  // Most dialogs here are opened from code (a menu item, a button's handler), with no Trigger for Radix
  // to hand focus back to. The tracker remembers what had focus when the content MOUNTED (the moment the
  // dialog opens, not when this component first renders closed) and returns it on close.
  const focusReturn = React.useRef(createFocusReturn(() => (typeof document === "undefined" ? null : document.activeElement)));
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
          side === "left" &&
            "inset-y-0 left-0 h-full w-full max-w-80 border-y-0 border-l-0 sm:rounded-r-dialog data-[state=open]:animate-sheet-left",
          className,
        )}
        {...props}
        // A toast (Undo, Retry) is outside this dialog but is not "outside" in the sense of dismissing it:
        // pressing a toast's button must not close the sheet that raised the toast.
        onPointerDownOutside={(e) => { onPointerDownOutside?.(e); if (inToast(e.target)) e.preventDefault(); }}
        onInteractOutside={(e) => { onInteractOutside?.(e); if (inToast(e.target)) e.preventDefault(); }}
        onCloseAutoFocus={(e) => {
          onCloseAutoFocus?.(e);
          if (e.defaultPrevented) return;
          if (focusReturn.current.restore((el) => el === document.body)) e.preventDefault();
        }}
      >
        <CaptureInvoker tracker={focusReturn.current} />
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
        <DialogUndoHost enabled={undoHost} />
      </D.Content>
    </D.Portal>
  );
}

/** Mounts with the open dialog and, before Radix moves focus into it, records what had focus. */
function CaptureInvoker({ tracker }: { tracker: ReturnType<typeof createFocusReturn> }) {
  tracker.capture();
  return null;
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-3", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-end gap-2 border-t border-line px-5 py-3", className)} {...props} />;
}
