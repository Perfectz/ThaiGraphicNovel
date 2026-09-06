import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { walkable, type Point } from './adventure';
import { ResidentPose } from './ResidentPose';

/** Guests share mesh resources with residents but own their skeletons and resting poses. */
export class ReunionGathering {
  readonly root = new T.Group();
  private guests: { body: T.Object3D; pose: ResidentPose; mark: Point }[] = [];
  private placed = false;
  constructor(scene: T.Scene) {
    this.root.name = 'A Promise Kept guests';
    this.root.userData.animated = true;
    this.root.visible = false;
    scene.add(this.root);
  }
  update(
    active: boolean,
    host: Point | null,
    occupied: Point[],
    sources: { id: string; object: T.Object3D }[],
    time: number,
    reduced: boolean,
    cameraDirection: Point,
  ) {
    this.root.visible = active && !!host && sources.length === 3;
    if (!this.root.visible || !host) {
      this.placed = false;
      return;
    }
    if (!this.guests.length)
      for (const source of sources) {
        const body = clone(source.object);
        body.name = source.id;
        body.visible = true;
        body.position.set(0, 0, 0);
        this.root.add(body);
        this.guests.push({ body, pose: new ResidentPose(body), mark: { x: 0, z: 0 } });
      }
    if (!this.placed) {
      const marks = [host, ...occupied];
      const candidates: Point[] = [];
      for (let x = -8; x <= 8; x++)
        for (let z = -8; z <= 8; z++) {
          const p = { x: host.x + x * 0.5, z: host.z + z * 0.5 };
          const distance = Math.hypot(p.x - host.x, p.z - host.z);
          if (
            distance > 1.7 &&
            distance < 4 &&
            [
              [0, 0],
              [0.3, 0],
              [-0.3, 0],
              [0, 0.3],
              [0, -0.3],
            ].every(([dx, dz]) => walkable({ x: p.x + dx, z: p.z + dz }))
          )
            candidates.push(p);
        }
      for (const guest of this.guests) {
        const score = (p: Point) =>
          Math.min(...marks.map((m) => Math.hypot(p.x - m.x, p.z - m.z))) +
          Math.min(
            ...marks.map((m) =>
              Math.abs(
                ((p.x - m.x) * cameraDirection.z - (p.z - m.z) * cameraDirection.x) /
                  Math.hypot(cameraDirection.x, cameraDirection.z),
              ),
            ),
          ) *
            0.8 -
          Math.hypot(p.x - host.x, p.z - host.z) * 0.3;
        candidates.sort((a, b) => score(b) - score(a));
        guest.mark = candidates.shift() ?? host;
        marks.push(guest.mark);
        guest.body.rotation.y = Math.atan2(host.x - guest.mark.x, host.z - guest.mark.z);
        guest.body.position.set(0, 0, 0);
        guest.body.updateMatrixWorld(true);
        const box = new T.Box3().setFromObject(guest.body),
          center = box.getCenter(new T.Vector3());
        guest.body.position.set(guest.mark.x - center.x, 0.09 - box.min.y, guest.mark.z - center.z);
      }
      this.placed = true;
    }
    this.guests.forEach((g, i) => g.pose.update(time + i * 2, true, reduced));
  }
  snapshot(camera: T.Camera, width: number, height: number) {
    return {
      visible: this.root.visible,
      guests: this.guests.map((g) => {
        const p = new T.Box3().setFromObject(g.body).getCenter(new T.Vector3()).project(camera);
        return {
          id: g.body.name,
          ...g.mark,
          screenX: ((p.x + 1) * width) / 2,
          screenY: ((1 - p.y) * height) / 2,
        };
      }),
    };
  }
}
