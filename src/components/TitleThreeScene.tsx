import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import suIdleAnimationUrl from '../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Animation_Idle_4_withSkin.glb?url';
import suModelUrl from '../assets/debug/su-rig/Meshy_AI_Neon_Circuit_Princess_biped_Character_output.glb?url';

function prepareTitleModel(model: THREE.Object3D) {
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

function createParticleField(count: number) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const radius = 2.2 + Math.random() * 5.8;
    const angle = Math.random() * Math.PI * 2;
    const height = -1.8 + Math.random() * 4.5;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = height;
    positions[index * 3 + 2] = -4.2 + Math.sin(angle) * radius * 0.45;

    color.setHSL(0.52 + Math.random() * 0.28, 0.9, 0.62 + Math.random() * 0.2);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.035,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

function createRiftGroup() {
  const group = new THREE.Group();
  group.name = 'title-three-rift';
  group.position.set(-0.85, 0.35, -2.75);
  group.rotation.set(-0.18, 0.18, -0.08);

  for (let index = 0; index < 7; index += 1) {
    const radius = 0.72 + index * 0.18;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.008 + index * 0.0012, 8, 96),
      new THREE.MeshBasicMaterial({
        color: index % 2 ? 0xf472b6 : 0x67e8f9,
        transparent: true,
        opacity: 0.42 - index * 0.035,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.rotation.set(Math.PI * 0.46, index * 0.22, index * 0.18);
    ring.position.z = -index * 0.05;
    group.add(ring);
  }

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.38, 2),
    new THREE.MeshBasicMaterial({
      color: 0xbff6ff,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(core);

  return group;
}

function createFloatingPanel(index: number) {
  const geometry = new THREE.PlaneGeometry(0.58 + Math.random() * 0.42, 1.45 + Math.random() * 1.15);
  const material = new THREE.MeshBasicMaterial({
    color: index % 2 ? 0x38bdf8 : 0xf0abfc,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const panel = new THREE.Mesh(geometry, material);
  panel.position.set(-3.1 + index * 1.12, -0.05 + Math.random() * 1.5, -3.3 - Math.random() * 2.4);
  panel.rotation.set(0.1 + Math.random() * 0.3, -0.42 + Math.random() * 0.84, -0.18 + Math.random() * 0.36);
  return panel;
}

function isCameraBlockedTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('a, button, input, select, textarea, [role="button"]'));
}

export function TitleThreeScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const mountElement = mount;

    let disposed = false;
    let animationFrame = 0;
    let lastTime = performance.now();
    let mixer: THREE.AnimationMixer | null = null;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const cameraBasePosition = new THREE.Vector3(0.78, 0.72, 5.9);
    const cameraDesiredPosition = cameraBasePosition.clone();
    const cameraBaseLookAt = new THREE.Vector3(0.84, 0.22, -0.82);
    const cameraLookAt = cameraBaseLookAt.clone();
    const cameraDesiredLookAt = cameraLookAt.clone();
    const modelBasePosition = new THREE.Vector3(1.24, 0, 0);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020312);
    scene.fog = new THREE.Fog(0x020312, 6, 14);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 40);
    camera.position.copy(cameraBasePosition);
    camera.lookAt(cameraLookAt);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.3));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    renderer.domElement.className = 'title-three-scene__canvas';
    mountElement.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xbde7ff, 0x251229, 2.3));
    const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
    keyLight.position.set(2.8, 4.2, 4.6);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x67e8f9, 4.8, 7.8);
    rimLight.position.set(-1.9, 1.2, 1.8);
    scene.add(rimLight);
    const magentaLight = new THREE.PointLight(0xf472b6, 2.4, 6.4);
    magentaLight.position.set(2.8, 0.5, 1.6);
    scene.add(magentaLight);

    const riftGroup = createRiftGroup();
    scene.add(riftGroup);

    const particleField = createParticleField(window.innerWidth < 768 ? 180 : 320);
    scene.add(particleField);

    const panels = Array.from({ length: 7 }, (_, index) => createFloatingPanel(index));
    panels.forEach((panel) => scene.add(panel));

    const floorGrid = new THREE.GridHelper(10, 28, 0x38bdf8, 0x1e293b);
    floorGrid.position.set(0.5, -1.58, -1.2);
    floorGrid.material.transparent = true;
    floorGrid.material.opacity = 0.26;
    scene.add(floorGrid);

    const loader = new GLTFLoader();
    const modelGroup = new THREE.Group();
    modelGroup.name = 'title-su-model-stage';
    scene.add(modelGroup);

    loader
      .loadAsync(suModelUrl)
      .then(async (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        prepareTitleModel(model);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = 3.45 / Math.max(size.y, 0.001);
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale + 1.64, -center.y * scale - 1.28, -center.z * scale - 0.1);
        model.rotation.y = -0.42;
        modelGroup.add(model);

        mixer = new THREE.AnimationMixer(model);
        const idleGltf = await loader.loadAsync(suIdleAnimationUrl);
        if (disposed || !mixer) return;
        const clip = idleGltf.animations[0];
        if (clip) {
          const action = mixer.clipAction(clip, model);
          action.play();
        }
      })
      .catch(() => {
        // Title remains usable even if the 3D asset fails to load.
      });

    function resize() {
      const width = Math.max(1, mountElement.clientWidth);
      const height = Math.max(1, mountElement.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const compact = width < 760;
      modelBasePosition.set(compact ? 0.42 : 1.24, compact ? -0.18 : 0, 0);
      modelGroup.position.copy(modelBasePosition);
      modelGroup.scale.setScalar(compact ? 0.78 : 1);
      riftGroup.position.x = compact ? 0.02 : 0.18;
      cameraBasePosition.set(compact ? 0.36 : 0.78, compact ? 0.7 : 0.72, compact ? 6.24 : 5.9);
      cameraBaseLookAt.set(compact ? 0.44 : 0.84, compact ? 0.16 : 0.22, -0.82);
      cameraLookAt.copy(cameraBaseLookAt);
    }

    function handlePointerMove(event: PointerEvent) {
      if (isCameraBlockedTarget(event.target)) return;
      pointer.targetX = THREE.MathUtils.clamp((event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2, -1, 1);
      pointer.targetY = THREE.MathUtils.clamp((event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2, -1, 1);
    }

    function handlePointerLeave() {
      pointer.targetX = 0;
      pointer.targetY = 0;
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mountElement);
    resize();
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerleave', handlePointerLeave);

    function animate(time: number) {
      if (disposed) return;
      const delta = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      const seconds = time / 1000;
      pointer.x += (pointer.targetX - pointer.x) * 0.055;
      pointer.y += (pointer.targetY - pointer.y) * 0.055;

      mixer?.update(delta);
      riftGroup.rotation.z += delta * 0.14;
      riftGroup.rotation.y = 0.18 + Math.sin(seconds * 0.42) * 0.05 + pointer.x * 0.04;
      particleField.rotation.y += delta * 0.025;
      particleField.rotation.z += delta * 0.018;
      modelGroup.rotation.y = Math.sin(seconds * 0.48) * 0.035 + pointer.x * 0.055;
      modelGroup.position.x = modelBasePosition.x + pointer.x * 0.06;
      modelGroup.position.y = modelBasePosition.y + Math.sin(seconds * 0.9) * 0.035;
      cameraDesiredPosition.set(
        cameraBasePosition.x + pointer.x * 0.42,
        cameraBasePosition.y - pointer.y * 0.22,
        cameraBasePosition.z - Math.abs(pointer.x) * 0.14,
      );
      cameraDesiredLookAt.set(
        cameraBaseLookAt.x + pointer.x * 0.32,
        cameraBaseLookAt.y - pointer.y * 0.18,
        cameraBaseLookAt.z,
      );
      camera.position.lerp(cameraDesiredPosition, 0.065);
      cameraLookAt.lerp(cameraDesiredLookAt, 0.065);
      camera.lookAt(cameraLookAt);
      panels.forEach((panel, index) => {
        panel.rotation.z += Math.sin(seconds * 0.35 + index) * 0.0008;
        panel.position.y += Math.sin(seconds * 0.55 + index) * 0.0009;
      });

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    }

    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => material?.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} className="title-three-scene absolute inset-0" aria-hidden="true" />;
}
