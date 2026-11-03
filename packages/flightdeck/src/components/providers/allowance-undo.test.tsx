import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, type Rendered } from "@/test/render";
import { Providers, stubSource } from "@/test/harness";

vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { success: () => 0, error: vi.fn(), dismiss: () => undefined }) }));
(globalThis as any).window = globalThis;

import { DialogUndoHost } from "@/lib/undo";
import { AllowanceControl } from "./limits";

// The REAL allowance control and the REAL Undo host, with a server whose allowance this test can change
// behind the control's back.

function setup(start = 100) {
  const server = { pct: start };
  const { source, calls } = stubSource({
    setProviderAllowance: (p: any) => { server.pct = p.pct; return { name: p.name, allowancePct: p.pct }; },
    getProviderUsageGrid: () => ({ rows: [{ providerName: "anthropic-wif", rowKind: "provider", scope: "*", allowancePct: server.pct, periods: {} }] }),
  });
  function View() {
    const [, bump] = React.useState(0);
    // What the screen does after a save: re-read the provider, so the control sees the new allowance.
    React.useEffect(() => { const t = setInterval(() => bump((n) => n + 1), 5); return () => clearInterval(t); }, []);
    return <><AllowanceControl provider={{ name: "anthropic-wif", typeId: "anthropic-wif", class: "shared", allowancePct: server.pct } as any} isAdmin monthQuota={null} /><DialogUndoHost /></>;
  }
  return { server, calls, mount: () => render(<Providers source={source}><View /></Providers>) };
}
const change = async (r: Rendered, pct: number) => {
  await r.fire(r.find((n) => n.type === "input" && n.props.type === "range"), "onChange", { target: { value: String(pct) } });
  await r.fire(r.find((n) => n.type === "button" && r.text(n).includes("Save allowance")), "onClick");
  await r.flush(8);
};
const undos = (r: Rendered) => r.findAll((n) => n.type === "button" && r.text(n).trim() === "Undo");
const sets = (calls: Array<{ op: string; params: any }>) => calls.filter((c) => c.op === "setProviderAllowance").map((c) => c.params.pct);

describe("allowance Undo", () => {
  it("undoes only the latest change, never an older one", async () => {
    const t = setup(100);
    const r = await t.mount();
    await change(r, 60);
    await change(r, 40);
    expect(undos(r)).toHaveLength(1);
    await r.fire(undos(r)[0], "onClick");
    await r.flush(8);
    expect(sets(t.calls)).toEqual([60, 40, 60]);        // restored the value before the LAST change, not 100
    await r.unmount();
  });

  it("refuses to undo when the allowance was changed by someone else in the meantime", async () => {
    const t = setup(100);
    const r = await t.mount();
    await change(r, 60);
    t.server.pct = 25;                                  // another admin
    await r.fire(undos(r)[0], "onClick");
    await r.flush(8);
    expect(sets(t.calls)).toEqual([60]);                // nothing was written back
    await r.unmount();
  });
});
