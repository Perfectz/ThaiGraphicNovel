import type * as THREE from 'three';
import {
  addBox,
  addCeilingLights,
  addCylinder,
  addEmissiveBox,
  addParticleField,
  addRoomShell,
  type RoomPalette,
} from '../../components/three/sceneHelpers';
import { clinicPharmacistReactions } from '../clinicPharmacistReactions';
import { lessonScenarios } from '../lessonScenarios';
import type { AdventureRoom3D, AdventureSceneConfig, SceneAmbiance } from './types';
import { customPhraseCommand, phraseCommand } from './shared/phraseCommand';

const scenario = lessonScenarios[5]; // clinic-and-pharmacy
const phrases = scenario.chunks.flatMap((chunk) => chunk.phrases);
const phraseById = Object.fromEntries(phrases.map((p) => [p.id, p]));

const waitingPalette: RoomPalette = {
  floor: 0xe7eef5,
  wall: 0xf1f5f9,
  accent: 0x10b981,
  trim: 0x22c55e,
  glow: 0x60a5fa,
};
const counterPalette: RoomPalette = {
  floor: 0xe7eef5,
  wall: 0xf8fafc,
  accent: 0x059669,
  trim: 0x10b981,
  glow: 0x22d3ee,
};

function buildWaitingRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: true });
  addCeilingLights(group, palette, [-5, -1.5, 2, 5.5], -2.3);
  addCeilingLights(group, palette, [-5, -1.5, 2, 5.5], 1);

  // Reception sign on back wall
  addEmissiveBox(group, [4.0, 0.6, 0.06], [0, 3.6, -5.8], 0x10b981, 1.0);
  addBox(group, [4.2, 0.06, 0.08], [0, 3.27, -5.85], 0x0f766e);

  // Waiting bench row
  for (let i = 0; i < 5; i++) {
    const x = -5 + i * 2.5;
    addBox(group, [2.0, 0.5, 0.55], [x, 0.25, -3.6], 0x94a3b8);
    addBox(group, [2.0, 0.7, 0.1], [x, 0.6, -3.95], 0x94a3b8);
  }

  // Sign-in clipboard table
  addBox(group, [2.0, 0.85, 1.0], [-6.2, 0.425, 2.0], 0xe2e8f0);
  addBox(group, [2.1, 0.08, 1.1], [-6.2, 0.9, 2.0], 0xf8fafc);
  addBox(group, [0.5, 0.04, 0.4], [-6.2, 0.95, 2.0], 0xffffff);

  // Potted plant
  addCylinder(group, 0.32, 0.5, [6.4, 0.25, 2.0], 0x7c3f24, { segments: 18 });
  addCylinder(group, 0.22, 1.6, [6.4, 1.3, 2.0], 0x16a34a, { segments: 14 });
  addBox(group, [0.7, 0.22, 0.18], [6.6, 2.1, 2.0], 0x22c55e);

  // Floor wayfinding stripes
  addEmissiveBox(group, [10, 0.012, 0.18], [-3, 0.045, -1.0], 0x10b981, 0.5);
  addEmissiveBox(group, [10, 0.012, 0.18], [-3, 0.045, -0.4], 0x60a5fa, 0.5);

  // Hand sanitizer station
  addCylinder(group, 0.16, 0.7, [5.8, 0.35, -1.8], 0xf1f5f9, { segments: 16 });
  addEmissiveBox(group, [0.18, 0.06, 0.18], [5.8, 0.72, -1.8], 0x60a5fa, 0.9);
}

function buildCounterRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: true });
  addCeilingLights(group, palette, [-4.5, 0, 4.5], -2.3);

  // Pharmacy counter
  addBox(group, [9.0, 1.05, 1.4], [0, 0.525, -3.4], 0xcbd5e1);
  addBox(group, [9.2, 0.14, 1.5], [0, 1.13, -3.4], 0xe2e8f0);

  // Wall of bottle shelves behind the counter
  for (let row = 0; row < 4; row++) {
    addBox(group, [12, 0.08, 0.4], [0, 1.6 + row * 0.55, -5.7], 0xf1f5f9);
    // Bottles (small cylinders) in varying colors
    for (let i = -5.5; i <= 5.5; i += 0.55) {
      const colorChoices = [0xef4444, 0xfb923c, 0xfde047, 0x10b981, 0x60a5fa, 0xa855f7];
      const color = colorChoices[Math.floor((i + 5.5 + row) * 1.5) % colorChoices.length];
      addCylinder(group, 0.09, 0.36, [i, 1.74 + row * 0.55, -5.55], color, {
        segments: 12,
        emissive: color,
        emissiveIntensity: 0.3,
      });
    }
  }

  // Medicine sample tray on counter
  addBox(group, [1.4, 0.06, 0.6], [-2.5, 1.18, -3.0], 0xf8fafc);
  for (let i = -1; i <= 1; i++) {
    addCylinder(group, 0.08, 0.18, [-2.5 + i * 0.35, 1.27, -3.0], 0xfde047, {
      segments: 12,
      emissive: 0xfde047,
      emissiveIntensity: 0.5,
    });
  }
  // Calendar / dose card
  addEmissiveBox(group, [0.7, 0.5, 0.04], [2.4, 1.5, -3.0], 0x22d3ee, 0.6);

  // Exam bed in foreground
  addBox(group, [3.0, 0.55, 1.2], [-3.6, 0.275, 2.6], 0xe2e8f0);
  addBox(group, [3.0, 0.06, 1.2], [-3.6, 0.58, 2.6], 0xa7f3d0);
  // Pillow
  addBox(group, [0.7, 0.18, 0.7], [-4.8, 0.7, 2.6], 0xf8fafc);

  // Bottle of allergy meds prop
  addCylinder(group, 0.14, 0.4, [3.6, 0.96, 2.4], 0xef4444, {
    segments: 16,
    emissive: 0xef4444,
    emissiveIntensity: 0.5,
  });
  addBox(group, [0.4, 0.6, 0.1], [3.6, 1.4, 2.4], 0xf8fafc);

  addParticleField(group, 30, { x: [-6, 6], y: [2.5, 4.0], z: [-4, 1] }, 0xa7f3d0, 0.04);
}

const ambiance: SceneAmbiance = {
  background: 0xeaf1f6,
  fogColor: 0xc8d6df,
  fogNear: 14,
  fogFar: 36,
  hemiSky: 0xffffff,
  hemiGround: 0xc8d8de,
  hemiIntensity: 1.6,
  keyColor: 0xffffff,
  keyIntensity: 2.0,
  keyPosition: [-3, 8, 5],
  rimColor: 0x67e8f9,
  rimIntensity: 1.0,
  rimPosition: [5, 2.6, -4.2],
};

const waitingRoom: AdventureRoom3D = {
  id: 'waiting',
  title: 'Clinic Waiting Room',
  shortTitle: 'Waiting',
  description: 'Bright fluorescent calm. Sit down, sign in, and tell the receptionist what hurts.',
  palette: waitingPalette,
  patrickStart: [-5.4, 0, 3.4],
  build: buildWaitingRoom,
  hotspots: [
    {
      id: 'sign-in-table',
      label: 'Sign-in Sheet',
      kind: 'prop',
      position: [-6.2, 1.0, 2.0],
      standPosition: [-5.0, 0, 2.6],
      ringColor: 0x60a5fa,
      commands: {
        use: phraseCommand(
          'use',
          'Stomach hurts',
          phraseById['stomach-hurts'],
          'You note your stomach pain on the sheet.',
        ),
        look: phraseCommand('look', 'Headache', phraseById.headache, 'You add the headache to the form.'),
      },
    },
    {
      id: 'waiting-bench',
      label: 'Waiting Bench',
      kind: 'prop',
      position: [-2.5, 0.7, -3.95],
      standPosition: [-2.5, 0, -2.4],
      ringColor: 0x10b981,
      commands: {
        look: phraseCommand(
          'look',
          'Mention fever',
          phraseById.fever,
          'The clerk gives you a thermometer to hold.',
        ),
      },
    },
  ],
};

const counterRoom: AdventureRoom3D = {
  id: 'counter',
  title: 'Pharmacy Counter',
  shortTitle: 'Counter',
  description:
    'Shelves of color-coded bottles. Ask the pharmacist what to take, what you are allergic to, and how often.',
  palette: counterPalette,
  patrickStart: [-4.4, 0, 3.0],
  build: buildCounterRoom,
  hotspots: [
    {
      id: 'pharmacist',
      label: 'Pharmacist',
      kind: 'person',
      position: [0, 1.4, -3.2],
      standPosition: [0, 0, -1.6],
      sprite: clinicPharmacistReactions.smile,
      commands: {
        talk: phraseCommand(
          'talk',
          'Ask what medicine',
          phraseById['need-medicine'],
          'The pharmacist reaches for a green bottle.',
        ),
        look: customPhraseCommand(
          'look',
          'I look at',
          'ผมดูเภสัชกรครับ',
          'phom duu pe-sat cha-gon khrap',
          'pom doo peh-sat-cha-gawn khrap',
          'I look at the pharmacist.',
          'The pharmacist nods, ready to help.',
        ),
      },
    },
    {
      id: 'allergy-bottle',
      label: 'Red Allergy Bottle',
      kind: 'prop',
      position: [3.6, 1.16, 2.4],
      standPosition: [3.6, 0, 3.4],
      ringColor: 0xef4444,
      commands: {
        use: phraseCommand(
          'use',
          'Declare allergy',
          phraseById['have-allergy'],
          'The pharmacist crosses that medicine off your list.',
        ),
        look: phraseCommand(
          'look',
          'Ask side effects',
          phraseById['side-effects'],
          'The pharmacist lists drowsiness and mild headache.',
        ),
      },
    },
    {
      id: 'dose-card',
      label: 'Dose Card',
      kind: 'prop',
      position: [2.4, 1.5, -3.0],
      standPosition: [2.4, 0, -1.6],
      ringColor: 0x22d3ee,
      commands: {
        look: phraseCommand(
          'look',
          'Ask frequency',
          phraseById['how-many-times'],
          'The card shows three times per day.',
        ),
        use: phraseCommand(
          'use',
          'Confirm with food',
          phraseById['after-food'],
          'The pharmacist nods — yes, after meals.',
        ),
      },
    },
    {
      id: 'sample-tray',
      label: 'Sample Tray',
      kind: 'item',
      position: [-2.5, 1.27, -3.0],
      standPosition: [-2.5, 0, -1.6],
      ringColor: 0xfde047,
      commands: {
        take: phraseCommand(
          'take',
          'Take samples',
          phraseById['feel-better'],
          'You collect the samples. Stage clear!',
          {
            completesAdventure: true,
          },
        ),
      },
    },
  ],
};

export const stageSixAdventure: AdventureSceneConfig = {
  scenarioId: scenario.id,
  scenarioNumber: scenario.scenarioNumber,
  title: scenario.title,
  subtitle: 'Clinic Visit',
  badge: `Stage ${scenario.scenarioNumber}/10 · 3D`,
  description: scenario.storyGoal,
  rooms: [waitingRoom, counterRoom],
  inventoryItems: {},
  requiredInventory: [],
  ambiance,
  completionMessage: 'Stage 6 clear. The cursed mango is behind you.',
};
