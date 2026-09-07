import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeWorldObject } from './worldResources.ts';

export const mooredBoatOrigin = { x: -1, y: -0.6, z: -13 };
export function riverBoatPose(time: number, moored: boolean, reduced = false) {
  const t = reduced ? 0 : time;
  return moored
    ? {
        ...mooredBoatOrigin,
        y: mooredBoatOrigin.y + Math.sin(t * 0.8) * 0.018,
        roll: Math.sin(t * 0.65) * 0.008,
      }
    : {
        x: ((t * 0.65 + 58) % 140) - 70,
        y: -0.6 + Math.sin(t) * 0.025,
        z: -20,
        roll: Math.sin(t * 0.7) * 0.012,
      };
}

/** One shared Blender asset for the moored passenger boat and distant river traffic. */
export class RiverBoats {
  state: 'loading' | 'ready' | 'fallback' = 'loading';
  private root = new T.Group();
  private boats = [new T.Group(), new T.Group()];
  private fallbacks: T.Object3D[] = [];
  private disposed = false;
  private passage: { x: number; y: number; z: number; yaw: number } | null = null;
  private dock: { x: number; y: number; z: number; yaw: number } | null = null;
  setDock(pose: { x: number; y: number; z: number; yaw: number } | null) { this.dock=pose; }
  setPassage(pose: { x: number; y: number; z: number; yaw: number } | null) {
    this.passage = pose;
  }
  constructor(scene: T.Scene, batch: (root: T.Object3D) => void) {
    this.root.name = 'Chao Phraya long-tail boats';
    this.root.userData.animated = true;
    scene.add(this.root);
    const fallback = new T.Group();
    for (const [size, pos, color] of [
      [[6.5, 0.34, 1.3], [0, -0.02, 0], '#315b64'],
      [[3.8, 0.07, 1.5], [-0.2, 1.85, 0], '#d3bd84'],
      [[0.06, 1.4, 0.06], [-1.8, 1.1, -0.62], '#88794e'],
      [[0.06, 1.4, 0.06], [1.4, 1.1, 0.62], '#88794e'],
    ] as [number[], number[], string][]) {
      const m = new T.Mesh(
        new T.BoxGeometry(...(size as [number, number, number])),
        new T.MeshStandardMaterial({ color, roughness: 0.8 }),
      );
      m.position.set(...(pos as [number, number, number]));
      fallback.add(m);
    }
    this.boats.forEach((boat, i) => {
      boat.name = i ? 'Passing longtail' : 'Moored longtail';
      this.root.add(boat);
      const f = i ? fallback.clone(true) : fallback;
      boat.add(f);
      this.fallbacks.push(f);
    });
    this.update(0, false);
    void new GLTFLoader()
      .loadAsync('/bangkok/models/river-longtail.glb')
      .then(({ scene: model }) => {
        if (this.disposed) {
          disposeWorldObject(model);
          return;
        }
        if (
          ['Hull', 'PassengerCabin', 'LongtailEngine', 'Canopy'].some((name) => !model.getObjectByName(name))
        ) {
          disposeWorldObject(model);
          this.state = 'fallback';
          return;
        }
        model.traverse((o) => {
          if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
        });
        // Batch before cloning: both boats share geometry and material ownership.
        for (const name of ['Hull', 'PassengerCabin', 'LongtailEngine', 'Canopy'])
          batch(model.getObjectByName(name)!);
        this.boats[0].add(model);
        this.boats[1].add(model.clone(true));
        this.fallbacks.forEach((f) => (f.visible = false));
        this.state = 'ready';
      })
      .catch(() => {
        if (!this.disposed) this.state = 'fallback';
      });
  }
  update(time: number, reduced: boolean) {
    this.boats.forEach((boat, i) => {
      const p = riverBoatPose(time, i === 0, reduced);
      boat.position.set(p.x, p.y, p.z);
      boat.rotation.x = p.roll;
      boat.rotation.y = 0;
      if(i===0&&this.dock){boat.position.set(this.dock.x,p.y,this.dock.z);boat.rotation.y=this.dock.yaw;}
      const canopy = boat.getObjectByName('Canopy');
      if (canopy) canopy.visible = !(i === 0 && this.passage);
      this.fallbacks[i].children[1].visible = !(i === 0 && this.passage);
      if (i === 0 && this.passage) {
        boat.position.set(this.passage.x, this.passage.y, this.passage.z);
        boat.rotation.set(0, this.passage.yaw, 0);
      }
    });
  }
  snapshot(camera: T.Camera, width: number, height: number) {
    return {
      state: this.state,
      boats: this.boats.map((boat, i) => {
        const bounds = new T.Box3().setFromObject(boat),
          pixels: T.Vector3[] = [];
        for (const x of [bounds.min.x, bounds.max.x])
          for (const y of [bounds.min.y, bounds.max.y])
            for (const z of [bounds.min.z, bounds.max.z]) {
              const p = new T.Vector3(x, y, z).project(camera);
              pixels.push(new T.Vector3(((p.x + 1) * width) / 2, ((1 - p.y) * height) / 2, p.z));
            }
        return {
          name: boat.name,
          canopyVisible: boat.getObjectByName('Canopy')?.visible ?? this.fallbacks[i].children[1].visible,
          fallback: this.fallbacks[i].visible,
          x: boat.position.x,
          y: boat.position.y,
          z: boat.position.z,
          roll: boat.rotation.x,
          screen: {
            left: Math.min(...pixels.map((p) => p.x)),
            right: Math.max(...pixels.map((p) => p.x)),
            top: Math.min(...pixels.map((p) => p.y)),
            bottom: Math.max(...pixels.map((p) => p.y)),
          },
        };
      }),
    };
  }
  // Attached resources are released once by world teardown; late downloads release themselves.
  dispose() {
    this.disposed = true;
  }
}
