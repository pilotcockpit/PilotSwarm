import { describe, expect, it } from "vitest";
import { FILE_MAX_COUNT, IMAGE_MAX_COUNT, IMAGE_MAX_BYTES, planAttachments, withoutSent, type Attachment } from "./attachments";

const file = (name: string, size = 100, type = "text/csv") => ({ name, size, type }) as unknown as File;
let n = 0;
const make = { newId: () => `id${++n}abcdefgh` };
const tray = (items: Attachment[], plan: ReturnType<typeof planAttachments>) => [...items, ...plan.staged.map((s) => s.item)];

describe("planAttachments", () => {
  it("gives two files with the same name different artifacts when adds run back to back", () => {
    // Two add() calls waited on the same listing; the second sees the first's reservation.
    const first = planAttachments([file("report.csv")], [], [], make);
    const second = planAttachments([file("report.csv")], tray([], first), [], make);
    expect(first.staged[0].item.artifact).toBe("report.csv");
    expect(second.staged[0].item.artifact).toBe("report (2).csv");
  });
  it("never reuses a name the session already has", () => {
    const p = planAttachments([file("report.csv"), file("report.csv")], [], ["report.csv"], make);
    expect(p.staged.map((s) => s.item.artifact)).toEqual(["report (2).csv", "report (3).csv"]);
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
    expect(planAttachments([file("a/b?c.txt")], [], [], make).staged[0].item.artifact).toBe("a_b_c.txt");
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
