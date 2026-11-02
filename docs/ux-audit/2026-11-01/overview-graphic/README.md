# Overview welcome graphic — 1 November 2026

The owner reopened the welcome illustration direction after reviewing the
current Overview. This narrowly supersedes the October workbench's no-art rule
for the welcome header. Real output previews remain actual artifact content.
The ongoing sessions/sidebar redesign and its edited DESIGN.md were preserved.

Added a compact cobalt paper glider lifting from ivory documents, with one ochre
tab. New session now sits with the greeting and supporting copy. The illustration
is decorative, has no SDK state or interactive meaning, uses empty alt text,
explicit dimensions and responsive sizing, and adds no dependencies or motion.

Final asset: [welcome-paper-flight.webp](../../../../packages/flightdeck/public/assets/welcome-paper-flight.webp),
624×416 with transparent alpha, 29,136 bytes. Built-in image generation was used
for both the initial image and one background-cleanup pass; cwebp exported the
final optimized rendition. The original generations were retained locally.

## Verification

- Production Flight Deck build passed: TypeScript, token guard, Vite and
  production demo-hook exclusion. The existing >500 kB bundle warning remains.
- Browser-demo inspection at 1440×950 and 390×844 in both themes: image loaded,
  no horizontal overflow at phone size, greeting/action readable, art isolated
  cleanly against both backgrounds. Light theme was restored after QA.
- No backend, SDK, provider, database or model execution was used for UI QA.
  No new unit tests were added for this decorative layout change.
- The design hook found no deterministic issue. It reported an existing
  DESIGN.md/sidecar freshness mismatch; those concurrently edited design files
  were not regenerated or overwritten as part of this narrow asset task.

Captures: [desktop light](desktop-light.png), [desktop dark](desktop-dark.png),
[phone light](mobile-light.png), [phone dark](mobile-dark.png).

## Generation prompts

Initial, transparent background:

> Use case: stylized-concept. Asset type: compact transparent editorial spot illustration for the welcome header of PilotSwarm, a professional workspace for durable AI agent work. Create one beautifully art-directed paper-flight vignette: one elegant folded cobalt-blue paper glider lifting from three overlapping ivory document sheets, their small abstract ink marks suggesting work without legible text, and one restrained warm ochre tab. Sophisticated cut-paper editorial illustration, crisp folds, tactile matte paper, subtle natural dimensional shading, excellent clean silhouette. Three-quarter side view; balanced horizontal composition, entire subject contained with a little clear alpha margin, optimized to read at 210 by 140 CSS pixels. Palette limited to cobalt, pale blue, warm ivory, one small muted ochre accent. Transparent background, no floor or backdrop, no enclosing shape, no gradient cloud, no glow, no glossy plastic, no robot or mascot, no dashboards/charts/metrics, no lettering, no logo, no watermark. A single compact cohesive object arrangement with confident simplicity; polished premium software editorial art.

Cleanup edit, transparent background, initial image as edit target:

> Edit only the background and edge treatment of this paper glider and document illustration. Preserve the exact objects, arrangement, perspective, colors, folds and document marks. Remove ALL the broad diffuse white haze and blue/ochre glow surrounding the objects. The background and every gap between objects must be fully transparent alpha, with tightly cut clean edges. No outer shadow, no ground shadow, no bloom, no feathered cloud, no atmospheric lighting. Keep shading only on the paper surfaces themselves. Output a clean isolated cutout that can sit on either a light gray or charcoal UI surface without any visible aura.

## Update, later the same day

The New session button next to the greeting became a start box (what to do, project, Start) when Overview was reorganised around deciding and monitoring. The illustration, its placement beside the greeting and its sizing are unchanged.
