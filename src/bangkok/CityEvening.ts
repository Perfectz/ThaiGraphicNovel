import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AdventureSave } from './adventure';
import { eveningOrder, eveningRoute } from './eveningOuting.ts';
import { foodStallOrigin, parkServingTable, type CityArea } from './city.ts';

export const eveningServiceParts = [
  'MealBase',
  'MealContents',
  'ChilliAdded',
  'ChilliAside',
  'ParkTable',
  'WaterSet',
  'TeaSet',
] as const;
type Part = (typeof eveningServiceParts)[number];

/** The save is the only authority: previews never serve food or choose a drink. */
export function eveningDisplay(save: AdventureSave) {
  const route = eveningRoute(save),
    order = eveningOrder(save);
  return {
    meal: save.flags.includes('cook') || (route === 'food' && !!order),
    chilli: order === 'evening-chilli',
    drink: route === 'park' && order ? (order === 'evening-water' ? 'water' : 'tea') : null,
  } as const;
}

/** Small Blender scenes make the traveller's words visibly change their surroundings. */
export class CityEvening {
  private parts = new Map<Part, T.Group>();
  private fallbacks: T.Group[] = [];
  private disposed = false;
  private display = { meal: false, chilli: false, drink: null as 'water' | 'tea' | null };
  state: 'loading' | 'ready' | 'fallback' = 'loading';
  constructor(chunks: Map<CityArea | 'roads', T.Group>, batch: (root: T.Object3D) => void) {
    for (const name of eveningServiceParts) {
      const group = new T.Group();
      group.name = name;
      group.userData.animated = true;
      const park = ['ParkTable', 'WaterSet', 'TeaSet'].includes(name);
      group.position.set(
        park ? parkServingTable.x + parkServingTable.w / 2 : foodStallOrigin.x,
        park ? (name === 'ParkTable' ? 0.26 : 1.14) : 1.12,
        park ? parkServingTable.z + parkServingTable.d / 2 : foodStallOrigin.z,
      );
      chunks.get(park ? 'lumphini' : 'yaowarat')!.add(group);
      this.parts.set(name, group);
      const fallback = new T.Group();
      fallback.userData.animated = true;
      group.add(fallback);
      this.fallbacks.push(fallback);
      this.fallback(name, fallback);
      batch(fallback);
    }
    this.apply();
    void new GLTFLoader()
      .loadAsync(`${import.meta.env.BASE_URL}bangkok/models/evening-service.glb`)
      .then(({ scene }) => {
        if (this.disposed) {
          this.release(scene);
          return;
        }
        const parts = eveningServiceParts.map((name) => scene.getObjectByName(name));
        if (parts.some((p) => !p)) {
          this.release(scene);
          this.state = 'fallback';
          return;
        }
        parts.forEach((part, i) => {
          part!.traverse((o) => {
            if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
          });
          this.parts.get(eveningServiceParts[i])!.add(part!);
          batch(part!);
        });
        this.fallbacks.forEach((f) => {
          f.visible = false;
        });
        this.state = 'ready';
      })
      .catch(() => {
        if (!this.disposed) this.state = 'fallback';
      });
  }
  private fallback(name: Part, parent: T.Group) {
    const material = (color: string) => new T.MeshStandardMaterial({ color, roughness: 0.6 });
    const add = (geometry: T.BufferGeometry, color: string, x: number, y: number, z: number) => {
      const mesh = new T.Mesh(geometry, material(color));
      mesh.position.set(x, y, z);
      parent.add(mesh);
    };
    if (name === 'ParkTable') {
      add(new T.BoxGeometry(1.2, 0.08, 0.5), '#79523c', 0, 0.84, 0);
      for (const x of [-0.52, 0.52])
        for (const z of [-0.18, 0.18]) add(new T.BoxGeometry(0.085, 0.81, 0.085), '#79523c', x, 0.415, z);
    } else if (name === 'MealBase') {
      add(new T.BoxGeometry(1.75, 0.045, 0.68), '#79523c', 0, 0.03, 0);
      for (const x of [-0.49, 0.49]) add(new T.CylinderGeometry(0.26, 0.12, 0.22, 16), '#8dae98', x, 0.16, 0);
    } else if (name === 'MealContents') {
      for (const x of [-0.49, 0.49])
        add(new T.CylinderGeometry(0.225, 0.225, 0.012, 16), '#bb9559', x, 0.277, 0);
    } else if (name === 'ChilliAdded' || name === 'ChilliAside') {
      for (const x of name === 'ChilliAdded' ? [-0.49, 0.49] : [0])
        add(new T.SphereGeometry(0.065, 8, 4), '#c84426', x, name === 'ChilliAdded' ? 0.3 : 0.09, 0.08);
    } else {
      add(
        new T.CylinderGeometry(0.1, 0.12, 0.35, 16),
        name === 'WaterSet' ? '#8dae98' : '#b4aaa0',
        0,
        0.2,
        -0.075,
      );
      for (const x of [-0.15, 0.15])
        add(
          new T.CylinderGeometry(0.065, 0.052, 0.12, 12),
          name === 'WaterSet' ? '#9bcbd6' : '#c49043',
          x,
          0.09,
          0.11,
        );
    }
  }
  sync(save: AdventureSave) {
    this.display = eveningDisplay(save);
    this.apply();
  }
  private apply() {
    this.parts.get('MealContents')!.visible = this.display.meal;
    this.parts.get('ChilliAdded')!.visible = this.display.meal && this.display.chilli;
    this.parts.get('ChilliAside')!.visible = !this.display.chilli;
    for (const [name, drink, offset] of [
      ['WaterSet', 'water', -0.28],
      ['TeaSet', 'tea', 0.28],
    ] as const) {
      const group = this.parts.get(name)!;
      group.visible = !this.display.drink || this.display.drink === drink;
      group.position.x = parkServingTable.x + parkServingTable.w / 2 + (this.display.drink ? 0 : offset);
    }
  }
  snapshot() {
    return {
      state: this.state,
      ...this.display,
      parts: [...this.parts].map(([name, p]) => ({ name, visible: p.visible })),
    };
  }
  private release(root: T.Object3D) {
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
      }
    });
  }
  dispose() {
    this.disposed = true;
  }
}
