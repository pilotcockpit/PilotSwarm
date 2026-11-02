import * as React from "react";
import { useOpMutation, useOpQuery } from "./use-op";
import { useSource } from "@/data/source";

// A session's working folders: where the agent works (getSessionWorkspace, setSessionWorkspace),
// which folders the portal can serve (listSessionWorkspaceFolders) and one file call at a time
// (sessionWorkspaceFiles). Contents travel as base64; paths are relative to a folder.

export interface WorkspaceFolder {
  /** "working", or "extra:<name>". */
  id: string;
  name: string;
  role: "working" | "extra";
  /** The person's own default folder. */
  home: boolean;
  root: string;
  folder: string;
  /** A worker has opened it. Until then the agent has not touched the folder. */
  opened: boolean;
  /** Opened and this server serves its root. */
  available: boolean;
}

export interface FoldersInfo {
  enabled: boolean;
  maxBytes: number;
  /** Git changes can be shown. */
  git: boolean;
  folders: WorkspaceFolder[];
  roots: string[];
}

export interface WorkspaceRecord {
  root: string;
  folder?: string;
  /** `required: false` lets a turn run without that folder when it cannot be opened; the default holds the prompt. */
  extra?: Record<string, { root: string; folder?: string; required?: boolean }>;
}

export interface WorkspaceView {
  workspace: WorkspaceRecord | null;
  revision: number;
  turnRevision?: number | null;
  path: string | null;
  status: "none" | "ready" | "unavailable";
  lastError: { code: string; message: string; at?: string } | null;
  heldPrompts: number;
  adopted: { agents: string[]; skills: string[]; skipped: unknown[] } | null;
  defaults?: { workingFolder?: { root: string; folder?: string } | null; extra?: Array<{ name: string; root: string; folder?: string }> } | null;
}

export interface DirEntry {
  name: string;
  kind: "dir" | "file" | "link" | "other";
  size: number;
  mtimeMs: number;
  /** For a link: what it points at. */
  target?: "dir" | "file" | "other" | "outside" | "missing";
  readOnly?: boolean;
}

export const isDirEntry = (e: DirEntry) => e.kind === "dir" || (e.kind === "link" && e.target === "dir");

export type FileCall =
  | { op: "list" | "stat" | "read" | "mkdir"; folder: string; path?: string }
  | { op: "zip"; folder: string; path?: string; paths?: string[] }
  | { op: "find"; folder: string; path?: string; query: string }
  | { op: "write"; folder: string; path: string; contentBase64: string; ifMatch?: string | null; createParents?: boolean }
  | { op: "delete"; folder: string; path: string; recursive?: boolean }
  | { op: "move"; folder: string; path: string; toFolder?: string; toPath: string }
  | { op: "git"; folder: string; what: "status" | "log" | "show" | "file" | "compare" | "repos"; repo?: string; [k: string]: unknown };

export const FILE_CODES = {
  CONFLICT: "WORKSPACE_FILES_CONFLICT",
  EXISTS: "WORKSPACE_FILES_EXISTS",
  TOO_LARGE: "WORKSPACE_FILES_TOO_LARGE",
  NOT_FOUND: "WORKSPACE_FILES_NOT_FOUND",
  NOT_EMPTY: "WORKSPACE_FILES_NOT_EMPTY",
  READ_ONLY: "WORKSPACE_FILES_READ_ONLY",
  DISABLED: "WORKSPACE_FILES_DISABLED",
  NOT_OPENED: "WORKSPACE_FILES_NOT_OPENED",
  ROOT_UNAVAILABLE: "WORKSPACE_FILES_ROOT_UNAVAILABLE",
  TIMEOUT: "WORKSPACE_FILES_TIMEOUT",
  BUSY: "WORKSPACE_FILES_BUSY",
} as const;

export const errorCode = (e: any): string => String(e?.code ?? e?.body?.code ?? e?.data?.code ?? "");

/** What went wrong with a file call, in a sentence a person can act on. */
export function fileErrorText(e: any): string {
  switch (errorCode(e)) {
    case FILE_CODES.CONFLICT: return "Someone changed this file while you were editing it.";
    case FILE_CODES.EXISTS: return "Something with that name already exists here.";
    case FILE_CODES.TOO_LARGE: return "That file is larger than this server allows.";
    case FILE_CODES.NOT_FOUND: return "That file or folder is gone.";
    case FILE_CODES.NOT_EMPTY: return "That folder isn't empty.";
    case FILE_CODES.READ_ONLY: return "This location is read-only.";
    case FILE_CODES.DISABLED: return "Working folders aren't set up on this server.";
    case FILE_CODES.NOT_OPENED: return "The agent hasn't opened this folder yet. It opens on the session's next turn.";
    case FILE_CODES.ROOT_UNAVAILABLE: return "This server doesn't serve that folder's root.";
    case FILE_CODES.TIMEOUT: return "The folder took too long to answer. Try again.";
    case FILE_CODES.BUSY: return "The server is busy with other file requests. Try again in a moment.";
    default: return e?.message || "That didn't work.";
  }
}

// ── bytes and text ────────────────────────────────────────────────────────

const encoder = new TextEncoder();
const strictDecoder = new TextDecoder("utf-8", { fatal: true });

export function bytesFromBase64(value: string): Uint8Array {
  const binary = atob(value || "");
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** A file's text, or null when it is not UTF-8 (saving it as text would corrupt it). Keeps what saving must keep. */
export function readText(bytes: Uint8Array): { text: string; bom: boolean; crlf: boolean } | null {
  let text: string;
  try { text = strictDecoder.decode(bytes); } catch { return null; }
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const crlf = text.includes("\r\n") && !/(^|[^\r])\n/.test(text);
  return { text: bom ? text.replace(/^﻿/, "") : text, bom, crlf };
}

export function textToBase64(text: string, opts: { bom?: boolean; crlf?: boolean } = {}): string {
  const body = encoder.encode(opts.crlf ? text.replace(/\r?\n/g, "\r\n") : text);
  if (!opts.bom) return base64FromBytes(body);
  const out = new Uint8Array(body.length + 3);
  out.set([0xef, 0xbb, 0xbf]);
  out.set(body, 3);
  return base64FromBytes(out);
}

export function looksBinary(bytes: Uint8Array) {
  const end = Math.min(bytes.length, 8000);
  for (let i = 0; i < end; i++) if (bytes[i] === 0) return true;
  return false;
}

export const IMAGE_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", bmp: "image/bmp", ico: "image/x-icon" };
export const extOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");
export const joinPath = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);
export const dirOf = (path: string) => path.split("/").slice(0, -1).join("/");
export const baseName = (path: string) => path.split("/").pop() || path;

/** A name for a new file or folder, or the reason it can't be used. */
export function checkName(name: string): string | null {
  const n = name.trim();
  if (!n) return "Give it a name.";
  if (n === "." || n === "..") return "That name isn't allowed.";
  if (/[\\/\0]/.test(n)) return "A name can't contain / or \\.";
  if (n.length > 255) return "That name is too long.";
  return null;
}

// ── operations ────────────────────────────────────────────────────────────

/** Run one file call in a session's folder. Rejects with the server's error (see errorCode). */
export function useFileCall(sessionId: string) {
  const { source } = useSource();
  return React.useCallback(<T = any>(call: FileCall) => source.call<T>("sessionWorkspaceFiles", { sessionId, call }), [source, sessionId]);
}

export const workspaceKeys = {
  view: (sessionId: string) => ["workspace", sessionId, "view"] as const,
  folders: (sessionId: string) => ["workspace", sessionId, "folders"] as const,
  dir: (sessionId: string, folder: string, path: string) => ["workspace", sessionId, "dir", folder, path] as const,
  all: (sessionId: string) => ["workspace", sessionId] as const,
};

export const useWorkspaceView = (sessionId: string, opts?: { enabled?: boolean }) =>
  useOpQuery<WorkspaceView>(workspaceKeys.view(sessionId), "getSessionWorkspace", { sessionId }, { enabled: opts?.enabled, staleTime: 5_000 });

/** The folders this server can show for a session, or an error when the viewer is not the owner. */
export const useWorkspaceFolders = (sessionId: string) =>
  useOpQuery<FoldersInfo>(workspaceKeys.folders(sessionId), "listSessionWorkspaceFolders", { sessionId }, { staleTime: 5_000 });

export const useSetWorkspace = (sessionId: string) =>
  useOpMutation<{ expectedRevision: number; workspace: WorkspaceRecord | null }, { revision?: number }>("setSessionWorkspace", {
    params: (v) => ({ sessionId, expectedRevision: v.expectedRevision, workspace: v.workspace }),
    invalidate: [workspaceKeys.all(sessionId)],
    failure: "Couldn't change the working folder",
  });

export const useRetryWorkspace = (sessionId: string) =>
  useOpMutation<void, unknown>("retrySessionWorkspace", {
    params: () => ({ sessionId }),
    invalidate: [workspaceKeys.all(sessionId)],
    success: "Retrying. Held messages run as soon as the folder is ready.",
    failure: "Couldn't retry",
  });
