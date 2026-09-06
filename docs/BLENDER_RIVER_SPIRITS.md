# Original river spirits

This pass replaces the two procedural river-enemy bodies with original Blender models: a masked, robed River Keeper and an open-cage Lantern Echo. The guardian has a carved face, recessed luminous eyes, a lantern heart, twelve layered mantle panels, floating arms and a segmented halo. The echo has curved cage ribs, a living light and six ceramic petals. These are original fantasy creatures; they do not reproduce a named religious figure or another game's character.

## Assets and integration

- Editable Blender scene: `art/blender/river-spirits.blend`.
- Reproducible generator: `scripts/blender/build_river_spirits.py` (Blender 4.2).
- Runtime asset: `public/bangkok/models/river-spirits.glb` — 22,732 triangles, 609,112 bytes. Materials are included; there are no texture downloads.
- Studio preview: `artifacts/blender-river-spirits/river-spirits.png`.
- Four articulated parts: left/right arms, guardian halo and echo petals. The Blender file contains a studio arrangement; the generator exports both models at the origin before arranging the preview.

`RiverSpirits.ts` loads and validates both creatures, then attaches them beneath the existing enemy groups. Combat continues to own positions, health, turns, target selection, damage and death. The guardian raises its arms on its actual enemy action; the echo's petals move independently. Existing floating motion, hit reactions and defeat shrinking apply to the new bodies. Reduced-motion mode removes the new gestures and rotations. The Waywarden keeps its separate compass body while its support echo uses the new lantern.

The complete original enemy bodies remain available until both Blender creatures and all motion parts load successfully. Failed or malformed downloads retain those bodies. Attached geometry belongs to world teardown; a late download disposes itself. Runtime diagnostics expose model readiness and presentation poses without writing combat state.

Portrait combat now uses tighter enemy-status line spacing and a slightly wider, lower-framed camera. This addresses the inspected overlap between status panels and the guardian's crown. The diagnostic snapshot projects the actual mask geometry through the active camera, so the browser verifier checks that its bounds fit between enemy status and the command panel at 390 × 844, for both Murmur and Keeper sizes. Desktop framing is unchanged.

## Verification

Production build and focused ESLint pass. Twenty-three spirit/arena/combat unit tests pass, covering exported dimensions, material/triangle budgets, finite geometry, pivot positions, successful replacement, motion, reduced motion, fallback and late resource disposal, together with the existing combat invariants.

Browser verification is recorded by `scripts/test-river-spirits.mjs` in `artifacts/blender-river-spirits/browser/progress.json`. It exercises desktop Keeper, phone Murmur, phone Keeper, reduced motion, an incomplete model and the Waywarden. Checks include English-first targeting without spending a turn, damage and visible target reaction, actual guardian attack gestures, defense, exact reloads, defeated-echo removal, and a full Keeper victory. Final completion status must be read from that report, not inferred from this checklist.

The final run completed all six cases with `finished: true`, zero console/page errors and no failure. Portrait framing checks measured the Murmur mask at Y=306–350 and the Keeper mask at Y=281–335, between enemy status ending at Y=263 and commands beginning at Y=446. The corresponding screenshots were visually inspected.

The studio and game captures are inspected for silhouette and camera readability. These checks do not establish physical-phone performance, overall art parity with Expedition 33, encounter variety, or sustained hour-long learning engagement. The broader adventure-quality goal remains active.
