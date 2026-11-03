import { describe, expect, it } from "vitest";

// These draw real folders on disk (a session's working folder and the files inside it), or are the one place the project icon is defined.
const FOLDERS_ON_DISK = ["/src/components/project-icon.tsx", "/src/components/session/working-folder-dialog.tsx", "/src/components/session/files/folder-pane.tsx"];
const sources = import.meta.glob<string>(["/src/**/*.ts", "/src/**/*.tsx", "!/src/**/*.test.*"], { query: "?raw", import: "default", eager: true });

describe("one icon for a project", () => {
  it("no screen draws a project with a folder-variant icon of its own", () => {
    // A project is ProjectIcon everywhere. The plain Folder is the working folder, and the variants below were each
    // used for "a project" in one place or another before there was one icon.
    const offenders = Object.entries(sources)
      .filter(([file, text]) => !FOLDERS_ON_DISK.includes(file) && /import\s*\{[^}]*\b(FolderInput|FolderPlus|FolderMinus|Folders|FolderOpen|FolderClosed)\b[^}]*\}\s*from\s*"lucide-react"/.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
  it("the working-folder chip has its own icon, so a project and a working folder never look alike", () => {
    const footer = sources["/src/components/session/composer-footer.tsx"];
    expect(footer).toMatch(/<FolderGit2\b/);
    expect(footer).not.toMatch(/ProjectIcon/);
  });
});
