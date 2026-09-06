import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RiverSpirits } from '../src/bangkok/RiverSpirits.ts';
const read = async () => {
  const b = readFileSync('public/bangkok/models/river-spirits.glb');
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function enemies() {
  return new Map(
    ['main', 'echo'].map((id) => {
      const g = new T.Group(),
        body = new T.Group();
      g.add(body);
      g.userData.body = body;
      return [id, g];
    }),
  );
}
test('Blender spirits fit the existing battlefield and keep six useful motion pivots', async () => {
  assert(existsSync('art/blender/river-spirits.blend'));
  assert(readFileSync('public/bangkok/models/river-spirits.glb').length < 1400000);
  const { scene } = await read();
  scene.updateMatrixWorld(true);
  let tris = 0,
    meshes = 0;
  for (const [name, minY, maxY, r] of [
    ['RiverKeeper', 0.05, 4.0, 1.55],
    ['LanternEcho', 0.5, 2.6, 1.05],
    ['MurmurWisp', 0.4, 3.1, 1.2],
  ] as const) {
    const model = scene.getObjectByName(name)!;
    assert(model);
    const b = new T.Box3().setFromObject(model);
    assert(b.min.y > minY && b.max.y < maxY, `${name} height ${JSON.stringify(b)}`);
    assert(b.min.x > -r && b.max.x < r && b.min.z > -r && b.max.z < r, `${name} footprint`);
  }
  for (const [name, y, z] of [
    ['KeeperLeftArm', 2.29, -0.63],
    ['KeeperRightArm', 2.29, 0.63],
    ['KeeperHalo', 2.17, 0],
    ['EchoPetals', 1.5, 0],
    ['MurmurVeils',1.9,0],
    ['MurmurOrbit',1.9,0],
  ] as const) {
    const part = scene.getObjectByName(name)!;
    assert(part);
    assert(Math.abs(part.position.y - y) < 0.00001 && Math.abs(part.position.z - z) < 0.00001);
    assert.equal(part.rotation.x, 0);
  }
  scene.traverse((o) => {
    assert(!(o instanceof T.Camera || o instanceof T.Light));
    if (!(o instanceof T.Mesh)) return;
    meshes++;
    const p = o.geometry.getAttribute('position');
    assert(o.geometry.getAttribute('normal'));
    tris += (o.geometry.index?.count ?? p.count) / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      assert(m instanceof T.MeshStandardMaterial);
      assert(!m.map);
    }
    for (let i = 0; i < p.count; i++)
      assert(new T.Vector3().fromBufferAttribute(p, i).toArray().every(Number.isFinite));
  });
  assert(tris > 28000 && tris < 40000);
  assert(meshes <= 55, `material draw calls ${meshes}`);
});
test('loaded spirits replace only presentation and retain articulated attack and reduced-motion poses', async () => {
  const e = enemies(),
    old = [...e.values()].map((g) => g.userData.body);
  e.get('main')!.position.set(2.6, 0.1, 0.6);
  e.get('echo')!.position.set(0.1, 0.12, -3.1);
  const model = await read();
  const spirits = new RiverSpirits(e, () => Promise.resolve(model));
  await flush();
  assert.equal(spirits.state, 'ready');
  assert(old.every((g) => !g.visible));
  assert.deepEqual(e.get('main')!.position.toArray(), [2.6, 0.1, 0.6]);
  const body = e.get('main')!.userData.body as T.Object3D;
  assert.equal(body.name, 'RiverKeeper');
  spirits.update(4, false, 'main', 1);
  assert(body.getObjectByName('KeeperLeftArm')!.rotation.x > 0.3);
  const idle = spirits.snapshot();
  spirits.update(5, false, null, 0);
  assert.notDeepEqual(spirits.snapshot().parts, idle.parts);
  spirits.update(100, true, 'main', 1);
  const snapshot = spirits.snapshot();
  // No cinematic gesture, idle swing or spinning petals under reduced motion.
  assert(snapshot.parts.every((p) => p.rotation.every((v) => v === 0)));
  assert(snapshot.creatures.every((c) => c.blender));
  assert(!('hp' in snapshot), 'presentation owns no combat values');
});
test('missing or failed downloads keep original creatures available', async () => {
  for (const broken of [false, true]) {
    const e = enemies(),
      model = await read();
    model.scene.getObjectByName('KeeperLeftArm')!.removeFromParent();
    const spirits = new RiverSpirits(e, () =>
      broken ? Promise.reject(new Error('offline')) : Promise.resolve(model),
    );
    await flush();
    assert.equal(spirits.state, 'fallback');
    assert([...e.values()].every((g) => g.userData.body.visible && !g.userData.blenderSpirit));
  }
});
test('a download completing after teardown is released, never attached', async () => {
  const e = enemies(),
    model = await read();
  let disposed = 0;
  model.scene.traverse((o) => {
    if (o instanceof T.Mesh) o.geometry.addEventListener('dispose', () => disposed++);
  });
  let resolve!: (model: { scene: T.Group }) => void;
  const spirits = new RiverSpirits(e, () => new Promise((r) => (resolve = r)));
  spirits.dispose();
  resolve(model);
  await flush();
  assert(disposed > 0);
  assert([...e.values()].every((g) => g.children.length === 1));
});

test('Murmur identity survives a pending load and is shared with the world without sharing animation transforms', async()=>{
 const e=enemies(),world=new T.Group(),old=new T.Mesh(new T.SphereGeometry(.6),new T.MeshStandardMaterial());world.add(old);
 let resolve!:(model:{scene:T.Group})=>void;const spirits=new RiverSpirits(e,()=>new Promise(r=>resolve=r));
 spirits.bindWorldMurmur(world);spirits.setEncounter('murmur');assert.equal(e.get('main')!.userData.body.name,'MurmurFallback');
 resolve(await read());await flush();assert.equal(spirits.state,'ready');
 const combat=e.get('main')!.userData.body as T.Object3D,field=world.getObjectByName('LumphiniMurmur')!;
 assert.equal(combat.name,'MurmurWisp');assert(field);assert(!old.visible);assert.equal(field.position.y,-1.9);assert.equal(combat.position.y,0);
 spirits.updateWorld(3,false);const worldPose=field.getObjectByName('MurmurVeils')!.rotation.clone();spirits.update(4,false,'main',1);
 assert(field.getObjectByName('MurmurVeils')!.rotation.equals(worldPose));assert(!combat.getObjectByName('MurmurVeils')!.rotation.equals(worldPose));
 spirits.setEncounter('keeper');assert.equal(e.get('main')!.userData.body.name,'RiverKeeper');assert.equal(combat.visible,false);assert(field.visible);
 spirits.setEncounter('murmur');assert.equal(e.get('main')!.children.filter(c=>c.visible).length,1);
 spirits.update(50,true,'main',1);spirits.updateWorld(50,true);assert(spirits.snapshot().parts.every(p=>p.rotation.every(v=>v===0)));assert.equal(field.getObjectByName('MurmurVeils')!.rotation.x,0);
});

test('a failed model still presents a wisp for Murmur and a guardian for Keeper',async()=>{
 const e=enemies(),original=e.get('main')!.userData.body,spirits=new RiverSpirits(e,()=>Promise.reject(Error('offline')));
 spirits.setEncounter('murmur');await flush();assert.equal(spirits.state,'fallback');assert.equal(e.get('main')!.userData.body.name,'MurmurFallback');assert(!original.visible);
 spirits.setEncounter('keeper');assert.equal(e.get('main')!.userData.body,original);assert(original.visible);
 spirits.setEncounter('murmur');assert.equal(e.get('main')!.children.filter(c=>c.visible).length,1);
});
