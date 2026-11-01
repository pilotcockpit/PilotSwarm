import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { Providers, stubSource } from "@/test/harness";

vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: () => undefined }) }));
vi.mock("@/components/ui/tooltip", () => ({ Tooltip: ({ children }: any) => children, TooltipProvider: ({ children }: any) => children }));
vi.mock("@/components/session/working-folder-dialog", () => ({ WorkingFolderDialog: () => null }));
vi.mock("@/components/session/composer-footer", () => ({ ComposerSettings: () => null }));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<any>()), useNavigate: () => () => undefined, useRouterState: () => "/", Link: ({ children }: any) => children, getRouteApi: () => ({ useSearch: () => ({}), useParams: () => ({}) }) }));
(globalThis as any).window = globalThis;
(globalThis as any).addEventListener ??= () => undefined;
(globalThis as any).removeEventListener ??= () => undefined;
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
const media = (phone: boolean) => { (globalThis as any).matchMedia = (q: string) => ({ matches: phone && q.includes("max-width: 639px"), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); };

import { Composer } from "./session";

// The REAL composer, mounted the way the session page mounts it: the number of rows the box OPENS at is whatever
// the composer passes to its textarea, so that is what is asserted, not the helper alone.
const session: any = { sessionId: "s1", title: "S", agentId: "sre", status: "idle", model: "a:m", canWrite: true };

describe("the message box opens at the right height", () => {
  const rows = async (phone: boolean) => {
    media(phone);
    const { source } = stubSource({});
    source.sendMessage = async () => undefined;
    const r = await render(<Providers source={source}><Composer session={session} /></Providers>);
    const box = r.find((n) => n.type === "textarea");
    const value = (box.props as any).rows;
    await r.unmount();
    return value;
  };
  it("one line on a phone, so the composer stays short above the keyboard", async () => { expect(await rows(true)).toBe(1); });
  it("two lines on a wider screen", async () => { expect(await rows(false)).toBe(2); });
});
