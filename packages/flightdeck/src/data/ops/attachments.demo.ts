import { registerDemoOps } from "./registry";

// Uploads succeed after a short pause; a file named like "fail" demonstrates the error chip.
registerDemoOps(import.meta.url, {
  uploadArtifact: async ({ filename }) => {
    await new Promise((r) => window.setTimeout(r, 700));
    if (/fail/i.test(String(filename))) throw new Error("The server refused this file (demo).");
    return { filename, sizeBytes: 0 };
  },
  deleteArtifact: () => undefined,
});
