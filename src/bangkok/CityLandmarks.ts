import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CityArea } from './city';

export const landmarkSites = [
  {
    id: 'oldtown-hall',
    area: 'oldtown',
    at: [43, 0, 35.5],
    parts: ['HallBase', 'HallWalls', 'HallRoof'],
    cutaways: ['HallWalls', 'HallRoof'],
  },
  {
    id: 'lumphini-pavilion',
    area: 'lumphini',
    at: [-24.5, 0, 25],
    parts: ['PavilionBase', 'PavilionSupports', 'PavilionRoof'],
    cutaways: ['PavilionRoof'],
  },
] as const;
type Landmark = {
  id: string;
  state: 'loading' | 'ready' | 'fallback';
  fallback: T.Group;
  root?: T.Group;
  parts: T.Object3D[];
};

/** Blender-authored metre-scale landmarks, with structural parts for camera cutaways. */
export class CityLandmarks {
  readonly models: Landmark[] = [];
  private disposed = false;
  constructor(
    chunks: Map<CityArea | 'roads', T.Group>,
    batch: (root: T.Object3D) => void,
    cutaway: (root: T.Object3D) => void,
  ) {
    for (const site of landmarkSites) {
      const district = chunks.get(site.area)!;
      const fallback = district.getObjectByName(`${site.id}-fallback`) as T.Group;
      const entry: Landmark = { id: site.id, state: 'loading', fallback, parts: [] };
      this.models.push(entry);
      void new GLTFLoader()
        .loadAsync(`${import.meta.env.BASE_URL}bangkok/models/${site.id}.glb`)
        .then((gltf) => {
          const root = gltf.scene;
          if (this.disposed) {
            this.release(root);
            return;
          }
          const parts = site.parts.map((name) => root.getObjectByName(name));
          if (parts.some((p) => !p)) {
            this.release(root);
            entry.state = 'fallback';
            return;
          }
          root.position.set(site.at[0], site.at[1], site.at[2]);
          root.name = site.id;
          root.userData.animated = true; // Keep the imported hierarchy out of district-wide static merging.
          root.traverse((o) => {
            if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
          });
          district.add(root);
          entry.root = root;
          entry.parts = parts as T.Object3D[];
          for (const part of entry.parts) {
            if ((site.cutaways as readonly string[]).includes(part.name)) cutaway(part);
            batch(part);
          }
          fallback.visible = false;
          entry.state = 'ready';
        })
        .catch(() => {
          if (!this.disposed) entry.state = 'fallback';
        });
    }
  }
  syncVisibility() {
    const hall = this.models.find((m) => m.id === 'oldtown-hall');
    const walls = hall?.parts.find((p) => p.name === 'HallWalls');
    const roof = hall?.parts.find((p) => p.name === 'HallRoof');
    if (walls && roof && !walls.visible) roof.visible = false;
  }
  snapshot() {
    return this.models.map((m) => ({
      id: m.id,
      state: m.state,
      fallback: m.fallback.visible,
      visible: !!m.root?.parent?.visible,
      parts: m.parts.map((p) => ({ name: p.name, visible: p.visible })),
    }));
  }
  private release(root: T.Object3D) {
    const geometry = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>();
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        geometry.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      }
    });
    geometry.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }
  // Attached geometry is disposed by the world's scene traversal. Late loads release themselves.
  dispose() {
    this.disposed = true;
  }
}
