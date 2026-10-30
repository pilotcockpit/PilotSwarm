import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { PORTAL_SHELL_HEADERS } from "../app/ui/react/src/sandboxed-document.js";

// Flight Deck runs beside the classic portal, never inside it. The classic
// portal's server (:3001) owns the Web API and the WebSocket; this dev server
// only proxies them. Override the target with PILOTSWARM_API_TARGET.
const apiTarget = process.env.PILOTSWARM_API_TARGET || "http://localhost:3001";
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": here("./src"),
      // Framework-free domain code shared with the TUI and the classic portal.
      // Imported module by module so the 12k-line controller and the
      // terminal-shaped selectors stay out of this bundle.
      "@ps/history": here("../app/ui/core/src/history.js"),
      "@ps/state": here("../app/ui/core/src/state.js"),
      "@ps/sandbox": here("../app/ui/react/src/sandboxed-document.js"),
      "pilotswarm-sdk/api": here("../sdk/api/index.js"),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    headers: { ...PORTAL_SHELL_HEADERS },
    proxy: {
      "/api": { target: apiTarget, ws: true },
    },
  },
  preview: {
    port: 5180,
    strictPort: true,
    headers: { ...PORTAL_SHELL_HEADERS },
    proxy: {
      "/api": { target: apiTarget, ws: true },
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        // Vite 8 (Rolldown) takes a function: long-lived vendor code in its own chunks.
        manualChunks(id: string) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          if (id.includes("node_modules/@tanstack/")) return "tanstack";
          if (id.includes("node_modules/@radix-ui/") || id.includes("node_modules/radix-ui/")) return "radix";
          return undefined;
        },
      },
    },
  },
});
