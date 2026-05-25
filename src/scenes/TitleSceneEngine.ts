import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import suIdleAnimationUrl from '../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Idle_4_withSkin.glb?url';
import suWaveAnimationUrl from '../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Wave_for_Help_4_withSkin.glb?url';
import suModelUrl from '../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Character_output.glb?url';
import { Scene3DEngine, type SceneFrame } from './Scene3DEngine';

const HEAD_BONE_REGEX = /(^|[^a-z])head([^a-z]|$)/;
const HEAD_BONE_EXCLUDE = /headtop|headend|head_end/;
const LEFT_EYE_REGEX = /(eye_?l$|l_?eye|lefteye|eyeleft)/;
const RIGHT_EYE_REGEX = /(eye_?r$|r_?eye|righteye|eyeright)/;

type RigBones = {
  head: THREE.Object3D | null;
  leftEye: THREE.Object3D | null;
  rightEye: THREE.Object3D | null;
};

/**
 * Walks the rig once and grabs the head + L/R eye bones for cursor tracking.
 * Tolerates Mixamo, Meshy, and generic biped naming conventions.
 */
function findRigBones(model: THREE.Object3D): RigBones {
  const bones: RigBones = { head: null, leftEye: null, rightEye: null };

  model.traverse((obj) => {
    if (!(obj as THREE.Bone).isBone) return;
    const name = obj.name.toLowerCase();
    if (!bones.head && HEAD_BONE_REGEX.test(name) && !HEAD_BONE_EXCLUDE.test(name)) {
      bones.head = obj;
    }
    if (!bones.leftEye && LEFT_EYE_REGEX.test(name)) {
      bones.leftEye = obj;
    }
    if (!bones.rightEye && RIGHT_EYE_REGEX.test(name)) {
      bones.rightEye = obj;
    }
  });

  return bones;
}

function prepareTitleModel(model: THREE.Object3D): void {
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      if (!material) return;
      material.needsUpdate = true;
    });
  });
}

function buildParticleField(count: number): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const radius = 2.2 + Math.random() * 5.8;
    const angle = Math.random() * Math.PI * 2;
    const height = -1.8 + Math.random() * 4.5;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = height;
    positions[i * 3 + 2] = -4.2 + Math.sin(angle) * radius * 0.45;

    // Restricted to a narrow cyan band — drops magenta noise from the v1 palette.
    color.setHSL(0.52 + Math.random() * 0.08, 0.85, 0.62 + Math.random() * 0.18);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function buildRiftGroup(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'title-rift';
  group.position.set(-0.85, 0.35, -2.75);
  group.rotation.set(-0.18, 0.18, -0.08);

  // 4 cyan rings only — atmosphere, not choreography.
  for (let i = 0; i < 4; i += 1) {
    const radius = 0.78 + i * 0.26;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.01 + i * 0.0015, 8, 96),
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.36 - i * 0.06,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.rotation.set(Math.PI * 0.46, i * 0.22, i * 0.18);
    ring.position.z = -i * 0.05;
    group.add(ring);
  }

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 2),
    new THREE.MeshBasicMaterial({
      color: 0xbff6ff,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(core);

  return group;
}

/**
 * Concrete {@link Scene3DEngine} for the title screen.
 *
 * Composition: cyan rift (4 rings + core) and cyan-only particle field behind
 * a hero Su 3D model. Su plays a wave clip once on load, cross-fades into an
 * idle loop, and tracks the cursor with her head + (where rigged) eyes.
 *
 * Camera composition keeps Su center-right with breathing room on the left
 * for the logo lockup. Mobile reframes via {@link onResize}.
 */
export class TitleSceneEngine extends Scene3DEngine {
  private readonly cameraBasePosition = new THREE.Vector3(0.42, 0.78, 5.4);
  private readonly cameraBaseLookAt = new THREE.Vector3(0.62, 0.5, -0.6);
  private readonly cameraDesiredPosition = this.cameraBasePosition.clone();
  private readonly cameraDesiredLookAt = this.cameraBaseLookAt.clone();
  private readonly cameraLookAt = this.cameraBaseLookAt.clone();
  private readonly modelBasePosition = new THREE.Vector3(1.24, 0, 0);
  private readonly modelGroup = new THREE.Group();
  private readonly riftGroup = buildRiftGroup();

  private particleField: THREE.Points | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private rigBones: RigBones = { head: null, leftEye: null, rightEye: null };
  private bodyTrackingGain = 0.055;

  constructor() {
    super({
      backgroundColor: 0x0a0a0b,
      fog: { color: 0x0a0a0b, near: 6, far: 14 },
      fov: 36,
      canvasClassName: 'title-three-scene__canvas',
    });
    this.renderer.toneMappingExposure = 1.14;
    this.camera.position.copy(this.cameraBasePosition);
    this.camera.lookAt(this.cameraLookAt);
  }

  protected async buildScene(): Promise<void> {
    this.addLights();
    this.scene.add(this.riftGroup);

    const particleCount = window.innerWidth < 768 ? 160 : 280;
    this.particleField = buildParticleField(particleCount);
    this.scene.add(this.particleField);

    const floorGrid = new THREE.GridHelper(10, 28, 0x38bdf8, 0x1e293b);
    floorGrid.position.set(0.5, -1.58, -1.2);
    floorGrid.material.transparent = true;
    floorGrid.material.opacity = 0.14;
    this.scene.add(floorGrid);

    this.modelGroup.name = 'title-su-model-stage';
    this.scene.add(this.modelGroup);

    await this.loadSuModel();
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xbde7ff, 0x0a0a0b, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 4.0);
    keyLight.position.set(2.8, 4.2, 4.6);
    this.scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x67e8f9, 5.2, 7.8);
    rimLight.position.set(-1.9, 1.2, 1.8);
    this.scene.add(rimLight);
    const warmFill = new THREE.PointLight(0xfddcc8, 1.4, 6.4);
    warmFill.position.set(2.8, 0.5, 1.6);
    this.scene.add(warmFill);
  }

  private async loadSuModel(): Promise<void> {
    const loader = new GLTFLoader();
    let modelGltf: GLTF;
    try {
      modelGltf = await loader.loadAsync(suModelUrl);
    } catch {
      // Title remains usable even if the 3D asset fails to load.
      return;
    }

    const model = modelGltf.scene;
    prepareTitleModel(model);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Su sizing & placement on the title screen.
    //   - targetHeight: world-units. ~17% smaller than the previous 3.45 so
    //     she reads as a companion portrait, not a competing hero element.
    //   - xShift: pushes her further to the right so she clears the title
    //     text cluster on the left half of the screen.
    //   - yOffset: vertical world-space anchor of the model's geometric
    //     centre. Matched to `cameraBaseLookAt.y` (0.5) so the camera frames
    //     her bang in the middle of the screen instead of dropping her into
    //     the bottom-right corner.
    const targetHeight = 2.85;
    const xShift = 1.3;
    const yOffset = 0.5;
    const scale = targetHeight / Math.max(size.y, 0.001);
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale + xShift, -center.y * scale + yOffset, -center.z * scale - 0.1);
    model.rotation.y = -0.42;
    this.modelGroup.add(model);
    this.renderer.domElement.parentElement?.setAttribute('data-su-ready', 'true');

    // Bone lookup happens once per session. If the rig didn't ship a head bone
    // we boost the whole-body tilt so the character still tracks the cursor.
    this.rigBones = findRigBones(model);
    if (!this.rigBones.head) {
      this.bodyTrackingGain = 0.12;
    }

    try {
      const mixer = new THREE.AnimationMixer(model);
      this.mixer = mixer;
      const [waveGltf, idleGltf] = await Promise.all([
        loader.loadAsync(suWaveAnimationUrl),
        loader.loadAsync(suIdleAnimationUrl),
      ]);
      const waveClip = waveGltf.animations[0];
      const idleClip = idleGltf.animations[0];
      if (!waveClip || !idleClip) {
        if (idleClip) mixer.clipAction(idleClip, model).play();
        return;
      }

      const waveAction = mixer.clipAction(waveClip, model);
      const idleAction = mixer.clipAction(idleClip, model);
      waveAction.setLoop(THREE.LoopOnce, 1);
      waveAction.clampWhenFinished = true;
      idleAction.setEffectiveWeight(0);
      idleAction.play();
      waveAction.play();

      // Cross-fade wave -> idle when the wave finishes. The AnimationMixer's
      // 'finished' event isn't typed in upstream three.js, so we narrow the
      // listener locally instead of using `any`.
      type MixerFinishedEvent = { type: 'finished'; action: THREE.AnimationAction };
      const onFinished = (event: MixerFinishedEvent) => {
        if (event.action !== waveAction) return;
        mixer.removeEventListener('finished', onFinished as never);
        idleAction.setEffectiveWeight(1);
        waveAction.crossFadeTo(idleAction, 0.6, false);
      };
      mixer.addEventListener('finished', onFinished as never);
    } catch (error) {
      console.warn('[TitleSceneEngine] animation load failed', error);
    }
  }

  protected updateScene(frame: SceneFrame): void {
    this.mixer?.update(frame.delta);
    this.applyHeadTracking(frame);
    this.updateRift(frame);
    this.updateParticles(frame);
    this.updateModel(frame);
    this.updateCamera(frame);
  }

  /**
   * Additive cursor tracking. Runs AFTER mixer.update so it composites on top
   * of the animation clip's bone transforms instead of being overwritten.
   */
  private applyHeadTracking({ pointer }: SceneFrame): void {
    const { head, leftEye, rightEye } = this.rigBones;
    if (!head) return;

    const targetYaw = pointer.x * 0.42;
    const targetPitch = -pointer.y * 0.26;
    head.rotation.y += (targetYaw - head.rotation.y) * 0.18;
    head.rotation.x += (targetPitch - head.rotation.x) * 0.18;

    if (leftEye) {
      leftEye.rotation.y += (pointer.x * 0.55 - leftEye.rotation.y) * 0.3;
      leftEye.rotation.x += (-pointer.y * 0.35 - leftEye.rotation.x) * 0.3;
    }
    if (rightEye) {
      rightEye.rotation.y += (pointer.x * 0.55 - rightEye.rotation.y) * 0.3;
      rightEye.rotation.x += (-pointer.y * 0.35 - rightEye.rotation.x) * 0.3;
    }
  }

  private updateRift({ seconds, delta, pointer }: SceneFrame): void {
    this.riftGroup.rotation.z += delta * 0.1;
    this.riftGroup.rotation.y = 0.18 + Math.sin(seconds * 0.42) * 0.04 + pointer.x * 0.03;
  }

  private updateParticles({ delta }: SceneFrame): void {
    if (!this.particleField) return;
    this.particleField.rotation.y += delta * 0.02;
    this.particleField.rotation.z += delta * 0.014;
  }

  private updateModel({ seconds, pointer }: SceneFrame): void {
    this.modelGroup.rotation.y = Math.sin(seconds * 0.48) * 0.025 + pointer.x * this.bodyTrackingGain;
    this.modelGroup.position.x = this.modelBasePosition.x + pointer.x * 0.04;
    this.modelGroup.position.y = this.modelBasePosition.y + Math.sin(seconds * 0.9) * 0.03;
  }

  private updateCamera({ pointer }: SceneFrame): void {
    this.cameraDesiredPosition.set(
      this.cameraBasePosition.x + pointer.x * 0.32,
      this.cameraBasePosition.y - pointer.y * 0.18,
      this.cameraBasePosition.z - Math.abs(pointer.x) * 0.1,
    );
    this.cameraDesiredLookAt.set(
      this.cameraBaseLookAt.x + pointer.x * 0.24,
      this.cameraBaseLookAt.y - pointer.y * 0.14,
      this.cameraBaseLookAt.z,
    );
    this.camera.position.lerp(this.cameraDesiredPosition, 0.065);
    this.cameraLookAt.lerp(this.cameraDesiredLookAt, 0.065);
    this.camera.lookAt(this.cameraLookAt);
  }

  protected onResize(width: number): void {
    const compact = width < 760;
    this.modelBasePosition.set(compact ? -0.54 : 1.24, compact ? -0.22 : 0, 0);
    this.modelGroup.position.copy(this.modelBasePosition);
    this.modelGroup.scale.setScalar(compact ? 0.78 : 1);
    this.riftGroup.position.x = compact ? -0.2 : 0.18;
    this.cameraBasePosition.set(compact ? -0.12 : 0.42, compact ? 0.76 : 0.78, compact ? 6.25 : 5.4);
    this.cameraBaseLookAt.set(compact ? -0.08 : 0.62, compact ? 0.38 : 0.5, -0.6);
    this.cameraLookAt.copy(this.cameraBaseLookAt);
  }
}
