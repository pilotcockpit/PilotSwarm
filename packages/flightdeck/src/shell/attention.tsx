import * as React from "react";
import { useAttention } from "@/components/sidebar/use-attention";
import { useRouterState } from "@tanstack/react-router";
import { pageMetadata } from "@/lib/page-metadata";

/**
 * One owner for route titles, descriptions and the existing attention prefix.
 * Social tags stay generic; no workspace content is copied into the head.
 */
export function AttentionTitle() {
  const count = useAttention().items.length;
  const path = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const base = React.useRef<{ title: string; description: string } | null>(null);
  React.useEffect(() => {
    const description = document.querySelector('meta[name="description"]');
    if (base.current === null) base.current = { title: document.title.replace(/^\(\d+\)\s*/, ""), description: description?.getAttribute("content") || "" };
    const metadata = pageMetadata(path, search);
    document.title = count ? `(${count}) ${metadata.title}` : metadata.title;
    description?.setAttribute("content", metadata.description);
  }, [count, path, search]);
  React.useEffect(() => () => {
    if (!base.current) return;
    document.title = base.current.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", base.current.description);
  }, []);
  return null;
}
