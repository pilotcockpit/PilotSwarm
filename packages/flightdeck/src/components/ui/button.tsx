import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// primary (one per screen), default, quiet, danger, link; sm 26 / md 30. Two heights, so the eye can trust them.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium select-none transition-colors duration-(--duration-fast) ease-out-fd disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent/90 font-semibold",
        default: "border border-line-strong bg-surface text-fg hover:bg-raised",
        quiet: "text-muted hover:bg-raised hover:text-fg",
        danger: "border border-failed text-failed hover:bg-failed-tint",
        link: "text-accent hover:underline underline-offset-2 px-0 h-auto min-h-6",
      },
      size: {
        sm: "h-[26px] px-2 text-xs pointer-coarse:h-11 pointer-coarse:min-w-11 pointer-coarse:px-3",
        md: "h-control px-2.5 text-sm pointer-coarse:min-w-11",
        icon: "size-control p-0",
        "icon-sm": "size-[26px] p-0 [&_svg]:size-3.5 pointer-coarse:size-11",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp ref={ref} type={asChild ? undefined : type || "button"} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
