import * as THREE from 'three';

export type RoomPalette = {
  floor: number;
  wall: number;
  accent: number;
  trim: number;
  glow: number;
};

/* ─────────────────────────────────────────────────────────────────────────
 * Collision marking
 *
 * Primitives accept `collider?: boolean`. When omitted, we auto-detect by
 * checking whether any part of the object's Y extent overlaps Patrick's body
 * (roughly y ∈ [PLAYER_FLOOR_LIP, PLAYER_BODY_TOP]). Floor decals, ceiling
 * trim, lantern strings hanging from the ceiling, and other decoratives fall
 * outside the range and are skipped automatically.
 *
 * Composite helpers explicitly opt their internal pieces in or out so the
 * default never has to be argued with at the call site (e.g. a stall counter
 * blocks; the menu board hanging over it doesn't).
 * ───────────────────────────────────────────────────────────────────────── */
export const PLAYER_FLOOR_LIP = 0.05;
export const PLAYER_BODY_TOP = 1.9;

function autoCollider(size: [number, number, number], position: [number, number, number]) {
  const halfH = size[1] / 2;
  const top = position[1] + halfH;
  const bottom = position[1] - halfH;
  return top > PLAYER_FLOOR_LIP && bottom < PLAYER_BODY_TOP;
}

/** Mark an arbitrary Object3D as a movement collider. Used for non-primitive
 *  meshes (loaded GLTFs, raw THREE.Mesh built outside the helpers). */
export function markCollider(object: THREE.Object3D, radius?: number) {
  object.userData.collider = true;
  if (typeof radius === 'number') object.userData.colliderRadius = radius;
}

export function createStandardMaterial(
  color: number,
  roughness = 0.72,
  metalness = 0.04,
  emissive = 0x000000,
  emissiveIntensity = 0,
) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
}

export function addBox(
  group: THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  color: number,
  options: {
    roughness?: number;
    metalness?: number;
    emissive?: number;
    emissiveIntensity?: number;
    rotationY?: number;
    /** Override movement-collision marking. Default: auto-detect by Y extent. */
    collider?: boolean;
  } = {},
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    createStandardMaterial(
      color,
      options.roughness,
      options.metalness,
      options.emissive ?? 0,
      options.emissiveIntensity ?? 0,
    ),
  );
  mesh.position.set(...position);
  if (options.rotationY) mesh.rotation.y = options.rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (options.collider ?? autoCollider(size, position)) {
    mesh.userData.collider = true;
  }
  group.add(mesh);
  return mesh;
}

export function addEmissiveBox(
  group: THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  color: number,
  intensity = 0.75,
  options: { collider?: boolean } = {},
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    createStandardMaterial(color, 0.45, 0.02, color, intensity),
  );
  mesh.position.set(...position);
  if (options.collider ?? autoCollider(size, position)) {
    mesh.userData.collider = true;
  }
  group.add(mesh);
  return mesh;
}

export function addCylinder(
  group: THREE.Group,
  radius: number,
  height: number,
  position: [number, number, number],
  color: number,
  options: {
    segments?: number;
    emissive?: number;
    emissiveIntensity?: number;
    rotationZ?: number;
    roughness?: number;
    metalness?: number;
    collider?: boolean;
  } = {},
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, options.segments ?? 24),
    createStandardMaterial(
      color,
      options.roughness ?? 0.72,
      options.metalness ?? 0.04,
      options.emissive ?? 0,
      options.emissiveIntensity ?? 0,
    ),
  );
  mesh.position.set(...position);
  if (options.rotationZ) mesh.rotation.z = options.rotationZ;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Cylinder upright: extent in Y == height, in XZ == 2*radius
  if (options.collider ?? autoCollider([radius * 2, height, radius * 2], position)) {
    mesh.userData.collider = true;
  }
  group.add(mesh);
  return mesh;
}

export function addSphere(
  group: THREE.Group,
  radius: number,
  position: [number, number, number],
  color: number,
  options: { emissive?: number; emissiveIntensity?: number; collider?: boolean } = {},
) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 22, 14),
    createStandardMaterial(color, 0.55, 0.05, options.emissive ?? 0, options.emissiveIntensity ?? 0),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  if (options.collider ?? autoCollider([radius * 2, radius * 2, radius * 2], position)) {
    mesh.userData.collider = true;
  }
  group.add(mesh);
  return mesh;
}

export function addCone(
  group: THREE.Group,
  radius: number,
  height: number,
  position: [number, number, number],
  color: number,
  segments = 18,
  options: { collider?: boolean } = {},
) {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, segments),
    createStandardMaterial(color),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  if (options.collider ?? autoCollider([radius * 2, height, radius * 2], position)) {
    mesh.userData.collider = true;
  }
  group.add(mesh);
  return mesh;
}

export function addPlane(
  group: THREE.Group,
  size: [number, number],
  position: [number, number, number],
  color: number,
  // Planes are flat (typically a floor decal or back-wall poster). Default: no collider.
  options: {
    emissive?: number;
    emissiveIntensity?: number;
    rotationX?: number;
    opacity?: number;
    collider?: boolean;
  } = {},
) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.05,
    emissive: options.emissive ?? 0,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: typeof options.opacity === 'number' && options.opacity < 1,
    opacity: options.opacity ?? 1,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), material);
  mesh.position.set(...position);
  mesh.rotation.x = options.rotationX ?? -Math.PI / 2;
  mesh.receiveShadow = true;
  if (options.collider) mesh.userData.collider = true;
  group.add(mesh);
  return mesh;
}

export function addWallPanel(
  group: THREE.Group,
  position: [number, number, number],
  size: [number, number],
  color: number,
  trimColor: number,
) {
  // Main panel collides (auto-detected). Trim is decorative — skip.
  addBox(group, [size[0], size[1], 0.08], position, color);
  addBox(
    group,
    [size[0] + 0.18, 0.08, 0.1],
    [position[0], position[1] + size[1] / 2 + 0.07, position[2] + 0.01],
    trimColor,
    { collider: false },
  );
  addBox(
    group,
    [size[0] + 0.18, 0.08, 0.1],
    [position[0], position[1] - size[1] / 2 - 0.07, position[2] + 0.01],
    trimColor,
    { collider: false },
  );
  addBox(
    group,
    [0.08, size[1] + 0.18, 0.1],
    [position[0] - size[0] / 2 - 0.07, position[1], position[2] + 0.01],
    trimColor,
    { collider: false },
  );
  addBox(
    group,
    [0.08, size[1] + 0.18, 0.1],
    [position[0] + size[0] / 2 + 0.07, position[1], position[2] + 0.01],
    trimColor,
    { collider: false },
  );
}

export function addRoomShell(
  group: THREE.Group,
  palette: RoomPalette,
  options: { floorTiles?: boolean; backWall?: boolean; sideWalls?: boolean; ceilingTrim?: boolean } = {},
) {
  const { floorTiles = true, backWall = true, sideWalls = true, ceilingTrim = true } = options;
  // Floor (lies under PLAYER_FLOOR_LIP — auto-skipped, but be explicit for clarity)
  addBox(group, [18, 0.1, 12], [0, -0.05, 0], palette.floor, { collider: false });
  // Floor grid lines — pure decals
  if (floorTiles) {
    const lineColor = darken(palette.floor, 0.4);
    for (let x = -8; x <= 8; x += 2) {
      addBox(group, [0.025, 0.012, 11.7], [x, 0.018, 0], lineColor, { collider: false });
    }
    for (let z = -5; z <= 5; z += 2) {
      addBox(group, [17.7, 0.012, 0.025], [0, 0.02, z], lineColor, { collider: false });
    }
  }
  // Back wall — blocks
  if (backWall) {
    addBox(group, [18, 5, 0.18], [0, 2.5, -6], palette.wall);
  }
  // Side walls — block
  if (sideWalls) {
    addBox(group, [0.18, 5, 12], [-9, 2.5, 0], palette.wall);
    addBox(group, [0.18, 5, 12], [9, 2.5, 0], palette.wall);
  }
  // Ceiling trim — decoratives
  if (ceilingTrim) {
    addBox(group, [18, 0.18, 0.18], [0, 2.9, -5.85], palette.accent, { collider: false });
    addBox(group, [18, 0.16, 0.16], [0, 0.42, -5.82], palette.accent, { collider: false });
  }
}

export function addCeilingLights(group: THREE.Group, palette: RoomPalette, xs = [-4.5, 0, 4.5], z = -2.3) {
  xs.forEach((x) => addEmissiveBox(group, [1.7, 0.06, 0.18], [x, 4.05, z], palette.trim, 0.9));
}

export function addPottedPlant(group: THREE.Group, x: number, z: number) {
  addCylinder(group, 0.28, 0.42, [x, 0.21, z], 0x9a5b32);
  addCylinder(group, 0.19, 1.15, [x, 0.85, z], 0x2f5f46, { segments: 10 });
  addBox(group, [0.72, 0.24, 0.18], [x + 0.18, 1.28, z], 0x4ade80);
  addBox(group, [0.2, 0.22, 0.72], [x - 0.16, 1.08, z + 0.08], 0x22c55e);
}

export function addHangingLantern(group: THREE.Group, x: number, y: number, z: number, color: number) {
  // Hanging decor — none of it should block walking
  // Cord
  addBox(group, [0.04, y, 0.04], [x, y / 2 + 0.5, z], 0x111827, { collider: false });
  // Body (paper lantern) — raw mesh, no collider userData set
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 22, 18),
    createStandardMaterial(color, 0.45, 0.0, color, 1.2),
  );
  body.position.set(x, 0.5, z);
  body.scale.y = 0.85;
  group.add(body);
  // Top cap
  addBox(group, [0.18, 0.06, 0.18], [x, 0.85, z], 0x111827, { collider: false });
  // Bottom tassel
  addBox(group, [0.06, 0.22, 0.06], [x, 0.18, z], 0xfbbf24, {
    emissive: 0xfbbf24,
    emissiveIntensity: 0.4,
    collider: false,
  });
  // Point light (cheap)
  const light = new THREE.PointLight(color, 0.85, 4.2);
  light.position.set(x, 0.6, z);
  group.add(light);
  return body;
}

export function addStreetLamp(group: THREE.Group, x: number, z: number, color = 0xfde68a) {
  // Pole
  addCylinder(group, 0.08, 3.6, [x, 1.8, z], 0x1f2937);
  // Arm
  addBox(group, [0.08, 0.08, 1.2], [x, 3.4, z + 0.6], 0x1f2937);
  // Lamp head
  addBox(group, [0.6, 0.36, 0.5], [x, 3.2, z + 1.05], 0x111827);
  addEmissiveBox(group, [0.55, 0.05, 0.45], [x, 3.0, z + 1.05], color, 1.4);
  const light = new THREE.PointLight(color, 1.3, 8);
  light.position.set(x, 3.0, z + 1.05);
  group.add(light);
}

export function addNeonSign(
  group: THREE.Group,
  position: [number, number, number],
  size: [number, number],
  color: number,
  thickness = 0.18,
) {
  addBox(group, [size[0] + 0.1, size[1] + 0.1, 0.05], position, 0x0b1120);
  addEmissiveBox(group, [size[0], size[1], thickness], position, color, 1.4);
}

export function addStallCounter(
  group: THREE.Group,
  position: [number, number, number],
  width = 3.2,
  bodyColor = 0x7c3f24,
  topColor = 0xb45b35,
) {
  const [x, , z] = position;
  addBox(group, [width, 0.95, 1.4], [x, 0.475, z], bodyColor);
  addBox(group, [width + 0.18, 0.16, 1.55], [x, 1.04, z], topColor);
  addBox(group, [width + 0.22, 0.06, 0.06], [x, 1.16, z + 0.74], 0xfbbf24, {
    emissive: 0xfbbf24,
    emissiveIntensity: 0.5,
  });
}

export function addWok(group: THREE.Group, position: [number, number, number]) {
  const [x, y, z] = position;
  // Burner
  addCylinder(group, 0.32, 0.22, [x, y + 0.11, z], 0x111827, { segments: 26 });
  // Wok bowl (sphere half)
  const wokGeo = new THREE.SphereGeometry(0.36, 26, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  const wok = new THREE.Mesh(wokGeo, createStandardMaterial(0x1f2937, 0.4, 0.65));
  wok.position.set(x, y + 0.22, z);
  wok.scale.y = 0.7;
  group.add(wok);
  // Heat glow
  addEmissiveBox(group, [0.35, 0.04, 0.35], [x, y + 0.07, z], 0xf97316, 1.6);
  // Heat light
  const light = new THREE.PointLight(0xf97316, 0.6, 2.4);
  light.position.set(x, y + 0.4, z);
  group.add(light);
}

export function addLanternStringBetween(
  group: THREE.Group,
  fromX: number,
  toX: number,
  z: number,
  baseY = 3.6,
  count = 6,
  color = 0xfbbf24,
) {
  // String
  addBox(group, [Math.abs(toX - fromX), 0.02, 0.02], [(fromX + toX) / 2, baseY, z], 0x1f2937);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const x = fromX + (toX - fromX) * t;
    const drop = 0.08 + Math.sin(t * Math.PI) * 0.06;
    addHangingLantern(group, x, baseY - 0.8 - drop, z, color);
  }
}

export function disposeObjectTree(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material?.dispose?.();
  });
}

export function darken(color: number, amount = 0.3) {
  const c = new THREE.Color(color);
  c.r = Math.max(0, c.r * (1 - amount));
  c.g = Math.max(0, c.g * (1 - amount));
  c.b = Math.max(0, c.b * (1 - amount));
  return c.getHex();
}

export function lighten(color: number, amount = 0.3) {
  const c = new THREE.Color(color);
  c.r = Math.min(1, c.r + (1 - c.r) * amount);
  c.g = Math.min(1, c.g + (1 - c.g) * amount);
  c.b = Math.min(1, c.b + (1 - c.b) * amount);
  return c.getHex();
}

export function addParticleField(
  group: THREE.Group,
  count: number,
  bounds: { x: [number, number]; y: [number, number]; z: [number, number] },
  color: number,
  size = 0.06,
) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = bounds.x[0] + Math.random() * (bounds.x[1] - bounds.x[0]);
    positions[i * 3 + 1] = bounds.y[0] + Math.random() * (bounds.y[1] - bounds.y[0]);
    positions[i * 3 + 2] = bounds.z[0] + Math.random() * (bounds.z[1] - bounds.z[0]);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  group.add(points);
  return points;
}

export function addRiftPortal(group: THREE.Group, position: [number, number, number], radius = 1.4) {
  const [x, y, z] = position;
  // Outer ring
  const ringGeo = new THREE.RingGeometry(radius * 0.92, radius, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(x, y, z);
  group.add(ring);

  // Inner disk
  const diskGeo = new THREE.CircleGeometry(radius * 0.92, 64);
  const diskMat = new THREE.MeshBasicMaterial({
    color: 0x4c1d95,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const disk = new THREE.Mesh(diskGeo, diskMat);
  disk.position.set(x, y, z - 0.01);
  group.add(disk);

  // Rift light
  const light = new THREE.PointLight(0xa855f7, 2.4, 10);
  light.position.set(x, y, z + 0.4);
  group.add(light);
  return { ring, disk };
}
