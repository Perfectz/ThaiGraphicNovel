import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import plant from '../assets/props/household/Potted Plant.glb?url';
import books from '../assets/props/household/Books.glb?url';
import tea from '../assets/props/household/Cup Of Tea.glb?url';
import lamp from '../assets/props/household/Desk Lamp.glb?url';
import bed from '../assets/props/household/Bed.glb?url';
import couch from '../assets/props/household/Couch.glb?url';
import sideTable from '../assets/props/household/End Table.glb?url';
import shadeLamp from '../assets/props/household/Lamp With Shade.glb?url';
import type { CityArea } from './city';

type Fit = {
  id: string;
  width: number;
  depth: number;
  rotation?: number;
  fallback?: string;
  support?: string;
};
type Placement = [CityArea, number, number, number, number, Fit?];
const dressing: { url: string; places: Placement[] }[] = [
  {
    url: bed,
    places: [
      [
        'hotel',
        -58,
        0.09,
        32.5,
        1.35,
        { id: 'guest-bed', width: 3.8, depth: 2.8, rotation: Math.PI / 2, fallback: 'guest-bed-fallback' },
      ],
    ],
  },
  {
    url: couch,
    places: [
      [
        'hotel',
        -50.5,
        0.09,
        32,
        1.25,
        { id: 'lobby-sofa', width: 2.8, depth: 1.8, rotation: Math.PI, fallback: 'lobby-sofa-fallback' },
      ],
    ],
  },
  {
    url: sideTable,
    places: [
      [
        'hotel',
        -60.5,
        0.09,
        32.8,
        0.65,
        { id: 'bedside-table', width: 0.65, depth: 0.65, fallback: 'bedside-fallback' },
      ],
    ],
  },
  {
    url: shadeLamp,
    places: [
      [
        'hotel',
        -60.5,
        0.74,
        32.8,
        0.55,
        { id: 'bedside-lamp', width: 0.45, depth: 0.45, support: 'bedside-table' },
      ],
    ],
  },
  {
    url: plant,
    places: [
      ['hotel', -46.8, 1.23, 24.55, 0.65],
      ['hotel', -51.3, 1.23, 24.55, 0.5],
    ],
  },
  {
    url: books,
    places: [['hotel', -49.8, 1.23, 24.5, 0.17]],
  },
  {
    url: tea,
    places: [['hotel', -48.7, 1.23, 24.5, 0.18]],
  },
  {
    url: lamp,
    places: [['hotel', -48, 1.23, 24.5, 0.55]],
  },
];

export class CityProps {
  state: 'loading' | 'ready' | 'error' = 'loading';
  readonly furniture: {
    id: string;
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  }[] = [];
  private disposed = false;
  private resources: T.Object3D[] = [];
  private attachments: { object: T.Object3D; id: string; support: string }[] = [];
  constructor(chunks: Map<CityArea | 'roads', T.Group>, batch: (root: T.Object3D) => void) {
    void Promise.allSettled(
      dressing.map(async ({ url, places }) => {
        const gltf = await new GLTFLoader().loadAsync(url);
        this.resources.push(gltf.scene);
        if (this.disposed) {
          this.release(gltf.scene);
          return;
        }
        for (const [area, x, y, z, height, fit] of places) {
          const object = gltf.scene.clone(true);
          object.rotation.y = fit?.rotation ?? 0;
          object.updateMatrixWorld(true);
          const bounds = new T.Box3().setFromObject(object);
          const size = bounds.getSize(new T.Vector3());
          object.scale.multiplyScalar(
            Math.min(
              height / size.y,
              fit ? fit.width / size.x : Infinity,
              fit ? fit.depth / size.z : Infinity,
            ),
          );
          object.updateMatrixWorld(true);
          const scaled = new T.Box3().setFromObject(object),
            center = scaled.getCenter(new T.Vector3());
          object.position.set(x - center.x, y - scaled.min.y, z - center.z);
          const upholstery =
            fit?.id === 'lobby-sofa'
              ? new T.MeshStandardMaterial({ color: '#587f73', roughness: 0.92, metalness: 0 })
              : null;
          object.traverse((o) => {
            if (o instanceof T.Mesh) {
              o.castShadow = o.receiveShadow = true;
              if (upholstery) o.material = upholstery;
            }
          });
          const district = chunks.get(area)!;
          const replacement =
            area === 'hotel' && (!fit || fit.id === 'guest-bed' || fit.id === 'lobby-sofa')
              ? district.getObjectByName('hotel-furnishings-fallback')
              : undefined;
          (replacement ?? district).add(object);
          if (fit) {
            object.updateWorldMatrix(true, true);
            const placed = new T.Box3().setFromObject(object);
            this.furniture.push({
              id: fit.id,
              min: { x: placed.min.x, y: placed.min.y, z: placed.min.z },
              max: { x: placed.max.x, y: placed.max.y, z: placed.max.z },
            });
            const fallback = fit.fallback ? chunks.get(area)!.getObjectByName(fit.fallback) : undefined;
            if (fallback) fallback.visible = false;
            if (fit.support) this.attachments.push({ object, id: fit.id, support: fit.support });
          }
          batch(object);
        }
      }),
    ).then((results) => {
      if (this.disposed) return;
      for (const { object, id, support } of this.attachments) {
        const base = this.furniture.find((f) => f.id === support),
          item = this.furniture.find((f) => f.id === id);
        if (!base || !item) continue;
        object.position.y += base.max.y - item.min.y;
        object.updateWorldMatrix(true, true);
        const box = new T.Box3().setFromObject(object);
        item.min = { x: box.min.x, y: box.min.y, z: box.min.z };
        item.max = { x: box.max.x, y: box.max.y, z: box.max.z };
      }
      this.attachments = [];
      this.state = results.some((r) => r.status === 'rejected') ? 'error' : 'ready';
    });
  }
  private release(root: T.Object3D) {
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          for (const v of Object.values(m)) if (v instanceof T.Texture) v.dispose();
          m.dispose();
        }
      }
    });
  }
  dispose() {
    this.disposed = true;
    this.resources.forEach((o) => this.release(o));
  }
}
