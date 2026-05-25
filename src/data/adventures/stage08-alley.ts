import type * as THREE from 'three';
import {
  addBox,
  addCylinder,
  addEmissiveBox,
  addNeonSign,
  addParticleField,
  addRoomShell,
  addStreetLamp,
  type RoomPalette,
} from '../../components/three/sceneHelpers';
import { rescueGuideReactions } from '../rescueGuideReactions';
import { lessonScenarios } from '../lessonScenarios';
import type { AdventureRoom3D, AdventureSceneConfig, SceneAmbiance } from './types';
import { customPhraseCommand, phraseCommand } from './shared/phraseCommand';

const scenario = lessonScenarios[7]; // directions-and-emergency
const phrases = scenario.chunks.flatMap((chunk) => chunk.phrases);
const phraseById = Object.fromEntries(phrases.map((p) => [p.id, p]));

const alleyPalette: RoomPalette = {
  floor: 0x0c0c14,
  wall: 0x18141d,
  accent: 0xef4444,
  trim: 0x22d3ee,
  glow: 0xfde047,
};
const mainStreetPalette: RoomPalette = {
  floor: 0x0d0d16,
  wall: 0x141320,
  accent: 0xfde047,
  trim: 0xef4444,
  glow: 0x22d3ee,
};

function buildAlleyRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: false });
  // Replace the side walls with taller building silhouettes
  addBox(group, [0.4, 6, 12], [-9, 3, 0], 0x0b0712);
  addBox(group, [0.4, 6, 12], [9, 3, 0], 0x0b0712);
  // Lit windows in the building walls
  for (let z = -5; z <= 5; z += 1.4) {
    for (let yo = 0; yo < 4; yo++) {
      const isOn = ((z * 31 + yo) & 3) !== 0;
      addEmissiveBox(group, [0.06, 0.4, 0.4], [-8.7, 1.0 + yo * 1.2, z], 0xfde047, isOn ? 0.9 : 0.0);
      addEmissiveBox(group, [0.06, 0.4, 0.4], [8.7, 1.0 + yo * 1.2, z], 0xfde047, isOn ? 0.9 : 0.0);
    }
  }

  // Back wall is a dead end with neon shop sign
  addBox(group, [18, 5, 0.18], [0, 2.5, -6], 0x18141d);
  addNeonSign(group, [0, 3.4, -5.78], [3.6, 0.8], 0xef4444);
  addNeonSign(group, [-3.6, 2.0, -5.78], [1.6, 0.5], 0x22d3ee);

  // Scaffolding pole + cross beams on left
  addCylinder(group, 0.06, 5.0, [-7.2, 2.5, -2.0], 0x9ca3af, { metalness: 0.7, roughness: 0.3 });
  addCylinder(group, 0.06, 5.0, [-7.2, 2.5, 0.5], 0x9ca3af, { metalness: 0.7, roughness: 0.3 });
  for (let y = 1.2; y < 5; y += 1.0) {
    addBox(group, [0.06, 0.06, 2.6], [-7.2, y, -0.75], 0x9ca3af);
  }
  // Worker plank
  addBox(group, [0.5, 0.06, 2.6], [-7.2, 2.2, -0.75], 0xb45309);

  // Trash bins along the wall
  addCylinder(group, 0.32, 0.85, [-6.0, 0.425, 2.0], 0x1f2937, { segments: 14 });
  addCylinder(group, 0.32, 0.85, [-5.2, 0.425, 2.0], 0x1f2937, { segments: 14 });
  addBox(group, [0.4, 0.06, 0.4], [-6.0, 0.88, 2.0], 0x374151);
  addBox(group, [0.4, 0.06, 0.4], [-5.2, 0.88, 2.0], 0x374151);

  // Rain-slicked floor reflective accent
  addBox(group, [16, 0.012, 8], [0, 0.026, 0], 0x111827, { emissive: 0x22d3ee, emissiveIntensity: 0.15 });

  // Single distant street lamp
  addStreetLamp(group, 6, -4, 0xfde047);

  // Emergency phone box (red)
  addBox(group, [0.8, 1.6, 0.6], [6.8, 0.8, 2.4], 0xb91c1c, { emissive: 0xb91c1c, emissiveIntensity: 0.5 });
  addEmissiveBox(group, [0.6, 0.18, 0.06], [6.8, 1.5, 2.05], 0xfde047, 1.1);

  // Steam / mist particles
  addParticleField(group, 60, { x: [-8, 8], y: [0.5, 3.5], z: [-5, 4] }, 0xb6c6d6, 0.06);
}

function buildMainStreetRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: false, backWall: false });
  addBox(group, [18, 4.2, 0.4], [0, 2.1, -5.8], 0x07070d);
  // Storefronts
  for (let i = -3; i <= 3; i++) {
    addEmissiveBox(group, [1.8, 1.0, 0.06], [i * 2.4, 1.4, -5.62], i % 2 === 0 ? 0xfb923c : 0x22d3ee, 0.6);
  }
  addNeonSign(group, [-4, 3.6, -5.78], [2.4, 0.6], 0xfde047);
  addNeonSign(group, [4, 3.6, -5.78], [2.4, 0.6], 0xa855f7);

  // Road
  addBox(group, [18, 0.06, 3.6], [0, 0.05, -1.8], 0x1a1a22);
  for (let x = -7; x <= 7; x += 1.4) {
    addEmissiveBox(group, [0.7, 0.012, 0.18], [x, 0.06, -1.8], 0xfde047, 0.5);
  }
  // Sidewalk
  addBox(group, [18, 0.06, 4.4], [0, 0.05, 2.2], 0x2a2a32);

  // Lost-friend search posters on the back wall
  for (let i = -4; i <= 4; i += 4) {
    addEmissiveBox(group, [0.6, 0.8, 0.04], [i, 1.6, -5.6], 0xf8fafc, 0.5);
  }

  // Hospital sign — visible far on left
  addNeonSign(group, [-7.6, 3.0, -5.78], [1.6, 0.5], 0xef4444);

  // Street lamps
  addStreetLamp(group, -6, 1.8, 0xfde047);
  addStreetLamp(group, 6, 1.8, 0xfde047);

  // Emergency siren box on the right
  addBox(group, [0.7, 1.0, 0.4], [7.0, 0.5, 1.0], 0xb91c1c, { emissive: 0xb91c1c, emissiveIntensity: 0.4 });
  addEmissiveBox(group, [0.4, 0.16, 0.06], [7.0, 1.04, 0.82], 0xfde047, 1.0);

  addParticleField(group, 60, { x: [-8, 8], y: [0.3, 3.0], z: [-5, 4] }, 0xfde047, 0.05);
}

const ambiance: SceneAmbiance = {
  background: 0x05050a,
  fogColor: 0x0c0c16,
  fogNear: 9,
  fogFar: 26,
  hemiSky: 0x99c2ff,
  hemiGround: 0x070710,
  hemiIntensity: 0.7,
  keyColor: 0xfde047,
  keyIntensity: 1.0,
  keyPosition: [-3, 7, 5],
  rimColor: 0xef4444,
  rimIntensity: 2.6,
  rimPosition: [5, 2.6, -4.2],
};

const alleyRoom: AdventureRoom3D = {
  id: 'alley',
  title: 'Lost Alley',
  shortTitle: 'Alley',
  description:
    'Dead-end alley. Confess that you are lost, that your phone is dead, that your friend is missing.',
  palette: alleyPalette,
  patrickStart: [4.0, 0, 3.4],
  build: buildAlleyRoom,
  hotspots: [
    {
      id: 'phone-box',
      label: 'Emergency Phone',
      kind: 'prop',
      position: [6.8, 1.0, 2.4],
      standPosition: [5.4, 0, 3.0],
      ringColor: 0xef4444,
      commands: {
        use: phraseCommand(
          'use',
          'Say phone dead',
          phraseById['phone-dead'],
          'You explain — your phone died blocks ago.',
        ),
        look: phraseCommand(
          'look',
          'Ask the station',
          phraseById['where-is-station'],
          'The phone displays a map to the nearest station.',
        ),
      },
    },
    {
      id: 'scaffolding',
      label: 'Scaffold Worker',
      kind: 'prop',
      position: [-7.2, 2.2, -0.75],
      standPosition: [-5.6, 0, 0.4],
      ringColor: 0xfb923c,
      commands: {
        talk: phraseCommand(
          'talk',
          'Admit lost',
          phraseById['i-am-lost'],
          'The worker climbs down to point the way.',
        ),
        look: phraseCommand(
          'look',
          'Friend missing',
          phraseById['friend-missing'],
          'The worker offers to ring his crew.',
        ),
      },
    },
    {
      id: 'shop-sign',
      label: 'Neon Shop Sign',
      kind: 'prop',
      position: [0, 3.4, -5.78],
      standPosition: [0, 0, -3.4],
      ringColor: 0xfde047,
      commands: {
        look: phraseCommand(
          'look',
          'Ask directions',
          phraseById['go-how'],
          'The shop owner gestures left, then right.',
        ),
      },
    },
  ],
};

const mainStreetRoom: AdventureRoom3D = {
  id: 'mainStreet',
  title: 'Main Street',
  shortTitle: 'Street',
  description: 'You reach the main road. Find help fast — call for police, ask for a hospital.',
  palette: mainStreetPalette,
  patrickStart: [-5.0, 0, 3.4],
  build: buildMainStreetRoom,
  hotspots: [
    {
      id: 'rescue-guide',
      label: 'Rescue Guide',
      kind: 'person',
      position: [0, 1.45, 1.8],
      standPosition: [0, 0, 3.0],
      sprite: rescueGuideReactions.smile,
      commands: {
        talk: phraseCommand(
          'talk',
          'Please help',
          phraseById['please-help'],
          'The guide drops his pack and listens.',
        ),
        look: customPhraseCommand(
          'look',
          'I look at',
          'ผมดูคนช่วยเหลือครับ',
          'phom duu khon chuai luea khrap',
          'pom doo kohn choo-ai loo-ay khrap',
          'I look at the rescue guide.',
          'The guide is already calling someone on his radio.',
        ),
      },
    },
    {
      id: 'siren-box',
      label: 'Siren Box',
      kind: 'prop',
      position: [7.0, 1.0, 1.0],
      standPosition: [5.6, 0, 2.0],
      ringColor: 0xef4444,
      commands: {
        use: phraseCommand(
          'use',
          'Call police',
          phraseById['call-police'],
          'The guide presses the siren switch and calls in.',
        ),
      },
    },
    {
      id: 'hospital-sign',
      label: 'Hospital Sign',
      kind: 'prop',
      position: [-7.6, 3.0, -5.78],
      standPosition: [-6.0, 0, -3.0],
      ringColor: 0xef4444,
      commands: {
        look: phraseCommand(
          'look',
          'Confirm turn',
          phraseById['turn-left-right'],
          'The sign points left — the hospital is two blocks.',
        ),
        use: phraseCommand(
          'use',
          'Head to hospital',
          phraseById['need-hospital'],
          'A car pulls up to drive you. Stage clear!',
          {
            completesAdventure: true,
          },
        ),
      },
    },
  ],
};

export const stageEightAdventure: AdventureSceneConfig = {
  scenarioId: scenario.id,
  scenarioNumber: scenario.scenarioNumber,
  title: scenario.title,
  subtitle: 'Lost Alley',
  badge: `Stage ${scenario.scenarioNumber}/10 · 3D`,
  description: scenario.storyGoal,
  rooms: [alleyRoom, mainStreetRoom],
  inventoryItems: {},
  requiredInventory: [],
  ambiance,
  completionMessage: 'Stage 8 clear. Help is on the way.',
};
