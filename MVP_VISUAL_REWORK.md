# MVP — Level & Menu Visual Rework

**Status:** in progress
**Owner:** TBD
**Estimated effort:** ~2–3 weeks (4 phases)
**Goal:** Make all 10 stages and the menu read as a polished, atmospheric neon-Bangkok game
rather than a grey-box prototype — without sacrificing the mobile frame-rate budget.

---

## 1. Current state (what we're working with)

The stages are built procedurally from a small set of primitives in
`src/components/three/sceneHelpers.ts` (`addBox`, `addCylinder`, `addEmissiveBox`, lanterns,
neon signs, stalls, woks, rift portals). Each stage is a data-driven `AdventureSceneConfig`
(`src/data/adventures/types.ts`) with a `build(group, palette)` function and a per-stage
`SceneAmbiance` (background colour, fog, hemi/key/rim lights).

It's a solid foundation, but three things hold the look back — and two of them are essentially
free wins because the scaffolding is already half-built:

### 1.1 Shadows are dead code 🔴 *(highest ROI)*
Meshes set `castShadow = true` / `receiveShadow = true` all over `sceneHelpers.ts`, **but the
renderer never enables shadow mapping** (`renderer.shadowMap.enabled` is never set in
`configureStageRenderer`, `src/components/Stage3DAdventure.runtime.ts:55`) and **no light casts
shadows** (the `DirectionalLight` key light at `src/components/Stage3DAdventure.tsx:492` has
`castShadow` unset). So every prop and character floats with no grounding. Turning shadows on is a
handful of lines and instantly adds depth to all 10 stages.

### 1.2 No bloom / post-processing 🔴 *(highest ROI)*
The game is *full* of emissives — neon signs, paper lanterns (`emissiveIntensity` up to 1.2),
glowing woks (1.6), the rift portal — but they're rendered flat. There is no `EffectComposer` /
`UnrealBloomPass`. A single bloom pass makes a night-market neon aesthetic sing. This is the
biggest single aesthetic upgrade and it applies to every stage at once.

### 1.3 Flat boxes, flat background, no contact shadows 🟡
- Geometry is hard-edged `BoxGeometry`; everything is a literal box.
- `scene.background` is a single flat colour (`Stage3DAdventure.tsx:430`) — no sky gradient, so
  the back wall meets a dead void.
- Props sit *on* the floor with no soft contact shadow, so even with real shadows the small props
  read as decals.

### 1.4 Menu is already decent 🟢
The title screen (`src/components/TitleScreen.tsx`), `LessonRoadmap`, and `LevelSelect` already use
a coherent design system (`Card`/`Chip`/`Modal`, the `title-modern` CSS, a lazy 3D Su portrait).
The menu work here is **polish, not a rebuild**: consistent iconography (the unicode glyphs
`☷ ⚙ ⚔ 🎯` render inconsistently across platforms), a stronger Continue/Resume treatment, motion
polish, and a hook for the mastery surface from the SRS MVP.

---

## 2. The plan

### Phase 1 — Global renderer upgrades *(touches every stage at once)*

In `Stage3DAdventure.runtime.ts` / `Stage3DAdventure.tsx`:

1. **Shadows.** `renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap`.
   Make the directional key light cast shadows with a tuned ortho shadow camera framing the
   ~18×12 room, and bias to kill acne. Gate shadow-map resolution on
   `getBrowserCapabilities()` (1024 mobile / 2048 desktop) so phones don't choke.
2. **Bloom.** Add an `EffectComposer` with `RenderPass` + `UnrealBloomPass` (threshold ~0.85,
   strength ~0.6, radius ~0.4). Render through the composer in the animate loop; resize it
   alongside the renderer. Disable or soften bloom on low-end devices via capabilities.
3. **Sky dome / gradient backdrop.** Replace the flat `scene.background` colour with a large
   inward-facing gradient sphere (vertex-colour or shader-free two-tone) per stage palette, so the
   horizon behind the room has depth. Cheap, no texture load.
4. **Contact shadows.** A shared helper that drops a soft radial-gradient blob (a `CircleGeometry`
   with an additive/alpha-faded material, or a cheap baked texture) under props and characters —
   grounds everything even where the real shadow is subtle.

**Perf budget:** must hold 60fps desktop / ~30fps mid mobile. Bloom + one shadow-casting light is
affordable; everything stays gated behind `browserCapabilities`. Measure before/after.

### Phase 2 — Shared scene-helper additions

Add to `sceneHelpers.ts` (so all stages benefit and per-stage diffs stay small):

- `addRoundedBox(...)` — a bevelled box (small chamfer) for props that shouldn't read as hard
  cubes (counters, crates, signage frames).
- `addContactShadow(group, x, z, radius, opacity)` — the grounding blob from Phase 1.
- `addSkyDome(scene, topColor, bottomColor)` — the gradient backdrop.
- `addBuntingLights(...)` / richer lantern variants — more believable string lighting.
- `addFoliage(...)` — layered low-poly plant clusters (current `addPottedPlant` is two cylinders).
- Subtle per-instance roughness/colour jitter so repeated props don't look stamped.

### Phase 3 — Per-stage detail passes (all 10)

Each stage's `build` function gets a focused pass. Stage 1 already had a polish pass (per project
memory); Stages 2–10 are sparser. Each pass: raise prop density to Stage-1 level, adopt rounded
boxes + contact shadows, push one **signature** set-dressing moment, and tune the emissives so
bloom flatters them.

| Stage | File | Signature beat to push |
| --- | --- | --- |
| 1 Hotel Lobby | `stage01-hotel-lobby.ts` | Chandelier + signage bloom; keep existing density. |
| 2 Front Desk | `stage02-front-desk.ts` | Backlit key-rack wall, glowing room-number board. |
| 3 Night Market | `stage03-night-market.ts` | Dense neon + lantern strings + wok heat-glow — the bloom showpiece. |
| 4 Taxi Stand | `stage04-taxi-stand.ts` | Wet-asphalt reflections feel, tuk-tuk tail-lights, street-lamp pools. |
| 5 Floating Market | `stage05-floating-market.ts` | Water shimmer + lantern reflections on the river plane. |
| 6 Clinic | `stage06-clinic.ts` | Clean cool fluorescents vs. warm rift glow contrast. |
| 7 Café | `stage07-cafe.ts` | Warm pendant lights, steam wisps, menu-board glow. |
| 8 Alley | `stage08-alley.ts` | Moody single-source neon, puddle glow, claustrophobic fog. |
| 9 Embassy | `stage09-embassy.ts` | Grand cool marble, banner lighting, formal symmetry. |
| 10 Rift Gate | `stage10-rift-gate.ts` | The portal as a full bloom centerpiece + particle storm. |

### Phase 4 — Menu polish & integration

- Replace inconsistent unicode glyphs with a single icon source (inline SVGs already used for the
  logo — add a small set) so buttons render identically everywhere.
- Stronger **Continue** treatment: a hero resume-card showing the next stage thumbnail/label
  instead of a plain button alongside Start.
- Motion: subtle entrance stagger on the title CTA cluster, hover/press polish on
  `title-modern-button`.
- **Mastery hook:** reserve the title status line + roadmap phrase rows for the SRS MVP's mastery
  numbers (see `MVP_SRS_PEDAGOGY.md` Phase 4) so the two efforts meet cleanly.
- Verify `LevelSelect` / `LessonRoadmap` look correct against the new in-stage aesthetic.

---

## 3. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Bloom + shadows tank mobile FPS | Gate resolution/strength behind `browserCapabilities`; measure each stage; allow a "reduced effects" path. |
| Shadow acne / peter-panning | Tune `shadow.bias` / `normalBias` and ortho frustum to the fixed room size. |
| EffectComposer resize/dispose leaks | Resize composer with the renderer; dispose passes in `disposeMountedStageScene`. |
| Per-stage passes regress collision | New props go through the same `sceneHelpers` collider auto-detect; spot-check walk paths per stage. |
| Scope creep across 10 stages | Phases 1–2 are global and ship value alone; Phase 3 is incremental, one stage per commit. |

## 4. Definition of done

- Shadows and bloom are live and tuned across all stages, holding the FPS budget on desktop and
  mid-tier mobile.
- Sky dome + contact shadows ground every scene.
- All 10 `build` functions have had a detail pass with a clear signature beat.
- Menu icons render consistently; Continue has a hero treatment; motion polish in.
- `npm run typecheck` and `npm run lint` pass; each stage visually verified in the browser.
