import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-control w-full rounded-control border border-line-strong bg-surface px-2.5 text-sm text-fg placeholder:text-faint outline-none transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-none rounded-control border border-line-strong bg-surface px-3 py-2 text-base text-fg placeholder:text-faint outline-none focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
        className,
      )}
      {...props}
    />
  );
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-fg", className)} {...props} />;
}
