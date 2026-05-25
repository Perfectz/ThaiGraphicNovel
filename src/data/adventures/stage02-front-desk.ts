import * as THREE from 'three';
import introTwoMovieUrl from '../../assets/videos/intro2.mp4?url';
import bathroomBackgroundUrl from '../../assets/adventure/level-02/bathroom-background.png';
import frontDeskBackgroundUrl from '../../assets/adventure/level-02/front-desk-background.png';
import keycardUrl from '../../assets/adventure/level-02/keycard.png';
import lobbyBackgroundUrl from '../../assets/adventure/level-02/lobby-background.png';
import passportUrl from '../../assets/adventure/level-02/passport.png';
import phoneUrl from '../../assets/adventure/level-02/phone.png';
import reservationPaperUrl from '../../assets/adventure/level-02/reservation-paper.png';
import walletUrl from '../../assets/adventure/level-02/wallet.png';
import {
  addBox,
  addCeilingLights,
  addCylinder,
  addPottedPlant,
  addRoomShell,
  type RoomPalette,
} from '../../components/three/sceneHelpers';
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
 * Visual approach: the room shells are procedural Three.js geometry — same
 * pattern as Stage 3 — but the rear wall of each room mounts the existing
 * 2D PNG backdrop from the original point-and-click stage as a textured
 * plane. This keeps the considerable art investment in those PNGs while
 * stepping the stage onto the same engine as Stages 3–10.
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
// Room palettes — warm hotel ambers contrasted with cool tile in the bathroom.
// ---------------------------------------------------------------------------
const lobbyPalette: RoomPalette = {
  floor: 0x2a1f1a,
  wall: 0x3a2a22,
  accent: 0xfacc15,
  trim: 0xfde68a,
  glow: 0xfbbf24,
};

const frontDeskPalette: RoomPalette = {
  floor: 0x1f1a14,
  wall: 0x2c241c,
  accent: 0xf59e0b,
  trim: 0xfde68a,
  glow: 0xfb923c,
};

const bathroomPalette: RoomPalette = {
  floor: 0xe2e8f0,
  wall: 0xf1f5f9,
  accent: 0x67e8f9,
  trim: 0xa7f3d0,
  glow: 0x60a5fa,
};

/**
 * Mount one of the level-02 background PNGs as a textured plane against the
 * rear wall of a procedurally-shelled room. The plane is sized to roughly
 * fill the back wall the shell already painted, giving the original art a
 * second life as a rear-wall mural until the rooms get bespoke geometry.
 */
function addRearWallBackdrop(group: THREE.Group, textureUrl: string) {
  const loader = new THREE.TextureLoader();
  const texture = loader.load(textureUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(17.6, 5.4),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
  // Sit a hair in front of the procedural back wall (z=-5.9) so z-fighting
  // doesn't strobe the mural.
  wall.position.set(0, 2.85, -5.83);
  group.add(wall);
}

// ---------------------------------------------------------------------------
// Procedural room builders. Deliberately lean — most of the visual interest
// comes from the rear-wall backdrop. Each builder is responsible for the
// shell, the backdrop, and any foreground props that need to be clickable
// (which are mostly hotspots so the geometry there is minimal).
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

function buildLobbyRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: true });
  addRearWallBackdrop(group, lobbyBackgroundUrl);
  addCeilingLights(group, palette, [-4.5, 0, 4.5], -2.3);
  addChandelier(group, 0, -0.6);

  // Foreground seating cluster — a low coffee table flanked by potted plants
  // tells the player this is a lounge, not a corridor.
  addBox(group, [1.6, 0.4, 0.9], [-4.5, 0.2, 2.6], 0x4a382b);
  addBox(group, [1.7, 0.06, 1.0], [-4.5, 0.43, 2.6], 0x6b4a35);
  // Magazine stack on the table
  addBox(group, [0.42, 0.04, 0.3], [-4.6, 0.48, 2.6], 0xfacc15);
  addBox(group, [0.42, 0.04, 0.3], [-4.6, 0.52, 2.6], 0xff7eb6);
  addPottedPlant(group, -6.4, 2.4);
  addPottedPlant(group, 6.4, 2.4);
  addPottedPlant(group, -7.4, -2.6);
  addPottedPlant(group, 7.4, -2.6);

  // Welcome sign above the lounge — small framed greeting that ties the
  // lobby to the same hotel chain implied by Stage 1's signage.
  addBox(group, [3.0, 0.5, 0.04], [-4.5, 3.4, -5.83], 0x0a1423);
  addBox(group, [3.0, 0.05, 0.05], [-4.5, 3.65, -5.82], 0xb98843, {
    emissive: 0xb98843,
    emissiveIntensity: 0.35,
  });
  addBox(group, [3.0, 0.05, 0.05], [-4.5, 3.15, -5.82], 0xb98843, {
    emissive: 0xb98843,
    emissiveIntensity: 0.35,
  });
  // Letter row — "WELCOME"-shaped glyph cubes
  for (let i = 0; i < 7; i += 1) {
    const x = -4.5 - 1.0 + i * 0.32;
    addBox(group, [0.18, 0.22, 0.03], [x, 3.4, -5.81], 0xf5c96b, {
      emissive: 0xf5c96b,
      emissiveIntensity: 0.7,
    });
  }

  // Luggage cart — visually establishes "hotel" beyond any doubt and stages
  // nicely against the back-right corner.
  addBox(group, [1.2, 0.06, 0.7], [5.6, 0.5, -3.0], 0x4a3520);
  addBox(group, [0.04, 1.4, 0.04], [5.0, 1.2, -3.3], 0xb98843);
  addBox(group, [0.04, 1.4, 0.04], [6.2, 1.2, -3.3], 0xb98843);
  addBox(group, [1.3, 0.04, 0.04], [5.6, 1.9, -3.3], 0xb98843);
  // Suitcase on the cart
  addBox(group, [0.6, 0.36, 0.42], [5.6, 0.74, -3.0], 0x7f1d1d);
  addBox(group, [0.08, 0.16, 0.04], [5.6, 0.96, -2.78], 0xb98843, {
    metalness: 0.5,
    roughness: 0.35,
  });

  // Item display pedestals — gives the wallet / passport hotspots a surface
  // to "sit on" instead of floating awkwardly above the floor.
  addCylinder(group, 0.34, 0.7, [-2.4, 0.35, -1.4], 0x4a3a2a, { segments: 22 });
  addCylinder(group, 0.34, 0.7, [-0.4, 0.35, -1.4], 0x4a3a2a, { segments: 22 });
  // Pedestal top trim — subtle gold edge so they read as "display" not "stool"
  addCylinder(group, 0.36, 0.02, [-2.4, 0.71, -1.4], 0xf5c96b, {
    segments: 22,
    emissive: 0xb98843,
    emissiveIntensity: 0.3,
  });
  addCylinder(group, 0.36, 0.02, [-0.4, 0.71, -1.4], 0xf5c96b, {
    segments: 22,
    emissive: 0xb98843,
    emissiveIntensity: 0.3,
  });
}

function buildFrontDeskRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: true });
  addRearWallBackdrop(group, frontDeskBackgroundUrl);
  addCeilingLights(group, palette, [-4.5, 0, 4.5], -2.6);
  addChandelier(group, 0, 0.4, 10);

  // Reception counter — the visual centerpiece. A long low box with a
  // brighter trim strip on top reads as a polished wood desk.
  addBox(group, [10, 1.1, 1.4], [0, 0.55, -2.6], 0x4a3520);
  addBox(group, [10.2, 0.08, 1.5], [0, 1.13, -2.6], 0xfde68a, {
    emissive: 0xfacc15,
    emissiveIntensity: 0.2,
  });
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

  // Keycard tray + pen holder + a small framed "Now Serving" placard
  addBox(group, [0.6, 0.04, 0.4], [2.6, 1.16, -2.6], 0x1f2937);
  addCylinder(group, 0.06, 0.18, [-2.6, 1.22, -2.6], 0x4a3520, { segments: 14 });
  // Pens in the holder
  addCylinder(group, 0.015, 0.18, [-2.6, 1.35, -2.6], 0x67e8f9, { segments: 6 });
  addCylinder(group, 0.015, 0.18, [-2.55, 1.35, -2.6], 0xff7eb6, { segments: 6 });
  // Bell
  addCylinder(group, 0.1, 0.16, [-2.0, 1.21, -2.6], 0xd6a94d, {
    segments: 18,
    metalness: 0.55,
    roughness: 0.32,
  });
  // Floor mat under the customer side of the counter
  addBox(group, [4.0, 0.012, 1.4], [0, 0.012, -1.0], 0x7f1d1d, {
    emissive: 0x4a1d1d,
    emissiveIntensity: 0.08,
  });
  addBox(group, [4.0, 0.014, 0.05], [0, 0.014, -1.7], 0xb98843);
  addBox(group, [4.0, 0.014, 0.05], [0, 0.014, -0.3], 0xb98843);
}

function buildBathroomRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: true });
  addRearWallBackdrop(group, bathroomBackgroundUrl);
  // Sky-blue ceiling lights — colder than the warm-gold ones elsewhere.
  addCeilingLights(group, palette, [-3.0, 0, 3.0], -2.6);

  // Sink counter sized so the phone hotspot reads as sitting on it.
  addBox(group, [4.5, 0.9, 1.2], [0, 0.45, -2.8], 0xe2e8f0);
  addBox(group, [4.6, 0.06, 1.25], [0, 0.93, -2.8], 0xf8fafc);
  // Counter side panels (more depth than a bare box)
  addBox(group, [0.05, 0.92, 1.25], [-2.28, 0.46, -2.8], 0xcbd5e1);
  addBox(group, [0.05, 0.92, 1.25], [2.28, 0.46, -2.8], 0xcbd5e1);
  // Basin
  addCylinder(group, 0.5, 0.14, [0, 0.96, -2.8], 0xcbd5e1, { segments: 28 });
  // Drain
  addCylinder(group, 0.06, 0.02, [0, 0.97, -2.8], 0x4a5562, { segments: 14 });
  // Faucet
  addCylinder(group, 0.04, 0.4, [0, 1.18, -3.0], 0xcbd5e1, {
    segments: 12,
    metalness: 0.8,
    roughness: 0.2,
  });
  addBox(group, [0.32, 0.04, 0.04], [0, 1.36, -2.9], 0xcbd5e1, {
    metalness: 0.8,
    roughness: 0.2,
  });
  // Soap dispenser
  addCylinder(group, 0.06, 0.18, [-1.2, 1.04, -2.8], 0x1f2937, { segments: 14 });
  addCylinder(group, 0.03, 0.06, [-1.2, 1.18, -2.8], 0xf8fafc, { segments: 8 });
  // Hand towel folded on the counter
  addBox(group, [0.4, 0.04, 0.26], [1.4, 0.99, -2.8], 0xf8fafc);
  addBox(group, [0.4, 0.02, 0.26], [1.4, 1.025, -2.8], 0x60a5fa, {
    emissive: 0x60a5fa,
    emissiveIntensity: 0.18,
  });

  // Mirror above the sink — a tall reflective panel framed in chrome.
  addBox(group, [2.2, 1.4, 0.05], [0, 2.4, -5.85], 0xcbd5e1, {
    metalness: 0.85,
    roughness: 0.12,
  });
  addBox(group, [2.36, 0.06, 0.07], [0, 3.13, -5.83], 0xa7f3d0, {
    emissive: 0xa7f3d0,
    emissiveIntensity: 0.4,
  });
  addBox(group, [2.36, 0.06, 0.07], [0, 1.67, -5.83], 0xa7f3d0, {
    emissive: 0xa7f3d0,
    emissiveIntensity: 0.4,
  });
  addBox(group, [0.08, 1.52, 0.07], [-1.18, 2.4, -5.83], 0xa7f3d0, {
    emissive: 0xa7f3d0,
    emissiveIntensity: 0.4,
  });
  addBox(group, [0.08, 1.52, 0.07], [1.18, 2.4, -5.83], 0xa7f3d0, {
    emissive: 0xa7f3d0,
    emissiveIntensity: 0.4,
  });

  // Tile floor accent — a long thin strip down the center for depth.
  addBox(group, [0.6, 0.008, 5.0], [0, 0.012, 0], 0x67e8f9, {
    emissive: 0x67e8f9,
    emissiveIntensity: 0.18,
  });

  // Small plant for warmth
  addPottedPlant(group, -3.6, 0.6);
  addPottedPlant(group, 3.6, 0.6);
}

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
    'A warm Bangkok hotel lobby. Find Patrick’s personal items, then approach the front desk to check in.',
  palette: lobbyPalette,
  patrickStart: [4.6, 0, 3.4],
  build: buildLobbyRoom,
  hotspots: [
    {
      id: 'wallet',
      label: 'Wallet',
      kind: 'item',
      position: [-2.4, 1.0, -1.4],
      standPosition: [-2.4, 0, 0.2],
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
      position: [-0.4, 1.0, -1.4],
      standPosition: [-0.4, 0, 0.2],
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
          'I talk to',
          'ผมคุยกับพนักงานยกกระเป๋าครับ',
          'phom khui gap pha-nak-ngaan yok gra-pao khrap',
          'pom koo-ee gap pa-nak-ngaan yok gra-pao khrap',
          'I talk to the bellhop.',
          'The bellhop takes the luggage and leads Patrick toward the room.',
          {
            requiresItems: ['wallet', 'passport', 'phone', 'reservationPaper', 'keycard'],
            blockedText: 'Collect all five check-in items before asking the bellhop to take you to the room.',
            completesAdventure: true,
            characterVoice: {
              speaker: 'Bellhop',
              text: 'Of course, sir. I will take your luggage and show you to the room.',
            },
          },
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
          'Greet the hostess',
          phraseById['check-in-please'] ?? phrases[0],
          'The hostess starts the hotel check-in conversation.',
          {
            conversationId: 'frontDeskCheckIn',
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
      position: [-1.8, 1.2, -2.6],
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
            requiresItems: ['wallet', 'passport', 'phone'],
            requiresConversation: 'frontDeskCheckIn',
            blockedText: 'Collect the wallet, passport, and phone before taking the reservation paper.',
            conversationBlockedText:
              'Complete the check-in conversation with the hostess before taking the reservation paper.',
          },
        ),
      },
    },
    {
      id: 'keycard',
      label: 'Keycard',
      kind: 'item',
      position: [2.6, 1.2, -2.6],
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
            requiresItems: ['wallet', 'passport', 'phone', 'reservationPaper'],
            requiresConversation: 'frontDeskCheckIn',
            blockedText:
              'Collect the wallet, passport, phone, and reservation paper before taking the keycard.',
            conversationBlockedText:
              'Complete the check-in conversation with the hostess before taking the keycard.',
          },
        ),
      },
    },
  ],
};

const bathroomRoom: AdventureRoom3D = {
  id: 'bathroom',
  title: 'Bathroom',
  shortTitle: 'Bath',
  description: 'A clean hotel bathroom. The booking phone is on the sink counter.',
  palette: bathroomPalette,
  patrickStart: [0, 0, 2.4],
  build: buildBathroomRoom,
  hotspots: [
    {
      id: 'phone',
      label: 'Phone',
      kind: 'item',
      position: [-1.2, 1.05, -2.6],
      standPosition: [-1.2, 0, -1.2],
      sprite: phoneUrl,
      spriteScale: [0.6, 0.95],
      commands: {
        look: itemSpoken(
          'look',
          'I look at',
          'โทรศัพท์',
          'tho-ra-sap',
          'tho-ra-sap',
          'phone',
          'You find the phone near the sink with the reservation email open.',
        ),
        take: itemSpoken(
          'take',
          'I take',
          'โทรศัพท์',
          'tho-ra-sap',
          'tho-ra-sap',
          'phone',
          'Phone collected. The booking confirmation is ready.',
          { givesItem: 'phone' },
        ),
      },
    },
  ],
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
};

export const stageTwoAdventure: AdventureSceneConfig = {
  scenarioId: scenario.id,
  scenarioNumber: scenario.scenarioNumber,
  title: scenario.title,
  subtitle: 'Hotel Check-In',
  badge: `Stage ${scenario.scenarioNumber}/10 · 3D`,
  description: scenario.storyGoal,
  introVideoUrl: introTwoMovieUrl,
  rooms: [lobbyRoom, frontDeskRoom, bathroomRoom],
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
    phone: {
      id: 'phone',
      label: 'Phone',
      thaiNoun: 'โทรศัพท์',
      romanization: 'tho-ra-sap',
      sprite: phoneUrl,
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
  requiredInventory: ['wallet', 'passport', 'phone', 'reservationPaper', 'keycard'],
  ambiance,
  completionMessage: 'Stage 2 clear. The hotel welcomes you in.',
};
