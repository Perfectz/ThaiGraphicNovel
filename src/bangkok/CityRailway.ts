import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeWorldObject } from './worldResources.ts';

/** One original Blender pack replaces both parts only after the whole railway is valid. */
export class CityRailway {
  state: 'loading' | 'ready' | 'fallback' = 'loading';
  private disposed = false;
  private trainModel?: T.Object3D;
  private district: T.Group;
  private guideFallback: T.Group;
  private train: T.Group;
  private trainFallback: T.Group;
  constructor(
    district: T.Group,
    guideFallback: T.Group,
    train: T.Group,
    trainFallback: T.Group,
    batch: (root: T.Object3D) => void,
    load: () => Promise<{ scene: T.Group }> = () =>
      new GLTFLoader().loadAsync('/bangkok/models/sukhumvit-railway.glb'),
  ) {
    this.district = district;
    this.guideFallback = guideFallback;
    this.train = train;
    this.trainFallback = trainFallback;
    void load()
      .then(({ scene }) => {
        if (this.disposed) {
          disposeWorldObject(scene);
          return;
        }
        const guide = scene.getObjectByName('Guideway'),
          body = scene.getObjectByName('Skytrain');
        if (
          !guide ||
          !body ||
          ['CarBodies', 'CabGlazing', 'BogieFrames'].some((name) => !body.getObjectByName(name))
        ) {
          disposeWorldObject(scene);
          this.state = 'fallback';
          return;
        }
        scene.updateMatrixWorld(true);
        for (const part of [guide, body]) {
          scene.attach(part);
          part.userData.animated = true;
          part.traverse((o) => {
            if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
          });
          batch(part);
        }
        guide.position.set(-46, 0, 9.3);
        this.district.add(guide);
        this.train.add(body);
        this.trainModel = body;
        this.guideFallback.visible = this.trainFallback.visible = false;
        this.state = 'ready';
      })
      .catch(() => {
        if (!this.disposed) this.state = 'fallback';
      });
  }
  snapshot() {
    let meshes = 0;
    this.trainModel?.traverse((o) => {
      if (o instanceof T.Mesh) meshes++;
    });
    return {
      state: this.state,
      visible: this.district.visible,
      trainX: this.train.position.x,
      trainY: this.train.position.y,
      trainZ: this.train.position.z,
      meshes,
      guideFallback: this.guideFallback.visible,
      trainFallback: this.trainFallback.visible,
    };
  }
  dispose() {
    this.disposed = true;
  }
}
