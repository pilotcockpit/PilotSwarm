import { beforeEach, describe, expect, it } from "vitest";
import { markPending, pendingFor, PENDING_MS, resetPending } from "./pending-model";

const session = (o: object = {}): any => ({ sessionId: "s1", model: "a:m", reasoningEffort: "high", contextTier: "standard", ...o });
const prev = { model: "a:m", effort: "high", tier: "standard" };
const want = { model: "a:m", effort: "low", tier: "standard" };

describe("a model change is pending until the session reports it", () => {
  beforeEach(() => resetPending());
  it("is pending while the session still shows the old setting", () => {
    markPending("s1", want, prev, 1000);
    expect(pendingFor(session(), 2000)?.want).toEqual(want);
  });
  it("is over once the session shows the whole new setting (all three dimensions)", () => {
    markPending("s1", want, prev, 1000);
    expect(pendingFor(session({ reasoningEffort: "low" }), 2000)).toBeNull();
    expect(pendingFor(session({ reasoningEffort: "low", contextTier: "extended" }), 2000)?.want).toEqual(want); // tier differs: not adopted
  });
  it("is not believed forever", () => {
    markPending("s1", want, prev, 1000);
    expect(pendingFor(session(), 1000 + PENDING_MS + 1)).toBeNull();
  });
  it("belongs to one session", () => {
    markPending("s1", want, prev, 1000);
    expect(pendingFor(session({ sessionId: "s2" }), 2000)).toBeNull();
  });
});
