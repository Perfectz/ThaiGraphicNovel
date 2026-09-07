import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { boatPoint, boatStart, boatCursor, gardenStops, type CanalBoatSave } from './canalNavigation.ts';
import { disposeWorldObject } from './worldResources.ts';

/** The saved navigation course is rendered in the existing canal, with persistent planted quays. */
export class CanalGardenWorld {
  readonly root = new T.Group();
  readonly boat = new T.Group();
  readonly tender = new T.Group();
  state: 'loading' | 'ready' | 'fallback' = 'loading';
  private fallback = new T.Group();
  private cargo: T.Group[] = [];
  private gardens = new Map<string, T.Group>();
  private target = new T.Vector3();
  private heading = 0;
  private cursor = '';
  private moving = false;
  private disposed = false;
  private mats = new Map<string, T.MeshStandardMaterial>();
  constructor(district: T.Group, batch: (root: T.Object3D) => void, load: () => Promise<{ scene: T.Group }> = () => new GLTFLoader().loadAsync('/bangkok/models/canal-garden-boat.glb')) {
    this.root.name = 'Canal garden delivery';
    this.root.userData.animated = true;
    district.add(this.root);
    this.root.add(this.boat);
    this.boat.add(this.fallback, this.tender);
    this.box(this.fallback, [2.5, 0.3, 0.72], [0, 0.02, 0], '#315a48');
    this.box(this.fallback, [1.9, 0.035, 0.62], [0, 0.2, 0], '#aa8553');
    this.tender.position.set(-0.8, 0.05, 0);
    this.tender.rotation.y = Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const tray = new T.Group();
      tray.position.set(-0.05 + i * 0.46, 0.15, 0);
      this.boat.add(tray);
      this.cargo.push(tray);
    }
    for (const stop of gardenStops) {
      const p = stop.planter;
      this.box(this.root, [1.55, 0.27, 0.85], [p.x, 0.22, p.z], '#76563b');
      this.box(this.root, [1.4, 0.035, 0.72], [p.x, 0.365, p.z], '#3f3829');
      const flowers = new T.Group();
      flowers.position.set(p.x, 0.35, p.z);
      flowers.scale.setScalar(1.9);
      this.root.add(flowers);
      this.gardens.set(stop.id, flowers);
      const point = boatPoint(stop),
        z = stop.row ? -65.9 : -59.1;
      this.box(this.root, [0.075, 1.0, 0.075], [point.x, 0.15, z], '#b39867');
      this.box(this.root, [0.48, 0.27, 0.035], [point.x + 0.23, 0.53, z], stop.color);
    }
    // A floating nursery is the visible obstacle, shared with the course's blocked cell.
    const obstacle = boatPoint({ col: 2, row: 0 });
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4,
        r = i ? 0.65 : 0;
      const ring = new T.Mesh(new T.TorusGeometry(0.36, 0.035, 5, 16), this.mat('#816f40'));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(obstacle.x + Math.cos(a) * r, -0.42, obstacle.z + Math.sin(a) * r);
      this.root.add(ring);
      const leaf = new T.Mesh(new T.CircleGeometry(0.31, 12), this.mat('#507c44'));
      leaf.rotation.x = -Math.PI / 2;
      leaf.position.copy(ring.position);
      leaf.position.y += 0.01;
      this.root.add(leaf);
    }
    for (let c = 0; c <= 4; c++)
      for (let r = 0; r < 2; r++) {
        if (c === 2 && r === 0) continue;
        const p = boatPoint({ col: c, row: r });
        const marker = new T.Mesh(new T.TorusGeometry(0.14, 0.022, 5, 12), this.mat('#e1bf76'));
        marker.rotation.x = Math.PI / 2;
        marker.position.set(p.x, -0.38, p.z);
        this.root.add(marker);
      }
    for (const group of [...this.cargo, ...this.gardens.values()]) {
      const fallback = new T.Group();
      fallback.name = 'flowers-fallback';
      group.add(fallback);
      this.box(fallback, [0.62, 0.12, 0.42], [0, 0.06, 0], '#95733c');
      for (const x of [-0.19, 0, 0.19]) {
        this.box(fallback, [0.025, 0.26, 0.025], [x, 0.23, 0], '#65934c');
        const flower = new T.Mesh(new T.SphereGeometry(0.09, 8, 5), this.mat('#eab334'));
        flower.position.set(x, 0.39, 0);
        fallback.add(flower);
      }
    }
    this.sync(undefined, true);
    void load()
      .then(({ scene }) => {
        if (this.disposed) {
          disposeWorldObject(scene);
          return;
        }
        const body = scene.getObjectByName('GardenBoat'),
          tray = scene.getObjectByName('FlowerTray');
        if (!body || !tray) {
          disposeWorldObject(scene);
          this.state = 'fallback';
          return;
        }
        scene.updateMatrixWorld(true);
        scene.attach(body);
        scene.attach(tray);
        for (const part of [body, tray]) {
          batch(part);
          part.traverse((o) => {
            if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
          });
        }
        body.scale.setScalar(0.78);
        this.boat.add(body);
        this.fallback.visible = false;
        for (const group of [...this.cargo, ...this.gardens.values()]) {
          group.add(tray.clone(true));
          group.getObjectByName('flowers-fallback')!.visible = false;
        }
        this.state = 'ready';
      })
      .catch(() => {
        if (!this.disposed) this.state = 'fallback';
      });
  }
  private mat(color: string) {
    if (!this.mats.has(color)) this.mats.set(color, new T.MeshStandardMaterial({ color, roughness: 0.8 }));
    return this.mats.get(color)!;
  }
  private box(root: T.Group, size: [number, number, number], p: [number, number, number], color: string) {
    const m = new T.Mesh(new T.BoxGeometry(...size), this.mat(color));
    m.position.set(...p);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
  }
  sync(save?: CanalBoatSave, snap = false) {
    const b = save ?? boatStart(),
      cursor = boatCursor(b),
      p = boatPoint(b);
    if (cursor !== this.cursor) {
      this.target.set(p.x, -0.32, p.z);
      this.heading = (-b.heading * Math.PI) / 2;
      this.cursor = cursor;
    }
    if (snap) {
      this.boat.position.copy(this.target);
      this.boat.rotation.y = this.heading;
    }
    this.cargo.forEach((g, i) => {
      g.visible = i >= b.delivered.length;
    });
    this.gardens.forEach((g, id) => {
      g.visible = b.delivered.includes(id as (typeof gardenStops)[number]['id']);
    });
  }
  update(dt: number, time: number, reduced: boolean) {
    const delta = this.target.clone().sub(this.boat.position);
    delta.y = 0;
    this.moving = delta.length() > 0.02;
    if (reduced || delta.length() < 0.02) this.boat.position.copy(this.target);
    else this.boat.position.add(delta.multiplyScalar(Math.min(1, dt * 5)));
    const turn = Math.atan2(
      Math.sin(this.heading - this.boat.rotation.y),
      Math.cos(this.heading - this.boat.rotation.y),
    );
    this.boat.rotation.y += turn * (reduced ? 1 : Math.min(1, dt * 7));
    this.boat.position.y = this.target.y + (reduced ? 0 : Math.sin(time * 1.2) * 0.015);
  }
  snapshot() {
    return {
      state: this.state,
      x: this.boat.position.x,
      z: this.boat.position.z,
      heading: this.boat.rotation.y,
      moving: this.moving,
      cargo: this.cargo.filter((g) => g.visible).length,
      planted: [...this.gardens].filter(([, g]) => g.visible).map(([id]) => id),
    };
  }
  dispose() {
    this.disposed = true;
  }
}
