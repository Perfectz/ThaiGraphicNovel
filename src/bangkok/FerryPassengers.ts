import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type FerryRider = { id: string; object: T.Object3D; clip?: T.AnimationClip; x: number; z: number };
/** Independent skeletons share the original character geometry; world teardown owns resources. */
export class FerryPassengers {
  readonly root = new T.Group();
  private mixers: T.AnimationMixer[] = [];
  private ready = false;
  constructor(scene: T.Scene) {
    this.root.name = 'Ferry passengers';
    this.root.userData.animated = true;
    this.root.visible = false;
    scene.add(this.root);
  }
  prepare(riders: FerryRider[]) {
    if (this.ready || riders.length !== 3) return;
    for (const rider of riders) {
      const body = clone(rider.object);
      body.name = rider.id;
      body.visible = true;
      body.position.set(0, 0, 0);
      body.rotation.set(0, Math.PI / 2, 0);
      body.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(body),
        center = bounds.getCenter(new T.Vector3());
      body.position.set(rider.x - center.x, 0.15 - bounds.min.y, rider.z - center.z);
      this.root.add(body);
      if (rider.clip) {
        const mixer = new T.AnimationMixer(body),
          clip = rider.clip.clone();
        clip.tracks = clip.tracks.filter((track) => !track.name.endsWith('.position'));
        mixer.clipAction(clip).play();
        mixer.setTime(0.1);
        this.mixers.push(mixer);
      }
    }
    this.ready = true;
  }
  update(pose: { x: number; y: number; z: number; yaw: number } | null, dt: number, reduced: boolean) {
    this.root.visible = !!pose;
    if (!pose) return;
    this.root.position.set(pose.x, pose.y, pose.z);
    this.root.rotation.y = pose.yaw;
    if (!reduced) this.mixers.forEach((m) => m.update(dt));
  }
  snapshot(camera: T.Camera, width: number, height: number) {
    return {
      visible: this.root.visible,
      ready: this.ready,
      riders: this.root.children.map((body) => {
        const p = new T.Box3().setFromObject(body).getCenter(new T.Vector3()).project(camera);
        return { id: body.name, x: ((p.x + 1) * width) / 2, y: ((1 - p.y) * height) / 2 };
      }),
    };
  }
  dispose() {
    this.mixers.forEach((m) => {
      m.stopAllAction();
      m.uncacheRoot(m.getRoot());
    });
  }
}
