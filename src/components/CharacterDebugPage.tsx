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
const WALK_CENTER_X = 1.85;
const ROOM_CENTER_X = 0.65;
const SPAWN_POINT = new THREE.Vector3(WALK_CENTER_X, 0, 0.86);
const ROOM_BOUNDS = {
  minX: -5.25,
  maxX: 6.45,
  minZ: -3.62,
  maxZ: 3.62,
};
const ROOM_FOG_NEAR = 18;
const ROOM_FOG_FAR = 34;
const CAMERA_FAR_PLANE = 120;
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

function createMat(color: number, roughness = 0.68, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
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

  const floorMaterial = createMat(0x22304a, 0.82);
  const wallMaterial = createMat(0x182235, 0.78);
  const trimMaterial = createMat(0x0f172a, 0.72);
  const goldMaterial = createMat(0xd6a94d, 0.42, 0.18);
  const tealMaterial = createMat(0x0f766e, 0.6, 0.06);
  const woodMaterial = createMat(0x6b3f2a, 0.7, 0.02);
  const fabricMaterial = createMat(0x7f1d1d, 0.82);
  const plantMaterial = createMat(0x166534, 0.72);
  const planterMaterial = createMat(0x334155, 0.66);

  const floor = createBox('polished-lobby-floor', [12.8, 0.04, 8.4], [ROOM_CENTER_X, -0.04, 0.05], floorMaterial);
  floor.receiveShadow = true;
  floor.castShadow = false;
  lobby.add(floor);

  lobby.add(createBox('back-wall', [12.8, 4.2, 0.08], [ROOM_CENTER_X, 2.06, -4.15], wallMaterial));
  lobby.add(createBox('left-wall', [0.08, 4.2, 8.4], [-5.75, 2.06, 0.05], wallMaterial));
  lobby.add(createBox('right-wall', [0.08, 4.2, 8.4], [7.05, 2.06, 0.05], wallMaterial));
  lobby.add(createBox('ceiling-trim', [12.8, 0.08, 0.14], [ROOM_CENTER_X, 4.14, -4.05], trimMaterial));
  lobby.add(createBox('floor-trim', [12.8, 0.08, 0.14], [ROOM_CENTER_X, 0.08, -4.05], trimMaterial));
  lobby.add(createBox('left-floor-trim', [0.14, 0.08, 8.4], [-5.66, 0.08, 0.05], trimMaterial));
  lobby.add(createBox('right-floor-trim', [0.14, 0.08, 8.4], [6.96, 0.08, 0.05], trimMaterial));

  const desk = new THREE.Group();
  desk.name = 'front-desk';
  desk.add(createBox('front-desk-counter', [4.15, 0.72, 0.54], [0, 0.36, 0], woodMaterial));
  desk.add(createBox('front-desk-top', [4.36, 0.08, 0.68], [0, 0.75, -0.02], goldMaterial));
  desk.add(createBox('front-desk-kick', [4.3, 0.16, 0.08], [0, 0.12, 0.31], trimMaterial));
  desk.add(createBox('desk-terminal-left', [0.32, 0.2, 0.06], [-1.18, 0.92, -0.1], trimMaterial));
  desk.add(createBox('desk-terminal-right', [0.32, 0.2, 0.06], [1.12, 0.92, -0.1], trimMaterial));
  desk.add(createBox('desk-bell', [0.16, 0.08, 0.16], [0.08, 0.88, 0.02], goldMaterial));
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

  const rugMaterial = createMat(0x0e7490, 0.9);
  const rug = createBox('teal-lobby-rug', [3.8, 0.018, 2.2], [1.45, 0.005, 0.9], rugMaterial);
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
    const light = new THREE.PointLight(0xffe4a3, 0.82, 3.1);
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
    column.add(createBox('column-shaft', [0.34, 3.45, 0.34], [0, 1.84, 0], createMat(0xd8dee9, 0.58, 0.05)));
    column.add(createBox('column-capital', [0.62, 0.18, 0.62], [0, 3.6, 0], goldMaterial));
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

export function CharacterDebugPage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playAnimationRef = useRef<(id: string) => Promise<void>>(async () => {});
  const autoRotateRef = useRef(false);
  const gridVisibleRef = useRef(true);
  const walkSpeedRef = useRef(1);
  const [autoRotate, setAutoRotate] = useState(false);
  const [gridVisible, setGridVisible] = useState(true);
  const [walkSpeed, setWalkSpeed] = useState(1);
  const [activeAnimation, setActiveAnimation] = useState('Loading');
  const [motionMode, setMotionMode] = useState<MotionMode>('idle');
  const [targetDistance, setTargetDistance] = useState(0);
  const [availableAnimations, setAvailableAnimations] = useState<string[]>([]);
  const [stats, setStats] = useState<ModelStats>(initialStats);

  autoRotateRef.current = autoRotate;
  gridVisibleRef.current = gridVisible;
  walkSpeedRef.current = walkSpeed;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let frameId = 0;
    let mixer: THREE.AnimationMixer | null = null;
    let modelRoot: THREE.Object3D | null = null;
    let baseModelY = 0;
    let currentAction: THREE.AnimationAction | null = null;
    const actionMap = new Map<string, THREE.AnimationAction>();
    const moveTarget = new THREE.Vector3(SPAWN_POINT.x, 0, SPAWN_POINT.z);
    const scratchDirection = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const floorHit = new THREE.Vector3();
    const pointerStart = new THREE.Vector2();
    const loadedClips: THREE.AnimationClip[] = [];
    const loadingActions = new Map<string, Promise<boolean>>();

    let lastFrameTime = performance.now();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1423);
    scene.fog = new THREE.Fog(0x0a1423, ROOM_FOG_NEAR, ROOM_FOG_FAR);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, CAMERA_FAR_PLANE);
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
    controls.target.set(0, 1, 0);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.8);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = false;
    scene.add(keyLight);
    scene.add(new THREE.HemisphereLight(0x9ddcff, 0x2f1b2e, 2.6));

    const rimLight = new THREE.DirectionalLight(0x6ee7ff, 1.8);
    rimLight.position.set(-4, 2.5, -3);
    scene.add(rimLight);

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

    const playManualAction = async (id: string) => {
      moveTarget.copy(modelRoot?.position ?? SPAWN_POINT);
      targetMarker.visible = false;
      setMotionMode('manual');
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

    const setTravelTarget = (target: THREE.Vector3) => {
      if (!modelRoot) return;

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
      setTargetDistance(distance);
      playAction(nextMode === 'running' ? 'run' : 'walk', 0.14);
    };

    const handlePointerDown = (event: PointerEvent) => {
      pointerStart.set(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );

      raycaster.setFromCamera(pointer, camera);
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

        controls.target.set(WALK_CENTER_X, targetY * 0.88, -0.42);
        camera.position.set(WALK_CENTER_X + fittedRadius * 2.25, targetY + fittedRadius * 0.72, fittedRadius * 4.18);
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

    void loadCharacter();

    const render = () => {
      const now = performance.now();
      const delta = Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;
      mixer?.update(delta);

      if (modelRoot) {
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
          setMotionMode('idle');
          playAction('idle', 0.18);
        }
      }

      controls.autoRotate = autoRotateRef.current;
      grid.visible = gridVisibleRef.current;
      axes.visible = gridVisibleRef.current;
      runway.visible = gridVisibleRef.current;
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

  return (
    <main className="relative h-dvh min-h-[620px] w-screen overflow-hidden bg-slate-950 text-slate-50">
      <div ref={mountRef} className="absolute inset-0" aria-label="3D character debug viewport" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(34,211,238,0.14),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.12),rgba(2,6,23,0.72))]" />

      <section className="pointer-events-auto absolute left-4 top-4 z-10 max-w-[min(24rem,calc(100vw-2rem))] border border-cyan-100/35 bg-slate-950/74 p-4 shadow-[0_0_38px_rgba(34,211,238,0.18)] backdrop-blur-md sm:left-6 sm:top-6">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Character Debug</p>
            <h1 className="mt-1 text-lg font-black uppercase tracking-[0.08em] text-white sm:text-xl">Main Character GLB</h1>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-fuchsia-100">
              Room: Large hotel lobby mockup
            </p>
          </div>
          <a
            href="/"
            className="border border-cyan-200/50 bg-cyan-300/16 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-50 hover:bg-cyan-300/28"
          >
            Game
          </a>
        </div>

        <p className="break-all text-xs font-bold leading-relaxed text-slate-300">{MODEL_FILE_NAME}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-slate-200">
          <div className="border border-white/15 bg-white/10 px-3 py-2">
            <span className="block text-cyan-200">Status</span>
            {stats.message}
          </div>
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
          <div className="border border-white/15 bg-white/10 px-3 py-2">
            <span className="block text-cyan-200">Playing</span>
            {activeAnimation}
          </div>
          <div className="border border-white/15 bg-white/10 px-3 py-2">
            <span className="block text-cyan-200">Rig</span>
            {stats.rigStatus}
          </div>
          <div className="border border-white/15 bg-white/10 px-3 py-2">
            <span className="block text-cyan-200">Travel Speed</span>
            {walkSpeed.toFixed(1)}x
          </div>
          <div className="border border-white/15 bg-white/10 px-3 py-2">
            <span className="block text-cyan-200">Mode</span>
            {motionMode}
          </div>
          <div className="border border-white/15 bg-white/10 px-3 py-2">
            <span className="block text-cyan-200">Target</span>
            {targetDistance > 0.05 ? `${targetDistance.toFixed(1)}m` : 'None'}
          </div>
        </div>

        {stats.status === 'error' ? (
          <p className="mt-3 border border-red-200/40 bg-red-500/14 px-3 py-2 text-xs font-bold text-red-100">
            Check that the GLB remains in the humandropbox folder and can be imported by Vite.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
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
        </div>

        <p className="mt-4 border border-fuchsia-200/30 bg-fuchsia-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-fuchsia-50">
          Click the floor to travel. Short clicks walk, long clicks run.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
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
        </div>

        <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
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
        </label>
        <div className="mt-2 flex gap-2">
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
        </div>
      </section>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 flex flex-wrap justify-between gap-3 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/80 sm:bottom-6 sm:left-6 sm:right-6">
        <span>Click floor to move</span>
        <span>Scroll to zoom</span>
        <span>Right drag to pan</span>
      </div>
    </main>
  );
}
