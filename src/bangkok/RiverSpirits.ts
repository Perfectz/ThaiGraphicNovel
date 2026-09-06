import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeWorldObject } from './worldResources.ts';
import type { Battle } from './expeditionCombat.ts';

/** Each encounter keeps its own anatomy; the same Murmur also appears in Lumphini. */
export class RiverSpirits {
  state: 'loading' | 'ready' | 'fallback' = 'loading';
  private disposed = false;
  private parts = new Map<string, T.Object3D>();
  private enemies: Map<string, T.Group>;
  private encounter: Battle['id'] = 'keeper';
  private fallbackMain: T.Object3D;
  private fallbackMurmur: T.Group | null = null;
  private worldHost: T.Group | null = null;
  private worldBody: T.Object3D | null = null;
  constructor(
    enemies: Map<string, T.Group>,
    load: () => Promise<{ scene: T.Group }> = () =>
      new GLTFLoader().loadAsync('/bangkok/models/river-spirits.glb'),
  ) {
    this.enemies = enemies;
    this.fallbackMain = enemies.get('main')!.userData.body;
    void load()
      .then(({ scene }) => {
        if (this.disposed) {
          disposeWorldObject(scene);
          return;
        }
        const names = [
          'RiverKeeper',
          'LanternEcho',
          'MurmurWisp',
          'KeeperLeftArm',
          'KeeperRightArm',
          'KeeperHalo',
          'EchoPetals',
          'MurmurVeils',
          'MurmurOrbit',
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
          ['main', 'MurmurWisp'],
          ['echo', 'LanternEcho'],
        ]) {
          const enemy = enemies.get(key)!,
            model = this.parts.get(name)!;
          scene.attach(model);
          model.userData.animated = true;
          model.traverse((o) => {
            if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
          });
          enemy.add(model);
          if (key === 'echo') {
            (enemy.userData.body as T.Object3D).visible = false;
            enemy.userData.body = model;
            enemy.userData.blenderSpirit = true;
          }
        }
        this.fallbackMain.visible = false;
        if (this.fallbackMurmur) this.fallbackMurmur.visible = false;
        this.state = 'ready';
        this.setEncounter(this.encounter);
        this.attachWorldBody();
      })
      .catch(() => {
        if (!this.disposed) this.state = 'fallback';
      });
  }
  setEncounter(id: Battle['id']) {
    this.encounter = id;
    const main = this.enemies.get('main')!;
    if (this.state === 'ready') {
      const keeper = this.parts.get('RiverKeeper')!,
        murmur = this.parts.get('MurmurWisp')!;
      keeper.visible = id !== 'murmur';
      murmur.visible = id === 'murmur';
      main.userData.body = id === 'murmur' ? murmur : keeper;
      main.userData.blenderSpirit = true;
    } else {
      if (id === 'murmur' && !this.fallbackMurmur) {
        this.fallbackMurmur = this.makeMurmurFallback();
        main.add(this.fallbackMurmur);
      }
      this.fallbackMain.visible = id !== 'murmur';
      if (this.fallbackMurmur) this.fallbackMurmur.visible = id === 'murmur';
      main.userData.body = id === 'murmur' ? this.fallbackMurmur : this.fallbackMain;
    }
  }
  bindWorldMurmur(host: T.Group) {
    this.worldHost = host;
    this.attachWorldBody();
  }
  private attachWorldBody() {
    if (!this.worldHost || this.worldBody || this.state !== 'ready') return;
    const body = this.parts.get('MurmurWisp')!.clone(true);
    body.name = 'LumphiniMurmur';
    body.visible = true;
    body.userData.animated = true;
    body.position.y = -1.9;
    body.rotation.y = Math.PI / 2;
    this.worldHost.children.forEach((o) => (o.visible = false));
    this.worldHost.add(body);
    this.worldBody = body;
  }
  private animateMurmur(model: T.Object3D, time: number, reduced: boolean, attack: number) {
    const veils = model.getObjectByName('MurmurVeils')!,
      orbit = model.getObjectByName('MurmurOrbit')!;
    veils.rotation.x = reduced ? 0 : Math.sin(time * 1.5) * 0.12 + attack * 0.42;
    veils.rotation.z = reduced ? 0 : Math.cos(time * 1.1) * 0.06;
    orbit.rotation.x = reduced ? 0 : time * 0.18;
    orbit.scale.setScalar(reduced ? 1 : 1 + attack * 0.18);
  }
  updateWorld(time: number, reduced: boolean) {
    if (this.worldBody) this.animateMurmur(this.worldBody, time, reduced, 0);
  }
  update(time: number, reduced: boolean, attacking: string | null, pulse: number) {
    if (this.state !== 'ready') return;
    const attack = attacking === 'main' ? pulse : 0;
    const left = this.parts.get('KeeperLeftArm')!,
      right = this.parts.get('KeeperRightArm')!;
    const gesture = reduced ? 0 : Math.sin(time * 1.2) * 0.07;
    left.rotation.x = gesture + (!reduced ? attack * 0.45 : 0);
    right.rotation.x = -gesture - (!reduced ? attack * 0.45 : 0);
    this.parts.get('KeeperHalo')!.rotation.x = reduced ? 0 : Math.sin(time * 0.27) * 0.12;
    this.parts.get('EchoPetals')!.rotation.y = reduced ? 0 : time * 0.12;
    this.parts.get('EchoPetals')!.scale.setScalar(attacking === 'echo' && !reduced ? 1 + pulse * 0.12 : 1);
    this.animateMurmur(this.parts.get('MurmurWisp')!, time, reduced, attack);
  }
  private makeMurmurFallback() {
    const root = new T.Group();
    root.name = 'MurmurFallback';
    root.userData.animated = true;
    const pale = new T.MeshStandardMaterial({
      color: '#96d9c3',
      roughness: 0.4,
      emissive: '#72baa8',
      emissiveIntensity: 0.22,
    });
    const ink = new T.MeshStandardMaterial({ color: '#092c31' }),
      gold = new T.MeshStandardMaterial({ color: '#dac17b', metalness: 0.5, roughness: 0.4 });
    const body = new T.Mesh(new T.SphereGeometry(0.63, 20, 14), pale);
    body.position.y = 1.9;
    body.scale.y = 1.05;
    root.add(body);
    for (const z of [-0.22, 0.22]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.065, 10, 8), ink);
      eye.position.set(-0.565, 2, z);
      root.add(eye);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5,
        fold = new T.Mesh(new T.ConeGeometry(0.16, 0.9, 5), pale);
      fold.position.set(Math.cos(a) * 0.4, 1.12, Math.sin(a) * 0.4);
      fold.rotation.z = 0.25;
      root.add(fold);
    }
    const orbit = new T.Mesh(new T.TorusGeometry(1, 0.015, 6, 64), gold);
    orbit.rotation.y = Math.PI / 2;
    orbit.position.set(0.2, 1.9, 0);
    root.add(orbit);
    return root;
  }
  snapshot(camera?: T.Camera, width = 0, height = 0) {
    const main = this.enemies.get('main')!,
      body = main.userData.body as T.Object3D;
    const mask = body.getObjectByName(this.encounter === 'murmur' ? 'MurmurFace' : 'KeeperMask');
    let face: { left: number; top: number; right: number; bottom: number } | null = null;
    if (camera && mask && main.visible) {
      const bounds = new T.Box3().setFromObject(mask),
        points: T.Vector3[] = [];
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
    const active =
      this.encounter === 'murmur'
        ? ['MurmurVeils', 'MurmurOrbit', 'EchoPetals']
        : ['KeeperLeftArm', 'KeeperRightArm', 'KeeperHalo', 'EchoPetals'];
    return {
      state: this.state,
      encounter: this.encounter,
      face,
      worldMurmur: !!this.worldBody,
      creatures: ['main', 'echo'].map((key) => {
        const enemy = this.enemies.get(key)!;
        let meshes = 0;
        const model = enemy.userData.body as T.Object3D;
        model.traverse((o) => {
          if (o instanceof T.Mesh) meshes++;
        });
        return {
          id: key,
          model: model.name,
          blender: !!enemy.userData.blenderSpirit,
          visible: enemy.visible,
          scale: enemy.scale.x,
          meshes,
          bodyRoll: model.rotation.z,
          bob: model.position.y,
        };
      }),
      parts: [...this.parts.entries()]
        .filter(([name]) => active.includes(name))
        .map(([name, part]) => ({ name, rotation: part.rotation.toArray().slice(0, 3) })),
    };
  }
  // All loaded variants stay attached to the world, which owns their shared resources.
  dispose() {
    this.disposed = true;
  }
}
