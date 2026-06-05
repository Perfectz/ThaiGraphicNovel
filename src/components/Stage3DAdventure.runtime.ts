import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { AdventureSceneConfig } from '../data/adventures/types';
import { getBrowserCapabilities } from '../services/browserCapabilities';
import type { PatrickAnimationId } from './three/patrickRig';
import { disposeObjectTree } from './three/sceneHelpers';
import {
  isPhoneLandscapeViewport,
  isPhonePortraitViewport,
  type CinematicMove,
} from './Stage3DAdventure.camera';
import type { SceneRefs } from './Stage3DAdventure.types';

export type TrailerOrbitDebugConfig = {
  hotspotId: string;
  radius: number;
  speed: number;
};

const DEFAULT_TRAILER_ORBIT_RADIUS = 3;
const DEFAULT_TRAILER_ORBIT_SPEED = 0.4;
const MIN_TRAILER_ORBIT_RADIUS = 0.75;
const MAX_TRAILER_ORBIT_RADIUS = 12;
const MAX_TRAILER_ORBIT_SPEED = 4;

function readFiniteNumber(value: string | null, fallback: number) {
  if (value === null || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function readTrailerOrbitDebugConfig(params: URLSearchParams): TrailerOrbitDebugConfig | null {
  const hotspotId = params.get('debug-orbit')?.trim();
  if (!hotspotId) return null;

  return {
    hotspotId,
    radius: clamp(
      readFiniteNumber(params.get('orbit-radius'), DEFAULT_TRAILER_ORBIT_RADIUS),
      MIN_TRAILER_ORBIT_RADIUS,
      MAX_TRAILER_ORBIT_RADIUS,
    ),
    speed: clamp(
      readFiniteNumber(params.get('orbit-speed'), DEFAULT_TRAILER_ORBIT_SPEED),
      -MAX_TRAILER_ORBIT_SPEED,
      MAX_TRAILER_ORBIT_SPEED,
    ),
  };
}

/**
 * Turn on the renderer's WebXR support so a session can be entered via the
 * VRButton. Uses a 'local-floor' reference space so the headset reports head
 * pose relative to the physical floor — the player rig (dolly) is then placed
 * on the room floor and the camera's local transform is driven by the headset
 * at natural standing height. Safe to call once at bootstrap; it does not start
 * a session and has zero effect on the flat-screen render path until the user
 * actually enters VR (`renderer.xr.isPresenting`).
 */
export function enableStageXR(renderer: THREE.WebGLRenderer) {
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
}

export function configureStageRenderer(renderer: THREE.WebGLRenderer, mount: HTMLElement) {
  const caps = getBrowserCapabilities();
  const width = mount.clientWidth || window.innerWidth || 1;
  const height = mount.clientHeight || window.innerHeight || 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, caps.recommendedPixelRatio));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  // Shadow maps were dead code before this: every prop set `castShadow` but the
  // renderer never enabled the shadow pass. Soft PCF shadows ground everything.
  // Resolution is gated by device class in `configureShadowCaster`.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'h-full w-full';
  renderer.domElement.dataset.testid = 'stage-3d-adventure-canvas';
}

/**
 * Turn the stage key light into a shadow caster framed to the fixed ~18×12
 * room footprint. Mobile/low-end devices get a 1024 map; desktop gets 2048.
 * Bias values are tuned for the room scale to kill acne + peter-panning.
 */
export function configureShadowCaster(light: THREE.DirectionalLight) {
  const caps = getBrowserCapabilities();
  light.castShadow = true;
  const mapSize = caps.isLowEndDevice ? 1024 : 2048;
  light.shadow.mapSize.set(mapSize, mapSize);
  const cam = light.shadow.camera;
  cam.near = 1;
  cam.far = 40;
  cam.left = -12;
  cam.right = 12;
  cam.top = 12;
  cam.bottom = -12;
  cam.updateProjectionMatrix();
  light.shadow.bias = -0.0006;
  light.shadow.normalBias = 0.02;
}

export type StagePostFX = {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  setSize: (width: number, height: number) => void;
  dispose: () => void;
};

/**
 * EffectComposer with a bloom pass so the stages' many emissives (neon signs,
 * paper lanterns, woks, the rift portal) actually glow. Strength is dialled
 * back on low-end devices; the OutputPass handles tone-map + colour-space so
 * we keep the same ACES look as a direct render.
 */
export function createStagePostFX(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  bloomOverrides?: { strength?: number; threshold?: number },
): StagePostFX {
  const caps = getBrowserCapabilities();
  // The composer's default render target has no MSAA, so rendering through it
  // would drop the renderer's antialias. Use a multisampled HalfFloat target
  // (samples gated by device) to keep edges clean and bloom HDR-correct.
  const drawSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  const renderTarget = new THREE.WebGLRenderTarget(drawSize.x, drawSize.y, {
    type: THREE.HalfFloatType,
    samples: caps.isLowEndDevice ? 0 : 4,
  });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    bloomOverrides?.strength ?? (caps.isLowEndDevice ? 0.45 : 0.62), // strength
    0.4, // radius
    bloomOverrides?.threshold ?? 0.85, // luminance threshold — only bright emissives bloom
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  return {
    composer,
    bloomPass,
    setSize: (w, h) => {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
    dispose: () => composer.dispose(),
  };
}

export function resolveTrailerOrbitCenter(
  config: AdventureSceneConfig,
  orbitConfig: TrailerOrbitDebugConfig | null,
) {
  if (!orbitConfig) return null;
  for (const room of config.rooms) {
    const match = room.hotspots.find((hotspot) => hotspot.id === orbitConfig.hotspotId);
    if (match) {
      return new THREE.Vector3(match.position[0], 1.45, match.position[2]);
    }
  }
  return null;
}

export function applyTrailerOrbitCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  orbitCenter: THREE.Vector3,
  orbitConfig: TrailerOrbitDebugConfig,
  now: number,
) {
  const angle = (now / 1000) * orbitConfig.speed;
  camera.position.set(
    orbitCenter.x + Math.cos(angle) * orbitConfig.radius,
    orbitCenter.y + 0.55,
    orbitCenter.z + Math.sin(angle) * orbitConfig.radius,
  );
  controls.target.copy(orbitCenter);
}

export function advanceCinematicCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  cinematic: CinematicMove,
  now: number,
): CinematicMove | null {
  const elapsed = now - cinematic.startTime;
  const t = Math.min(1, elapsed / cinematic.duration);
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  camera.position.lerpVectors(cinematic.startPos, cinematic.endPos, eased);
  controls.target.lerpVectors(cinematic.startTarget, cinematic.endTarget, eased);
  return t >= 1 ? null : cinematic;
}

export function updateAnimatedRoomDecor(groups: Iterable<THREE.Group>, delta: number, elapsed: number) {
  for (const group of groups) {
    group.children.forEach((child) => {
      const spin = child.userData.spin;
      if (typeof spin === 'number' && Number.isFinite(spin)) {
        child.rotation.y += delta * spin;
      }

      const bob = child.userData.bob;
      const baseY = child.userData.baseY;
      const phase = child.userData.phase;
      if (
        typeof bob === 'number' &&
        typeof baseY === 'number' &&
        typeof phase === 'number' &&
        Number.isFinite(bob) &&
        Number.isFinite(baseY) &&
        Number.isFinite(phase)
      ) {
        child.position.y = baseY + Math.sin(elapsed * 1.4 + phase) * bob;
      }
    });
  }
}

export function publishStage3DDevState({
  refs,
  camera,
  controls,
  renderer,
  cinematicActive,
  currentPatrickActionId,
  standUpStarted,
}: {
  refs: SceneRefs;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  cinematicActive: boolean;
  currentPatrickActionId: PatrickAnimationId | null;
  standUpStarted: boolean;
}) {
  if (!import.meta.env.DEV) return;

  const player = refs.playerRoot;
  (window as unknown as Record<string, unknown>).__patrickPos = {
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    ry: player.rotation.y,
    action: currentPatrickActionId,
    standUpStarted,
    colliders: refs.colliders.length,
  };

  const projectScreen = (world: THREE.Vector3) => {
    const ndc = world.clone().project(camera);
    return { x: ndc.x, y: ndc.y };
  };
  const npcPositions: Record<string, unknown> = {};
  refs.hotspotGroup.children.forEach((child) => {
    const id = child.userData.hotspotId;
    if (typeof id !== 'string') return;
    const npcModel = child.children.find((candidate) => candidate.type === 'Group') ?? child;
    npcPositions[id] = {
      groupX: child.position.x,
      groupZ: child.position.z,
      modelX: npcModel.position.x,
      modelZ: npcModel.position.z,
      modelRy: npcModel.rotation.y,
      ndc: projectScreen(new THREE.Vector3(child.position.x, 1.5, child.position.z)),
      childTypes: child.children.map((candidate) => candidate.type).join(','),
    };
  });

  const width = renderer.domElement.clientWidth || window.innerWidth;
  const height = renderer.domElement.clientHeight || window.innerHeight;
  (window as unknown as Record<string, unknown>).__sceneDebug = {
    cameraPos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
    viewport: {
      width,
      height,
      portraitPhone: isPhonePortraitViewport(width, height),
      landscapePhone: isPhoneLandscapeViewport(width, height),
    },
    cinematicActive,
    patrickNdc: projectScreen(new THREE.Vector3(player.position.x, 1.5, player.position.z)),
    npcs: npcPositions,
  };
}

export function disposeMountedStageScene({
  scene,
  renderer,
  controls,
  mount,
  postFx,
}: {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  mount: HTMLElement;
  postFx?: StagePostFX | null;
}) {
  controls.dispose();
  postFx?.dispose();
  disposeObjectTree(scene);
  renderer.renderLists.dispose();
  renderer.dispose();
  if (renderer.domElement.parentElement === mount) {
    mount.removeChild(renderer.domElement);
  }
}
