import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "narrow" });

/** "now", "4m ago", "3h ago", "2d ago": short relative time in the viewer's locale. */
export function ago(at: number | string | Date | null | undefined, now = Date.now()): string {
  const ms = toMs(at);
  if (!ms) return "—";
  const s = Math.round((ms - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return "now";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

/** "in 6m", "in 11h 45m": time until a future moment. */
export function until(at: number | string | Date | null | undefined, now = Date.now()): string {
  const ms = toMs(at);
  if (!ms) return "";
  const mins = Math.max(0, Math.round((ms - now) / 60000));
  if (mins < 1) return "in <1m";
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `in ${h}h ${m}m` : `in ${h}h`;
  return `in ${Math.round(h / 24)}d`;
}

export function clock(at: number | string | Date | null | undefined): string {
  const ms = toMs(at);
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function dayLabel(at: number | string | Date | null | undefined): string {
  const ms = toMs(at);
  if (!ms) return "";
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function toMs(at: number | string | Date | null | undefined): number {
  if (at == null || at === "") return 0;
  if (typeof at === "number") return at;
  const n = at instanceof Date ? at.getTime() : new Date(at).getTime();
  return Number.isFinite(n) ? n : 0;
}

/** 4.2M, 980k, 12: compact token counts. */
export function tokens(n: number | null | undefined): string {
  const v = Number(n) || 0;
  if (v >= 1e9) return `${trim(v / 1e9)}B`;
  if (v >= 1e6) return `${trim(v / 1e6)}M`;
  if (v >= 1e3) return `${trim(v / 1e3)}k`;
  return String(Math.round(v));
}
function trim(v: number) {
  return v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, "");
}

export function bytes(n: number | null | undefined): string {
  const v = Number(n) || 0;
  if (v >= 1048576) return `${(v / 1048576).toFixed(1)} MB`;
  if (v >= 1024) return `${Math.round(v / 1024)} KB`;
  return `${v} B`;
}

export function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function shortId(id: string | null | undefined) {
  return String(id || "").slice(0, 8);
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function initials(name: string | null | undefined) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}
