import { FolderClosed, FolderOpen, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The icon for a project, wherever one is named: a closed folder, and an open one while its sessions are showing.
 * The same pair is used under Pinned, in Projects, in menus and on the Sessions page. A session's working folder
 * (the directory its agent reads and writes) has its own icon, FolderGit2, so the two never look alike.
 */
export function ProjectIcon({ open = false, className, label }: { open?: boolean; className?: string; label?: string }) {
  const Icon = open ? FolderOpen : FolderClosed;
  return <Icon className={cn("size-4 shrink-0", className)} strokeWidth={1.5} {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} />;
}

/** The icon for a session where it needs saying what kind of thing it is (a list that mixes sessions and projects). */
export function SessionIcon({ className }: { className?: string }) {
  return <MessageCircle className={cn("size-4 shrink-0", className)} strokeWidth={1.5} aria-hidden />;
}
