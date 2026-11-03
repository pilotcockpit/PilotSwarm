import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { Providers, stubSource } from "@/test/harness";
import { LimitRow } from "./limits";

// The real limit editor, rendered. A person opens a limit of 1,234,567 tokens and presses Save without
// touching it: exactly 1234567 must be sent, not a rounded display value.

describe("limit editor", () => {
  it("submits the exact saved limit when opened and saved without an edit", async () => {
    const { source, calls } = stubSource({ setProviderLimit: { seededTokens: 0 } });
    const r = await render(
      <Providers source={source}>
        <ul><LimitRow provider="anthropic-wif" period="month" model={null} cell={{ quotaTokens: 1_234_567, usedTokens: 1_000 } as any} manageable usingCount={0} allowancePct={100} shared /></ul>
      </Providers>,
    );
    const button = (label: string) => r.find((n) => n.type === "button" && r.text(n).trim().startsWith(label));
    await r.fire(button("Change"), "onClick");
    const input = r.find((n) => n.type === "input");
    expect(input.props.value).toBe("1234567");                  // the box shows the exact integer
    await r.fire(button("Save"), "onClick");
    await r.flush();
    const save = calls.find((c) => c.op === "setProviderLimit");
    expect(save?.params).toEqual({ name: "anthropic-wif", period: "month", model: null, tokens: 1_234_567 });
    await r.unmount();
  });
});
