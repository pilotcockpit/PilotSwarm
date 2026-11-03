/** True for anything the person types into: list key handlers must leave those alone. */
export function isEditable(target: EventTarget | null): boolean {
  const el = target as { closest?: (selector: string) => unknown } | null;
  return typeof el?.closest === "function" && el.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']") != null;
}
