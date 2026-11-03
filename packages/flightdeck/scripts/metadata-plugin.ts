import type { Plugin } from "vite";
import { deploymentOrigin, NO_INDEX, staticMetadata } from "../src/lib/page-metadata.ts";

export const METADATA_HEADERS = {
  "X-Robots-Tag": NO_INDEX,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export function metadataPlugin(environment: Record<string, string | undefined>): Plugin {
  const origin = deploymentOrigin(environment);
  let building = false;
  return {
    name: "flightdeck-metadata",
    configResolved(config) { building = config.command === "build"; },
    transformIndexHtml(html) {
      if (!html.includes("<!-- site-metadata:start -->") || !html.includes("<!-- site-metadata:end -->")) throw new Error("Missing static metadata boundaries");
      return html.replace(/<!-- site-metadata:start -->[\s\S]*?<!-- site-metadata:end -->/, `<!-- site-metadata:start -->\n    ${staticMetadata(origin)}\n    <!-- site-metadata:end -->`);
    },
    buildStart() {
      if (building && !origin) this.warn("No VITE_PUBLIC_SITE_URL or VERCEL_URL: social image paths remain relative. Set the public HTTPS origin before deploying for fully qualified social cards; noindex remains enabled.");
    },
  };
}
