import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { addContactShadow, markCollider } from './sceneHelpers';

/**
 * Household Props 001 — a CC0 pack of low-poly GLB props (77 models) dropped in
 * `src/assets/props/household/`. This module is the single integration point
 * that turns those raw GLBs into stage-ready props: it auto-normalizes each
 * model (unknown source scale/orientation) to a target size, grounds it,
 * enables shadows, optionally drops a soft contact shadow, and tags it as a
 * movement collider so Patrick can't walk through the furniture.
 *
 * Only the props actually placed in a stage are imported here — Vite tree-shakes
 * the rest of the pack out of the bundle, so adding a `?url` line is the cost of
 * using a new prop.
 */

// --- Prop GLB urls (add a line here to make a new prop placeable) -----------
import armchairUrl from '../../assets/props/household/Armchair.glb?url';
import bookshelfUrl from '../../assets/props/household/Bookshelf.glb?url';
import chandelierUrl from '../../assets/props/household/Chandelier.glb?url';
import coatRackUrl from '../../assets/props/household/Coat Rack.glb?url';
import computerUrl from '../../assets/props/household/Computer.glb?url';
import couchUrl from '../../assets/props/household/Couch.glb?url';
import flowersUrl from '../../assets/props/household/Flowers.glb?url';
import pottedPlantUrl from '../../assets/props/household/Potted Plant.glb?url';
import tableUrl from '../../assets/props/household/Table.glb?url';

export type HouseholdPropId =
  | 'armchair'
  | 'bookshelf'
  | 'chandelier'
  | 'coatRack'
  | 'computer'
  | 'couch'
  | 'flowers'
  | 'pottedPlant'
  | 'table';

const PROP_URLS: Record<HouseholdPropId, string> = {
  armchair: armchairUrl,
  bookshelf: bookshelfUrl,
  chandelier: chandelierUrl,
  coatRack: coatRackUrl,
  computer: computerUrl,
  couch: couchUrl,
  flowers: flowersUrl,
  pottedPlant: pottedPlantUrl,
  table: tableUrl,
};

// One shared loader + per-url cache. The same prop placed N times only parses
// the GLB once; each placement clones the cached scene.
const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Object3D>>();

function loadPropScene(url: string): Promise<THREE.Object3D> {
  let pending = cache.get(url);
  if (!pending) {
    pending = loader.loadAsync(url).then((gltf) => gltf.scene);
    cache.set(url, pending);
  }
  return pending;
}

export type HouseholdPropOptions = {
  /** World position of the prop's base centre: [x, floorY, z]. */
  position: [number, number, number];
  /** Scale so the model's height equals this (metres). Takes priority. */
  targetHeight?: number;
  /** Scale so the model's largest horizontal dimension equals this (metres). */
  targetSize?: number;
  /** Y rotation in radians. */
  rotationY?: number;
  /**
   * Movement collider. `true` → synthetic circle sized from the footprint;
   * a number → explicit radius; omitted/false → no collision (ceiling props,
   * tiny desk dressing).
   */
  collider?: boolean | number;
  /** Soft grounding blob. `true` → auto radius; number → explicit radius. */
  contactShadow?: boolean | number;
  /** Make the prop glow under bloom (chandelier/lamps). Overrides emissive. */
  glow?: { color: number; intensity: number };
};

/**
 * Load a Household Props GLB, normalize it, and add it to `group`. Loading is
 * async — the prop pops in when ready. Stage colliders are re-collected on
 * backstop timers (see `Stage3DAdventure.rooms.ts`), so a collider tagged here
 * is picked up shortly after the model lands.
 */
export function addHouseholdProp(
  group: THREE.Group,
  id: HouseholdPropId,
  opts: HouseholdPropOptions,
): void {
  const url = PROP_URLS[id];
  void loadPropScene(url)
    .then((template) => {
      const model = template.clone(true);
      model.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      let scale = 1;
      if (opts.targetHeight && size.y > 1e-4) {
        scale = opts.targetHeight / size.y;
      } else if (opts.targetSize) {
        scale = opts.targetSize / (Math.max(size.x, size.z) || 1);
      }

      model.scale.setScalar(scale);
      // Re-centre horizontally and sit the base at the wrapper origin so the
      // wrapper's position is exactly the prop's footprint centre on the floor.
      model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

      model.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (opts.glow) {
          const apply = (mat: THREE.Material) => {
            const std = mat as THREE.MeshStandardMaterial;
            if ('emissive' in std) {
              std.emissive = new THREE.Color(opts.glow!.color);
              std.emissiveIntensity = opts.glow!.intensity;
            }
          };
          if (Array.isArray(mesh.material)) mesh.material.forEach(apply);
          else if (mesh.material) apply(mesh.material);
        }
      });

      const wrapper = new THREE.Group();
      wrapper.name = `prop:${id}`;
      wrapper.position.set(...opts.position);
      if (opts.rotationY) wrapper.rotation.y = opts.rotationY;
      wrapper.add(model);

      const footprint = Math.max(size.x, size.z) * scale;
      if (opts.collider) {
        const radius = typeof opts.collider === 'number' ? opts.collider : footprint * 0.42;
        markCollider(wrapper, radius);
      }

      group.add(wrapper);

      if (opts.contactShadow) {
        const radius = typeof opts.contactShadow === 'number' ? opts.contactShadow : footprint * 0.62;
        addContactShadow(group, opts.position[0], opts.position[2], radius, 0.5);
      }
    })
    .catch((err) => {
      console.warn(`[householdProps] failed to load "${id}" (${url})`, err);
    });
}
