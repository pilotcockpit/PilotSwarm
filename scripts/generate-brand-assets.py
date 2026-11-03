# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.60.1"]
# ///
"""Generate path-only brand SVGs and web exports. Run: uv run scripts/generate-brand-assets.py.

ImageMagick 7 is a development-only export dependency. No font/rendering tools
are needed by the app or its production build. Inputs are committed locally.
"""
from pathlib import Path
from hashlib import sha256
import json
import shutil
import subprocess
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets/brand"
PUBLIC = ROOT / "packages/flightdeck/public"
FONT = BRAND / "fonts/Inter-Variable.ttf"
assert sha256(FONT.read_bytes()).hexdigest() == "29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031", "Unexpected source font"
assert shutil.which("magick"), "Install ImageMagick 7 for raster exports"
font = instantiateVariableFont(TTFont(FONT), {"wght": 600, "opsz": 24}, inplace=False)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
units = font["head"].unitsPerEm
written = []


def svg(width, height, content, title="PilotSwarm"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="img" aria-label="{title}"><title>{title}</title>{content}</svg>\n'


def mark(color, x=0, y=0, size=32):
    circles = [(16, 16, 3.2), (16, 7, 2), (16, 25, 2), (8.2, 11.5, 2), (23.8, 11.5, 2), (8.2, 20.5, 2), (23.8, 20.5, 2)]
    return f'<g transform="translate({x} {y}) scale({size/32})" fill="{color}">' + ''.join(f'<circle cx="{a}" cy="{b}" r="{r}"/>' for a, b, r in circles) + '</g>'


def text(value, x, baseline, size, color, tracking=0):
    scale = size / units
    out = []
    cursor = x
    for char in value:
        glyph = glyphs[cmap[ord(char)]]
        pen = SVGPathPen(glyphs)
        glyph.draw(pen)
        out.append(f'<path d="{pen.getCommands()}" transform="translate({cursor:.3f} {baseline}) scale({scale:.6f} {-scale:.6f})" fill="{color}"/>')
        cursor += glyph.width * scale + tracking
    return ''.join(out), cursor - x


def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    written.append(path)


def raster(source, destination, size):
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["magick", "-background", "none", str(source), "-resize", size, "-strip", str(destination)], check=True)
    written.append(destination)


for name, color in [("cobalt", "#315fcb"), ("ink", "#141518"), ("white", "#ffffff")]:
    write(BRAND / f"marks/mark-{name}.svg", svg(32, 32, mark(color)))

for variant, foreground, accent in [("light", "#141518", "#315fcb"), ("dark", "#ffffff", "#78a6ff")]:
    word, width = text("PilotSwarm", 84, 50, 52, foreground, -.8)
    write(BRAND / f"marks/wordmark-{variant}.svg", svg(round(88 + width), 68, mark(accent, size=64) + word))
    word, width = text("PilotSwarm", 0, 166, 44, foreground, -.6)
    word, _ = text("PilotSwarm", (280-width)/2, 166, 44, foreground, -.6)
    write(BRAND / f"marks/stacked-{variant}.svg", svg(280, 184, mark(accent, 84, 0, 112) + word))

for variant, radius in [("app-icon", 224), ("maskable", 0)]:
    write(BRAND / f"app/{variant}.svg", svg(1024, 1024, f'<rect width="1024" height="1024" rx="{radius}" fill="#141518"/>' + mark("#5c9dff", size=1024)))

for size in [16, 32, 48]:
    raster(PUBLIC / "favicon.svg", PUBLIC / f"favicon-{size}x{size}.png", f"{size}x{size}")
subprocess.run(["magick", str(PUBLIC / "favicon.svg"), "-background", "none", "-define", "icon:auto-resize=64,48,32,16", str(PUBLIC / "favicon.ico")], check=True)
written.append(PUBLIC / "favicon.ico")
raster(BRAND / "app/maskable.svg", PUBLIC / "apple-touch-icon.png", "180x180")
for size in [192, 512]:
    raster(BRAND / "app/app-icon.svg", PUBLIC / f"icons/icon-{size}.png", f"{size}x{size}")
raster(BRAND / "app/maskable.svg", PUBLIC / "icons/icon-maskable-512.png", "512x512")
raster(BRAND / "app/app-icon.svg", BRAND / "exports/avatar-1024.png", "1024x1024")
write(PUBLIC / "safari-pinned-tab.svg", svg(32, 32, mark("#000000")))
for name in ["mark-cobalt", "mark-ink", "mark-white", "wordmark-light", "wordmark-dark", "stacked-light", "stacked-dark"]:
    write(PUBLIC / f"brand/{name}.svg", (BRAND / f"marks/{name}.svg").read_text())


def card(dark=False, height=630):
    bg, fg, muted, accent = ("#141518", "#ffffff", "#b8bdc7", "#78a6ff") if dark else ("#f6f7f8", "#141518", "#555c68", "#315fcb")
    word, _ = text("PilotSwarm", 148, 117, 50, fg, -.7)
    headline, _ = text("Your agent workspace.", 72, 298, 64, fg, -1.5)
    line1, _ = text("Sessions, agents and outputs.", 76, 365, 27, muted)
    line2, _ = text("One place to pick up the work.", 76, 407, 27, muted)
    footer, _ = text("Flight Deck · Web experience preview", 76, height-65, 23, muted)
    return svg(1200, height, f'<rect width="1200" height="{height}" fill="{bg}"/>' + mark(accent, 66, 62, 70) + word + headline + line1 + line2 + mark(accent, 910, 230, 210) + footer, "PilotSwarm — Your agent workspace")


for name, dark, height in [("og-default", False, 630), ("og-dark", True, 630), ("twitter-card", False, 600)]:
    path = BRAND / f"social/{name}.svg"
    write(path, card(dark, height))
    raster(path, PUBLIC / f"social/{name}.png", f"1200x{height}")

# A single reviewable sheet: logos, icons and both social-card backgrounds.
sheet = '<rect width="1400" height="1200" fill="#eef0f4"/>'
for name, x, y, width, height, bg in [("wordmark-light", 40, 40, 620, 180, "#ffffff"), ("wordmark-dark", 720, 40, 620, 180, "#141518"), ("stacked-light", 40, 260, 300, 280, "#ffffff"), ("stacked-dark", 370, 260, 300, 280, "#141518")]:
    sheet += f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="16" fill="{bg}"/>'
    source = (BRAND / f"marks/{name}.svg").read_text()
    body = source[source.index('>')+1:source.rindex('</svg>')]
    sheet += f'<g transform="translate({x+40} {y+40}) scale({.95 if "wordmark" in name else .78})">{body}</g>'
sheet += f'<g transform="translate(765 285) scale(.23)">{(BRAND / "app/app-icon.svg").read_text().split(">",1)[1].rsplit("</svg>",1)[0]}</g>'
for name, x in [("og-default", 40), ("og-dark", 720)]:
    content = (BRAND / f"social/{name}.svg").read_text().split('>',1)[1].rsplit('</svg>',1)[0]
    sheet += f'<g transform="translate({x} 600) scale(.52)">{content}</g>'
write(BRAND / "brand-sheet.svg", svg(1400, 1000, sheet, "PilotSwarm brand asset review sheet"))
raster(BRAND / "brand-sheet.svg", BRAND / "brand-sheet.png", "1400x1000")

manifest = {"source": "Existing Flight Deck swarm favicon; no Microsoft corporate assets", "font": {"name": "Inter", "license": "SIL OFL 1.1", "sha256": sha256(FONT.read_bytes()).hexdigest()}, "files": [{"path": str(p.relative_to(ROOT)), "bytes": p.stat().st_size, "sha256": sha256(p.read_bytes()).hexdigest()} for p in sorted(written)]}
(BRAND / "asset-manifest.json").write_text(json.dumps(manifest, indent=2) + '\n')
print(f"Generated {len(written)} brand/web assets; source and export paths recorded in assets/brand/asset-manifest.json")
