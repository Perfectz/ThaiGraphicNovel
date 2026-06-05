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

export async function createBattleStage3D(mount: HTMLElement): Promise<BattleStageController> {
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
  addContactShadow(environment, SU_ANCHOR.x, SU_ANCHOR.z, 0.8, 0.55);
  addContactShadow(environment, ENEMY_ANCHOR.x, ENEMY_ANCHOR.z, 1.5, 0.62);

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

  let enemyMaterials: THREE.MeshStandardMaterial[] = [];
  void (async () => {
    const gltf = await loader.loadAsync(riftGuardianModelAssetUrl).catch(() => null);
    if (!gltf) return;
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    root.scale.setScalar(size.y > 0 ? riftGuardianHeight / size.y : 1);
    root.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(root);
    const center = scaledBox.getCenter(new THREE.Vector3());
    root.position.set(ENEMY_ANCHOR.x - center.x, ENEMY_ANCHOR.y - scaledBox.min.y, ENEMY_ANCHOR.z - center.z);
    root.rotation.y = ENEMY_FACING;
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
    light: THREE.PointLight;
    points: THREE.Points;
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
    const at = vfxAnchor(target);
    const group = new THREE.Group();
    group.position.copy(at);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 18, 14),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }),
    );
    group.add(core);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.62, 40),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.lookAt(camera.position);
    group.add(halo);

    const count = caps.isLowEndDevice ? 24 : 60;
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      velocities.push(
        new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.2) * 6, (Math.random() - 0.5) * 6),
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
    group.add(light);

    scene.add(group);
    activeVfx.push({ group, core, halo, light, points, life: 0, ttl: 0.9 });
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
      const grow = 0.4 + t * 2.4;
      fx.core.scale.setScalar(grow);
      (fx.core.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.95;
      fx.halo.scale.setScalar(0.6 + t * 3.4);
      fx.halo.lookAt(camera.position);
      (fx.halo.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.8;
      fx.light.intensity = (1 - t) * 6;
      const pos = fx.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const vels = fx.points.userData.velocities as THREE.Vector3[];
      for (let p = 0; p < pos.count; p++) {
        pos.setXYZ(
          p,
          pos.getX(p) + vels[p].x * delta,
          pos.getY(p) + vels[p].y * delta,
          pos.getZ(p) + vels[p].z * delta,
        );
        vels[p].y -= delta * 4;
      }
      pos.needsUpdate = true;
      (fx.points.material as THREE.PointsMaterial).opacity = 1 - t;
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
