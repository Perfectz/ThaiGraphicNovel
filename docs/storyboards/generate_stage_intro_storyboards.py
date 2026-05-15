from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "storyboards"

PANEL_W = 480
PANEL_H = 270
GAP = 18
MARGIN = 22
HEADER_H = 0
CAPTION_H = 0
SHEET_W = MARGIN * 2 + PANEL_W * 5 + GAP * 4
SHEET_H = MARGIN * 2 + PANEL_H


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def cover_crop(img: Image.Image, size: tuple[int, int], zoom: float = 1.0, pan_x: float = 0.5, pan_y: float = 0.5) -> Image.Image:
    img = img.convert("RGB")
    target_w, target_h = size
    scale = max(target_w / img.width, target_h / img.height) * zoom
    resized = img.resize((int(img.width * scale), int(img.height * scale)), Image.Resampling.LANCZOS)
    max_x = max(0, resized.width - target_w)
    max_y = max(0, resized.height - target_h)
    left = int(max_x * pan_x)
    top = int(max_y * pan_y)
    return resized.crop((left, top, left + target_w, top + target_h)).convert("RGBA")


def crop_alpha(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGBA")
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


PATRICK = crop_alpha(ROOT / "src" / "assets" / "battle" / "patrick-back-sprite.png")
SU = crop_alpha(ROOT / "src" / "assets" / "battle" / "su-battle-sprite.png")


def fit_character(img: Image.Image, height: int) -> Image.Image:
    scale = height / img.height
    return img.resize((int(img.width * scale), height), Image.Resampling.LANCZOS)


PATRICK_SMALL = fit_character(PATRICK, 215)
PATRICK_MED = fit_character(PATRICK, 245)
SU_SMALL = fit_character(SU, 215)
SU_MED = fit_character(SU, 245)


def rotate_character(sprite: Image.Image, angle: int, height: int) -> Image.Image:
    fitted = fit_character(sprite, height)
    return fitted.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)


PATRICK_FALLEN = rotate_character(PATRICK, 90, 190)


def paste_center_bottom(base: Image.Image, sprite: Image.Image, center_x: int, bottom_y: int, alpha: int = 255) -> None:
    layer = sprite.copy()
    if alpha < 255:
        a = layer.getchannel("A").point(lambda v: int(v * alpha / 255))
        layer.putalpha(a)
    x = int(center_x - layer.width / 2)
    y = int(bottom_y - layer.height)
    base.alpha_composite(layer, (x, y))


def add_vignette(panel: Image.Image, strength: int = 100) -> Image.Image:
    overlay = Image.new("RGBA", panel.size, (0, 0, 0, 0))
    mask = Image.new("L", panel.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((-80, -70, panel.width + 80, panel.height + 70), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(45))
    inverse = Image.eval(mask, lambda v: 255 - v)
    overlay.putalpha(inverse.point(lambda v: int(v * strength / 255)))
    return Image.alpha_composite(panel, overlay)


def tint(panel: Image.Image, color: tuple[int, int, int], alpha: int) -> Image.Image:
    return Image.alpha_composite(panel, Image.new("RGBA", panel.size, (*color, alpha)))


def glow(panel: Image.Image, xy: tuple[int, int], radius: int, color: tuple[int, int, int], alpha: int = 120) -> None:
    layer = Image.new("RGBA", panel.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x, y = xy
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*color, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(radius // 2))
    panel.alpha_composite(layer)


def draw_rift(panel: Image.Image, x: int, y: int, h: int, color: tuple[int, int, int]) -> None:
    layer = Image.new("RGBA", panel.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for i in range(5):
        offset = i * 7
        draw.line(
            [
                (x, y - h // 2 + offset),
                (x + 24, y - h // 4),
                (x - 16, y),
                (x + 30, y + h // 4),
                (x - 8, y + h // 2 - offset),
            ],
            fill=(*color, 90 + i * 25),
            width=6 - min(i, 3),
        )
    layer = layer.filter(ImageFilter.GaussianBlur(2))
    panel.alpha_composite(layer)


def draw_cards(panel: Image.Image, labels: list[str], color: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(panel)
    positions = [(78, 70), (120, 122), (68, 168)]
    for i, _label in enumerate(labels[:3]):
        cx, cy = positions[i]
        draw.ellipse((cx - 28, cy - 28, cx + 28, cy + 28), fill=(*color, 105), outline=(255, 255, 255, 205), width=2)
        draw.arc((cx - 19, cy - 19, cx + 19, cy + 19), start=25 + i * 30, end=300, fill=(255, 255, 255, 220), width=3)
        draw.line((cx - 12, cy, cx + 12, cy), fill=(255, 255, 255, 210), width=3)
        draw.line((cx, cy - 12, cx, cy + 12), fill=(255, 255, 255, 175), width=2)


def draw_reward(panel: Image.Image, label: str, color: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(panel)
    cx, cy = PANEL_W - 86, 74
    glow(panel, (cx, cy), 58, color, 120)
    draw.ellipse((cx - 42, cy - 42, cx + 42, cy + 42), fill=(*color, 205), outline=(255, 255, 255, 235), width=3)
    draw.polygon(
        [(cx, cy - 24), (cx + 17, cy + 4), (cx + 7, cy + 26), (cx - 18, cy + 26), (cx - 26, cy + 1)],
        fill=(255, 255, 255, 235),
    )
    draw.arc((cx - 25, cy - 25, cx + 25, cy + 25), start=210, end=330, fill=(255, 255, 255, 245), width=4)


def panel_text(panel: Image.Image, text: str) -> None:
    return None


def make_panel(bg_path: Path, stage: dict, beat: dict, index: int) -> Image.Image:
    bg = Image.open(beat.get("bg", bg_path))
    panel = cover_crop(bg, (PANEL_W, PANEL_H), zoom=beat.get("zoom", 1.0), pan_x=beat.get("pan_x", 0.5), pan_y=beat.get("pan_y", 0.5))
    color = stage["color"]
    if beat.get("tint"):
        panel = tint(panel, beat["tint"], beat.get("tint_alpha", 36))
    glow(panel, beat.get("glow_xy", (PANEL_W - 92, 82)), beat.get("glow_radius", 58), color, beat.get("glow_alpha", 75))
    if beat.get("rift"):
        draw_rift(panel, beat.get("rift_x", PANEL_W - 90), beat.get("rift_y", 126), beat.get("rift_h", 190), color)
    if beat.get("patrick"):
        sprite = PATRICK_MED if beat.get("patrick") == "med" else PATRICK_SMALL
        paste_center_bottom(panel, sprite, beat.get("patrick_x", 165), beat.get("patrick_y", PANEL_H + 8), beat.get("patrick_alpha", 255))
    if beat.get("fallen_patrick"):
        panel.alpha_composite(PATRICK_FALLEN, (beat.get("fallen_x", 115), beat.get("fallen_y", 116)))
    if beat.get("su"):
        sprite = SU_MED if beat.get("su") == "med" else SU_SMALL
        paste_center_bottom(panel, sprite, beat.get("su_x", 326), beat.get("su_y", PANEL_H + 6), beat.get("su_alpha", 255))
    if beat.get("cards"):
        draw_cards(panel, beat["cards"], color)
    if beat.get("reward"):
        draw_reward(panel, stage["reward"], color)
    if beat.get("arrow"):
        draw = ImageDraw.Draw(panel)
        x1, y1, x2, y2 = beat["arrow"]
        draw.line((x1, y1, x2, y2), fill=(*color, 230), width=8)
        draw.polygon([(x2, y2), (x2 - 22, y2 - 13), (x2 - 18, y2 + 17)], fill=(*color, 230))
    if beat.get("support"):
        draw = ImageDraw.Draw(panel)
        x1, y1, x2, y2 = beat["support"]
        for width, alpha in ((18, 55), (10, 120), (4, 235)):
            draw.line((x1, y1, x2, y2), fill=(*color, alpha), width=width)
        draw.ellipse((x2 - 10, y2 - 10, x2 + 10, y2 + 10), fill=(*color, 220))
    panel = add_vignette(panel, beat.get("vignette", 82))
    return panel


STAGES = [
    {
        "slug": "01-hotel-lobby-basics",
        "title": "Stage 1 - Hotel Lobby Basics",
        "bg": ROOT / "src" / "assets" / "ui" / "hotel-lobby-background.png",
        "reward": "Traveler's Notebook",
        "color": (167, 139, 250),
        "beats": [
            {"caption": "Rift drop into the hotel lobby", "fallen_patrick": True, "fallen_x": 124, "fallen_y": 148, "rift": True, "zoom": 1.02, "pan_x": 0.48},
            {"caption": "Su rushes in to stabilize Patrick", "fallen_patrick": True, "fallen_x": 106, "fallen_y": 154, "su": "med", "su_x": 337, "support": (317, 112, 218, 194), "zoom": 1.04, "pan_x": 0.45},
            {"caption": "The lobby becomes a safe training arena", "patrick": "small", "su": "med", "patrick_x": 170, "cards": ["", "", ""], "zoom": 1.03},
            {"caption": "Heal phrase restores Courage", "patrick": "med", "su": "small", "cards": [""], "glow_xy": (160, 88), "zoom": 1.06},
            {"caption": "Notebook earned; route opens", "patrick": "med", "su": "med", "reward": True, "rift": True, "zoom": 1.05},
        ],
    },
    {
        "slug": "02-front-desk-check-in",
        "title": "Stage 2 - Front Desk Check-In",
        "bg": ROOT / "src" / "assets" / "backgrounds" / "front-desk-check-in.png",
        "reward": "Keycard Buckler",
        "color": (34, 211, 238),
        "beats": [
            {"caption": "Su guides Patrick out of the lobby", "bg": ROOT / "src" / "assets" / "ui" / "hotel-lobby-background.png", "patrick": "small", "su": "med", "arrow": (290, 198, 420, 198), "zoom": 1.04, "pan_x": 0.55},
            {"caption": "Reception desk pressure", "zoom": 1.02, "pan_x": 0.44, "cards": [""]},
            {"caption": "Patrick gives his booking name", "patrick": "med", "su": "small", "patrick_x": 168, "su_x": 330, "zoom": 1.05},
            {"caption": "Su coaches slower speech", "patrick": "small", "su": "med", "cards": ["", ""], "zoom": 1.04},
            {"caption": "Keycard buckler unlocks the next route", "patrick": "med", "su": "small", "reward": True, "zoom": 1.03},
        ],
    },
    {
        "slug": "03-street-food-order",
        "title": "Stage 3 - Street Food Order",
        "bg": ROOT / "src" / "assets" / "backgrounds" / "street-food-order.png",
        "reward": "Spoon Saber",
        "color": (251, 113, 133),
        "beats": [
            {"caption": "Patrick leaves check-in hungry", "bg": ROOT / "src" / "assets" / "backgrounds" / "front-desk-check-in.png", "patrick": "small", "su": "med", "arrow": (285, 200, 420, 200), "zoom": 1.05},
            {"caption": "Night market opens in neon and steam", "zoom": 1.02, "pan_x": 0.46, "tint": (20, 10, 30)},
            {"caption": "Mystery dish challenges Patrick", "patrick": "small", "su": "small", "cards": [""], "zoom": 1.07},
            {"caption": "Spice-control phrases appear", "patrick": "med", "su": "med", "cards": ["", ""], "glow_xy": (260, 74), "zoom": 1.05},
            {"caption": "Spoon Saber ignites", "patrick": "med", "su": "med", "reward": True, "zoom": 1.03},
        ],
    },
    {
        "slug": "04-taxi-ride",
        "title": "Stage 4 - Taxi Ride Across Bangkok",
        "bg": ROOT / "src" / "assets" / "backgrounds" / "taxi-ride-sukhumvit.png",
        "reward": "Compass Amulet",
        "color": (96, 165, 250),
        "beats": [
            {"caption": "Su pulls Patrick from the market to the taxi stand", "bg": ROOT / "src" / "assets" / "backgrounds" / "street-food-order.png", "patrick": "small", "su": "med", "arrow": (285, 202, 420, 202), "zoom": 1.05},
            {"caption": "Taxi lights cut through Bangkok traffic", "zoom": 1.04, "pan_x": 0.38},
            {"caption": "Destination phrase points to the temple", "patrick": "small", "su": "small", "cards": [""], "zoom": 1.06},
            {"caption": "Meter Flare reveals the fair route", "patrick": "med", "su": "med", "cards": ["", ""], "glow_xy": (248, 84), "zoom": 1.08},
            {"caption": "Compass Amulet locks onto the shrine", "patrick": "med", "su": "med", "reward": True, "zoom": 1.03},
        ],
    },
    {
        "slug": "05-market-bargain",
        "title": "Stage 5 - Market Bargain",
        "bg": ROOT / "src" / "assets" / "backgrounds" / "market-bargain-charm-shop.png",
        "reward": "Silk Vest",
        "color": (45, 212, 191),
        "beats": [
            {"caption": "Taxi drops them at the floating market", "bg": ROOT / "src" / "assets" / "backgrounds" / "taxi-ride-sukhumvit.png", "patrick": "small", "su": "med", "arrow": (285, 202, 420, 202), "zoom": 1.05},
            {"caption": "Charm shop floats on market water", "zoom": 1.02, "pan_x": 0.5},
            {"caption": "Patrick asks to see the item", "patrick": "small", "su": "small", "cards": [""], "zoom": 1.06},
            {"caption": "Discount phrases turn into seals", "patrick": "med", "su": "med", "cards": ["", ""], "glow_xy": (242, 84), "zoom": 1.05},
            {"caption": "Silk Vest reward seals the deal", "patrick": "med", "su": "med", "reward": True, "zoom": 1.04},
        ],
    },
    {
        "slug": "06-clinic-and-pharmacy",
        "title": "Stage 6 - Clinic And Pharmacy",
        "bg": ROOT / "src" / "assets" / "backgrounds" / "clinic-and-pharmacy.png",
        "reward": "First Aid Charm",
        "color": (34, 197, 94),
        "beats": [
            {"caption": "A bad market drink sends Patrick to the pharmacy", "bg": ROOT / "src" / "assets" / "backgrounds" / "market-bargain-charm-shop.png", "patrick": "small", "su": "med", "glow_xy": (165, 92), "arrow": (285, 202, 420, 202), "zoom": 1.05},
            {"caption": "Pharmacy shelves glow with remedies", "zoom": 1.02, "pan_x": 0.46},
            {"caption": "Patrick explains what hurts", "patrick": "med", "su": "small", "cards": ["", ""], "zoom": 1.05},
            {"caption": "Medicine questions prevent mistakes", "patrick": "small", "su": "med", "cards": ["", ""], "zoom": 1.06},
            {"caption": "First Aid Charm restores calm", "patrick": "med", "su": "small", "reward": True, "zoom": 1.03},
        ],
    },
    {
        "slug": "07-friendship-plans",
        "title": "Stage 7 - Friendship Plans",
        "bg": ROOT / "src" / "assets" / "backgrounds" / "friendship-plans-cafe.png",
        "reward": "Friendship Ring",
        "color": (232, 121, 249),
        "beats": [
            {"caption": "After the pharmacy, Su brings Patrick somewhere calm", "bg": ROOT / "src" / "assets" / "backgrounds" / "clinic-and-pharmacy.png", "patrick": "small", "su": "med", "arrow": (285, 202, 420, 202), "zoom": 1.05},
            {"caption": "Riverside cafe softens the quest", "zoom": 1.02, "pan_x": 0.52},
            {"caption": "Su introduces Patrick to friends", "patrick": "small", "su": "med", "cards": [""], "zoom": 1.05},
            {"caption": "Invitation Chain links the plan", "patrick": "med", "su": "med", "cards": ["", ""], "glow_xy": (247, 90), "zoom": 1.04},
            {"caption": "Friendship Ring unlocks warmer NPCs", "patrick": "med", "su": "med", "reward": True, "zoom": 1.03},
        ],
    },
    {
        "slug": "08-directions-and-emergency",
        "title": "Stage 8 - Directions And Emergency",
        "bg": ROOT / "src" / "assets" / "backgrounds" / "directions-emergency-alley.png",
        "reward": "Map Cloak",
        "color": (244, 63, 94),
        "beats": [
            {"caption": "Cafe plans break when the rift scatters the party", "bg": ROOT / "src" / "assets" / "backgrounds" / "friendship-plans-cafe.png", "patrick": "small", "su": "med", "rift": True, "arrow": (285, 202, 420, 202), "zoom": 1.05},
            {"caption": "Rift storm twists the lost alley", "rift": True, "zoom": 1.02, "pan_x": 0.46, "tint": (20, 30, 60)},
            {"caption": "Phone dies; Patrick asks directions", "patrick": "med", "cards": [""], "zoom": 1.06},
            {"caption": "Emergency Beacon calls Su guidance", "patrick": "med", "cards": [""], "glow_xy": (242, 74), "rift": True, "zoom": 1.07},
            {"caption": "Map Cloak marks the correct route", "patrick": "med", "su": "med", "reward": True, "zoom": 1.04},
        ],
    },
    {
        "slug": "09-formal-meeting",
        "title": "Stage 9 - Formal Meeting",
        "bg": ROOT / "src" / "assets" / "backgrounds" / "formal-meeting-archive.png",
        "reward": "Polite Seal",
        "color": (99, 102, 241),
        "beats": [
            {"caption": "The map points from the alley to official records", "bg": ROOT / "src" / "assets" / "backgrounds" / "directions-emergency-alley.png", "patrick": "small", "su": "med", "arrow": (285, 202, 420, 202), "zoom": 1.05},
            {"caption": "Embassy archive guards the rift records", "zoom": 1.03, "pan_x": 0.48},
            {"caption": "Permission phrase opens the door", "patrick": "med", "su": "small", "cards": [""], "zoom": 1.05},
            {"caption": "Patrick explains the purpose", "patrick": "small", "su": "med", "cards": ["", ""], "zoom": 1.06},
            {"caption": "Polite Seal points to the temple gate", "patrick": "med", "su": "small", "reward": True, "zoom": 1.03},
        ],
    },
    {
        "slug": "10-rift-negotiation-finale",
        "title": "Stage 10 - Rift Negotiation Finale",
        "bg": ROOT / "src" / "assets" / "backgrounds" / "rift-negotiation-temple-gate.png",
        "reward": "Language Crown",
        "color": (250, 204, 21),
        "beats": [
            {"caption": "Archive clue sends Patrick and Su to the temple", "bg": ROOT / "src" / "assets" / "backgrounds" / "formal-meeting-archive.png", "patrick": "small", "su": "med", "arrow": (285, 202, 420, 202), "zoom": 1.05},
            {"caption": "Temple gate opens under the rift", "rift": True, "zoom": 1.02, "pan_x": 0.52, "tint": (35, 20, 45)},
            {"caption": "Patrick chooses words before combat", "patrick": "med", "su": "small", "cards": ["", ""], "zoom": 1.06},
            {"caption": "Protect Su phrase becomes a shield", "patrick": "med", "su": "med", "su_x": 350, "cards": [""], "glow_xy": (330, 78), "zoom": 1.06},
            {"caption": "Language Crown closes the campaign", "patrick": "med", "su": "med", "reward": True, "rift": True, "zoom": 1.03},
        ],
    },
]


def make_sheet(stage: dict) -> Path:
    sheet = Image.new("RGB", (SHEET_W, SHEET_H), (16, 18, 27))
    draw = ImageDraw.Draw(sheet)
    draw.rectangle((0, 0, SHEET_W, SHEET_H), fill=(18, 21, 31))
    for i, beat in enumerate(stage["beats"], start=1):
        x = MARGIN + (i - 1) * (PANEL_W + GAP)
        y = MARGIN
        panel = make_panel(stage["bg"], stage, beat, i).convert("RGB")
        sheet.paste(panel, (x, y))
        draw.rectangle((x - 2, y - 2, x + PANEL_W + 2, y + PANEL_H + 2), outline=(235, 238, 245), width=2)
    out = OUT_DIR / f"{stage['slug']}-storyboard.png"
    sheet.save(out, quality=95)
    return out


def make_index(paths: list[Path]) -> Path:
    thumb_w = 520
    thumb_h = 104
    cols = 2
    rows = 5
    index = Image.new("RGB", (MARGIN * 2 + cols * thumb_w + GAP, MARGIN * 2 + rows * (thumb_h + GAP) - GAP), (15, 17, 25))
    draw = ImageDraw.Draw(index)
    for i, path in enumerate(paths):
        sheet = Image.open(path).convert("RGB")
        thumb = sheet.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        col = i % cols
        row = i // cols
        x = MARGIN + col * (thumb_w + GAP)
        y = MARGIN + row * (thumb_h + GAP)
        index.paste(thumb, (x, y))
        draw.rectangle((x, y, x + thumb_w, y + thumb_h), outline=(235, 238, 245), width=1)
    out = OUT_DIR / "stage-intro-storyboard-index.png"
    index.save(out, quality=95)
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    paths = [make_sheet(stage) for stage in STAGES]
    index = make_index(paths)
    print(index)
    for path in paths:
        print(path)


if __name__ == "__main__":
    main()
