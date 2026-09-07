import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { canalHouses } from './thonburi.ts';
import { disposeWorldObject } from './worldResources.ts';

export const canalHouseParts = ['HouseBase', 'HouseFront', 'HouseBack', 'HouseEast', 'HouseWest', 'HouseRoof'] as const;

/** One shared timber-house kit; each facade can reveal the party independently of its roof. */
export class CanalHouses {
  state: 'loading' | 'ready' | 'fallback' = 'loading';
  readonly houses = new Map<string, T.Object3D>();
  private disposed = false;
  private district: T.Group;
  constructor(
    district: T.Group,
    batch: (root: T.Object3D) => void,
    cutaway: (root: T.Object3D) => void,
    load: () => Promise<{ scene: T.Group }> = () =>
      new GLTFLoader().loadAsync('/bangkok/models/thonburi-canal-house.glb'),
  ) {
    this.district = district;
    void load().then(({ scene }) => {
      if (this.disposed) { disposeWorldObject(scene); return; }
      const template = scene.getObjectByName('CanalHouse');
      if (!template || canalHouseParts.some(name => !template.getObjectByName(name))) {
        disposeWorldObject(scene);
        this.state = 'fallback';
        return;
      }
      // Batch once before cloning: destructive batching of shared clone geometry is unsafe.
      for (const name of canalHouseParts) batch(template.getObjectByName(name)!);
      const originalPaint = new Set<T.Material>();
      for (const site of canalHouses) {
        const house = template.clone(true);
        house.name = `canal-house-${site.id}`;
        house.userData.animated = true;
        house.position.set(site.x + site.w / 2, 0, site.z + site.d / 2);
        house.scale.set(site.w / 8, 1, site.d / 5);
        const paints = new Map<T.Material, T.Material>();
        house.traverse(object => {
          if (!(object instanceof T.Mesh)) return;
          object.castShadow = object.receiveShadow = true;
          const tint = (material: T.Material) => {
            if (!(material instanceof T.MeshStandardMaterial) || material.name !== 'ShutterPaint') return material;
            if (!paints.has(material)) {
              const paint = material.clone();
              paint.color.set(site.shutters);
              paints.set(material, paint);
              originalPaint.add(material);
            }
            return paints.get(material)!;
          };
          object.material = Array.isArray(object.material) ? object.material.map(tint) : tint(object.material);
        });
        district.add(house);
        this.houses.set(site.id, house);
        for (const name of canalHouseParts.filter(name => name !== 'HouseBase'))
          cutaway(house.getObjectByName(name)!);
      }
      // Geometry and the other materials are shared by the attached clones and owned by the world.
      originalPaint.forEach(material => material.dispose());
      for (const site of canalHouses) {
        const fallback = district.getObjectByName(`thonburi-${site.id}-fallback`);
        if (fallback) fallback.visible = false;
      }
      this.state = 'ready';
    }).catch(() => { if (!this.disposed) this.state = 'fallback'; });
  }
  snapshot() {
    return {
      state: this.state,
      visible: this.district.visible,
      houses: canalHouses.map(site => {
        const house = this.houses.get(site.id);
        return {
          id: site.id, shutters: site.shutters,
          fallback: this.district.getObjectByName(`thonburi-${site.id}-fallback`)?.visible,
          parts: house ? Object.fromEntries(canalHouseParts.map(name => [name, house.getObjectByName(name)!.visible])) : {},
        };
      }),
    };
  }
  dispose() { this.disposed = true; }
}
