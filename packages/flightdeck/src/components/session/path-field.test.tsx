import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { PathField } from "./path-field";

const props = { label: "Working folder", onRoot: () => undefined, onFolder: () => undefined, folder: "projects/api" };

describe("PathField", () => {
  it("offers the locations the server lists, so a wrong one is not typed by mistake", async () => {
    const r = await render(<PathField {...props} root="work" roots={["work", "shared"]} />);
    const select = r.find((n) => n.type === "select");
    expect(select.props["aria-label"]).toBe("Working folder: location");
    expect(r.findAll((n) => n.type === "option").map((o) => r.text(o))).toEqual(["work", "shared", "Other location…"]);
    expect(r.findAll((n) => n.type === "input")).toHaveLength(1);
    await r.unmount();
  });
  it("keeps a location the record uses even when the server no longer lists it, and says so", async () => {
    const r = await render(<PathField {...props} root="old" roots={["work"]} />);
    expect(r.findAll((n) => n.type === "option").map((o) => r.text(o))).toEqual(["work", "old (not listed)", "Other location…"]);
    await r.unmount();
  });
  it("asks to choose when no location is set yet", async () => {
    const r = await render(<PathField {...props} root="" roots={["work"]} />);
    expect(r.findAll((n) => n.type === "option").map((o) => r.text(o))[0]).toBe("Choose a location");
    await r.unmount();
  });
  it("falls back to typing the location when the server lists none", async () => {
    const r = await render(<PathField {...props} root="work" roots={[]} />);
    expect(r.findAll((n) => n.type === "select")).toHaveLength(0);
    expect(r.findAll((n) => n.type === "input")).toHaveLength(2);
    await r.unmount();
  });
  it("turns into a text box for a location the list does not have, keeping the listed ones as suggestions", async () => {
    let root = "";
    const r = await render(<PathField {...props} onRoot={(v) => { root = v; }} root="work" roots={["work", "shared"]} />);
    await r.fire(r.find((n) => n.type === "select"), "onChange", { target: { value: "\u0000other" } });
    expect(r.findAll((n) => n.type === "select")).toHaveLength(0);
    expect(r.findAll((n) => n.type === "datalist")).toHaveLength(1);
    const location = r.findAll((n) => n.type === "input").find((n) => n.props["aria-label"] === "Working folder: location")!;
    await r.fire(location, "onChange", { target: { value: "worker-only" } });
    expect(root).toBe("worker-only");
    await r.unmount();
  });
  it("reports a chosen location and a typed path separately", async () => {
    let root = ""; let folder = "";
    const r = await render(<PathField {...props} onRoot={(v) => { root = v; }} onFolder={(v) => { folder = v; }} root="work" roots={["work", "shared"]} />);
    await r.fire(r.find((n) => n.type === "select"), "onChange", { target: { value: "shared" } });
    await r.fire(r.find((n) => n.type === "input"), "onChange", { target: { value: "notes" } });
    expect({ root, folder }).toEqual({ root: "shared", folder: "notes" });
    await r.unmount();
  });
});
