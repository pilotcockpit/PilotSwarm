import { describe, expect, it } from "vitest";
import { FILE_MAX_COUNT, IMAGE_MAX_COUNT, IMAGE_MAX_BYTES, addAttachments, planAttachments, uploadOne, withoutSent, type AddDeps, type Attachment } from "./attachments";

const file = (name: string, size = 100, type = "text/csv") => ({ name, size, type }) as unknown as File;
let n = 0;
const make = { newId: () => `id${++n}abcdefgh` };
const tray = (items: Attachment[], plan: ReturnType<typeof planAttachments>) => [...items, ...plan.staged.map((s) => s.item)];

describe("planAttachments", () => {
  it("stores every upload under its own name, even for the same file added twice", () => {
    const first = planAttachments([file("report.csv")], [], [], make);
    const second = planAttachments([file("report.csv")], tray([], first), [], make);
    const [a, b] = [first.staged[0].item.artifact, second.staged[0].item.artifact];
    expect(a).toMatch(/^report-[0-9a-z]+\.csv$/);
    expect(b).toMatch(/^report-[0-9a-z]+\.csv$/);
    expect(a).not.toBe(b);
    // The person still sees the name they chose.
    expect(first.staged[0].item.name).toBe("report.csv");
  });
  it("never reuses a name the session already has", () => {
    const p = planAttachments([file("report.csv"), file("report.csv")], [], ["report-id1abcde.csv"], make);
    const names = p.staged.map((s) => s.item.artifact);
    expect(new Set(names).size).toBe(2);
    expect(names).not.toContain("report-id1abcde.csv");
  });
  it("holds the count and size limits across adds", () => {
    let items: Attachment[] = [];
    for (let i = 0; i < FILE_MAX_COUNT; i++) items = tray(items, planAttachments([file(`f${i}.txt`)], items, [], make));
    const over = planAttachments([file("one-more.txt")], items, [], make);
    expect(over.staged).toHaveLength(0);
    expect(over.rejected[0]).toMatch(/Only \d+ files/);
    const imgs = (k: number) => Array.from({ length: k }, (_, i) => file(`p${i}.png`, 1000, "image/png"));
    const imageTray = tray([], planAttachments(imgs(IMAGE_MAX_COUNT), [], [], make));
    expect(planAttachments(imgs(1), imageTray, [], make).rejected[0]).toMatch(/Only \d+ images/);
  });
  it("rejects empty and oversized files with a reason", () => {
    const p = planAttachments([file("empty.txt", 0), file("big.png", IMAGE_MAX_BYTES + 1, "image/png")], [], [], make);
    expect(p.staged).toHaveLength(0);
    expect(p.rejected).toHaveLength(2);
  });
  it("sanitises the stored name", () => {
    expect(planAttachments([file("a/b?c.txt")], [], [], make).staged[0].item.artifact).toMatch(/^a_b_c-[0-9a-z]+\.txt$/);
  });
});

/** A fake source that records every call, with uploads that wait until released. */
function fakeSource() {
  const calls: Array<{ op: string; filename?: string }> = [];
  const gates: Array<() => void> = [];
  return {
    calls, release: () => gates.splice(0).forEach((g) => g()),
    source: {
      listArtifacts: async () => [],
      call: async (op: string, params: any) => {
        calls.push({ op, filename: params?.filename });
        if (op === "uploadArtifact") await new Promise<void>((r) => gates.push(r));
        return {};
      },
    } as unknown as AddDeps["source"],
  };
}

function deps(over: Partial<AddDeps> & { source: AddDeps["source"] }) {
  let tray: Attachment[] = [];
  const patches: Array<[string, Partial<Attachment>]> = [];
  const cancelled = new Set<string>();
  const base: AddDeps = {
    sessionId: "s1",
    patch: (id, change) => { patches.push([id, change]); tray = tray.map((a) => (a.id === id ? { ...a, ...change } : a)); },
    takeCancelled: (id) => cancelled.delete(id),
    read: async () => new Uint8Array([1, 2, 3]),
    getTray: () => tray,
    setTray: (next) => { tray = next; },
    alive: () => true,
    notify: () => undefined,
    make,
    ...over,
  };
  return { d: base, cancelled, patches, tray: () => tray, remove: (id: string) => { tray = tray.filter((a) => a.id !== id); cancelled.add(id); } };
}

describe("cancel then re-add the same file", () => {
  it("cleans up only the cancelled upload's own stored name, never the replacement's", async () => {
    const fs = fakeSource();
    const h = deps({ source: fs.source });
    const first = addAttachments([file("report.csv")], h.d);
    await new Promise((r) => setTimeout(r, 0));
    const firstItem = h.tray()[0];
    h.remove(firstItem.id);                       // the chip is removed while its upload runs
    const second = addAttachments([file("report.csv")], h.d);
    await new Promise((r) => setTimeout(r, 0));
    const secondItem = h.tray()[0];
    expect(secondItem.artifact).not.toBe(firstItem.artifact);
    fs.release();                                  // both uploads finish, the cancelled one first
    await Promise.all([first, second]);
    const deletes = fs.calls.filter((c) => c.op === "deleteArtifact").map((c) => c.filename);
    expect(deletes).toEqual([firstItem.artifact]);
    expect(deletes).not.toContain(secondItem.artifact);
    expect(h.tray()[0]).toMatchObject({ id: secondItem.id, status: "ready" });
  });
});

describe("a file listing that lands after the tray is gone", () => {
  it("starts no upload and stages nothing", async () => {
    const fs = fakeSource();
    let alive = true;
    const slow = { ...fs.source, listArtifacts: async () => { alive = false; return []; } } as AddDeps["source"];
    const h = deps({ source: slow, alive: () => alive });
    await addAttachments([file("report.csv")], h.d);
    expect(fs.calls).toEqual([]);
    expect(h.tray()).toEqual([]);
  });
});

describe("uploadOne", () => {
  it("marks a failed upload as failed and keeps the chip", async () => {
    const h = deps({ source: { listArtifacts: async () => [], call: async () => { throw new Error("nope"); } } as unknown as AddDeps["source"] });
    const item = planAttachments([file("a.txt")], [], [], make).staged[0];
    await uploadOne(item, h.d);
    expect(h.patches).toEqual([[item.item.id, { status: "error", error: "nope" }]]);
  });
});

describe("withoutSent", () => {
  const item = (id: string): Attachment => ({ id, name: id, artifact: id, size: 1, type: "text/plain", kind: "file", status: "ready" });
  it("clears only what was sent and keeps what was added while the send ran", () => {
    const left = withoutSent([item("a"), item("b"), item("late")], ["a", "b"]);
    expect(left.map((x) => x.id)).toEqual(["late"]);
  });
  it("is a no-op for an empty sent list", () => {
    expect(withoutSent([item("a")], [])).toHaveLength(1);
  });
});
