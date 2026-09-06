import * as T from 'three';

type Patch = { x: number; z: number; width: number; depth: number; y: number; color: string };
type Kind = 'light' | 'shade';

/** Ground-only ambient detail, retained when real-time shadow maps are disabled. */
export class CityGroundLight {
  private patches = new Map<T.Group, Record<Kind, Patch[]>>();
  private geometry = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private texture = new T.DataTexture(new Uint8Array(64 * 64 * 4), 64, 64);
  private materials: Record<Kind, T.MeshBasicMaterial>;
  readonly meshes: T.InstancedMesh[] = [];

  constructor() {
    const data = this.texture.image.data!; // Allocated above; this texture never loads asynchronously.
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const dx = (x + 0.5) / 32 - 1,
          dy = (y + 0.5) / 32 - 1;
        const fade = Math.max(0, 1 - dx * dx - dy * dy);
        const i = (y * 64 + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = Math.round(255 * fade * fade);
      }
    this.texture.magFilter = this.texture.minFilter = T.LinearFilter;
    this.texture.needsUpdate = true;
    const common = {
      map: this.texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    };
    this.materials = {
      light: new T.MeshBasicMaterial({ ...common, blending: T.AdditiveBlending, opacity: 0.24 }),
      shade: new T.MeshBasicMaterial({ ...common, color: '#071511', opacity: 0.34 }),
    };
  }
  add(
    root: T.Group,
    kind: Kind,
    x: number,
    z: number,
    width: number,
    depth = width,
    y = 0.13,
    color = '#ffba65',
  ) {
    let entry = this.patches.get(root);
    if (!entry) {
      entry = { light: [], shade: [] };
      this.patches.set(root, entry);
    }
    entry[kind].push({ x, z, width, depth, y, color });
  }
  build() {
    const transform = new T.Object3D();
    for (const [root, entries] of this.patches)
      for (const kind of ['shade', 'light'] as const) {
        const patches = entries[kind];
        if (!patches.length) continue;
        const mesh = new T.InstancedMesh(this.geometry, this.materials[kind], patches.length);
        mesh.name = `city-ground-${kind}`;
        // Keep instanced transforms intact when district geometry is batched.
        mesh.userData.animated = true;
        mesh.renderOrder = kind === 'light' ? 2 : 1;
        patches.forEach((p, index) => {
          transform.position.set(p.x, p.y, p.z);
          transform.scale.set(p.width, 1, p.depth);
          transform.updateMatrix();
          mesh.setMatrixAt(index, transform.matrix);
          if (kind === 'light') mesh.setColorAt(index, new T.Color(p.color));
        });
        mesh.computeBoundingSphere();
        root.add(mesh);
        this.meshes.push(mesh);
      }
    this.patches.clear();
  }
  dispose() {
    this.meshes.forEach((mesh) => {
      mesh.removeFromParent();
      mesh.dispose();
    });
    this.geometry.dispose();
    this.texture.dispose();
    Object.values(this.materials).forEach((material) => material.dispose());
  }
}
