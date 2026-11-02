// What follows a person from one browser to the next: their pins and the failures they dismissed. Both live in
// the profile settings document the server keeps per person (getCurrentUserProfile / setCurrentUserProfileSettings),
// so they roam with the account instead of the browser.
//
// The server REPLACES that document on every write, so every write here reads the current document first,
// changes only its own keys and writes the whole thing back, with writes from this page queued in order.
// Pins use the classic portal's own `pinnedSessionIds` key, so the two portals show the same pins.
// Dismissals use one `flightdeck` key. Two devices changing the same list inside the same few hundred
// milliseconds can still lose one change; a pin or a dismissal is cheap to repeat, so there is no lock.

export type Settings = Record<string, unknown>;

export const PINS_KEY = "pinnedSessionIds";
export const FLIGHTDECK_KEY = "flightdeck";
export const MAX_PINS = 100;
export const MAX_DISMISSED = 200;
export const MAX_PINNED_PROJECTS = 50;

const isPlain = (v: unknown): v is Settings => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** The settings document from a profile answer; anything of the wrong shape reads as empty. */
export const settingsOf = (profile: unknown): Settings => (isPlain(profile) && isPlain(profile.profileSettings) ? profile.profileSettings : {});

export function readPins(settings: Settings): string[] {
  const raw = settings[PINS_KEY];
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const v of raw) { const id = typeof v === "string" ? v.trim() : ""; if (id) seen.add(id); }
  return [...seen].slice(0, MAX_PINS);
}

export function readDismissed(settings: Settings): Record<string, number> {
  const fd = settings[FLIGHTDECK_KEY];
  const raw = isPlain(fd) && isPlain(fd.dismissed) ? fd.dismissed : {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) if (k && typeof v === "number" && Number.isFinite(v)) out[k] = v;
  return out;
}

export function withPins(settings: Settings, ids: readonly string[]): Settings {
  return { ...settings, [PINS_KEY]: [...new Set(ids.map((i) => i.trim()).filter(Boolean))].slice(0, MAX_PINS) };
}

/** Pin appends, unpin removes; the rest of the list keeps the order the person gave it. */
export function withPin(settings: Settings, id: string, on: boolean): Settings {
  const rest = readPins(settings).filter((x) => x !== id);
  return withPins(settings, on ? [...rest, id] : rest);
}

/** Remember a dismissal. Only the newest MAX_DISMISSED are kept, so the document cannot grow without bound. */
export function withDismissed(settings: Settings, key: string, at: number): Settings {
  const kept = Object.entries({ ...readDismissed(settings), [key]: at }).sort((a, b) => b[1] - a[1]).slice(0, MAX_DISMISSED);
  const fd = isPlain(settings[FLIGHTDECK_KEY]) ? settings[FLIGHTDECK_KEY] : {};
  return { ...settings, [FLIGHTDECK_KEY]: { ...fd, v: 1, dismissed: Object.fromEntries(kept) } };
}

/** Pinned projects, in the order they were pinned. Sessions are pinned in `pinnedSessionIds`; a project is not a session, so it has its own list. */
export function readPinnedProjects(settings: Settings): string[] {
  const fd = settings[FLIGHTDECK_KEY];
  const raw = isPlain(fd) && Array.isArray(fd.pinnedProjects) ? fd.pinnedProjects : [];
  return [...new Set(raw.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean))].slice(0, MAX_PINNED_PROJECTS);
}

export function withPinnedProject(settings: Settings, id: string, on: boolean): Settings {
  const rest = readPinnedProjects(settings).filter((x) => x !== id);
  const fd = isPlain(settings[FLIGHTDECK_KEY]) ? settings[FLIGHTDECK_KEY] : {};
  return { ...settings, [FLIGHTDECK_KEY]: { ...fd, v: 1, pinnedProjects: (on ? [...rest, id] : rest).slice(0, MAX_PINNED_PROJECTS) } };
}

/** Take a dismissal back (Undo): the failure shows in Needs you again. */
export function withoutDismissed(settings: Settings, key: string): Settings {
  const { [key]: _gone, ...rest } = readDismissed(settings);
  const fd = isPlain(settings[FLIGHTDECK_KEY]) ? settings[FLIGHTDECK_KEY] : {};
  return { ...settings, [FLIGHTDECK_KEY]: { ...fd, v: 1, dismissed: rest } };
}

type Call = (op: string, params?: Record<string, unknown>) => Promise<any>;

/**
 * Writes that read the latest document, apply one change and write it back, one at a time. Returns the
 * document as written, so the page can show exactly what the server now holds.
 */
export function createSettingsWriter(call: Call) {
  let tail: Promise<unknown> = Promise.resolve();
  return (mutate: (current: Settings) => Settings): Promise<Settings> => {
    const run = tail.catch(() => undefined).then(async () => {
      const next = mutate(settingsOf(await call("getCurrentUserProfile")));
      await call("setCurrentUserProfileSettings", { settings: next });
      return next;
    });
    tail = run;
    return run;
  };
}
