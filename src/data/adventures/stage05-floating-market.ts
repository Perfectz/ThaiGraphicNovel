import * as THREE from 'three';
import {
  addBox,
  addCylinder,
  addEmissiveBox,
  addFoliage,
  addHangingLantern,
  addLanternStringBetween,
  addParticleField,
  addPlane,
  addRoomShell,
  type RoomPalette,
} from '../../components/three/sceneHelpers';
import { makeWoodFloorMaterial } from '../../components/three/proceduralTextures';
import { charmShopVendorReactions } from '../charmShopVendorReactions';
import { lessonScenarios } from '../lessonScenarios';
import type { AdventureRoom3D, AdventureSceneConfig, SceneAmbiance } from './types';
import { customPhraseCommand, phraseCommand } from './shared/phraseCommand';

const scenario = lessonScenarios[4]; // market-bargain
const phrases = scenario.chunks.flatMap((chunk) => chunk.phrases);
const phraseById = Object.fromEntries(phrases.map((p) => [p.id, p]));

const dockPalette: RoomPalette = {
  floor: 0x6b3f1b,
  wall: 0x4a2812,
  accent: 0xfacc15,
  trim: 0xfb7185,
  glow: 0x22d3ee,
};
const charmShopPalette: RoomPalette = {
  floor: 0x6b3f1b,
  wall: 0x4a2812,
  accent: 0xfb7185,
  trim: 0xfacc15,
  glow: 0xa855f7,
};

// Flat warm glow pool on the water surface — fakes a lantern reflection.
function addReflection(group: THREE.Group, x: number, z: number, radius: number, color: number) {
  const geo = new THREE.CircleGeometry(radius, 24);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, -0.01, z);
  group.add(m);
}

function buildSilkStrip(group: THREE.Group, x: number, z: number, height: number, color: number) {
  addBox(group, [0.4, height, 0.04], [x, 1.4 + height / 2, z], color, {
    emissive: color,
    emissiveIntensity: 0.25,
  });
}

function buildDockRoom(group: THREE.Group, palette: RoomPalette) {
  // Custom shell — wood plank floor, no walls (open to water)
  addBox(group, [18, 0.1, 6], [0, -0.05, -2.5], palette.floor);
  // Plank lines
  for (let x = -8; x <= 8; x += 1.0) {
    addBox(group, [0.04, 0.012, 5.7], [x, 0.018, -2.5], 0x3a2008);
  }
  // Back row of stilted shops (low silhouettes)
  for (let i = 0; i < 4; i++) {
    const x = -6 + i * 4;
    addBox(group, [3.0, 1.6, 1.2], [x, 0.8, -5.0], 0x6b3f1b);
    addBox(group, [3.2, 0.6, 1.4], [x, 2.1, -5.0], palette.accent);
    addBox(group, [3.2, 0.16, 1.5], [x, 1.8, -5.0], 0x7c2d12);
  }

  // Water plane in front (south of the dock)
  addPlane(group, [22, 14], [0, -0.02, 4], 0x0c4a6e, {
    emissive: 0x164e63,
    emissiveIntensity: 0.6,
    opacity: 0.92,
  });
  // Water shimmer dots
  addParticleField(group, 90, { x: [-9, 9], y: [0.02, 0.04], z: [1, 8] }, 0x67e8f9, 0.08);

  // Awning over the dock
  addBox(group, [16, 0.14, 4], [0, 3.6, -2.5], palette.glow, {
    emissive: palette.glow,
    emissiveIntensity: 0.4,
  });
  // Awning posts
  [-7, -3.5, 0, 3.5, 7].forEach((x) => {
    addCylinder(group, 0.08, 3.6, [x, 1.8, -0.6], 0x3a2008);
  });

  // Hanging silk strips (different colors)
  buildSilkStrip(group, -5.5, -1.0, 1.6, 0xfb7185);
  buildSilkStrip(group, -4.5, -1.0, 1.4, 0xa855f7);
  buildSilkStrip(group, -3.5, -1.0, 1.8, 0x22d3ee);
  buildSilkStrip(group, -2.5, -1.0, 1.5, 0xfacc15);
  buildSilkStrip(group, 2.5, -1.0, 1.7, 0x10b981);
  buildSilkStrip(group, 3.5, -1.0, 1.4, 0xfb7185);
  buildSilkStrip(group, 4.5, -1.0, 1.6, 0xa855f7);

  // Boats moored to the dock (in the water)
  addBox(group, [3.2, 0.4, 1.0], [-4.5, 0.15, 2.8], 0x7c3f24);
  addBox(group, [3.2, 0.4, 1.0], [4.5, 0.15, 2.8], 0x7c3f24);
  // Boat baskets full of charms
  [-4.5, 4.5].forEach((bx) => {
    addCylinder(group, 0.35, 0.32, [bx - 0.6, 0.5, 2.8], 0x713f12, { segments: 18 });
    addCylinder(group, 0.35, 0.32, [bx + 0.6, 0.5, 2.8], 0x713f12, { segments: 18 });
    addEmissiveBox(group, [0.3, 0.04, 0.3], [bx - 0.6, 0.65, 2.8], 0xfacc15, 0.5);
    addEmissiveBox(group, [0.3, 0.04, 0.3], [bx + 0.6, 0.65, 2.8], 0xfb7185, 0.5);
  });

  // Lanterns along the awning
  for (let i = 0; i < 5; i++) {
    const x = -6 + i * 3;
    addHangingLantern(group, x, 2.8, -2.0, i % 2 === 0 ? 0xfacc15 : 0xfb7185);
    // Faint reflection of the awning lantern shimmering on the river
    addReflection(group, x, 4.0, 1.3, i % 2 === 0 ? 0xfacc15 : 0xfb7185);
  }

  // Extra lanterns strung out over the open water (signature beat)
  addLanternStringBetween(group, -8, 8, 5.5, 3.4, 7, 0xfbbf24);
  addHangingLantern(group, -6, 3.0, 2.8, 0xfb7185);
  addHangingLantern(group, 0, 3.0, 3.4, 0xfacc15);
  addHangingLantern(group, 6, 3.0, 2.8, 0xa855f7);

  // Warm lantern reflection pools dancing on the river surface
  const reflections: Array<[number, number, number, number]> = [
    [-6, 5.5, 1.5, 0xfbbf24],
    [-3, 6.4, 1.2, 0xfb7185],
    [0, 5.6, 1.6, 0xfacc15],
    [3, 6.6, 1.2, 0xfbbf24],
    [6, 5.5, 1.5, 0xa855f7],
    [-4.5, 3.0, 0.9, 0xfacc15],
    [4.5, 3.0, 0.9, 0xfb7185],
  ];
  reflections.forEach(([x, z, r, c]) => addReflection(group, x, z, r, c));

  // Foliage clusters on the dock for density (no colliders, off the walk paths)
  addFoliage(group, -8.0, -1.6, 0.9);
  addFoliage(group, -7.4, -3.6, 1.1);
  addFoliage(group, 8.0, -1.6, 0.9);
  addFoliage(group, 7.4, -3.6, 1.1);
  addFoliage(group, -0.5, -4.6, 0.8);
}

function buildCharmShopRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: false, floorMaterial: makeWoodFloorMaterial(4, 5) });
  // Replace back wall with shelf-of-charms
  addBox(group, [18, 5, 0.18], [0, 2.5, -6], 0x4a2812);
  // Shelves
  for (let row = 0; row < 4; row++) {
    addBox(group, [12, 0.08, 0.42], [0, 0.7 + row * 0.8, -5.7], 0x7c2d12);
    // Charms on each shelf
    for (let i = -5; i <= 5; i += 1.0) {
      const colorChoices = [0xfacc15, 0xfb7185, 0xa855f7, 0x22d3ee, 0x10b981, 0xef4444];
      const color = colorChoices[(i + 5 + row) % colorChoices.length];
      addCylinder(group, 0.08, 0.28, [i, 0.78 + row * 0.8 + 0.14, -5.55], color, {
        segments: 12,
        emissive: color,
        emissiveIntensity: 0.5,
      });
    }
  }

  // Counter at front
  addBox(group, [6, 1.0, 1.4], [0, 0.5, -2.8], 0x4a2812);
  addBox(group, [6.2, 0.14, 1.5], [0, 1.07, -2.8], palette.accent);
  // Hero items (special charms) on the counter
  addCylinder(group, 0.16, 0.32, [-1.6, 1.3, -2.8], 0xa855f7, {
    segments: 18,
    emissive: 0xa855f7,
    emissiveIntensity: 0.7,
  });
  addCylinder(group, 0.16, 0.32, [0, 1.3, -2.8], 0xfacc15, {
    segments: 18,
    emissive: 0xfacc15,
    emissiveIntensity: 0.7,
  });
  addCylinder(group, 0.16, 0.32, [1.6, 1.3, -2.8], 0x22d3ee, {
    segments: 18,
    emissive: 0x22d3ee,
    emissiveIntensity: 0.7,
  });

  // Price tag (small glowing card)
  addEmissiveBox(group, [0.4, 0.22, 0.04], [-2.6, 1.36, -2.5], 0xfde68a, 0.8);

  // Silk drapery sides
  addBox(group, [0.16, 3.2, 2], [-8.6, 2.0, -3.0], 0xa855f7, { emissive: 0xa855f7, emissiveIntensity: 0.25 });
  addBox(group, [0.16, 3.2, 2], [8.6, 2.0, -3.0], 0xfb7185, { emissive: 0xfb7185, emissiveIntensity: 0.25 });

  // Floor rug with golden weave
  addBox(group, [4, 0.02, 2.4], [0, 0.04, 1.6], 0x7f1d1d, { emissive: 0x7f1d1d, emissiveIntensity: 0.2 });
  addBox(group, [3.5, 0.018, 2.0], [0, 0.05, 1.6], 0xfacc15, { emissive: 0xfacc15, emissiveIntensity: 0.18 });

  addParticleField(group, 30, { x: [-7, 7], y: [0.5, 3.0], z: [-4, 1] }, 0xfde68a, 0.05);
}

const ambiance: SceneAmbiance = {
  background: 0x081827,
  fogColor: 0x0c2436,
  fogNear: 8,
  fogFar: 28,
  hemiSky: 0xffe9c4,
  hemiGround: 0x0e3a4b,
  hemiIntensity: 1.2,
  keyColor: 0xfde047,
  keyIntensity: 1.4,
  keyPosition: [-3, 8, 6],
  rimColor: 0xfb7185,
  rimIntensity: 2.0,
  rimPosition: [5, 2.6, -4.2],
};

const dockRoom: AdventureRoom3D = {
  id: 'dock',
  title: 'Floating Market Dock',
  shortTitle: 'Dock',
  description: 'Wooden planks creak above the river. Browse the boat stalls, ask about colors and materials.',
  palette: dockPalette,
  patrickStart: [-5.4, 0, -0.4],
  build: buildDockRoom,
  hotspots: [
    {
      id: 'silk-strips',
      label: 'Silk Strips',
      kind: 'prop',
      position: [-3.5, 2.4, -1.0],
      standPosition: [-3.5, 0, 0.4],
      ringColor: 0xa855f7,
      commands: {
        look: phraseCommand(
          'look',
          'Ask to see',
          phraseById['can-see'],
          'The vendor lifts a strip down for you to feel.',
        ),
        use: phraseCommand(
          'use',
          'Ask material',
          phraseById['what-material'],
          'The vendor says it is hand-dyed silk.',
        ),
      },
    },
    {
      id: 'charm-boat',
      label: 'Charm Boat',
      kind: 'prop',
      position: [4.5, 0.65, 2.8],
      standPosition: [4.5, 0, 1.5],
      ringColor: 0xfacc15,
      commands: {
        look: phraseCommand(
          'look',
          'Ask color choice',
          phraseById['has-color'],
          'The vendor opens a basket of mixed colors.',
        ),
      },
    },
  ],
};

const charmShopRoom: AdventureRoom3D = {
  id: 'charmShop',
  title: 'Charm Shop',
  shortTitle: 'Shop',
  description: 'The vendor stands behind a hero counter of glowing charms. Bargain for the silk vest.',
  palette: charmShopPalette,
  patrickStart: [-4.6, 0, 3.4],
  build: buildCharmShopRoom,
  hotspots: [
    {
      id: 'charm-vendor',
      label: 'Charm Vendor',
      kind: 'person',
      position: [0, 1.4, -2.8],
      standPosition: [0, 0, -0.6],
      sprite: charmShopVendorReactions.smile,
      commands: {
        talk: phraseCommand(
          'talk',
          'Bargain politely',
          phraseById.discount,
          'The vendor tilts her head — she will think about it.',
        ),
        look: customPhraseCommand(
          'look',
          'I look at',
          'ผมดูเจ้าของร้านครับ',
          'phom duu jao khong raan khrap',
          'pom doo jao kong rahn khrap',
          'I look at the shopkeeper.',
          'She smiles warmly and gestures to her charms.',
        ),
      },
    },
    {
      id: 'price-tag',
      label: 'Price Tag',
      kind: 'prop',
      position: [-2.6, 1.36, -2.5],
      standPosition: [-2.6, 0, -1.0],
      ringColor: 0xfde68a,
      commands: {
        look: phraseCommand(
          'look',
          'Ask cheaper',
          phraseById['little-cheaper'],
          'The vendor knocks 10 percent off.',
        ),
        use: phraseCommand(
          'use',
          'Bundle two',
          phraseById['buy-two'],
          'The vendor agrees to discount the second charm.',
        ),
      },
    },
    {
      id: 'hero-charm-purple',
      label: 'Purple Charm',
      kind: 'item',
      position: [-1.6, 1.4, -2.8],
      standPosition: [-1.6, 0, -1.0],
      ringColor: 0xa855f7,
      commands: {
        take: phraseCommand(
          'take',
          'Buy this one',
          phraseById['i-will-buy'],
          'The vendor wraps the purple charm for you.',
          {
            givesItem: 'purpleCharm',
          },
        ),
      },
    },
    {
      id: 'hero-charm-gold',
      label: 'Gold Charm',
      kind: 'item',
      position: [0, 1.4, -2.8],
      standPosition: [0, 0, -1.0],
      ringColor: 0xfacc15,
      commands: {
        look: phraseCommand(
          'look',
          'Think about it',
          phraseById['think-first'],
          'You take a moment to decide.',
        ),
      },
    },
    {
      id: 'hero-charm-cyan',
      label: 'Cyan Charm',
      kind: 'item',
      position: [1.6, 1.4, -2.8],
      standPosition: [1.6, 0, -1.0],
      ringColor: 0x22d3ee,
      commands: {
        use: phraseCommand(
          'use',
          'Polite decline',
          phraseById['not-today'],
          'The vendor smiles — no offense taken.',
        ),
      },
    },
    {
      id: 'silk-vest-display',
      label: 'Silk Vest',
      kind: 'item',
      position: [3.6, 1.4, -2.8],
      standPosition: [3.6, 0, -1.0],
      ringColor: 0xfb7185,
      commands: {
        take: phraseCommand(
          'take',
          'Buy the silk vest',
          phraseById['i-will-buy'],
          'You buy the silk vest. Stage clear!',
          {
            requiresItems: ['purpleCharm'],
            blockedText: 'Buy a starter charm before going for the silk vest.',
            completesAdventure: true,
          },
        ),
      },
    },
  ],
};

export const stageFiveAdventure: AdventureSceneConfig = {
  scenarioId: scenario.id,
  scenarioNumber: scenario.scenarioNumber,
  title: scenario.title,
  subtitle: 'Floating Market',
  badge: `Stage ${scenario.scenarioNumber}/10 · 3D`,
  description: scenario.storyGoal,
  rooms: [dockRoom, charmShopRoom],
  inventoryItems: {
    purpleCharm: {
      id: 'purpleCharm',
      label: 'Purple Charm',
      thaiNoun: 'เครื่องราง',
      romanization: 'krueang raang',
      sprite: '',
    },
  },
  requiredInventory: ['purpleCharm'],
  ambiance,
  completionMessage: 'Stage 5 clear. The silk vest is yours.',
};
