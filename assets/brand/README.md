# PilotSwarm brand assets

Editable identity masters live in this repository-level `assets/brand/` directory.
Browser assets are exported to `packages/flightdeck/public/`, where the frontend
serves them at stable root-relative URLs. Audit screenshots and review records
belong in `docs/ux-audit/`, rather than either shipping directory.

| Directory | Contents | Use |
| --- | --- | --- |
| `marks/` | Path-only SVG marks, horizontal and stacked wordmarks | Editable identity masters; light/dark treatments |
| `app/` | 1024px SVG app-icon and full-bleed maskable masters | Source for platform exports |
| `social/` | 1200×630 OG and 1200×600 X/Twitter SVG masters | Generic product sharing artwork |
| `exports/` | 1024px PNG avatar | Repository/profile/presentation use |
| `fonts/` | Inter source font and SIL OFL license | Reproducible asset generation; not loaded by the app |
| `brand-sheet.svg`, `brand-sheet.png` | Contact sheet | Review/reference |
| `asset-manifest.json` | Export paths, SHA-256 hashes and provenance | Build verification |
| `../../packages/flightdeck/public/brand/` | Seven SVG logo exports | Browser-accessible identity assets |
| `../../packages/flightdeck/public/social/` | OG light/dark and X/Twitter PNGs | Social-preview metadata |
| `../../packages/flightdeck/public/icons/` | 192/512px app icons; 512px maskable icon | Web manifest |
| `../../packages/flightdeck/public/` | SVG/ICO/16/32/48px favicons, 180px Apple icon, pinned-tab SVG | Platform-conventional root filenames |

## Identity and use

This extends the seven-dot swarm geometry already present in Flight Deck's
`public/favicon.svg`; it does not introduce Microsoft corporate artwork or imply
Microsoft endorsement. It is a proposed PilotSwarm web identity kit, subject to
upstream maintainers' acceptance. The existing repository license remains
applicable to project artwork; the font has its own license below.

Use the light wordmark on light surfaces and the dark wordmark on dark surfaces.
Use the ink/white monochrome marks where color is unavailable. Keep at least one
central-dot diameter of clear space outside the visible mark/wordmark. Preserve
aspect ratios. Small browser icons use the dedicated exports. The maskable icon
has a full-bleed background, with the entire seven-dot mark inside the central
80% safe circle. Apple icons have no pre-rounded outer corners.

Core export colors are cobalt `#315fcb`, dark-surface accent `#78a6ff`, ink
`#141518` and white. App icons preserve the existing favicon accent `#5c9dff`.
These artwork colors do not replace the application's semantic theme tokens.
Wordmarks and card text use outlined Inter 600 paths; runtime text retains the
application font. SVG exports require no external fonts, images or scripts.

Social cards contain generic product copy and no workspace screenshots, names,
counts, private identifiers or generated metrics. The light card is the default;
the dark version is available for editorial use. Avoid embedding customer output
in public brand assets.

## Reproduction and font provenance

Run from the repository root:

```sh
uv run scripts/generate-brand-assets.py
```

The script pins `fonttools==4.60.1` through PEP 723 and requires Python 3.11+ and
ImageMagick 7 (`magick`) for development-time raster exports. It uses committed
local inputs; generation makes no model/provider calls. ImageMagick is an
external development tool, so different renderer versions can change raster
bytes. Commit regenerated exports and their manifest together. Production builds
consume the exports and validate their hashes; they do not install these tools.

Inter was obtained from the official Google Fonts repository:
[Inter variable font](https://github.com/google/fonts/blob/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf).
The committed font SHA-256 is
`29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031`.
Copyright is held by the Inter Project Authors. The full
[SIL Open Font License 1.1](fonts/OFL.txt) is included with the source font.
The generation script checks this source hash before producing assets.

The web manifest and metadata files remain hand-authored frontend configuration;
the generator updates artwork only. See the
[metadata coverage tracker](../../docs/ux-audit/2026-11-01/metadata/README.md)
for page coverage and hosting verification limits.
