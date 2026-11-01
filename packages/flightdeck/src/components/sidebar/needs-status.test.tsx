import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@/test/render";
import { NeedsCountStatus } from "./needs-status";

(globalThis as any).window = globalThis;

describe("Needs-you count announcement", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  const live = (r: Awaited<ReturnType<typeof render>>) => r.find((n) => n.props?.role === "status");

  it("is silent on first render", async () => {
    const r = await render(<NeedsCountStatus count={3} />);
    await act(() => { vi.advanceTimersByTime(5000); });
    expect(r.text(live(r))).toBe("");
    await r.unmount();
  });
  it("says the new count politely after it settles, never the whole list", async () => {
    const r = await render(<NeedsCountStatus count={3} />);
    await r.rerender(<NeedsCountStatus count={2} />);
    await act(() => { vi.advanceTimersByTime(900); });
    expect(r.text(live(r))).toBe(""); // not yet: it waits for the number to settle
    await act(() => { vi.advanceTimersByTime(100); });
    expect(r.text(live(r))).toBe("2 sessions need you");
    expect(live(r).props["aria-live"]).toBe("polite");
    await r.unmount();
  });
  it("collapses a burst of changes into one announcement of the last count", async () => {
    const r = await render(<NeedsCountStatus count={3} />);
    await r.rerender(<NeedsCountStatus count={4} />);
    await act(() => { vi.advanceTimersByTime(400); });
    await r.rerender(<NeedsCountStatus count={1} />);
    await act(() => { vi.advanceTimersByTime(1000); });
    expect(r.text(live(r))).toBe("1 session needs you");
    await r.unmount();
  });
  it("says so when nothing needs you any more, and stays quiet when the count returns to what was announced", async () => {
    const r = await render(<NeedsCountStatus count={1} />);
    await r.rerender(<NeedsCountStatus count={0} />);
    await act(() => { vi.advanceTimersByTime(1000); });
    expect(r.text(live(r))).toBe("Nothing needs you now");
    await r.unmount();
  });
  it("leaves no timer behind on unmount", async () => {
    const r = await render(<NeedsCountStatus count={1} />);
    await r.rerender(<NeedsCountStatus count={2} />);
    await r.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
