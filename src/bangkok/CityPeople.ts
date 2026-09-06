import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import mali from '../assets/debug/hotel-lobby-girl-rig/Meshy_AI_Goldleaf_Ensemble_biped/Meshy_AI_Goldleaf_Ensemble_biped_Animation_Walking_withSkin.glb?url';
import dao from '../assets/debug/bellboy-rig/Meshy_AI_Azure_Vanguard_biped/Meshy_AI_Azure_Vanguard_biped_Animation_Walking_withSkin.glb?url';
import lek from '../assets/debug/stage-3-character-rig/Meshy_AI_Bandana_Clad_Adventur_biped/Meshy_AI_Bandana_Clad_Adventur_biped_Animation_Walking_withSkin.glb?url';
import type { ActorId, Point } from './adventure';
import { ResidentPose } from './ResidentPose';

const sources: Partial<Record<ActorId, string>> = {
  innkeeper: mali,
  gardener: mali,
  station: dao,
  artisan: dao,
  cook: lek,
  ferry: lek,
  traveler: dao,
};
type Person = {
  id: ActorId;
  group: T.Group;
  body: T.Object3D;
  pose: ResidentPose;
  phase: number;
  walking?: T.AnimationMixer;
  pack?: T.Group;
  ambient: boolean;
};

/** Shared meshes/textures, independent skeletons; distant NPCs do not animate. */
export class CityPeople {
  private sources = new Map<string, Promise<GLTF>>();
  private people: Person[] = [];
  private disposed = false;
  private shadow: T.CanvasTexture | null = null;
  async load(
    id: ActorId,
    group: T.Group,
    fallback: T.Group,
    options: { ambient?: boolean; height?: number } = {},
  ) {
    const url = sources[id];
    if (!url) return;
    if (!this.sources.has(url)) this.sources.set(url, new GLTFLoader().loadAsync(url));
    try {
      const source = await this.sources.get(url)!;
      if (this.disposed) return;
      const body = clone(source.scene);
      const pose = new ResidentPose(body, source.animations[0]);
      body.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(body);
      const size = bounds.getSize(new T.Vector3());
      if (!Number.isFinite(size.y) || size.y < 0.01) throw new Error('Invalid character bounds');
      body.scale.setScalar((options.height ?? (id === 'gardener' ? 1.65 : 1.8)) / size.y);
      body.updateMatrixWorld(true);
      const scaled = new T.Box3().setFromObject(body);
      const center = scaled.getCenter(new T.Vector3());
      body.position.set(-center.x, -scaled.min.y, -center.z);
      body.traverse((obj) => {
        if (obj instanceof T.Mesh) obj.castShadow = obj.receiveShadow = true;
      });
      group.add(body);
      let walking: T.AnimationMixer | undefined, pack: T.Group | undefined;
      if (id === 'traveler' || options.ambient) {
        if (source.animations[0]) {
          const clip = source.animations[0].clone();
          clip.tracks = clip.tracks.filter((track) => !track.name.endsWith('.position'));
          walking = new T.AnimationMixer(body);
          walking.clipAction(clip).play();
        }
      }
      if (id === 'traveler') {
        pack = new T.Group();
        const backpack = new T.Mesh(
          new T.BoxGeometry(0.43, 0.56, 0.24),
          new T.MeshStandardMaterial({ color: '#d98a3d', roughness: 0.85 }),
        );
        backpack.position.set(0, 1.05, -0.29);
        pack.add(backpack);
        for (const x of [-0.2, 0.2]) {
          const strap = new T.Mesh(
            new T.BoxGeometry(0.055, 0.56, 0.09),
            new T.MeshStandardMaterial({ color: '#baab79', roughness: 1 }),
          );
          strap.position.set(x, 1.08, 0.14);
          pack.add(strap);
        }
        group.add(pack);
      } else if (options.ambient) {
        pack = new T.Group();
        const bag = new T.Mesh(
          new T.BoxGeometry(0.32, 0.35, 0.15),
          new T.MeshStandardMaterial({ color: '#c6aa77', roughness: 0.95 }),
        );
        bag.position.set(0.31, 0.73, 0.12);
        const strap = new T.Mesh(
          new T.BoxGeometry(0.045, 0.72, 0.04),
          new T.MeshStandardMaterial({ color: '#705b3d', roughness: 1 }),
        );
        strap.position.set(0.13, 1.1, 0.2);
        strap.rotation.z = -0.5;
        pack.add(bag, strap);
        group.add(pack);
      }
      if (!this.shadow) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const c = canvas.getContext('2d')!;
        const gradient = c.createRadialGradient(64, 64, 8, 64, 64, 60);
        gradient.addColorStop(0, 'rgba(10,17,21,.5)');
        gradient.addColorStop(1, 'rgba(10,17,21,0)');
        c.fillStyle = gradient;
        c.fillRect(0, 0, 128, 128);
        this.shadow = new T.CanvasTexture(canvas);
      }
      const shadow = new T.Mesh(
        new T.PlaneGeometry(1.5, 1.1),
        new T.MeshBasicMaterial({ map: this.shadow, transparent: true, depthWrite: false }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -0.045;
      group.add(shadow);
      fallback.visible = false;
      group.userData.appearanceReady = true;
      this.people.push({
        id,
        group,
        body,
        pose,
        phase: this.people.length,
        walking,
        pack,
        ambient: !!options.ambient,
      });
    } catch {
      group.userData.appearanceReady = false;
    }
  }
  update(dt: number, player: Point, reducedMotion: boolean, contact?: ActorId) {
    for (const person of this.people) {
      if (!person.group.visible) continue;
      if (person.walking && person.group.userData.walking && !reducedMotion) {
        const target = person.group.userData.walkFacing;
        if (person.ambient)
          person.body.rotation.y +=
            Math.atan2(Math.sin(target - person.body.rotation.y), Math.cos(target - person.body.rotation.y)) *
            (1 - Math.exp(-dt * 10));
        else person.body.rotation.y = target;
        person.walking.update(dt);
        if (person.ambient) person.group.userData.walkAnimationTime = person.walking.time;
        if (person.pack) person.pack.rotation.y = person.body.rotation.y;
        continue;
      }
      const dx = player.x - person.group.position.x;
      const dz = player.z - person.group.position.z;
      if (Math.hypot(dx, dz) < 4) {
        const target = Math.atan2(dx, dz);
        const delta = Math.atan2(
          Math.sin(target - person.body.rotation.y),
          Math.cos(target - person.body.rotation.y),
        );
        person.body.rotation.y += delta * (reducedMotion ? 1 : 1 - Math.exp(-dt * 7));
      }
      if (!reducedMotion) person.phase += dt;
      person.pose.update(person.phase, !person.ambient && contact === person.id, reducedMotion);
      if (person.pack) person.pack.rotation.y = person.body.rotation.y;
    }
  }
  snapshot() {
    return this.people
      .filter((p) => !p.ambient)
      .map(({ id, body }) => ({
        id,
        facing: body.rotation.y,
        head: body.getObjectByName('Head')?.quaternion.toArray(),
      }));
  }
  dispose() {
    this.disposed = true;
    this.shadow?.dispose();
    this.people.forEach((p) => {
      p.walking?.stopAllAction();
      p.walking?.uncacheRoot(p.body);
      p.body.traverse((o) => {
        if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
      });
    });
    // Scene clones share these resources; cleanup also handles a load finishing after unmount.
    this.sources.forEach((promise) => {
      void promise
        .then(({ scene }) => {
          scene.traverse((obj) => {
            if (obj instanceof T.Mesh) {
              obj.geometry.dispose();
              for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) {
                for (const value of Object.values(material)) if (value instanceof T.Texture) value.dispose();
                material.dispose();
              }
            }
          });
        })
        .catch(() => undefined);
    });
    this.sources.clear();
  }
}
