import * as React from "react";

/**
 * The text a person is typing as a new title, kept apart from the title the server has. The server's title can
 * change while they type (another person renames the session; a poll brings it in). That must never rewrite
 * what they are typing, so a draft remembers the title it started from and the screen compares.
 */
export interface RenameDraft { baseline: string; text: string }

export const beginDraft = (serverTitle: string): RenameDraft => ({ baseline: serverTitle, text: serverTitle });

/** True when the server's title is no longer the one this draft started from. */
export const changedUnderneath = (draft: RenameDraft, serverTitle: string) => serverTitle !== draft.baseline;

/** What saving means right now: nothing to do, or a rename (noting the other person's title it would replace). */
export type SaveOutcome = { kind: "noop" } | { kind: "rename"; next: string; replaced: string | null };

export function saveOutcome(draft: RenameDraft, serverTitle: string): SaveOutcome {
  const next = draft.text.trim();
  if (!next || next === serverTitle) return { kind: "noop" };
  return { kind: "rename", next, replaced: changedUnderneath(draft, serverTitle) ? serverTitle : null };
}

/**
 * A draft that starts when `active` turns on and ignores later server titles until it turns off. While it is
 * not active it simply follows the server's title, so the next edit starts from what is current.
 */
export function useRenameDraft(serverTitle: string, active: boolean) {
  const [draft, setDraft] = React.useState<RenameDraft>(() => beginDraft(serverTitle));
  // Only turning on starts a draft; a title that changes while it is on is a notice, not a reset.
  React.useEffect(() => { setDraft(beginDraft(serverTitle)); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (!active) setDraft(beginDraft(serverTitle)); }, [serverTitle, active]);
  return {
    text: draft.text,
    setText: (text: string) => setDraft((d) => ({ ...d, text })),
    changedUnderneath: active && changedUnderneath(draft, serverTitle),
    /** Take the other person's title as the new starting point. */
    useTheirs: () => setDraft(beginDraft(serverTitle)),
    reset: () => setDraft(beginDraft(serverTitle)),
    outcome: () => saveOutcome(draft, serverTitle),
  };
}
