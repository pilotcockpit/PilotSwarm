import { describe, expect, it } from "vitest";
import { createIntentBus } from "./intents";

const clock = () => { let t = 1000; return { now: () => t, advance: (ms: number) => { t += ms; } }; };

describe("intent bus", () => {
  it("is taken once, by the matching name and scope", () => {
    const bus = createIntentBus(clock().now);
    bus.request("share-session", "/s/A");
    expect(bus.take("share-session", "/s/A")).toBe(true);
    expect(bus.take("share-session", "/s/A")).toBe(false);
  });

  it("is not taken by another session mounted later", () => {
    const bus = createIntentBus(clock().now);
    bus.request("share-session", "/s/A");
    // The person leaves A before A's handler exists; B mounts and asks.
    expect(bus.take("share-session", "/s/B")).toBe(false);
    // A leaving also drops it, so even returning to A later finds nothing.
    bus.keepOnlyFor("/s/B");
    expect(bus.take("share-session", "/s/A")).toBe(false);
  });

  it("is not taken by a different intent name on the same screen", () => {
    const bus = createIntentBus(clock().now);
    bus.request("share-session", "/s/A");
    expect(bus.take("move-to-group", "/s/A")).toBe(false);
    expect(bus.take("share-session", "/s/A")).toBe(true);
  });

  it("expires after two seconds", () => {
    const c = clock();
    const bus = createIntentBus(c.now);
    bus.request("add-provider", "/providers");
    c.advance(1999);
    expect(bus.pending()).not.toBeNull();
    c.advance(1);
    expect(bus.take("add-provider", "/providers")).toBe(false);
    expect(bus.pending()).toBeNull();
  });

  it("is superseded by a newer request", () => {
    const bus = createIntentBus(clock().now);
    bus.request("add-provider", "/providers");
    bus.request("add-package", "/library");
    expect(bus.take("add-provider", "/providers")).toBe(false);
    expect(bus.take("add-package", "/library")).toBe(true);
  });

  it("survives navigation to its own target and is dropped by navigation elsewhere", () => {
    const bus = createIntentBus(clock().now);
    bus.request("add-provider", "/providers");
    bus.keepOnlyFor("/providers");
    expect(bus.pending()).not.toBeNull();
    bus.keepOnlyFor("/library");
    expect(bus.pending()).toBeNull();
  });

  it("notifies a mounted handler at once", () => {
    const bus = createIntentBus(clock().now);
    let ran = 0;
    bus.subscribe(() => { if (bus.take("find-file", "/s/A")) ran += 1; });
    bus.request("find-file", "/s/A");
    expect(ran).toBe(1);
    expect(bus.pending()).toBeNull();
  });
});
