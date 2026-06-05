import type * as THREE from 'three';
import {
  addBox,
  addCeilingLights,
  addCylinder,
  addEmissiveBox,
  addFoliage,
  addParticleField,
  addPottedPlant,
  addRoomShell,
  type RoomPalette,
} from '../../components/three/sceneHelpers';
import {
  makeMarbleFloorMaterial,
  makePlasterWallMaterial,
} from '../../components/three/proceduralTextures';
import { formalArchivistReactions } from '../formalArchivistReactions';
import { lessonScenarios } from '../lessonScenarios';
import type { AdventureRoom3D, AdventureSceneConfig, SceneAmbiance } from './types';
import { customPhraseCommand, phraseCommand } from './shared/phraseCommand';

const scenario = lessonScenarios[8]; // formal-meeting
const phrases = scenario.chunks.flatMap((chunk) => chunk.phrases);
const phraseById = Object.fromEntries(phrases.map((p) => [p.id, p]));

const foyerPalette: RoomPalette = {
  floor: 0xe9e3d2,
  wall: 0xd6cdb7,
  accent: 0xb45309,
  trim: 0xfde68a,
  glow: 0xfb923c,
};
const archivePalette: RoomPalette = {
  floor: 0x2a201a,
  wall: 0x3b2c1f,
  accent: 0xfacc15,
  trim: 0xb45309,
  glow: 0xfb923c,
};

const MARBLE = 0xe5e7eb;

// Grand marble column with a base, shaft, and capital.
function addMarbleColumn(group: THREE.Group, x: number, z: number) {
  addBox(group, [1.0, 0.3, 1.0], [x, 0.15, z], 0xf3edd8, { collider: true });
  addCylinder(group, 0.42, 4, [x, 2.15, z], MARBLE, { segments: 20, collider: true });
  addBox(group, [1.0, 0.3, 1.0], [x, 4.3, z], 0xf3edd8);
}

// Hanging banner lit from below by a cool emissive uplight strip.
function addLitBanner(group: THREE.Group, x: number, z: number, color: number, glow: number) {
  addBox(group, [0.9, 3.4, 0.08], [x, 2.9, z], color, { roughness: 0.9 });
  addBox(group, [1.05, 0.16, 0.16], [x, 4.7, z], 0xf3edd8);
  addEmissiveBox(group, [1.0, 0.06, 0.3], [x, 0.06, z + 0.15], glow, 1.1);
}

function buildFoyerRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, {
    ceilingTrim: true,
    floorMaterial: makeMarbleFloorMaterial(3, 2),
    wallMaterial: makePlasterWallMaterial(palette.wall, 4, 1.5),
  });
  addCeilingLights(group, palette, [-4.5, 0, 4.5], -2.3);

  // Grand symmetric colonnade against both side walls
  [-3.5, 0.5].forEach((z) => {
    addMarbleColumn(group, -7.4, z);
    addMarbleColumn(group, 7.4, z);
  });

  // Banners flanking the central seal, mirrored across X
  addLitBanner(group, -3.4, -5.6, 0x7f1d1d, 0xfb923c);
  addLitBanner(group, 3.4, -5.6, 0x1e3a8a, 0x60a5fa);

  // Cool marble runner accent down the central axis
  addBox(group, [2.4, 0.014, 9.0], [0, 0.036, -0.5], MARBLE, { roughness: 0.5 });

  // Foliage planters flanking the entrance approach, mirrored
  addFoliage(group, -4.6, 4.0, 1.1);
  addFoliage(group, 4.6, 4.0, 1.1);

  // Marble checker floor accent
  for (let x = -8; x < 8; x += 2) {
    for (let z = -5; z < 5; z += 2) {
      if (((x + z) / 2) % 2 === 0) {
        addBox(group, [1.9, 0.012, 1.9], [x + 1, 0.034, z + 1], 0xf3edd8);
      }
    }
  }

  // Tall arched doorway frame on back wall
  addBox(group, [3.0, 0.5, 0.2], [0, 4.6, -5.8], 0xb45309);
  addBox(group, [0.4, 4.4, 0.2], [-1.6, 2.4, -5.8], 0xb45309);
  addBox(group, [0.4, 4.4, 0.2], [1.6, 2.4, -5.8], 0xb45309);
  addEmissiveBox(group, [2.6, 0.06, 0.04], [0, 4.85, -5.6], 0xfde68a, 0.8);

  // Embassy seal (circle) on back wall
  addCylinder(group, 0.8, 0.06, [0, 2.2, -5.85], 0xfacc15, {
    segments: 32,
    emissive: 0xfacc15,
    emissiveIntensity: 0.6,
    rotationZ: Math.PI / 2,
  });
  addCylinder(group, 0.55, 0.08, [0, 2.2, -5.78], 0xb45309, { segments: 32, rotationZ: Math.PI / 2 });
  addCylinder(group, 0.32, 0.1, [0, 2.2, -5.7], 0xfacc15, {
    segments: 32,
    emissive: 0xfacc15,
    emissiveIntensity: 0.7,
    rotationZ: Math.PI / 2,
  });

  // Reception desk
  addBox(group, [4.0, 1.05, 1.2], [0, 0.525, -2.8], 0x6b3f1b);
  addBox(group, [4.2, 0.14, 1.35], [0, 1.12, -2.8], 0xb45309);
  // Brass desk lamp
  addCylinder(group, 0.06, 0.5, [-1.2, 1.43, -2.8], 0xb45309);
  addCylinder(group, 0.18, 0.08, [-1.2, 1.7, -2.8], 0xb45309, { emissive: 0xfde68a, emissiveIntensity: 0.6 });
  // Stack of papers and a brass bell
  addBox(group, [0.5, 0.08, 0.4], [-0.4, 1.2, -2.8], 0xf8fafc);
  addCylinder(group, 0.12, 0.18, [1.0, 1.21, -2.8], 0xfacc15, {
    segments: 18,
    emissive: 0xfacc15,
    emissiveIntensity: 0.4,
  });

  // Side benches
  addBox(group, [3.0, 0.55, 0.7], [-6.0, 0.275, 0.8], 0x6b3f1b);
  addBox(group, [3.0, 0.55, 0.7], [6.0, 0.275, 0.8], 0x6b3f1b);

  // Potted ficus trees flanking the door
  addPottedPlant(group, -7.5, 2.0);
  addPottedPlant(group, 7.5, 2.0);

  // Subtle dust motes
  addParticleField(group, 25, { x: [-6, 6], y: [1.5, 4.0], z: [-4, 2] }, 0xfde68a, 0.04);
}

function buildArchiveRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, {
    ceilingTrim: true,
    floorMaterial: makeMarbleFloorMaterial(3, 2),
    wallMaterial: makePlasterWallMaterial(palette.wall, 4, 1.5),
  });
  // Atmospheric warm overhead light
  addCeilingLights(group, palette, [-4.5, 0, 4.5], -2.3);
  addEmissiveBox(group, [16, 0.12, 0.1], [0, 4.4, -5.85], 0xfb923c, 0.7);

  // File cabinets along the back wall — tall, wood
  for (let i = 0; i < 7; i++) {
    const x = -6 + i * 2;
    addBox(group, [1.6, 3.5, 0.7], [x, 1.75, -5.6], 0x6b3f1b);
    // Drawers
    for (let d = 0; d < 5; d++) {
      addBox(group, [1.45, 0.5, 0.04], [x, 0.5 + d * 0.6, -5.22], 0xb45309);
      addBox(group, [0.1, 0.1, 0.06], [x, 0.5 + d * 0.6, -5.18], 0xfacc15);
    }
    addEmissiveBox(group, [0.5, 0.08, 0.04], [x, 3.4, -5.22], 0xfde68a, 0.8);
  }

  // Long reading table in the center
  addBox(group, [8, 0.85, 2.0], [0, 0.425, 0], 0x6b3f1b);
  addBox(group, [8.2, 0.08, 2.1], [0, 0.89, 0], 0xb45309);
  // Brass lamps
  [-2.4, 0, 2.4].forEach((x) => {
    addCylinder(group, 0.06, 0.6, [x, 1.23, 0], 0xb45309);
    addCylinder(group, 0.22, 0.12, [x, 1.6, 0], 0xb45309, { emissive: 0xfde68a, emissiveIntensity: 0.8 });
  });
  // Open document on the table
  addBox(group, [0.6, 0.012, 0.45], [0, 0.96, -0.4], 0xf8fafc);
  addBox(group, [0.6, 0.012, 0.45], [-1.0, 0.96, 0.2], 0xf8fafc);

  // Chairs around the table
  [-3, -1, 1, 3].forEach((x) => {
    addBox(group, [0.6, 0.95, 0.6], [x, 0.475, 1.4], 0x4a2812);
  });

  // Side bookshelf
  addBox(group, [0.2, 4, 5], [8.6, 2, 0], 0x6b3f1b);
  for (let row = 0; row < 5; row++) {
    for (let i = -2; i <= 2; i++) {
      const colorChoices = [0xb91c1c, 0x16a34a, 0x1e3a8a, 0x713f12, 0x4c1d95];
      addBox(
        group,
        [0.3, 0.6, 0.18],
        [8.5, 0.4 + row * 0.7, i * 0.4],
        colorChoices[(row + i + 5) % colorChoices.length],
      );
    }
  }

  addParticleField(group, 22, { x: [-6, 6], y: [1.5, 3.6], z: [-4, 1] }, 0xfde68a, 0.04);
}

const ambiance: SceneAmbiance = {
  background: 0x1c140b,
  fogColor: 0x2b1f12,
  fogNear: 12,
  fogFar: 32,
  hemiSky: 0xfde68a,
  hemiGround: 0x1f1610,
  hemiIntensity: 1.05,
  keyColor: 0xfde68a,
  keyIntensity: 1.6,
  keyPosition: [-3, 8, 6],
  rimColor: 0xfb923c,
  rimIntensity: 1.4,
  rimPosition: [5, 2.6, -4.2],
};

const foyerRoom: AdventureRoom3D = {
  id: 'foyer',
  title: 'Embassy Foyer',
  shortTitle: 'Foyer',
  description: 'Quiet marble and brass. Greet the reception clerk with the most polite Thai you know.',
  palette: foyerPalette,
  patrickStart: [-5.4, 0, 3.4],
  build: buildFoyerRoom,
  hotspots: [
    {
      id: 'reception-desk',
      label: 'Reception Desk',
      kind: 'prop',
      position: [0, 1.2, -2.8],
      standPosition: [0, 0, -1.2],
      ringColor: 0xfde68a,
      commands: {
        talk: phraseCommand('talk', 'May I ask?', phraseById['may-ask'], 'The clerk pauses and nods.'),
        look: phraseCommand('look', 'Request entry', phraseById['may-enter'], 'The clerk consults a binder.'),
      },
    },
    {
      id: 'embassy-seal',
      label: 'Embassy Seal',
      kind: 'prop',
      position: [0, 2.2, -5.78],
      standPosition: [0, 0, -3.2],
      ringColor: 0xfacc15,
      commands: {
        look: phraseCommand(
          'look',
          'State purpose',
          phraseById['looking-for-info'],
          'Your purpose is logged in the visitor book.',
        ),
      },
    },
    {
      id: 'side-bench',
      label: 'Side Bench',
      kind: 'prop',
      position: [-6.0, 0.6, 0.8],
      standPosition: [-4.6, 0, 1.6],
      ringColor: 0xfb923c,
      commands: {
        use: phraseCommand(
          'use',
          'Topic Bangkok',
          phraseById['about-bangkok'],
          'The clerk notes Bangkok in the topic field.',
        ),
      },
    },
  ],
};

const archiveRoom: AdventureRoom3D = {
  id: 'archive',
  title: 'Embassy Archive',
  shortTitle: 'Archive',
  description: 'Cabinets of records. The archivist receives you formally — be precise and grateful.',
  palette: archivePalette,
  patrickStart: [-4.6, 0, 3.4],
  build: buildArchiveRoom,
  hotspots: [
    {
      id: 'archivist',
      label: 'Formal Archivist',
      kind: 'person',
      position: [0, 1.4, -2.6],
      standPosition: [0, 0, -1.2],
      sprite: formalArchivistReactions.smile,
      commands: {
        talk: phraseCommand(
          'talk',
          'May I see document?',
          phraseById['may-see-document'],
          'The archivist opens a thick folio for you.',
        ),
        look: customPhraseCommand(
          'look',
          'I look at',
          'ผมดูบรรณารักษ์ครับ',
          'phom duu ban-naa-rak khrap',
          'pom doo ban-nah-rahk khrap',
          'I look at the archivist.',
          'The archivist nods with practiced formality.',
        ),
      },
    },
    {
      id: 'open-document',
      label: 'Open Document',
      kind: 'item',
      position: [0, 0.98, -0.4],
      standPosition: [0, 0, 0.8],
      ringColor: 0xfde68a,
      commands: {
        use: phraseCommand(
          'use',
          'Important matter',
          phraseById['important-matter'],
          'The archivist underlines a line in red.',
        ),
        look: phraseCommand(
          'look',
          'Ask next steps',
          phraseById['next-step'],
          'The archivist sketches a flow chart.',
        ),
      },
    },
    {
      id: 'side-bookshelf',
      label: 'Records Shelf',
      kind: 'prop',
      position: [8.5, 2.0, 0],
      standPosition: [6.6, 0, 0],
      ringColor: 0xb45309,
      commands: {
        look: phraseCommand(
          'look',
          'Confirm understood',
          phraseById['understand-formal'],
          'You confirm in formal Thai.',
        ),
      },
    },
    {
      id: 'thank-card',
      label: 'Thank You Card',
      kind: 'prop',
      position: [-1.0, 0.98, 0.2],
      standPosition: [-1.0, 0, 1.4],
      ringColor: 0xfacc15,
      commands: {
        talk: phraseCommand(
          'talk',
          'Thank for time',
          phraseById['thank-for-time'],
          'The archivist appreciates the polite closure. Stage clear!',
          {
            completesAdventure: true,
          },
        ),
      },
    },
  ],
};

export const stageNineAdventure: AdventureSceneConfig = {
  scenarioId: scenario.id,
  scenarioNumber: scenario.scenarioNumber,
  title: scenario.title,
  subtitle: 'Embassy Archive',
  badge: `Stage ${scenario.scenarioNumber}/10 · 3D`,
  description: scenario.storyGoal,
  rooms: [foyerRoom, archiveRoom],
  inventoryItems: {},
  requiredInventory: [],
  ambiance,
  completionMessage: 'Stage 9 clear. The archive opens to you.',
};
