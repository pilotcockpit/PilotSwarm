import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { Providers, stubSource } from "@/test/harness";
import { useProviderUsage } from "./providers";
import { usePackageFile, type PackageSummary } from "./packages";

// These render the REAL hooks the screens call, under real React, with a stub source that answers with
// the SDK's wire shapes. Bypassing an adapter at the hook's call site makes them fail.

describe("useProviderUsage", () => {
  it("shows real totals and dates from dayUtc / tokensTotal", async () => {
    const { source, calls } = stubSource({
      getProviderUsage: {
        totals: { tokensTotal: 9_300_000, turns: 120, sessions: 9 },
        daily: [{ dayUtc: "2026-10-29", tokensTotal: 4_000_000, turns: 50, tokensInput: 0, tokensOutput: 0, tokensCacheRead: 0, tokensCacheWrite: 0 }, { dayUtc: "2026-10-30", tokensTotal: 5_300_000, turns: 70, tokensInput: 0, tokensOutput: 0, tokensCacheRead: 0, tokensCacheWrite: 0 }],
        breakdown: [{ key: "p:m", label: "m", tokensTotal: 9_000_000, turns: 100 }],
        dimension: "model", truncated: false,
      },
    });
    const out: { current?: ReturnType<typeof useProviderUsage> } = {};
    function Probe() { out.current = useProviderUsage("anthropic-wif", 14); return null; }
    const r = await render(<Providers source={source}><Probe /></Providers>);
    await r.flush();
    expect(calls[0]).toEqual({ op: "getProviderUsage", params: { provider: "anthropic-wif", days: 14, dimension: "model" } });
    const data = out.current!.data!;
    expect(data.totals.total).toBe(9_300_000);
    expect(data.daily.map((d) => [d.day, d.total])).toEqual([["2026-10-29", 4_000_000], ["2026-10-30", 5_300_000]]);
    expect(data.breakdown[0].total).toBe(9_000_000);
    await r.unmount();
  });
});

describe("usePackageFile", () => {
  const pkg = { packageId: "p", name: "ops-toolkit", scope: "shared", owner: null, enabled: true, canEdit: false, active: null } as PackageSummary;
  it("gives the file's text from the server's `content`", async () => {
    const { source } = stubSource({ getAgentPackageFile: { name: "ops-toolkit", semver: "1.0.0", path: "README.md", size: 7, truncated: false, binary: false, encoding: "utf8", content: "# Hello" } });
    const out: { current?: ReturnType<typeof usePackageFile> } = {};
    function Probe() { out.current = usePackageFile(pkg, undefined, "README.md"); return null; }
    const r = await render(<Providers source={source}><Probe /></Providers>);
    await r.flush();
    expect(out.current!.data!.text).toBe("# Hello");
    expect(out.current!.data!.binary).toBe(false);
    await r.unmount();
  });
});
