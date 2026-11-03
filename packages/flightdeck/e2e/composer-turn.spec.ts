import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe, gotoDemo, IDS, shot } from "./helpers";

// The composer while a turn is running: Stop, Steer and Queue replace Send, and Enter queues. The demo records no
// operation for these (they are source methods), so the outcomes are what the person sees: the box clears, the
// message is in the conversation, and the session leaves "Running" when it is stopped.

const box = (page: import("@playwright/test").Page) => page.getByRole("textbox", { name: "Message" });

test("a running session offers Stop, Steer and Queue, and Enter queues", async ({ page }, info) => {
  await gotoDemo(page, `/s/${IDS.canvasPort}`, info);
  await expect(box(page)).toHaveAttribute("placeholder", /Add to the queue, or steer coder/);
  const steer = page.getByRole("button", { name: "Steer" });
  const queue = page.getByRole("button", { name: "Queue" });
  await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toHaveCount(0);
  await expect(steer).toBeDisabled(); // nothing to say yet
  await expect(queue).toBeDisabled();

  await box(page).fill("Also run the conformance cases twice");
  await expect(steer).toBeEnabled();
  await expect(queue).toBeEnabled();
  await shot(page, info, "composer-running");
  await expectNoSeriousAxe(page, page.locator(".fd-composer"), "composer while running");
  await box(page).press("Enter"); // Enter queues
  await expect(box(page)).toHaveValue("");
  await expect(page.getByText("Also run the conformance cases twice").first()).toBeVisible();
});

test("Steer sends the text as guidance and clears the box", async ({ page }, info) => {
  await gotoDemo(page, `/s/${IDS.canvasPort}`, info);
  await box(page).fill("Skip the flaky case");
  await page.getByRole("button", { name: "Steer" }).click();
  await expect(box(page)).toHaveValue("");
});

test("Stop ends the turn: the session is no longer running and Send comes back", async ({ page }, info) => {
  await gotoDemo(page, `/s/${IDS.canvasPort}`, info);
  const header = page.locator("header").first(); // on a phone the state is a glyph with its word for screen readers
  await expect(header).toContainText("Running");
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible();
  await expect(header).not.toContainText("Running");
});
