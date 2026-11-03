import * as React from "react";
import { cn } from "@/lib/utils";

const OTHER = "\u0000other";

/**
 * One control for "where": a location (a root the deployment exports) and a path inside it, drawn as a single
 * path, `work / projects/flight-deck`. The location is a picker over the roots the server lists, so a wrong one
 * cannot be typed by mistake; with no roots listed it falls back to text. The list comes from the portal's file
 * browser and the worker has the last word on what a location is, so "Other location…" turns the picker into a text
 * box (with the listed ones as suggestions). A location the record already uses stays in the list even if the server
 * stopped listing it, marked as not listed. Pass it to Field, which supplies id and the
 * description/invalid wiring, and these go to the path input.
 */
export function PathField({ root, onRoot, folder, onFolder, roots, label, id, invalid, placeholder = "path inside the location", ...aria }: {
  root: string; onRoot: (v: string) => void; folder: string; onFolder: (v: string) => void; roots: readonly string[]; label: string;
  id?: string; invalid?: boolean; placeholder?: string; "aria-describedby"?: string; "aria-invalid"?: boolean;
}) {
  const listed = roots.includes(root);
  const [typing, setTyping] = React.useState(false);
  const listId = React.useId();
  return (
    <div className={cn("flex h-control min-w-0 items-stretch overflow-hidden rounded-control border bg-surface pointer-coarse:h-11", invalid || aria["aria-invalid"] ? "border-failed" : "border-line-strong focus-within:border-accent")}>
      {roots.length && !typing ? (
        <select aria-label={`${label}: location`} value={root} onChange={(e) => (e.target.value === OTHER ? setTyping(true) : onRoot(e.target.value))} className="max-w-[40%] shrink-0 cursor-pointer border-0 bg-raised py-0 pl-2.5 pr-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
          {root === "" ? <option value="" disabled>Choose a location</option> : null}
          {roots.map((r) => <option key={r} value={r}>{r}</option>)}
          {root && !listed ? <option value={root}>{root} (not listed)</option> : null}
          <option value={OTHER}>Other location…</option>
        </select>
      ) : (
        <input aria-label={`${label}: location`} value={root} onChange={(e) => onRoot(e.target.value)} placeholder="location" list={roots.length ? listId : undefined} autoFocus={typing} autoComplete="off" spellCheck={false} className="w-28 shrink-0 border-0 bg-raised px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent" />
      )}
      {roots.length && typing ? <datalist id={listId}>{roots.map((r) => <option key={r} value={r} />)}</datalist> : null}
      <span className="grid shrink-0 place-items-center px-1.5 text-muted" aria-hidden>/</span>
      <input id={id} aria-label={undefined} value={folder} onChange={(e) => onFolder(e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false} aria-describedby={aria["aria-describedby"]} aria-invalid={aria["aria-invalid"]} className="min-w-0 flex-1 border-0 bg-transparent pr-2.5 font-mono text-sm outline-none placeholder:font-sans placeholder:text-faint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent" />
    </div>
  );
}
