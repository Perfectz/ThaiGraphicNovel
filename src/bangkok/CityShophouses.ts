import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type ShopStyle = 'modern' | 'market';
type ShopPlacement = { x: number; z: number; w: number; d: number; height: number; facing: number };
type Shop = { style: ShopStyle; state: 'loading' | 'ready' | 'fallback'; parent: T.Group; fallback: T.Group };

/** Shared Blender meshes, with a fixed-height ground floor and scalable upper storeys. */
export function placeShophouse(template: T.Group, site: ShopPlacement) {
  const root = template.clone(true);
  root.position.set(site.x + site.w / 2, 0, site.z + site.d / 2);
  root.rotation.y = site.facing > 0 ? 0 : Math.PI;
  root.scale.set(site.w / 5, 1, site.d / 3);
  const upper = root.getObjectByName('ShopUpper');
  if (!upper || !root.getObjectByName('ShopLower')) throw new Error('Missing shophouse structural parts');
  upper.position.y = 2.6;
  upper.scale.y = (site.height - 2.6) / 4.4;
  root.userData.animated = true; // Shared mesh geometry must stay out of destructive static merging.
  root.traverse((o) => {
    if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
  });
  return root;
}

export class CityShophouses {
  private cache = new Map<ShopStyle, Promise<T.Group>>();
  private shops: Shop[] = [];
  private disposed = false;
  add(parent: T.Group, fallback: T.Group, style: ShopStyle, site: ShopPlacement, refreshBounds: () => void) {
    const entry: Shop = { style, parent, fallback, state: 'loading' };
    this.shops.push(entry);
    if (!this.cache.has(style)) {
      const name = style === 'modern' ? 'sukhumvit-shophouse' : 'yaowarat-shophouse';
      this.cache.set(
        style,
        new GLTFLoader()
          .loadAsync(`${import.meta.env.BASE_URL}bangkok/models/${name}.glb`)
          .then(({ scene }) => {
            if (this.disposed) this.release(scene);
            return scene;
          }),
      );
    }
    void this.cache
      .get(style)!
      .then((template) => {
        if (this.disposed) return;
        const model = placeShophouse(template, site);
        parent.add(model);
        fallback.visible = false;
        refreshBounds();
        entry.state = 'ready';
      })
      .catch(() => {
        if (!this.disposed) entry.state = 'fallback';
      });
  }
  snapshot() {
    return this.shops.map(({ style, state, parent, fallback }) => ({
      style,
      state,
      visible: parent.visible,
      fallback: fallback.visible,
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
  // Attached instances share template resources and are released by the world's scene traversal.
  dispose() {
    this.disposed = true;
  }
}
