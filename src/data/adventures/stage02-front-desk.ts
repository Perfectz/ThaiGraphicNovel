import * as THREE from 'three';
import introTwoMovieUrl from '../../assets/videos/intro2.mp4?url';
import keycardUrl from '../../assets/adventure/level-02/keycard.png';
import passportUrl from '../../assets/adventure/level-02/passport.png';
import reservationPaperUrl from '../../assets/adventure/level-02/reservation-paper.png';
import walletUrl from '../../assets/adventure/level-02/wallet.png';
import {
  addBox,
  addCeilingLights,
  addContactShadow,
  addCylinder,
  addRoomShell,
  addRoundedBox,
  type RoomPalette,
} from '../../components/three/sceneHelpers';
import {
  makeMarbleFloorMaterial,
  makePaneledWallMaterial,
} from '../../components/three/proceduralTextures';
import { makeImageSurfaceMaterial } from '../../components/three/imageTextures';
import { buildHotelLobbyRoom, lobbyPalette } from './stage01-hotel-lobby';
import { lessonScenarios } from '../lessonScenarios';
import { customPhraseCommand, phraseCommand } from './shared/phraseCommand';
import type {
  AdventureConversationTurn,
  AdventureRoom3D,
  AdventureSceneConfig,
  SceneAmbiance,
} from './types';

/**
 * Stage 2: Front Desk Check-In, ported from the bespoke LevelTwoDebugPage
 * component onto the Stage3DAdventure data-driven engine.
 *
 * Visual approach: the lobby room reuses Stage 1's exported lobby build
 * (same hotel, same set), and the front-desk room uses the same ceiling /
 * cove / paneled-wall treatment in a warmer amber. The original 2D PNG
 * backdrops were retired — photoreal murals behind low-poly geometry read
 * as two different games stitched together.
 *
 * NPC approach: the bellhop and front-desk hostess now render as full 3D
 * rigs (bellboy + hotelLobbyGirl) instead of 2D portraits. Their idle/talk
 * animations switch via the same NpcAnimationController interface Stage 3
 * uses.
 *
 * Routing: GameCanvas now routes both 'pointClickAdventure' (index 1) and
 * 'stage3dAdventure' through Stage3DAdventureDispatcher, so this is the
 * live Stage 2. The legacy LevelTwoDebugPage was removed in Q1 of the
 * 2-year roadmap once parity was reached.
 */

const scenario = lessonScenarios[1]; // 'front-desk-check-in'
const phrases = scenario.chunks.flatMap((chunk) => chunk.phrases);
const phraseById = Object.fromEntries(phrases.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------
// Room palettes — the lobby reuses Stage 1's exported palette (same hotel,
// same set); the front desk is a warmer amber take on the same language.
// The old 2D PNG murals are retired: they were photoreal paintings pasted
// behind low-poly geometry and read as a different game.
// ---------------------------------------------------------------------------
const frontDeskPalette: RoomPalette = {
  floor: 0x8a9aa6,
  // Lifted well above the old 0x2c241c, which rendered near-black.
  wall: 0x4a3526,
  accent: 0xf59e0b,
  trim: 0xfde68a,
  glow: 0xfb923c,
};

// ---------------------------------------------------------------------------
// Procedural room builders. The lobby comes from stage01; only the front
// desk room is built here.
// ---------------------------------------------------------------------------

/**
 * Reusable chandelier composition — brass ring with hanging warm bulbs.
 * Same geometric language as Stage 1's lobby so the two stages feel like
 * the same hotel. Positioned at `(x, _, z)` with the ring at y=4.4.
 */
function addChandelier(group: THREE.Group, x: number, z: number, bulbCount = 8) {
  addCylinder(group, 1.0, 0.08, [x, 4.4, z], 0xb98843, {
    segments: 32,
    metalness: 0.55,
    roughness: 0.32,
    emissive: 0x4a2600,
    emissiveIntensity: 0.18,
  });
  addCylinder(group, 0.62, 0.06, [x, 4.35, z], 0xf5c96b, {
    segments: 26,
    metalness: 0.6,
    roughness: 0.28,
    emissive: 0xb98843,
    emissiveIntensity: 0.22,
  });
  for (let i = 0; i < bulbCount; i += 1) {
    const theta = (i / bulbCount) * Math.PI * 2;
    const radius = 0.84;
    const bx = x + Math.cos(theta) * radius;
    const bz = z + Math.sin(theta) * radius;
    addCylinder(group, 0.012, 0.32, [bx, 4.16, bz], 0x111827, { segments: 6 });
    addCylinder(group, 0.08, 0.14, [bx, 3.94, bz], 0xfde68a, {
      segments: 14,
      emissive: 0xfacc15,
      emissiveIntensity: 0.9,
    });
  }
}

function buildFrontDeskRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, {
    ceilingTrim: true,
    floorMaterial: makeImageSurfaceMaterial(
      'veined-marble-floor',
      5,
      4,
      () => makeMarbleFloorMaterial(3, 2),
      { roughness: 0.14, metalness: 0, color: 0xe6e0d4 },
    ),
    // Same paneled-wall language as Stage 1's lobby, tinted to the warmer
    // front-desk amber so the two rooms read as one hotel.
    wallMaterial: makePaneledWallMaterial(palette.wall, 0xd6a94d, 3, 1),
  });
  addCeilingLights(group, palette, [-4.5, 0, 4.5], -2.6);
  addChandelier(group, 0, 0.4, 10);

  // ---- Ceiling + cove — same closed-roof treatment as Stage 1 ----------
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 12),
    new THREE.MeshStandardMaterial({
      color: 0x39301f,
      roughness: 0.9,
      metalness: 0.02,
      emissive: 0x241c12,
      emissiveIntensity: 0.55,
    }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 4.42, 0);
  ceiling.receiveShadow = true;
  group.add(ceiling);
  const cove = 0xffd9a0;
  addBox(group, [17.6, 0.05, 0.1], [0, 4.32, -5.8], cove, { emissive: cove, emissiveIntensity: 0.85, collider: false });
  addBox(group, [0.1, 0.05, 11.6], [-8.8, 4.32, 0], cove, { emissive: cove, emissiveIntensity: 0.85, collider: false });
  addBox(group, [0.1, 0.05, 11.6], [8.8, 4.32, 0], cove, { emissive: cove, emissiveIntensity: 0.85, collider: false });

  // ---- Practical lights ------------------------------------------------
  const chandelierLight = new THREE.PointLight(0xffd98a, 1.5, 11, 1.6);
  chandelierLight.position.set(0, 3.6, 0.4);
  group.add(chandelierLight);
  const deskLight = new THREE.PointLight(0xffe2b0, 1.1, 8, 1.8);
  deskLight.position.set(0, 2.6, -1.8);
  group.add(deskLight);

  // Reception counter — rounded walnut body + cream marble slab, matching
  // the Stage 1 desk build so the hotel furniture is consistent.
  addRoundedBox(group, [10, 1.1, 1.4], [0, 0.55, -2.6], 0x5a392a, {
    radius: 0.05,
    roughness: 0.55,
  });
  addBox(group, [9.8, 0.12, 1.3], [0, 0.06, -2.6], 0x241712, { collider: false });
  addRoundedBox(group, [10.3, 0.1, 1.56], [0, 1.16, -2.6], 0xe8e2d6, {
    radius: 0.03,
    roughness: 0.22,
    metalness: 0.05,
  });
  addBox(group, [10.32, 0.05, 1.58], [0, 1.09, -2.6], 0xd6a94d, {
    emissive: 0xb98843,
    emissiveIntensity: 0.2,
    collider: false,
  });
  addContactShadow(group, 0, -1.7, 1.2, 0.4);
  // Under-counter glow strip
  addBox(group, [10.0, 0.04, 0.05], [0, 0.16, -1.95], 0x67e8f9, {
    emissive: 0x67e8f9,
    emissiveIntensity: 0.55,
  });
  // Counter front panel detailing — gold inlay
  addBox(group, [9.6, 0.05, 0.03], [0, 0.95, -1.92], 0xb98843, {
    emissive: 0xb98843,
    emissiveIntensity: 0.35,
  });
  addBox(group, [9.6, 0.05, 0.03], [0, 0.3, -1.92], 0xb98843, {
    emissive: 0xb98843,
    emissiveIntensity: 0.35,
  });

  // Computer terminal stub behind the counter — a dim screen rectangle.
  addBox(group, [1.4, 0.85, 0.08], [-3.4, 1.7, -3.0], 0x111827);
  addBox(group, [1.3, 0.78, 0.02], [-3.4, 1.7, -2.96], 0x67e8f9, {
    emissive: 0x67e8f9,
    emissiveIntensity: 0.35,
  });

  // "CHECK-IN" overhead signage so the room reads immediately.
  addBox(group, [3.6, 0.46, 0.05], [0, 3.6, -5.83], 0x0a1423);
  addBox(group, [3.6, 0.05, 0.05], [0, 3.83, -5.82], 0xb98843, {
    emissive: 0xb98843,
    emissiveIntensity: 0.4,
  });
  addBox(group, [3.6, 0.05, 0.05], [0, 3.37, -5.82], 0xb98843, {
    emissive: 0xb98843,
    emissiveIntensity: 0.4,
  });
  for (let i = 0; i < 8; i += 1) {
    const x = -1.2 + i * 0.34;
    addBox(group, [0.18, 0.24, 0.03], [x, 3.6, -5.81], 0xf5c96b, {
      emissive: 0xf5c96b,
      emissiveIntensity: 0.75,
    });
  }

  // Wall sconces on either side of the sign
  [-3.6, 3.6].forEach((x) => {
    addBox(group, [0.12, 0.42, 0.08], [x, 2.4, -5.78], 0xb98843);
    addBox(group, [0.34, 0.32, 0.03], [x, 2.4, -5.74], 0xfde68a, {
      emissive: 0xfacc15,
      emissiveIntensity: 0.75,
    });
  });

  // Keycard tray + pen holder (counter top now sits at y≈1.21)
  addBox(group, [0.6, 0.04, 0.4], [2.6, 1.23, -2.6], 0x1f2937, { collider: false });
  addCylinder(group, 0.06, 0.18, [-2.6, 1.3, -2.6], 0x4a3520, { segments: 14, collider: false });
  // Pens in the holder
  addCylinder(group, 0.015, 0.18, [-2.6, 1.43, -2.6], 0x67e8f9, { segments: 6, collider: false });
  addCylinder(group, 0.015, 0.18, [-2.55, 1.43, -2.6], 0xff7eb6, { segments: 6, collider: false });
  // Bell
  addCylinder(group, 0.1, 0.16, [-2.0, 1.31, -2.6], 0xd6a94d, {
    segments: 18,
    metalness: 0.55,
    roughness: 0.32,
    collider: false,
  });
  // Counter checklist: four brass ticks for Wallet / Passport / Reservation / Keycard.
  // It gives the check-in chain a visible quest-object feel without adding HUD bulk.
  addBox(group, [1.55, 0.035, 0.72], [0.8, 1.245, -2.02], 0x111827, { collider: false });
  [-0.45, -0.15, 0.15, 0.45].forEach((dx) => {
    addBox(group, [0.17, 0.04, 0.17], [0.8 + dx, 1.272, -2.02], 0xf5c96b, {
      emissive: 0xfacc15,
      emissiveIntensity: 0.45,
      collider: false,
    });
  });
  // Elevator bank / room exit. The stage now ends when Patrick actually uses
  // the keycard instead of when the bellhop merely offers directions.
  addBox(group, [2.1, 2.45, 0.08], [6.35, 1.23, -5.76], 0x1f2937, {
    metalness: 0.2,
    roughness: 0.42,
    collider: false,
  });
  addBox(group, [0.06, 2.25, 0.04], [6.35, 1.23, -5.71], 0xb98843, {
    emissive: 0xb98843,
    emissiveIntensity: 0.22,
    collider: false,
  });
  addBox(group, [1.75, 0.08, 0.04], [6.35, 2.52, -5.7], 0xf5c96b, {
    emissive: 0xfacc15,
    emissiveIntensity: 0.65,
    collider: false,
  });
  addBox(group, [0.28, 0.55, 0.05], [7.58, 1.25, -5.69], 0x0f172a, { collider: false });
  addCylinder(group, 0.07, 0.035, [7.58, 1.38, -5.64], 0x67e8f9, {
    segments: 16,
    emissive: 0x67e8f9,
    emissiveIntensity: 0.8,
    collider: false,
  });
  // Floor mat under the customer side of the counter
  addBox(group, [4.0, 0.012, 1.4], [0, 0.012, -1.0], 0x7f1d1d, {
    emissive: 0x4a1d1d,
    emissiveIntensity: 0.08,
  });
  addBox(group, [4.0, 0.014, 0.05], [0, 0.014, -1.7], 0xb98843);
  addBox(group, [4.0, 0.014, 0.05], [0, 0.014, -0.3], 0xb98843);
}

function addHotelWayfinding(group: THREE.Group, labelBlocks: Array<[number, number]>, z = -5.78) {
  addBox(group, [2.4, 0.5, 0.05], [0, 3.08, z], 0x111827, {
    emissive: 0x0f172a,
    emissiveIntensity: 0.24,
    collider: false,
  });
  addBox(group, [2.4, 0.05, 0.05], [0, 3.34, z + 0.02], 0xb98843, {
    emissive: 0xb98843,
    emissiveIntensity: 0.42,
    collider: false,
  });
  for (const [x, width] of labelBlocks) {
    addBox(group, [width, 0.16, 0.03], [x, 3.08, z + 0.03], 0xfde68a, {
      emissive: 0xfacc15,
      emissiveIntensity: 0.66,
      collider: false,
    });
  }
}

function buildElevatorLandingRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, {
    ceilingTrim: true,
    floorMaterial: makeImageSurfaceMaterial(
      'veined-marble-floor',
      6,
      3,
      () => makeMarbleFloorMaterial(4, 2),
      { roughness: 0.16, metalness: 0, color: 0xded7c9 },
    ),
    wallMaterial: makePaneledWallMaterial(0x3b2f27, 0xd6a94d, 4, 1),
  });
  addCeilingLights(group, palette, [-5.6, -1.8, 1.8, 5.6], -2.6);
  addChandelier(group, 0, 0.5, 8);
  addHotelWayfinding(group, [
    [-0.72, 0.38],
    [-0.22, 0.2],
    [0.22, 0.2],
    [0.72, 0.38],
  ]);

  // Elevator bank at the front-desk side of the landing.
  [-2.1, 0, 2.1].forEach((x, index) => {
    addBox(group, [1.5, 2.65, 0.09], [x, 1.33, -5.74], 0x1f2937, {
      metalness: 0.24,
      roughness: 0.36,
      collider: false,
    });
    addBox(group, [0.06, 2.42, 0.04], [x, 1.33, -5.68], 0xb98843, {
      emissive: 0xb98843,
      emissiveIntensity: 0.25,
      collider: false,
    });
    addBox(group, [1.18, 0.05, 0.04], [x, 2.66, -5.66], index === 1 ? 0x67e8f9 : 0xf5c96b, {
      emissive: index === 1 ? 0x67e8f9 : 0xfacc15,
      emissiveIntensity: 0.6,
      collider: false,
    });
  });

  // Narrow carpet runner, side alcoves, and luggage cart make it read like a
  // connector room rather than another static lobby.
  addBox(group, [3.4, 0.016, 10.2], [0, 0.012, 0], 0x6b1f2a, { emissive: 0x3f1017, emissiveIntensity: 0.08 });
  addBox(group, [0.08, 0.018, 10.2], [-1.76, 0.018, 0], 0xd6a94d, { collider: false });
  addBox(group, [0.08, 0.018, 10.2], [1.76, 0.018, 0], 0xd6a94d, { collider: false });
  [-6.8, 6.8].forEach((x) => {
    addBox(group, [1.2, 2.0, 0.16], [x, 1.05, -1.5], 0x261d1a, { collider: false });
    addBox(group, [0.86, 0.95, 0.08], [x, 1.35, -1.39], 0xfde68a, {
      emissive: 0xfacc15,
      emissiveIntensity: 0.18,
      collider: false,
    });
  });
  addRoundedBox(group, [1.25, 0.12, 0.75], [-5.8, 0.52, 2.4], 0xb98843, { radius: 0.04, metalness: 0.35 });
  addCylinder(group, 0.16, 0.09, [-6.28, 0.16, 2.1], 0x111827, { segments: 14 });
  addCylinder(group, 0.16, 0.09, [-5.32, 0.16, 2.1], 0x111827, { segments: 14 });
  addBox(group, [0.95, 0.55, 0.5], [-5.8, 0.86, 2.48], 0x7c2d12, { roughness: 0.7 });
}

function buildGuestCorridorRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, {
    ceilingTrim: true,
    floorMaterial: makeImageSurfaceMaterial(
      'stage-01-teal-runner-rug-texture',
      2,
      8,
      () => makeMarbleFloorMaterial(5, 2),
      { roughness: 0.34, metalness: 0, color: 0xb9afa1 },
    ),
    wallMaterial: makePaneledWallMaterial(0x302820, 0xb98843, 5, 1),
  });
  addCeilingLights(group, palette, [-5.6, -2.8, 0, 2.8, 5.6], -2.6);
  addHotelWayfinding(group, [
    [-0.7, 0.22],
    [-0.36, 0.22],
    [0.0, 0.22],
    [0.36, 0.22],
    [0.7, 0.22],
  ]);

  // Corridor side doors. The far door 1106 is the real goal.
  const doorXs = [-6.2, -3.8, -1.4, 1.4, 3.8, 6.2];
  doorXs.forEach((x, index) => {
    const isGoal = index === 4;
    addBox(group, [1.35, 2.25, 0.12], [x, 1.16, -5.72], isGoal ? 0x5a321c : 0x2a211c, {
      roughness: 0.52,
      metalness: 0.04,
      collider: false,
    });
    addBox(group, [1.18, 0.08, 0.05], [x, 2.42, -5.64], isGoal ? 0x67e8f9 : 0xd6a94d, {
      emissive: isGoal ? 0x67e8f9 : 0xb98843,
      emissiveIntensity: isGoal ? 0.7 : 0.35,
      collider: false,
    });
    addCylinder(group, 0.055, 0.04, [x + 0.48, 1.18, -5.62], isGoal ? 0x67e8f9 : 0xfde68a, {
      segments: 12,
      emissive: isGoal ? 0x67e8f9 : 0xfacc15,
      emissiveIntensity: isGoal ? 0.8 : 0.25,
      collider: false,
    });
  });

  addBox(group, [3.2, 0.018, 10.4], [0, 0.014, 0], 0x12333a, { emissive: 0x0f2a2f, emissiveIntensity: 0.12 });
  addBox(group, [0.08, 0.02, 10.4], [-1.68, 0.02, 0], 0xd6a94d, { collider: false });
  addBox(group, [0.08, 0.02, 10.4], [1.68, 0.02, 0], 0xd6a94d, { collider: false });
  addBox(group, [1.2, 1.6, 0.08], [-7.2, 1.6, -2.1], 0x111827, { collider: false });
  addBox(group, [0.92, 1.25, 0.04], [-7.2, 1.6, -2.02], 0x67e8f9, {
    emissive: 0x67e8f9,
    emissiveIntensity: 0.24,
    collider: false,
  });
}

// The bathroom room was removed in the tech-demo trim: it existed solely to
// hold the phone item, which stretched the fetch quest to five items across
// three rooms before the player had learned the verb loop. See lobbyRoom —
// the check-in now needs wallet + passport, then the desk paperwork.

// ---------------------------------------------------------------------------
// Stage 2 doesn't have phrases registered for every command we'd like to wire
// (item Look/Take/Use, NPC greetings, etc.) so we lean on customPhraseCommand
// with phrasing the original LevelTwoDebugPage already established. Most of
// the spoken targets follow a "ผม + verb + noun + ครับ" template that the
// learner has just been introduced to in Stage 1.
// ---------------------------------------------------------------------------

function itemSpoken(
  verb: 'look' | 'take' | 'use',
  labelPrefix: string,
  thaiNoun: string,
  romanizationNoun: string,
  phoneticNoun: string,
  englishNoun: string,
  successText: string,
  extras: Parameters<typeof customPhraseCommand>[7] = {},
) {
  const verbForms = {
    look: { thai: 'ผมดู', rom: 'phom duu', phon: 'pom doo', en: 'I look at' },
    take: { thai: 'ผมหยิบ', rom: 'phom yip', phon: 'pom yip', en: 'I take' },
    use: { thai: 'ผมใช้', rom: 'phom chai', phon: 'pom chai', en: 'I use' },
  } as const;
  const form = verbForms[verb];
  return customPhraseCommand(
    verb,
    labelPrefix,
    `${form.thai}${thaiNoun}ครับ`,
    `${form.rom} ${romanizationNoun} khrap`,
    `${form.phon} ${phoneticNoun} khrap`,
    `${form.en} the ${englishNoun}.`,
    successText,
    extras,
  );
}

function roomTransitionCommand(
  label: string,
  targetPhrase: string,
  romanization: string,
  translation: string,
  successText: string,
  entersRoom: string,
  extras: Parameters<typeof customPhraseCommand>[7] = {},
) {
  return customPhraseCommand('use', label, targetPhrase, romanization, romanization, translation, successText, {
    ...extras,
    entersRoom,
  });
}

// ---------------------------------------------------------------------------
// Conversation tree — five-turn hostess dialogue lifted intact from the
// original pointClickLevel2.ts. Keeping this colocated rather than imported
// so the legacy file can be deleted in Task #5 without leaving a dangling
// dependency.
// ---------------------------------------------------------------------------

const frontDeskCheckInConversation: AdventureConversationTurn[] = [
  {
    id: 'hello',
    npcSpeaker: 'Hostess',
    npcLineThai: 'สวัสดีค่ะ',
    npcRomanization: 'sawatdee kha',
    npcEnglish: 'Hello.',
    response: {
      targetPhrase: 'สวัสดีครับ ผมอยากเช็คอินครับ',
      romanization: 'sawatdee khrap phom yaak check-in khrap',
      phoneticSpelling: 'sah-waht-dee khrap pom yahk chek-in khrap',
      translation: 'Hello, I would like to check in.',
    },
    successText: 'The hostess understands that you want to check in.',
  },
  {
    id: 'name',
    npcSpeaker: 'Hostess',
    npcLineThai: 'คุณชื่ออะไรคะ',
    npcRomanization: 'khun chue arai kha',
    npcEnglish: 'What is your name?',
    response: {
      targetPhrase: 'ผมชื่อแพทริกครับ',
      romanization: 'phom chue Patrick khrap',
      phoneticSpelling: 'pom cheu Patrick khrap',
      translation: 'My name is Patrick.',
    },
    successText: 'The hostess writes Patrick on the check-in form.',
  },
  {
    id: 'documents',
    npcSpeaker: 'Hostess',
    npcLineThai: 'คุณมีหนังสือเดินทางและกระเป๋าสตางค์ไหมคะ',
    npcRomanization: 'khun mee nang-sue doen-thaang lae gra-pao sa-taang mai kha',
    npcEnglish: 'Do you have your passport and wallet?',
    response: {
      targetPhrase: 'มีครับ',
      romanization: 'mee khrap',
      phoneticSpelling: 'mee khrap',
      translation: 'Yes, I have them.',
    },
    successText: 'The hostess checks the passport and wallet.',
  },
  {
    id: 'guest',
    npcSpeaker: 'Hostess',
    npcLineThai: 'คุณมีแขกมาด้วยไหมคะ',
    npcRomanization: 'khun mee khaek maa duai mai kha',
    npcEnglish: 'Do you have a guest with you?',
    response: {
      targetPhrase: 'ไม่มีครับ',
      romanization: 'mai mee khrap',
      phoneticSpelling: 'mai mee khrap',
      translation: 'No, I do not.',
    },
    successText: 'The hostess marks the room for one guest.',
  },
  {
    id: 'thanks',
    npcSpeaker: 'Hostess',
    npcLineThai: 'ยินดีต้อนรับค่ะ คุณเช็คอินแล้วค่ะ กรุณาหยิบใบจองห้องพักและบัตรห้องพักค่ะ',
    npcRomanization:
      'yin dee ton rap kha khun check-in laeo kha ga-ru-na yip bai jong hong phak lae bat hong phak kha',
    npcEnglish: 'Welcome to the hotel. You are checked in. Please take your reservation paper and keycard.',
    response: {
      targetPhrase: 'ขอบคุณที่ช่วยครับ',
      romanization: 'khop khun tee chuai khrap',
      phoneticSpelling: 'khop khun tee chuai khrap',
      translation: 'Thank you for the help.',
    },
    successText: 'The hostess smiles and points to the reservation paper and keycard.',
  },
];

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

const lobbyRoom: AdventureRoom3D = {
  id: 'lobby',
  title: 'Hotel Lobby',
  shortTitle: 'Lobby',
  description:
    'Morning at the Chao Phraya Star. Patrick’s wallet and passport are on the lounge table where he dozed off — gather them and finish the check-in the hostess promised.',
  // Same set as Stage 1: this is literally the lobby the player just learned
  // their first phrases in, which sells continuity and reuses the polished
  // build (ceiling, chandelier, GLB furniture) for free.
  palette: lobbyPalette,
  patrickStart: [4.6, 0, 3.4],
  build: buildHotelLobbyRoom,
  hotspots: [
    {
      id: 'wallet',
      label: 'Wallet',
      kind: 'item',
      // On the lounge coffee table (table centre -5.6, 2.6, top ≈0.46).
      position: [-5.25, 0.72, 2.6],
      standPosition: [-5.25, 0, 1.45],
      sprite: walletUrl,
      spriteScale: [0.85, 0.85],
      commands: {
        look: itemSpoken(
          'look',
          'I look at',
          'กระเป๋าสตางค์',
          'gra-pao sa-taang',
          'gra-pao sa-taang',
          'wallet',
          'You check the wallet. Patrick will need it for check-in.',
        ),
        take: itemSpoken(
          'take',
          'I take',
          'กระเป๋าสตางค์',
          'gra-pao sa-taang',
          'gra-pao sa-taang',
          'wallet',
          'Wallet collected. The clerk can now confirm payment details.',
          { givesItem: 'wallet' },
        ),
      },
    },
    {
      id: 'passport',
      label: 'Passport',
      kind: 'item',
      // Next to the wallet on the lounge coffee table.
      position: [-5.95, 0.72, 2.6],
      standPosition: [-5.95, 0, 1.45],
      sprite: passportUrl,
      spriteScale: [0.85, 0.85],
      commands: {
        look: itemSpoken(
          'look',
          'I look at',
          'หนังสือเดินทาง',
          'nang-sue doen-thaang',
          'nang-sue doen-thaang',
          'passport',
          'You inspect the passport. It is the main check-in document.',
        ),
        take: itemSpoken(
          'take',
          'I take',
          'หนังสือเดินทาง',
          'nang-sue doen-thaang',
          'nang-sue doen-thaang',
          'passport',
          'Passport collected. The front desk will need this.',
          { givesItem: 'passport' },
        ),
      },
    },
    {
      id: 'bellhop',
      label: 'Bellhop',
      kind: 'person',
      position: [5.4, 0, -2.4],
      standPosition: [5.4, 0, -0.6],
      model: {
        id: 'bellboy',
        animation: 'wave',
        height: 1.78,
        rotationY: Math.PI, // Face into the room toward the player.
      },
      commands: {
        look: customPhraseCommand(
          'look',
          'I look at',
          'ผมดูพนักงานยกกระเป๋าครับ',
          'phom duu pha-nak-ngaan yok gra-pao khrap',
          'pom doo pa-nak-ngaan yok gra-pao khrap',
          'I look at the bellhop.',
          'The bellhop nods politely, ready to help.',
          {
            characterVoice: {
              speaker: 'Bellhop',
              text: 'Good evening, sir. I can help with your bags after check-in.',
            },
          },
        ),
        talk: customPhraseCommand(
          'talk',
          'Ask for room directions',
          'ผมคุยกับพนักงานยกกระเป๋าครับ',
          'phom khui gap pha-nak-ngaan yok gra-pao khrap',
          'pom koo-ee gap pa-nak-ngaan yok gra-pao khrap',
          'I talk to the bellhop.',
          'The bellhop points past the brass elevator doors. "Use your keycard there, sir. Room 1106 is ready."',
          {
            requiresItems: ['wallet', 'passport', 'reservationPaper', 'keycard'],
            blockedText: 'Collect all four check-in items before asking the bellhop to take you to the room.',
            characterVoice: {
              speaker: 'Bellhop',
              text: 'Of course, sir. Use the keycard at the elevator, then I will bring the luggage up.',
            },
          },
        ),
      },
    },
    {
      id: 'frontDeskArchway',
      label: 'Front Desk Archway',
      kind: 'prop',
      position: [1.2, 1.45, -5.45],
      standPosition: [1.2, 0, -3.9],
      ringColor: 0xf59e0b,
      commands: {
        look: customPhraseCommand(
          'look',
          'Look down the hotel passage',
          'ผมดูทางไปแผนกต้อนรับครับ',
          'phom duu thaang bpai pha-naek ton-rap khrap',
          'phom duu thaang bpai pha-naek ton-rap khrap',
          'I look toward the front desk passage.',
          'Warm brass signs point deeper into the hotel. The front desk is just beyond the lobby.',
        ),
        use: roomTransitionCommand(
          'Walk to Front Desk',
          'ผมไปแผนกต้อนรับครับ',
          'phom bpai pha-naek ton-rap khrap',
          'I go to the front desk.',
          'Patrick follows the brass signs toward reception.',
          'frontDesk',
        ),
      },
    },
  ],
};

const frontDeskRoom: AdventureRoom3D = {
  id: 'frontDesk',
  title: 'Front Desk',
  shortTitle: 'Desk',
  description:
    'The reception counter has the hostess, the reservation paper, and the keycard tray. Talk to her first.',
  palette: frontDeskPalette,
  patrickStart: [0, 0, 2.8],
  build: buildFrontDeskRoom,
  hotspots: [
    {
      id: 'clerk',
      label: 'Front Desk Hostess',
      kind: 'person',
      position: [0.2, 0, -3.4],
      standPosition: [0.2, 0, -1.4],
      // Clicking the clerk walks Patrick over and opens the check-in drill
      // directly — same Stage 1 pattern. Her talk command's targetPhrase
      // ('sawatdee kha') would otherwise be drilled twice (once as the
      // command, once as the first conversation turn).
      autoTalk: true,
      model: {
        id: 'hotelLobbyGirl',
        animation: 'wave',
        height: 1.66,
        rotationY: Math.PI, // Behind the counter, facing the player.
      },
      commands: {
        look: customPhraseCommand(
          'look',
          'I look at',
          'ผมดูพนักงานต้อนรับครับ',
          'phom duu pha-nak-ngaan ton-rap khrap',
          'pom doo pa-nak-ngaan ton-rap khrap',
          'I look at the front desk hostess.',
          'The hostess waits politely behind the counter.',
          {
            characterVoice: {
              speaker: 'Hostess',
              text: 'Welcome to the Chao Phraya Star Hotel. I can help you check in.',
            },
          },
        ),
        talk: phraseCommand(
          'talk',
          'Begin the check-in duel',
          phraseById['check-in-please'] ?? phrases[0],
          'The hostess starts the hotel check-in conversation.',
          {
            conversationId: 'frontDeskCheckIn',
            // SNES-style social duel replaces the scrolling check-in. The
            // conversation below stays as fallback + recap source.
            battleEncounterId: 'clerk-check-in-duel',
            conversation: frontDeskCheckInConversation,
            conversationCompleteText:
              'Check-in conversation complete. Take the reservation paper and keycard from the desk.',
          },
        ),
      },
    },
    {
      id: 'reservationPaper',
      label: 'Reservation Paper',
      kind: 'item',
      position: [-1.8, 1.55, -2.6],
      standPosition: [-1.8, 0, -1.2],
      sprite: reservationPaperUrl,
      spriteScale: [0.9, 0.7],
      commands: {
        look: itemSpoken(
          'look',
          'I look at',
          'ใบจองห้องพัก',
          'bai jong hong phak',
          'bai jong hong phak',
          'reservation paper',
          'The reservation paper shows the hotel name and dates.',
        ),
        take: itemSpoken(
          'take',
          'I take',
          'ใบจองห้องพัก',
          'bai jong hong phak',
          'bai jong hong phak',
          'reservation paper',
          'Reservation paper collected. The clerk can prepare the keycard.',
          {
            givesItem: 'reservationPaper',
            requiresItems: ['wallet', 'passport'],
            requiresConversation: 'frontDeskCheckIn',
            blockedText: 'Collect the wallet and passport before taking the reservation paper.',
            conversationBlockedText:
              'Complete the check-in conversation with the hostess before taking the reservation paper.',
          },
        ),
      },
    },
    {
      id: 'lobbyArchway',
      label: 'Lobby Archway',
      kind: 'prop',
      position: [-6.7, 1.35, -5.45],
      standPosition: [-6.7, 0, -3.7],
      ringColor: 0xfde68a,
      commands: {
        look: customPhraseCommand(
          'look',
          'Look back toward the lobby',
          'ผมดูทางไปล็อบบี้ครับ',
          'phom duu thaang bpai lobby khrap',
          'phom duu thaang bpai lobby khrap',
          'I look toward the lobby.',
          'The lobby lights are still visible through the archway behind the reception hall.',
        ),
        use: roomTransitionCommand(
          'Return to Lobby',
          'ผมกลับไปล็อบบี้ครับ',
          'phom glap bpai lobby khrap',
          'I go back to the lobby.',
          'Patrick retraces the marble passage to the lobby.',
          'lobby',
        ),
      },
    },
    {
      id: 'keycard',
      label: 'Keycard',
      kind: 'item',
      position: [2.6, 1.55, -2.6],
      standPosition: [2.6, 0, -1.2],
      sprite: keycardUrl,
      spriteScale: [0.85, 0.55],
      commands: {
        look: itemSpoken(
          'look',
          'I look at',
          'บัตรห้องพัก',
          'bat hong phak',
          'bat hong phak',
          'keycard',
          'The keycard is ready in the tray, but the clerk needs the paperwork first.',
        ),
        take: itemSpoken(
          'take',
          'I take',
          'บัตรห้องพัก',
          'bat hong phak',
          'bat hong phak',
          'keycard',
          'Keycard collected. You are checked in now.',
          {
            givesItem: 'keycard',
            requiresItems: ['wallet', 'passport', 'reservationPaper'],
            requiresConversation: 'frontDeskCheckIn',
            blockedText:
              'Collect the wallet, passport, and reservation paper before taking the keycard.',
            conversationBlockedText:
              'Complete the check-in conversation with the hostess before taking the keycard.',
          },
        ),
      },
    },
    {
      id: 'elevatorDoors',
      label: 'Elevator Doors',
      kind: 'prop',
      position: [6.35, 1.35, -5.45],
      standPosition: [6.35, 0, -3.6],
      ringColor: 0x67e8f9,
      commands: {
        look: customPhraseCommand(
          'look',
          'Inspect elevator panel',
          'ผมดูลิฟต์ครับ',
          'phom duu lift khrap',
          'pom doo lift khrap',
          'I look at the elevator.',
          'A brass reader glows beside the elevator doors. It is waiting for the keycard.',
        ),
        use: customPhraseCommand(
          'use',
          'Ride elevator to guest floor',
          'ผมใช้บัตรห้องพักครับ',
          'phom chai bat hong phak khrap',
          'pom chai baht hong pahk khrap',
          'I use the room keycard.',
          'The elevator panel chirps. The brass doors open toward the guest-floor landing.',
          {
            requiresItems: ['wallet', 'passport', 'reservationPaper', 'keycard'],
            requiresConversation: 'frontDeskCheckIn',
            blockedText: 'Finish check-in and collect the wallet, passport, reservation paper, and keycard first.',
            conversationBlockedText:
              'Complete the check-in conversation with the hostess before trying the elevator.',
            entersRoom: 'elevatorLanding',
            characterVoice: {
              speaker: 'Bellhop',
              text: 'Perfect. Room eleven oh six is ready. The guest corridor is on this floor.',
            },
          },
        ),
      },
    },
  ],
};

const elevatorLandingRoom: AdventureRoom3D = {
  id: 'elevatorLanding',
  title: 'Guest-Floor Elevator Landing',
  shortTitle: 'Lift',
  description:
    'The elevator opens onto a quiet guest-floor landing. Signs split toward the room corridor and back down to reception.',
  palette: frontDeskPalette,
  patrickStart: [0, 0, 3.7],
  build: buildElevatorLandingRoom,
  hotspots: [
    {
      id: 'frontDeskElevator',
      label: 'Elevator Back to Front Desk',
      kind: 'prop',
      position: [0, 1.4, -5.45],
      standPosition: [0, 0, -3.6],
      ringColor: 0x67e8f9,
      commands: {
        look: customPhraseCommand(
          'look',
          'Inspect elevator doors',
          'ผมดูลิฟต์ครับ',
          'phom duu lift khrap',
          'phom duu lift khrap',
          'I look at the elevator.',
          'The center elevator still glows, ready to return to reception.',
        ),
        use: roomTransitionCommand(
          'Ride back to Front Desk',
          'ผมกลับไปแผนกต้อนรับครับ',
          'phom glap bpai pha-naek ton-rap khrap',
          'I go back to the front desk.',
          'The elevator hums back down to reception.',
          'frontDesk',
        ),
      },
    },
    {
      id: 'corridorSign',
      label: 'Room Corridor Sign',
      kind: 'prop',
      position: [5.6, 1.6, -2.4],
      standPosition: [4.8, 0, -1.0],
      ringColor: 0xfde68a,
      commands: {
        look: customPhraseCommand(
          'look',
          'Read room sign',
          'ผมดูป้ายห้องพักครับ',
          'phom duu bpaai hong phak khrap',
          'phom duu bpaai hong phak khrap',
          'I look at the room sign.',
          'The sign points toward rooms 1101 through 1112. Room 1106 is down the corridor.',
        ),
        use: roomTransitionCommand(
          'Enter Guest Corridor',
          'ผมไปทางห้องพักครับ',
          'phom bpai thaang hong phak khrap',
          'I go toward the guest rooms.',
          'Patrick follows the runner carpet into the guest corridor.',
          'guestCorridor',
        ),
      },
    },
    {
      id: 'luggageCart',
      label: 'Luggage Cart',
      kind: 'prop',
      position: [-5.8, 0.95, 2.45],
      standPosition: [-4.7, 0, 2.45],
      ringColor: 0xf59e0b,
      commands: {
        look: customPhraseCommand(
          'look',
          'Inspect luggage cart',
          'ผมดูรถเข็นกระเป๋าครับ',
          'phom duu rot-khen gra-pao khrap',
          'phom duu rot-khen gra-pao khrap',
          'I look at the luggage cart.',
          'The bellhop has already sent Patrick\'s luggage ahead. The cart is empty now.',
        ),
      },
    },
  ],
  ambianceOverride: {
    fogNear: 10,
    fogFar: 28,
  },
};

const guestCorridorRoom: AdventureRoom3D = {
  id: 'guestCorridor',
  title: 'Guest Corridor',
  shortTitle: 'Rooms',
  description:
    'A long, quiet corridor of numbered doors. Find Room 1106 and use the keycard to finish check-in.',
  palette: frontDeskPalette,
  patrickStart: [0, 0, 3.8],
  build: buildGuestCorridorRoom,
  hotspots: [
    {
      id: 'landingReturn',
      label: 'Elevator Landing',
      kind: 'prop',
      position: [-6.9, 1.4, -5.45],
      standPosition: [-6.2, 0, -3.5],
      ringColor: 0xfde68a,
      commands: {
        look: customPhraseCommand(
          'look',
          'Look back to landing',
          'ผมดูทางกลับลิฟต์ครับ',
          'phom duu thaang glap lift khrap',
          'phom duu thaang glap lift khrap',
          'I look back toward the elevator.',
          'The elevator landing is behind you, past the brass runner lights.',
        ),
        use: roomTransitionCommand(
          'Return to Elevator Landing',
          'ผมกลับไปลิฟต์ครับ',
          'phom glap bpai lift khrap',
          'I go back to the elevator.',
          'Patrick walks back to the elevator landing.',
          'elevatorLanding',
        ),
      },
    },
    {
      id: 'floorMap',
      label: 'Floor Map',
      kind: 'prop',
      position: [-7.2, 1.6, -2.1],
      standPosition: [-6.1, 0, -1.5],
      ringColor: 0x67e8f9,
      commands: {
        look: customPhraseCommand(
          'look',
          'Read floor map',
          'ผมดูแผนที่ชั้นนี้ครับ',
          'phom duu phaen-thee chan nee khrap',
          'phom duu phaen-thee chan nee khrap',
          'I look at this floor map.',
          'The map confirms Room 1106 is on the right side of the corridor.',
        ),
      },
    },
    {
      id: 'room1106',
      label: 'Room 1106',
      kind: 'prop',
      position: [3.8, 1.45, -5.45],
      standPosition: [3.8, 0, -3.55],
      ringColor: 0x67e8f9,
      commands: {
        look: customPhraseCommand(
          'look',
          'Inspect Room 1106',
          'ผมดูห้องหนึ่งหนึ่งศูนย์หกครับ',
          'phom duu hong neung-neung-suun-hok khrap',
          'phom duu hong neung-neung-suun-hok khrap',
          'I look at Room 1106.',
          'The door plaque matches the keycard sleeve: Room 1106.',
        ),
        use: customPhraseCommand(
          'use',
          'Use keycard on Room 1106',
          'ผมใช้บัตรห้องพักครับ',
          'phom chai bat hong phak khrap',
          'phom chai bat hong phak khrap',
          'I use the room keycard.',
          'The lock clicks green. Patrick finally reaches his room.',
          {
            requiresItems: ['wallet', 'passport', 'reservationPaper', 'keycard'],
            requiresConversation: 'frontDeskCheckIn',
            blockedText: 'Finish check-in and collect every document before opening Room 1106.',
            conversationBlockedText:
              'Complete the check-in conversation with the hostess before opening Room 1106.',
            completesAdventure: true,
            characterVoice: {
              speaker: 'Bellhop',
              text: 'That is your room, sir. I will leave the luggage inside.',
            },
          },
        ),
      },
    },
  ],
  ambianceOverride: {
    fogNear: 8,
    fogFar: 24,
  },
};

// ---------------------------------------------------------------------------
// Ambient lighting — warmer than Stage 3's night market, cooler than Stage 1.
// Reads as "indoor hotel evening" with amber key, gold rim, near fog so the
// rear-wall mural doesn't feel pasted-on.
// ---------------------------------------------------------------------------
const ambiance: SceneAmbiance = {
  background: 0x140e08,
  fogColor: 0x1a120b,
  fogNear: 12,
  fogFar: 32,
  hemiSky: 0xfde68a,
  hemiGround: 0x2a1f14,
  hemiIntensity: 0.95,
  keyColor: 0xfacc15,
  keyIntensity: 1.4,
  keyPosition: [-3, 7, 5],
  rimColor: 0xfbbf24,
  rimIntensity: 2.2,
  rimPosition: [5, 2.6, -4.2],
  skyTexture: 'warm-dusk-sky',
};

export const stageTwoAdventure: AdventureSceneConfig = {
  scenarioId: scenario.id,
  scenarioNumber: scenario.scenarioNumber,
  title: scenario.title,
  subtitle: 'Hotel Check-In',
  badge: `Stage ${scenario.scenarioNumber}/10 · 3D`,
  description: scenario.storyGoal,
  introVideoUrl: introTwoMovieUrl,
  rooms: [lobbyRoom, frontDeskRoom, elevatorLandingRoom, guestCorridorRoom],
  inventoryItems: {
    wallet: {
      id: 'wallet',
      label: 'Wallet',
      thaiNoun: 'กระเป๋าสตางค์',
      romanization: 'gra-pao sa-taang',
      sprite: walletUrl,
    },
    passport: {
      id: 'passport',
      label: 'Passport',
      thaiNoun: 'หนังสือเดินทาง',
      romanization: 'nang-sue doen-thaang',
      sprite: passportUrl,
    },
    reservationPaper: {
      id: 'reservationPaper',
      label: 'Reservation Paper',
      thaiNoun: 'ใบจองห้องพัก',
      romanization: 'bai jong hong phak',
      sprite: reservationPaperUrl,
    },
    keycard: {
      id: 'keycard',
      label: 'Keycard',
      thaiNoun: 'บัตรห้องพัก',
      romanization: 'bat hong phak',
      sprite: keycardUrl,
    },
  },
  requiredInventory: ['wallet', 'passport', 'reservationPaper', 'keycard'],
  ambiance,
  completionMessage: 'Stage 2 clear. Patrick checks in, follows the guest-floor route, and unlocks Room 1106.',
  chapterTitle: 'Day Two — The Front Desk',
  loadingTagline: 'Morning light spills across the marble…',
  // Cool, crisp morning-light grade — a touch bluer than the warm lobby to
  // distinguish the front-desk service beat.
  grade: {
    tint: [0.93, 0.97, 1.05],
    tintAmount: 0.18,
    contrast: 1.06,
    saturation: 1.06,
    vignette: 0.32,
    exposure: 1.02,
  },
};
