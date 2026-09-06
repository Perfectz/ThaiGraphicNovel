import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeWorldObject } from './worldResources.ts';

/** Blender architecture is cosmetic; the combat model never depends on its download. */
export class RiverArena {
  state: 'loading' | 'ready' | 'fallback' = 'loading';
  private disposed = false;
  private model: T.Group | null = null;
  private fallback: T.Group;
  constructor(
    root: T.Group,
    fallback: T.Group,
    load: () => Promise<{ scene: T.Group }> = () =>
      new GLTFLoader().loadAsync('/bangkok/models/river-arena.glb'),
  ) {
    this.fallback = fallback;
    void load()
      .then(({ scene }) => {
        if (this.disposed) {
          disposeWorldObject(scene);
          return;
        }
        if (
          ['StonePlatform', 'LanternGallery', 'RiverBalustrade'].some((name) => !scene.getObjectByName(name))
        ) {
          disposeWorldObject(scene);
          this.state = 'fallback';
          return;
        }
        scene.userData.animated = true;
        scene.traverse((o) => {
          if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
        });
        root.add(scene);
        this.model = scene;
        fallback.visible = false;
        this.state = 'ready';
      })
      .catch(() => {
        if (!this.disposed) this.state = 'fallback';
      });
  }
  snapshot() {
    let meshes = 0;
    this.model?.traverse((o) => {
      if (o instanceof T.Mesh) meshes++;
    });
    return { state: this.state, fallback: this.fallback.visible, meshes };
  }
  // Attached geometry is released by world teardown; late responses dispose themselves.
  dispose() {
    this.disposed = true;
  }
}
