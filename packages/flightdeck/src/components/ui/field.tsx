import * as React from "react";
import { cn } from "@/lib/utils";

/** A labelled form control: label above, hint below, error replaces the hint. Pass the control as a child. */
export function Field({ label, hint, error, children, className }: { label: React.ReactNode; hint?: React.ReactNode; error?: React.ReactNode; children: React.ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>; className?: string }) {
  const id = React.useId();
  const noteId = `${id}-note`;
  const note = error || hint;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-medium text-fg">{label}</label>
      {React.cloneElement(children, { id, "aria-describedby": note ? noteId : undefined, "aria-invalid": error ? true : undefined })}
      {note ? <p id={noteId} role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-failed" : "text-muted")}>{note}</p> : null}
    </div>
  );
}
