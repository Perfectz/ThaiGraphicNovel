import type * as THREE from 'three';
import {
  addBox,
  addCone,
  addCylinder,
  addRoundedBox,
  addSphere,
  type RoomPalette,
} from '../../components/three/sceneHelpers';
import { lessonScenarios } from '../lessonScenarios';
import { customPhraseCommand } from './shared/phraseCommand';
import type { AdventureHotspot3D, AdventureRoom3D, AdventureSceneConfig, SceneAmbiance } from './types';

/**
 * Sukhumvit Overworld — a walkable night-street hub.
 *
 * After the hotel (Stages 1–2) the player is dropped onto a stylised stretch of
 * Sukhumvit Road: neon shophouses along the back, the BTS Skytrain running
 * overhead, and a row of glowing "gates" — one per stage. Walking Patrick up to
 * a gate and saying its Thai destination phrase travels to that stage (via the
 * engine's `onEnterStage` portal hook). Cleared stages glow green, the next
 * objective pulses bright, and not-yet-released districts read as locked.
 *
 * It reuses the full Stage3DAdventure engine (Patrick's rig, click-to-move,
 * camera, collision, mobile controls) — this file only supplies the street
 * geometry + the gate hotspots, so the hub feels identical to the stages.
 */

export const OVERWORLD_SCENARIO_ID = 'sukhumvit-overworld';

// Sukhumvit-at-night palette — wet asphalt, teal shopfronts, hot-pink neon.
const streetPalette: RoomPalette = {
  floor: 0x14171d,
  wall: 0x1d2b33,
  accent: 0xff5d8f,
  trim: 0x67e8f9,
  glow: 0xfacc15,
};

// One gate per stage. `rift` is the stage's signature colour (mirrors
// stageThemes) used for the gate glow + hotspot ring. Playable gates carry a
// `stageIndex`; locked ones are visible-but-dim flavour until launch.
type GateSpec = {
  stageIndex: number;
  x: number;
  rift: number;
  /** Thai "go to <place>" line the player says to travel there. */
  thai: string;
  rom: string;
  phon: string;
  en: string;
  /** Short marquee word shown as the neon sign over the gate. */
  sign: string;
};

const GATES: ReadonlyArray<GateSpec> = [
  {
    stageIndex: 0,
    x: -7.0,
    rift: 0xa78bfa,
    thai: 'ไปโรงแรมครับ',
    rom: 'pai rong raem khrap',
    phon: 'bpai rong-raem khrap',
    en: 'To the hotel.',
    sign: 'HOTEL',
  },
  {
    stageIndex: 1,
    x: -3.4,
    rift: 0x22d3ee,
    thai: 'ไปเช็คอินครับ',
    rom: 'pai check-in khrap',
    phon: 'bpai chek-in khrap',
    en: 'To the front desk.',
    sign: 'CHECK-IN',
  },
  {
    stageIndex: 2,
    x: 0.2,
    rift: 0xfb7185,
    thai: 'ไปตลาดกลางคืนครับ',
    rom: 'pai talat klang kheun khrap',
    phon: 'bpai dta-laat glaang keun khrap',
    en: 'To the night market.',
    sign: 'NIGHT MARKET',
  },
  {
    stageIndex: 3,
    x: 3.8,
    rift: 0x60a5fa,
    thai: 'ไปขึ้นแท็กซี่ครับ',
    rom: 'pai kheun taxi khrap',
    phon: 'bpai keun tâek-sîi khrap',
    en: 'To the taxi stand.',
    sign: 'TAXI',
  },
  {
    stageIndex: 4,
    x: 7.2,
    rift: 0x2dd4bf,
    thai: 'ไปตลาดน้ำครับ',
    rom: 'pai talat nam khrap',
    phon: 'bpai dta-laat náam khrap',
    en: 'To the floating market.',
    sign: 'FLOATING MKT',
  },
];

// How many stages are actually enterable from the overworld right now. Kept in
// step with the tech-demo window; gates past it render as "rift not open yet".
const PLAYABLE_GATES = 3;

const GATE_Z = -5.0; // gate plane, just in front of the shophouse facades
const STAND_Z = -3.5; // where Patrick stops to read/enter a gate

function addNeonStrip(
  group: THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  color: number,
  intensity = 0.9,
) {
  addBox(group, size, position, color, { emissive: color, emissiveIntensity: intensity, collider: false });
}

function buildSukhumvitStreet(group: THREE.Group, palette: RoomPalette) {
  // ---- Ground: wet asphalt road + sidewalks -----------------------------
  addBox(group, [18, 0.1, 12], [0, -0.05, 0], palette.floor, { collider: false, roughness: 0.5, metalness: 0.1 });
  // Carriageway down the middle (slightly darker, slick).
  addBox(group, [18, 0.02, 4.4], [0, 0.011, 0.6], 0x0f1116, {
    collider: false,
    roughness: 0.32,
    metalness: 0.18,
  });
  // Centre lane dashes.
  for (let x = -8; x <= 8; x += 2.4) {
    addNeonStrip(group, [1.1, 0.02, 0.16], [x, 0.02, 0.6], 0xf5d76e, 0.18);
  }
  // Back sidewalk (in front of the shops, where the gates sit).
  addBox(group, [18, 0.12, 3.4], [0, 0.04, -4.2], 0x222731, { collider: false, roughness: 0.7 });
  addNeonStrip(group, [18, 0.02, 0.08], [0, 0.06, -2.55], palette.trim, 0.35);
  // Front sidewalk (under the Skytrain).
  addBox(group, [18, 0.12, 2.6], [0, 0.04, 4.4], 0x222731, { collider: false, roughness: 0.7 });

  // ---- Shophouse facades along the back wall ----------------------------
  // A row of 4–5-storey blocks of varied height/colour with lit windows. The
  // tall back wall is the real movement barrier (z = -5.85 bound sits just
  // behind it).
  const facadeColors = [0x1b2a31, 0x24323a, 0x182026, 0x2a2230, 0x1e2b34];
  for (let i = 0; i < 6; i += 1) {
    const x = -7.5 + i * 3.0;
    const h = 3.4 + ((i * 7) % 5) * 0.45;
    const color = facadeColors[i % facadeColors.length];
    addBox(group, [2.7, h, 1.0], [x, h / 2, -5.7], color, { collider: true, roughness: 0.85 });
    // Lit windows — a small grid of warm/cool emissive panes.
    for (let row = 0; row < 3; row += 1) {
      for (let col = -1; col <= 1; col += 1) {
        const lit = (i + row + col) % 3 !== 0;
        addNeonStrip(
          group,
          [0.5, 0.5, 0.04],
          [x + col * 0.78, 0.9 + row * 0.95, -5.16],
          lit ? 0xffd9a0 : 0x0c1116,
          lit ? 0.5 : 0.02,
        );
      }
    }
  }

  // Vertical neon shop banners between the blocks — the Sukhumvit signature.
  const bannerColors = [0xff5d8f, 0x67e8f9, 0xfacc15, 0x9b8cff, 0x34d399];
  for (let i = 0; i < 5; i += 1) {
    const x = -6.0 + i * 3.0;
    addNeonStrip(group, [0.16, 1.7, 0.08], [x, 2.5, -5.12], bannerColors[i % bannerColors.length], 1.0);
  }

  // ---- BTS Skytrain running overhead along the front --------------------
  // Elevated guideway on piers; reads as "Sukhumvit Line" without blocking the
  // walkable road (piers sit at the front edge, z = +5.0).
  for (let x = -7.5; x <= 7.5; x += 3.75) {
    addCylinder(group, 0.34, 4.4, [x, 2.2, 5.0], 0x2b313b, { segments: 14, collider: true, roughness: 0.8 });
    addBox(group, [0.9, 0.3, 0.9], [x, 0.16, 5.0], 0x1a1f27, { collider: false });
  }
  // The guideway deck + a teal under-glow strip.
  addBox(group, [18, 0.55, 1.8], [0, 4.5, 5.0], 0x232a33, { collider: false, roughness: 0.7 });
  addNeonStrip(group, [18, 0.06, 0.1], [0, 4.18, 4.2], palette.trim, 0.7);
  // A stationary train car parked on the deck for life.
  addRoundedBox(group, [5.0, 0.95, 1.3], [-2.0, 5.25, 5.0], 0xdfe6ef, { radius: 0.28, roughness: 0.4 });
  addNeonStrip(group, [5.0, 0.16, 0.04], [-2.0, 5.25, 4.36], 0x2b6cb0, 0.6);

  // ---- A little street life: tuk-tuk + planters -------------------------
  // Parked tuk-tuk (stylised) on the front sidewalk.
  addRoundedBox(group, [1.0, 0.7, 1.5], [6.3, 0.55, 3.9], 0x0f5c52, { radius: 0.18, roughness: 0.5 });
  addRoundedBox(group, [0.9, 0.6, 0.9], [6.3, 1.15, 3.5], 0xf4d35e, { radius: 0.16, collider: false });
  addCylinder(group, 0.26, 0.18, [5.85, 0.26, 4.55], 0x111418, { segments: 16, collider: false });
  addCylinder(group, 0.26, 0.18, [6.75, 0.26, 4.55], 0x111418, { segments: 16, collider: false });
  // Planters bracketing the scene.
  [-8.3, 8.3].forEach((x) => {
    addCylinder(group, 0.42, 0.5, [x, 0.25, -3.6], 0x2a2f38, { segments: 14, collider: true });
    addSphere(group, 0.62, [x, 0.95, -3.6], 0x1f7a4d, { emissive: 0x14532d, emissiveIntensity: 0.18, collider: false });
  });

  // ---- Stage gates ------------------------------------------------------
  GATES.forEach((gate) => {
    const locked = gate.stageIndex >= PLAYABLE_GATES;
    const isNext = gate.stageIndex === PLAYABLE_GATES - 1; // night market = current objective
    const glow = locked ? 0x3a3f49 : gate.rift;
    const intensity = locked ? 0.12 : isNext ? 1.25 : 0.7;

    // Posts + lintel — a torii-ish gateway.
    const postH = 3.0;
    [-0.95, 0.95].forEach((dx) => {
      addBox(group, [0.26, postH, 0.26], [gate.x + dx, postH / 2, GATE_Z], 0x12161c, {
        collider: false,
        roughness: 0.6,
      });
    });
    addBox(group, [2.5, 0.3, 0.32], [gate.x, postH, GATE_Z], 0x12161c, { collider: false });
    // The portal itself — a glowing rift sheet between the posts.
    addBox(group, [1.7, 2.5, 0.08], [gate.x, 1.35, GATE_Z - 0.05], glow, {
      emissive: glow,
      emissiveIntensity: intensity,
      collider: false,
    });
    // Neon marquee bar above the lintel.
    addNeonStrip(group, [2.3, 0.18, 0.1], [gate.x, postH + 0.32, GATE_Z], glow, locked ? 0.1 : 1.0);
    // A floor pad in the gate's colour so the stand point reads as interactive.
    addBox(group, [2.0, 0.02, 1.4], [gate.x, 0.02, STAND_Z + 0.4], glow, {
      emissive: glow,
      emissiveIntensity: locked ? 0.06 : 0.3,
      collider: false,
    });
    // The current objective gets a bright floating beacon.
    if (isNext) {
      addCone(group, 0.28, 0.6, [gate.x, 3.9, GATE_Z], glow, 18, { collider: false });
      addSphere(group, 0.16, [gate.x, 3.5, GATE_Z], glow, { emissive: glow, emissiveIntensity: 1.4, collider: false });
    }
  });
}

// ---------------------------------------------------------------------------
// Hotspots — one per gate. Cleared/locked state shifts the label + ring; the
// playable command carries `entersStageIndex` so saying the destination travels
// there. (Cleared-stage lookup reads the live store so revisits update.)
// ---------------------------------------------------------------------------

function gateHotspot(gate: GateSpec): AdventureHotspot3D {
  const locked = gate.stageIndex >= PLAYABLE_GATES;
  const scenario = lessonScenarios[gate.stageIndex];
  const stageTitle = scenario?.title ?? gate.sign;
  const ringColor = locked ? 0x3a3f49 : gate.rift;

  const lookText = locked
    ? `${gate.sign}: the rift over this district hasn't opened yet — coming after launch.`
    : `${stageTitle}. Say the destination in Thai to head there.`;

  const enterCommand = locked
    ? customPhraseCommand(
        'use',
        `${gate.sign} (locked)`,
        gate.thai,
        gate.rom,
        gate.phon,
        gate.en,
        `You practice the phrase, but the ${gate.sign.toLowerCase()} gate stays dark. Coming after launch.`,
      )
    : customPhraseCommand(
        'use',
        `Enter: ${gate.sign}`,
        gate.thai,
        gate.rom,
        gate.phon,
        gate.en,
        `The ${gate.sign.toLowerCase()} gate flares open. Stepping through…`,
        { entersStageIndex: gate.stageIndex },
      );

  return {
    id: `gate-${gate.stageIndex}`,
    label: locked ? `${gate.sign} (locked)` : stageTitle,
    kind: 'prop',
    position: [gate.x, 0.4, GATE_Z],
    standPosition: [gate.x, 0, STAND_Z],
    ringColor,
    commands: {
      look: customPhraseCommand(
        'look',
        'I look at the gate',
        'ผมดูประตูครับ',
        'phom duu pratuu khrap',
        'pom doo bpra-dtuu khrap',
        'I look at the gate.',
        lookText,
      ),
      use: enterCommand,
    },
  };
}

const streetRoom: AdventureRoom3D = {
  id: 'sukhumvit-street',
  title: 'Sukhumvit Road',
  shortTitle: 'Sukhumvit',
  description:
    'Neon Sukhumvit at night. The Skytrain hums overhead and a row of rift-gates lines the shopfronts — each one a place you can practice your Thai. Walk up to a gate and say where you want to go.',
  palette: streetPalette,
  patrickStart: [0.2, 0, 2.6],
  build: buildSukhumvitStreet,
  hotspots: GATES.map(gateHotspot),
};

const ambiance: SceneAmbiance = {
  background: 0x0a0f1a,
  fogColor: 0x0a0f1a,
  fogNear: 18,
  fogFar: 34,
  hemiSky: 0x3b4a6b,
  hemiGround: 0x241b2e,
  hemiIntensity: 0.7,
  keyColor: 0x9fb4d8,
  keyIntensity: 0.9,
  keyPosition: [3, 6.5, 4],
  // Hot-pink neon rim — also drives the engine's UI accent for the hub.
  rimColor: 0xff5d8f,
  rimIntensity: 1.15,
  rimPosition: [-4, 3, 2],
};

export const sukhumvitOverworld: AdventureSceneConfig = {
  scenarioId: OVERWORLD_SCENARIO_ID,
  scenarioNumber: 0,
  title: 'Sukhumvit Road',
  subtitle: 'Bangkok Overworld',
  badge: 'Overworld · 3D',
  description:
    'Walk Sukhumvit and choose where to practice next. Cleared gates glow green; the bright gate is your next stop.',
  rooms: [streetRoom],
  inventoryItems: {},
  requiredInventory: [],
  ambiance,
  completionMessage: '',
  chapterTitle: 'Sukhumvit — The Overworld',
  loadingTagline: 'Lighting up Sukhumvit…',
  // Cool neon-night grade — blue push, rich saturation and a strong vignette so
  // the gate glows and shop signs read as the brightest things on the street.
  grade: {
    tint: [0.88, 0.95, 1.1],
    tintAmount: 0.24,
    contrast: 1.09,
    saturation: 1.16,
    vignette: 0.44,
    exposure: 1.0,
  },
};
