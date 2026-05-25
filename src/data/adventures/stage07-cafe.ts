import type * as THREE from 'three';
import {
  addBox,
  addCylinder,
  addEmissiveBox,
  addHangingLantern,
  addLanternStringBetween,
  addParticleField,
  addPlane,
  addRoomShell,
  type RoomPalette,
} from '../../components/three/sceneHelpers';
import { cafeFriendReactions } from '../cafeFriendReactions';
import { lessonScenarios } from '../lessonScenarios';
import type { AdventureRoom3D, AdventureSceneConfig, SceneAmbiance } from './types';
import { customPhraseCommand, phraseCommand } from './shared/phraseCommand';

const scenario = lessonScenarios[6]; // friendship-plans
const phrases = scenario.chunks.flatMap((chunk) => chunk.phrases);
const phraseById = Object.fromEntries(phrases.map((p) => [p.id, p]));

const interiorPalette: RoomPalette = {
  floor: 0x4a2812,
  wall: 0x3a200f,
  accent: 0xfb923c,
  trim: 0xfde68a,
  glow: 0xf472b6,
};
const terracePalette: RoomPalette = {
  floor: 0x4a2812,
  wall: 0x3a200f,
  accent: 0xfb923c,
  trim: 0xfde68a,
  glow: 0xc084fc,
};

function buildCafeInterior(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: true });
  // Warm window light row on back wall
  addEmissiveBox(group, [12, 1.4, 0.04], [0, 2.4, -5.85], 0xfde68a, 1.0);
  for (let i = -5; i <= 5; i += 2.5) {
    addBox(group, [0.18, 1.4, 0.06], [i, 2.4, -5.83], 0x3a200f);
  }

  // Espresso bar
  addBox(group, [6.0, 1.05, 1.3], [-2.0, 0.525, -3.4], 0x6b3f1b);
  addBox(group, [6.2, 0.14, 1.5], [-2.0, 1.13, -3.4], 0x8b4513);
  // Espresso machine (boxy industrial)
  addBox(group, [1.0, 0.8, 0.7], [-3.0, 1.6, -3.4], 0x404040, { metalness: 0.7, roughness: 0.2 });
  addEmissiveBox(group, [0.08, 0.08, 0.4], [-3.4, 1.6, -3.05], 0xef4444, 1.2);
  addEmissiveBox(group, [0.08, 0.08, 0.4], [-2.6, 1.6, -3.05], 0x10b981, 1.2);
  // Cup row
  for (let i = 0; i < 5; i++) {
    addCylinder(group, 0.08, 0.12, [-1.4 + i * 0.3, 1.26, -3.4], 0xf8fafc, { segments: 14 });
  }
  // Pastry case
  addBox(group, [1.6, 0.6, 0.8], [1.8, 1.5, -3.4], 0xf8fafc, { emissive: 0xfde68a, emissiveIntensity: 0.3 });
  for (let i = -1; i <= 1; i++) {
    addBox(group, [0.36, 0.18, 0.36], [1.8 + i * 0.5, 1.5, -3.4], i === 0 ? 0xfb7185 : 0xfde68a);
  }

  // Round tables in the foreground
  [-4.5, -1.5, 1.5, 4.5].forEach((tx) => {
    addCylinder(group, 0.06, 0.85, [tx, 0.425, 1.6], 0x6b3f1b, { segments: 14 });
    addCylinder(group, 0.6, 0.06, [tx, 0.88, 1.6], 0x8b4513, { segments: 22 });
    addCylinder(group, 0.5, 0.04, [tx, 0.92, 1.6], 0xfde68a, { segments: 22 });
    // Chairs
    addBox(group, [0.4, 0.85, 0.4], [tx - 0.8, 0.425, 1.6], 0x6b3f1b);
    addBox(group, [0.4, 0.85, 0.4], [tx + 0.8, 0.425, 1.6], 0x6b3f1b);
  });

  // Edison string light row
  addLanternStringBetween(group, -7, 7, -1.0, 3.4, 8, 0xfde68a);

  // Soft ambient particles (steam)
  addParticleField(group, 30, { x: [-4, 4], y: [1.4, 3.0], z: [-3.5, 0] }, 0xf3f4f6, 0.05);
}

function buildCafeTerrace(group: THREE.Group, palette: RoomPalette) {
  // Open terrace — no back wall, open to the river
  addBox(group, [18, 0.1, 12], [0, -0.05, 0], palette.floor);
  // Wooden plank floor lines
  for (let x = -8; x <= 8; x += 1.2) {
    addBox(group, [0.04, 0.012, 11.7], [x, 0.018, 0], 0x2c1808);
  }
  // Side walls (only)
  addBox(group, [0.18, 5, 12], [-9, 2.5, 0], palette.wall);
  addBox(group, [0.18, 5, 12], [9, 2.5, 0], palette.wall);
  // Pergola overhead
  for (let z = -3.5; z <= 1.5; z += 1.0) {
    addBox(group, [16, 0.08, 0.08], [0, 3.6, z], 0x6b3f1b);
  }
  // River backdrop (long emissive plane)
  addPlane(group, [22, 10], [0, 0.02, -5], 0x0c4a6e, {
    rotationX: -Math.PI / 2,
    emissive: 0x164e63,
    emissiveIntensity: 0.7,
  });
  // River shimmer dots
  addParticleField(group, 80, { x: [-9, 9], y: [0.02, 0.05], z: [-8, -2] }, 0x67e8f9, 0.08);
  // Distant city lights row
  for (let i = -8; i <= 8; i += 1.0) {
    addEmissiveBox(group, [0.6, 0.5, 0.04], [i, 2.5, -7], i % 2 === 0 ? 0xfde68a : 0xc084fc, 0.7);
  }
  // Lanterns under the pergola
  [-5, -2, 1, 4].forEach((x, i) => {
    addHangingLantern(group, x, 2.6, -1, i % 2 === 0 ? 0xf472b6 : 0xfde68a);
  });

  // Round table with two chairs (centerpiece)
  addCylinder(group, 0.08, 0.85, [0, 0.425, 1.4], 0x6b3f1b, { segments: 14 });
  addCylinder(group, 0.8, 0.08, [0, 0.9, 1.4], 0x8b4513, { segments: 24 });
  addCylinder(group, 0.7, 0.04, [0, 0.95, 1.4], 0xfde68a, { segments: 24 });
  // Coffee cups
  addCylinder(group, 0.1, 0.14, [-0.3, 1.03, 1.4], 0xf8fafc, { segments: 16 });
  addCylinder(group, 0.1, 0.14, [0.3, 1.03, 1.4], 0xf8fafc, { segments: 16 });
  // Chairs
  addBox(group, [0.5, 0.95, 0.5], [-1.0, 0.475, 1.4], 0x6b3f1b);
  addBox(group, [0.5, 0.95, 0.5], [1.0, 0.475, 1.4], 0x6b3f1b);

  // Side planters with orchids
  [-7.5, 7.5].forEach((x) => {
    addCylinder(group, 0.32, 0.6, [x, 0.3, 1.5], 0x7c3f24, { segments: 16 });
    addCylinder(group, 0.16, 1.2, [x, 1.0, 1.5], 0x16a34a, { segments: 12 });
    addEmissiveBox(group, [0.16, 0.16, 0.16], [x, 1.6, 1.5], 0xf472b6, 0.9);
  });
}

const ambiance: SceneAmbiance = {
  background: 0x1a0d05,
  fogColor: 0x281610,
  fogNear: 10,
  fogFar: 30,
  hemiSky: 0xfde68a,
  hemiGround: 0x2c1808,
  hemiIntensity: 1.1,
  keyColor: 0xfde68a,
  keyIntensity: 1.4,
  keyPosition: [-3, 7, 5],
  rimColor: 0xf472b6,
  rimIntensity: 1.6,
  rimPosition: [5, 2.6, -4.2],
};

const interiorRoom: AdventureRoom3D = {
  id: 'interior',
  title: 'Cafe Interior',
  shortTitle: 'Cafe',
  description: 'Warm light, espresso steam, friends at a corner table. Open with what you like.',
  palette: interiorPalette,
  patrickStart: [-5.4, 0, 3.4],
  build: buildCafeInterior,
  hotspots: [
    {
      id: 'espresso-machine',
      label: 'Espresso Machine',
      kind: 'prop',
      position: [-3.0, 1.6, -3.4],
      standPosition: [-3.0, 0, -1.8],
      ringColor: 0xfde68a,
      commands: {
        look: phraseCommand(
          'look',
          'Say I like coffee',
          phraseById['like-coffee'],
          'The barista grins and starts grinding fresh beans.',
        ),
      },
    },
    {
      id: 'pastry-case',
      label: 'Pastry Case',
      kind: 'prop',
      position: [1.8, 1.5, -3.4],
      standPosition: [1.8, 0, -1.8],
      ringColor: 0xfb7185,
      commands: {
        look: phraseCommand(
          'look',
          'Say I like Thai food',
          phraseById['like-thai-food'],
          'The friend laughs and recommends a kanom dessert.',
        ),
        use: phraseCommand(
          'use',
          'Skip spicy',
          phraseById['not-like-spicy'],
          'The friend notes — mild stuff only.',
        ),
      },
    },
    {
      id: 'corner-table',
      label: 'Corner Table',
      kind: 'prop',
      position: [4.5, 0.95, 1.6],
      standPosition: [4.5, 0, 2.8],
      ringColor: 0xfde68a,
      commands: {
        look: phraseCommand(
          'look',
          'Ask when free',
          phraseById['free-when'],
          'Friends compare their week ahead.',
        ),
      },
    },
  ],
};

const terraceRoom: AdventureRoom3D = {
  id: 'terrace',
  title: 'Riverside Terrace',
  shortTitle: 'Terrace',
  description: 'River glints below the pergola. Make the plan, set a meet spot, close warmly.',
  palette: terracePalette,
  patrickStart: [-5.0, 0, 3.4],
  build: buildCafeTerrace,
  hotspots: [
    {
      id: 'cafe-friend',
      label: 'Friend',
      kind: 'person',
      position: [1.0, 1.4, 1.4],
      standPosition: [1.0, 0, 2.8],
      sprite: cafeFriendReactions.smile,
      commands: {
        talk: phraseCommand(
          'talk',
          'Invite together',
          phraseById['go-together'],
          'The friend brightens and says yes.',
        ),
        look: customPhraseCommand(
          'look',
          'I look at',
          'ผมดูเพื่อนครับ',
          'phom duu phuean khrap',
          'pom doo pwen khrap',
          'I look at the friend.',
          'They look up from their coffee and smile.',
        ),
      },
    },
    {
      id: 'orchid-planter',
      label: 'Orchid Planter',
      kind: 'prop',
      position: [-7.5, 1.4, 1.5],
      standPosition: [-6.0, 0, 2.4],
      ringColor: 0xf472b6,
      commands: {
        look: phraseCommand(
          'look',
          'Offer evening',
          phraseById['free-evening'],
          'The friend says evenings are perfect for a walk.',
        ),
      },
    },
    {
      id: 'pergola-lantern',
      label: 'Lantern',
      kind: 'prop',
      position: [1, 2.6, -1],
      standPosition: [1, 0, 0.4],
      ringColor: 0xfde68a,
      commands: {
        use: phraseCommand(
          'use',
          'Confirm tomorrow',
          phraseById['tomorrow-ok'],
          'You both pick tomorrow at this same lantern.',
        ),
      },
    },
    {
      id: 'meeting-table',
      label: 'Coffee Table',
      kind: 'prop',
      position: [0, 1.0, 1.4],
      standPosition: [0, 0, 2.8],
      ringColor: 0xfde68a,
      commands: {
        look: phraseCommand(
          'look',
          'Pick a meet spot',
          phraseById['meet-where'],
          'You agree to meet at this terrace table.',
        ),
        talk: phraseCommand('talk', 'See you then', phraseById['see-you'], 'You wave goodbye. Stage clear!', {
          completesAdventure: true,
        }),
      },
    },
  ],
};

export const stageSevenAdventure: AdventureSceneConfig = {
  scenarioId: scenario.id,
  scenarioNumber: scenario.scenarioNumber,
  title: scenario.title,
  subtitle: 'Friendship Plans',
  badge: `Stage ${scenario.scenarioNumber}/10 · 3D`,
  description: scenario.storyGoal,
  rooms: [interiorRoom, terraceRoom],
  inventoryItems: {},
  requiredInventory: [],
  ambiance,
  completionMessage: 'Stage 7 clear. You have plans with a friend.',
};
