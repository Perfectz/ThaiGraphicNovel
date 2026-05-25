import type * as THREE from 'three';
import {
  addBox,
  addCylinder,
  addEmissiveBox,
  addHangingLantern,
  addParticleField,
  addRiftPortal,
  addRoomShell,
  addSphere,
  type RoomPalette,
} from '../../components/three/sceneHelpers';
import { riftGuardianReactions } from '../riftGuardianReactions';
import { suReactions } from '../suReactions';
import { lessonScenarios } from '../lessonScenarios';
import type { AdventureRoom3D, AdventureSceneConfig, SceneAmbiance } from './types';
import { customPhraseCommand, phraseCommand } from './shared/phraseCommand';

const scenario = lessonScenarios[9]; // rift-negotiation
const phrases = scenario.chunks.flatMap((chunk) => chunk.phrases);
const phraseById = Object.fromEntries(phrases.map((p) => [p.id, p]));

const courtyardPalette: RoomPalette = {
  floor: 0x3a1f2e,
  wall: 0x2a1424,
  accent: 0xfacc15,
  trim: 0xfb7185,
  glow: 0xa855f7,
};
const gatePalette: RoomPalette = {
  floor: 0x2a1424,
  wall: 0x1a0c1a,
  accent: 0xa855f7,
  trim: 0xfacc15,
  glow: 0xa855f7,
};

function addStoneColumn(group: THREE.Group, x: number, z: number, height = 4.0) {
  addCylinder(group, 0.4, height, [x, height / 2, z], 0xd6cdb7, { segments: 22 });
  addCylinder(group, 0.55, 0.2, [x, 0.1, z], 0xa8a193, { segments: 22 });
  addCylinder(group, 0.55, 0.2, [x, height - 0.1, z], 0xa8a193, { segments: 22 });
  addBox(group, [1.0, 0.16, 1.0], [x, height + 0.08, z], 0xfacc15, {
    emissive: 0xfacc15,
    emissiveIntensity: 0.3,
  });
}

function addCandleRow(group: THREE.Group, xs: number[], y: number, z: number, color = 0xfde68a) {
  xs.forEach((x) => {
    addCylinder(group, 0.06, 0.2, [x, y + 0.1, z], 0xfde68a, { segments: 12 });
    addSphere(group, 0.08, [x, y + 0.28, z], color, { emissive: color, emissiveIntensity: 1.6 });
  });
}

function buildCourtyardRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: false });
  // Replace back wall with temple gate base (silhouette of a Thai chedi)
  addBox(group, [18, 5, 0.18], [0, 2.5, -6], 0x1a0c1a);
  // Temple silhouette tiers
  addBox(group, [10, 0.6, 0.3], [0, 0.5, -5.8], 0x3a1f2e);
  addBox(group, [8, 0.6, 0.3], [0, 1.1, -5.8], 0x3a1f2e);
  addBox(group, [6, 0.6, 0.3], [0, 1.7, -5.8], 0x3a1f2e);
  addBox(group, [4, 0.6, 0.3], [0, 2.3, -5.8], 0x3a1f2e);
  // Spire
  addCylinder(group, 0.2, 1.8, [0, 3.4, -5.8], 0xfacc15, {
    segments: 16,
    emissive: 0xfacc15,
    emissiveIntensity: 0.4,
  });
  addCylinder(group, 0.06, 0.6, [0, 4.6, -5.8], 0xfacc15, {
    segments: 12,
    emissive: 0xfacc15,
    emissiveIntensity: 0.8,
  });

  // Stone columns flanking the path
  addStoneColumn(group, -4.5, -1.5);
  addStoneColumn(group, 4.5, -1.5);
  addStoneColumn(group, -7, 1.5);
  addStoneColumn(group, 7, 1.5);

  // Path of stones leading to the gate
  for (let z = -4.5; z <= 4.5; z += 1.5) {
    addBox(group, [2.0, 0.05, 1.2], [0, 0.025, z], 0xa8a193);
  }

  // Naga staircase rails (low cylinder serpent bodies on either side of the path)
  for (let z = -4.5; z <= 4.5; z += 1.0) {
    const wave = Math.sin(z * 1.6) * 0.08;
    addCylinder(group, 0.18, 0.7, [-1.4 + wave, 0.35, z], 0x16a34a, { segments: 14 });
    addCylinder(group, 0.18, 0.7, [1.4 - wave, 0.35, z], 0x16a34a, { segments: 14 });
  }
  // Naga heads at the entrance
  addSphere(group, 0.34, [-1.4, 0.85, 4.6], 0x10b981, { emissive: 0x10b981, emissiveIntensity: 0.5 });
  addSphere(group, 0.34, [1.4, 0.85, 4.6], 0x10b981, { emissive: 0x10b981, emissiveIntensity: 0.5 });

  // Candle rows along the path
  addCandleRow(group, [-3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6], 0.0, -3.8);
  addCandleRow(group, [-3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6], 0.0, 3.6, 0xfb7185);

  // Hanging lanterns along the side
  [-6, 6].forEach((x) => {
    addHangingLantern(group, x, 3.6, -3, 0xfacc15);
    addHangingLantern(group, x, 3.6, 0, 0xfacc15);
    addHangingLantern(group, x, 3.6, 3, 0xfacc15);
  });

  // Atmosphere — incense smoke
  addParticleField(group, 80, { x: [-7, 7], y: [0.5, 4.0], z: [-5, 4] }, 0xfde68a, 0.06);
}

function buildGateRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: false, backWall: false });
  // Replace back wall with a tall gateway frame
  addBox(group, [18, 0.4, 0.6], [0, 5.0, -5.8], 0x2a0c2a);
  addBox(group, [1.2, 5.4, 0.6], [-4.5, 2.7, -5.8], 0x2a0c2a);
  addBox(group, [1.2, 5.4, 0.6], [4.5, 2.7, -5.8], 0x2a0c2a);

  // Massive rift portal centered in the gate
  const portal = addRiftPortal(group, [0, 2.7, -5.4], 2.4);
  // Tag for animation in Stage3DAdventure's anim loop
  portal.ring.userData.spin = 0.6;
  portal.disk.userData.spin = -0.4;

  // Concentric rift rings (decorative)
  for (let i = 0; i < 4; i++) {
    addCylinder(group, 2.6 + i * 0.4, 0.04, [0, 2.7, -5.6 - i * 0.05], 0xa855f7, {
      segments: 36,
      emissive: 0xa855f7,
      emissiveIntensity: 0.8 - i * 0.15,
      rotationZ: Math.PI / 2,
    });
  }

  // Stone steps leading up to the gate
  for (let i = 0; i < 3; i++) {
    addBox(group, [10 - i * 1.4, 0.3, 1.2 - i * 0.2], [0, 0.15 + i * 0.3, -3.0 + i * 0.6], 0xa8a193);
  }

  // Floor cracks emitting purple light
  addEmissiveBox(group, [0.12, 0.012, 10], [-2.6, 0.05, 0], 0xa855f7, 1.0);
  addEmissiveBox(group, [0.12, 0.012, 10], [2.6, 0.05, 0], 0xa855f7, 1.0);
  addEmissiveBox(group, [10, 0.012, 0.12], [0, 0.05, -1], 0xa855f7, 0.8);

  // Floating debris (small boxes that bob)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dx = Math.cos(angle) * 3.4;
    const dy = 1.8 + Math.sin(angle) * 0.6;
    const dz = -4.0 + Math.sin(angle) * 1.0;
    addBox(group, [0.22, 0.22, 0.22], [dx, dy, dz], 0xc084fc, { emissive: 0xc084fc, emissiveIntensity: 0.9 });
  }

  // Stone guardian statues on either side
  addBox(group, [1.2, 2.4, 1.2], [-6.0, 1.2, -3.6], 0xa8a193);
  addSphere(group, 0.6, [-6.0, 2.7, -3.6], 0xa8a193);
  addBox(group, [1.2, 2.4, 1.2], [6.0, 1.2, -3.6], 0xa8a193);
  addSphere(group, 0.6, [6.0, 2.7, -3.6], 0xa8a193);

  // Wind / rift particles
  addParticleField(group, 140, { x: [-7, 7], y: [0.5, 4.5], z: [-5, 4] }, 0xa855f7, 0.07);
  addParticleField(group, 80, { x: [-4, 4], y: [1.5, 4.0], z: [-5.5, -3] }, 0xc084fc, 0.05);
}

const ambiance: SceneAmbiance = {
  background: 0x140820,
  fogColor: 0x1c0d2e,
  fogNear: 8,
  fogFar: 26,
  hemiSky: 0xc4b5fd,
  hemiGround: 0x1c0a30,
  hemiIntensity: 0.95,
  keyColor: 0xfde68a,
  keyIntensity: 1.4,
  keyPosition: [-3, 8, 6],
  rimColor: 0xa855f7,
  rimIntensity: 3.0,
  rimPosition: [0, 3.4, -5.0],
};

const courtyardRoom: AdventureRoom3D = {
  id: 'courtyard',
  title: 'Temple Courtyard',
  shortTitle: 'Courtyard',
  description:
    'Incense, candles, and the gate at the end of the path. Approach calmly — the guardian is listening.',
  palette: courtyardPalette,
  patrickStart: [0, 0, 4.8],
  build: buildCourtyardRoom,
  hotspots: [
    {
      id: 'rift-guardian',
      label: 'Rift Guardian',
      kind: 'person',
      position: [0, 1.6, -2.6],
      standPosition: [0, 0, -0.8],
      sprite: riftGuardianReactions.smile,
      spriteScale: [2.4, 3.4],
      commands: {
        talk: phraseCommand(
          'talk',
          'Please calm down',
          phraseById['please-calm'],
          'The guardian pauses, fists unclench slightly.',
        ),
        look: customPhraseCommand(
          'look',
          'I look at',
          'ผมดูผู้พิทักษ์รอยแยกครับ',
          'phom duu phu phi tak roi yaek khrap',
          'pom doo poo pee-tak roy yaek khrap',
          'I look at the rift guardian.',
          'The guardian shimmers with violet energy.',
        ),
      },
    },
    {
      id: 'naga-head-left',
      label: 'Naga Head',
      kind: 'prop',
      position: [-1.4, 0.85, 4.6],
      standPosition: [-1.4, 0, 3.4],
      ringColor: 0x10b981,
      commands: {
        look: phraseCommand(
          'look',
          'Can we talk?',
          phraseById['can-talk'],
          'The naga tilts toward you, listening.',
        ),
      },
    },
    {
      id: 'candle-row',
      label: 'Candle Row',
      kind: 'prop',
      position: [0, 0.3, 3.6],
      standPosition: [0, 0, 2.2],
      ringColor: 0xfb7185,
      commands: {
        use: phraseCommand(
          'use',
          'Want peace',
          phraseById['want-peace'],
          'The candles flare gently in agreement.',
        ),
      },
    },
    {
      id: 'su-companion',
      label: 'Su',
      kind: 'person',
      position: [3.25, 0, 2.2],
      standPosition: [2.55, 0, 3.45],
      model: { id: 'su', animation: 'wave', height: 1.72 },
      sprite: suReactions.smile,
      commands: {
        talk: phraseCommand(
          'talk',
          'She needs help',
          phraseById['she-needs-help'],
          'Su clutches her staff, listening to your defense.',
        ),
        look: phraseCommand(
          'look',
          'Protect her',
          phraseById['protect-her'],
          'You step between Su and the guardian.',
        ),
      },
    },
  ],
};

const gateRoom: AdventureRoom3D = {
  id: 'gate',
  title: 'Rift Gate',
  shortTitle: 'Gate',
  description:
    'The portal pulses violet. Trust Su, ask for the gate to open, and promise you will not forget.',
  palette: gatePalette,
  patrickStart: [0, 0, 4.0],
  build: buildGateRoom,
  hotspots: [
    {
      id: 'rift-portal',
      label: 'Rift Portal',
      kind: 'prop',
      position: [0, 2.7, -5.4],
      standPosition: [0, 0, -1.5],
      ringColor: 0xa855f7,
      spriteScale: [2.0, 2.0],
      commands: {
        look: phraseCommand(
          'look',
          'Trust me',
          phraseById['trust-me'],
          'The portal recognizes your sincerity.',
        ),
        use: phraseCommand(
          'use',
          'Please open gate',
          phraseById['please-open-gate'],
          'The gate cracks open.',
          {
            requiresItems: [],
          },
        ),
      },
    },
    {
      id: 'guardian-statue-left',
      label: 'Stone Guardian',
      kind: 'prop',
      position: [-6.0, 2.0, -3.6],
      standPosition: [-4.6, 0, -2.0],
      ringColor: 0xfacc15,
      commands: {
        talk: phraseCommand(
          'talk',
          'Sorry for trouble',
          phraseById['sorry-for-trouble'],
          'The statue hums acknowledgment.',
        ),
      },
    },
    {
      id: 'guardian-statue-right',
      label: 'Stone Guardian',
      kind: 'prop',
      position: [6.0, 2.0, -3.6],
      standPosition: [4.6, 0, -2.0],
      ringColor: 0xfacc15,
      commands: {
        talk: phraseCommand(
          'talk',
          'I will not forget',
          phraseById['will-not-forget'],
          'The rift closes around you. Stage clear. Game complete!',
          {
            completesAdventure: true,
          },
        ),
      },
    },
  ],
};

export const stageTenAdventure: AdventureSceneConfig = {
  scenarioId: scenario.id,
  scenarioNumber: scenario.scenarioNumber,
  title: scenario.title,
  subtitle: 'Rift Gate Finale',
  badge: `Stage ${scenario.scenarioNumber}/10 · 3D · FINAL`,
  description: scenario.storyGoal,
  rooms: [courtyardRoom, gateRoom],
  inventoryItems: {},
  requiredInventory: [],
  ambiance,
  completionMessage: 'The rift closes. The journey is complete.',
};
