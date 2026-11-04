import { test, expect } from "@playwright/test";
import { startStubServer } from "./stub-server.mjs";

// Real compiled CSS and the real profile preference path, without a database
// or model provider. A var() in an @container condition both broke the Vite 8
// build and could not implement the saved reading width in the browser.
let stub;
test.beforeAll(async () => { stub = await startStubServer(0, { sessionCount: 2 }); });
test.afterAll(async () => { await new Promise(resolve => stub.server.close(resolve)); });

for (const align of ["left", "center"]) {
    test(`the ${align} reading rail fits the pane and disappears near its edge`, async ({ page }) => {
        await page.route("**/api/v1/me/profile", route => route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ ok: true, result: { isAdmin: false, profileSettings: {
                chatReading: { on: true, width: 720, align, pad: 40 },
                themeSound: { on: false }, themeSoundMobile: { on: false },
            } } }),
        }));
        await page.setViewportSize({ width: 1900, height: 950 });
        await page.goto(`http://127.0.0.1:${stub.port}`);
        const chat = page.locator(`.ps-chat-panel.is-reading.is-reading-${align}`);
        await expect(chat).toBeVisible();
        for (const name of ["Hide canvas", "Hide diagnostics"]) {
            const hide = page.getByRole("button", { name, exact: true });
            if (await hide.isVisible()) await hide.click();
        }
        const rail = () => chat.locator(".ps-panel-body").evaluate(element => {
            const style = getComputedStyle(element, "::after");
            return { width: parseFloat(style.width), content: style.content };
        });
        await expect.poll(async () => (await rail()).width).toBe(1);

        await page.setViewportSize({ width: 1000, height: 950 });
        await expect(chat).toBeVisible();
        await expect.poll(async () => (await rail()).width).toBe(0);

        await page.setViewportSize({ width: 1900, height: 950 });
        await expect.poll(async () => (await rail()).width).toBe(1);
        await page.getByRole("button", { name: "Show diagnostics (inspector and activity)", exact: true }).click();
        await expect.poll(async () => (await rail()).content).toBe("none");
    });
}
