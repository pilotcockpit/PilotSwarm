import { MutationObserver, QueryClient } from "@tanstack/query-core";
import { describe, expect, it } from "vitest";
import { mintLinkOptions } from "./canvas-share";

const TOKEN = "tok_SECRET_ONE_TIME_abcdef0123456789";

describe("minting a public canvas link", () => {
  const source = { call: async (op: string) => (op === "resetCanvasShareLink" ? { token: TOKEN } : {}) } as any;

  it("hands the token to the caller and keeps it out of the mutation cache, before and after close", async () => {
    const client = new QueryClient();
    const observer = new MutationObserver(client, mintLinkOptions(source, "s1", 1));
    let received = "";
    const result = await observer.mutate({ onToken: (t) => { received = t; } });
    expect(received).toBe(TOKEN);                                    // the component gets it
    expect(JSON.stringify(result)).not.toContain(TOKEN);             // the mutation result does not carry it
    const dump = () => JSON.stringify(client.getMutationCache().getAll().map((m) => ({ state: m.state, options: { ...m.options, mutationFn: undefined } })));
    expect(dump()).not.toContain(TOKEN);                             // nor does anything in the cache while the dialog is open
    observer.reset();                                                // the dialog closes
    await new Promise((r) => setTimeout(r, 10));
    expect(client.getMutationCache().getAll()).toHaveLength(0);      // gcTime 0: the entry itself is gone
    expect(dump()).not.toContain(TOKEN);
  });

  it("refuses a response with no token instead of showing an empty link", async () => {
    const client = new QueryClient();
    const observer = new MutationObserver(client, mintLinkOptions({ call: async () => ({}) } as any, "s1", 1));
    await expect(observer.mutate({ onToken: () => undefined })).rejects.toThrow(/didn't return a link/);
  });
});
