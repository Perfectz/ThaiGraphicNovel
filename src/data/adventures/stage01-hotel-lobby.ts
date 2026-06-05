import type * as THREE from 'three';
import introOneMovieUrl from '../../assets/videos/intro1.mp4?url';
import {
  addBox,
  addCeilingLights,
  addCylinder,
  addPottedPlant,
  addRoomShell,
  addWallPanel,
  type RoomPalette,
} from '../../components/three/sceneHelpers';
import {
  makeMarbleFloorMaterial,
  makePlasterWallMaterial,
} from '../../components/three/proceduralTextures';
import { lessonScenarios } from '../lessonScenarios';
import { stageOneConversationDeck } from '../stageOneSuVoiceLines';
import { customPhraseCommand, phraseCommand } from './shared/phraseCommand';
import type {
  AdventureConversationTurn,
  AdventureRoom3D,
  AdventureSceneConfig,
  SceneAmbiance,
} from './types';

/**
 * Stage 1: Hotel Lobby Basics, ported from the bespoke CharacterDebugPage
 * component onto the Stage3DAdventure data-driven engine.
 *
 * Mechanical translation: Stage 1's bespoke flow had Patrick walk across the
 * lobby to Su, then Su drove a sequential phrase-by-phrase lesson through
 * the CharacterDebugLessonOverlay UI. On the data-driven engine we model
 * the same loop as a single hotspot (Su, rendered as a full 3D rig) with a
 * `talk` command whose `conversation` is a 10-turn drill — one turn per
 * Stage 1 phrase. Each turn opens with Su prompting in English, then the
 * player pronounces the Thai. The final turn completes the adventure.
 *
 * Why this works: AdventureConversationTurn[] already supports exactly this
 * shape (npc setup line → player target phrase → success text), and the
 * judge UI in Stage3DAdventure already shows verdict tone and lets the
 * player retry. The only thing the bespoke page did that we don't is the
 * canvas-textured marble floor / dark teal wall art direction — replaced
 * here with a procedural lobby using the shared sceneHelpers primitives so
 * the stage matches Stages 2–3 visually. A high-fidelity restoration is a
 * follow-up.
 *
 * Routing: registered in registry.ts at scenario index 0. GameCanvas routes
 * the 'dialogue' scene marker (scenario 0) through the dispatcher, so this
 * is the live Stage 1. The legacy CharacterDebugPage was removed in Q1 of
 * the 2-year roadmap once parity was reached.
 */

const scenario = lessonScenarios[0]; // 'hotel-lobby-basics'
const phrases = scenario.chunks.flatMap((chunk) => chunk.phrases);
const phraseById = Object.fromEntries(phrases.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------
// Lobby palette — warm marble floor, deep teal walls, gold trim. Matches the
// tonal direction of the original canvas-textured lobby without replicating
// the bespoke art exactly.
// ---------------------------------------------------------------------------
const lobbyPalette: RoomPalette = {
  floor: 0x8a9aa6,
  wall: 0x1a3148,
  accent: 0xd6a94d,
  trim: 0xf5c96b,
  glow: 0x67e8f9,
};

function buildHotelLobbyRoom(group: THREE.Group, palette: RoomPalette) {
  // Polished veined-marble floor + mottled teal plaster walls — restores the
  // textured art direction the original bespoke lobby had (see file header).
  addRoomShell(group, palette, {
    ceilingTrim: true,
    floorMaterial: makeMarbleFloorMaterial(3, 2),
    wallMaterial: makePlasterWallMaterial(palette.wall, 4, 1.5),
  });
  addCeilingLights(group, palette, [-4.5, 0, 4.5], -2.3);

  // ---- Reception desk along the back wall -------------------------------
  // A long counter with a brass trim strip on top reads as the lobby focal
  // point. Slightly off-center so Su has visual space stage-right.
  addBox(group, [6.8, 1.1, 1.4], [-2.2, 0.55, -3.6], 0x4b2f24);
  addBox(group, [7.0, 0.08, 1.5], [-2.2, 1.13, -3.6], 0xd6a94d, {
    emissive: 0xb98843,
    emissiveIntensity: 0.15,
  });
  // Computer terminal stub behind the counter
  addBox(group, [1.2, 0.78, 0.06], [-3.6, 1.62, -3.95], 0x111827);
  addBox(group, [1.05, 0.7, 0.02], [-3.6, 1.62, -3.92], 0x67e8f9, {
    emissive: 0x67e8f9,
    emissiveIntensity: 0.3,
  });
  // Bell on the desk
  addCylinder(group, 0.12, 0.18, [-0.4, 1.27, -3.6], 0xd6a94d, {
    segments: 22,
    metalness: 0.55,
    roughness: 0.32,
  });

  // ---- Wall panels — dark teal slats with gold dividers -----------------
  addWallPanel(group, [-7.6, 3.0, -5.86], [3.2, 2.8], 0x102538, 0xd6a94d);
  addWallPanel(group, [-3.6, 3.0, -5.86], [3.0, 2.8], 0x132c3f, 0xd6a94d);
  addWallPanel(group, [0.4, 3.0, -5.86], [3.0, 2.8], 0x102538, 0xd6a94d);
  addWallPanel(group, [4.6, 3.0, -5.86], [3.6, 2.8], 0x132c3f, 0xd6a94d);

  // ---- Foreground lounge cluster (stage left) ---------------------------
  // Low coffee table flanked by two armchairs — establishes "lobby lounge"
  // immediately when the player spawns.
  addBox(group, [1.5, 0.42, 1.0], [-5.6, 0.21, 2.6], 0x4b2f24);
  addBox(group, [1.6, 0.06, 1.1], [-5.6, 0.45, 2.6], 0x6b4a35);
  // Armchair seats
  addBox(group, [0.9, 0.45, 0.9], [-4.0, 0.225, 2.6], 0x7f1d1d);
  addBox(group, [0.9, 0.9, 0.18], [-4.0, 0.6, 2.18], 0x7f1d1d);
  addBox(group, [0.9, 0.45, 0.9], [-7.2, 0.225, 2.6], 0x7f1d1d);
  addBox(group, [0.9, 0.9, 0.18], [-7.2, 0.6, 2.18], 0x7f1d1d);

  // ---- Plants — bracket the back wall and ground the lounge ------------
  addPottedPlant(group, -8.2, -3.0);
  addPottedPlant(group, 8.2, -3.0);
  addPottedPlant(group, -8.2, 3.4);
  addPottedPlant(group, 5.6, 1.4);

  // ---- Marble lobby columns flanking the doors out --------------------
  addCylinder(group, 0.35, 4.4, [-7.4, 2.2, 0.4], 0xd8dee9, {
    segments: 28,
    roughness: 0.42,
    metalness: 0.08,
  });
  addCylinder(group, 0.35, 4.4, [7.4, 2.2, 0.4], 0xd8dee9, {
    segments: 28,
    roughness: 0.42,
    metalness: 0.08,
  });

  // ---- Lobby runner rug under Patrick's spawn -------------------------
  addBox(group, [3.2, 0.012, 1.6], [1.85, 0.013, 0.86], 0x0f766e, {
    emissive: 0x083344,
    emissiveIntensity: 0.05,
  });
  // Gold rug border
  addBox(group, [3.36, 0.014, 0.05], [1.85, 0.014, 0.08], 0xfacc15);
  addBox(group, [3.36, 0.014, 0.05], [1.85, 0.014, 1.64], 0xfacc15);
  addBox(group, [0.05, 0.014, 1.7], [0.21, 0.014, 0.86], 0xfacc15);
  addBox(group, [0.05, 0.014, 1.7], [3.49, 0.014, 0.86], 0xfacc15);

  // ---- POLISH PASS (Tech-demo Q1) -------------------------------------
  // Everything below this comment is added strictly to bump Stage 1 from
  // "primitives box" to "hotel lobby". Geometry is hand-tuned to leave
  // the existing camera framing and movement bounds untouched, and uses
  // emissive accents instead of true area lights so the runtime cost
  // stays the same.

  // Hotel signage behind reception — glows softly against the back wall.
  // Reads as "CHAO PHRAYA STAR" at this scale even though it's just a
  // brass plate with letterform-coloured cubes; the eye fills in the
  // typography. Positioned above the computer terminal so it composes
  // with the desk silhouette.
  addBox(group, [4.6, 0.06, 0.04], [-2.2, 2.6, -5.84], 0xb98843, {
    emissive: 0xb98843,
    emissiveIntensity: 0.35,
  });
  addBox(group, [4.4, 0.42, 0.02], [-2.2, 2.6, -5.83], 0x0a1423);
  // Letter-row glyphs — emissive gold cubes spaced as glyphs.
  for (let i = 0; i < 7; i += 1) {
    const x = -2.2 - 1.8 + i * 0.62;
    addBox(group, [0.34, 0.32, 0.03], [x, 2.6, -5.82], 0xf5c96b, {
      emissive: 0xf5c96b,
      emissiveIntensity: 0.7,
    });
  }
  // Plate underline accent
  addBox(group, [4.6, 0.04, 0.03], [-2.2, 2.32, -5.83], 0xf5c96b, {
    emissive: 0xf5c96b,
    emissiveIntensity: 0.8,
  });

  // Chandelier — brass ring with hanging cyan bulbs over the lobby center.
  // The ring itself is a thin torus-shaped composition (cylinder pretending
  // to be a flat plate, since sceneHelpers doesn't expose a torus). Bulbs
  // dangle on visible filaments so the eye reads "chandelier" not "disc".
  addCylinder(group, 1.1, 0.08, [0.6, 4.4, -0.6], 0xb98843, {
    segments: 32,
    metalness: 0.55,
    roughness: 0.32,
    emissive: 0x4a2600,
    emissiveIntensity: 0.18,
  });
  // Inner ring
  addCylinder(group, 0.68, 0.06, [0.6, 4.35, -0.6], 0xf5c96b, {
    segments: 28,
    metalness: 0.6,
    roughness: 0.28,
    emissive: 0xb98843,
    emissiveIntensity: 0.22,
  });
  // Hanging bulbs around the ring perimeter
  for (let i = 0; i < 8; i += 1) {
    const theta = (i / 8) * Math.PI * 2;
    const radius = 0.92;
    const bx = 0.6 + Math.cos(theta) * radius;
    const bz = -0.6 + Math.sin(theta) * radius;
    // Filament
    addCylinder(group, 0.012, 0.35, [bx, 4.16, bz], 0x111827, { segments: 6 });
    // Bulb
    addCylinder(group, 0.085, 0.16, [bx, 3.92, bz], 0xfde68a, {
      segments: 16,
      emissive: 0xfacc15,
      emissiveIntensity: 0.95,
    });
  }

  // Wall sconces — bracket-style emissive panels at chest height on the
  // back wall, one per panel gap. Frames the wall art rhythm without
  // duplicating the chandelier's center-stage role.
  [-5.6, -1.6, 2.4, 6.4].forEach((x) => {
    // Bracket
    addBox(group, [0.12, 0.42, 0.08], [x, 2.2, -5.78], 0xb98843, {
      metalness: 0.5,
      roughness: 0.32,
    });
    // Glow panel
    addBox(group, [0.34, 0.32, 0.03], [x, 2.2, -5.74], 0xfde68a, {
      emissive: 0xfacc15,
      emissiveIntensity: 0.75,
    });
  });

  // Wall art — small framed rectangles to break up the panel monotony.
  [-5.6, 2.4, 6.4].forEach((x) => {
    // Frame
    addBox(group, [1.0, 0.74, 0.03], [x, 3.4, -5.83], 0xb98843, {
      metalness: 0.5,
      roughness: 0.34,
    });
    // Print interior
    addBox(group, [0.88, 0.62, 0.02], [x, 3.4, -5.82], 0x172a3a, {
      emissive: 0x1f3b53,
      emissiveIntensity: 0.18,
    });
    // Subject hint — abstract block so the print reads as "tropical art"
    addBox(group, [0.36, 0.36, 0.015], [x - 0.16, 3.4, -5.81], 0x0f766e, {
      emissive: 0x0f766e,
      emissiveIntensity: 0.25,
    });
    addBox(group, [0.18, 0.5, 0.015], [x + 0.2, 3.42, -5.81], 0xfacc15, {
      emissive: 0xfacc15,
      emissiveIntensity: 0.35,
    });
  });

  // Reception desk — under-counter glow strip plus a small flower arrangement
  // stage-right to add warmth and a hint of life on the counter.
  addBox(group, [6.8, 0.04, 0.05], [-2.2, 0.18, -2.95], 0x67e8f9, {
    emissive: 0x67e8f9,
    emissiveIntensity: 0.55,
  });
  // Flower vase
  addCylinder(group, 0.1, 0.28, [1.4, 1.27, -3.6], 0xd8dee9, {
    segments: 18,
    metalness: 0.35,
    roughness: 0.4,
  });
  // Stem cluster (single emissive bloom block reads from camera distance)
  addCylinder(group, 0.04, 0.22, [1.4, 1.5, -3.6], 0x166534, { segments: 8 });
  addCylinder(group, 0.16, 0.14, [1.4, 1.66, -3.6], 0xff7eb6, {
    segments: 14,
    emissive: 0xff7eb6,
    emissiveIntensity: 0.55,
  });

  // Brochure stack on the desk — small layered cubes near Patrick's
  // approach side so when he walks up the desk reads as occupied.
  addBox(group, [0.42, 0.04, 0.3], [2.2, 1.21, -3.6], 0xf5c96b);
  addBox(group, [0.42, 0.04, 0.3], [2.2, 1.25, -3.6], 0x67e8f9);
  addBox(group, [0.42, 0.04, 0.3], [2.2, 1.29, -3.6], 0xff7eb6);

  // Floor inlay — a thin gold square in the lobby center under the
  // chandelier, the kind of detail a real hotel floor would have.
  addBox(group, [3.2, 0.008, 3.2], [0.6, 0.012, -0.6], 0xb98843, {
    emissive: 0x4a2600,
    emissiveIntensity: 0.18,
  });
  addBox(group, [2.8, 0.01, 2.8], [0.6, 0.014, -0.6], 0xd8dee9, {
    metalness: 0.18,
    roughness: 0.46,
  });
  addBox(group, [0.95, 0.012, 0.95], [0.6, 0.018, -0.6], 0xf5c96b, {
    emissive: 0xf5c96b,
    emissiveIntensity: 0.35,
  });
}

// ---------------------------------------------------------------------------
// Conversation — Su walks Patrick through all 10 phrases from the three
// Stage 1 chunks (First Contact, Polite Repair, First Needs). Each turn:
//   - Su sets up the prompt in English (`npcEnglish`) with a short Thai
//     equivalent so the player hears the natural Thai cadence.
//   - The player pronounces the target phrase via the existing voice judge.
//   - successText is what Su responds when the phrase lands.
//
// Pronunciation prompts come from `phraseById` so any phrase rewrite in
// lessonScenarios automatically flows through here.
// ---------------------------------------------------------------------------

/**
 * Build one drill turn from a phrase id. The turn id MUST match a key in
 * stageOneConversationDeck — that's how Stage3DAdventure looks up the
 * recorded `suLine` + `coachingLine` audio (`stage-01-<id>-su.wav` and
 * `stage-01-<id>-coach.wav`) and plays them in sequence the moment the
 * turn becomes active. The deck's `suLine` is the rich, vocab-inline
 * English Su says ("สวัสดี (hello - sawatdee), Patrick. Look at me…");
 * we route it into `npcEnglish` so the speech bubble shows the same
 * text the audio reads.
 *
 * `thaiTeaser` is the short Thai snippet that appears as the cue card's
 * top line — kept brief because the bigger english+thai mix is in the
 * `npcEnglish` deck line below it.
 */
function turn(
  phraseId: string,
  thaiTeaser: { thai: string; rom: string },
  successText: string,
): AdventureConversationTurn {
  const phrase = phraseById[phraseId];
  if (!phrase) {
    throw new Error(`stage01-hotel-lobby: missing phrase '${phraseId}' in lessonScenarios chunk`);
  }
  const deckEntry = stageOneConversationDeck[phraseId];
  if (!deckEntry) {
    // Without a deck entry the recorded VO won't play and the turn would
    // feel barebones. Fail loud so anyone renaming an id sees this fast.
    throw new Error(
      `stage01-hotel-lobby: phrase '${phraseId}' has no entry in stageOneConversationDeck — recorded Su lines will not play`,
    );
  }
  return {
    id: phraseId,
    npcSpeaker: 'Su',
    npcLineThai: thaiTeaser.thai,
    npcRomanization: thaiTeaser.rom,
    // Use the deck's `suLine` directly — it's the hand-written Su prompt
    // with inline Thai vocab in parentheses, matched 1:1 to the recorded
    // stage-01-<id>-su voice file.
    npcEnglish: deckEntry.suLine,
    response: {
      targetPhrase: phrase.targetPhrase,
      romanization: phrase.romanization,
      phoneticSpelling: phrase.phoneticSpelling ?? phrase.romanization,
      translation: phrase.translation,
    },
    successText,
  };
}

const lobbyDrillConversation: AdventureConversationTurn[] = [
  // ----- Chunk 1: First Contact -----
  turn(
    'hello',
    { thai: 'สวัสดีค่ะ แพทริก', rom: 'sawatdee kha, Patrick' },
    'The lobby steadies around you as your first Thai word lands.',
  ),
  turn(
    'my-name-is-patrick',
    { thai: 'คุณชื่ออะไรคะ', rom: 'khun chue arai kha' },
    'Su writes the name "Patrick" on a small lobby form.',
  ),
  turn(
    'nice-to-meet-you',
    { thai: 'ยินดีที่ได้รู้จักค่ะ', rom: 'yin dee tee dai roo jak kha' },
    'Su mirrors the phrase back warmly.',
  ),

  // ----- Chunk 2: Polite Repair -----
  turn(
    'thank-you',
    { thai: 'นี่คือบทเรียนแรกของคุณ', rom: 'nee khue bot rian raek kong khun' },
    'Su nods. Gratitude keeps the conversation kind.',
  ),
  turn(
    'sorry',
    { thai: 'ขอโทษนะ ฉันชนกระเป๋า', rom: 'kho thot na, chan chon gra-pao' },
    'Su accepts the apology with a small wai.',
  ),
  turn('yes', { thai: 'พร้อมไหมคะ', rom: 'phrom mai kha' }, 'Su smiles. "Good. We move soon."'),
  turn(
    'no',
    { thai: 'คุณชื่ออนันต์ใช่ไหมคะ', rom: 'khun chue Anand chai mai kha' },
    'Su laughs and crosses out the wrong name on the form.',
  ),

  // ----- Chunk 3: First Needs -----
  turn(
    'how-much',
    { thai: 'ที่ร้านมีน้ำดื่ม', rom: 'tee raan mee naam duem' },
    'Su mimes handing over coins.',
  ),
  turn(
    'bathroom-where',
    { thai: 'ล็อบบี้ใหญ่มาก', rom: 'lobby yai maak' },
    'Su points discreetly down a side corridor.',
  ),
  turn(
    'i-am-thirsty',
    { thai: 'อากาศร้อนมาก', rom: 'a kaat ron maak' },
    'Su hands you a cool bottle. The lobby air feels lighter. Stage 1 cleared.',
  ),
];

const lobbyRoom: AdventureRoom3D = {
  id: 'lobby',
  title: 'Chao Phraya Star Hotel',
  shortTitle: 'Lobby',
  description:
    'You wake on the lobby marble after tumbling through the rift. Across the room Su is already waving — walk over when you can stand.',
  palette: lobbyPalette,
  // Patrick spawns stage-left, in front of the lounge cluster, so the camera
  // can frame him and Su (stage-right) in the same shot. The stand-up intro
  // (see introAnimation below) starts him prone on this spot.
  patrickStart: [-5.5, 0, 1.2],
  // Wake-up cinematic: the 'dead' clip plays in reverse on Patrick when the
  // scene loads, so he rises off the floor before normal play begins.
  introAnimation: 'stand-up',
  build: buildHotelLobbyRoom,
  hotspots: [
    {
      id: 'su',
      label: 'Su',
      kind: 'person',
      // Stage-right, between the marble pillar (x=7.4) and the reception desk,
      // with z slightly forward of center so the camera has a clean sightline
      // on her full model. Mirrors Patrick's spawn across the room.
      position: [6.0, 0, -0.5],
      // Approach point: 1.6 units to Su's stage-left (the direction she faces
      // given rotationY=-π/2), so Patrick lands face-to-face with her at a
      // comfortable conversation distance.
      standPosition: [4.4, 0, -0.5],
      ringColor: 0xf0abfc,
      // Clicking Su walks Patrick over AND opens the conversation directly,
      // skipping the talk command's targetPhrase practice — otherwise the
      // player would say 'sawatdee khrap' once to start the talk command
      // and immediately again as the first conversation turn.
      autoTalk: true,
      model: {
        id: 'su',
        animation: 'wave',
        height: 1.72,
        rotationY: -Math.PI / 2, // Face stage-left toward Patrick's spawn.
      },
      commands: {
        look: customPhraseCommand(
          'look',
          'I look at',
          'ผมดูซูครับ',
          'phom duu Su khrap',
          'pom doo Su khrap',
          'I look at Su.',
          'Su, the Neon Circuit Princess, glows softly in the lobby light. She waves you over.',
        ),
        talk: phraseCommand(
          'talk',
          'Start the polite basics drill',
          phraseById['hello'],
          'Su drops into coach mode. "Ten phrases. We go in order — sawatdee first."',
          {
            conversationId: 'stage1-lobby-drill',
            conversation: lobbyDrillConversation,
            conversationCompleteText:
              'All ten phrases land. Su gives Patrick a small bow. Stage 1 clear — the lobby door is unlocked.',
            completesAdventure: true,
          },
        ),
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Ambient lighting — warm hotel-lobby gold key, cool teal rim. Tighter fog
// than Stages 2–3 so the room reads as enclosed rather than market-open.
// ---------------------------------------------------------------------------
const ambiance: SceneAmbiance = {
  // Slightly warmer overall — the lobby now has chandelier + sconces +
  // signage all emitting gold, so the base lighting reads cooler so the
  // emissives pop instead of getting washed.
  background: 0x0c1827,
  fogColor: 0x0c1827,
  fogNear: 16,
  fogFar: 30,
  hemiSky: 0xcde0f0,
  hemiGround: 0x2a1f30,
  hemiIntensity: 0.95,
  // Key light pulled to a warmer gold to match the chandelier — was almost
  // pure white before which fought the brass palette.
  keyColor: 0xfde6c0,
  keyIntensity: 1.55,
  keyPosition: [2.4, 6.4, 3.2],
  // Rim is now a complementary teal that mirrors the wall panels — gives
  // the lobby a cool/warm split-tone look without going neon.
  rimColor: 0x6ec6e7,
  rimIntensity: 1.85,
  rimPosition: [-4, 2.5, -3],
};

export const stageOneAdventure: AdventureSceneConfig = {
  scenarioId: scenario.id,
  scenarioNumber: scenario.scenarioNumber,
  title: scenario.title,
  subtitle: 'Polite Basics with Su',
  badge: `Stage ${scenario.scenarioNumber}/10 · 3D`,
  description: scenario.storyGoal,
  rooms: [lobbyRoom],
  inventoryItems: {},
  requiredInventory: [],
  ambiance,
  completionMessage: 'Stage 1 clear. Patrick can talk politely in Bangkok.',
  loadingTagline: 'Tuning the Bangkok rift…',
  // Pre-roll rift-arrival cinematic. Originally bundled with the deleted
  // CharacterDebugPage; restored here so Stage 1 still opens with the
  // movie before handing off to the in-room VN dialogue and stand-up
  // animation. Vite's `?url` import emits the file with a content hash so
  // it caches indefinitely.
  introVideoUrl: introOneMovieUrl,
};
