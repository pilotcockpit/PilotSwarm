import { expect, test } from "@playwright/test";
import { gotoDemo, shot, withMotion } from "./helpers";

// With real motion (the desktop-light-motion project) arrival animations play out and data arrives late.
// This measures Cumulative Layout Shift from first paint until the page is at rest: cards that animate in
// must not push content that is already on screen. Under reduced motion there is nothing to measure.

for (const [name, path] of [["Home", "/"], ["Fleet", "/boards?board=fleet"]] as const) {
  test(`${name}: the page does not shift after it arrives (CLS under 0.01)`, async ({ page }, info) => {
    test.skip(!withMotion(info), "layout shift is measured with real motion only");
    await page.addInitScript(() => {
      (window as any).__cls = { value: 0, entries: [] as Array<{ value: number; at: number }> };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as any[]) {
          if (e.hadRecentInput) continue;                       // a shift right after a person's own input is expected
          (window as any).__cls.value += e.value;
          (window as any).__cls.entries.push({ value: e.value, at: Math.round(e.startTime) });
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await gotoDemo(page, path, info);
    await page.waitForTimeout(1500);                            // late data and staggered arrivals finish
    const cls = await page.evaluate(() => (window as any).__cls as { value: number; entries: Array<{ value: number; at: number }> });
    await shot(page, info, `cls-${name.toLowerCase()}`);
    expect(cls.value, `layout shifts: ${JSON.stringify(cls.entries)}`).toBeLessThan(0.01);
  });
}
