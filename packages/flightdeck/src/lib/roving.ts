import type React from "react";

/**
 * Arrow-key movement for a tablist or radiogroup built from buttons: Left/Up
 * and Right/Down move focus and select, Home/End jump to the ends. Pair it
 * with tabIndex 0 on the selected item and -1 on the rest.
 */
export function rovingKeyDown(role: "tab" | "radio") {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>(`[role="${role}"]:not([disabled])`)];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    e.preventDefault();
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (index + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
    items[next].focus();
    items[next].click();
  };
}
