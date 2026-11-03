// A dialog opened from code (a menu item, a handler) has no Trigger for Radix to hand focus back to.
// The tracker remembers what had focus at the moment the dialog OPENED and returns focus there when it
// closes, then forgets it, so the next open starts clean.

type Focusable = { isConnected: boolean; focus: () => void };

export function createFocusReturn(active: () => unknown) {
  let invoker: unknown = null;
  return {
    /** Call once, as the dialog opens (its content mounts). Later calls while open keep the first. */
    capture() { if (invoker === null) invoker = active(); },
    /** Call from onCloseAutoFocus. Returns true when focus was returned and Radix's default should be skipped. */
    restore(isBody: (el: unknown) => boolean = () => false): boolean {
      const el = invoker as Focusable | null;
      invoker = null;
      if (!el || typeof el.focus !== "function" || isBody(el) || !el.isConnected) return false;
      el.focus();
      return true;
    },
  };
}
