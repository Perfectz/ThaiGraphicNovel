import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import mainCharacterModelUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Character_output.glb?url';
import deadAnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Dead_withSkin.glb?url';
import depressedTurnAnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Depressed_Full_Turn_Left_withSkin.glb?url';
import idle02AnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Idle_02_withSkin.glb?url';
import idle03AnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Idle_03_withSkin.glb?url';
import runningAnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Running_withSkin.glb?url';
import talkAnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Talk_Passionately_withSkin.glb?url';
import victoryAnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Victory_Cheer_withSkin.glb?url';
import walkingAnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Walking_withSkin.glb?url';
import suModelUrl from '../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Character_output.glb?url';
import suIdleAnimationUrl from '../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Idle_4_withSkin.glb?url';
import suRunAnimationUrl from '../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Running_withSkin.glb?url';
import suTalkAnimationUrl from '../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Talk_Passionately_withSkin.glb?url';
import suWalkAnimationUrl from '../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Walking_withSkin.glb?url';
import suWaveAnimationUrl from '../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Wave_for_Help_4_withSkin.glb?url';
import introOneMovieUrl from '../../humandropbox/intro1.mp4?url';
import { lessonScenarios } from '../data/lessonScenarios';
import { suPosition } from '../data/map';
import { patrickReactions } from '../data/patrickReactions';
import { suReactions } from '../data/suReactions';
import { getStageOneSuAudioSrc } from '../services/suLineAudio';
import { writeSave } from '../systems/saveSystem';
import { CharacterDebugIntroDialogue, type CharacterDebugIntroLine } from './CharacterDebugIntroDialogue';
import { CharacterDebugLessonOverlay } from './CharacterDebugLessonOverlay';

type LoadStatus = 'loading' | 'ready' | 'error';

type ModelStats = {
  status: LoadStatus;
  message: string;
  meshCount: number;
  triangleCount: number;
  materialCount: number;
  textureCount: number;
  animationCount: number;
  activeAnimation: string;
  dimensions: string;
  rigStatus: string;
};

const MODEL_FILE_NAME = 'meshywithanimationrigpatrick.zip';
const SU_FILE_NAME = 'surigged.zip';
const WALK_CENTER_X = 1.85;
const ROOM_CENTER_X = 0.65;
const SPAWN_POINT = new THREE.Vector3(WALK_CENTER_X, 0, 0.86);
const SU_SPAWN_POINT = new THREE.Vector3(4.62, 0, 2.08);
const SU_APPROACH_POINT = new THREE.Vector3(3.45, 0, 1.42);
const ROOM_BOUNDS = {
  minX: -5.25,
  maxX: 6.45,
  minZ: -3.62,
  maxZ: 3.62,
};
const ROOM_FOG_NEAR = 18;
const ROOM_FOG_FAR = 34;
const CAMERA_FAR_PLANE = 120;
const CAMERA_FOLLOW_OFFSET = new THREE.Vector3(1.2, 2.35, 5.25);
const CAMERA_TALK_OFFSET = new THREE.Vector3(1.2, 1.65, 3.55);
const RUN_DISTANCE = 2.25;
const WALK_SPEED = 1.35;
const RUN_SPEED = 3.2;

const animationSources = [
  { id: 'idle', label: 'Idle', url: idle02AnimationUrl, preload: true },
  { id: 'idle-alt', label: 'Idle 03', url: idle03AnimationUrl, preload: false },
  { id: 'walk', label: 'Walk', url: walkingAnimationUrl, preload: true },
  { id: 'run', label: 'Run', url: runningAnimationUrl, preload: true },
  { id: 'talk', label: 'Talk', url: talkAnimationUrl, preload: false },
  { id: 'victory', label: 'Victory', url: victoryAnimationUrl, preload: false },
  { id: 'turn', label: 'Turn', url: depressedTurnAnimationUrl, preload: false },
  { id: 'dead', label: 'Dead', url: deadAnimationUrl, preload: false },
];

type MotionMode = 'idle' | 'walking' | 'running' | 'manual';
type TravelIntent = 'free' | 'su';
type DebugLessonState = 'hidden' | 'lesson' | 'complete';
type LevelPhase = 'arrival' | 'su-calls' | 'controls' | 'find-su' | 'walking-to-su' | 'talking' | 'lesson' | 'complete';

const suAnimationSources = [
  { id: 'idle', label: 'Su Idle', url: suIdleAnimationUrl, preload: false },
  { id: 'walk', label: 'Su Walk', url: suWalkAnimationUrl, preload: false },
  { id: 'run', label: 'Su Run', url: suRunAnimationUrl, preload: false },
  { id: 'talk', label: 'Su Talk', url: suTalkAnimationUrl, preload: true },
  { id: 'wave', label: 'Su Wave', url: suWaveAnimationUrl, preload: true },
];

const stageOneIntroLines = [
  {
    id: 'patrick-arrival',
    speaker: 'Patrick',
    text: 'Where am I? This is not the street outside my apartment.',
    side: 'left',
    portraitUrl: patrickReactions.worried,
    tone: 'Confused',
    audioId: undefined,
  },
  {
    id: 'su-hello',
    speaker: 'Su',
    text: 'Hello, Patrick! Sawatdee. You are awake. Do not panic. You fell through the Bangkok rift and landed in the lobby of the Chao Phraya Star Hotel.',
    side: 'right',
    portraitUrl: suReactions.smile,
    tone: 'Calling across the room',
    audioId: 'dialogue-hotel-lobby-basics-02',
  },
  {
    id: 'su-approach',
    speaker: 'Su',
    text: 'I am across the room. Click the glowing floor path or press Go To Su, and Patrick will walk to me.',
    side: 'right',
    portraitUrl: suReactions.explaining,
    tone: 'Tutorial',
    audioId: 'dialogue-hotel-lobby-basics-05',
  },
  {
    id: 'su-training',
    speaker: 'Su',
    text: 'Before you step outside, you need your first kind of magic: polite Thai. Hold Speak and talk, release to let the AI judge, tap Hear for my example, Review to retry, and Skip only if your mouth has dramatically resigned.',
    side: 'right',
    portraitUrl: suReactions.determined,
    tone: 'Coach',
    audioId: 'dialogue-hotel-lobby-basics-06',
  },
] as const satisfies readonly CharacterDebugIntroLine[];

function createMat(color: number, roughness = 0.68, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function createCanvasTexture(
  name: string,
  size: number,
  draw: (context: CanvasRenderingContext2D, size: number) => void,
  repeat: [number, number] = [1, 1],
) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return null;

  draw(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  return texture;
}

function createLobbyFloorTexture() {
  return createCanvasTexture('thai-hotel-marble-floor', 512, (context, size) => {
    const gradient = context.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#e6edf2');
    gradient.addColorStop(0.5, '#b9c8d2');
    gradient.addColorStop(1, '#7f98a8');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    for (let index = 0; index < 120; index += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const length = 22 + Math.random() * 90;
      context.strokeStyle = `rgba(${90 + Math.random() * 70}, ${112 + Math.random() * 60}, ${128 + Math.random() * 55}, ${0.08 + Math.random() * 0.16})`;
      context.lineWidth = 1 + Math.random() * 2.2;
      context.beginPath();
      context.moveTo(x, y);
      context.bezierCurveTo(x + length * 0.18, y - 18, x + length * 0.72, y + 24, x + length, y + Math.random() * 36 - 18);
      context.stroke();
    }

    context.strokeStyle = 'rgba(15, 23, 42, 0.23)';
    context.lineWidth = 3;
    for (let line = 0; line <= size; line += size / 4) {
      context.beginPath();
      context.moveTo(line, 0);
      context.lineTo(line, size);
      context.moveTo(0, line);
      context.lineTo(size, line);
      context.stroke();
    }

    context.strokeStyle = 'rgba(214, 169, 77, 0.72)';
    context.lineWidth = 5;
    context.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);
  }, [3.5, 2.25]);
}

function createLobbyWallTexture() {
  return createCanvasTexture('thai-hotel-wall-panels', 512, (context, size) => {
    const gradient = context.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#17324a');
    gradient.addColorStop(0.55, '#203d55');
    gradient.addColorStop(1, '#0f2238');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    context.strokeStyle = 'rgba(226, 232, 240, 0.16)';
    context.lineWidth = 4;
    for (let x = 42; x < size; x += 128) {
      context.strokeRect(x, 54, 78, 350);
      context.strokeRect(x + 12, 76, 54, 306);
    }

    context.strokeStyle = 'rgba(214, 169, 77, 0.4)';
    context.lineWidth = 3;
    for (let y = 34; y < size; y += 96) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(size, y);
      context.stroke();
    }
  }, [3, 1]);
}

function createRugTexture() {
  return createCanvasTexture('lobby-runner-rug-pattern', 512, (context, size) => {
    context.fillStyle = '#0f766e';
    context.fillRect(0, 0, size, size);
    context.fillStyle = '#083344';
    context.fillRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);
    context.strokeStyle = '#facc15';
    context.lineWidth = 16;
    context.strokeRect(size * 0.1, size * 0.1, size * 0.8, size * 0.8);
    context.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    context.lineWidth = 5;
    for (let index = 0; index < 7; index += 1) {
      const inset = 54 + index * 26;
      context.strokeRect(inset, inset * 0.72, size - inset * 2, size - inset * 1.44);
    }
  }, [2, 1]);
}

function createBox(
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createTextSprite(text: string, width = 512, height = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.fillStyle = 'rgba(6, 17, 33, 0.86)';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(125, 211, 252, 0.9)';
  context.lineWidth = 8;
  context.strokeRect(4, 4, width - 8, height - 8);
  context.fillStyle = '#cffafe';
  context.font = '700 46px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.name = `label-${text.toLowerCase().replace(/\s+/g, '-')}`;
  return sprite;
}

function createHotelLobbyMockup() {
  const lobby = new THREE.Group();
  lobby.name = 'hotel-lobby-debug-room';

  const floorTexture = createLobbyFloorTexture();
  const wallTexture = createLobbyWallTexture();
  const rugTexture = createRugTexture();
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xd7e3ea,
    map: floorTexture ?? undefined,
    roughness: 0.5,
    metalness: 0.12,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x203d55,
    map: wallTexture ?? undefined,
    roughness: 0.7,
    metalness: 0.02,
  });
  const trimMaterial = createMat(0x0f172a, 0.72);
  const goldMaterial = createMat(0xd6a94d, 0.42, 0.18);
  const brassGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5c96b,
    roughness: 0.34,
    metalness: 0.38,
    emissive: 0x4a2600,
    emissiveIntensity: 0.12,
  });
  const tealMaterial = createMat(0x0f766e, 0.6, 0.06);
  const woodMaterial = createMat(0x4b2f24, 0.58, 0.03);
  const fabricMaterial = createMat(0x7f1d1d, 0.82);
  const plantMaterial = createMat(0x166534, 0.72);
  const planterMaterial = createMat(0x334155, 0.66);
  const marbleColumnMaterial = createMat(0xd8dee9, 0.48, 0.08);
  const glowCyanMaterial = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.42 });
  const glowPinkMaterial = new THREE.MeshBasicMaterial({ color: 0xf9a8d4, transparent: true, opacity: 0.28 });

  const floor = createBox('polished-lobby-floor', [12.8, 0.04, 8.4], [ROOM_CENTER_X, -0.04, 0.05], floorMaterial);
  floor.receiveShadow = true;
  floor.castShadow = false;
  lobby.add(floor);

  lobby.add(createBox('back-wall', [12.8, 4.2, 0.08], [ROOM_CENTER_X, 2.06, -4.15], wallMaterial));
  lobby.add(createBox('left-wall', [0.08, 4.2, 8.4], [-5.75, 2.06, 0.05], wallMaterial));
  lobby.add(createBox('right-wall', [0.08, 4.2, 8.4], [7.05, 2.06, 0.05], wallMaterial));
  lobby.add(createBox('ceiling-trim', [12.8, 0.08, 0.14], [ROOM_CENTER_X, 4.14, -4.05], brassGlowMaterial));
  lobby.add(createBox('floor-trim', [12.8, 0.08, 0.14], [ROOM_CENTER_X, 0.08, -4.05], brassGlowMaterial));
  lobby.add(createBox('left-floor-trim', [0.14, 0.08, 8.4], [-5.66, 0.08, 0.05], brassGlowMaterial));
  lobby.add(createBox('right-floor-trim', [0.14, 0.08, 8.4], [6.96, 0.08, 0.05], brassGlowMaterial));

  const rearPortal = new THREE.Group();
  rearPortal.name = 'stage-one-rift-portal';
  const portalRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.026, 10, 72), glowCyanMaterial);
  portalRing.position.set(5.78, 1.48, -4.02);
  const portalCore = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 48),
    new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.18 }),
  );
  portalCore.position.set(5.78, 1.48, -4.01);
  rearPortal.add(portalCore, portalRing);
  const portalLight = new THREE.PointLight(0x67e8f9, 2.2, 5.5);
  portalLight.position.set(5.5, 1.55, -3.15);
  rearPortal.add(portalLight);
  lobby.add(rearPortal);

  const neonPath = new THREE.Group();
  neonPath.name = 'lesson-path-to-su';
  const pathMaterial = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.22 });
  const pathMain = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.014, 0.12), pathMaterial);
  pathMain.position.set(3.0, 0.02, 1.15);
  pathMain.rotation.y = -0.26;
  neonPath.add(pathMain);
  [1.65, 2.28, 2.91, 3.54, 4.17].forEach((x, index) => {
    const step = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.18, 28), index % 2 === 0 ? glowCyanMaterial : glowPinkMaterial);
    step.rotation.x = -Math.PI / 2;
    step.position.set(x, 0.03, 0.84 + index * 0.18);
    neonPath.add(step);
  });
  lobby.add(neonPath);

  const desk = new THREE.Group();
  desk.name = 'front-desk';
  desk.add(createBox('front-desk-counter', [4.15, 0.72, 0.54], [0, 0.36, 0], woodMaterial));
  desk.add(createBox('front-desk-top', [4.36, 0.08, 0.68], [0, 0.75, -0.02], brassGlowMaterial));
  desk.add(createBox('front-desk-kick', [4.3, 0.16, 0.08], [0, 0.12, 0.31], trimMaterial));
  desk.add(createBox('desk-terminal-left', [0.32, 0.2, 0.06], [-1.18, 0.92, -0.1], trimMaterial));
  desk.add(createBox('desk-terminal-right', [0.32, 0.2, 0.06], [1.12, 0.92, -0.1], trimMaterial));
  desk.add(createBox('desk-bell', [0.16, 0.08, 0.16], [0.08, 0.88, 0.02], brassGlowMaterial));
  desk.add(createBox('front-desk-underlight', [4.0, 0.03, 0.06], [0, 0.66, 0.32], glowCyanMaterial));
  desk.position.set(1.05, 0, -3.25);
  lobby.add(desk);

  const sign = createTextSprite('SAWATDEE HOTEL');
  if (sign) {
    sign.position.set(0.8, 3.26, -4.08);
    sign.scale.set(2.8, 0.7, 1);
    lobby.add(sign);
  }

  const deskSign = createTextSprite('FRONT DESK', 384, 112);
  if (deskSign) {
    deskSign.position.set(1.05, 1.18, -2.68);
    deskSign.scale.set(1.12, 0.32, 1);
    lobby.add(deskSign);
  }

  const rugMaterial = new THREE.MeshStandardMaterial({
    color: 0x0e7490,
    map: rugTexture ?? undefined,
    roughness: 0.82,
    metalness: 0.02,
  });
  const rug = createBox('teal-lobby-rug', [4.7, 0.018, 2.55], [2.08, 0.005, 1.08], rugMaterial);
  rug.castShadow = false;
  lobby.add(rug);

  const couch = new THREE.Group();
  couch.name = 'red-lobby-couch';
  couch.add(createBox('couch-seat', [1.25, 0.28, 0.42], [0, 0.2, 0], fabricMaterial));
  couch.add(createBox('couch-back', [1.25, 0.62, 0.16], [0, 0.45, -0.24], fabricMaterial));
  couch.add(createBox('couch-left-arm', [0.16, 0.46, 0.48], [-0.72, 0.32, 0], fabricMaterial));
  couch.add(createBox('couch-right-arm', [0.16, 0.46, 0.48], [0.72, 0.32, 0], fabricMaterial));
  couch.rotation.y = -0.18;
  couch.position.set(-3.55, 0, 1.85);
  lobby.add(couch);

  const coffeeTable = new THREE.Group();
  coffeeTable.name = 'lobby-coffee-table';
  coffeeTable.add(createBox('coffee-table-top', [0.85, 0.06, 0.42], [0, 0.34, 0], goldMaterial));
  coffeeTable.add(createBox('coffee-table-base', [0.16, 0.32, 0.16], [0, 0.17, 0], trimMaterial));
  coffeeTable.position.set(-2.72, 0, 1.98);
  lobby.add(coffeeTable);

  const luggageCart = new THREE.Group();
  luggageCart.name = 'luggage-cart';
  luggageCart.add(createBox('cart-base', [0.58, 0.06, 0.38], [0, 0.18, 0], goldMaterial));
  luggageCart.add(createBox('cart-left-post', [0.04, 0.72, 0.04], [-0.26, 0.54, -0.15], goldMaterial));
  luggageCart.add(createBox('cart-right-post', [0.04, 0.72, 0.04], [0.26, 0.54, -0.15], goldMaterial));
  luggageCart.add(createBox('cart-top-rail', [0.58, 0.04, 0.04], [0, 0.9, -0.15], goldMaterial));
  luggageCart.add(createBox('suitcase', [0.34, 0.36, 0.2], [0, 0.42, 0.04], tealMaterial));
  luggageCart.position.set(5.75, 0, 1.34);
  luggageCart.rotation.y = 0.28;
  lobby.add(luggageCart);

  const lessonCorner = new THREE.Group();
  lessonCorner.name = 'su-lesson-corner-stage';
  lessonCorner.add(createBox('su-corner-platform', [2.2, 0.08, 1.45], [4.75, 0.03, 2.1], createMat(0x172554, 0.55, 0.12)));
  lessonCorner.add(createBox('su-corner-platform-trim-front', [2.28, 0.08, 0.08], [4.75, 0.12, 2.84], brassGlowMaterial));
  lessonCorner.add(createBox('su-corner-platform-trim-back', [2.28, 0.08, 0.08], [4.75, 0.12, 1.36], brassGlowMaterial));
  const lessonSpot = new THREE.SpotLight(0xfbcfe8, 2.8, 5.5, 0.58, 0.42, 1.1);
  lessonSpot.position.set(4.55, 3.25, 3.2);
  lessonSpot.target.position.set(SU_SPAWN_POINT.x, 0.9, SU_SPAWN_POINT.z);
  lessonCorner.add(lessonSpot, lessonSpot.target);
  lobby.add(lessonCorner);

  [-4.85, 6.15, -4.85, 6.15].forEach((x, index) => {
    const plant = new THREE.Group();
    plant.name = `lobby-plant-${index + 1}`;
    plant.add(createBox('planter', [0.32, 0.32, 0.32], [0, 0.16, 0], planterMaterial));
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.88, 8), plantMaterial);
    leaves.position.set(0, 0.76, 0);
    leaves.castShadow = true;
    plant.add(leaves);
    plant.position.set(x, 0, index < 2 ? -3.42 : 3.38);
    lobby.add(plant);
  });

  [-3.1, -1.25, 0.65, 2.55, 4.45].forEach((x, index) => {
    const pendant = new THREE.Group();
    pendant.name = `lobby-pendant-light-${index + 1}`;
    pendant.add(createBox('pendant-wire', [0.025, 0.8, 0.025], [0, 3.58, -2.25], trimMaterial));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.22, 18), goldMaterial);
    shade.position.set(0, 3.06, -2.25);
    shade.rotation.x = Math.PI;
    pendant.add(shade);
    const light = new THREE.PointLight(0xffe4a3, 1.25, 4.4);
    light.position.set(0, 2.88, -2.18);
    pendant.add(light);
    pendant.position.x = x;
    lobby.add(pendant);
  });

  const queueRailMaterial = createMat(0xe2e8f0, 0.38, 0.4);
  [-1.15, 0.25, 1.65, 3.05].forEach((x, index) => {
    const post = createBox(`queue-post-${index + 1}`, [0.055, 0.48, 0.055], [x, 0.24, -0.7], queueRailMaterial);
    lobby.add(post);
  });
  lobby.add(createBox('queue-rope-left', [1.4, 0.035, 0.035], [-0.45, 0.48, -0.7], fabricMaterial));
  lobby.add(createBox('queue-rope-center', [1.4, 0.035, 0.035], [0.95, 0.48, -0.7], fabricMaterial));
  lobby.add(createBox('queue-rope-right', [1.4, 0.035, 0.035], [2.35, 0.48, -0.7], fabricMaterial));

  [-3.8, 5.1].forEach((x, index) => {
    const column = new THREE.Group();
    column.name = `grand-lobby-column-${index + 1}`;
    column.add(createBox('column-base', [0.58, 0.16, 0.58], [0, 0.08, 0], goldMaterial));
    column.add(createBox('column-shaft', [0.34, 3.45, 0.34], [0, 1.84, 0], marbleColumnMaterial));
    column.add(createBox('column-capital', [0.62, 0.18, 0.62], [0, 3.6, 0], brassGlowMaterial));
    column.add(createBox('column-light-band', [0.42, 0.05, 0.42], [0, 2.75, 0], glowCyanMaterial));
    column.position.set(x, 0, -2.15);
    lobby.add(column);
  });

  const elevator = new THREE.Group();
  elevator.name = 'distant-elevators';
  elevator.add(createBox('elevator-frame', [1.95, 2.26, 0.08], [-3.58, 1.15, -4.08], trimMaterial));
  elevator.add(createBox('elevator-left-door', [0.88, 2.05, 0.04], [-3.82, 1.06, -4.02], createMat(0x475569, 0.42, 0.28)));
  elevator.add(createBox('elevator-right-door', [0.88, 2.05, 0.04], [-3.34, 1.06, -4.01], createMat(0x334155, 0.42, 0.28)));
  elevator.add(createBox('elevator-call-panel', [0.12, 0.42, 0.04], [-2.48, 1.04, -3.98], goldMaterial));
  lobby.add(elevator);

  const balconySign = createTextSprite('LOBBY ATRIUM', 384, 112);
  if (balconySign) {
    balconySign.position.set(4.62, 2.58, -4.08);
    balconySign.scale.set(1.08, 0.32, 1);
    lobby.add(balconySign);
  }

  lobby.add(createBox('far-left-runner-rug', [2.6, 0.016, 1.05], [-3.7, 0.006, 2.88], rugMaterial));
  lobby.add(createBox('far-right-runner-rug', [2.6, 0.016, 1.05], [5.0, 0.006, 2.88], rugMaterial));

  [-2.0, 0.2, 2.4].forEach((x, index) => {
    const art = new THREE.Group();
    art.name = `thai-lobby-wall-art-${index + 1}`;
    art.add(createBox('wall-art-frame', [0.78, 0.58, 0.04], [x, 2.18, -4.08], brassGlowMaterial));
    art.add(createBox('wall-art-canvas', [0.62, 0.42, 0.045], [x, 2.18, -4.04], createMat(index === 1 ? 0x0f766e : 0x7c2d12, 0.72, 0.02)));
    lobby.add(art);
  });

  return lobby;
}

const initialStats: ModelStats = {
  status: 'loading',
  message: 'Loading model...',
  meshCount: 0,
  triangleCount: 0,
  materialCount: 0,
  textureCount: 0,
  animationCount: 0,
  activeAnimation: 'None',
  dimensions: 'Pending',
  rigStatus: 'Checking',
};

function formatDimensions(size: THREE.Vector3) {
  return `${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`;
}

function countMaterialTextures(material: THREE.Material) {
  const materialValues = Object.values(material as unknown as Record<string, unknown>);
  return materialValues.filter((value) => value instanceof THREE.Texture).length;
}

function collectModelStats(model: THREE.Object3D, animations: THREE.AnimationClip[], dimensions: THREE.Vector3): ModelStats {
  let meshCount = 0;
  let triangleCount = 0;
  let skinnedMeshCount = 0;
  const materials = new Set<string>();
  let textureCount = 0;

  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    meshCount += 1;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      skinnedMeshCount += 1;
    }
    const geometry = mesh.geometry;
    const positionCount = geometry.attributes.position?.count ?? 0;
    triangleCount += geometry.index ? geometry.index.count / 3 : positionCount / 3;

    const materialList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materialList.forEach((material) => {
      if (!material) return;
      if (!materials.has(material.uuid)) {
        materials.add(material.uuid);
        textureCount += countMaterialTextures(material);
      }
    });
  });

  return {
    status: 'ready',
    message: 'Model loaded',
    meshCount,
    triangleCount: Math.round(triangleCount),
    materialCount: materials.size,
    textureCount,
    animationCount: animations.length,
    activeAnimation: animations[0]?.name || 'None',
    dimensions: formatDimensions(dimensions),
    rigStatus: skinnedMeshCount > 0 ? `${skinnedMeshCount} skinned mesh` : 'Single mesh',
  };
}

function prepareCharacterForDebugView(model: THREE.Object3D) {
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      if (!material) return;
      (material as THREE.Material & { fog?: boolean }).fog = false;
      material.needsUpdate = true;
    });
  });
}

function faceObjectToward(object: THREE.Object3D, target: THREE.Vector3) {
  const dx = target.x - object.position.x;
  const dz = target.z - object.position.z;
  if (Math.hypot(dx, dz) < 0.001) return;
  object.rotation.y = Math.atan2(dx, dz);
}

const levelPhaseCopy: Record<LevelPhase, { chip: string; title: string; body: string; action: string }> = {
  arrival: {
    chip: 'Arrival',
    title: 'Patrick lands in the lobby.',
    body: 'The rift is unstable. Su is waving from the lit corner and trying to get Patrick grounded.',
    action: 'Next',
  },
  'su-calls': {
    chip: 'Su',
    title: 'Su calls from across the room.',
    body: 'She knows Patrick by name and is telling him not to panic.',
    action: 'Next',
  },
  controls: {
    chip: 'Controls',
    title: 'Move Patrick to Su.',
    body: 'Click the glowing path or press Go To Su. Patrick walks or runs based on distance.',
    action: 'Go To Su',
  },
  'find-su': {
    chip: 'Objective',
    title: 'Talk to Su.',
    body: 'Follow the glowing path across the hotel lobby and start the first Thai lesson.',
    action: 'Talk To Su',
  },
  'walking-to-su': {
    chip: 'Moving',
    title: 'Patrick is heading to Su.',
    body: 'The camera is following Patrick into the lesson corner.',
    action: 'Walking',
  },
  talking: {
    chip: 'Conversation',
    title: 'Su starts the lesson.',
    body: 'Patrick and Su are facing each other. The practice panel is about to open.',
    action: 'Starting',
  },
  lesson: {
    chip: 'Lesson',
    title: 'Learn the lobby basics.',
    body: 'Hold Speak for the real mic judge, use Hear for guide audio, and clear the Stage 1 phrases.',
    action: 'Lesson Open',
  },
  complete: {
    chip: 'Stage Clear',
    title: 'The lobby rift calms down.',
    body: 'Su has enough confidence in Patrick to move him past the first lobby survival lesson.',
    action: 'Continue To Level 2',
  },
};

export function CharacterDebugPage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playAnimationRef = useRef<(id: string) => Promise<void>>(async () => {});
  const closeLessonRef = useRef<() => void>(() => {});
  const walkToSuRef = useRef<() => void>(() => {});
  const levelCompleteRef = useRef<() => void>(() => {});
  const autoRotateRef = useRef(false);
  const gridVisibleRef = useRef(true);
  const walkSpeedRef = useRef(1);
  const introInputUnlockedRef = useRef(false);
  const lessonOpenRef = useRef(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [gridVisible, setGridVisible] = useState(false);
  const [walkSpeed, setWalkSpeed] = useState(1);
  const [activeAnimation, setActiveAnimation] = useState('Loading');
  const [motionMode, setMotionMode] = useState<MotionMode>('idle');
  const [targetDistance, setTargetDistance] = useState(0);
  const [interactionPrompt, setInteractionPrompt] = useState('Su is waving from the lobby corner');
  const [availableAnimations, setAvailableAnimations] = useState<string[]>([]);
  const [stats, setStats] = useState<ModelStats>(initialStats);
  const [debugLessonState, setDebugLessonState] = useState<DebugLessonState>('hidden');
  const [debugPanelCollapsed, setDebugPanelCollapsed] = useState(true);
  const [levelPhase, setLevelPhase] = useState<LevelPhase>('arrival');
  const [introDialogueIndex, setIntroDialogueIndex] = useState(0);
  const [isIntroDialogueComplete, setIsIntroDialogueComplete] = useState(false);
  const [introMovieVisible, setIntroMovieVisible] = useState(true);
  const [introMovieReady, setIntroMovieReady] = useState(false);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);

  autoRotateRef.current = autoRotate;
  gridVisibleRef.current = gridVisible;
  walkSpeedRef.current = walkSpeed;
  const isLessonOpen = debugLessonState !== 'hidden';
  introInputUnlockedRef.current = isIntroDialogueComplete && !introMovieVisible;
  lessonOpenRef.current = isLessonOpen;
  const phaseCopy = levelPhaseCopy[levelPhase];
  const introLine = stageOneIntroLines[introDialogueIndex] ?? stageOneIntroLines[stageOneIntroLines.length - 1];
  const isFinalIntroLine = introDialogueIndex >= stageOneIntroLines.length - 1;

  useEffect(() => {
    if (introMovieVisible || isIntroDialogueComplete || levelPhase !== 'arrival') return;
    const timeoutId = window.setTimeout(() => {
      setLevelPhase('su-calls');
    }, 3600);
    return () => window.clearTimeout(timeoutId);
  }, [introMovieVisible, isIntroDialogueComplete, levelPhase]);

  useEffect(() => {
    if (introMovieVisible || isIntroDialogueComplete) return;
    const audioSrc = getStageOneSuAudioSrc(introLine.audioId);
    introAudioRef.current?.pause();
    introAudioRef.current = null;
    if (!audioSrc) return;

    const audio = new Audio(audioSrc);
    audio.volume = 0.9;
    introAudioRef.current = audio;
    void audio.play().catch(() => {
      introAudioRef.current = null;
    });

    return () => {
      audio.pause();
      if (introAudioRef.current === audio) introAudioRef.current = null;
    };
  }, [introMovieVisible, introLine.audioId, isIntroDialogueComplete]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let frameId = 0;
    let mixer: THREE.AnimationMixer | null = null;
    let suMixer: THREE.AnimationMixer | null = null;
    let modelRoot: THREE.Object3D | null = null;
    let suRoot: THREE.Object3D | null = null;
    let baseModelY = 0;
    let suBaseModelY = 0;
    let currentAction: THREE.AnimationAction | null = null;
    let currentSuAction: THREE.AnimationAction | null = null;
    let travelIntent: TravelIntent = 'free';
    let suConversationActive = false;
    const actionMap = new Map<string, THREE.AnimationAction>();
    const suActionMap = new Map<string, THREE.AnimationAction>();
    const moveTarget = new THREE.Vector3(SPAWN_POINT.x, 0, SPAWN_POINT.z);
    const scratchDirection = new THREE.Vector3();
    const cameraFocus = new THREE.Vector3(ROOM_CENTER_X + 1.1, 1.05, 0.7);
    const cameraDesiredPosition = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const floorHit = new THREE.Vector3();
    const pointerStart = new THREE.Vector2();
    const loadedClips: THREE.AnimationClip[] = [];
    const loadingActions = new Map<string, Promise<boolean>>();
    const suClickTargets: THREE.Object3D[] = [];
    const loadingSuActions = new Map<string, Promise<boolean>>();

    let lastFrameTime = performance.now();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1423);
    scene.fog = new THREE.Fog(0x0a1423, ROOM_FOG_NEAR, ROOM_FOG_FAR);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, CAMERA_FAR_PLANE);
    camera.position.set(2.8, 1.6, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = false;
    renderer.domElement.dataset.testid = 'character-debug-canvas';
    renderer.domElement.className = 'h-full w-full';
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotateSpeed = 0.75;
    controls.enablePan = false;
    controls.minDistance = 3.2;
    controls.maxDistance = 9.5;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.target.set(0, 1, 0);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 4.4);
    keyLight.position.set(2.4, 5.4, 3.2);
    keyLight.castShadow = false;
    scene.add(keyLight);
    scene.add(new THREE.HemisphereLight(0xbde7ff, 0x351f40, 2.2));

    const rimLight = new THREE.DirectionalLight(0x6ee7ff, 2.1);
    rimLight.position.set(-4, 2.5, -3);
    scene.add(rimLight);

    const playerLight = new THREE.PointLight(0xfef3c7, 1.4, 4.2);
    playerLight.position.set(SPAWN_POINT.x, 1.45, SPAWN_POINT.z + 0.9);
    scene.add(playerLight);

    const lobby = createHotelLobbyMockup();
    scene.add(lobby);

    const grid = new THREE.GridHelper(8.8, 22, 0x55e7ff, 0x25415f);
    grid.position.set(ROOM_CENTER_X, 0.01, 0.15);
    scene.add(grid);

    const axes = new THREE.AxesHelper(1.25);
    axes.position.y = 0.01;
    scene.add(axes);

    const runway = new THREE.Group();
    const runwayMaterial = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.26 });
    const runwayGeometry = new THREE.BoxGeometry(3.2, 0.012, 0.035);
    const runwayLine = new THREE.Mesh(runwayGeometry, runwayMaterial);
    runwayLine.position.set(WALK_CENTER_X, 0.018, 0.86);
    runway.add(runwayLine);

    const footstepGeometry = new THREE.CircleGeometry(0.055, 20);
    const leftFootstepMaterial = new THREE.MeshBasicMaterial({ color: 0xf0abfc, transparent: true, opacity: 0.72 });
    const rightFootstepMaterial = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.72 });
    const leftFootstep = new THREE.Mesh(footstepGeometry, leftFootstepMaterial);
    const rightFootstep = new THREE.Mesh(footstepGeometry, rightFootstepMaterial);
    leftFootstep.rotation.x = -Math.PI / 2;
    rightFootstep.rotation.x = -Math.PI / 2;
    leftFootstep.position.set(WALK_CENTER_X - 0.62, 0.026, 0.78);
    rightFootstep.position.set(WALK_CENTER_X + 0.62, 0.026, 0.94);
    runway.add(leftFootstep, rightFootstep);
    scene.add(runway);

    const targetMarker = new THREE.Group();
    targetMarker.name = 'click-to-move-target-marker';
    const targetRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.012, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xf0abfc, transparent: true, opacity: 0.9 }),
    );
    targetRing.rotation.x = Math.PI / 2;
    const targetPulse = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 32),
      new THREE.MeshBasicMaterial({ color: 0xf0abfc, transparent: true, opacity: 0.16 }),
    );
    targetPulse.rotation.x = -Math.PI / 2;
    targetMarker.add(targetRing, targetPulse);
    targetMarker.position.set(SPAWN_POINT.x, 0.035, SPAWN_POINT.z);
    targetMarker.visible = false;
    scene.add(targetMarker);

    const suInteractionMarker = new THREE.Group();
    suInteractionMarker.name = 'su-interaction-marker';
    const suInteractionRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.014, 8, 46),
      new THREE.MeshBasicMaterial({ color: 0xf9a8d4, transparent: true, opacity: 0.85 }),
    );
    suInteractionRing.rotation.x = Math.PI / 2;
    const suInteractionPulse = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 32),
      new THREE.MeshBasicMaterial({ color: 0xf9a8d4, transparent: true, opacity: 0.12 }),
    );
    suInteractionPulse.rotation.x = -Math.PI / 2;
    suInteractionMarker.add(suInteractionRing, suInteractionPulse);
    suInteractionMarker.position.set(SU_SPAWN_POINT.x, 0.035, SU_SPAWN_POINT.z);
    scene.add(suInteractionMarker);

    const suObjectiveBeacon = new THREE.Group();
    suObjectiveBeacon.name = 'su-objective-beacon';
    const beaconHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.018, 8, 56),
      new THREE.MeshBasicMaterial({ color: 0xf9a8d4, transparent: true, opacity: 0.8 }),
    );
    beaconHalo.rotation.x = Math.PI / 2;
    const beaconOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xfbcfe8, transparent: true, opacity: 0.92 }),
    );
    const beaconLight = new THREE.PointLight(0xf9a8d4, 1.7, 3.2);
    beaconLight.position.y = 0.15;
    suObjectiveBeacon.add(beaconHalo, beaconOrb, beaconLight);
    suObjectiveBeacon.position.set(SU_SPAWN_POINT.x, 2.64, SU_SPAWN_POINT.z);
    scene.add(suObjectiveBeacon);

    const suNameTag = createTextSprite('TALK TO SU', 384, 112);
    if (suNameTag) {
      suNameTag.position.set(SU_SPAWN_POINT.x, 2.98, SU_SPAWN_POINT.z);
      suNameTag.scale.set(1.05, 0.32, 1);
      scene.add(suNameTag);
    }

    const loader = new GLTFLoader();

    const loadAction = async (id: string) => {
      if (actionMap.has(id)) return true;
      if (!mixer || !modelRoot) return false;

      const source = animationSources.find((candidate) => candidate.id === id);
      if (!source) return false;

      const existingLoad = loadingActions.get(id);
      if (existingLoad) return existingLoad;

      const loadPromise = loader
        .loadAsync(source.url)
        .then((animationGltf) => {
          if (disposed || !mixer || !modelRoot) return false;
          const clip = animationGltf.animations[0]?.clone();
          if (!clip) return false;

          clip.name = source.label;
          loadedClips.push(clip);

          const action = mixer.clipAction(clip, modelRoot);
          action.enabled = true;
          action.setEffectiveWeight(1);
          actionMap.set(id, action);

          setAvailableAnimations(Array.from(actionMap.keys()));
          setStats((currentStats) => ({
            ...currentStats,
            animationCount: animationSources.length,
          }));
          return true;
        })
        .catch(() => false)
        .finally(() => {
          loadingActions.delete(id);
        });

      loadingActions.set(id, loadPromise);
      return loadPromise;
    };

    const loadSuAction = async (id: string) => {
      if (suActionMap.has(id)) return true;
      if (!suMixer || !suRoot) return false;

      const source = suAnimationSources.find((candidate) => candidate.id === id);
      if (!source) return false;

      const existingLoad = loadingSuActions.get(id);
      if (existingLoad) return existingLoad;

      const loadPromise = loader
        .loadAsync(source.url)
        .then((animationGltf) => {
          if (disposed || !suMixer || !suRoot) return false;
          const clip = animationGltf.animations[0]?.clone();
          if (!clip) return false;

          clip.name = source.label;
          const action = suMixer.clipAction(clip, suRoot);
          action.enabled = true;
          action.setEffectiveWeight(1);
          suActionMap.set(id, action);
          return true;
        })
        .catch(() => false)
        .finally(() => {
          loadingSuActions.delete(id);
        });

      loadingSuActions.set(id, loadPromise);
      return loadPromise;
    };

    const playAction = (id: string, fadeDuration = 0.18) => {
      const nextAction = actionMap.get(id);
      if (!nextAction || nextAction === currentAction) return;

      nextAction.reset();
      nextAction.enabled = true;
      nextAction.setEffectiveWeight(1);
      nextAction.setEffectiveTimeScale(id === 'run' ? Math.max(0.9, walkSpeedRef.current) : 1);
      nextAction.play();

      if (currentAction) {
        currentAction.crossFadeTo(nextAction, fadeDuration, false);
      }

      currentAction = nextAction;
      setActiveAnimation(animationSources.find((source) => source.id === id)?.label ?? id);
    };

    const playSuAction = (id: string, fadeDuration = 0.18) => {
      const nextAction = suActionMap.get(id);
      if (!nextAction || nextAction === currentSuAction) return;

      nextAction.reset();
      nextAction.enabled = true;
      nextAction.setEffectiveWeight(1);
      nextAction.play();

      if (currentSuAction) {
        currentSuAction.crossFadeTo(nextAction, fadeDuration, false);
      }

      currentSuAction = nextAction;
    };

    const playSuWave = () => {
      if (suActionMap.has('wave')) {
        playSuAction('wave', 0.2);
        setInteractionPrompt('Su is waving from the lobby corner');
        setLevelPhase((phase) => (phase === 'complete' ? phase : 'find-su'));
      }
    };

    const closeSuLesson = () => {
      travelIntent = 'free';
      suConversationActive = false;
      targetMarker.visible = false;
      setTargetDistance(0);
      setMotionMode('idle');
      setInteractionPrompt('Su is waving from the lobby corner');
      setLevelPhase('find-su');
      if (modelRoot) {
        moveTarget.copy(modelRoot.position);
        faceObjectToward(modelRoot, suRoot?.position ?? SU_SPAWN_POINT);
        playAction('idle', 0.18);
      }
      playSuWave();
    };
    closeLessonRef.current = closeSuLesson;

    const startSuConversation = async () => {
      if (!modelRoot || !suRoot || suConversationActive) return;
      suConversationActive = true;
      setInteractionPrompt('Patrick and Su are talking');
      setDebugLessonState('lesson');
      setDebugPanelCollapsed(true);
      setLevelPhase('talking');
      setMotionMode('manual');
      faceObjectToward(modelRoot, suRoot.position);
      faceObjectToward(suRoot, modelRoot.position);

      const [patrickTalkLoaded, suTalkLoaded] = await Promise.all([loadAction('talk'), loadSuAction('talk')]);
      if (disposed || travelIntent !== 'su' || !suConversationActive) return;
      if (patrickTalkLoaded) playAction('talk', 0.16);
      if (suTalkLoaded) playSuAction('talk', 0.16);
      window.setTimeout(() => {
        if (!disposed && suConversationActive) setLevelPhase('lesson');
      }, 550);
    };

    const playManualAction = async (id: string) => {
      moveTarget.copy(modelRoot?.position ?? SPAWN_POINT);
      travelIntent = 'free';
      suConversationActive = false;
      targetMarker.visible = false;
      setDebugLessonState('hidden');
      setLevelPhase('find-su');
      playSuWave();
      setMotionMode('manual');
      setInteractionPrompt('Manual animation preview');
      setTargetDistance(0);
      const source = animationSources.find((candidate) => candidate.id === id);
      if (!actionMap.has(id)) {
        setActiveAnimation(`Loading ${source?.label ?? id}`);
        const loaded = await loadAction(id);
        if (!loaded) return;
      }
      playAction(id, 0.16);
    };
    playAnimationRef.current = playManualAction;

    const setTravelTarget = (target: THREE.Vector3, intent: TravelIntent = 'free') => {
      if (!modelRoot) return;
      travelIntent = intent;
      suConversationActive = false;
      if (intent === 'free') {
        setDebugLessonState('hidden');
        setLevelPhase('find-su');
        playSuWave();
      }

      moveTarget.set(
        THREE.MathUtils.clamp(target.x, ROOM_BOUNDS.minX, ROOM_BOUNDS.maxX),
        baseModelY,
        THREE.MathUtils.clamp(target.z, ROOM_BOUNDS.minZ, ROOM_BOUNDS.maxZ),
      );

      targetMarker.position.set(moveTarget.x, 0.035, moveTarget.z);
      targetMarker.visible = true;

      const distance = modelRoot.position.distanceTo(moveTarget);
      const nextMode: MotionMode = distance > RUN_DISTANCE ? 'running' : 'walking';
      setMotionMode(nextMode);
      setInteractionPrompt(intent === 'su' ? 'Patrick is walking over to Su' : 'Click Su to start a conversation');
      setLevelPhase(intent === 'su' ? 'walking-to-su' : 'find-su');
      setTargetDistance(distance);
      playAction(nextMode === 'running' ? 'run' : 'walk', 0.14);
    };

    const walkToSu = () => {
      if (!modelRoot) return;
      setTravelTarget(SU_APPROACH_POINT, 'su');
    };
    walkToSuRef.current = walkToSu;

    levelCompleteRef.current = async () => {
      setDebugLessonState('complete');
      setLevelPhase('complete');
      setInteractionPrompt('The rift calms down. Su has cleared Patrick for the lobby basics.');
      if (modelRoot) {
        const loaded = await loadAction('victory');
        if (!disposed && loaded) playAction('victory', 0.2);
      }
      if (suRoot) {
        const loaded = await loadSuAction('wave');
        if (!disposed && loaded) playSuAction('wave', 0.2);
      }
    };

    const updateGameCamera = () => {
      if (!modelRoot) return;

      if (suConversationActive && suRoot) {
        cameraFocus
          .copy(modelRoot.position)
          .add(suRoot.position)
          .multiplyScalar(0.5);
        cameraFocus.y = 1.12;
        cameraDesiredPosition.copy(cameraFocus).add(CAMERA_TALK_OFFSET);
      } else {
        const blendedFocusX = suRoot ? modelRoot.position.x * 0.55 + suRoot.position.x * 0.45 : modelRoot.position.x + 0.35;
        const blendedFocusZ = suRoot ? modelRoot.position.z * 0.55 + suRoot.position.z * 0.45 : modelRoot.position.z + 0.24;
        cameraFocus.set(
          THREE.MathUtils.clamp(blendedFocusX, ROOM_BOUNDS.minX + 1.6, ROOM_BOUNDS.maxX - 1.2),
          1.18,
          THREE.MathUtils.clamp(blendedFocusZ, ROOM_BOUNDS.minZ + 1.2, ROOM_BOUNDS.maxZ - 0.95),
        );
        cameraDesiredPosition.copy(cameraFocus).add(CAMERA_FOLLOW_OFFSET);
      }

      controls.target.lerp(cameraFocus, 0.06);
      if (!autoRotateRef.current) {
        camera.position.lerp(cameraDesiredPosition, 0.045);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      pointerStart.set(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 6) return;
      if (!introInputUnlockedRef.current || lessonOpenRef.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );

      raycaster.setFromCamera(pointer, camera);
      const suHits = raycaster.intersectObjects(suClickTargets, true);
      if (suHits.length > 0) {
        walkToSu();
        return;
      }

      if (raycaster.ray.intersectPlane(floorPlane, floorHit)) {
        setTravelTarget(floorHit);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    async function loadCharacter() {
      try {
        const gltf = await loader.loadAsync(mainCharacterModelUrl);
        if (disposed) return;

        const model = gltf.scene;
        modelRoot = model;
        model.visible = false;
        prepareCharacterForDebugView(model);
        scene.add(model);
        model.updateMatrixWorld(true);

        const unscaledBox = new THREE.Box3().setFromObject(model);
        const unscaledSize = unscaledBox.getSize(new THREE.Vector3());
        const maxAxis = Math.max(unscaledSize.x, unscaledSize.y, unscaledSize.z);
        model.scale.setScalar(maxAxis > 0 ? 2.2 / maxAxis : 1);
        model.updateMatrixWorld(true);

        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        model.position.x -= scaledCenter.x;
        model.position.y -= scaledBox.min.y;
        model.position.z -= scaledCenter.z;
        model.updateMatrixWorld(true);

        const fittedBox = new THREE.Box3().setFromObject(model);
        const fittedSize = fittedBox.getSize(new THREE.Vector3());
        const fittedRadius = Math.max(fittedSize.length() * 0.5, 1.6);
        const targetY = Math.max(fittedSize.y * 0.48, 0.75);
        baseModelY = model.position.y;
        model.position.set(SPAWN_POINT.x, baseModelY, SPAWN_POINT.z);
        moveTarget.set(SPAWN_POINT.x, baseModelY, SPAWN_POINT.z);

        controls.target.set(SPAWN_POINT.x + 0.35, Math.max(targetY * 0.95, 1.1), SPAWN_POINT.z + 0.24);
        camera.position.copy(controls.target).add(CAMERA_FOLLOW_OFFSET);
        camera.near = Math.max(fittedRadius / 100, 0.01);
        camera.far = CAMERA_FAR_PLANE;
        camera.updateProjectionMatrix();
        controls.update();

        mixer = new THREE.AnimationMixer(model);
        const preloadIds = animationSources.filter((source) => source.preload).map((source) => source.id);
        await Promise.all(preloadIds.map((id) => loadAction(id)));
        if (disposed) return;

        playAction(actionMap.has('idle') ? 'idle' : loadedClips[0]?.name ?? 'idle', 0);
        mixer.update(0.016);
        model.visible = true;
        setAvailableAnimations(Array.from(actionMap.keys()));
        setMotionMode('idle');
        setStats({
          ...collectModelStats(model, loadedClips, fittedSize),
          animationCount: animationSources.length,
          activeAnimation: 'Idle',
        });
      } catch (error) {
        if (disposed) return;
        setStats({
          ...initialStats,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to load model.',
        });
      }
    }

    async function loadSu() {
      try {
        const gltf = await loader.loadAsync(suModelUrl);
        if (disposed) return;

        const model = gltf.scene;
        suRoot = model;
        model.visible = false;
        prepareCharacterForDebugView(model);
        scene.add(model);
        model.updateMatrixWorld(true);

        const unscaledBox = new THREE.Box3().setFromObject(model);
        const unscaledSize = unscaledBox.getSize(new THREE.Vector3());
        const maxAxis = Math.max(unscaledSize.x, unscaledSize.y, unscaledSize.z);
        model.scale.setScalar(maxAxis > 0 ? 1.85 / maxAxis : 1);
        model.updateMatrixWorld(true);

        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        model.position.x -= scaledCenter.x;
        model.position.y -= scaledBox.min.y;
        model.position.z -= scaledCenter.z;
        model.updateMatrixWorld(true);

        suBaseModelY = model.position.y;
        model.position.set(SU_SPAWN_POINT.x, suBaseModelY, SU_SPAWN_POINT.z);
        faceObjectToward(model, SU_APPROACH_POINT);

        suMixer = new THREE.AnimationMixer(model);
        const preloadIds = suAnimationSources.filter((source) => source.preload).map((source) => source.id);
        await Promise.all(preloadIds.map((id) => loadSuAction(id)));
        if (disposed) return;

        playSuAction(suActionMap.has('wave') ? 'wave' : 'idle', 0);
        suMixer.update(0.016);
        model.visible = true;

        const clickCollider = new THREE.Mesh(
          new THREE.CylinderGeometry(1.45, 1.45, 2.85, 24),
          new THREE.MeshBasicMaterial({ color: 0xf9a8d4, transparent: true, opacity: 0, depthWrite: false }),
        );
        clickCollider.name = 'su-click-target';
        clickCollider.position.set(SU_SPAWN_POINT.x, 1.42, SU_SPAWN_POINT.z);
        scene.add(clickCollider);
        suClickTargets.push(clickCollider);
        setInteractionPrompt('Su is waving from the lobby corner');
      } catch (error) {
        if (disposed) return;
        setInteractionPrompt(error instanceof Error ? `Su failed to load: ${error.message}` : 'Su failed to load');
      }
    }

    void loadCharacter();
    void loadSu();

    const render = () => {
      const now = performance.now();
      const delta = Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;
      mixer?.update(delta);
      suMixer?.update(delta);

      if (modelRoot) {
        playerLight.position.set(modelRoot.position.x, 1.45, modelRoot.position.z + 0.82);
        scratchDirection.set(moveTarget.x - modelRoot.position.x, 0, moveTarget.z - modelRoot.position.z);
        const remainingDistance = scratchDirection.length();
        setTargetDistance((previousDistance) =>
          Math.abs(previousDistance - remainingDistance) > 0.04 ? remainingDistance : previousDistance,
        );

        if (remainingDistance > 0.035) {
          const isRunning = remainingDistance > RUN_DISTANCE;
          const moveSpeed = (isRunning ? RUN_SPEED : WALK_SPEED) * walkSpeedRef.current;
          scratchDirection.normalize();
          const step = Math.min(remainingDistance, moveSpeed * delta);
          modelRoot.position.x += scratchDirection.x * step;
          modelRoot.position.z += scratchDirection.z * step;
          modelRoot.position.y = baseModelY;
          modelRoot.rotation.y = Math.atan2(scratchDirection.x, scratchDirection.z);

          const nextMode: MotionMode = isRunning ? 'running' : 'walking';
          setMotionMode((previousMode) => (previousMode === nextMode ? previousMode : nextMode));
          playAction(isRunning ? 'run' : 'walk', 0.12);
          leftFootstepMaterial.opacity = 0.28;
          rightFootstepMaterial.opacity = 0.28;
        } else if (targetMarker.visible) {
          modelRoot.position.set(moveTarget.x, baseModelY, moveTarget.z);
          targetMarker.visible = false;
          setTargetDistance(0);
          if (travelIntent === 'su') {
            void startSuConversation();
          } else {
            setMotionMode('idle');
            setInteractionPrompt('Click Su to start a conversation');
            playAction('idle', 0.18);
          }
        }
      }

      if (suRoot && !suConversationActive) {
        suRoot.position.y = suBaseModelY;
        faceObjectToward(suRoot, modelRoot?.position ?? SU_APPROACH_POINT);
      }
      suObjectiveBeacon.position.y = 2.64 + Math.sin(now * 0.004) * 0.12;
      suObjectiveBeacon.visible = !suConversationActive;
      suNameTag && (suNameTag.visible = !suConversationActive);
      beaconHalo.rotation.z += delta * 1.35;
      beaconHalo.scale.setScalar(1 + Math.sin(now * 0.005) * 0.08);
      beaconOrb.scale.setScalar(1 + Math.sin(now * 0.006) * 0.16);
      suInteractionPulse.scale.setScalar(1 + Math.sin(now * 0.004) * 0.12);
      suInteractionRing.rotation.z += delta * 0.65;

      controls.autoRotate = autoRotateRef.current;
      grid.visible = gridVisibleRef.current;
      axes.visible = gridVisibleRef.current;
      runway.visible = gridVisibleRef.current;
      updateGameCamera();
      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };

    render();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      playAnimationRef.current = async () => {};
      closeLessonRef.current = () => {};
      walkToSuRef.current = () => {};
      levelCompleteRef.current = () => {};
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materialList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materialList.forEach((material) => material?.dispose());
      });
      renderer.domElement.remove();
    };
  }, []);

  function closeDebugLesson() {
    setDebugLessonState('hidden');
    setDebugPanelCollapsed(true);
    closeLessonRef.current();
  }

  function finishIntroMovie() {
    setIntroMovieVisible(false);
    setIntroMovieReady(true);
    setLevelPhase('arrival');
    setIntroDialogueIndex(0);
    setIsIntroDialogueComplete(false);
    setInteractionPrompt('Su is waving from the lobby corner');
  }

  function advanceIntroDialogue() {
    introAudioRef.current?.pause();
    introAudioRef.current = null;
    if (introDialogueIndex < stageOneIntroLines.length - 1) {
      const nextIndex = introDialogueIndex + 1;
      setIntroDialogueIndex(nextIndex);
      const nextLine = stageOneIntroLines[nextIndex];
      if (nextLine.id === 'su-hello') setLevelPhase('su-calls');
      if (nextLine.id === 'su-approach' || nextLine.id === 'su-training') setLevelPhase('controls');
      return;
    }

    setIsIntroDialogueComplete(true);
    setLevelPhase('find-su');
    setInteractionPrompt('Follow the glowing path to Su');
  }

  function continueToThreeLevelTwo() {
    const saveData = {
      hasStarted: true,
      completedTutorial: true,
      activeScenarioIndex: 1,
      completedScenarioIds: [lessonScenarios[0].id],
      lastPlayerPosition: suPosition,
    };
    writeSave(saveData);
    const baseUrl = import.meta.env.BASE_URL;
    window.location.assign(`${baseUrl}${baseUrl.endsWith('/') ? '' : '/'}level-2-debug`);
  }

  return (
    <main className="relative h-dvh min-h-[620px] w-screen overflow-hidden bg-slate-950 text-slate-50">
      <div ref={mountRef} className="absolute inset-0" aria-label="3D character debug viewport" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(34,211,238,0.14),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.12),rgba(2,6,23,0.72))]" />
      {isLessonOpen ? <div className="pointer-events-none absolute inset-0 z-40 bg-slate-950/38 transition-opacity" /> : null}

      {introMovieVisible ? (
        <section className="absolute inset-0 z-[70] grid bg-slate-950 text-white">
          <video
            src={introOneMovieUrl}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
            preload="auto"
            onCanPlay={() => setIntroMovieReady(true)}
            onPlaying={() => setIntroMovieReady(true)}
            onEnded={finishIntroMovie}
            onError={finishIntroMovie}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.18),rgba(2,6,23,0.24)_48%,rgba(2,6,23,0.74))]" />
          <div className="absolute bottom-6 left-4 right-4 flex flex-wrap items-end justify-between gap-4 sm:bottom-8 sm:left-8 sm:right-8">
            <div className="max-w-xl border border-cyan-100/30 bg-slate-950/62 px-4 py-3 backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">Loading Level 1</p>
              <h2 className="mt-1 text-xl font-black uppercase tracking-[0.08em] text-white sm:text-2xl">Hotel Lobby Arrival</h2>
              <p className="mt-2 text-xs font-bold leading-snug text-cyan-50/80">
                {introMovieReady ? 'Intro playing while the 3D lobby loads behind it.' : 'Preparing intro video and 3D lobby assets.'}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full border border-cyan-100/25 bg-white/10">
                <div
                  className={`h-full rounded-full bg-cyan-300 transition-all duration-500 ${
                    stats.status === 'ready' ? 'w-full' : introMovieReady ? 'w-2/3' : 'w-1/3'
                  }`}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={finishIntroMovie}
              className="pointer-events-auto border border-white/35 bg-white/14 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-white backdrop-blur-md hover:bg-white/24"
            >
              Skip Intro
            </button>
          </div>
        </section>
      ) : null}

      <section
        className={`pointer-events-auto absolute left-4 top-4 z-10 max-w-[min(24rem,calc(100vw-2rem))] border border-cyan-100/35 bg-slate-950/74 p-4 shadow-[0_0_38px_rgba(34,211,238,0.18)] backdrop-blur-md sm:left-6 sm:top-6 ${
          isLessonOpen ? 'max-h-[34dvh] overflow-y-auto' : ''
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Local 3D Level 1</p>
            <h1 className="mt-1 text-lg font-black uppercase tracking-[0.08em] text-white sm:text-xl">Hotel Lobby Arrival</h1>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-fuchsia-100">
              Objective: Meet Su and practice Thai
            </p>
          </div>
          <a
            href={import.meta.env.BASE_URL}
            className="border border-cyan-200/50 bg-cyan-300/16 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-50 hover:bg-cyan-300/28"
          >
            Game
          </a>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDebugPanelCollapsed((value) => !value)}
            className="border border-cyan-200/50 bg-cyan-300/16 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-50 hover:bg-cyan-300/28"
          >
            {debugPanelCollapsed ? 'Debug Stats' : 'Hide Debug'}
          </button>
          {isLessonOpen ? (
            <button
              type="button"
              onClick={closeDebugLesson}
              className="border border-fuchsia-200/50 bg-fuchsia-300/16 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-fuchsia-50 hover:bg-fuchsia-300/28"
            >
              Close Lesson
            </button>
          ) : null}
        </div>

        {debugPanelCollapsed ? (
          <div className="grid gap-3">
            <div className="border border-cyan-100/25 bg-cyan-300/10 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="rounded-full border border-cyan-100/35 bg-slate-950/60 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
                  {phaseCopy.chip}
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100/70">
                  Level 1
                </span>
              </div>
              <p className="text-base font-black leading-tight text-white">{phaseCopy.title}</p>
              <p className="mt-2 text-xs font-bold leading-snug text-cyan-50/78">{phaseCopy.body}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!isIntroDialogueComplete) {
                  advanceIntroDialogue();
                  return;
                }
                if (levelPhase === 'complete') {
                  continueToThreeLevelTwo();
                  return;
                }
                walkToSuRef.current();
              }}
              disabled={
                introMovieVisible ||
                levelPhase === 'walking-to-su' ||
                levelPhase === 'lesson' ||
                levelPhase === 'talking' ||
                stats.status !== 'ready'
              }
              className="border border-fuchsia-100/50 bg-fuchsia-300 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.14em] text-slate-950 shadow-[0_0_24px_rgba(244,114,182,0.24)] disabled:cursor-not-allowed disabled:border-white/20 disabled:bg-white/15 disabled:text-white/55"
            >
              {stats.status === 'ready' ? phaseCopy.action : 'Loading Lobby'}
            </button>
          </div>
        ) : null}

        {!debugPanelCollapsed ? (
          <p className="break-all text-xs font-bold leading-relaxed text-slate-300">
            Patrick: {MODEL_FILE_NAME}
            <br />
            Su: {SU_FILE_NAME}
          </p>
        ) : null}
        {!debugPanelCollapsed ? <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-slate-200">
          <div className="border border-white/15 bg-white/10 px-3 py-2">
            <span className="block text-cyan-200">Status</span>
            {stats.message}
          </div>
          {!debugPanelCollapsed ? (
            <>
              <div className="border border-white/15 bg-white/10 px-3 py-2">
                <span className="block text-cyan-200">Size</span>
                {stats.dimensions}
              </div>
              <div className="border border-white/15 bg-white/10 px-3 py-2">
                <span className="block text-cyan-200">Meshes</span>
                {stats.meshCount}
              </div>
              <div className="border border-white/15 bg-white/10 px-3 py-2">
                <span className="block text-cyan-200">Triangles</span>
                {stats.triangleCount.toLocaleString()}
              </div>
              <div className="border border-white/15 bg-white/10 px-3 py-2">
                <span className="block text-cyan-200">Materials</span>
                {stats.materialCount}
              </div>
              <div className="border border-white/15 bg-white/10 px-3 py-2">
                <span className="block text-cyan-200">Textures</span>
                {stats.textureCount}
              </div>
              <div className="border border-white/15 bg-white/10 px-3 py-2">
                <span className="block text-cyan-200">Animations</span>
                {stats.animationCount}
              </div>
            </>
          ) : null}
          <div className="border border-white/15 bg-white/10 px-3 py-2">
            <span className="block text-cyan-200">Playing</span>
            {activeAnimation}
          </div>
          {!debugPanelCollapsed ? (
            <>
              <div className="border border-white/15 bg-white/10 px-3 py-2">
                <span className="block text-cyan-200">Rig</span>
                {stats.rigStatus}
              </div>
              <div className="border border-white/15 bg-white/10 px-3 py-2">
                <span className="block text-cyan-200">Travel Speed</span>
                {walkSpeed.toFixed(1)}x
              </div>
            </>
          ) : null}
          <div className="border border-white/15 bg-white/10 px-3 py-2">
            <span className="block text-cyan-200">Mode</span>
            {motionMode}
          </div>
          <div className="border border-white/15 bg-white/10 px-3 py-2">
            <span className="block text-cyan-200">Target</span>
            {targetDistance > 0.05 ? `${targetDistance.toFixed(1)}m` : 'None'}
          </div>
          <div className="col-span-2 border border-fuchsia-200/25 bg-fuchsia-300/10 px-3 py-2">
            <span className="block text-fuchsia-100">Interaction</span>
            {interactionPrompt}
          </div>
        </div> : null}

        {stats.status === 'error' ? (
          <p className="mt-3 border border-red-200/40 bg-red-500/14 px-3 py-2 text-xs font-bold text-red-100">
            Check that the debug GLB files remain in src/assets/debug and can be imported by Vite.
          </p>
        ) : null}

        {!debugPanelCollapsed ? <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAutoRotate((value) => !value)}
            className="border border-cyan-200/50 bg-cyan-300 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.18)]"
          >
            {autoRotate ? 'Pause Spin' : 'Auto Spin'}
          </button>
          <button
            type="button"
            onClick={() => setGridVisible((value) => !value)}
            className="border border-white/25 bg-white/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white"
          >
            {gridVisible ? 'Hide Grid' : 'Show Grid'}
          </button>
        </div> : null}

        {!debugPanelCollapsed ? <p className="mt-4 border border-fuchsia-200/30 bg-fuchsia-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-fuchsia-50">
          Click the floor to move Patrick. Click Su's glowing corner to start the Level 1 lesson.
        </p> : null}

        {!debugPanelCollapsed ? <div className="mt-3 grid grid-cols-2 gap-2">
          {animationSources.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => {
                void playAnimationRef.current(source.id);
              }}
              className={`border px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] text-white ${
                availableAnimations.includes(source.id)
                  ? 'border-cyan-200/45 bg-cyan-300/18'
                  : 'border-white/25 bg-white/12'
              }`}
            >
              {source.label}
            </button>
          ))}
        </div> : null}

        {!debugPanelCollapsed ? <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
          Travel Speed
          <input
            type="range"
            min="0.4"
            max="2.2"
            step="0.1"
            value={walkSpeed}
            onChange={(event) => setWalkSpeed(Number(event.currentTarget.value))}
            className="mt-2 block w-full accent-fuchsia-300"
          />
        </label> : null}
        {!debugPanelCollapsed ? <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setWalkSpeed((value) => Math.max(0.4, Number((value - 0.1).toFixed(1))))}
            className="border border-white/25 bg-white/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white"
          >
            Slower
          </button>
          <button
            type="button"
            onClick={() => setWalkSpeed(1)}
            className="border border-white/25 bg-white/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white"
          >
            1x
          </button>
          <button
            type="button"
            onClick={() => setWalkSpeed((value) => Math.min(2.2, Number((value + 0.1).toFixed(1))))}
            className="border border-white/25 bg-white/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white"
          >
            Faster
          </button>
        </div> : null}
      </section>

      {!introMovieVisible && !isIntroDialogueComplete && !isLessonOpen ? (
        <CharacterDebugIntroDialogue
          line={introLine}
          index={introDialogueIndex}
          total={stageOneIntroLines.length}
          isFinalLine={isFinalIntroLine}
          onAdvance={advanceIntroDialogue}
        />
      ) : null}

      {isLessonOpen ? (
        <CharacterDebugLessonOverlay
          onClose={closeDebugLesson}
          onComplete={() => levelCompleteRef.current()}
          onContinueToLevelTwo={continueToThreeLevelTwo}
        />
      ) : null}

      {!isLessonOpen && isIntroDialogueComplete ? <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 flex flex-wrap justify-between gap-3 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/80 sm:bottom-6 sm:left-6 sm:right-6">
        <span>Click floor to move</span>
        <span>Follow the glowing path to Su</span>
        <span>Scroll to zoom</span>
      </div> : null}
    </main>
  );
}
