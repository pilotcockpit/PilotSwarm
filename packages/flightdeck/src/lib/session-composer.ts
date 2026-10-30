interface ComposerSnapshot {
  text: string;
  queued: readonly string[];
  sending: boolean;
  stopping: boolean;
}

interface SendRequest {
  readonly text: string;
  readonly revision: number;
}

function createComposer() {
  let snapshot: ComposerSnapshot = { text: "", queued: [], sending: false, stopping: false };
  let revision = 0;
  let pending: SendRequest | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<ComposerSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((notify) => notify());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; },
    setText: (text: string) => { revision++; update({ text }); },
    dismissNotice: (index: number) => update({ queued: snapshot.queued.filter((_, i) => i !== index) }),
    beginSend: (): SendRequest | null => {
      const text = snapshot.text.trim();
      if (pending || !text) return null;
      pending = { text, revision };
      update({ sending: true });
      return pending;
    },
    finishSend: (request: SendRequest, result: "sent" | "queued" | "failed") => {
      if (request !== pending) return;
      pending = null;
      update({
        sending: false,
        text: result !== "failed" && revision === request.revision ? "" : snapshot.text,
        queued: result === "queued" ? [...snapshot.queued, request.text] : snapshot.queued,
      });
    },
    beginStop: () => {
      if (snapshot.stopping) return false;
      update({ stopping: true });
      return true;
    },
    finishStop: () => update({ stopping: false }),
  };
}

/** In-memory drafts and request ownership survive route changes, scoped to one data source. */
export function createSessionComposerMemory() {
  const sessions = new Map<string, ReturnType<typeof createComposer>>();
  return {
    session(id: string) {
      let composer = sessions.get(id);
      if (!composer) { composer = createComposer(); sessions.set(id, composer); }
      return composer;
    },
  };
}
