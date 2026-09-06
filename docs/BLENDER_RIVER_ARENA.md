# Blender river arena

Original geometry authored and rendered in Blender 4.2: radial slate paving, a flush lotus mosaic, a stepped stone foundation with brass details, seven timber-and-silk lanterns with layered jade roofs, and a low riverside balustrade. This is Bangkok-inspired fantasy architecture, not a reconstruction of a named religious site.

- Editable source: `art/blender/river-arena.blend`.
- Generator: `scripts/blender/build_river_arena.py`.
- Game asset: `public/bangkok/models/river-arena.glb` — 26,460 triangles, 1,502,844 bytes, 16 material batches, no external textures.
- Studio render: `artifacts/blender-river-arena/river-arena.png`.

The playable plane and target positions are preserved. Paving ends below the targeting rings; tall architecture remains behind the actors. `RiverArena.ts` replaces the procedural floor/lantern group only after all three structural collections load. Incomplete or failed assets retain that fallback. World teardown owns attached resources, and late downloads release their geometry immediately.

Production build and 19 arena/combat unit tests passed. Tests check geometry bounds, upward surface normals, triangle/material budgets, failed loads and late disposal. Desktop and phone-emulated browser tests cover targeting, strikes, defense and exact combat reloads. A complete Keeper victory and an intentionally incomplete-model fallback case passed. The final report has `finished: true` and no console/page errors. Phone target/defense captures show the settled battle camera; the initial phone capture was taken during camera travel.

No enemy models, battle rules or rewards were changed. Physical-phone performance remains unverified. The broader adventure-quality goal is still active.
