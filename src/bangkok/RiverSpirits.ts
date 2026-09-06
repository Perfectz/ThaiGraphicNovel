import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeWorldObject } from './worldResources.ts';

/** The rendered creatures inherit combat's existing positions and timing. */
export class RiverSpirits {
  state: 'loading' | 'ready' | 'fallback' = 'loading';
  private disposed = false;
  private parts = new Map<string, T.Object3D>();
  private enemies: Map<string, T.Group>;
  constructor(
    enemies: Map<string, T.Group>,
    load: () => Promise<{ scene: T.Group }> = () =>
      new GLTFLoader().loadAsync('/bangkok/models/river-spirits.glb'),
  ) {
    this.enemies = enemies;
    void load()
      .then(({ scene }) => {
        if (this.disposed) {
          disposeWorldObject(scene);
          return;
        }
        const names = [
          'RiverKeeper',
          'LanternEcho',
          'KeeperLeftArm',
          'KeeperRightArm',
          'KeeperHalo',
          'EchoPetals',
        ];
        if (
          names.some((name) => !scene.getObjectByName(name)) ||
          !enemies.has('main') ||
          !enemies.has('echo')
        ) {
          disposeWorldObject(scene);
          this.state = 'fallback';
          return;
        }
        for (const name of names) this.parts.set(name, scene.getObjectByName(name)!);
        scene.updateMatrixWorld(true);
        for (const [key, name] of [
          ['main', 'RiverKeeper'],
          ['echo', 'LanternEcho'],
        ]) {
          const enemy = enemies.get(key)!,
            model = this.parts.get(name)!;
          // Preserve the authored Y-up transform if the exporter inserts a parent.
          scene.attach(model);
          model.userData.animated = true;
          model.traverse((o) => {
            if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
          });
          const fallback = enemy.userData.body as T.Group;
          fallback.visible = false;
          enemy.add(model);
          enemy.userData.body = model;
          enemy.userData.blenderSpirit = true;
        }
        this.state = 'ready';
      })
      .catch(() => {
        if (!this.disposed) this.state = 'fallback';
      });
  }
  update(time: number, reduced: boolean, attacking: string | null, pulse: number) {
    if (this.state !== 'ready') return;
    const left = this.parts.get('KeeperLeftArm')!,
      right = this.parts.get('KeeperRightArm')!;
    const gesture = reduced ? 0 : Math.sin(time * 1.2) * 0.07;
    left.rotation.x = gesture + (attacking === 'main' && !reduced ? pulse * 0.45 : 0);
    right.rotation.x = -gesture - (attacking === 'main' && !reduced ? pulse * 0.45 : 0);
    this.parts.get('KeeperHalo')!.rotation.x = reduced ? 0 : Math.sin(time * 0.27) * 0.12;
    this.parts.get('EchoPetals')!.rotation.y = reduced ? 0 : time * 0.12;
    this.parts.get('EchoPetals')!.scale.setScalar(attacking === 'echo' && !reduced ? 1 + pulse * 0.12 : 1);
  }
  snapshot(camera?: T.Camera, width = 0, height = 0) {
    const main = this.enemies.get('main')!;
    const mask = (main.userData.body as T.Object3D).getObjectByName('KeeperMask');
    let face: { left: number; top: number; right: number; bottom: number } | null = null;
    if (camera && mask && main.visible) {
      const bounds = new T.Box3().setFromObject(mask);
      const points: T.Vector3[] = [];
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) points.push(new T.Vector3(x, y, z).project(camera));
      face = {
        left: Math.min(...points.map((p) => ((p.x + 1) * width) / 2)),
        right: Math.max(...points.map((p) => ((p.x + 1) * width) / 2)),
        top: Math.min(...points.map((p) => ((1 - p.y) * height) / 2)),
        bottom: Math.max(...points.map((p) => ((1 - p.y) * height) / 2)),
      };
    }
    return {
      state: this.state,
      face,
      creatures: ['main', 'echo'].map((key) => {
        const enemy = this.enemies.get(key)!;
        let meshes = 0;
        (enemy.userData.body as T.Object3D).traverse((o) => {
          if (o instanceof T.Mesh) meshes++;
        });
        return {
          id: key,
          blender: !!enemy.userData.blenderSpirit,
          visible: enemy.visible,
          scale: enemy.scale.x,
          meshes,
          bodyRoll: (enemy.userData.body as T.Object3D).rotation.z,
          bob: (enemy.userData.body as T.Object3D).position.y,
        };
      }),
      parts: [...this.parts.entries()]
        .filter(([name]) => !['RiverKeeper', 'LanternEcho'].includes(name))
        .map(([name, part]) => ({ name, rotation: part.rotation.toArray().slice(0, 3) })),
    };
  }
  // The world owns attached resources; a late download disposes itself.
  dispose() {
    this.disposed = true;
  }
}
