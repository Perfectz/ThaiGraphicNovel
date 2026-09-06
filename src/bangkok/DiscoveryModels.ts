import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { discoveries, type DiscoveryId } from './discoveries.ts';
import { buildDiscoveryObject } from './DiscoveryObjects';
import { disposeWorldObject } from './worldResources.ts';

/** One optional asset pack; discovery interactions remain available during load failure. */
export class DiscoveryModels {
  private sites = new Map<DiscoveryId, { parent: T.Group; fallback: T.Group; model?: T.Object3D }>();
  private disposed = false;
  state: 'loading' | 'ready' | 'fallback' = 'loading';

  add(site: (typeof discoveries)[number], parent: T.Group, batch: (root: T.Object3D) => void) {
    const fallback = new T.Group();
    parent.add(fallback);
    buildDiscoveryObject(site, fallback);
    batch(fallback);
    this.sites.set(site.id, { parent, fallback });
  }

  async load(batch: (root: T.Object3D) => void) {
    try {
      const { scene } = await new GLTFLoader().loadAsync('/bangkok/models/city-memories.glb');
      if (this.disposed) {
        disposeWorldObject(scene);
        return;
      }
      const models = discoveries.map((site) => scene.getObjectByName(site.id));
      if (models.some((model) => !model)) {
        disposeWorldObject(scene);
        this.state = 'fallback';
        return;
      }
      discoveries.forEach((site, i) => {
        const slot = this.sites.get(site.id)!;
        const model = models[i]!;
        slot.parent.add(model);
        slot.model = model;
        model.traverse((object) => {
          if (object instanceof T.Mesh) object.castShadow = object.receiveShadow = true;
        });
        batch(model);
        slot.fallback.visible = false;
      });
      this.state = 'ready';
    } catch {
      if (!this.disposed) this.state = 'fallback';
    }
  }

  frame(id: DiscoveryId, camera: T.Camera, width: number, height: number) {
    const slot = this.sites.get(id);
    if (!slot) return null;
    const bounds = new T.Box3().setFromObject(slot.model ?? slot.fallback);
    const points: T.Vector3[] = [];
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) points.push(new T.Vector3(x, y, z).project(camera));
    return {
      left: Math.min(...points.map((p) => ((p.x + 1) * width) / 2)),
      right: Math.max(...points.map((p) => ((p.x + 1) * width) / 2)),
      top: Math.min(...points.map((p) => ((1 - p.y) * height) / 2)),
      bottom: Math.max(...points.map((p) => ((1 - p.y) * height) / 2)),
    };
  }

  dispose() {
    // Loaded resources belong to the world scene. Late loads are released above.
    this.disposed = true;
  }
}
