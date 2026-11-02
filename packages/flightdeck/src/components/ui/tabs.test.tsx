import { describe, expect, it } from "vitest";
import { Activity, FileText } from "lucide-react";
import { render } from "@/test/render";
import { TabStrip } from "./tabs";

(globalThis as any).window = globalThis;
(globalThis as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const sources = import.meta.glob<string>(["/src/**/*.tsx", "!/src/**/*.test.*", "!/src/components/ui/tabs.tsx"], { query: "?raw", import: "default", eager: true });

describe("one recipe per kind of tab group", () => {
  it("no screen builds its own tab list: tabs come from TabStrip, view switches from Segmented", () => {
    const own = Object.entries(sources).filter(([, text]) => /role="tablist"/.test(text)).map(([file]) => file);
    expect(own).toEqual([]);
  });
});

describe("TabStrip", () => {
  const tabs = [
    { value: "a", label: "Context", icon: FileText, badge: 3 },
    { value: "b", label: "Activity", icon: Activity, iconOnly: true, dot: { tone: "accent" as const, label: "updated" } },
  ];
  it("is a labelled tablist with one tab stop, ids the panel can point at, and the open tab selected", async () => {
    const r = await render(<TabStrip label="Views" value="a" onChange={() => undefined} tabs={tabs} idPrefix="view-tab" controls="panel" />);
    expect(r.find((n) => n.props.role === "tablist").props["aria-label"]).toBe("Views");
    const [first, second] = r.findAll((n) => n.props.role === "tab");
    expect(first.props).toMatchObject({ id: "view-tab-a", "aria-selected": true, "aria-controls": "panel", tabIndex: 0 });
    expect(second.props).toMatchObject({ id: "view-tab-b", "aria-selected": false, tabIndex: -1 });
    await r.unmount();
  });
  it("never wraps or shrinks a tab, and scrolls instead of showing a scrollbar", async () => {
    const r = await render(<TabStrip label="Views" value="a" onChange={() => undefined} tabs={tabs} idPrefix="t" />);
    expect(r.find((n) => n.props.role === "tablist").props.className).toMatch(/fd-scroll-x.*overflow-x-auto/);
    for (const tab of r.findAll((n) => n.props.role === "tab")) expect(tab.props.className).toMatch(/shrink-0.*whitespace-nowrap/);
    await r.unmount();
  });
  it("an icon-only tab keeps its name for screen readers and as a tooltip, and a dot says what changed", async () => {
    const r = await render(<TabStrip label="Views" value="a" onChange={() => undefined} tabs={tabs} idPrefix="t" />);
    const second = r.findAll((n) => n.props.role === "tab")[1];
    expect(second.props.title).toBe("Activity");
    expect(r.findAll((n) => n.type === "span" && String(n.props.className).includes("sr-only") && r.text(n) === "Activity")).toHaveLength(1);
    expect(r.findAll((n) => n.props.role === "img" && n.props["aria-label"] === "updated")).toHaveLength(1);
    await r.unmount();
  });
  it("reports the tab that was chosen", async () => {
    let chosen = "";
    const r = await render(<TabStrip label="Views" value="a" onChange={(v) => { chosen = v; }} tabs={tabs} idPrefix="t" />);
    await r.fire(r.findAll((n) => n.props.role === "tab")[1], "onClick");
    expect(chosen).toBe("b");
    await r.unmount();
  });
});

// Radix's toggle group needs a real DOM, which this test renderer does not provide, so the control's recipe is checked in its source.
const tabsSource = import.meta.glob<string>("/src/components/ui/tabs.tsx", { query: "?raw", import: "default", eager: true })["/src/components/ui/tabs.tsx"];
const segmented = tabsSource.slice(tabsSource.indexOf("export function Segmented"), tabsSource.indexOf("export interface TabItem"));

describe("Segmented", () => {
  it("keeps every label on one line, cuts a long one with an ellipsis and gives it its full text as a tooltip", () => {
    expect(segmented).toMatch(/shrink-0[^"]*whitespace-nowrap/);
    expect(segmented).toMatch(/max-w-\d+[^"]*truncate/);
    expect(segmented).toMatch(/title=\{o\.title \?\? \(typeof o\.label === "string" \? o\.label : undefined\)\}/);
  });
  it("scrolls sideways when the options do not fit, with no scrollbar, and keeps the selected one in view", () => {
    expect(segmented).toMatch(/fd-scroll-x[^"]*overflow-x-auto/);
    expect(segmented).toContain("useKeepSelectedInView(ref, value)");
  });
});
