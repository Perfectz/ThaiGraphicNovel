import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { archiveRooms, archiveFloors, archiveWalls, archiveFurniture } from './archiveLayout';
/** A continuous Blender-built interior; per-room cutaways reveal the party without removing navigation walls. */
export class CityArchive {
  root: T.Group | null = null;
  state: 'loading' | 'ready' | 'fallback' = 'loading';
  private disposed = false;
  private parts: T.Object3D[] = [];
  private fallback: T.Group;
  constructor(group: T.Group, batch: (root: T.Object3D) => void, cutaway: (root: T.Object3D) => void) {
    this.fallback = new T.Group();
    group.add(this.fallback);
    const mat = new T.MeshStandardMaterial({ color: '#a28259', roughness: 0.8 });
    for (const r of [...archiveFloors, ...archiveWalls, ...archiveFurniture]) {
      const wall = archiveWalls.includes(r),
        furniture = archiveFurniture.includes(r);
      const h = wall ? 1.1 : furniture ? 0.8 : 0.1;
      const mesh = new T.Mesh(new T.BoxGeometry(r.w, h, r.d), mat);
      mesh.position.set(r.x + r.w / 2, h / 2, r.z + r.d / 2);
      this.fallback.add(mesh);
    }
    batch(this.fallback);
    void new GLTFLoader()
      .loadAsync(`${import.meta.env.BASE_URL}bangkok/models/oldtown-archive.glb`)
      .then((gltf) => {
        const root = gltf.scene;
        if (this.disposed) {
          this.release(root);
          return;
        }
        const names = [
          'ArchiveBase',
          'ArchiveFurniture',
          ...archiveRooms.flatMap((r) => [`${r.id}Walls`, `${r.id}Roof`]),
        ];
        const parts = names.map((n) => root.getObjectByName(n));
        if (parts.some((p) => !p)) {
          this.release(root);
          this.state = 'fallback';
          return;
        }
        this.root = root;
        this.parts = parts as T.Object3D[];
        root.userData.animated = true;
        root.name = 'oldtown-archive';
        group.add(root);
        root.traverse((o) => {
          if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
        });
        for (const part of this.parts) {
          if (/Walls$|Roof$/.test(part.name)) cutaway(part);
          batch(part);
        }
        this.fallback.visible = false;
        this.state = 'ready';
      })
      .catch(() => {
        if (!this.disposed) this.state = 'fallback';
      });
  }
  reveal(points: { x: number; z: number }[]) {
    for (const room of archiveRooms) {
      // Standing indoors always opens that room's roof, including the entire dialogue frame.
      const inside = points.some(
        (p) =>
          p.x >= room.x - 0.5 &&
          p.x <= room.x + room.w + 0.5 &&
          p.z >= room.z - 0.5 &&
          p.z <= room.z + room.d + 0.5,
      );
      const roof = this.parts.find((p) => p.name === `${room.id}Roof`),
        walls = this.parts.find((p) => p.name === `${room.id}Walls`);
      if (roof && (inside || (walls && !walls.visible))) roof.visible = false;
    }
  }
  snapshot() {
    return {
      state: this.state,
      rooms: archiveRooms.length,
      fallback: this.fallback.visible,
      parts: this.parts.map((p) => ({ name: p.name, visible: p.visible })),
    };
  }
  private release(root: T.Object3D) {
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>();
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }
  dispose() {
    this.disposed = true;
  }
}
