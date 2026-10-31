import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, type Rendered } from "@/test/render";
import { Providers, stubSource } from "@/test/harness";

vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { success: () => 0, error: vi.fn(), dismiss: () => undefined }) }));
// The people picker is cmdk, which needs a real DOM; this test is about Undo, so it is a plain stand-in.
vi.mock("cmdk", () => {
  const box = (type: string) => ({ children }: any) => React.createElement(type, null, children);
  return { Command: Object.assign(box("div"), { Input: () => null, List: box("div"), Empty: box("div"), Item: box("div"), Group: box("div") }) };
});
(globalThis as any).window = globalThis;
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

import { DialogUndoHost } from "@/lib/undo";
import { ManagePanel } from "./share-sheet";

// The REAL share panel and the REAL Undo host. Narrowing who can see a session applies at once with an
// Undo; a second narrowing must retire the first one's Undo, and an Undo whose state moved on must refuse.

function setup(start: string) {
  const server = { visibility: start };
  const { source, calls } = stubSource({
    getSessionAccess: () => ({ visibility: server.visibility, relation: "owner", canWrite: true, canManage: true, owner: { provider: "dev", subject: "me", displayName: "Me" } }),
    listSessionShares: () => ({ shares: [] }),
    listKnownUsers: () => [],
    setSessionVisibility: (p: any) => { server.visibility = p.visibility; return { visibility: p.visibility }; },
  });
  function View() {
    const [, bump] = React.useState(0);
    React.useEffect(() => { const t = setInterval(() => bump((n) => n + 1), 5); return () => clearInterval(t); }, []);
    return <><ManagePanel session={{ sessionId: "s1", title: "Session" } as any} /><DialogUndoHost /></>;
  }
  return { server, calls, mount: () => render(<Providers source={source}><View /></Providers>) };
}
const radio = (r: Rendered, label: string) => r.find((n) => n.props.role === "radio" && r.text(n).includes(label));
const undos = (r: Rendered) => r.findAll((n) => n.type === "button" && r.text(n).trim() === "Undo");
const writes = (calls: Array<{ op: string; params: any }>) => calls.filter((c) => c.op === "setSessionVisibility").map((c) => c.params.visibility);

describe("sharing visibility Undo", () => {
  it("undoes only the latest narrowing", async () => {
    const t = setup("shared_write");
    const r = await t.mount(); await r.flush(8);
    await r.fire(radio(r, "view"), "onClick"); await r.flush(8);                 // shared_write -> shared_read
    await r.fire(radio(r, "Only people"), "onClick"); await r.flush(8);          // shared_read -> private
    expect(writes(t.calls).length).toBe(2);
    expect(undos(r)).toHaveLength(1);
    await r.fire(undos(r)[0], "onClick"); await r.flush(8);
    expect(writes(t.calls).at(-1)).toBe("shared_read");                          // not back to shared_write
    await r.unmount();
  });

  it("refuses to undo when the visibility was changed elsewhere in the meantime", async () => {
    const t = setup("shared_read");
    const r = await t.mount(); await r.flush(8);
    await r.fire(radio(r, "Only people"), "onClick"); await r.flush(8);          // shared_read -> private
    t.server.visibility = "shared_write";                                        // somebody widened it again
    const before = writes(t.calls).length;
    await r.fire(undos(r)[0], "onClick"); await r.flush(8);
    expect(writes(t.calls).length).toBe(before);                                 // nothing written back
    await r.unmount();
  });
});
