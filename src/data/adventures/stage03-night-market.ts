import type * as THREE from 'three';
import introThreeMovieUrl from '../../assets/videos/intro3.mp4?url';
import {
  addBox,
  addCeilingLights,
  addCylinder,
  addEmissiveBox,
  addLanternStringBetween,
  addNeonSign,
  addParticleField,
  addRoomShell,
  addStallCounter,
  addWok,
  type RoomPalette,
} from '../../components/three/sceneHelpers';
import { streetFoodVendorReactions } from '../streetFoodVendorReactions';
import { lessonScenarios } from '../lessonScenarios';
import type { AdventureRoom3D, AdventureSceneConfig, SceneAmbiance } from './types';
import { customPhraseCommand, phraseCommand } from './shared/phraseCommand';

const scenario = lessonScenarios[2]; // street-food-order
const phrases = scenario.chunks.flatMap((chunk) => chunk.phrases);
const phraseById = Object.fromEntries(phrases.map((p) => [p.id, p]));

const stallsPalette: RoomPalette = {
  floor: 0x1a1224,
  wall: 0x2a1238,
  accent: 0xf97316,
  trim: 0xfde68a,
  glow: 0xff7eb6,
};
const cooklinePalette: RoomPalette = {
  floor: 0x14111c,
  wall: 0x1f1a2c,
  accent: 0xf59e0b,
  trim: 0xfb923c,
  glow: 0xef4444,
};

function buildStallsRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: false });
  // Night sky beyond the back wall (replace back wall with deep magenta gradient strip)
  addBox(group, [18, 5, 0.18], [0, 2.5, -6], 0x1a0b2e);
  addEmissiveBox(group, [18, 0.18, 0.05], [0, 0.18, -5.85], palette.glow, 0.6);

  // Hanging lantern strings — two rows across the stalls
  addLanternStringBetween(group, -7, 7, -3.6, 3.8, 7, 0xff7eb6);
  addLanternStringBetween(group, -7, 7, -1.2, 3.6, 7, 0xfbbf24);

  // Big neon sign on back wall
  addNeonSign(group, [0, 3.6, -5.78], [3.2, 0.7], 0xfb7185);
  addNeonSign(group, [-5, 2.8, -5.78], [1.6, 0.5], 0x22d3ee);
  addNeonSign(group, [5, 2.8, -5.78], [1.6, 0.5], 0xfde68a);

  // Stall row at the back
  addStallCounter(group, [-3.6, 0, -3.6], 3.2, 0x4a1c2b, 0xf97316);
  addStallCounter(group, [0, 0, -3.6], 3.2, 0x4a1c2b, 0xf59e0b);
  addStallCounter(group, [3.6, 0, -3.6], 3.2, 0x4a1c2b, 0xfb7185);

  // Hanging menu boards above each stall
  [-3.6, 0, 3.6].forEach((x, i) => {
    addBox(group, [2.2, 0.06, 0.05], [x, 2.6, -3.05], 0x0b0712);
    addBox(group, [2.0, 0.7, 0.04], [x, 2.6, -3.04], 0xfde68a);
    // Hint colored squares for menu items
    [-0.6, 0, 0.6].forEach((dx) => {
      addBox(group, [0.36, 0.36, 0.02], [x + dx, 2.6, -3.0], i % 2 === 0 ? 0xef4444 : 0x10b981);
    });
  });

  // Plates with hot food on counter tops
  [-3.6, 0, 3.6].forEach((x, i) => {
    const plateColor = i === 0 ? 0xfde68a : i === 1 ? 0xfb923c : 0xa78bfa;
    addCylinder(group, 0.34, 0.04, [x - 0.6, 1.08, -3.2], 0xf8fafc, { segments: 28 });
    addCylinder(group, 0.28, 0.1, [x - 0.6, 1.15, -3.2], plateColor, {
      segments: 22,
      emissive: plateColor,
      emissiveIntensity: 0.2,
    });
    addCylinder(group, 0.34, 0.04, [x + 0.6, 1.08, -3.2], 0xf8fafc, { segments: 28 });
    addCylinder(group, 0.28, 0.1, [x + 0.6, 1.15, -3.2], plateColor, {
      segments: 22,
      emissive: plateColor,
      emissiveIntensity: 0.2,
    });
  });

  // Tip jar / coin dish
  addCylinder(group, 0.22, 0.18, [4.0, 1.13, -3.2], 0xfacc15, {
    segments: 26,
    emissive: 0xfde047,
    emissiveIntensity: 0.4,
  });

  // Two seating stools and a small tasting table in the foreground
  addCylinder(group, 0.32, 0.62, [-2.6, 0.31, 2.4], 0x7c3f24, { segments: 18 });
  addCylinder(group, 0.32, 0.62, [-1.4, 0.31, 2.4], 0x7c3f24, { segments: 18 });
  addBox(group, [1.6, 0.9, 1.0], [-2.0, 0.45, 3.6], 0x8b3f2f);
  addBox(group, [1.7, 0.06, 1.1], [-2.0, 0.95, 3.6], 0xfb923c);

  // Spice rack to the right
  addBox(group, [1.6, 1.2, 0.6], [6.4, 0.6, -2.8], 0x4a1c2b);
  [0, 0.34, 0.68].forEach((dy, j) => {
    [-0.5, -0.15, 0.2, 0.55].forEach((dx) => {
      addCylinder(
        group,
        0.07,
        0.22,
        [6.4 + dx, 0.45 + dy, -2.55],
        j === 0 ? 0xfde68a : j === 1 ? 0xef4444 : 0x10b981,
        { segments: 14 },
      );
    });
  });

  // Floor accent rugs
  addBox(group, [3.2, 0.02, 1.4], [0, 0.03, 2.4], 0xb91c1c, { emissive: 0xb91c1c, emissiveIntensity: 0.18 });
  addBox(group, [2.8, 0.018, 1.2], [0, 0.04, 2.4], 0xfacc15, { emissive: 0xfacc15, emissiveIntensity: 0.16 });

  // Atmosphere: floating dust + smoke particles
  addParticleField(group, 60, { x: [-8, 8], y: [0.8, 3.6], z: [-5, 4] }, 0xfde68a, 0.05);

  // ---- POLISH PASS (Tech-demo Q1) -----------------------------------
  // Stage 3 already had the strongest atmosphere of the three stages —
  // these additions tighten the foreground/midground props so the
  // market reads as a real, busy street rather than a stage set.

  // Distant stall silhouettes implied behind the back wall — flat panels
  // tinted by the rim-glow color so they blend with the night sky strip
  // and suggest a market that keeps going past the visible frame.
  [
    [-6.4, -5.7],
    [-2.2, -5.7],
    [2.2, -5.7],
    [6.4, -5.7],
  ].forEach(([x, z]) => {
    addBox(group, [2.4, 1.2, 0.05], [x, 1.0, z], 0x2a1238, {
      emissive: 0x3a1a4a,
      emissiveIntensity: 0.35,
    });
    addBox(group, [1.8, 0.06, 0.04], [x, 1.6, z + 0.02], 0xfde68a, {
      emissive: 0xfacc15,
      emissiveIntensity: 0.6,
    });
  });

  // Per-stall vendor signage above each menu board — Thai-script-suggesting
  // shape using rectangular glyph blocks so the back wall has rhythm.
  [-3.6, 0, 3.6].forEach((x, i) => {
    const accent = i === 0 ? 0xfb7185 : i === 1 ? 0xf59e0b : 0x22d3ee;
    addBox(group, [1.8, 0.32, 0.04], [x, 3.4, -5.83], 0x0a0612);
    addBox(group, [1.8, 0.04, 0.04], [x, 3.58, -5.82], accent, {
      emissive: accent,
      emissiveIntensity: 0.7,
    });
    addBox(group, [1.8, 0.04, 0.04], [x, 3.22, -5.82], accent, {
      emissive: accent,
      emissiveIntensity: 0.7,
    });
    // Three glyph blocks per sign
    [-0.5, 0, 0.5].forEach((dx) => {
      addBox(group, [0.22, 0.2, 0.03], [x + dx, 3.4, -5.81], accent, {
        emissive: accent,
        emissiveIntensity: 0.55,
      });
    });
  });

  // Hanging bamboo steamer baskets above one stall — adds vertical depth
  // and silhouettes against the back-wall glow strip.
  for (let i = 0; i < 3; i += 1) {
    addCylinder(group, 0.34, 0.14, [-3.6, 3.0 - i * 0.18, -3.4], 0xc9a87a, {
      segments: 22,
      roughness: 0.7,
    });
    addCylinder(group, 0.34, 0.02, [-3.6, 3.09 - i * 0.18, -3.4], 0xb98843, {
      segments: 22,
    });
  }
  // Suspension cord
  addCylinder(group, 0.012, 0.55, [-3.6, 3.42, -3.4], 0x4a3520, { segments: 6 });

  // Fruit pyramid on the right stall — colored spheres stacked for a
  // recognisable "market produce" silhouette without modeling each fruit.
  const pyramid: Array<[number, number, number, number]> = [
    [3.6, 1.34, -3.2, 0xff7eb6],
    [3.4, 1.34, -3.0, 0xfacc15],
    [3.8, 1.34, -3.0, 0xfacc15],
    [3.2, 1.34, -3.2, 0x10b981],
    [4.0, 1.34, -3.2, 0x10b981],
    [3.5, 1.56, -3.1, 0xef4444],
    [3.7, 1.56, -3.1, 0xef4444],
    [3.6, 1.78, -3.1, 0xfb7185],
  ];
  pyramid.forEach(([x, y, z, color]) => {
    addCylinder(group, 0.12, 0.22, [x, y, z], color, {
      segments: 18,
      emissive: color,
      emissiveIntensity: 0.25,
    });
  });

  // Street-food cart wheel hint stage-left — a single black-rim disc
  // implies a mobile cart parked just outside the visible frame.
  addCylinder(group, 0.42, 0.06, [-6.4, 0.42, 1.8], 0x111827, {
    segments: 22,
    metalness: 0.4,
    roughness: 0.5,
  });
  addCylinder(group, 0.42, 0.02, [-6.4, 0.44, 1.8], 0xfde68a, {
    segments: 22,
    emissive: 0xfacc15,
    emissiveIntensity: 0.4,
  });
}

function buildCooklineRoom(group: THREE.Group, palette: RoomPalette) {
  addRoomShell(group, palette, { ceilingTrim: false });
  addBox(group, [18, 5, 0.18], [0, 2.5, -6], 0x18101e);
  addCeilingLights(group, palette, [-4.5, 0, 4.5], -2.3);

  // Wok station row
  addBox(group, [9.5, 0.95, 1.6], [-1.0, 0.475, -3.4], 0x1c1623);
  addBox(group, [9.8, 0.18, 1.7], [-1.0, 1.05, -3.4], 0x2e2535);
  [-4.0, -1.5, 1.0, 3.5].forEach((x) => addWok(group, [x, 1.05, -3.3]));

  // Hanging utensil rack
  addBox(group, [6.5, 0.06, 0.06], [-1.0, 3.0, -3.0], 0x111827);
  for (let i = 0; i < 6; i++) {
    const x = -3.6 + i * 1.0;
    addCylinder(group, 0.05, 0.85, [x, 2.55, -3.0], 0xb4b4b4, { segments: 12 });
    addBox(group, [0.22, 0.12, 0.04], [x, 2.13, -3.0], 0xfde68a);
  }

  // Water pitcher and rice cooker
  addCylinder(group, 0.3, 0.7, [5.6, 1.4, -3.2], 0xe2e8f0, { segments: 26 });
  addCylinder(group, 0.06, 0.18, [5.6, 1.78, -3.2], 0xe2e8f0, { segments: 16 });
  addBox(group, [0.7, 0.55, 0.7], [6.8, 1.32, -3.2], 0xefefef);
  addEmissiveBox(group, [0.5, 0.04, 0.5], [6.8, 1.61, -3.2], 0x60a5fa, 0.9);

  // Prep table foreground
  addBox(group, [3.6, 0.85, 1.4], [-3.6, 0.425, 1.6], 0x4a1c2b);
  addBox(group, [3.8, 0.12, 1.6], [-3.6, 0.91, 1.6], 0xfb923c);
  // Vegetables (colored cubes)
  addBox(group, [0.4, 0.16, 0.4], [-4.4, 1.05, 1.6], 0x16a34a);
  addBox(group, [0.4, 0.16, 0.4], [-3.8, 1.05, 1.6], 0xef4444);
  addBox(group, [0.4, 0.16, 0.4], [-3.2, 1.05, 1.6], 0xf59e0b);
  // Knife
  addBox(group, [0.7, 0.04, 0.14], [-2.6, 1.0, 1.6], 0xcbd5e1, { metalness: 0.8, roughness: 0.2 });
  addBox(group, [0.18, 0.04, 0.14], [-2.18, 1.0, 1.6], 0x111827);

  // Bill spike & receipts
  addCylinder(group, 0.04, 0.4, [3.0, 1.13, 1.6], 0x111827, { segments: 10 });
  addBox(group, [0.32, 0.36, 0.02], [3.0, 1.18, 1.6], 0xf8fafc);

  // Pink/orange neon glow on back
  addEmissiveBox(group, [12, 0.12, 0.1], [0, 4.4, -5.85], 0xf97316, 1.1);

  addParticleField(group, 40, { x: [-6, 6], y: [1.2, 3.4], z: [-4, 2] }, 0xfb923c, 0.06);

  // ---- POLISH PASS (Tech-demo Q1) -----------------------------------
  // The cookline previously read as "wok row + prep table" but felt
  // empty above. These additions fill the vertical space and add the
  // small chaotic details a real Thai street-food kitchen has.

  // Exhaust hood over the wok row — wide stainless-look box with a
  // narrower vent strip on its underside.
  addBox(group, [9.8, 0.6, 1.4], [-1.0, 3.55, -3.4], 0x4a4a52, {
    metalness: 0.4,
    roughness: 0.5,
  });
  addBox(group, [9.6, 0.04, 1.3], [-1.0, 3.25, -3.4], 0x111827);
  // Underside vent slats (faintly glowing — heat haze hint)
  for (let i = 0; i < 6; i += 1) {
    const x = -4.6 + i * 1.4;
    addBox(group, [1.2, 0.012, 0.04], [x, 3.232, -3.4], 0xef4444, {
      emissive: 0xef4444,
      emissiveIntensity: 0.45,
    });
  }

  // Steam plumes above each wok — emissive translucent cylinders that
  // read as rising steam.
  [-4.0, -1.5, 1.0, 3.5].forEach((x) => {
    addCylinder(group, 0.16, 0.6, [x, 1.7, -3.3], 0xf8fafc, {
      segments: 14,
      emissive: 0xf8fafc,
      emissiveIntensity: 0.45,
      roughness: 0.7,
    });
    addCylinder(group, 0.22, 0.4, [x, 2.2, -3.3], 0xf8fafc, {
      segments: 16,
      emissive: 0xf8fafc,
      emissiveIntensity: 0.32,
      roughness: 0.7,
    });
  });

  // Hanging meat hooks above the prep area — three S-hooks with cured
  // sausage silhouettes for that street-food kitchen feel.
  [-2.5, -1.8, -1.1].forEach((x) => {
    addCylinder(group, 0.015, 0.2, [x, 2.95, 1.6], 0xb98843, { segments: 6 });
    addCylinder(group, 0.085, 0.34, [x, 2.7, 1.6], 0x7c2d12, {
      segments: 14,
      emissive: 0x4a1d12,
      emissiveIntensity: 0.2,
    });
  });

  // Condiment bottles on the prep table — three differently coloured
  // tall thin cylinders. Reads as fish sauce / soy / chili-vinegar.
  [
    [-1.4, 0xfde68a],
    [-1.0, 0xb91c1c],
    [-0.6, 0x166534],
  ].forEach(([x, color]) => {
    addCylinder(group, 0.07, 0.32, [x as number, 1.13, 1.6], color as number, {
      segments: 14,
      emissive: color as number,
      emissiveIntensity: 0.18,
    });
    addCylinder(group, 0.03, 0.04, [x as number, 1.31, 1.6], 0x1f2937, { segments: 8 });
  });

  // Charcoal grill glow — a small ember-red rectangle under the wok row
  // adds heat to the visual without needing a real light source.
  addBox(group, [9.4, 0.02, 1.2], [-1.0, 0.96, -3.4], 0xef4444, {
    emissive: 0xef4444,
    emissiveIntensity: 0.75,
  });

  // Overhead order screen — a small magenta-glow rectangle behind the
  // utensil rack, suggesting a digital queue display.
  addBox(group, [1.6, 0.8, 0.05], [3.6, 2.85, -5.78], 0x0a0612);
  addBox(group, [1.5, 0.7, 0.03], [3.6, 2.85, -5.76], 0xff7eb6, {
    emissive: 0xff7eb6,
    emissiveIntensity: 0.55,
  });
  // Pretend-rows
  for (let i = 0; i < 4; i += 1) {
    addBox(group, [1.3, 0.04, 0.02], [3.6, 3.1 - i * 0.14, -5.75], 0xfde68a, {
      emissive: 0xfde68a,
      emissiveIntensity: 0.7,
    });
  }
}

const ambiance: SceneAmbiance = {
  background: 0x0b0517,
  fogColor: 0x140a26,
  fogNear: 10,
  fogFar: 30,
  hemiSky: 0xffd5f0,
  hemiGround: 0x1f0a2e,
  hemiIntensity: 1.05,
  keyColor: 0xfde68a,
  keyIntensity: 1.6,
  keyPosition: [-3, 7, 5],
  rimColor: 0xff7eb6,
  rimIntensity: 2.6,
  rimPosition: [5, 2.6, -4.2],
};

const stallsRoom: AdventureRoom3D = {
  id: 'stalls',
  title: 'Night Market Stalls',
  shortTitle: 'Stalls',
  description:
    'Bright lanterns string between vendor counters. Pick a dish, ask what it is, and order politely.',
  palette: stallsPalette,
  patrickStart: [-5.4, 0, 3.4],
  build: buildStallsRoom,
  hotspots: [
    {
      id: 'street-food-vendor',
      label: 'Street Food Vendor',
      kind: 'person',
      position: [0, 1.45, -3.0],
      standPosition: [0, 0, -1.4],
      sprite: streetFoodVendorReactions.smile,
      model: {
        id: 'stage3Vendor',
        animation: 'wave',
        height: 1.74,
      },
      commands: {
        look: customPhraseCommand(
          'look',
          'I look at',
          'ผมดูพ่อค้าครับ',
          'phom duu phor kaa khrap',
          'pom doo paw kah khrap',
          'I look at the food vendor.',
          'The vendor smiles, gesturing at the dishes.',
          {
            characterVoice: {
              speaker: 'Street Food Vendor',
              text: 'Welcome! Look around. Everything is fresh tonight.',
            },
          },
        ),
        talk: phraseCommand(
          'talk',
          'Greet the vendor',
          phraseById['want-this'],
          'The vendor nods and slides a plate forward.',
          {
            characterVoice: {
              speaker: 'Street Food Vendor',
              text: 'Good choice. I will make this plate for you.',
            },
          },
        ),
      },
    },
    {
      id: 'menu-board',
      label: 'Menu Board',
      kind: 'prop',
      position: [-3.6, 2.6, -3.05],
      standPosition: [-3.6, 0, -1.6],
      ringColor: 0xfde68a,
      commands: {
        look: phraseCommand(
          'look',
          'Ask about the dish',
          phraseById['what-is-this'],
          'The vendor names the dish for you.',
          {
            characterVoice: {
              speaker: 'Street Food Vendor',
              text: 'This one is stir-fried noodles. Very popular.',
            },
          },
        ),
      },
    },
    {
      id: 'spice-jar',
      label: 'Chili Jar',
      kind: 'prop',
      position: [6.4, 1.15, -2.55],
      standPosition: [5.4, 0, -1.6],
      ringColor: 0xef4444,
      commands: {
        use: phraseCommand(
          'use',
          'Request mild',
          phraseById['not-spicy'],
          'The vendor sets the chili jar aside.',
          {
            characterVoice: {
              speaker: 'Street Food Vendor',
              text: 'Mai phet. Not spicy. I understand.',
            },
          },
        ),
        look: phraseCommand(
          'look',
          'Ask for a little heat',
          phraseById['little-spicy'],
          'The vendor adds a small spoon of chili.',
          {
            characterVoice: {
              speaker: 'Street Food Vendor',
              text: 'A little spicy only. I will be gentle.',
            },
          },
        ),
      },
    },
    {
      id: 'peanut-bowl',
      label: 'Peanut Bowl',
      kind: 'item',
      position: [3.6, 1.2, -3.2],
      standPosition: [3.6, 0, -1.6],
      ringColor: 0x67e8f9,
      commands: {
        use: phraseCommand(
          'use',
          'No peanuts',
          phraseById['no-peanuts'],
          'The vendor nods and skips the peanuts.',
          {
            characterVoice: {
              speaker: 'Street Food Vendor',
              text: 'No peanuts. Thank you for telling me.',
            },
          },
        ),
      },
    },
    {
      id: 'plate-of-noodles',
      label: 'Plate of Noodles',
      kind: 'item',
      position: [-3.6, 1.2, -3.2],
      standPosition: [-3.6, 0, -1.6],
      ringColor: 0xfbbf24,
      commands: {
        take: phraseCommand(
          'take',
          'Order one plate',
          phraseById['one-plate'],
          'A fresh plate of noodles is plated for you.',
          {
            givesItem: 'plateOfNoodles',
            characterVoice: {
              speaker: 'Street Food Vendor',
              text: 'One plate, coming right up.',
            },
          },
        ),
        look: phraseCommand(
          'look',
          'Choose this one',
          phraseById['want-this'],
          'The vendor reaches for the noodle plate.',
          {
            characterVoice: {
              speaker: 'Street Food Vendor',
              text: 'That dish is a good choice.',
            },
          },
        ),
      },
    },
  ],
};

const cooklineRoom: AdventureRoom3D = {
  id: 'cookline',
  title: 'Cook Line',
  shortTitle: 'Cook',
  description:
    'Woks flare on the cook line. Ask for water with your meal, pay the bill, and compliment the chef.',
  palette: cooklinePalette,
  patrickStart: [-4.8, 0, 3.0],
  build: buildCooklineRoom,
  hotspots: [
    {
      id: 'water-pitcher',
      label: 'Water Pitcher',
      kind: 'item',
      position: [5.6, 1.5, -3.2],
      standPosition: [4.6, 0, -1.6],
      ringColor: 0x60a5fa,
      commands: {
        take: phraseCommand(
          'take',
          'Ask for water',
          phraseById['water-please'],
          'The vendor pours you a cold cup of water.',
          {
            givesItem: 'cupOfWater',
            characterVoice: {
              speaker: 'Street Food Vendor',
              text: 'Here is cold water for you.',
            },
          },
        ),
      },
    },
    {
      id: 'bill-spike',
      label: 'Bill Spike',
      kind: 'prop',
      position: [3.0, 1.2, 1.6],
      standPosition: [3.0, 0, 2.8],
      ringColor: 0xfacc15,
      commands: {
        use: phraseCommand(
          'use',
          'Ask for the bill',
          phraseById['bill-please'],
          'The vendor tallies the bill on a small slip.',
          {
            requiresItems: ['plateOfNoodles', 'cupOfWater'],
            blockedText: 'Order a plate of noodles and ask for water before paying.',
            characterVoice: {
              speaker: 'Street Food Vendor',
              text: 'Here is your bill. Thank you.',
            },
          },
        ),
      },
    },
    {
      id: 'chef',
      label: 'Wok Chef',
      kind: 'person',
      position: [-1.0, 1.45, -3.0],
      standPosition: [-1.0, 0, -1.6],
      sprite: streetFoodVendorReactions.explaining,
      model: {
        id: 'stage3Vendor',
        animation: 'idle',
        height: 1.74,
      },
      commands: {
        talk: phraseCommand(
          'talk',
          'Compliment the chef',
          phraseById.delicious,
          'The chef beams and wipes their hands on a towel. Stage clear!',
          {
            requiresItems: ['plateOfNoodles', 'cupOfWater'],
            blockedText: 'Pay the bill before complimenting the chef.',
            completesAdventure: true,
            characterVoice: {
              speaker: 'Wok Chef',
              text: 'Thank you. I am glad you liked it. Come back anytime.',
            },
          },
        ),
        look: customPhraseCommand(
          'look',
          'I look at',
          'ผมดูเชฟครับ',
          'phom duu chef khrap',
          'pom doo chef khrap',
          'I look at the chef.',
          'The chef tosses noodles in the wok with a practiced flick.',
          {
            characterVoice: {
              speaker: 'Wok Chef',
              text: 'Hot wok, quick hands. That is how the noodles stay alive.',
            },
          },
        ),
      },
    },
  ],
};

export const stageThreeAdventure: AdventureSceneConfig = {
  scenarioId: scenario.id,
  scenarioNumber: scenario.scenarioNumber,
  title: scenario.title,
  subtitle: 'Night Market Order',
  badge: `Stage ${scenario.scenarioNumber}/10 · 3D`,
  description: scenario.storyGoal,
  introVideoUrl: introThreeMovieUrl,
  rooms: [stallsRoom, cooklineRoom],
  inventoryItems: {
    plateOfNoodles: {
      id: 'plateOfNoodles',
      label: 'Plate of Noodles',
      thaiNoun: 'จานก๋วยเตี๋ยว',
      romanization: 'jaan guay-tiao',
      sprite: '',
    },
    cupOfWater: {
      id: 'cupOfWater',
      label: 'Cup of Water',
      thaiNoun: 'น้ำเปล่า',
      romanization: 'naam plao',
      sprite: '',
    },
  },
  requiredInventory: ['plateOfNoodles', 'cupOfWater'],
  ambiance,
  completionMessage: 'Stage 3 clear. The night market accepts you.',
};
