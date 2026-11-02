import { cn } from "@/lib/utils";

const illustrations = {
  library: { src: "/assets/library-paper-guide.webp", height: 416 },
  outputs: { src: "/assets/outputs-paper-portfolio.webp", height: 571 },
  boards: { src: "/assets/boards-paper-panels.webp", height: 416 },
} as const;

/** Decorative orientation art, never a substitute for live output or status. */
export function ProductIllustration({ kind, compact = false }: {
  kind: keyof typeof illustrations;
  compact?: boolean;
}) {
  const { src, height } = illustrations[kind];
  return <img src={src} alt="" aria-hidden="true" width={624} height={height}
    loading="lazy" decoding="async" draggable={false}
    className={cn("pointer-events-none h-auto shrink-0 select-none", compact ? "w-20 sm:w-40" : "w-36 sm:w-44")} />;
}
