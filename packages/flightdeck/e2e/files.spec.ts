import { expect, test, type Page } from "@playwright/test";
import { demoCalls, expectNoSeriousAxe, gotoDemo, IDS, isPhone, shot, toastRegion, watchConsole } from "./helpers";

// Files: browse, edit, conflict, unsaved-changes guard, Changes, create/rename/delete/upload.
// Everything runs on the demo working folder (src/data/ops/workspace.demo.ts).

async function openFiles(page: Page, info: import("@playwright/test").TestInfo) {
  await gotoDemo(page, `/s/${IDS.release}?view=files&files=folders`, info);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Release readiness");
  await expect(page.getByRole("list", { name: /Contents of flight-deck/ })).toBeVisible();
}
const row = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name.replace(/[.]/g, "\\.")}\\b`) }).first();
async function openFile(page: Page, name: string) {
  await row(page, name).click();
  await expect(page.getByRole("button", { name: `Download ${name}` })).toBeVisible();
}
/** A new file opens in the viewer; on a phone the list is hidden while a file is open. */
async function ensureList(page: Page, info: import("@playwright/test").TestInfo) {
  if (!isPhone(info)) return;
  await page.getByRole("button", { name: "Back to the file list" }).click();
}
const editor = (page: Page, name: string) => page.getByRole("textbox", { name: `Editing ${name}` });
const fileWrites = async (page: Page) => (await demoCalls(page)).filter((c) => c.op === "sessionWorkspaceFiles" && c.params?.call?.op === "write").map((c) => c.params.call);
const writeBehind = (page: Page, folder: string, path: string, text: string) =>
  page.evaluate(([f, p, t]) => (window as any).__fdDemo.workspace.writeBehind(f, p, t), [folder, path, text]);

test("browse, open and edit a text file; the saved text shows", async ({ page }, info) => {
  const errors = watchConsole(page);
  await openFiles(page, info);
  await row(page, "docs").click();
  await expect(page.getByRole("navigation", { name: "Folder path" })).toContainText("docs");
  await page.getByRole("button", { name: "Up one folder" }).click();
  await openFile(page, "package.json");
  await expect(page.getByText('"name": "pilotswarm-flightdeck"')).toBeVisible();
  await shot(page, info, "viewer");
  await expectNoSeriousAxe(page, page.getByRole("tabpanel"), "file viewer");

  await page.getByRole("button", { name: "Edit" }).click();
  const box = editor(page, "package.json");
  await expect(box).toBeFocused();
  const save = page.getByRole("button", { name: "Save" });
  await expect(save).toBeDisabled();
  await box.fill('{"name": "renamed-by-e2e"}');
  await expect(page.getByText("Unsaved", { exact: true })).toBeVisible();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(toastRegion(page)).toContainText("Saved");
  await expect(toastRegion(page)).toContainText("package.json");
  const writes = (await demoCalls(page)).filter((c) => c.op === "sessionWorkspaceFiles" && c.params?.call?.op === "write");
  expect(writes).toHaveLength(1);
  expect(writes[0].params.call).toMatchObject({ folder: "working", path: "package.json" });
  expect(typeof writes[0].params.call.ifMatch).toBe("string"); // saved against the version that was opened
  await expect(editor(page, "package.json")).toHaveCount(0);
  await expect(page.getByText('"name": "renamed-by-e2e"')).toBeVisible();
  await shot(page, info, "saved");
  expect(errors).toEqual([]);
});

test("conflict: another writer saved first; Keep my version overwrites, the draft is never lost", async ({ page }, info) => {
  await openFiles(page, info);
  await openFile(page, "package.json");
  await page.getByRole("button", { name: "Edit" }).click();
  await editor(page, "package.json").fill("MINE");
  await writeBehind(page, "working", "package.json", "THEIRS");
  await page.getByRole("button", { name: "Save" }).click();

  const alert = page.getByRole("alert").filter({ hasText: "Someone changed this file first" });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole("button", { name: "Keep my version" })).toBeVisible();
  await expect(alert.getByRole("button", { name: "Take theirs and discard mine" })).toBeVisible();
  await expect(editor(page, "package.json")).toHaveValue("MINE"); // the draft survives the refusal
  await shot(page, info, "conflict");
  await expectNoSeriousAxe(page, alert, "conflict notice");

  await alert.getByRole("button", { name: "Keep my version" }).click();
  await expect(editor(page, "package.json")).toHaveCount(0);
  await expect(page.locator("pre code").filter({ hasText: "MINE" })).toBeVisible();
  const writes = await fileWrites(page);
  expect(writes).toHaveLength(2); // the refused save, then Keep my version
  expect(writes[1].ifMatch).not.toBe(writes[0].ifMatch); // Keep sends the etag the server reported, not the stale one
});

test("conflict: Take theirs loads their text and drops the draft", async ({ page }, info) => {
  await openFiles(page, info);
  await openFile(page, "package.json");
  await page.getByRole("button", { name: "Edit" }).click();
  await editor(page, "package.json").fill("MINE");
  await writeBehind(page, "working", "package.json", "THEIRS");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Take theirs and discard mine" }).click();
  await expect(editor(page, "package.json")).toHaveCount(0);
  await expect(page.locator("pre code").filter({ hasText: "THEIRS" })).toBeVisible();
  await expect(page.locator("pre code").filter({ hasText: "MINE" })).toHaveCount(0);
  expect(await fileWrites(page)).toHaveLength(1); // only the refused save: "Take theirs" writes nothing
});

test("a file that changes while you edit is flagged before you save", async ({ page }, info) => {
  await openFiles(page, info);
  await openFile(page, "package.json");
  await page.getByRole("button", { name: "Edit" }).click();
  await editor(page, "package.json").fill("MINE");
  await writeBehind(page, "working", "package.json", "AGENT WAS HERE");
  // The editor polls the file's etag; give it a moment rather than waiting for the interval.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("This file changed on disk since you started editing")).toBeVisible({ timeout: 15_000 });
});

async function startEditing(page: Page, text: string) {
  await openFile(page, "package.json");
  await page.getByRole("button", { name: "Edit" }).click();
  await editor(page, "package.json").fill(text);
}

test("switching folders asks first; Leave keeps the draft and it comes back", async ({ page }, info) => {
  await openFiles(page, info);
  await startEditing(page, "UNSAVED");
  const folders = page.getByRole("radiogroup", { name: "Files" });
  await folders.getByRole("radio", { name: "notes" }).click();
  const guard = page.getByRole("dialog", { name: "Leave without saving?" });
  await expect(guard).toBeVisible();
  await shot(page, info, "leave-guard");
  await expectNoSeriousAxe(page, guard, "leave guard");

  // Escape cancels the move: still editing, nothing lost.
  await page.keyboard.press("Escape");
  await expect(guard).toBeHidden();
  await expect(editor(page, "package.json")).toHaveValue("UNSAVED");

  await folders.getByRole("radio", { name: "notes" }).click();
  await page.getByRole("dialog", { name: "Leave without saving?" }).getByRole("button", { name: "Leave, keep my draft" }).click();
  await expect(page.getByRole("list", { name: /Contents of notes/ })).toBeVisible();

  await folders.getByRole("radio", { name: "flight-deck" }).click();
  // Coming back is not asked about again (the draft is kept), and opening the file restores it in the editor.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // The folder reopens on the file that holds the draft, restored in the editor.
  await expect(page.getByText("Your unsaved changes from earlier are back.")).toBeVisible();
  await expect(editor(page, "package.json")).toHaveValue("UNSAVED");
});

test("opening another file while editing asks; Discard drops the draft", async ({ page }, info) => {
  await openFiles(page, info);
  await startEditing(page, "UNSAVED");
  if (isPhone(info)) await page.getByRole("button", { name: "Back to the file list" }).click();
  else await row(page, "README.md").click();
  const guard = page.getByRole("dialog", { name: "Discard your unsaved changes?" });
  await expect(guard).toBeVisible();
  await expectNoSeriousAxe(page, guard, "discard guard");
  await guard.getByRole("button", { name: "Discard changes" }).click();
  await expect(guard).toBeHidden();
  if (!isPhone(info)) await expect(page.getByRole("button", { name: "Download README.md" })).toBeVisible();
  // Discard means discard: no "unsaved" count in the header, and the file reopens clean.
  await expect(page.getByText(/\d+ unsaved/)).toHaveCount(0);
  await expect(editor(page, "package.json")).toHaveCount(0);
  await openFile(page, "package.json");
  await expect(page.getByText("Your unsaved changes from earlier are back.")).toHaveCount(0);
  await expect(page.locator("pre code").filter({ hasText: "pilotswarm-flightdeck" })).toBeVisible();
});

test("leaving the session with unsaved edits asks first", async ({ page }, info) => {
  await openFiles(page, info);
  await startEditing(page, "UNSAVED");
  await page.evaluate(() => (document.querySelector('a[href="/sessions"]') as HTMLElement | null)?.click());
  const guard = page.getByRole("dialog", { name: "Leave without saving?" });
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(new RegExp(`/s/${IDS.release}`));
  await expect(editor(page, "package.json")).toHaveValue("UNSAVED");
});

test("Changes lists staged, changed and new files and opens a diff", async ({ page }, info) => {
  await openFiles(page, info);
  await page.getByRole("radiogroup", { name: "Show" }).getByRole("radio", { name: "Changes" }).click();
  await expect(page.getByRole("region", { name: "Staged" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Changed" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Staged" })).toContainText("README.md");
  await expect(page.getByRole("region", { name: "Changed" })).toContainText("src/App.tsx");
  await shot(page, info, "changes");
  await page.getByRole("region", { name: "Changed" }).getByRole("button", { name: /App\.tsx/ }).click();
  await expect(page.getByRole("button", { name: "Open file" })).toBeVisible();
  // The two versions differ in exactly one line: the diff shows the old line removed and the new one added,
  // and "Flight Deck" (present in both) is not what proves it.
  await expect(page.getByText('Removed: return <main>Flight Deck</main>;')).toBeVisible();
  await expect(page.getByText('Added: return <main className="p-4">Flight Deck</main>;')).toBeVisible();
  await expect(page.getByText("Added: export function App() {")).toHaveCount(0); // an unchanged line is not marked
  await shot(page, info, "diff");
  await expectNoSeriousAxe(page, page.getByRole("tabpanel"), "diff");
  if (isPhone(info)) {
    await page.getByRole("button", { name: "Back to the changes" }).click();
    await expect(page.getByRole("region", { name: "Staged" })).toBeVisible();
  }
});

test("New file, rename and delete (with confirm) work", async ({ page }, info) => {
  await openFiles(page, info);
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("menuitem", { name: "New file" }).click();
  await page.getByRole("textbox", { name: "New file name" }).fill("e2e-note.txt");
  await page.keyboard.press("Enter");
  await ensureList(page, info);
  await expect(row(page, "e2e-note.txt")).toBeVisible();

  await page.getByRole("button", { name: "Actions for e2e-note.txt" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const rename = page.getByRole("textbox", { name: /^(Rename|New name|Name)/ });
  await rename.fill("e2e-renamed.txt");
  await page.keyboard.press("Enter");
  await expect(row(page, "e2e-renamed.txt")).toBeVisible();
  await expect(row(page, "e2e-note.txt")).toHaveCount(0);

  // Delete asks first. The demo store changes nothing visible if it ran early, so count what was really sent:
  // none before the confirmation and after Cancel, exactly one (with this path) after it.
  const deletes = async () => (await demoCalls(page, "sessionWorkspaceFiles")).filter((c) => c.params?.call?.op === "delete");
  expect(await deletes()).toHaveLength(0);
  await page.getByRole("button", { name: "Actions for e2e-renamed.txt" }).click();
  await page.getByRole("menuitem", { name: /Delete/ }).click();
  const confirm = page.getByRole("dialog").last();
  await expect(confirm).toBeVisible();
  expect(await deletes(), "nothing is deleted before the confirmation").toHaveLength(0);
  await expectNoSeriousAxe(page, confirm, "delete confirm");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  expect(await deletes(), "nothing is deleted after Cancel").toHaveLength(0);
  await expect(row(page, "e2e-renamed.txt")).toBeVisible();

  await page.getByRole("button", { name: "Actions for e2e-renamed.txt" }).click();
  await page.getByRole("menuitem", { name: /Delete/ }).click();
  const second = page.getByRole("dialog").last();
  await second.getByRole("button", { name: /^Delete/ }).click();
  await expect(row(page, "e2e-renamed.txt")).toHaveCount(0);
  const sent = await deletes();
  expect(sent, "exactly one delete after the confirmation").toHaveLength(1);
  expect(sent[0].params.call).toMatchObject({ op: "delete", path: "e2e-renamed.txt" });
});

test("New folder creates a folder", async ({ page }, info) => {
  await openFiles(page, info);
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("menuitem", { name: "New folder" }).click();
  await page.getByRole("textbox", { name: "New folder name" }).fill("e2e-folder");
  await page.keyboard.press("Enter");
  await expect(row(page, "e2e-folder")).toBeVisible();
});

test("upload adds a file to the folder", async ({ page }, info) => {
  await openFiles(page, info);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("menuitem", { name: /Upload files/ }).click();
  (await chooser).setFiles({ name: "uploaded.txt", mimeType: "text/plain", buffer: Buffer.from("hello from e2e") });
  await expect(row(page, "uploaded.txt")).toBeVisible();
  await openFile(page, "uploaded.txt");
  await expect(page.getByText("hello from e2e")).toBeVisible();
});

test("phone: the list hides while a file is open and Back returns", async ({ page }, info) => {
  test.skip(!isPhone(info), "phone layout only");
  await openFiles(page, info);
  await openFile(page, "package.json");
  await expect(page.getByRole("list", { name: /Contents of flight-deck/ })).toBeHidden();
  await page.getByRole("button", { name: "Back to the file list" }).click();
  await expect(page.getByRole("list", { name: /Contents of flight-deck/ })).toBeVisible();
});
