/**
 * Put text into the session composer and focus it: used by example prompts that live
 * outside the chat pane (the empty Canvas view). Works with the textarea's own state
 * because it goes through the native setter and an input event, the way typing would.
 */
export function fillComposer(text: string) {
  const ta = document.querySelector<HTMLTextAreaElement>(".fd-composer textarea");
  if (!ta) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(ta, text);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  ta.focus();
  return true;
}
