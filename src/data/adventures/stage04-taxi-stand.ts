import * as THREE from 'three';
import {
  addBox,
  addCylinder,
  addEmissiveBox,
  addParticleField,
  addRoomShell,
  addSphere,
  addStreetLamp,
  type RoomPalette,
} from '../../components/three/sceneHelpers';
import { taxiDriverReactions } from '../taxiDriverReactions';
import { lessonScenarios } from '../lessonScenarios';
import type { AdventureRoom3D, AdventureSceneConfig, SceneAmbiance } from './types';
import { customPhraseCommand, phraseCommand } from './shared/phraseCommand';

const scenario = lessonScenarios[3]; // taxi-ride
const phrases = scenario.chunks.flatMap((chunk) => chunk.phrases);
const phraseById = Object.fromEntries(phrases.map((p) => [p.id, p]));

const curbPalette: RoomPalette = {
  floor: 0x1a1a22,
  wall: 0x141318,
  accent: 0x22d3ee,
  trim: 0xfde047,
  glow: 0xf97316,
};
const intersectionPalette: RoomPalette = {
  floor: 0x16161c,
  wall: 0x0d0d12,
  accent: 0xef4444,
  trim: 0xfde047,
  glow: 0x22d3ee,
};

function buildTaxi(group: THREE.Group, x: number, z: number, color: number, rotationY = 0) {
  const carGroup = new THREE.Group();
  carGroup.position.set(x, 0, z);
  carGroup.rotation.y = rotationY;
  group.add(carGroup);
  // Body
  addBox(carGroup, [2.4, 0.5, 1.1], [0, 0.55, 0], color);
  // Cabin
  addBox(carGroup, [1.2, 0.45, 1.0], [-0.1, 0.92, 0], color, { roughness: 0.4 });
  // Windows
  addBox(carGroup, [1.18, 0.35, 0.04], [-0.1, 0.92, 0.51], 0x0f172a, {
    emissive: 0x22d3ee,
    emissiveIntensity: 0.18,
  });
  addBox(carGroup, [1.18, 0.35, 0.04], [-0.1, 0.92, -0.51], 0x0f172a, {
    emissive: 0x22d3ee,
    emissiveIntensity: 0.18,
  });
  // Wheels
  [
    [-0.85, -0.6],
    [-0.85, 0.6],
    [0.85, -0.6],
    [0.85, 0.6],
  ].forEach(([wx, wz]) => {
    addCylinder(carGroup, 0.22, 0.18, [wx, 0.22, wz], 0x0b0712, { segments: 18, rotationZ: Math.PI / 2 });
  });
  // Meter on dashboard (small glowing box)
  addEmissiveBox(carGroup, [0.12, 0.08, 0.06], [-0.4, 1.05, 0.0], 0xfde047, 1.2);
  // Roof TAXI sign
  addEmissiveBox(carGroup, [0.5, 0.12, 0.22], [-0.1, 1.22, 0], 0xfde047, 1.4);
  return carGroup;
}

function buildTukTuk(group: THREE.Group, x: number, z: number, color: number) {
  const carGroup = new THREE.Group();
  carGroup.position.set(x, 0, z);
  group.add(carGroup);
  // Cabin / canopy
  addBox(carGroup, [1.6, 0.42, 1.2], [0, 0.5, 0], color);
  // Roof
  addBox(carGroup, [1.7, 0.08, 1.3], [0, 1.4, 0], 0x0b0712);
  // Roof support pillars
  [
    [-0.75, -0.55],
    [-0.75, 0.55],
    [0.75, -0.55],
    [0.75, 0.55],
  ].forEach(([px, pz]) => {
    addBox(carGroup, [0.05, 0.95, 0.05], [px, 0.9, pz], 0x111827);
  });
  // Front fairing
  addBox(carGroup, [0.5, 0.55, 1.0], [0.9, 0.45, 0], color);
  addCylinder(carGroup, 0.18, 0.18, [1.25, 0.45, 0], 0x111827, { segments: 16 });
  // Wheels (rear pair + front single)
  [
    [-0.65, -0.65],
    [-0.65, 0.65],
  ].forEach(([wx, wz]) => {
    addCylinder(carGroup, 0.2, 0.16, [wx, 0.2, wz], 0x0b0712, { segments: 18, rotationZ: Math.PI / 2 });
  });
  addCylinder(carGroup, 0.2, 0.16, [1.15, 0.2, 0], 0x0b0712, { segments: 18, rotationZ: Math.PI / 2 });
  // Glow strip
  addEmissiveBox(carGroup, [1.4, 0.04, 0.06], [0, 1.32, 0.65], 0xa855f7, 1.0);
}

function buildCurbRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: false, backWall: false });
  // Replace back wall with a low building silhouette + sky
  addBox(group, [18, 4.2, 0.4], [0, 2.1, -5.8], 0x0a0a13);
  // Storefront glow row
  addEmissiveBox(group, [16, 0.4, 0.06], [0, 1.6, -5.6], 0xfb923c, 1.0);
  for (let x = -7; x <= 7; x += 2) {
    addEmissiveBox(group, [1.4, 0.7, 0.06], [x, 2.6, -5.62], 0x22d3ee, 0.7);
  }

  // Sidewalk strip
  addBox(group, [18, 0.06, 2.6], [0, 0.05, 2.2], 0x2a2a32);
  // Curb edge
  addBox(group, [18, 0.16, 0.18], [0, 0.13, 0.9], 0x52525b);
  // Road markings (yellow dashes)
  for (let x = -7; x <= 7; x += 1.4) {
    addEmissiveBox(group, [0.7, 0.012, 0.18], [x, 0.05, -1.6], 0xfde047, 0.5);
  }

  // A parked taxi
  buildTaxi(group, -1.2, -2.4, 0xf97316, 0);

  // Street lamp anchors
  addStreetLamp(group, -7, 1.8, 0xfde047);
  addStreetLamp(group, 7, 1.8, 0xfde047);

  // Phone booth / call stand (small)
  addBox(group, [0.7, 1.4, 0.7], [6.4, 0.7, 2.4], 0x0e7490, { emissive: 0x0e7490, emissiveIntensity: 0.3 });
  addEmissiveBox(group, [0.6, 0.12, 0.6], [6.4, 1.35, 2.4], 0xfde047, 0.9);

  // Light haze particles
  addParticleField(group, 50, { x: [-8, 8], y: [0.3, 3.0], z: [-5, 4] }, 0xfde047, 0.05);
}

function buildIntersectionRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: false, backWall: false });
  addBox(group, [18, 4.2, 0.4], [0, 2.1, -5.8], 0x070710);

  // Traffic light pole
  addCylinder(group, 0.1, 4.0, [-5, 2.0, -3.6], 0x111827);
  addBox(group, [0.4, 1.0, 0.4], [-5, 4.0, -3.6], 0x111827);
  addSphere(group, 0.16, [-5, 4.4, -3.6], 0xef4444, { emissive: 0xef4444, emissiveIntensity: 1.2 });
  addSphere(group, 0.16, [-5, 4.0, -3.6], 0xfde047, { emissive: 0xfde047, emissiveIntensity: 0.4 });
  addSphere(group, 0.16, [-5, 3.6, -3.6], 0x10b981, { emissive: 0x10b981, emissiveIntensity: 0.4 });

  // Crosswalk stripes
  for (let z = -1.5; z <= 1.5; z += 0.6) {
    addEmissiveBox(group, [1.6, 0.012, 0.36], [-2.0, 0.05, z], 0xf8fafc, 0.55);
  }

  // Tuk-tuk waiting
  buildTukTuk(group, 2.4, -2.6, 0x9333ea);
  buildTukTuk(group, 4.6, -2.6, 0x059669);

  // Street vendor cart (small)
  addBox(group, [1.2, 0.7, 0.8], [-6.2, 0.35, 1.6], 0x4a1c2b);
  addBox(group, [1.4, 0.06, 1.0], [-6.2, 0.73, 1.6], 0xfde047);
  addEmissiveBox(group, [0.06, 0.4, 0.06], [-6.2, 1.0, 1.6], 0xfb7185, 1.0);

  addStreetLamp(group, -7, 1.8, 0xfde047);
  addStreetLamp(group, 7, 1.8, 0xfde047);

  // Distant traffic lights as emissive dots
  for (let x = -6; x <= 6; x += 2) {
    addEmissiveBox(group, [0.16, 0.16, 0.06], [x, 2.4, -5.7], x % 4 === 0 ? 0xef4444 : 0xfde047, 0.9);
  }

  addParticleField(group, 50, { x: [-8, 8], y: [0.3, 3.0], z: [-5, 4] }, 0xa855f7, 0.05);
}

const ambiance: SceneAmbiance = {
  background: 0x07070d,
  fogColor: 0x10101a,
  fogNear: 10,
  fogFar: 30,
  hemiSky: 0x99c2ff,
  hemiGround: 0x0a0a14,
  hemiIntensity: 0.85,
  keyColor: 0xfde047,
  keyIntensity: 1.4,
  keyPosition: [-3, 7, 5],
  rimColor: 0xa855f7,
  rimIntensity: 2.2,
  rimPosition: [5, 2.6, -4.2],
};

const curbRoom: AdventureRoom3D = {
  id: 'curb',
  title: 'Taxi Curb',
  shortTitle: 'Curb',
  description: 'A neon-soaked sidewalk. Hail the cab, name your destination, ask about the meter.',
  palette: curbPalette,
  patrickStart: [4.0, 0, 3.4],
  build: buildCurbRoom,
  hotspots: [
    {
      id: 'taxi-driver',
      label: 'Taxi Driver',
      kind: 'person',
      position: [-1.2, 1.45, -1.6],
      standPosition: [-1.2, 0, 0.6],
      sprite: taxiDriverReactions.smile,
      commands: {
        talk: phraseCommand(
          'talk',
          'Hail the cab',
          phraseById['go-to-shrine'],
          'The driver checks his side mirror and waves you in.',
        ),
        look: customPhraseCommand(
          'look',
          'I look at',
          'ผมดูคนขับรถครับ',
          'phom duu khon khap rot khrap',
          'pom doo kohn kap rot khrap',
          'I look at the taxi driver.',
          'The driver gives a tired but friendly nod.',
        ),
      },
    },
    {
      id: 'taxi-meter',
      label: 'Taxi Meter',
      kind: 'prop',
      position: [-1.6, 1.25, -1.6],
      standPosition: [-1.6, 0, 0.4],
      ringColor: 0xfde047,
      commands: {
        use: phraseCommand(
          'use',
          'Ask for meter',
          phraseById['use-meter'],
          'The driver clicks the meter on with a flick.',
        ),
      },
    },
    {
      id: 'destination-question',
      label: 'Hotel Destination',
      kind: 'prop',
      position: [-3.8, 0.6, 2.1],
      standPosition: [-3.8, 0, 3.2],
      ringColor: 0x67e8f9,
      commands: {
        talk: phraseCommand(
          'talk',
          'Switch to hotel',
          phraseById['go-hotel'],
          'The driver nods and updates the route.',
        ),
        look: phraseCommand(
          'look',
          'Ask if nearby',
          phraseById['near-here'],
          'The driver pinches his fingers — close enough.',
        ),
      },
    },
    {
      id: 'phone-stand',
      label: 'Call Stand',
      kind: 'prop',
      position: [6.4, 1.35, 2.4],
      standPosition: [5.4, 0, 3.0],
      ringColor: 0xfb923c,
      commands: {
        look: phraseCommand(
          'look',
          'Ask the fare',
          phraseById['how-much-to-go'],
          'A posted card lists the basic fare.',
        ),
        use: phraseCommand(
          'use',
          'Negotiate price',
          phraseById['too-expensive'],
          'The driver shrugs and drops the price.',
        ),
      },
    },
  ],
};

const intersectionRoom: AdventureRoom3D = {
  id: 'intersection',
  title: 'Intersection',
  shortTitle: 'Junction',
  description: 'Tuk-tuks idle at the crosswalk. Check traffic, ask the trip time, then mark where to stop.',
  palette: intersectionPalette,
  patrickStart: [-4.0, 0, 3.4],
  build: buildIntersectionRoom,
  hotspots: [
    {
      id: 'traffic-light',
      label: 'Traffic Light',
      kind: 'prop',
      position: [-5, 3.8, -3.6],
      standPosition: [-3.6, 0, -1.8],
      ringColor: 0xef4444,
      commands: {
        look: phraseCommand(
          'look',
          'Ask about traffic',
          phraseById['traffic-heavy'],
          'The driver checks his mirrors and nods — it is heavy.',
        ),
      },
    },
    {
      id: 'tuk-tuk',
      label: 'Tuk-Tuk',
      kind: 'person',
      position: [2.4, 1.4, -2.6],
      standPosition: [2.4, 0, -0.4],
      sprite: taxiDriverReactions.explaining,
      commands: {
        talk: phraseCommand(
          'talk',
          'Ask travel time',
          phraseById['how-long'],
          'The tuk-tuk driver holds up three fingers — three songs.',
        ),
      },
    },
    {
      id: 'crosswalk-marker',
      label: 'Crosswalk Marker',
      kind: 'prop',
      position: [-2.0, 0.05, 0.6],
      standPosition: [-2.0, 0, 1.6],
      ringColor: 0xfde047,
      commands: {
        use: phraseCommand(
          'use',
          'Tell driver to stop',
          phraseById['stop-here'],
          'The tuk-tuk pulls over. Stage complete!',
          {
            completesAdventure: true,
          },
        ),
      },
    },
  ],
};

export const stageFourAdventure: AdventureSceneConfig = {
  scenarioId: scenario.id,
  scenarioNumber: scenario.scenarioNumber,
  title: scenario.title,
  subtitle: 'Cross Bangkok',
  badge: `Stage ${scenario.scenarioNumber}/10 · 3D`,
  description: scenario.storyGoal,
  rooms: [curbRoom, intersectionRoom],
  inventoryItems: {},
  requiredInventory: [],
  ambiance,
  completionMessage: 'Stage 4 clear. The shrine is in sight.',
};
