export type DiffLine = { type: "same" | "add" | "del"; text: string; a?: number; b?: number };

const MAX_CELLS = 4_000_000;

/**
 * A line diff by longest common subsequence, for comparing a file with what git last saw.
 * Files too large for the table fall back to "everything replaced" and say so.
 */
export function diffLines(before: string, after: string): { lines: DiffLine[]; coarse: boolean } {
  const a = before === "" ? [] : before.replace(/\r\n/g, "\n").split("\n");
  const b = after === "" ? [] : after.replace(/\r\n/g, "\n").split("\n");
  // A trailing newline is not a line of its own.
  if (a.at(-1) === "") a.pop();
  if (b.at(-1) === "") b.pop();
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const ma = a.slice(head, a.length - tail);
  const mb = b.slice(head, b.length - tail);
  const out: DiffLine[] = [];
  for (let i = 0; i < head; i++) out.push({ type: "same", text: a[i], a: i + 1, b: i + 1 });
  let coarse = false;
  if ((ma.length + 1) * (mb.length + 1) > MAX_CELLS) {
    coarse = true;
    ma.forEach((t, i) => out.push({ type: "del", text: t, a: head + i + 1 }));
    mb.forEach((t, i) => out.push({ type: "add", text: t, b: head + i + 1 }));
  } else {
    const w = mb.length + 1;
    const t = new Uint32Array((ma.length + 1) * w);
    for (let i = ma.length - 1; i >= 0; i--) for (let j = mb.length - 1; j >= 0; j--) t[i * w + j] = ma[i] === mb[j] ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
    let i = 0, j = 0;
    while (i < ma.length || j < mb.length) {
      if (i < ma.length && j < mb.length && ma[i] === mb[j]) { out.push({ type: "same", text: ma[i], a: head + i + 1, b: head + j + 1 }); i++; j++; }
      else if (j < mb.length && (i === ma.length || t[i * w + j + 1] >= t[(i + 1) * w + j])) { out.push({ type: "add", text: mb[j], b: head + j + 1 }); j++; }
      else { out.push({ type: "del", text: ma[i], a: head + i + 1 }); i++; }
    }
  }
  for (let k = 0; k < tail; k++) out.push({ type: "same", text: a[a.length - tail + k], a: a.length - tail + k + 1, b: b.length - tail + k + 1 });
  return { lines: out, coarse };
}

/** Keep the changed lines with two lines of context; collapse the rest into "N unchanged lines". */
export function collapseDiff(lines: DiffLine[], context = 2): Array<DiffLine | { type: "skip"; count: number }> {
  const keep = new Array(lines.length).fill(false);
  lines.forEach((l, i) => { if (l.type !== "same") for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true; });
  const out: Array<DiffLine | { type: "skip"; count: number }> = [];
  let skipped = 0;
  lines.forEach((l, i) => {
    if (keep[i]) { if (skipped) { out.push({ type: "skip", count: skipped }); skipped = 0; } out.push(l); } else skipped++;
  });
  if (skipped) out.push({ type: "skip", count: skipped });
  return out;
}
