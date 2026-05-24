import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import deadAnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Dead_withSkin.glb?url';
import depressedTurnAnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Depressed_Full_Turn_Left_withSkin.glb?url';
import idleAnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Idle_02_withSkin.glb?url';
import idleAltAnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Idle_03_withSkin.glb?url';
import runningAnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Running_withSkin.glb?url';
import talkAnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Talk_Passionately_withSkin.glb?url';
import victoryAnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Victory_Cheer_withSkin.glb?url';
import walkingAnimationUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Animation_Walking_withSkin.glb?url';
import patrickModelUrl from '../assets/debug/patrick-rig/Meshy_AI_Red_Jacket_Rebel_biped_Character_output.glb?url';
import {
  adventureVerbs,
  getInventoryItem,
  getMissingInventoryItems,
  getPointClickRoom,
  levelTwoRooms,
  type AdventureCommand,
  type AdventureConversationId,
  type AdventureHotspot,
  type InventoryItemId,
  type PointClickRoomId,
} from '../data/pointClickLevel2';
import { getVoiceJudgeMode, VOICE_JUDGE_MODE_CHANGED_EVENT, type VoiceJudgeMode } from '../services/openAiSettings';
import {
  createPronunciationSession,
  type PronunciationPrompt,
  type PronunciationSession,
  type PronunciationVerdict,
} from '../services/realtimePronunciation';
import { createWhisperPronunciationSession } from '../services/whisperPronunciation';
import { SuPronunciationJudge } from './SuPronunciationJudge';

type ActiveAdventureCommand = {
  hotspot: AdventureHotspot;
  command: AdventureCommand;
};

type ActiveAdventureConversation = ActiveAdventureCommand & {
  conversationId: AdventureConversationId;
  turnIndex: number;
};

type SceneRefs = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  floor: THREE.Mesh;
  roomGroup: THREE.Group;
  playerRoot: THREE.Group;
  targetMarker: THREE.Mesh;
  objectsByHotspot: Map<string, THREE.Object3D>;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  targetPosition: THREE.Vector3;
  loadPatrickAction: (id: PatrickAnimationId) => Promise<boolean>;
  playPatrickAction: (id: PatrickAnimationId, fadeDuration?: number) => void;
};

type PatrickAnimationId = 'idle' | 'idle-alt' | 'walk' | 'run' | 'talk' | 'victory' | 'turn' | 'dead';

const patrickAnimationSources: Array<{
  id: PatrickAnimationId;
  label: string;
  url: string;
  preload: boolean;
  loop: 'repeat' | 'once';
}> = [
  { id: 'idle', label: 'Idle', url: idleAnimationUrl, preload: true, loop: 'repeat' },
  { id: 'idle-alt', label: 'Idle Alt', url: idleAltAnimationUrl, preload: false, loop: 'repeat' },
  { id: 'walk', label: 'Walk', url: walkingAnimationUrl, preload: true, loop: 'repeat' },
  { id: 'run', label: 'Run', url: runningAnimationUrl, preload: true, loop: 'repeat' },
  { id: 'talk', label: 'Talk', url: talkAnimationUrl, preload: true, loop: 'repeat' },
  { id: 'victory', label: 'Victory', url: victoryAnimationUrl, preload: false, loop: 'once' },
  { id: 'turn', label: 'Turn', url: depressedTurnAnimationUrl, preload: false, loop: 'once' },
  { id: 'dead', label: 'Dead', url: deadAnimationUrl, preload: false, loop: 'once' },
];

const manualPatrickAnimationIds: PatrickAnimationId[] = ['idle', 'idle-alt', 'talk', 'turn', 'victory', 'dead'];

const requiredInventory: InventoryItemId[] = ['wallet', 'passport', 'phone', 'reservationPaper', 'keycard'];
const roomPalette: Record<
  PointClickRoomId,
  { floor: number; wall: number; accent: number; trim: number; glow: number; name: string }
> = {
  lobby: { floor: 0x1c3044, wall: 0x10283a, accent: 0xd69b36, trim: 0x7dd3fc, glow: 0x22d3ee, name: 'Lobby' },
  frontDesk: { floor: 0x2d2537, wall: 0x3d2135, accent: 0xd6a84f, trim: 0x22d3ee, glow: 0xf0abfc, name: 'Front Desk' },
  bathroom: { floor: 0xd6e7ec, wall: 0xa8c3cf, accent: 0x38bdf8, trim: 0xffffff, glow: 0x7dd3fc, name: 'Bathroom' },
};

function createStandardMaterial(color: number, roughness = 0.72, metalness = 0.04, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
}

function getHotspotPosition(hotspot: AdventureHotspot) {
  const x = THREE.MathUtils.clamp((hotspot.x - 50) / 5.5, -7.6, 7.6);
  const z = THREE.MathUtils.clamp((hotspot.y - 62) / 5.4, -5.1, 4.8);
  const y = hotspot.kind === 'person' ? 1.25 : 0.42;
  return new THREE.Vector3(x, y, z);
}

function getStandPosition(hotspot: AdventureHotspot) {
  const target = getHotspotPosition(hotspot);
  const offsetZ = hotspot.kind === 'person' ? 1.75 : 1.1;
  return new THREE.Vector3(target.x, 0, THREE.MathUtils.clamp(target.z + offsetZ, -4.7, 5.1));
}

function addBox(group: THREE.Group, size: [number, number, number], position: [number, number, number], color: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), createStandardMaterial(color));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addEmissiveBox(group: THREE.Group, size: [number, number, number], position: [number, number, number], color: number, intensity = 0.75) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), createStandardMaterial(color, 0.45, 0.02, color, intensity));
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
}

function addCylinder(group: THREE.Group, radius: number, height: number, position: [number, number, number], color: number, segments = 28) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), createStandardMaterial(color));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addWallPanel(group: THREE.Group, position: [number, number, number], size: [number, number], color: number, trimColor: number) {
  addBox(group, [size[0], size[1], 0.08], position, color);
  addBox(group, [size[0] + 0.18, 0.08, 0.1], [position[0], position[1] + size[1] / 2 + 0.07, position[2] + 0.01], trimColor);
  addBox(group, [size[0] + 0.18, 0.08, 0.1], [position[0], position[1] - size[1] / 2 - 0.07, position[2] + 0.01], trimColor);
  addBox(group, [0.08, size[1] + 0.18, 0.1], [position[0] - size[0] / 2 - 0.07, position[1], position[2] + 0.01], trimColor);
  addBox(group, [0.08, size[1] + 0.18, 0.1], [position[0] + size[0] / 2 + 0.07, position[1], position[2] + 0.01], trimColor);
}

function addFloorDetail(group: THREE.Group, roomId: PointClickRoomId) {
  const palette = roomPalette[roomId];
  const lineColor = roomId === 'bathroom' ? 0x9ab4bd : 0x38536a;
  for (let x = -8; x <= 8; x += 2) {
    addBox(group, [0.025, 0.012, 11.7], [x, 0.018, 0], lineColor);
  }
  for (let z = -5; z <= 5; z += 2) {
    addBox(group, [17.7, 0.012, 0.025], [0, 0.02, z], lineColor);
  }

  if (roomId !== 'bathroom') {
    addBox(group, [5.8, 0.026, 2.2], [0, 0.044, 2.1], roomId === 'frontDesk' ? 0x4f2c46 : 0x263f58);
    addEmissiveBox(group, [5.45, 0.032, 0.045], [0, 0.065, 1.04], palette.trim, 0.45);
    addEmissiveBox(group, [5.45, 0.032, 0.045], [0, 0.065, 3.16], palette.trim, 0.45);
  }
}

function addCeilingLights(group: THREE.Group, roomId: PointClickRoomId) {
  const palette = roomPalette[roomId];
  [-4.5, 0, 4.5].forEach((x) => {
    addEmissiveBox(group, [1.7, 0.06, 0.18], [x, 4.05, -2.3], palette.trim, 0.9);
  });
}

function addPlant(group: THREE.Group, x: number, z: number) {
  addCylinder(group, 0.28, 0.42, [x, 0.21, z], 0x9a5b32);
  addCylinder(group, 0.19, 1.15, [x, 0.85, z], 0x2f5f46, 10);
  addBox(group, [0.72, 0.24, 0.18], [x + 0.18, 1.28, z], 0x4ade80);
  addBox(group, [0.2, 0.22, 0.72], [x - 0.16, 1.08, z + 0.08], 0x22c55e);
}

function disposeObjectTree(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material?.dispose?.();
  });
}

function addRoomShell(group: THREE.Group, roomId: PointClickRoomId) {
  const palette = roomPalette[roomId];
  addBox(group, [18, 0.1, 12], [0, -0.05, 0], palette.floor);
  addFloorDetail(group, roomId);
  addBox(group, [18, 5, 0.18], [0, 2.5, -6], palette.wall);
  addBox(group, [0.18, 5, 12], [-9, 2.5, 0], palette.wall);
  addBox(group, [0.18, 5, 12], [9, 2.5, 0], palette.wall);
  addBox(group, [18, 0.18, 0.18], [0, 2.9, -5.85], palette.accent);
  addBox(group, [18, 0.16, 0.16], [0, 0.42, -5.82], palette.accent);
  addCeilingLights(group, roomId);

  if (roomId === 'frontDesk') {
    addBox(group, [8.8, 1.28, 1.15], [1.4, 0.64, -2.7], 0x563323);
    addBox(group, [9.4, 0.18, 1.3], [1.4, 1.36, -2.7], 0xd7ad62);
    addBox(group, [9.6, 0.12, 0.14], [1.4, 1.52, -2.06], palette.trim);
    addWallPanel(group, [-5.6, 1.45, -5.48], [2.8, 1.55], 0x115e59, palette.trim);
    addWallPanel(group, [6.65, 1.55, -5.48], [1.45, 1.95], 0x8b5a18, palette.accent);
    addEmissiveBox(group, [3.3, 0.1, 0.12], [1.2, 2.35, -5.48], palette.glow, 0.8);
    addBox(group, [2.8, 0.42, 0.12], [1.2, 2.08, -5.5], 0x111827);
    [-2.2, -0.9, 0.4, 1.7, 3.0, 4.3].forEach((x) => addBox(group, [0.64, 0.5, 0.08], [x, 2.05, -5.42], 0xd9b46b));
    [-3.8, 5.2].forEach((x) => {
      addCylinder(group, 0.08, 1.0, [x, 0.52, 1.0], palette.accent);
      addCylinder(group, 0.08, 1.0, [x, 0.52, 2.3], palette.accent);
      addEmissiveBox(group, [0.08, 0.08, 1.4], [x, 1.04, 1.65], palette.trim, 0.5);
    });
  } else if (roomId === 'bathroom') {
    addBox(group, [6.2, 0.82, 1.05], [-0.7, 0.41, -3.2], 0xf8fafc);
    addWallPanel(group, [-0.7, 1.52, -5.48], [2.4, 1.7], 0x7dd3fc, 0xe0f2fe);
    addEmissiveBox(group, [2.6, 0.08, 0.12], [-0.7, 2.55, -5.42], palette.glow, 0.9);
    [-2.7, -0.7, 1.3].forEach((x) => {
      addCylinder(group, 0.24, 0.18, [x, 0.93, -3.18], 0xe0f2fe, 30);
      addCylinder(group, 0.08, 0.5, [x, 0.88, -3.18], 0x94a3b8, 18);
    });
    [5.35, 7.15].forEach((x) => {
      addBox(group, [1.35, 2.62, 0.22], [x, 1.31, -5.2], 0xe2e8f0);
      addBox(group, [0.08, 2.62, 1.35], [x - 0.66, 1.31, -4.54], 0xcbd5e1);
    });
    addBox(group, [1.0, 1.38, 0.9], [5.6, 0.69, 2.1], 0xf8fafc);
    addBox(group, [0.9, 0.1, 0.72], [5.6, 1.42, 2.1], 0xbfdbfe);
  } else {
    addBox(group, [3.25, 0.55, 2.15], [-2.25, 0.28, -0.35], 0x7c3f24);
    addBox(group, [3.25, 0.55, 2.15], [2.25, 0.28, -0.35], 0x7c3f24);
    addBox(group, [3.05, 0.11, 1.95], [-2.25, 0.62, -0.35], 0xb45b35);
    addBox(group, [3.05, 0.11, 1.95], [2.25, 0.62, -0.35], 0xb45b35);
    addBox(group, [1.15, 4.25, 1.15], [-7.05, 2.08, -3.45], 0xd2a853);
    addBox(group, [1.15, 4.25, 1.15], [7.05, 2.08, -3.45], 0xd2a853);
    addEmissiveBox(group, [5.6, 0.16, 0.18], [0, 2.25, -5.45], palette.glow, 1.0);
    addWallPanel(group, [-3.1, 1.55, -5.48], [2.1, 1.35], 0x1e3a5f, palette.accent);
    addWallPanel(group, [3.1, 1.55, -5.48], [2.1, 1.35], 0x172554, palette.trim);
    addPlant(group, -7.25, 2.15);
    addPlant(group, 7.25, 2.15);
    addBox(group, [1.6, 0.52, 1.0], [-5.3, 0.26, 1.85], 0x8b3f2f);
    addBox(group, [1.25, 0.82, 0.18], [-5.3, 0.83, 1.45], 0xb45309);
  }
}

function createSpriteObject(textureLoader: THREE.TextureLoader, hotspot: AdventureHotspot) {
  const group = new THREE.Group();
  const position = getHotspotPosition(hotspot);
  group.position.copy(position);
  group.userData.hotspotId = hotspot.id;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.46, 32),
    new THREE.MeshBasicMaterial({
      color: hotspot.kind === 'person' ? 0xf0abfc : hotspot.kind === 'item' ? 0x67e8f9 : 0xfde68a,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -position.y + 0.035;
  ring.userData.hotspotId = hotspot.id;
  group.add(ring);

  if (hotspot.sprite) {
    const texture = textureLoader.load(hotspot.sprite);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.userData.hotspotId = hotspot.id;
    const scale = hotspot.kind === 'person' ? 2.15 : 0.9;
    sprite.scale.set(scale, hotspot.kind === 'person' ? scale * 1.42 : scale, 1);
    group.add(sprite);
  } else {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(hotspot.kind === 'person' ? 0.55 : 0.32, 24, 16),
      createStandardMaterial(hotspot.kind === 'person' ? 0xf0abfc : 0x67e8f9),
    );
    marker.userData.hotspotId = hotspot.id;
    group.add(marker);
  }

  return group;
}

function faceToward(object: THREE.Object3D, target: THREE.Vector3) {
  const dx = target.x - object.position.x;
  const dz = target.z - object.position.z;
  if (Math.hypot(dx, dz) < 0.001) return;
  object.rotation.y = Math.atan2(dx, dz);
}

function formatInventoryList(items: InventoryItemId[]) {
  return items.map((itemId) => getInventoryItem(itemId).label).join(', ');
}

export function LevelTwoDebugPage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRefs = useRef<SceneRefs | null>(null);
  const roomRef = useRef<PointClickRoomId>('lobby');
  const selectHotspotRef = useRef<(hotspot: AdventureHotspot) => void>(() => {});
  const moveToRef = useRef<(position: THREE.Vector3) => void>(() => {});
  const [loadStatus, setLoadStatus] = useState('Loading 3D Level 2...');
  const [roomId, setRoomId] = useState<PointClickRoomId>('lobby');
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [activeCommand, setActiveCommand] = useState<ActiveAdventureCommand | null>(null);
  const [activeConversation, setActiveConversation] = useState<ActiveAdventureConversation | null>(null);
  const [completedConversations, setCompletedConversations] = useState<AdventureConversationId[]>([]);
  const [inventory, setInventory] = useState<InventoryItemId[]>([]);
  const [message, setMessage] = useState('Move Patrick through the 3D hotel and collect the check-in items.');
  const [voiceStatus, setVoiceStatus] = useState('Choose a command to practice.');
  const [voiceError, setVoiceError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasVoiceCoach, setHasVoiceCoach] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceJudgeMode>(() => getVoiceJudgeMode());
  const [verdict, setVerdict] = useState<PronunciationVerdict | null>(null);
  const [stageComplete, setStageComplete] = useState(false);
  const [activePatrickAnimation, setActivePatrickAnimation] = useState('Loading');
  const room = getPointClickRoom(roomId);
  const selectedHotspot = useMemo(
    () => room.hotspots.find((hotspot) => hotspot.id === selectedHotspotId) ?? null,
    [room.hotspots, selectedHotspotId],
  );
  const pronunciationSession = useRef<PronunciationSession | null>(null);
  const connectionPromise = useRef<Promise<PronunciationSession | null> | null>(null);
  const pressedSpeakPointers = useRef<Set<number>>(new Set());
  const activeCommandRef = useRef<ActiveAdventureCommand | null>(null);
  const activeConversationRef = useRef<ActiveAdventureConversation | null>(null);
  const activeConversationTurn = activeConversation?.command.conversation?.[activeConversation.turnIndex] ?? null;
  const pronunciationPrompt = useMemo<PronunciationPrompt>(
    () =>
      activeConversationTurn
        ? activeConversationTurn.response
        : activeCommand
          ? {
              targetPhrase: activeCommand.command.targetPhrase,
              romanization: activeCommand.command.romanization,
              phoneticSpelling: activeCommand.command.phoneticSpelling,
              translation: activeCommand.command.translation,
            }
          : {
              targetPhrase: 'ผมดูครับ',
              romanization: 'phom duu khrap',
              phoneticSpelling: 'pom doo khrap',
              translation: 'I look.',
            },
    [activeCommand, activeConversationTurn],
  );
  const inventoryCount = inventory.length;
  const activeConversationProgress = activeConversation?.command.conversation
    ? `${activeConversation.turnIndex + 1}/${activeConversation.command.conversation.length}`
    : '';
  const activeSpeechRomanization = activeConversationTurn?.response.romanization ?? activeCommand?.command.romanization;

  roomRef.current = roomId;
  activeCommandRef.current = activeCommand;
  activeConversationRef.current = activeConversation;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07111d);
    scene.fog = new THREE.Fog(0x07111d, 10, 32);

    const camera = new THREE.PerspectiveCamera(48, mount.clientWidth / mount.clientHeight, 0.1, 80);
    camera.position.set(0, 6.2, 9.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'h-full w-full';
    renderer.domElement.dataset.testid = 'level-two-debug-canvas';
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 6.2;
    controls.maxDistance = 16;
    controls.target.set(0, 1.1, 0);

    scene.add(new THREE.HemisphereLight(0xdff7ff, 0x1d2a37, 1.35));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(-4, 8, 6);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x22d3ee, 2.4, 14);
    rimLight.position.set(5, 2.4, -4.2);
    scene.add(rimLight);

    const roomGroup = new THREE.Group();
    scene.add(roomGroup);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), new THREE.MeshBasicMaterial({ visible: false }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    let disposed = false;
    let mixer: THREE.AnimationMixer | null = null;
    let modelRoot: THREE.Object3D | null = null;
    let currentAction: THREE.AnimationAction | null = null;
    let currentPatrickActionId: PatrickAnimationId | null = null;
    let desiredTravelActionId: PatrickAnimationId = 'idle';
    const actionMap = new Map<PatrickAnimationId, THREE.AnimationAction>();
    const loadingActions = new Map<PatrickAnimationId, Promise<boolean>>();

    const playerRoot = new THREE.Group();
    playerRoot.position.set(-5.4, 0, 3.4);
    scene.add(playerRoot);
    const targetMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.5, 36),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    targetMarker.rotation.x = -Math.PI / 2;
    targetMarker.visible = false;
    scene.add(targetMarker);

    const refs: SceneRefs = {
      scene,
      camera,
      renderer,
      controls,
      floor,
      roomGroup,
      playerRoot,
      targetMarker,
      objectsByHotspot: new Map(),
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
      targetPosition: playerRoot.position.clone(),
      loadPatrickAction: async () => false,
      playPatrickAction: () => {},
    };
    sceneRefs.current = refs;

    const loader = new GLTFLoader();
    const loadPatrickAction = async (id: PatrickAnimationId) => {
      if (actionMap.has(id)) return true;
      if (!mixer || !modelRoot) return false;

      const source = patrickAnimationSources.find((candidate) => candidate.id === id);
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

          const action = mixer.clipAction(clip, modelRoot);
          action.enabled = true;
          action.setEffectiveWeight(1);
          actionMap.set(id, action);
          return true;
        })
        .catch(() => false)
        .finally(() => loadingActions.delete(id));

      loadingActions.set(id, loadPromise);
      return loadPromise;
    };

    const playPatrickAction = (id: PatrickAnimationId, fadeDuration = 0.16) => {
      const nextAction = actionMap.get(id);
      if (!nextAction || nextAction === currentAction) return;
      const source = patrickAnimationSources.find((candidate) => candidate.id === id);

      nextAction.reset();
      nextAction.enabled = true;
      nextAction.setEffectiveWeight(1);
      if (source?.loop === 'once') {
        nextAction.setLoop(THREE.LoopOnce, 1);
        nextAction.clampWhenFinished = id === 'dead';
      } else {
        nextAction.setLoop(THREE.LoopRepeat, Infinity);
        nextAction.clampWhenFinished = false;
      }
      nextAction.play();
      if (currentAction) {
        currentAction.crossFadeTo(nextAction, fadeDuration, false);
      }
      currentAction = nextAction;
      currentPatrickActionId = id;
      setActivePatrickAnimation(source?.label ?? id);
    };

    const ensureAndPlayPatrickAction = (id: PatrickAnimationId, fadeDuration = 0.16) => {
      if (actionMap.has(id)) {
        playPatrickAction(id, fadeDuration);
        return;
      }
      void loadPatrickAction(id).then((loaded) => {
        if (!disposed && loaded) playPatrickAction(id, fadeDuration);
      });
    };

    refs.loadPatrickAction = loadPatrickAction;
    refs.playPatrickAction = playPatrickAction;

    loader.load(
      patrickModelUrl,
      async (gltf) => {
        const model = gltf.scene;
        modelRoot = model;
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = size.y > 0 ? 1.85 / size.y : 1;
        model.scale.setScalar(scale);
        model.position.y = 0;
        playerRoot.add(model);
        mixer = new THREE.AnimationMixer(model);
        mixer.addEventListener('finished', (event) => {
          const finishedId = Array.from(actionMap.entries()).find(([, action]) => action === event.action)?.[0];
          if (!finishedId || finishedId === 'dead') return;
          if (refs.playerRoot.position.distanceTo(refs.targetPosition) > 0.05) return;
          ensureAndPlayPatrickAction('idle', 0.16);
        });
        const preloadIds = patrickAnimationSources.filter((source) => source.preload).map((source) => source.id);
        await Promise.all(preloadIds.map((id) => loadPatrickAction(id)));
        if (disposed) return;
        playPatrickAction('idle', 0);
        mixer.update(0.016);
        setLoadStatus(`3D Level 2 ready. Patrick animations loaded: ${Array.from(actionMap.keys()).join(', ')}.`);
      },
      undefined,
      () => {
        addBox(playerRoot, [0.55, 1.7, 0.42], [0, 0.85, 0], 0xdc2626);
        addBox(playerRoot, [0.44, 0.44, 0.44], [0, 1.95, 0], 0xb77947);
        setLoadStatus('3D Level 2 ready with fallback Patrick.');
      },
    );

    function onResize() {
      if (!mountRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    function onPointerUp(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      refs.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
      refs.raycaster.setFromCamera(refs.pointer, camera);
      const hotspotObjects = Array.from(refs.objectsByHotspot.values());
      const hotspotHit = refs.raycaster.intersectObjects(hotspotObjects, true)[0];
      if (hotspotHit?.object) {
        const hotspotId = hotspotHit.object.userData.hotspotId ?? hotspotHit.object.parent?.userData.hotspotId;
        const hotspot = getPointClickRoom(roomRef.current).hotspots.find((nextHotspot) => nextHotspot.id === hotspotId);
        if (hotspot) {
          selectHotspotRef.current(hotspot);
          moveToRef.current(getStandPosition(hotspot));
          return;
        }
      }

      const floorHit = refs.raycaster.intersectObject(floor)[0];
      if (floorHit) {
        moveToRef.current(new THREE.Vector3(floorHit.point.x, 0, floorHit.point.z));
      }
    }

    let lastTime = performance.now();
    function animate(now: number) {
      if (disposed) return;
      const delta = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;
      mixer?.update(delta);
      const target = refs.targetPosition;
      const player = refs.playerRoot;
      const distance = player.position.distanceTo(target);
      if (distance > 0.035) {
        const step = Math.min(distance, delta * 3.2);
        const next = player.position.clone().lerp(target, step / distance);
        faceToward(player, target);
        player.position.copy(next);
        targetMarker.visible = true;
        targetMarker.position.set(target.x, 0.04, target.z);
        const nextTravelActionId: PatrickAnimationId = distance > 3.1 ? 'run' : 'walk';
        desiredTravelActionId = nextTravelActionId;
        if (currentPatrickActionId !== nextTravelActionId) {
          ensureAndPlayPatrickAction(nextTravelActionId, 0.12);
        }
      } else {
        targetMarker.visible = false;
        if (desiredTravelActionId !== 'idle') {
          desiredTravelActionId = 'idle';
          ensureAndPlayPatrickAction('idle', 0.18);
        }
      }
      const desiredTarget = player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      controls.target.lerp(desiredTarget, 0.06);
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material?.dispose?.();
      });
      mount.removeChild(renderer.domElement);
      sceneRefs.current = null;
    };
  }, []);

  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    disposeObjectTree(refs.roomGroup);
    refs.roomGroup.clear();
    refs.objectsByHotspot.clear();
    const textureLoader = new THREE.TextureLoader();
    addRoomShell(refs.roomGroup, roomId);
    getPointClickRoom(roomId).hotspots.forEach((hotspot) => {
      const object = createSpriteObject(textureLoader, hotspot);
      refs.objectsByHotspot.set(hotspot.id, object);
      refs.roomGroup.add(object);
    });
  }, [roomId]);

  useEffect(() => {
    pronunciationSession.current?.updatePrompt(pronunciationPrompt);
    if ((activeCommand || activeConversation) && pronunciationSession.current) {
      setVoiceStatus(activeConversation ? 'Conversation response ready. Hold to answer in Thai.' : 'Command ready. Hold to say the Thai sentence.');
    }
  }, [activeCommand, activeConversation, pronunciationPrompt]);

  useEffect(() => {
    function syncVoiceMode() {
      setVoiceMode(getVoiceJudgeMode());
    }

    window.addEventListener(VOICE_JUDGE_MODE_CHANGED_EVENT, syncVoiceMode);
    window.addEventListener('focus', syncVoiceMode);
    return () => {
      window.removeEventListener(VOICE_JUDGE_MODE_CHANGED_EVENT, syncVoiceMode);
      window.removeEventListener('focus', syncVoiceMode);
      pronunciationSession.current?.disconnect();
      pronunciationSession.current = null;
    };
  }, []);

  function moveTo(position: THREE.Vector3) {
    const refs = sceneRefs.current;
    if (!refs) return;
    refs.targetPosition.copy(position);
    setMessage('Patrick is moving through the 3D room.');
  }

  moveToRef.current = moveTo;

  function playPatrickAnimation(id: PatrickAnimationId) {
    const refs = sceneRefs.current;
    if (!refs) return;
    const source = patrickAnimationSources.find((candidate) => candidate.id === id);
    refs.targetPosition.copy(refs.playerRoot.position);
    setActivePatrickAnimation(`Loading ${source?.label ?? id}`);
    void refs.loadPatrickAction(id).then((loaded) => {
      if (!loaded) {
        setActivePatrickAnimation('Animation missing');
        setMessage(`${source?.label ?? id} animation could not be loaded.`);
        return;
      }
      refs.playPatrickAction(id, 0.14);
      setMessage(`Patrick animation test: ${source?.label ?? id}.`);
    });
  }

  function enterRoom(nextRoomId: PointClickRoomId) {
    if (nextRoomId === roomId) return;
    setRoomId(nextRoomId);
    setSelectedHotspotId(null);
    setActiveCommand(null);
    setActiveConversation(null);
    setVerdict(null);
    setVoiceError('');
    const nextRoom = getPointClickRoom(nextRoomId);
    setMessage(nextRoom.description);
    const startPositions: Record<PointClickRoomId, THREE.Vector3> = {
      lobby: new THREE.Vector3(-5.4, 0, 3.4),
      frontDesk: new THREE.Vector3(-4.4, 0, 2.7),
      bathroom: new THREE.Vector3(-3.8, 0, 3.4),
    };
    const refs = sceneRefs.current;
    if (refs) {
      refs.playerRoot.position.copy(startPositions[nextRoomId]);
      refs.targetPosition.copy(startPositions[nextRoomId]);
      refs.playPatrickAction('idle', 0.12);
    }
  }

  function selectHotspot(hotspot: AdventureHotspot) {
    setSelectedHotspotId(hotspot.id);
    setActiveCommand(null);
    setActiveConversation(null);
    setVerdict(null);
    setVoiceError('');
    setMessage(`${hotspot.label}: choose a command, then say the Thai sentence.`);
  }

  selectHotspotRef.current = selectHotspot;

  function selectCommand(verb: AdventureCommand['verb']) {
    if (!selectedHotspot) return;
    const command = selectedHotspot.commands[verb];
    if (!command) {
      setMessage(`${selectedHotspot.label} does not respond to ${verb}.`);
      return;
    }

    if (command.requiresConversation && !completedConversations.includes(command.requiresConversation)) {
      setActiveCommand(null);
      setActiveConversation(null);
      setVerdict(null);
      setVoiceError('');
      setMessage(command.conversationBlockedText ?? 'Complete the required conversation first.');
      return;
    }

    const missingItems = getMissingInventoryItems(inventory, command.requiresItems);
    if (missingItems.length > 0) {
      setActiveCommand(null);
      setActiveConversation(null);
      setVerdict(null);
      setVoiceError('');
      setMessage(command.blockedText ?? `You still need ${formatInventoryList(missingItems)}.`);
      return;
    }

    setActiveCommand({ hotspot: selectedHotspot, command });
    setActiveConversation(null);
    setVerdict(null);
    setVoiceError('');
    setVoiceStatus(hasVoiceCoach ? 'Command ready. Hold to say the Thai sentence.' : 'Connect the AI mic when you are ready.');
    setMessage(`Say: ${command.romanization}`);
    if (command.verb === 'talk') {
      const refs = sceneRefs.current;
      void refs?.loadPatrickAction('talk').then((loaded) => {
        if (loaded) refs.playPatrickAction('talk', 0.14);
      });
    }
  }

  async function connectVoiceCoach(): Promise<PronunciationSession | null> {
    if (pronunciationSession.current) return pronunciationSession.current;
    if (connectionPromise.current) return connectionPromise.current;

    setIsConnecting(true);
    setVoiceError('');
    setVerdict(null);
    const selectedMode = getVoiceJudgeMode();
    setVoiceMode(selectedMode);

    connectionPromise.current = (async () => {
      const createSession = selectedMode === 'whisper' ? createWhisperPronunciationSession : createPronunciationSession;
      const session = await createSession({
        prompt: pronunciationPrompt,
        onStatus: setVoiceStatus,
        onError: (nextMessage) => {
          setVoiceError(nextMessage);
          setVoiceStatus('Voice coach needs another try.');
        },
        onVerdict: (nextVerdict) => {
          setVerdict(nextVerdict);
          if (!nextVerdict.pass) {
            setVoiceStatus('Pronunciation needs another try.');
            return;
          }

          setVoiceStatus('Command accepted. The action succeeds.');
          const acceptedConversation = activeConversationRef.current;
          if (acceptedConversation) {
            advanceConversation(acceptedConversation);
            return;
          }

          const acceptedCommand = activeCommandRef.current;
          if (acceptedCommand) {
            if (acceptedCommand.command.conversationId && acceptedCommand.command.conversation?.length) {
              startConversation(acceptedCommand);
              return;
            }

            executeCommand(acceptedCommand);
          }
        },
      });
      pronunciationSession.current = session;
      setHasVoiceCoach(true);
      return session;
    })();

    try {
      return await connectionPromise.current;
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : String(error));
      setVoiceStatus(`${selectedMode === 'whisper' ? 'Local Whisper' : 'Realtime'} voice coach could not connect.`);
      setHasVoiceCoach(false);
      return null;
    } finally {
      setIsConnecting(false);
      connectionPromise.current = null;
    }
  }

  function startVoiceAttempt(session = pronunciationSession.current) {
    if (!session || (!activeCommand && !activeConversation) || isRecording) return;
    setVoiceError('');
    setVerdict(null);
    session.updatePrompt(pronunciationPrompt);
    session.startRecording();
    setIsRecording(true);
  }

  function stopVoiceAttempt() {
    if (!pronunciationSession.current || !isRecording) return;
    pronunciationSession.current.stopRecording();
    setIsRecording(false);
  }

  function startVoiceAttemptWithPointerCapture(event: ReactPointerEvent<HTMLButtonElement>) {
    if ((!activeCommand && !activeConversation) || !pronunciationSession.current) return;
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);
    pressedSpeakPointers.current.add(pointerId);
    startVoiceAttempt(pronunciationSession.current);
  }

  function stopVoiceAttemptWithPointerCapture(event: ReactPointerEvent<HTMLButtonElement>) {
    pressedSpeakPointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    stopVoiceAttempt();
  }

  function startConversation({ hotspot, command }: ActiveAdventureCommand) {
    if (!command.conversationId || !command.conversation?.length) {
      executeCommand({ hotspot, command });
      return;
    }

    const nextConversation = {
      hotspot,
      command,
      conversationId: command.conversationId,
      turnIndex: 0,
    };
    const firstTurn = command.conversation[0];
    setActiveCommand(null);
    setActiveConversation(nextConversation);
    setVerdict(null);
    setVoiceError('');
    setVoiceStatus(hasVoiceCoach ? 'Conversation response ready. Hold to answer in Thai.' : 'Connect the AI mic when you are ready.');
    setMessage(`${firstTurn.npcSpeaker}: ${firstTurn.npcEnglish} Say: ${firstTurn.response.romanization}`);
    const refs = sceneRefs.current;
    void refs?.loadPatrickAction('talk').then((loaded) => {
      if (loaded) refs.playPatrickAction('talk', 0.14);
    });
  }

  function advanceConversation(conversation: ActiveAdventureConversation) {
    const turns = conversation.command.conversation ?? [];
    const currentTurn = turns[conversation.turnIndex];
    const nextTurnIndex = conversation.turnIndex + 1;
    const nextTurn = turns[nextTurnIndex];

    if (nextTurn) {
      setActiveConversation({
        ...conversation,
        turnIndex: nextTurnIndex,
      });
      setVerdict(null);
      setMessage(`${currentTurn?.successText ?? 'Good response.'} ${nextTurn.npcSpeaker}: ${nextTurn.npcEnglish} Say: ${nextTurn.response.romanization}`);
      setVoiceStatus('Next conversation response ready. Hold to answer in Thai.');
      return;
    }

    setCompletedConversations((currentConversations) =>
      currentConversations.includes(conversation.conversationId) ? currentConversations : [...currentConversations, conversation.conversationId],
    );
    setActiveConversation(null);
    setActiveCommand(null);
    setMessage(conversation.command.conversationCompleteText ?? conversation.command.successText);
    setVoiceStatus('Conversation complete. Continue the check-in task.');
    sceneRefs.current?.playPatrickAction('idle', 0.18);
  }

  function executeCommand({ command }: ActiveAdventureCommand) {
    if (command.givesItem) {
      setInventory((currentInventory) => {
        if (currentInventory.includes(command.givesItem as InventoryItemId)) return currentInventory;
        return [...currentInventory, command.givesItem as InventoryItemId];
      });
    }

    setMessage(command.successText);
    if (command.verb !== 'talk') {
      sceneRefs.current?.playPatrickAction('idle', 0.18);
    }
    if (command.completesAdventure) {
      setStageComplete(true);
      setVoiceStatus('Stage 2 clear. This 3D pass reached the original completion point.');
      const refs = sceneRefs.current;
      void refs?.loadPatrickAction('victory').then((loaded) => {
        if (loaded) refs.playPatrickAction('victory', 0.16);
      });
    }
  }

  function returnToTitle() {
    window.location.assign(import.meta.env.BASE_URL);
  }

  return (
    <main className="relative h-dvh min-h-[620px] w-screen overflow-hidden bg-slate-950 text-white">
      <div ref={mountRef} className="absolute inset-0" aria-label="3D Level 2 hotel check-in viewport" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(34,211,238,0.16),transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.08),rgba(2,6,23,0.58))]" />

      <header className="pointer-events-none absolute left-3 right-3 top-3 z-30 flex flex-wrap items-start justify-between gap-3 sm:left-6 sm:right-6 sm:top-5">
        <div className="pointer-events-auto max-w-xl rounded-lg border border-cyan-100/35 bg-slate-950/74 px-3 py-2 shadow-2xl backdrop-blur-md sm:px-4">
          <p className="font-display text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">3D Stage 2 Conversion</p>
          <p className="mt-0.5 text-base font-black leading-tight text-white sm:text-xl">{roomPalette[roomId].name}: Hotel Check-In</p>
          <p className="max-w-lg text-[11px] font-bold leading-snug text-cyan-50/82">{room.description}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100/70">{loadStatus}</p>
        </div>

        <nav className="pointer-events-auto grid grid-cols-3 gap-1 rounded-lg border border-white/24 bg-slate-950/70 p-1 shadow-2xl backdrop-blur-md">
          {levelTwoRooms.map((nextRoom) => (
            <button
              key={nextRoom.id}
              type="button"
              onClick={() => enterRoom(nextRoom.id)}
              className={`rounded-md px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition sm:px-3 ${
                nextRoom.id === roomId ? 'bg-cyan-300 text-slate-950' : 'bg-white/10 text-white hover:bg-white/22'
              }`}
            >
              {nextRoom.shortTitle}
            </button>
          ))}
        </nav>
      </header>

      <section className="pointer-events-auto absolute inset-x-3 bottom-10 z-50 grid max-h-[min(20rem,42dvh)] gap-2 overflow-y-auto rounded-xl border border-cyan-100/42 bg-slate-950/84 p-3 text-white shadow-2xl backdrop-blur-md sm:inset-x-6 sm:bottom-12 sm:grid-cols-[minmax(0,0.95fr)_minmax(15rem,0.58fr)_minmax(17rem,0.74fr)] lg:inset-x-10">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-100/32 bg-cyan-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-950">
              {selectedHotspot?.label ?? 'Click a 3D hotspot'}
            </span>
            <span className="text-[11px] font-bold leading-snug text-cyan-50/82">{message}</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {adventureVerbs.map((verb) => {
              const command = selectedHotspot?.commands[verb.id] ?? null;
              const missingItems = command ? getMissingInventoryItems(inventory, command.requiresItems) : [];
              const disabled = !selectedHotspot || !command || stageComplete;
              const blocked = missingItems.length > 0;
              const isActive =
                activeCommand !== null &&
                activeCommand.hotspot.id === selectedHotspot?.id &&
                activeCommand.command.verb === verb.id;
              return (
                <button
                  key={verb.id}
                  type="button"
                  onClick={() => selectCommand(verb.id)}
                  disabled={disabled}
                  className={`vn-action-button min-h-12 px-2 py-2 text-left text-[11px] font-black uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none ${
                    isActive ? 'bg-yellow-300 text-slate-950' : blocked ? 'bg-orange-200 text-orange-950' : 'bg-white text-slate-950'
                  }`}
                >
                  {verb.label}
                  <span className="mt-0.5 block text-[9px] normal-case tracking-normal opacity-75">
                    {command ? (blocked ? 'need item' : command.label) : 'n/a'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 rounded-lg border border-white/18 bg-white/10 p-2">
            {activeConversation && activeConversationTurn ? (
              <>
                <div className="mb-2 rounded-md border border-cyan-100/24 bg-cyan-100/12 p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-display text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
                      Hostess {activeConversationProgress}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-white/68">Listen</p>
                  </div>
                  <p className="text-base font-black leading-tight text-white">{activeConversationTurn.npcLineThai}</p>
                  <p className="text-xs font-black leading-tight text-cyan-100">{activeConversationTurn.npcRomanization}</p>
                  <p className="mt-1 text-xs font-bold leading-snug text-white/76">{activeConversationTurn.npcEnglish}</p>
                </div>
                <p className="font-display text-[10px] font-black uppercase tracking-[0.14em] text-yellow-200">Patrick responds</p>
                <p className="text-lg font-black leading-tight text-white sm:text-xl">{activeConversationTurn.response.targetPhrase}</p>
                <p className="text-sm font-black leading-tight text-cyan-100 sm:text-base">{activeConversationTurn.response.romanization}</p>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-cyan-50/72">
                  Phonetic: {activeConversationTurn.response.phoneticSpelling}
                </p>
                <p className="mt-1 text-xs font-bold leading-snug text-white/78">{activeConversationTurn.response.translation}</p>
              </>
            ) : activeCommand ? (
              <>
                <p className="text-lg font-black leading-tight text-white sm:text-xl">{activeCommand.command.targetPhrase}</p>
                <p className="text-sm font-black leading-tight text-cyan-100 sm:text-base">{activeCommand.command.romanization}</p>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-cyan-50/72">
                  Phonetic: {activeCommand.command.phoneticSpelling}
                </p>
                <p className="mt-1 text-xs font-bold leading-snug text-white/78">{activeCommand.command.translation}</p>
              </>
            ) : (
              <p className="text-sm font-bold leading-snug text-cyan-50/78">
                Click an item or person in the 3D room, pick a verb, then hold the mic button to say the Thai command.
              </p>
            )}
          </div>
        </div>

        <div className="grid min-w-0 content-start gap-2">
          <div className="rounded-lg border border-white/18 bg-white/10 p-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="font-display text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">Inventory</p>
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-white/68">
                {inventoryCount}/{requiredInventory.length}
              </p>
            </div>
            <div className="grid gap-1">
              {requiredInventory.map((itemId) => {
                const item = getInventoryItem(itemId);
                const collected = inventory.includes(itemId);
                return (
                  <div
                    key={itemId}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
                      collected ? 'border-emerald-200/40 bg-emerald-300/22 text-emerald-50' : 'border-white/14 bg-white/8 text-white/62'
                    }`}
                  >
                    <img src={item.sprite} alt="" className="h-7 w-7 object-contain" draggable={false} />
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-white/18 bg-white/10 p-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="font-display text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">Patrick Anim</p>
              <p className="truncate text-[10px] font-black uppercase tracking-[0.1em] text-white/68">{activePatrickAnimation}</p>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {manualPatrickAnimationIds.map((animationId) => {
                const source = patrickAnimationSources.find((candidate) => candidate.id === animationId);
                const isActive = activePatrickAnimation === source?.label;
                return (
                  <button
                    key={animationId}
                    type="button"
                    onClick={() => playPatrickAnimation(animationId)}
                    className={`rounded-md border px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-[0.08em] transition ${
                      isActive
                        ? 'border-yellow-100/70 bg-yellow-300 text-slate-950'
                        : 'border-white/14 bg-slate-900/76 text-white hover:bg-white/16'
                    }`}
                  >
                    {source?.label ?? animationId}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void connectVoiceCoach()}
            disabled={isConnecting || hasVoiceCoach}
            className="vn-action-button bg-cyan-300 px-3 py-2 text-left text-xs font-black uppercase tracking-[0.1em] text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
          >
            {hasVoiceCoach ? `${voiceMode === 'whisper' ? 'Whisper' : 'Realtime'} Connected` : `Connect ${voiceMode === 'whisper' ? 'Whisper' : 'Realtime'} Mic`}
          </button>
          <button
            type="button"
            onPointerDown={startVoiceAttemptWithPointerCapture}
            onPointerUp={stopVoiceAttemptWithPointerCapture}
            onPointerCancel={stopVoiceAttemptWithPointerCapture}
            disabled={(!activeCommand && !activeConversation) || !hasVoiceCoach || isConnecting || stageComplete}
            className={`vn-action-button px-3 py-2 text-left text-xs font-black uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none ${
              isRecording ? 'bg-red-500 text-white' : 'bg-emerald-300 text-emerald-950'
            }`}
          >
            {isRecording ? 'Release To Judge' : activeConversation ? 'Hold To Answer' : 'Hold To Say Command'}
            <span className="mt-0.5 block text-[10px] normal-case tracking-normal opacity-80">
              {activeSpeechRomanization ?? 'Choose a command first'}
            </span>
          </button>
          {stageComplete ? (
            <button
              type="button"
              onClick={returnToTitle}
              className="vn-action-button bg-fuchsia-300 px-3 py-2 text-left text-xs font-black uppercase tracking-[0.1em] text-slate-950"
            >
              Stage 2 Clear
            </button>
          ) : null}
        </div>

        <div className="min-w-0">
          <SuPronunciationJudge
            hasVoiceCoach={hasVoiceCoach}
            isConnecting={isConnecting}
            isRecording={isRecording}
            verdict={verdict}
            voiceError={voiceError}
            voiceStatus={voiceStatus}
          />
        </div>
      </section>

      <div className="pointer-events-none absolute bottom-3 left-4 right-4 z-20 flex flex-wrap justify-between gap-3 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/78 sm:bottom-5 sm:left-6 sm:right-6">
        <span>Click floor to move</span>
        <span>Click 3D hotspot to approach</span>
        <span>Scroll to zoom</span>
      </div>
    </main>
  );
}
