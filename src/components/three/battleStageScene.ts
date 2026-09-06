import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { BattleElement } from '../../data/phantasyBattleDemo';
import { getBrowserCapabilities } from '../../services/browserCapabilities';
import { patrickAnimationSources, patrickModelAssetUrl } from './patrickRig';
import { riftGuardianHeight, riftGuardianModelAssetUrl } from './riftGuardianRig';
import { suAnimationSources, suModelAssetUrl } from './suRig';
import {
  addContactShadow,
  addCylinder,
  addParticleField,
  addRiftPortal,
  addSkyDome,
  disposeObjectTree,
} from './sceneHelpers';

/* ─────────────────────────────────────────────────────────────────────────
 * 3D battle stage
 *
 * Owns a self-contained Three.js scene that renders the Rift-gate duel: a
 * temple-gate arena, Patrick + Su as rigged heroes on the left, and the Rift
 * Guardian boss on the right. The React battle component drives it purely
 * through the imperative controller returned by createBattleStage3D — it never
 * touches Three.js objects directly.
 *
 * The hero rigs ship with baked animation clips (idle / talk / victory / dead),
 * so their controllers crossfade real actions. The boss is a static export, so
 * it is animated procedurally (idle bob, hurt recoil, cast pulse, defeat sink).
 * ───────────────────────────────────────────────────────────────────────── */

export type BattleVfxRequest = {
  id: number;
  element: BattleElement | 'heal';
  target: 'hero' | 'enemy';
};

export type HeroVisualState = {
  casting: boolean;
  hurt: boolean;
  down: boolean;
  victory: boolean;
};

export type SuVisualState = {
  casting: boolean;
  down: boolean;
};

export type EnemyVisualState = {
  hurt: boolean;
  casting: boolean;
  down: boolean;
};

export type BattleStageController = {
  setHero: (state: HeroVisualState) => void;
  setSu: (state: SuVisualState) => void;
  setEnemy: (state: EnemyVisualState) => void;
  spawnVfx: (request: BattleVfxRequest) => void;
  shake: (intensity?: number) => void;
  resize: () => void;
  dispose: () => void;
};

// Stage anchor positions. Heroes stand on the left half, the boss on the right.
const HERO_ANCHOR = new THREE.Vector3(-2.6, 0, 0.5);
const SU_ANCHOR = new THREE.Vector3(-3.9, 0, -0.7);
const ENEMY_ANCHOR = new THREE.Vector3(3.0, 0, -0.2);

// Models export facing +Z. Turn the heroes ~70° toward the boss (and the boss
// back toward them) so we read a dynamic 3/4 profile rather than a flat side-on.
const HERO_FACING = Math.PI * 0.42;
const ENEMY_FACING = -Math.PI * 0.42;

const ELEMENT_COLORS: Record<BattleVfxRequest['element'], number> = {
  slash: 0xe5e7eb,
  fire: 0xf97316,
  ice: 0x67e8f9,
  lightning: 0xfde047,
  holy: 0xfacc15,
  wind: 0x86efac,
  shadow: 0xa855f7,
  heal: 0x4ade80,
};

const ELEMENT_SECONDARY_COLORS: Record<BattleVfxRequest['element'], number> = {
  slash: 0xffffff,
  fire: 0xfacc15,
  ice: 0xdbeafe,
  lightning: 0x67e8f9,
  holy: 0xffffff,
  wind: 0xd9f99d,
  shadow: 0x312e81,
  heal: 0xbbf7d0,
};

function additiveMeshMaterial(color: number, opacity = 0) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function additiveLineMaterial(color: number, opacity = 0) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function setObjectOpacity(object: THREE.Object3D, opacity: number) {
  const material = (object as THREE.Mesh | THREE.Line).material;
  if (!material) return;
  const materials = Array.isArray(material) ? material : [material];
  for (const mat of materials) {
    mat.transparent = true;
    mat.opacity = opacity;
  }
}

type AnimationSource = { id: string; label: string; url: string; loop: 'repeat' | 'once' };

type RiggedCharacter = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  play: (id: string, fade?: number) => void;
  load: (id: string) => Promise<boolean>;
};

function configureBattleShadowCaster(light: THREE.DirectionalLight, isLowEnd: boolean) {
  light.castShadow = true;
  light.shadow.mapSize.set(isLowEnd ? 1024 : 2048, isLowEnd ? 1024 : 2048);
  const cam = light.shadow.camera;
  cam.near = 1;
  cam.far = 30;
  cam.left = -9;
  cam.right = 9;
  cam.top = 9;
  cam.bottom = -9;
  cam.updateProjectionMatrix();
  light.shadow.bias = -0.0007;
  light.shadow.normalBias = 0.02;
}

/** Two-pillar gate, glowing rift between them, stone dais, braziers, embers. */
function buildTempleGate(scene: THREE.Scene, group: THREE.Group, isLowEnd: boolean) {
  addSkyDome(scene, 0x1a1033, 0x3b1d4d);

  // Stone arena dais the duel stands on.
  const daisMat = new THREE.MeshStandardMaterial({ color: 0x2b2536, roughness: 0.92, metalness: 0.05 });
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.8, 0.5, 56), daisMat);
  dais.position.set(0, -0.25, 0);
  dais.receiveShadow = true;
  group.add(dais);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x6d3bbf,
    roughness: 0.6,
    metalness: 0.2,
    emissive: 0x4c1d95,
    emissiveIntensity: 0.45,
  });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(7.45, 7.45, 0.08, 56, 1, true), ringMat);
  ring.position.set(0, 0.04, 0);
  group.add(ring);

  // Temple gate: two heavy pillars + a lintel, framing the rift portal.
  const stone = new THREE.MeshStandardMaterial({ color: 0x4a4055, roughness: 0.95, metalness: 0.04 });
  const trim = new THREE.MeshStandardMaterial({
    color: 0xb98a3a,
    roughness: 0.5,
    metalness: 0.45,
    emissive: 0x3a2708,
    emissiveIntensity: 0.3,
  });
  const pillarXs = [-3.5, 3.5];
  for (const px of pillarXs) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 6.2, 1.1), stone);
    pillar.position.set(px, 3.1, -5.0);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), trim);
    cap.position.set(px, 6.4, -5.0);
    cap.castShadow = true;
    group.add(cap);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 1.5), stone);
    base.position.set(px, 0.3, -5.0);
    base.receiveShadow = true;
    group.add(base);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.0, 1.3), stone);
  lintel.position.set(0, 6.9, -5.0);
  lintel.castShadow = true;
  group.add(lintel);
  const lintelTrim = new THREE.Mesh(new THREE.BoxGeometry(8.9, 0.25, 1.4), trim);
  lintelTrim.position.set(0, 7.45, -5.0);
  group.add(lintelTrim);

  // The rift portal glowing in the gate. Animated in the render loop.
  const portal = addRiftPortal(group, [0, 3.3, -4.6], 2.2);

  // Flanking braziers — warm key fill + emissive bowls.
  const braziers: THREE.Object3D[] = [];
  for (const bx of [-5.6, 5.6]) {
    addCylinder(group, 0.32, 1.7, [bx, 0.85, -2.0], 0x2a2230, { segments: 14, collider: false });
    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xf97316,
        emissiveIntensity: 1.8,
        roughness: 0.4,
      }),
    );
    bowl.position.set(bx, 1.75, -2.0);
    bowl.scale.y = 0.7;
    group.add(bowl);
    const fire = new THREE.PointLight(0xf9731a, 2.2, 11, 2);
    fire.position.set(bx, 2.1, -2.0);
    group.add(fire);
    braziers.push(fire);
  }

  // Floating embers / rift motes.
  const embers = addParticleField(
    group,
    isLowEnd ? 90 : 220,
    { x: [-7, 7], y: [0.2, 6.5], z: [-5, 3] },
    0xc792ff,
    0.05,
  );

  return { portal, braziers, embers };
}

async function loadRiggedCharacter(
  loader: GLTFLoader,
  parent: THREE.Group,
  modelUrl: string,
  sources: AnimationSource[],
  anchor: THREE.Vector3,
  facing: number,
  height: number,
): Promise<RiggedCharacter | null> {
  const gltf = await loader.loadAsync(modelUrl);
  const root = gltf.scene;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  // Scale to the authored height and plant feet on the dais.
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.setScalar(size.y > 0 ? height / size.y : 1);
  root.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(root);
  const center = scaledBox.getCenter(new THREE.Vector3());
  root.position.set(anchor.x - center.x, anchor.y - scaledBox.min.y, anchor.z - center.z);
  root.rotation.y = facing;

  const holder = new THREE.Group();
  holder.add(root);
  parent.add(holder);

  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<string, THREE.AnimationAction>();
  const loading = new Map<string, Promise<boolean>>();
  let current: THREE.AnimationAction | null = null;

  const load = async (id: string) => {
    if (actions.has(id)) return true;
    const source = sources.find((candidate) => candidate.id === id);
    if (!source) return false;
    const existing = loading.get(id);
    if (existing) return existing;
    const promise = loader
      .loadAsync(source.url)
      .then((animationGltf) => {
        const clip = animationGltf.animations[0]?.clone();
        if (!clip) return false;
        clip.name = source.label;
        const action = mixer.clipAction(clip, root);
        action.enabled = true;
        action.setEffectiveWeight(1);
        if (source.loop === 'once') {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        } else {
          action.setLoop(THREE.LoopRepeat, Infinity);
        }
        actions.set(id, action);
        return true;
      })
      .catch(() => false)
      .finally(() => loading.delete(id));
    loading.set(id, promise);
    return promise;
  };

  const play = (id: string, fade = 0.22) => {
    const next = actions.get(id);
    if (!next || next === current) return;
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.play();
    if (current) current.crossFadeTo(next, fade, false);
    current = next;
  };

  return { root: holder, mixer, play, load };
}

export type BattleStageOptions = {
  /** Opponent model override — defaults to the Rift Guardian. */
  opponent?: { modelUrl: string; height: number; rotationY?: number };
  /** Hide the Su ally rig (used when Su herself is the opponent). */
  hideAlly?: boolean;
};

export async function createBattleStage3D(
  mount: HTMLElement,
  options: BattleStageOptions = {},
): Promise<BattleStageController> {
  const caps = getBrowserCapabilities();
  const width = mount.clientWidth || window.innerWidth || 1;
  const height = mount.clientHeight || window.innerHeight || 1;

  const renderer = new THREE.WebGLRenderer({ antialias: !caps.isLowEndDevice, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, caps.recommendedPixelRatio));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !caps.isLowEndDevice;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'h-full w-full';
  renderer.domElement.dataset.testid = 'battle-stage-3d-canvas';
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x231537, 14, 34);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  const cameraBase = new THREE.Vector3(0.3, 3.15, 8.6);
  const cameraTarget = new THREE.Vector3(0, 1.6, -0.6);
  camera.position.copy(cameraBase);
  camera.lookAt(cameraTarget);

  // ── Lighting ──
  scene.add(new THREE.HemisphereLight(0x9d7bff, 0x241326, 0.6));
  const ambient = new THREE.AmbientLight(0xb9a3ff, 0.35);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xfff1d6, 1.5);
  key.position.set(5, 9, 7);
  configureBattleShadowCaster(key, caps.isLowEndDevice);
  scene.add(key);
  scene.add(key.target);
  const rim = new THREE.DirectionalLight(0xb066ff, 0.9);
  rim.position.set(-4, 6, -8);
  scene.add(rim);
  const heroFill = new THREE.PointLight(0x8fd0ff, 0.7, 14, 2);
  heroFill.position.set(-3, 3.4, 4);
  scene.add(heroFill);

  const environment = new THREE.Group();
  scene.add(environment);
  const { portal, embers } = buildTempleGate(scene, environment, caps.isLowEndDevice);

  // ── Characters ──
  const loader = new GLTFLoader();
  const characters = new THREE.Group();
  scene.add(characters);

  const patrickSources: AnimationSource[] = patrickAnimationSources.map((s) => ({
    id: s.id,
    label: s.label,
    url: s.url,
    loop: s.loop,
  }));
  const suSources: AnimationSource[] = suAnimationSources.map((s) => ({
    id: s.id,
    label: s.label,
    url: s.url,
    loop: s.loop,
  }));

  let hero: RiggedCharacter | null = null;
  let su: RiggedCharacter | null = null;
  let enemy: THREE.Group | null = null;

  // Soft contact shadows sit under each battler regardless of shadow-map budget.
  addContactShadow(environment, HERO_ANCHOR.x, HERO_ANCHOR.z, 0.85, 0.6);
  if (!options.hideAlly) addContactShadow(environment, SU_ANCHOR.x, SU_ANCHOR.z, 0.8, 0.55);
  // Human-scale opponents get a human-scale shadow; the Guardian a boss one.
  addContactShadow(
    environment,
    ENEMY_ANCHOR.x,
    ENEMY_ANCHOR.z,
    options.opponent && options.opponent.height < 2.4 ? 0.85 : 1.5,
    0.62,
  );

  void (async () => {
    hero = await loadRiggedCharacter(
      loader,
      characters,
      patrickModelAssetUrl,
      patrickSources,
      HERO_ANCHOR,
      HERO_FACING,
      1.78,
    ).catch(() => null);
    if (hero) {
      await hero.load('idle');
      await hero.load('talk');
      hero.play('idle', 0);
    }
  })();

  if (!options.hideAlly) {
    void (async () => {
      su = await loadRiggedCharacter(
        loader,
        characters,
        suModelAssetUrl,
        suSources,
        SU_ANCHOR,
        HERO_FACING,
        1.7,
      ).catch(() => null);
      if (su) {
        await su.load('idle');
        await su.load('talk');
        su.play('idle', 0);
      }
    })();
  }

  // Opponent model — the encounter's own NPC for social duels, the Rift
  // Guardian by default. Same procedural animation path either way (idle
  // bob, hurt recoil, cast pulse, defeat topple).
  const opponentModelUrl = options.opponent?.modelUrl ?? riftGuardianModelAssetUrl;
  const opponentHeight = options.opponent?.height ?? riftGuardianHeight;
  let enemyMaterials: THREE.MeshStandardMaterial[] = [];
  void (async () => {
    const gltf = await loader.loadAsync(opponentModelUrl).catch(() => null);
    if (!gltf) return;
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    root.scale.setScalar(size.y > 0 ? opponentHeight / size.y : 1);
    root.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(root);
    const center = scaledBox.getCenter(new THREE.Vector3());
    root.position.set(ENEMY_ANCHOR.x - center.x, ENEMY_ANCHOR.y - scaledBox.min.y, ENEMY_ANCHOR.z - center.z);
    root.rotation.y = options.opponent?.rotationY ?? ENEMY_FACING;
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      const list = Array.isArray(material) ? material : material ? [material] : [];
      for (const mat of list) {
        if (mat instanceof THREE.MeshStandardMaterial) enemyMaterials.push(mat);
      }
    });
    const holder = new THREE.Group();
    holder.add(root);
    characters.add(holder);
    enemy = holder;
  })();

  // ── Mutable visual state driven by the controller ──
  let enemyState: EnemyVisualState = { hurt: false, casting: false, down: false };
  let heroAnim = 'idle';
  let suAnim = 'idle';
  let victoryFired = false;
  let deadFired = false;

  const setHero = (state: HeroVisualState) => {
    if (!hero) return;
    let target = 'idle';
    if (state.down) target = 'dead';
    else if (state.victory) target = 'victory';
    else if (state.casting) target = 'talk';
    if (target === heroAnim) return;
    heroAnim = target;
    if (target === 'dead' && !deadFired) {
      deadFired = true;
      void hero.load('dead').then(() => hero?.play('dead'));
    } else if (target === 'victory' && !victoryFired) {
      victoryFired = true;
      void hero.load('victory').then(() => hero?.play('victory'));
    } else {
      void hero.load(target).then(() => hero?.play(target));
    }
  };

  const setSu = (state: SuVisualState) => {
    if (!su) return;
    const target = state.casting ? 'talk' : 'idle';
    if (target === suAnim) return;
    suAnim = target;
    void su.load(target).then(() => su?.play(target));
  };

  const setEnemy = (state: EnemyVisualState) => {
    enemyState = state;
  };

  // ── VFX bursts ──
  type ActiveVfx = {
    group: THREE.Group;
    core: THREE.Mesh;
    halo: THREE.Mesh;
    beam: THREE.Mesh;
    shockwave: THREE.Mesh;
    projectile: THREE.Mesh;
    specials: THREE.Group;
    light: THREE.PointLight;
    points: THREE.Points;
    element: BattleVfxRequest['element'];
    source: THREE.Vector3;
    impact: THREE.Vector3;
    life: number;
    ttl: number;
  };
  const activeVfx: ActiveVfx[] = [];

  const vfxAnchor = (target: 'hero' | 'enemy') =>
    target === 'enemy'
      ? new THREE.Vector3(ENEMY_ANCHOR.x, 1.7, ENEMY_ANCHOR.z)
      : new THREE.Vector3(HERO_ANCHOR.x, 1.4, HERO_ANCHOR.z);

  const spawnVfx = ({ element, target }: BattleVfxRequest) => {
    const color = ELEMENT_COLORS[element] ?? 0xffffff;
    const secondary = ELEMENT_SECONDARY_COLORS[element] ?? 0xffffff;
    const at = vfxAnchor(target);
    const source =
      target === 'enemy'
        ? vfxAnchor('hero').add(new THREE.Vector3(0.35, 0.25, 0))
        : vfxAnchor('enemy').add(new THREE.Vector3(-0.35, 0.25, 0));
    const impact = at.clone().sub(source);
    const distance = Math.max(0.1, impact.length());
    const direction = impact.clone().normalize();
    const group = new THREE.Group();
    group.position.copy(source);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.09, distance, 10, 1, true),
      additiveMeshMaterial(color),
    );
    beam.position.copy(impact).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    beam.scale.y = 0.001;
    group.add(beam);

    const projectile = new THREE.Mesh(
      new THREE.SphereGeometry(element === 'slash' ? 0.16 : 0.22, 16, 12),
      additiveMeshMaterial(secondary, 1),
    );
    group.add(projectile);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(element === 'fire' || element === 'shadow' ? 0.52 : 0.4, 18, 14),
      additiveMeshMaterial(color),
    );
    core.position.copy(impact);
    group.add(core);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.62, 40),
      additiveMeshMaterial(color, 0.8),
    );
    (halo.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
    halo.position.copy(impact);
    halo.lookAt(camera.position);
    group.add(halo);

    const shockwave = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.035, 8, 46),
      additiveMeshMaterial(secondary),
    );
    shockwave.position.copy(impact);
    shockwave.lookAt(camera.position);
    group.add(shockwave);

    const specials = new THREE.Group();
    group.add(specials);
    const markSpecial = (object: THREE.Object3D, kind: string) => {
      object.userData.kind = kind;
      object.userData.basePosition = object.position.clone();
      return object;
    };

    if (element === 'slash') {
      for (let i = 0; i < 3; i++) {
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(0.42 + i * 0.16, 0.022, 8, 36, Math.PI * 1.24),
          additiveMeshMaterial(i === 1 ? secondary : color),
        );
        arc.position.copy(impact);
        arc.rotation.set(0.45 + i * 0.12, 0.85, -0.55 + i * 0.34);
        arc.userData.offset = i * 0.12;
        specials.add(markSpecial(arc, 'slashArc'));
      }
    } else if (element === 'fire') {
      const flameGeometry = new THREE.ConeGeometry(0.16, 0.75, 9);
      for (let i = 0; i < 7; i++) {
        const flame = new THREE.Mesh(flameGeometry, additiveMeshMaterial(i % 2 ? secondary : color));
        const angle = (i / 7) * Math.PI * 2;
        const radius = 0.18 + (i % 3) * 0.08;
        flame.position.copy(impact).add(new THREE.Vector3(Math.cos(angle) * radius, 0.05, Math.sin(angle) * radius));
        flame.rotation.set((Math.random() - 0.5) * 0.45, 0, angle);
        flame.userData.offset = i * 0.08;
        specials.add(markSpecial(flame, 'fireTongue'));
      }
    } else if (element === 'ice') {
      const shardGeometry = new THREE.ConeGeometry(0.08, 0.78, 5);
      for (let i = 0; i < 8; i++) {
        const shard = new THREE.Mesh(shardGeometry, additiveMeshMaterial(i % 2 ? secondary : color));
        const angle = (i / 8) * Math.PI * 2;
        const radial = new THREE.Vector3(Math.cos(angle), 0.35 + (i % 2) * 0.3, Math.sin(angle)).normalize();
        shard.position.copy(impact).add(radial.clone().multiplyScalar(0.12));
        shard.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial);
        shard.userData.direction = radial;
        shard.userData.offset = i * 0.07;
        specials.add(markSpecial(shard, 'iceShard'));
      }
    } else if (element === 'lightning') {
      for (let bolt = 0; bolt < 3; bolt++) {
        const boltPoints: THREE.Vector3[] = [];
        const side = new THREE.Vector3(-direction.z, 0.4, direction.x).normalize();
        for (let step = 0; step <= 8; step++) {
          const amount = step / 8;
          const jitter = step === 0 || step === 8 ? 0 : (Math.random() - 0.5) * (0.38 + bolt * 0.12);
          boltPoints.push(impact.clone().multiplyScalar(amount).add(side.clone().multiplyScalar(jitter)));
        }
        const boltLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(boltPoints), additiveLineMaterial(bolt ? secondary : color));
        boltLine.userData.offset = bolt * 0.11;
        specials.add(markSpecial(boltLine, 'lightningBolt'));
      }
    } else if (element === 'wind') {
      for (let i = 0; i < 4; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.28 + i * 0.09, 0.018, 8, 44),
          additiveMeshMaterial(i % 2 ? secondary : color),
        );
        ring.position.copy(impact).multiplyScalar(0.22 + i * 0.18);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
        ring.userData.offset = i * 0.14;
        specials.add(markSpecial(ring, 'windRing'));
      }
    } else if (element === 'shadow') {
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.35 + i * 0.18, 0.035, 8, 40),
          additiveMeshMaterial(i === 0 ? secondary : color),
        );
        ring.position.copy(impact);
        ring.rotation.set(Math.PI * 0.5, 0, i * 0.8);
        ring.userData.offset = i * 0.1;
        specials.add(markSpecial(ring, 'shadowVortex'));
      }
    } else if (element === 'holy' || element === 'heal') {
      const glyphColor = element === 'heal' ? secondary : color;
      const glyphRing = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.52, 6), additiveMeshMaterial(glyphColor));
      glyphRing.position.copy(impact);
      glyphRing.lookAt(camera.position);
      specials.add(markSpecial(glyphRing, element === 'heal' ? 'healGlyph' : 'holyGlyph'));

      const barGeometry = new THREE.BoxGeometry(0.08, 0.82, 0.035);
      const vertical = new THREE.Mesh(barGeometry, additiveMeshMaterial(glyphColor));
      const horizontal = new THREE.Mesh(barGeometry, additiveMeshMaterial(glyphColor));
      vertical.position.copy(impact);
      horizontal.position.copy(impact);
      horizontal.rotation.z = Math.PI * 0.5;
      specials.add(markSpecial(vertical, element === 'heal' ? 'healGlyph' : 'holyGlyph'));
      specials.add(markSpecial(horizontal, element === 'heal' ? 'healGlyph' : 'holyGlyph'));
    }

    const count = caps.isLowEndDevice ? 24 : 60;
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = impact.x;
      positions[i * 3 + 1] = impact.y;
      positions[i * 3 + 2] = impact.z;
      const spread =
        element === 'lightning' ? 8 : element === 'fire' ? 7 : element === 'shadow' ? 4.5 : 6;
      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.25) * spread,
          (Math.random() - 0.5) * spread,
        ),
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color,
        size: 0.16,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    points.userData.velocities = velocities;
    group.add(points);

    const light = new THREE.PointLight(color, 6, 9, 2);
    light.position.copy(impact);
    group.add(light);

    scene.add(group);
    activeVfx.push({
      group,
      core,
      halo,
      beam,
      shockwave,
      projectile,
      specials,
      light,
      points,
      element,
      source,
      impact,
      life: 0,
      ttl: element === 'holy' || element === 'heal' ? 1.12 : 0.98,
    });
  };

  // ── Camera shake ──
  let shakeAmount = 0;
  const shake = (intensity = 0.4) => {
    shakeAmount = Math.max(shakeAmount, intensity);
  };

  // ── Render loop ──
  const clock = new THREE.Clock();
  let raf = 0;
  let disposed = false;
  const tmpColor = new THREE.Color();

  const animate = () => {
    if (disposed) return;
    raf = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;

    hero?.mixer.update(delta);
    su?.mixer.update(delta);

    // Rift portal swirl + ember drift.
    portal.ring.rotation.z += delta * 0.5;
    portal.disk.rotation.z -= delta * 0.3;
    embers.rotation.y += delta * 0.04;
    const emberPos = embers.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < emberPos.count; i++) {
      let y = emberPos.getY(i) + delta * 0.4;
      if (y > 6.6) y = 0.2;
      emberPos.setY(i, y);
    }
    emberPos.needsUpdate = true;

    // Enemy procedural animation: idle bob, cast lean/pulse, hurt recoil, defeat sink.
    if (enemy) {
      const idleBob = Math.sin(elapsed * 1.4) * 0.06;
      let targetY = idleBob;
      let targetTilt = Math.sin(elapsed * 0.7) * 0.015;
      let targetScale = 1;
      if (enemyState.down) {
        enemy.position.y = THREE.MathUtils.lerp(enemy.position.y, -1.4, delta * 2.2);
        enemy.rotation.z = THREE.MathUtils.lerp(enemy.rotation.z, 0.5, delta * 2.2);
      } else {
        if (enemyState.casting) {
          targetY += Math.abs(Math.sin(elapsed * 6)) * 0.12;
          targetTilt = -0.12;
          targetScale = 1 + Math.sin(elapsed * 7) * 0.03;
        }
        if (enemyState.hurt) {
          targetTilt = 0.18 + Math.sin(elapsed * 40) * 0.05;
        }
        enemy.position.y = THREE.MathUtils.lerp(enemy.position.y, targetY, delta * 8);
        enemy.rotation.z = THREE.MathUtils.lerp(enemy.rotation.z, targetTilt, delta * 8);
        const s = THREE.MathUtils.lerp(enemy.scale.x, targetScale, delta * 8);
        enemy.scale.setScalar(s);
      }
      // Hurt flash + cast glow on the boss materials.
      for (const mat of enemyMaterials) {
        const targetEmissive = enemyState.hurt ? 0.9 : enemyState.casting ? 0.4 : 0;
        mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, targetEmissive, delta * 10);
        if (targetEmissive > 0) {
          tmpColor.set(enemyState.hurt ? 0xff3344 : 0xa855f7);
          mat.emissive.lerp(tmpColor, delta * 10);
        } else {
          mat.emissive.lerp(tmpColor.set(0x000000), delta * 10);
        }
      }
    }

    // Subtle hero idle sway when not animating a clip is handled by the clips.

    // Advance VFX.
    for (let i = activeVfx.length - 1; i >= 0; i--) {
      const fx = activeVfx[i];
      fx.life += delta;
      const t = Math.min(1, fx.life / fx.ttl);
      const travel = Math.min(1, t / 0.34);
      const impactT = Math.max(0, (t - 0.24) / 0.76);
      const pulse = Math.sin(Math.min(1, impactT) * Math.PI);
      fx.projectile.position.copy(fx.impact).multiplyScalar(travel);
      if (fx.element === 'slash') {
        fx.projectile.scale.set(2.2 + pulse * 1.2, 0.28 + pulse * 0.08, 0.28 + pulse * 0.08);
        fx.projectile.rotation.z += delta * 18;
      } else if (fx.element === 'ice') {
        fx.projectile.scale.set(0.55 + pulse * 0.45, 1.7 + pulse * 0.6, 0.55 + pulse * 0.45);
        fx.projectile.rotation.x += delta * 8;
      } else {
        fx.projectile.scale.setScalar(0.75 + pulse * 1.1);
      }
      (fx.projectile.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - impactT * 1.25);
      fx.beam.position.copy(fx.impact).multiplyScalar(travel * 0.5);
      fx.beam.scale.y = Math.max(0.001, travel);
      (fx.beam.material as THREE.MeshBasicMaterial).opacity =
        fx.element === 'lightning'
          ? Math.max(0, 0.9 - impactT * 0.6) * (0.72 + Math.random() * 0.28)
          : Math.max(0, 0.9 - impactT * 1.1);
      const grow = 0.28 + impactT * 2.8;
      fx.core.scale.setScalar(grow);
      (fx.core.material as THREE.MeshBasicMaterial).opacity = pulse * 0.95;
      fx.halo.scale.setScalar(0.45 + impactT * 3.8);
      fx.halo.lookAt(camera.position);
      (fx.halo.material as THREE.MeshBasicMaterial).opacity = pulse * 0.82;
      fx.shockwave.scale.setScalar(0.6 + impactT * 2.4);
      fx.shockwave.lookAt(camera.position);
      (fx.shockwave.material as THREE.MeshBasicMaterial).opacity = Math.max(0, pulse * 0.85);
      fx.light.intensity = pulse * 7;
      fx.specials.traverse((child) => {
        if (child === fx.specials) return;
        const kind = child.userData.kind as string | undefined;
        if (!kind) return;
        const base = child.userData.basePosition as THREE.Vector3 | undefined;
        const offset = (child.userData.offset as number | undefined) ?? 0;
        const delayed = Math.max(0, Math.min(1, (impactT - offset) / Math.max(0.01, 1 - offset)));
        const specialPulse = Math.sin(delayed * Math.PI);
        if (base) child.position.copy(base);

        if (kind === 'slashArc') {
          child.scale.setScalar(0.5 + delayed * 1.8);
          child.rotation.z += delta * (8 + offset * 8);
          setObjectOpacity(child, specialPulse);
        } else if (kind === 'fireTongue') {
          child.position.y += delayed * (0.8 + offset);
          child.scale.set(0.75 + specialPulse * 0.45, 0.35 + delayed * 1.35, 0.75 + specialPulse * 0.45);
          child.rotation.y += delta * 5;
          setObjectOpacity(child, specialPulse * 0.95);
        } else if (kind === 'iceShard') {
          const outward = child.userData.direction as THREE.Vector3 | undefined;
          if (outward) child.position.add(outward.clone().multiplyScalar(delayed * 0.85));
          child.scale.setScalar(0.45 + delayed * 1.2);
          child.rotation.z += delta * 2;
          setObjectOpacity(child, Math.max(0, 1 - delayed * 0.55));
        } else if (kind === 'lightningBolt') {
          child.visible = travel > 0.16;
          setObjectOpacity(child, Math.max(0, 1 - impactT * 0.8) * (0.45 + Math.random() * 0.55));
        } else if (kind === 'windRing') {
          child.position.copy(fx.impact).multiplyScalar(0.18 + delayed * 0.82);
          child.scale.setScalar(0.6 + delayed * 2.1);
          child.rotation.z += delta * (7 + offset * 10);
          setObjectOpacity(child, specialPulse * 0.78);
        } else if (kind === 'shadowVortex') {
          child.scale.setScalar(1.15 - delayed * 0.45 + specialPulse * 0.35);
          child.rotation.z -= delta * (4 + offset * 10);
          setObjectOpacity(child, specialPulse * 0.95);
        } else if (kind === 'holyGlyph' || kind === 'healGlyph') {
          child.scale.setScalar(0.55 + delayed * (kind === 'healGlyph' ? 1.5 : 1.2));
          child.rotation.z += delta * (kind === 'healGlyph' ? -2.5 : 2.5);
          setObjectOpacity(child, specialPulse * 0.9);
        }
      });
      const pos = fx.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const vels = fx.points.userData.velocities as THREE.Vector3[];
      for (let p = 0; p < pos.count; p++) {
        if (impactT > 0) {
          pos.setXYZ(
            p,
            pos.getX(p) + vels[p].x * delta,
            pos.getY(p) + vels[p].y * delta,
            pos.getZ(p) + vels[p].z * delta,
          );
          vels[p].y -= delta * 4;
        }
      }
      pos.needsUpdate = true;
      (fx.points.material as THREE.PointsMaterial).opacity =
        impactT > 0 ? Math.max(0, (1 - impactT) * 1.1) : 0;
      if (t >= 1) {
        scene.remove(fx.group);
        disposeObjectTree(fx.group);
        activeVfx.splice(i, 1);
      }
    }

    // Camera idle drift + decaying shake.
    const sway = Math.sin(elapsed * 0.35) * 0.18;
    camera.position.set(cameraBase.x + sway, cameraBase.y + Math.sin(elapsed * 0.5) * 0.06, cameraBase.z);
    if (shakeAmount > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shakeAmount;
      camera.position.y += (Math.random() - 0.5) * shakeAmount;
      shakeAmount *= 0.86;
    }
    camera.lookAt(cameraTarget);

    renderer.render(scene, camera);
  };
  animate();

  const resize = () => {
    const w = mount.clientWidth || window.innerWidth || 1;
    const h = mount.clientHeight || window.innerHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  const dispose = () => {
    disposed = true;
    cancelAnimationFrame(raf);
    for (const fx of activeVfx) {
      scene.remove(fx.group);
      disposeObjectTree(fx.group);
    }
    activeVfx.length = 0;
    enemyMaterials = [];
    disposeObjectTree(scene);
    renderer.renderLists.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement === mount) {
      mount.removeChild(renderer.domElement);
    }
  };

  return { setHero, setSu, setEnemy, spawnVfx, shake, resize, dispose };
}
