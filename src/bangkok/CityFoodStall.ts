import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeWorldObject } from './worldResources.ts';
import { foodStallOrigin } from './city.ts';

/** Original Blender cart, with independent equipment and canopy camera cutaways. */
export class CityFoodStall {
  state: 'loading' | 'ready' | 'fallback' = 'loading';
  private root?: T.Group;
  private parts: T.Object3D[] = [];
  private disposed = false;
  constructor(
    private district: T.Group,
    private fallback: T.Group,
    batch: (root: T.Object3D) => void,
    cutaway: (root: T.Object3D) => void,
    attachSign: (canopy: T.Object3D) => void,
  ) {
    void new GLTFLoader()
      .loadAsync('/bangkok/models/lek-food-stall.glb')
      .then(({ scene }) => {
        if (this.disposed) {
          disposeWorldObject(scene);
          return;
        }
        const parts = ['Counter', 'Equipment', 'Canopy'].map((name) => scene.getObjectByName(name));
        if (parts.some((p) => !p)) {
          disposeWorldObject(scene);
          this.state = 'fallback';
          return;
        }
        scene.position.set(foodStallOrigin.x, 0, foodStallOrigin.z);
        scene.userData.animated = true;
        scene.traverse((o) => {
          if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
        });
        district.add(scene);
        this.root = scene;
        this.parts = parts as T.Object3D[];
        for (const part of this.parts) {
          if (part.name !== 'Counter') cutaway(part);
          batch(part);
        }
        attachSign(this.parts[2]);
        fallback.visible = false;
        this.state = 'ready';
      })
      .catch(() => {
        if (!this.disposed) this.state = 'fallback';
      });
  }
  get cookingVisible() {
    return (
      this.district.visible &&
      (this.state !== 'ready' || !!this.parts.find((p) => p.name === 'Equipment')?.visible)
    );
  }
  snapshot() {
    return {
      state: this.state,
      visible: this.district.visible,
      fallback: this.fallback.visible,
      parts: this.parts.map((p) => ({ name: p.name, visible: p.visible })),
      loaded: !!this.root,
      cookingVisible: this.cookingVisible,
    };
  }
  // World teardown owns attached geometry, materials and textures. Late loads release themselves.
  dispose() {
    this.disposed = true;
  }
}
