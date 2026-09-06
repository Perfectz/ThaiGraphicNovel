# ChatGPT Image-Gen Asset Prompts — Bangkok Rift

Assets that **ChatGPT image generation (`gpt-image-1` / DALL·E)** can realistically produce to push
*Bangkok Rift — Isekai Thai Quest* from a procedural grey-box look toward a polished neon-Bangkok
game. Organized by impact. Each entry lists the **target use**, **export specs**, and a
**paste-ready prompt**.

> **Engine context:** Three.js, 10 data-driven stages built from primitives + a few procedural
> canvas textures (`src/components/three/proceduralTextures.ts`). The neon/emissive aesthetic
> (lanterns, signs, woks, rift portal) is the visual signature — lean into glow.

## What image-gen is good / bad at here

✅ **Good fits:** sky/backdrop images, base-color (albedo) surface textures, emissive signage &
poster art, flat UI icons, title/menu/loading art, item & inventory icons, 2D character portraits,
social/branding cards.

⚠️ **Limited:** ChatGPT can't emit a matched **PBR set** (normal + roughness + metalness maps from
one mesh) — generate albedo only and derive normal/roughness in a tool (or keep the existing
procedural roughness/normal). Perfectly **seamless tiling** is unreliable; always run a tile-check
and patch the seam, or use these on large planes where one repeat covers the surface.

❌ **Can't do:** 3D models/GLB (use Meshy), rigged characters, true cube-map skyboxes (generate
6 faces separately or use a single gradient dome image instead).

---

## 1. Sky domes / environment backdrops 🔴 highest ROI

Replaces the flat `scene.background` color (`MVP_VISUAL_REWORK.md` §1.3 / Phase 1.3). Map onto a
large inward-facing sphere behind each room.

**Specs:** 2048×1024 (2:1), PNG/JPG, no foreground objects, soft & low-contrast so it sits *behind*
the playable room without stealing focus.

### 1a. Night-market neon sky (Stages 3, 8)
```
A seamless 2:1 panoramic night sky backdrop for a 3D game, looking out over a blurred,
out-of-focus Bangkok skyline at night. Deep indigo-to-magenta gradient, hazy neon glow on the
horizon (pink, cyan, amber), soft bokeh city lights, light atmospheric fog. No buildings in sharp
focus, no people, no text. Painterly, low contrast, designed to sit far behind a game scene.
Horizontal panorama, 2048x1024.
```

### 1b. Warm dusk sky (Stages 1, 2, 7 — lobby/desk/café)
```
A seamless 2:1 panoramic dusk sky for a 3D game backdrop. Warm peach-to-violet gradient with soft
golden haze near the horizon and gentle wispy clouds. Calm, upscale, slightly hazy tropical
evening over an unfocused distant cityscape. No sharp detail, no text, no people. Painterly and
low-contrast for use as a far background dome. Horizontal panorama, 2048x1024.
```

### 1c. Cool overcast sky (Stages 6, 9 — clinic/embassy)
```
A seamless 2:1 panoramic overcast daytime sky for a 3D game backdrop. Cool pale-blue to soft grey
gradient, even diffuse light, faint distant haze. Clean, formal, neutral. No clouds in sharp focus,
no buildings, no text. Low contrast, painterly, made to sit behind an interior scene. 2048x1024.
```

### 1d. Rift-gate cosmic sky (Stage 10)
```
A seamless 2:1 panoramic backdrop of a swirling magical rift sky for a 3D game. Deep violet and
teal nebula clouds, scattered glowing particles, a faint vortex of pink-and-cyan energy on the
horizon. Mystical, ethereal, slightly out of focus. No characters, no text, no hard edges.
Painterly, atmospheric, made to glow behind a portal centerpiece. 2048x1024.
```

---

## 2. Tileable surface textures (albedo) 🔴 high ROI

Replaces/augments the procedural marble, plaster, brass. Apply as `map` on floors and walls; keep
the existing procedural roughness/normal or derive new ones in a tool.

**Specs:** 1024×1024, **seamless / tileable**, **flat even lighting — no baked shadows or
highlights**, top-down/face-on. Tag as sRGB albedo.

### 2a. Veined marble floor (lobby / embassy)
```
A seamless tileable texture of polished cream-and-grey veined marble, photographed perfectly
top-down with flat even studio lighting and no shadows or reflections. Subtle gold-grey veining,
high-end hotel lobby floor. The image must tile seamlessly with no visible seams at the edges.
Square 1024x1024, albedo / base-color only, no objects, no text.
```

### 2b. Mottled plaster wall
```
A seamless tileable texture of warm off-white mottled plaster wall, face-on, flat even lighting,
no shadows, no highlights. Subtle trowel mottling and faint age staining. Must tile seamlessly at
all edges. Square 1024x1024, albedo base-color only, no objects, no text.
```

### 2c. Wet night-market asphalt (Stages 4, 8)
```
A seamless tileable texture of dark wet city asphalt at night, top-down, flat even lighting, no
reflections of specific lights, no shadows. Damp charcoal-grey surface with faint cracks and grime,
subtle puddle sheen. Must tile seamlessly. Square 1024x1024, albedo base-color only, no text.
```

### 2d. Weathered teak wood planks (stalls / counters)
```
A seamless tileable texture of weathered warm teak wood planks, face-on, flat even lighting, no
shadows. Natural grain, slight wear, tropical hardwood. Must tile seamlessly at the edges. Square
1024x1024, albedo base-color only, no objects, no text.
```

### 2e. Woven bamboo / rattan matting (market dressing)
```
A seamless tileable texture of woven natural bamboo rattan matting, top-down, flat even lighting,
no shadows. Tight over-under weave in warm tan tones. Must tile seamlessly. Square 1024x1024,
albedo base-color only, no text.
```

---

## 3. Emissive signage & neon art 🔴 the bloom showpiece

Map onto flat planes with an emissive material so the existing `UnrealBloomPass` makes them glow.
This is the single most on-brand category for this game.

**Specs:** 1024×512 or 1024×1024, **PNG with transparent background**, art on a **pure black or
transparent** field so only the lit elements bloom.

### 3a. Thai neon shop sign set
```
A neon sign for a Bangkok night market, glowing pink and cyan tube lettering in a mix of Thai
script and small English, on a fully transparent background. Bright saturated emissive glow as if
lit in the dark, no surrounding wall, no mounting hardware. Centered, flat front view. PNG with
transparency, 1024x512.
```

### 3b. Glowing food-stall menu board (Stage 3)
```
A glowing illuminated street-food menu board for a 3D game, warm backlit panel with simple Thai and
English dish names and small food icons, soft amber glow. Transparent background, flat front-facing
view, no stall structure around it. Bright emissive look for a dark night scene. PNG with
transparency, 1024x1024.
```

### 3c. Paper-lantern face texture
```
A seamless texture for a glowing paper lantern: warm orange-red rice-paper with subtle ribbing and
a faint painted Thai motif, evenly lit from within, no shadows. Designed to wrap a cylinder and
glow. Square 1024x1024, no background objects, no text outside the motif.
```

### 3d. Hanging shop banners / vertical flags
```
A set of vertical hanging fabric market banners with Thai lettering, bright festive colors (red,
gold, teal), gentle cloth folds, on a transparent background. Flat front view, no poles, evenly
lit. PNG with transparency, 1024x1024.
```

---

## 4. Posters, decals & wall dressing 🟡

Quad decals to break up flat walls. Transparent PNGs.

### 4a. Bangkok travel / event posters
```
A small set of weathered Bangkok street posters and flyers — tropical travel ads, temple festival
notices, faux Thai movie posters — arranged as separate rectangles on a transparent background.
Slightly torn and sun-faded, flat front-on view, even lighting. PNG with transparency, 1024x1024.
```

### 4b. Grime / stain overlay decals
```
A set of subtle dark grime, water-stain, and scuff decals on a transparent background, soft-edged,
greyscale-brown, for layering onto game walls and floors to add age. No objects, no text. PNG with
transparency, 1024x1024.
```

---

## 5. UI icons 🟡 quick consistency win

Fixes the inconsistent unicode glyphs (`☷ ⚙ ⚔ 🎯`) called out in `MVP_VISUAL_REWORK.md` Phase 4.
Generate a **matched set in one image**, then slice — asking for them together keeps the style
consistent.

**Specs:** 1024×1024 sheet, transparent background, flat 2-tone style matching the neon UI.

### 5a. Core menu icon set
```
A set of 8 minimal flat UI icons in a single image on a transparent background, arranged in a neat
grid, consistent line weight and style. Icons: gear (settings), crossed swords (battle), target
(goals), map/roadmap, microphone (voice), speaker (audio), house (home), gift/star (rewards). Soft
neon-cyan and white on transparent, rounded modern style, no labels. PNG with transparency,
1024x1024.
```

### 5b. Voice-mode status icons
```
Three matching flat UI icons on a transparent background in one row: a microphone with sound waves,
a microphone with a slash (muted), and an ear/headphone (listening). Neon-cyan and white, rounded
modern line style, consistent weight, no text. PNG with transparency, 1024x512.
```

---

## 6. Title, menu & loading art 🟡

### 6a. Title-screen hero background
```
A wide cinematic title-screen background for a game called Bangkok Rift: a glowing magical rift of
pink and cyan energy tearing open above a stylized neon Bangkok night-market street, paper lanterns
and Thai neon signs, dramatic atmospheric haze, painterly anime/isekai illustration style. Leave
the upper-center area calmer and less detailed for a logo overlay. No text, no characters in front.
16:9, 1920x1080.
```

### 6b. Per-stage level-select thumbnails
Generate one per stage for the `LevelSelect` cards. Reuse this template, swapping the scene line:
```
A square illustrated thumbnail for a level-select menu, anime/isekai night style, vibrant and
glowing: <SCENE>. Painterly, atmospheric, no UI, no text, no people in the foreground. 1024x1024.
```
Scene fills: `1 — grand hotel lobby with chandelier`, `2 — hotel front desk with a glowing
key-rack wall`, `3 — dense neon night-market food street`, `4 — rainy taxi stand on Sukhumvit at
night`, `5 — floating market with lantern reflections on water`, `6 — clean cool-lit clinic
pharmacy`, `7 — warm cozy café with pendant lights`, `8 — moody neon back-alley with puddles`,
`9 — formal marble embassy archive`, `10 — glowing cosmic rift gate at a temple`.

### 6c. Loading / transition splash
```
A simple vertical loading-screen background, deep indigo with a faint glowing pink-cyan rift motif
and soft floating particles, lots of empty calm space for a spinner and tip text. Painterly,
atmospheric, no text. 1080x1920 portrait.
```

---

## 7. Item & inventory icons 🟢

Upgrades / extends the existing `keycard.png`, `passport.png`, `wallet.png`, `phone.png` and adds
night-market food items. Generate the set together for consistency.

### 7a. Core inventory items
```
A set of game inventory item icons in one image on a transparent background, neat grid, consistent
semi-realistic painterly style with soft rim light: a hotel keycard, a passport, a leather wallet,
a smartphone, a paper reservation slip, a coin purse with Thai baht. Each item centered with a soft
drop shadow, no labels. PNG with transparency, 1024x1024.
```

### 7b. Night-market food items (Stage 3)
```
A set of Thai street-food item icons in one image on a transparent background, neat grid, appetizing
painterly style with soft rim light: pad thai box, mango sticky rice, grilled satay skewers, a bowl
of tom yum, a coconut drink, fried spring rolls. Each centered with a soft drop shadow, no text.
PNG with transparency, 1024x1024.
```

---

## 8. 2D character portraits 🟢

Dialogue-portrait art for Su / Patrick / NPCs to sit beside the 3D rigs (the existing reaction
sprite sheets are functional but could be unified). Generate **one character, multiple expressions
in a row** for consistency.

### 8a. Su (AI tutor princess) expression sheet
```
Character expression sheet for a friendly anime AI-tutor princess named Su: same character repeated
in a horizontal row showing 5 expressions — warm smile, encouraging, surprised, thinking, gentle
laugh. Soft holographic-cyan and gold color scheme, isekai anime illustration, shoulders-up
portraits, plain transparent background, consistent face and outfit across all 5. PNG with
transparency, 1536x512.
```

### 8b. Patrick (player protagonist) expression sheet
```
Character expression sheet for a relatable young male traveler named Patrick: same character in a
horizontal row of 5 expressions — neutral, determined, worried, surprised, happy. Casual modern
clothes, anime/isekai illustration, shoulders-up portraits, plain transparent background, identical
face and outfit across all 5. PNG with transparency, 1536x512.
```

---

## 9. Branding & social 🟢

### 9a. Refreshed Open Graph card (replaces `public/og-card.png`)
```
A social share card for a game called Bangkok Rift: an Isekai Thai Quest. Cinematic neon Bangkok
night-market scene with a glowing pink-cyan rift, space in the center for a logo and tagline.
Vibrant anime/isekai illustration, no text. 1200x630.
```

### 9b. App icon / favicon
```
A clean app icon for a game called Bangkok Rift: a glowing pink-and-cyan magical rift symbol over a
small stylized Thai lantern, bold and readable at small sizes, deep indigo background, no text,
centered, rounded-square composition. 1024x1024.
```

---

## Suggested generation order

1. **Sky domes (§1)** + **surface textures (§2)** — touch every stage at once, biggest look change.
2. **Neon signage (§3)** — the bloom showpiece, fully on-brand.
3. **UI icon set (§5)** — fast, fixes the glyph inconsistency.
4. Everything else as polish.

## Post-gen checklist

- **Textures (§2, §3c):** run a tile/offset check; patch any visible seam before shipping.
- **Transparent PNGs (§3, §4, §5, §7, §8):** verify clean alpha edges; trim to content.
- **Albedo only:** keep textures shadow-free so engine lighting/bloom stays in control.
- **File placement:** textures → a new `src/assets/textures/`; signage/decals → `src/assets/decals/`;
  icons → `src/assets/ui/`; portraits → `src/assets/characters/`; skies → `src/assets/skies/`.
- **Color space:** load albedo textures as sRGB; mark roughness/normal (if derived) as linear.
