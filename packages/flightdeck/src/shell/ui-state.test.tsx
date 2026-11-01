import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@/test/render";
import { handOffToSearch, useUi, UiStateProvider } from "./ui-state";

// The REAL UiStateProvider. The browser's document is replaced by a tiny stand-in: an active element, a
// flag for "a dialog is open", and elements that record focus().
interface FakeEl { name: string; focus: ReturnType<typeof vi.fn> }
const el = (name: string): FakeEl => ({ name, focus: vi.fn() });
let dialogOpen = false;
let active: FakeEl | null = null;
const main = el("main");
const realDoc = (globalThis as any).document;

beforeEach(() => {
  dialogOpen = false;
  active = null;
  main.focus.mockClear();
  (globalThis as any).document = {
    get activeElement() { return active ?? { tagName: "BODY" }; },
    body: {},
    querySelector: () => (dialogOpen ? {} : null),
    contains: () => true,
    getElementById: (id: string) => (id === "main" ? main : null),
  };
});
afterEach(() => { (globalThis as any).document = realDoc; });

function Probe({ onUi }: { onUi: (ui: ReturnType<typeof useUi>) => void }) {
  onUi(useUi());
  return null;
}
async function mount() {
  let ui!: ReturnType<typeof useUi>;
  const r = await render(<UiStateProvider><Probe onUi={(u) => { ui = u; }} /></UiStateProvider>);
  return { r, ui: () => ui };
}
const closeEvent = () => ({ preventDefault: vi.fn() }) as unknown as Event;

describe("phone drawer to Search", () => {
  it("closes the drawer when Search takes over, and the palette is the thing left open", async () => {
    const { r, ui } = await mount();
    const menuButton = el("menu"); active = menuButton;
    await act(() => ui().setNavOpen("menu")); dialogOpen = true; // the drawer is open
    const searchButton = el("search"); active = searchButton;
    await act(() => handOffToSearch(ui(), () => { dialogOpen = false; void ui().setNavOpen(false); }));
    expect(ui().paletteOpen).toBe(true);
    expect(ui().navOpen).toBe(false);
    await r.unmount();
  });

  it("returns focus to the drawer's own opener, not the Search button that unmounted", async () => {
    const { r, ui } = await mount();
    const menuButton = el("menu"); active = menuButton;
    await act(() => ui().setNavOpen("menu")); dialogOpen = true;
    active = el("search"); // focus is on the Search button inside the drawer
    await act(() => handOffToSearch(ui(), () => { /* the drawer closes, but its dialog is still animating out */ }));
    // The drawer finishes closing while the palette is open: the palette owns focus, nothing is stolen.
    ui().restoreFocus(closeEvent());
    expect(menuButton.focus).not.toHaveBeenCalled();
    // The palette closes; no dialog is open any more.
    dialogOpen = false;
    ui().restoreFocus(closeEvent());
    expect(menuButton.focus).toHaveBeenCalledTimes(1);
    expect(main.focus).not.toHaveBeenCalled();
    await r.unmount();
  });

  it("opens the palette before closing the drawer, so the opener is remembered while the drawer still counts as open", () => {
    const order: string[] = [];
    handOffToSearch({ setPaletteOpen: (v: boolean) => order.push(`palette:${v}`) }, () => order.push("drawer:closed"));
    expect(order).toEqual(["palette:true", "drawer:closed"]);
  });

  it("works from the desktop rail, where there is no drawer to close", () => {
    const open = vi.fn();
    handOffToSearch({ setPaletteOpen: open });
    expect(open).toHaveBeenCalledWith(true);
  });
});

// ── The real Search buttons call the hand-off ────────────────────────────────────────────────────────────────
// The tests above prove handOffToSearch. These prove the buttons the person presses actually USE it: a button that
// opened the palette directly would leave the drawer covering whatever Search leads to.
import { NavTop } from "./AppShell";
import { Providers, stubSource } from "@/test/harness";

vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<any>()), Link: ({ children, onClick }: any) => <a onClick={onClick}>{children}</a>, useRouterState: () => "/", useNavigate: () => () => undefined }));
vi.mock("@/components/ui/tooltip", () => ({ Tooltip: ({ children }: any) => children, TooltipProvider: ({ children }: any) => children }));
(globalThis as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
(globalThis as any).window ??= globalThis;

describe("the real Search buttons", () => {
  for (const collapsed of [false, true]) {
    it(`${collapsed ? "the icon" : "the labelled"} button opens the palette and closes the drawer`, async () => {
      const { source } = stubSource({});
      source.listSessions = async () => [];
      let ui!: ReturnType<typeof useUi>;
      const closeDrawer = vi.fn();
      const r = await render(
        <Providers source={source}><UiStateProvider><Probe onUi={(u) => { ui = u; }} /><NavTop collapsed={collapsed} onNavigate={closeDrawer} /></UiStateProvider></Providers>,
      );
      const search = r.find((n) => n.type === "button" && n.props["aria-label"] === "Search");
      await act(async () => { (search.props as any).onClick(); });
      expect(ui.paletteOpen).toBe(true);
      expect(closeDrawer).toHaveBeenCalledTimes(1);
      await r.unmount();
    });
  }
});
