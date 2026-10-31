import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, type Rendered } from "@/test/render";

vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { success: () => 0, error: vi.fn(), dismiss: () => undefined }) }));
(globalThis as any).window = globalThis;

import { DialogUndoHost } from "@/lib/undo";
import { VersionTimeline } from "./package-versions";

// The REAL version timeline and the REAL Undo host: 1.4.0 -> 1.3.2 -> 1.3.0, then Undo on the older
// notice must not pin 1.4.0 over the newer choice.

const versions = ["1.4.0", "1.3.2", "1.3.0"].map((semver, i) => ({ versionId: `v${i}`, semver, sha256: "x", sizeBytes: 10, createdAt: Date.now() - i * 1000 }));
const pkg = (activeSemver: string) => ({ packageId: "p", name: "ops-toolkit", scope: "shared", owner: null, enabled: true, canEdit: true, active: versions.find((v) => v.semver === activeSemver)! }) as any;

function Harness({ pins, active, setActive, isActive }: { pins: string[]; active: { current: string }; setActive: (s: string) => void; isActive?: (semver: string) => Promise<boolean> }) {
  const [, force] = React.useState(0);
  return (
    <>
      <VersionTimeline pkg={pkg(active.current)} versions={versions as any} canEdit busy={false}
        onPin={async (semver) => { pins.push(semver); setActive(semver); force((n) => n + 1); }}
        isActive={isActive ?? (async (semver) => active.current === semver)} />
      <DialogUndoHost />
    </>
  );
}
const button = (r: Rendered, label: string, nth = 0) => r.findAll((n) => n.type === "button" && r.text(n).trim() === label)[nth];
async function setup(isActive?: (semver: string) => Promise<boolean>) {
  const pins: string[] = [];
  const active = { current: "1.4.0" };
  const r = await render(<Harness pins={pins} active={active} setActive={(s) => { active.current = s; }} isActive={isActive} />);
  return { r, pins, active };
}

describe("package version Undo", () => {
  it("does not pin the first version over a newer choice", async () => {
    const { r, pins } = await setup();
    await r.fire(button(r, "Roll back to this", 0), "onClick"); await r.flush();       // 1.4.0 -> 1.3.2
    await r.fire(button(r, "Roll back to this", 0), "onClick"); await r.flush();       // 1.3.2 -> 1.3.0
    expect(pins).toEqual(["1.3.2", "1.3.0"]);
    const undos = r.findAll((n) => n.type === "button" && r.text(n).trim() === "Undo");
    expect(undos).toHaveLength(1);                                                       // the older notice was retired
    await r.fire(undos[0], "onClick"); await r.flush();
    expect(pins).toEqual(["1.3.2", "1.3.0", "1.3.2"]);                                   // undid the LAST change only
    expect(pins).not.toContain("1.4.0");
    await r.unmount();
  });

  it("refuses to undo when somebody else changed the active version meanwhile", async () => {
    let stillActive = true;
    const { r, pins } = await setup(async () => stillActive);
    await r.fire(button(r, "Roll back to this", 0), "onClick"); await r.flush();
    stillActive = false;                                                                 // another admin pinned something else
    await r.fire(r.findAll((n) => n.type === "button" && r.text(n).trim() === "Undo")[0], "onClick"); await r.flush();
    expect(pins).toEqual(["1.3.2"]);                                                     // no restore of 1.4.0
    await r.unmount();
  });
});
