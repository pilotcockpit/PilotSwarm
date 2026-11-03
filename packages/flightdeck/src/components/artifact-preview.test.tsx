import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArtifactPreview } from "./artifact-preview";

describe("artifact thumbnail isolation", () => {
  it("keeps untrusted HTML behind the no-network wrapper and a scriptless, inert frame", () => {
    const markup = renderToStaticMarkup(<ArtifactPreview filename="canvas.html" html={'<h1>Actual output</h1><script>parent.postMessage("unexpected", "*")</script><img src="https://example.invalid/tracker">'} />);
    expect(markup).toContain('sandbox=""');
    expect(markup).toContain('inert=""');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('referrerPolicy="no-referrer"');
    expect(markup).toContain("Content-Security-Policy");
    expect(markup).toContain("default-src &#x27;none&#x27;");
    expect(markup).not.toContain("allow-scripts");
    expect(markup).not.toContain("allow-same-origin");
    expect(markup).not.toContain("&lt;script");
  });
});
