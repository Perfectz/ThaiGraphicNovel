#!/usr/bin/env python3
"""Build a labeled contact sheet of all 18 trailer scene thumbnails.

Layout: 3 columns × 6 rows. Each cell is the thumbnail (480 wide, ~270 tall)
plus a 36-px label strip below with the filename. The two batches (v1 cold-cut
of 6, v2 of 12) are visually grouped by a thin divider.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

INK = (10, 10, 11)
PAPER = (244, 241, 235)
PAPER_DIM = (196, 191, 179)
EMBER = (255, 92, 43)

THUMB_W = 480
THUMB_H = 270  # ~16:9
LABEL_H = 56
PAD = 14
COLS = 3
GROUP_LABEL_H = 44

# Ordered to read v1 first (the 6 from the first session), then v2 (the 12
# from the second session). Names mirror what's in linkedin-trailer/...
V1 = [
    "scene-1-cold-open",
    "scene-2-lobby-pan",
    "scene-3-night-market-phrase",
    "scene-4-wok-line-quote",
    "scene-5-su-orbit-stack",
    "scene-6-brand-mark",
]
V2 = [
    "scene-01-hook-what-if",
    "scene-02-su-coaching-hud",
    "scene-03-front-desk",
    "scene-04-phrase-sawatdee",
    "scene-05-inventory",
    "scene-06-scenarios-tease",
    "scene-07-phrase-mai-phet",
    "scene-08-atmospheric-lantern",
    "scene-09-stat-callout",
    "scene-10-hook-same-characters",
    "scene-11-pull-quote-tech",
    "scene-12-end-card-coming-soon",
]

here = Path(__file__).parent


def load_font(size):
    """Best-effort font loader; falls back to PIL default."""
    candidates = [
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\seguibl.ttf",
        r"C:\Windows\Fonts\consola.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def load_thumb(name):
    """Open and resize a thumbnail to 480x270 with letterbox fill."""
    p = here / f"{name}.jpg"
    img = Image.open(p).convert("RGB")
    img.thumbnail((THUMB_W, THUMB_H), Image.LANCZOS)
    canvas = Image.new("RGB", (THUMB_W, THUMB_H), INK)
    x = (THUMB_W - img.width) // 2
    y = (THUMB_H - img.height) // 2
    canvas.paste(img, (x, y))
    return canvas


def render_group(title, items):
    """Render one group (V1 or V2) as a sub-image. Returns (image, height)."""
    rows = (len(items) + COLS - 1) // COLS
    width = COLS * THUMB_W + (COLS + 1) * PAD
    height = GROUP_LABEL_H + rows * (THUMB_H + LABEL_H + PAD) + PAD
    img = Image.new("RGB", (width, height), INK)
    draw = ImageDraw.Draw(img)

    title_font = load_font(24)
    label_font = load_font(20)
    sublabel_font = load_font(15)

    draw.text((PAD + 4, 10), title, fill=PAPER, font=title_font)
    # Accent rule under the group title
    draw.rectangle(
        [PAD + 4, GROUP_LABEL_H - 6, PAD + 60, GROUP_LABEL_H - 4],
        fill=EMBER,
    )

    for i, name in enumerate(items):
        col = i % COLS
        row = i // COLS
        x = PAD + col * (THUMB_W + PAD)
        y = GROUP_LABEL_H + row * (THUMB_H + LABEL_H + PAD)
        thumb = load_thumb(name)
        img.paste(thumb, (x, y))
        # Label strip below
        label_y = y + THUMB_H
        draw.rectangle([x, label_y, x + THUMB_W, label_y + LABEL_H], fill=(21, 23, 27))
        # Strip "scene-" prefix for readability, uppercase the rest
        nice = name.replace("scene-", "").replace("-", " ").upper()
        draw.text((x + 14, label_y + 8), nice, fill=PAPER, font=label_font)
        # File name in dim mono on the next line
        draw.text((x + 14, label_y + 33), f"{name}.mp4", fill=PAPER_DIM, font=sublabel_font)

    return img


def main():
    g1 = render_group("V1 · 6 scenes (60s polished trailer)", V1)
    g2 = render_group("V2 · 12 scenes (variety building blocks)", V2)
    # Stack vertically with a separator
    total_w = max(g1.width, g2.width)
    separator = 32
    total_h = g1.height + separator + g2.height + 60  # extra top/bottom padding
    final = Image.new("RGB", (total_w, total_h), INK)
    draw = ImageDraw.Draw(final)
    final.paste(g1, (0, 30))
    # Divider rule between groups
    sep_y = 30 + g1.height + separator // 2
    draw.line(
        [(PAD, sep_y), (total_w - PAD, sep_y)],
        fill=(58, 61, 68),
        width=1,
    )
    final.paste(g2, (0, 30 + g1.height + separator))
    out = here / "_all-clips.png"
    final.save(out, optimize=True)
    print(f"wrote {out}  ({final.width}x{final.height})")


if __name__ == "__main__":
    main()
