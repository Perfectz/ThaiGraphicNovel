import * as THREE from 'three';
import stage01DoorKeycardPayoffVfxUrl from '../../assets/stage-01/stage-01-door-keycard-payoff-vfx.png?url';
import stage01FloorInlayRiftDecalsUrl from '../../assets/stage-01/stage-01-floor-inlay-rift-decals.png?url';
import stage01HotelSignagePlatesUrl from '../../assets/stage-01/stage-01-hotel-signage-plates.png?url';
import stage01LobbyWallDressingDecalsUrl from '../../assets/stage-01/stage-01-lobby-wall-dressing-decals.png?url';
import stage01ReceptionDeskDetailsUrl from '../../assets/stage-01/stage-01-reception-desk-details.png?url';
import stage01TealRunnerRugTextureUrl from '../../assets/stage-01/stage-01-teal-runner-rug-texture.png?url';
import introOneMovieUrl from '../../assets/videos/intro1.mp4?url';
// 1K downsample of royal_esplanade_4k.exr — it only feeds reflections at
// intensity 0.18, and the 4K original was 22 MB of the asset budget plus a
// multi-second PMREM stall on slower GPUs. (The 4K file is kept on disk for
// any future hero use.)
import royalEsplanadeHdrUrl from '../../assets/hdri/royal_esplanade_1k.exr?url';
import {
  addBox,
  addCeilingLights,
  addContactShadow,
  addCylinder,
  addRoomShell,
  addRoundedBox,
  addWallPanel,
  type RoomPalette,
} from '../../components/three/sceneHelpers';
import { addHouseholdProp } from '../../components/three/householdProps';
import {
  makeMarbleFloorMaterial,
  makePaneledWallMaterial,
} from '../../components/three/proceduralTextures';
import { loadImageTexture, makeImageSurfaceMaterial } from '../../components/three/imageTextures';
import { lessonScenarios } from '../lessonScenarios';
import { stageOneConversationDeck } from '../stageOneSuVoiceLines';
import { customPhraseCommand, phraseCommand } from './shared/phraseCommand';
import type {
  AdventureConversationTurn,
  AdventureRoom3D,
  AdventureSceneConfig,
  SceneAmbiance,
} from './types';

/**
 * Stage 1: Hotel Lobby Basics, ported from the bespoke CharacterDebugPage
 * component onto the Stage3DAdventure data-driven engine.
 *
 * Mechanical translation: Stage 1's bespoke flow had Patrick walk across the
 * lobby to Su, then Su drove a sequential phrase-by-phrase lesson through
 * the CharacterDebugLessonOverlay UI. On the data-driven engine we model
 * the same loop as a single hotspot (Su, rendered as a full 3D rig) with a
 * `talk` command whose `conversation` is a 10-turn drill — one turn per
 * Stage 1 phrase. Each turn opens with Su prompting in English, then the
 * player pronounces the Thai. The final turn completes the adventure.
 *
 * Why this works: AdventureConversationTurn[] already supports exactly this
 * shape (npc setup line → player target phrase → success text), and the
 * judge UI in Stage3DAdventure already shows verdict tone and lets the
 * player retry. The only thing the bespoke page did that we don't is the
 * canvas-textured marble floor / dark teal wall art direction — replaced
 * here with a procedural lobby using the shared sceneHelpers primitives so
 * the stage matches Stages 2–3 visually. A high-fidelity restoration is a
 * follow-up.
 *
 * Routing: registered in registry.ts at scenario index 0. GameCanvas routes
 * the 'dialogue' scene marker (scenario 0) through the dispatcher, so this
 * is the live Stage 1. The legacy CharacterDebugPage was removed in Q1 of
 * the 2-year roadmap once parity was reached.
 */

const scenario = lessonScenarios[0]; // 'hotel-lobby-basics'
const phrases = scenario.chunks.flatMap((chunk) => chunk.phrases);
const phraseById = Object.fromEntries(phrases.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------
// Lobby palette — warm marble floor, deep teal walls, gold trim. Matches the
// tonal direction of the original canvas-textured lobby without replicating
// the bespoke art exactly.
// ---------------------------------------------------------------------------
export const lobbyPalette: RoomPalette = {
  floor: 0x8a9aa6,
  // Lifted from 0x1a3148 — at the old value the paneled-wall texture rendered
  // near-black under the dusk lighting rig and the teal art direction was lost.
  wall: 0x24425c,
  accent: 0xd6a94d,
  trim: 0xf5c96b,
  glow: 0x67e8f9,
};

function makeStageOneDecalMaterial(url: string, emissiveIntensity = 0) {
  const map = loadImageTexture(url, { srgb: true, wrap: THREE.ClampToEdgeWrapping });
  return new THREE.MeshStandardMaterial({
    map,
    emissive: emissiveIntensity > 0 ? 0xffffff : 0x000000,
    emissiveMap: emissiveIntensity > 0 ? map : null,
    emissiveIntensity,
    transparent: true,
    alphaTest: 0.04,
    roughness: 0.8,
    metalness: 0.02,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
}

function addStageOneWallDecal(
  group: THREE.Group,
  url: string,
  position: [number, number, number],
  size: [number, number],
  emissiveIntensity = 0,
) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size[0], size[1]),
    makeStageOneDecalMaterial(url, emissiveIntensity),
  );
  mesh.position.set(...position);
  mesh.renderOrder = 3;
  group.add(mesh);
  return mesh;
}

function addStageOneFloorDecal(
  group: THREE.Group,
  url: string,
  position: [number, number, number],
  size: [number, number],
  emissiveIntensity = 0,
) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size[0], size[1]),
    makeStageOneDecalMaterial(url, emissiveIntensity),
  );
  mesh.position.set(...position);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 4;
  group.add(mesh);
  return mesh;
}

// Exported so Stage 2 can reuse the polished lobby for its own lobby room —
// it's the same hotel, and one good set beats two divergent ones.
export function buildHotelLobbyRoom(group: THREE.Group, palette: RoomPalette) {
  // Polished veined-marble floor + crisp panelled teal walls with brass-inlay
  // seams — a sharper, more architectural read than the old soft plaster.
  addRoomShell(group, palette, {
    ceilingTrim: true,
    floorMaterial: makeImageSurfaceMaterial(
      'veined-marble-floor',
      5,
      4,
      () => makeMarbleFloorMaterial(3, 2),
      // Polished + lightly dimmed to a warm cream so the floor reads as elegant
      // lobby marble instead of a glaring, busy white slab.
      { roughness: 0.14, metalness: 0, color: 0xe6e0d4 },
    ),
    wallMaterial: makePaneledWallMaterial(palette.wall, palette.accent, 3, 1),
  });
  addCeilingLights(group, palette, [-4.5, 0, 4.5], -2.3);

  // ---- Ceiling — closes the black void over the room ---------------------
  // Single-sided plane facing DOWN so the orbit camera can never be blocked
  // by it: from above it backface-culls away, from inside it hides the sky
  // bleed that used to read as a missing roof. Warm-dark so the cove strips
  // and chandelier glow read against it.
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 12),
    // Faint self-illumination — the points below barely graze the ceiling, and
    // without it the plane fogs to pure black and reads as a void again.
    new THREE.MeshStandardMaterial({
      color: 0x2b3d50,
      roughness: 0.9,
      metalness: 0.02,
      emissive: 0x16222e,
      emissiveIntensity: 0.55,
    }),
  );
  ceiling.rotation.x = Math.PI / 2; // normal points down
  ceiling.position.set(0, 4.42, 0);
  ceiling.receiveShadow = true;
  group.add(ceiling);
  // Gold cove strips where ceiling meets the walls — warm indirect-light read.
  const cove = 0xffd9a0;
  addBox(group, [17.6, 0.05, 0.1], [0, 4.32, -5.8], cove, { emissive: cove, emissiveIntensity: 0.85, collider: false });
  addBox(group, [0.1, 0.05, 11.6], [-8.8, 4.32, 0], cove, { emissive: cove, emissiveIntensity: 0.85, collider: false });
  addBox(group, [0.1, 0.05, 11.6], [8.8, 4.32, 0], cove, { emissive: cove, emissiveIntensity: 0.85, collider: false });
  // Ceiling rosette over the chandelier.
  addCylinder(group, 0.85, 0.05, [0.6, 4.39, -0.6], 0xd6a94d, {
    segments: 32,
    metalness: 0.45,
    roughness: 0.35,
    collider: false,
  });

  // ---- Practical lights — cheap points that sell the emissive fixtures ----
  // The shared rig (hemi + key + rim) lights the set flat; these three locals
  // give the lobby its warm centre, a lit reception, and a soft lounge fill.
  const chandelierLight = new THREE.PointLight(0xffd98a, 1.6, 11, 1.6);
  chandelierLight.position.set(0.6, 3.0, -0.6);
  group.add(chandelierLight);
  const deskLight = new THREE.PointLight(0xffe2b0, 1.0, 7.5, 1.8);
  deskLight.position.set(-2.2, 2.7, -2.6);
  group.add(deskLight);
  const loungeLight = new THREE.PointLight(0xbfdde9, 0.95, 8, 1.7);
  loungeLight.position.set(-5.6, 2.5, 2.6);
  group.add(loungeLight);

  // ---- Reception desk along the back wall -------------------------------
  // Rounded walnut body + cream marble counter + brass trim. Footprint and
  // position match the old box pair exactly so colliders/camera are unchanged.
  addRoundedBox(group, [6.8, 1.1, 1.4], [-2.2, 0.55, -3.6], 0x5a392a, {
    radius: 0.05,
    roughness: 0.55,
  });
  // Recessed kick plate so the desk doesn't dead-end into the floor.
  addBox(group, [6.6, 0.12, 1.3], [-2.2, 0.06, -3.6], 0x241712, { collider: false });
  // Brass divider strips across the guest-facing front.
  [-4.4, -2.2, 0].forEach((x) => {
    addBox(group, [0.05, 0.86, 0.04], [x, 0.55, -2.88], 0xd6a94d, {
      metalness: 0.6,
      roughness: 0.3,
      collider: false,
    });
  });
  // Cream marble counter slab with a thin brass edge band under it.
  addRoundedBox(group, [7.1, 0.1, 1.56], [-2.2, 1.16, -3.6], 0xe8e2d6, {
    radius: 0.03,
    roughness: 0.22,
    metalness: 0.05,
  });
  addBox(group, [7.12, 0.05, 1.58], [-2.2, 1.09, -3.6], 0xd6a94d, {
    emissive: 0xb98843,
    emissiveIntensity: 0.2,
    collider: false,
  });
  // Computer terminal stub behind the counter
  addBox(group, [1.2, 0.78, 0.06], [-3.6, 1.62, -3.95], 0x111827);
  addBox(group, [1.05, 0.7, 0.02], [-3.6, 1.62, -3.92], 0x67e8f9, {
    emissive: 0x67e8f9,
    emissiveIntensity: 0.3,
  });
  // Bell on the desk (counter top is now at y≈1.21)
  addCylinder(group, 0.12, 0.18, [-0.4, 1.31, -3.6], 0xd6a94d, {
    segments: 22,
    metalness: 0.55,
    roughness: 0.32,
    collider: false,
  });

  // ---- Wall panels — teal slats with gold dividers ----------------------
  // Two-tone teals lifted well above the old 0x10/0x13 values, which rendered
  // as undifferentiated black under the dusk rig.
  addWallPanel(group, [-7.6, 3.0, -5.86], [3.2, 2.8], 0x1b3c54, 0xd6a94d);
  addWallPanel(group, [-3.6, 3.0, -5.86], [3.0, 2.8], 0x224a66, 0xd6a94d);
  addWallPanel(group, [0.4, 3.0, -5.86], [3.0, 2.8], 0x1b3c54, 0xd6a94d);
  addWallPanel(group, [4.6, 3.0, -5.86], [3.6, 2.8], 0x224a66, 0xd6a94d);

  // ---- Foreground lounge cluster (stage left) ---------------------------
  // Real GLB furniture (Household Props 001) replaces the box stand-ins: a low
  // coffee table flanked by two armchairs angled toward it. Positions match the
  // original boxes so movement bounds + camera framing are unchanged. Each prop
  // auto-normalizes to the target height, grounds itself, and tags a collider.
  addHouseholdProp(group, 'table', {
    position: [-5.6, 0, 2.6],
    targetHeight: 0.46,
    collider: 0.7,
    contactShadow: true,
  });
  addHouseholdProp(group, 'armchair', {
    position: [-4.0, 0, 2.6],
    targetHeight: 0.92,
    rotationY: -Math.PI / 2, // face stage-left toward the coffee table
    collider: 0.5,
    contactShadow: true,
  });
  addHouseholdProp(group, 'armchair', {
    position: [-7.2, 0, 2.6],
    targetHeight: 0.92,
    rotationY: Math.PI / 2, // face stage-right toward the coffee table
    collider: 0.5,
    contactShadow: true,
  });
  // Couch against the stage-left wall, between the two side plants — fills the
  // empty wall without crossing Patrick's spawn-to-Su path.
  addHouseholdProp(group, 'couch', {
    position: [-8.4, 0, 0.2],
    targetSize: 1.9,
    rotationY: Math.PI / 2, // back to the wall, seat facing into the room (+x)
    collider: 0.7,
    contactShadow: true,
  });

  // ---- Plants — bracket the back wall and ground the lounge ------------
  // GLB potted plants replace the two-cylinder placeholders at the same spots.
  ([
    [-8.2, -3.0],
    [8.2, -3.0],
    [-8.2, 3.4],
    [5.6, 1.4],
  ] as const).forEach(([px, pz]) => {
    addHouseholdProp(group, 'pottedPlant', {
      position: [px, 0, pz],
      targetHeight: 1.15,
      collider: 0.4,
      contactShadow: true,
    });
  });

  // ---- Lobby set-dressing props (Household Props 001) ------------------
  // A bookshelf tucked into the back-left corner and a coat rack by the
  // stage-right entrance columns add lived-in detail away from the play path.
  addHouseholdProp(group, 'bookshelf', {
    position: [-7.6, 0, -5.0],
    targetHeight: 1.9,
    collider: 0.6,
    contactShadow: true,
  });
  addHouseholdProp(group, 'coatRack', {
    position: [7.6, 0, 1.9],
    targetHeight: 1.8,
    collider: 0.4,
    contactShadow: true,
  });

  // ---- Marble lobby columns flanking the doors out --------------------
  // Shaft + brass base and capital so they read as architecture, not pipes.
  // Shafts now run to the new ceiling (4.42).
  ([-7.4, 7.4] as const).forEach((x) => {
    addCylinder(group, 0.35, 4.42, [x, 2.21, 0.4], 0xe3e8f0, {
      segments: 28,
      roughness: 0.3,
      metalness: 0.06,
    });
    addCylinder(group, 0.46, 0.22, [x, 0.11, 0.4], 0xd6a94d, {
      segments: 28,
      metalness: 0.55,
      roughness: 0.3,
      collider: false,
    });
    addCylinder(group, 0.44, 0.18, [x, 4.3, 0.4], 0xd6a94d, {
      segments: 28,
      metalness: 0.55,
      roughness: 0.3,
      collider: false,
    });
    addContactShadow(group, x, 0.4, 0.55, 0.5);
  });

  // ---- Stage 1 generated floor art -----------------------------------
  const runnerMap = loadImageTexture(stage01TealRunnerRugTextureUrl, {
    srgb: true,
    wrap: THREE.ClampToEdgeWrapping,
  });
  const runner = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 1.85),
    new THREE.MeshStandardMaterial({
      map: runnerMap,
      roughness: 0.88,
      metalness: 0.02,
      emissive: 0x082f36,
      emissiveIntensity: 0.04,
      side: THREE.DoubleSide,
    }),
  );
  // Reception runner laid in front of the desk, where the clerk stands — gives
  // the back-center a grounded "welcome mat" read. (Previously sat at the room
  // centre and overlapped the rift inlay below.)
  runner.position.set(-2.2, 0.022, -1.5);
  runner.rotation.x = -Math.PI / 2;
  runner.renderOrder = 2;
  group.add(runner);
  // Rift inlay is the hero floor motif — centred in the open front floor so the
  // camera frames it cleanly and no character or rug stands on top of it.
  addStageOneFloorDecal(group, stage01FloorInlayRiftDecalsUrl, [0.8, 0.034, 1.6], [4.0, 4.0], 0.18);
  // Keycard-payoff glow stays under Patrick's rift-landing spawn point.
  addStageOneFloorDecal(group, stage01DoorKeycardPayoffVfxUrl, [-5.5, 0.04, 1.2], [2.6, 2.6], 0.45);

  // ---- POLISH PASS (Tech-demo Q1) -------------------------------------
  // Everything below this comment is added strictly to bump Stage 1 from
  // "primitives box" to "hotel lobby". Geometry is hand-tuned to leave
  // the existing camera framing and movement bounds untouched, and uses
  // emissive accents instead of true area lights so the runtime cost
  // stays the same.

  // Hotel signage behind reception — the generated plate art IS the sign;
  // the old emissive glyph cubes and underline drew on top of it and read
  // as noise, so the decal now sits on a single dark backlit panel with a
  // soft halo strip behind it.
  addBox(group, [5.3, 2.2, 0.04], [-2.2, 2.76, -5.8], 0x0d1c2c, {
    emissive: 0x16314a,
    emissiveIntensity: 0.3,
    collider: false,
  });
  addBox(group, [5.46, 2.36, 0.02], [-2.2, 2.76, -5.82], 0xffd9a0, {
    emissive: 0xffd9a0,
    emissiveIntensity: 0.6,
    collider: false,
  });
  addStageOneWallDecal(group, stage01HotelSignagePlatesUrl, [-2.2, 2.76, -5.72], [5.1, 2.05], 0.25);

  // Chandelier — real GLB hung over the lobby centre, glowing warm gold so the
  // bloom pass flatters it. No collider (it's a ceiling prop). Sits under the
  // chandelier floor-inlay below so the two compose vertically.

  addHouseholdProp(group, 'chandelier', {
    position: [0.6, 3.05, -0.6],
    targetHeight: 1.35,
    glow: { color: 0xffd98a, intensity: 0.55 },
  });

  // Wall sconces — bracket-style emissive panels at chest height on the
  // back wall, one per panel gap. Frames the wall art rhythm without
  // duplicating the chandelier's center-stage role.
  [-5.6, -1.6, 2.4, 6.4].forEach((x) => {
    // Bracket
    addBox(group, [0.12, 0.42, 0.08], [x, 2.2, -5.78], 0xb98843, {
      metalness: 0.5,
      roughness: 0.32,
    });
    // Glow panel
    addBox(group, [0.34, 0.32, 0.03], [x, 2.2, -5.74], 0xfde68a, {
      emissive: 0xfacc15,
      emissiveIntensity: 0.75,
    });
  });

  // Wall art — small framed rectangles to break up the panel monotony.
  [-5.6, 2.4, 6.4].forEach((x) => {
    // Frame
    addBox(group, [1.0, 0.74, 0.03], [x, 3.4, -5.83], 0xb98843, {
      metalness: 0.5,
      roughness: 0.34,
    });
    // Print interior
    addBox(group, [0.88, 0.62, 0.02], [x, 3.4, -5.82], 0x172a3a, {
      emissive: 0x1f3b53,
      emissiveIntensity: 0.18,
    });
    // Subject hint — abstract block so the print reads as "tropical art"
    addBox(group, [0.36, 0.36, 0.015], [x - 0.16, 3.4, -5.81], 0x0f766e, {
      emissive: 0x0f766e,
      emissiveIntensity: 0.25,
    });
    addBox(group, [0.18, 0.5, 0.015], [x + 0.2, 3.42, -5.81], 0xfacc15, {
      emissive: 0xfacc15,
      emissiveIntensity: 0.35,
    });
  });

  // Reception desk — under-counter glow strip plus a small flower arrangement
  // stage-right to add warmth and a hint of life on the counter.
  addStageOneWallDecal(group, stage01LobbyWallDressingDecalsUrl, [4.75, 3.24, -5.71], [4.25, 2.35], 0.08);

  addBox(group, [6.8, 0.04, 0.05], [-2.2, 0.18, -2.95], 0x67e8f9, {
    emissive: 0x67e8f9,
    emissiveIntensity: 0.55,
  });
  // Flower arrangement on the counter — GLB prop replacing the primitive vase.
  // Desk dressing, so no collider/contact shadow.
  addHouseholdProp(group, 'flowers', {
    position: [1.4, 1.21, -3.6],
    targetHeight: 0.5,
  });
  // Reception computer on the guest side of the counter, screen facing out.
  addHouseholdProp(group, 'computer', {
    position: [-1.4, 1.21, -3.6],
    targetHeight: 0.42,
  });

  // Brochure stack on the desk — small layered slabs, slightly fanned so the
  // stack reads as paper rather than a colour-block totem.
  addBox(group, [0.42, 0.04, 0.3], [2.2, 1.29, -3.6], 0xf5c96b, { rotationY: 0.12, collider: false });
  addBox(group, [0.42, 0.04, 0.3], [2.2, 1.33, -3.6], 0x67e8f9, { rotationY: -0.1, collider: false });
  addBox(group, [0.42, 0.04, 0.3], [2.2, 1.37, -3.6], 0xff7eb6, { rotationY: 0.05, collider: false });

  // Floor inlay — a thin gold square in the lobby center under the
  // chandelier, the kind of detail a real hotel floor would have.
  addStageOneWallDecal(group, stage01ReceptionDeskDetailsUrl, [2.25, 1.72, -2.82], [2.15, 1.55], 0.04);

  addBox(group, [3.2, 0.008, 3.2], [0.6, 0.012, -0.6], 0xb98843, {
    emissive: 0x4a2600,
    emissiveIntensity: 0.18,
  });
  addBox(group, [2.8, 0.01, 2.8], [0.6, 0.014, -0.6], 0xd8dee9, {
    metalness: 0.18,
    roughness: 0.46,
  });
  addBox(group, [0.95, 0.012, 0.95], [0.6, 0.018, -0.6], 0xf5c96b, {
    emissive: 0xf5c96b,
    emissiveIntensity: 0.35,
  });
}

// ---------------------------------------------------------------------------
// Conversation — Su walks Patrick through all 10 phrases from the three
// Stage 1 chunks (First Contact, Polite Repair, First Needs). Each turn:
//   - Su sets up the prompt in English (`npcEnglish`) with a short Thai
//     equivalent so the player hears the natural Thai cadence.
//   - The player pronounces the target phrase via the existing voice judge.
//   - successText is what Su responds when the phrase lands.
//
// Pronunciation prompts come from `phraseById` so any phrase rewrite in
// lessonScenarios automatically flows through here.
// ---------------------------------------------------------------------------

/**
 * Build one drill turn from a phrase id. The turn id MUST match a key in
 * stageOneConversationDeck — that's how Stage3DAdventure looks up the
 * recorded `suLine` + `coachingLine` audio (`stage-01-<id>-su.wav` and
 * `stage-01-<id>-coach.wav`) and plays them in sequence the moment the
 * turn becomes active. The deck's `suLine` is the rich, vocab-inline
 * English Su says ("สวัสดี (hello - sawatdee), Patrick. Look at me…");
 * we route it into `npcEnglish` so the speech bubble shows the same
 * text the audio reads.
 *
 * `thaiTeaser` is the short Thai snippet that appears as the cue card's
 * top line — kept brief because the bigger english+thai mix is in the
 * `npcEnglish` deck line below it.
 */
function turn(
  phraseId: string,
  thaiTeaser: { thai: string; rom: string },
  successText: string,
): AdventureConversationTurn {
  const phrase = phraseById[phraseId];
  if (!phrase) {
    throw new Error(`stage01-hotel-lobby: missing phrase '${phraseId}' in lessonScenarios chunk`);
  }
  const deckEntry = stageOneConversationDeck[phraseId];
  if (!deckEntry) {
    // Without a deck entry the recorded VO won't play and the turn would
    // feel barebones. Fail loud so anyone renaming an id sees this fast.
    throw new Error(
      `stage01-hotel-lobby: phrase '${phraseId}' has no entry in stageOneConversationDeck — recorded Su lines will not play`,
    );
  }
  return {
    id: phraseId,
    npcSpeaker: 'Su',
    npcLineThai: thaiTeaser.thai,
    npcRomanization: thaiTeaser.rom,
    // Use the deck's `suLine` directly — it's the hand-written Su prompt
    // with inline Thai vocab in parentheses, matched 1:1 to the recorded
    // stage-01-<id>-su voice file.
    npcEnglish: deckEntry.suLine,
    response: {
      targetPhrase: phrase.targetPhrase,
      romanization: phrase.romanization,
      phoneticSpelling: phrase.phoneticSpelling ?? phrase.romanization,
      translation: phrase.translation,
    },
    successText,
  };
}

const lobbyDrillConversation: AdventureConversationTurn[] = [
  // ----- Chunk 1: First Contact -----
  turn(
    'hello',
    { thai: 'สวัสดีค่ะ แพทริก', rom: 'sawatdee kha, Patrick' },
    'The lobby steadies around you as your first Thai word lands.',
  ),
  turn(
    'my-name-is-patrick',
    { thai: 'คุณชื่ออะไรคะ', rom: 'khun chue arai kha' },
    'Su writes the name "Patrick" on a small lobby form.',
  ),
  turn(
    'nice-to-meet-you',
    { thai: 'ยินดีที่ได้รู้จักค่ะ', rom: 'yin dee tee dai roo jak kha' },
    'Su mirrors the phrase back warmly.',
  ),

  // ----- Chunk 2: Polite Repair -----
  turn(
    'thank-you',
    { thai: 'นี่คือบทเรียนแรกของคุณ', rom: 'nee khue bot rian raek kong khun' },
    'Su nods. Gratitude keeps the conversation kind.',
  ),
  turn(
    'sorry',
    { thai: 'ขอโทษนะ ฉันชนกระเป๋า', rom: 'kho thot na, chan chon gra-pao' },
    'Su accepts the apology with a small wai.',
  ),
  turn('yes', { thai: 'พร้อมไหมคะ', rom: 'phrom mai kha' }, 'Su smiles. "Good. We move soon."'),
  turn(
    'no',
    { thai: 'คุณชื่ออนันต์ใช่ไหมคะ', rom: 'khun chue Anand chai mai kha' },
    'Su laughs and crosses out the wrong name on the form.',
  ),

  // ----- Chunk 3: First Needs -----
  turn(
    'how-much',
    { thai: 'ที่ร้านมีน้ำดื่ม', rom: 'tee raan mee naam duem' },
    'Su mimes handing over coins.',
  ),
  turn(
    'bathroom-where',
    { thai: 'ล็อบบี้ใหญ่มาก', rom: 'lobby yai maak' },
    'Su points discreetly down a side corridor.',
  ),
  turn(
    'i-am-thirsty',
    { thai: 'อากาศร้อนมาก', rom: 'a kaat ron maak' },
    'Su hands you a cool bottle. The lobby air feels lighter. Stage 1 cleared.',
  ),
];

// ---------------------------------------------------------------------------
// "Apply it" exchange — the payoff that turns the drill into a level. After Su
// teaches the ten phrases, the player must actually USE three of them with the
// front desk hostess (someone who isn't the teacher). Gated behind the Su drill
// via requiresConversation, and it's THIS conversation that completes the stage.
// The turn ids are deliberately distinct from the lesson ids (apply-*) so they
// don't collide with Su's recorded VO deck and don't pollute the lesson recap.
// ---------------------------------------------------------------------------
function applyTurn(
  idSuffix: string,
  phraseId: string,
  thaiTeaser: { thai: string; rom: string },
  npcEnglish: string,
  successText: string,
): AdventureConversationTurn {
  const phrase = phraseById[phraseId];
  if (!phrase) {
    throw new Error(`stage01-hotel-lobby: apply-it turn references missing phrase '${phraseId}'`);
  }
  return {
    id: `apply-${idSuffix}`,
    npcSpeaker: 'Hostess',
    npcLineThai: thaiTeaser.thai,
    npcRomanization: thaiTeaser.rom,
    npcEnglish,
    response: {
      targetPhrase: phrase.targetPhrase,
      romanization: phrase.romanization,
      phoneticSpelling: phrase.phoneticSpelling ?? phrase.romanization,
      translation: phrase.translation,
    },
    successText,
  };
}

const hostessApplyConversation: AdventureConversationTurn[] = [
  applyTurn(
    'hello',
    'hello',
    { thai: 'สวัสดีค่ะ', rom: 'sawatdee kha' },
    'Sawatdee kha! Welcome to the Chao Phraya Star. Greet me the way Su just taught you.',
    'The hostess beams. "A real Bangkok hello — lovely."',
  ),
  applyTurn(
    'how-much',
    'how-much',
    { thai: 'น้ำขวด', rom: 'nam khuat' },
    'You look parched. There is bottled water on the counter — ask me how much it costs.',
    'She taps the little price card. "Sip baht — twenty baht."',
  ),
  applyTurn(
    'thank-you',
    'thank-you',
    { thai: 'ขอบคุณค่ะ', rom: 'khop khun kha' },
    'Here is your water. One last thing — thank me politely before you go.',
    'The hostess slides a keycard across the marble. "Room is ready. You will do just fine out there."',
  ),
];

const hostessHotspot = {
  id: 'hotelLobbyGirl',
  label: 'Front Desk Hostess',
  kind: 'person' as const,
  // In front of the reception counter (desk centred at x=-2.2, front face near
  // z=-2.9), angled so Patrick can walk up from the open lobby floor.
  position: [-2.2, 0, -2.4] as [number, number, number],
  standPosition: [-2.2, 0, -0.9] as [number, number, number],
  // Cyan ring to distinguish her from Su's pink marker.
  ringColor: 0x67e8f9,
  autoTalk: true,
  model: {
    id: 'hotelLobbyGirl' as const,
    animation: 'wave' as const,
    height: 1.66,
  },
  commands: {
    look: customPhraseCommand(
      'look',
      'I look at the hostess',
      'ผมดูพนักงานต้อนรับครับ',
      'phom duu phanak ngaan ton rap khrap',
      'pom doo pa-nak-ngaan ton-rap khrap',
      'I look at the front desk hostess.',
      'A poised hostess in Azure Vanguard livery waits behind the marble counter, ready to help — in Thai.',
    ),
    talk: customPhraseCommand(
      'talk',
      'Use your new phrases on the hostess',
      phraseById['hello'].targetPhrase,
      phraseById['hello'].romanization,
      phraseById['hello'].phoneticSpelling ?? phraseById['hello'].romanization,
      phraseById['hello'].translation,
      'The hostess straightens with a smile. "Show me what Su taught you."',
      {
        conversationId: 'stage1-hostess-apply',
        // Apply-it duel vs the hostess — winning completes the stage.
        battleEncounterId: 'hostess-check-in',
        conversation: hostessApplyConversation,
        conversationCompleteText:
          'Room reserved. "Until morning, khun Patrick — bring your documents." Stage 1 clear; tomorrow you finish check-in at the front desk.',
        completesAdventure: true,
        // Locked until the player has actually learned the phrases from Su.
        requiresConversation: 'stage1-lobby-drill',
        conversationBlockedText:
          'Win Su’s sparring trial first — then come back and duel the hostess for your keycard.',
      },
    ),
  },
};

const lobbyRoom: AdventureRoom3D = {
  id: 'lobby',
  title: 'Chao Phraya Star Hotel',
  shortTitle: 'Lobby',
  description:
    'You wake on the lobby marble after tumbling through the rift. Across the room Su is already waving — walk over and she will open your first phrase duel.',
  palette: lobbyPalette,
  // Patrick spawns stage-left, in front of the lounge cluster, so the camera
  // can frame him and Su (stage-right) in the same shot. The stand-up intro
  // (see introAnimation below) starts him prone on this spot.
  patrickStart: [-5.5, 0, 1.2],
  // Wake-up cinematic: the 'dead' clip plays in reverse on Patrick when the
  // scene loads, so he rises off the floor before normal play begins.
  introAnimation: 'stand-up',
  build: buildHotelLobbyRoom,
  hotspots: [
    // ---- Onboarding micro-interactions -------------------------------------
    // Two optional, zero-stakes hotspots that teach the verb + hotspot + mic
    // loop before Stage 2 demands it for the item hunt. Neither gates stage
    // completion; they reuse drill phrases as free practice.
    {
      id: 'deskBell',
      label: 'Desk Bell',
      kind: 'prop',
      position: [-0.4, 1.35, -3.6],
      standPosition: [-0.4, 0, -2.2],
      ringColor: 0xf5c96b,
      commands: {
        look: customPhraseCommand(
          'look',
          'I look at the bell',
          'ผมดูกระดิ่งครับ',
          'phom duu gra-ding khrap',
          'pom doo gra-ding khrap',
          'I look at the desk bell.',
          'A polished brass bell. Tap USE to ring it and greet the lobby in Thai.',
        ),
        use: phraseCommand(
          'use',
          'Ring the bell and greet',
          phraseById['hello'],
          'Ding! The hostess looks up from the counter and returns your sawatdee with a smile.',
        ),
      },
    },
    {
      id: 'brochures',
      label: 'Brochure Stack',
      kind: 'prop',
      position: [2.2, 1.45, -3.6],
      standPosition: [2.2, 0, -2.2],
      ringColor: 0x67e8f9,
      commands: {
        look: phraseCommand(
          'look',
          'Ask the price of a tour',
          phraseById['how-much'],
          'The top brochure lists river-boat tours. Practicing "how much" never hurts in Bangkok.',
        ),
      },
    },
    // ---- Side quest: the lost phrasebook ----------------------------------
    // Optional. A flustered tourist by the columns lost his phrasebook; it's
    // on the floor near the bookshelf. Return it and he asks for a friendly
    // one-round duel — teach him "sawatdee" and earn the Lucky Charm.
    {
      id: 'lostPhrasebook',
      label: 'Dropped Phrasebook',
      kind: 'item',
      position: [-6.6, 0.35, -4.2],
      standPosition: [-5.6, 0, -3.4],
      ringColor: 0xfbbf24,
      commands: {
        look: customPhraseCommand(
          'look',
          'I look at the book',
          'ผมดูหนังสือครับ',
          'phom duu nang-sue khrap',
          'pom doo nang-sue khrap',
          'I look at the book.',
          'A well-thumbed Thai phrasebook, dropped near the bookshelf. Someone is surely missing this.',
        ),
        take: customPhraseCommand(
          'take',
          'I pick up the book',
          'ผมหยิบหนังสือครับ',
          'phom yip nang-sue khrap',
          'pom yip nang-sue khrap',
          'I pick up the book.',
          'Phrasebook collected. The flustered traveler by the columns keeps patting his empty pockets…',
          { givesItem: 'lostPhrasebook' },
        ),
      },
    },
    {
      id: 'lostTourist',
      label: 'Lost Tourist',
      kind: 'person',
      position: [6.6, 0, 3.2],
      standPosition: [5.4, 0, 2.6],
      ringColor: 0x34d399,
      autoTalk: true,
      model: {
        id: 'bellboy',
        animation: 'talk',
        height: 1.76,
        rotationY: -Math.PI * 0.75, // Face in toward the lobby centre.
      },
      commands: {
        look: customPhraseCommand(
          'look',
          'I look at the traveler',
          'ผมดูนักท่องเที่ยวครับ',
          'phom duu nak thong thiao khrap',
          'pom doo nak-tong-tiao khrap',
          'I look at the traveler.',
          'He pats every pocket twice and mimes a small book with both hands. Lost something, clearly.',
        ),
        talk: customPhraseCommand(
          'talk',
          'Return the phrasebook',
          'สวัสดีครับ',
          'sawatdee khrap',
          'sah-waht-dee khrap',
          'Hello.',
          'You hand the phrasebook back — and he immediately wants a Thai lesson.',
          {
            conversationId: 'stage1-tourist-quest',
            battleEncounterId: 'tourist-friendly-duel',
            requiresItems: ['lostPhrasebook'],
            blockedText:
              'He mimes a little book with both hands. His phrasebook must be around the lobby somewhere — check near the bookshelf.',
            conversationCompleteText:
              'The tourist wais clumsily but sincerely, charm delivered. One more traveler Bangkok won’t eat alive.',
          },
        ),
      },
    },
    {
      id: 'su',
      label: 'Su',
      kind: 'person',
      // Stage-right, between the marble pillar (x=7.4) and the reception desk,
      // with z slightly forward of center so the camera has a clean sightline
      // on her full model. Mirrors Patrick's spawn across the room.
      position: [6.0, 0, -0.5],
      // Approach point: 1.6 units to Su's stage-left (the direction she faces
      // given rotationY=-π/2), so Patrick lands face-to-face with her at a
      // comfortable conversation distance.
      standPosition: [4.4, 0, -0.5],
      ringColor: 0xf0abfc,
      // Clicking Su walks Patrick over AND opens the conversation directly,
      // skipping the talk command's targetPhrase practice — otherwise the
      // player would say 'sawatdee khrap' once to start the talk command
      // and immediately again as the first conversation turn.
      autoTalk: true,
      model: {
        id: 'su',
        animation: 'wave',
        height: 1.72,
        rotationY: -Math.PI / 2, // Face stage-left toward Patrick's spawn.
      },
      commands: {
        look: customPhraseCommand(
          'look',
          'I look at',
          'ผมดูซูครับ',
          'phom duu Su khrap',
          'pom doo Su khrap',
          'I look at Su.',
          'Su, the Neon Circuit Princess, glows softly in the lobby light. She waves you over.',
        ),
        talk: phraseCommand(
          'talk',
          'Challenge Su to the sparring trial',
          phraseById['hello'],
          'Su drops into coach mode. "Ten phrases. We go in order — sawatdee first."',
          {
            conversationId: 'stage1-lobby-drill',
            // SNES-style social duel replaces the scrolling drill. The
            // conversation turns below are kept as the recap source and as
            // a fallback if the encounter id ever fails to resolve.
            battleEncounterId: 'su-lobby-sparring',
            conversation: lobbyDrillConversation,
            conversationCompleteText:
              'All ten phrases land. Su gives Patrick a small bow. "Now prove it — the front desk hostess is waiting across the lobby. Go greet her in Thai."',
            // The lesson lives here, but clearing the stage now requires USING
            // the phrases with the hostess (see below). Flag this as the recap
            // drill so the Stage Clear card still lists all ten learned phrases.
            recapDrill: true,
          },
        ),
      },
    },
    hostessHotspot,
  ],
};

// ---------------------------------------------------------------------------
// Ambient lighting — warm hotel-lobby gold key, cool teal rim. Tighter fog
// than Stages 2–3 so the room reads as enclosed rather than market-open.
// ---------------------------------------------------------------------------
const ambiance: SceneAmbiance = {
  // Slightly warmer overall — the lobby now has chandelier + sconces +
  // signage all emitting gold, so the base lighting reads cooler so the
  // emissives pop instead of getting washed.
  background: 0x0c1827,
  fogColor: 0x0c1827,
  fogNear: 16,
  fogFar: 30,
  // Dusk-blue sky tint. Brighter than the old 0x46586e/0.6 combo — with the
  // ceiling closed in, the hemisphere fill is the room's ambient bounce and at
  // the old level the walls rendered near-black. Ground tone warmed to echo
  // the marble + brass bounce.
  hemiSky: 0x5d7390,
  hemiGround: 0x3a2b34,
  hemiIntensity: 0.85,
  // Key light pulled to a warmer gold to match the chandelier — was almost
  // pure white before which fought the brass palette.
  keyColor: 0xfde6c0,
  keyIntensity: 1.2,
  keyPosition: [2.4, 6.4, 3.2],
  // Rim is now a complementary teal that mirrors the wall panels — gives
  // the lobby a cool/warm split-tone look without going neon.
  rimColor: 0x6ec6e7,
  rimIntensity: 1.1,
  rimPosition: [-4, 2.5, -3],
  // Painterly dusk skyline behind the lobby windows — replaces the procedural
  // gradient dome. Soft gradient up top; the hazy city band sits low, mostly
  // hidden behind the walls so only warm sky reads above them.
  skyTexture: 'warm-dusk-sky',
};

export const stageOneAdventure: AdventureSceneConfig = {
  scenarioId: scenario.id,
  scenarioNumber: scenario.scenarioNumber,
  title: scenario.title,
  subtitle: 'Polite Basics with Su',
  badge: `Stage ${scenario.scenarioNumber}/10 · 3D`,
  description: scenario.storyGoal,
  rooms: [lobbyRoom],
  inventoryItems: {
    // Side-quest item — intentionally NOT in requiredInventory, so the
    // inventory checklist UI stays clean and the quest stays optional.
    lostPhrasebook: {
      id: 'lostPhrasebook',
      label: 'Dropped Phrasebook',
      thaiNoun: 'หนังสือวลี',
      romanization: 'nang-sue wa-lee',
      sprite: '',
    },
  },
  requiredInventory: [],
  ambiance,
  completionMessage: 'Stage 1 clear. Patrick can greet, thank, and recover politely. Next: check in for real.',
  chapterTitle: 'Day One — Arrival',
  loadingTagline: 'Tuning the Bangkok rift…',
  // "Royal Esplanade" hall HDRI drives image-based lighting so the marble
  // floor, brass trim, and GLB furniture pick up real reflections. Background
  // stays the authored flat colour + sky dome — only reflections/ambient use it.
  environmentMapUrl: royalEsplanadeHdrUrl,
  // Bumped from 0.08 — the marble floor and brass trim need visible
  // reflections to read as polished surfaces under the dusk rig.
  environmentIntensity: 0.18,
  // Gentle bloom for the lobby — higher threshold + lower strength than the
  // global default so the marble/windows stop blooming into white halos. The
  // night-market stage keeps the punchy global default.
  bloomStrength: 0.28,
  bloomThreshold: 0.95,
  // Warm hotel-lobby mood — gold push, gentle contrast, soft vignette.
  grade: {
    tint: [1.0, 0.93, 0.82],
    tintAmount: 0.22,
    contrast: 1.07,
    saturation: 1.08,
    vignette: 0.34,
    exposure: 1.02,
  },
  // Pre-roll rift-arrival cinematic. Originally bundled with the deleted
  // CharacterDebugPage; restored here so Stage 1 still opens with the
  // movie before handing off to the in-room VN dialogue and stand-up
  // animation. Vite's `?url` import emits the file with a content hash so
  // it caches indefinitely.
  introVideoUrl: introOneMovieUrl,
};
