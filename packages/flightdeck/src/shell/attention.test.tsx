import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/page-metadata";

const state = vi.hoisted(() => ({ path: "/", search: "", count: 3 }));
vi.mock("@tanstack/react-router", () => ({ useRouterState: ({ select }: { select: (router: unknown) => unknown }) => select({ location: { pathname: state.path, searchStr: state.search } }) }));
vi.mock("@/components/sidebar/use-attention", () => ({ useAttention: () => ({ items: Array(state.count).fill({}) }) }));
import { AttentionTitle } from "./attention";

describe("route metadata and attention have one title owner", () => {
  let previousDocument: Document;
  let description: string;
  beforeEach(() => {
    previousDocument = globalThis.document;
    description = SITE_DESCRIPTION;
    Object.assign(state, { path: "/", search: "", count: 3 });
    globalThis.document = { title: SITE_TITLE, querySelector: () => ({ getAttribute: () => description, setAttribute: (_key: string, value: string) => { description = value; } }) } as unknown as Document;
  });
  afterEach(() => { globalThis.document = previousDocument; });
  it("updates during navigation even when the attention count stays unchanged, then restores on unmount", async () => {
    const app = await render(<AttentionTitle />);
    expect(document.title).toBe(`(3) Overview · ${SITE_TITLE}`);
    state.path = "/library"; state.search = "?tab=packages&token=PRIVATE";
    await app.rerender(<AttentionTitle />);
    expect(document.title).toBe(`(3) Packages · Library · ${SITE_TITLE}`);
    expect(description).not.toContain("PRIVATE");
    state.path = "/s/PRIVATE"; state.search = "?view=activity&activity=logs&file=PRIVATE";
    await app.rerender(<AttentionTitle />);
    expect(document.title).toBe(`(3) Logs · Session · ${SITE_TITLE}`);
    state.count = 0;
    await app.rerender(<AttentionTitle />);
    expect(document.title).toBe(`Logs · Session · ${SITE_TITLE}`);
    await app.unmount();
    expect(document.title).toBe(SITE_TITLE);
    expect(description).toBe(SITE_DESCRIPTION);
  });
});
