import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CanalHouses, canalHouseParts } from '../src/bangkok/CanalHouses.ts';
import { canalHouses } from '../src/bangkok/thonburi.ts';
import { blocksCityView } from '../src/bangkok/cityVisibility.ts';
const read = async () => {
  const b = await readFile('public/bangkok/models/thonburi-canal-house.glb');
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
};
const flush = () => new Promise(r => setTimeout(r, 0));
function fixture() {
  const district = new T.Group();
  for (const site of canalHouses) {
    const g = new T.Group(); g.name = `thonburi-${site.id}-fallback`; district.add(g);
  }
  const cutaways: T.Object3D[] = [];
  return { district, cutaways };
}
test('the authored house stays inside every solid footprint below head height', async () => {
  const f = fixture(), model = await read();
  const pack = new CanalHouses(f.district, () => {}, o => f.cutaways.push(o), () => Promise.resolve(model));
  await flush(); assert.equal(pack.state, 'ready'); f.district.updateMatrixWorld(true);
  for (const site of canalHouses) {
    const house = pack.houses.get(site.id)!;
    for (const name of canalHouseParts) assert(house.getObjectByName(name));
    const bounds = new T.Box3().setFromObject(house);
    assert(bounds.min.y < -1 && bounds.max.y > 4.5 && bounds.max.y < 4.9);
    house.traverse(o => {
      if (!(o instanceof T.Mesh)) return;
      const a = o.geometry.getAttribute('position');
      for (let i = 0; i < a.count; i++) {
        const p = new T.Vector3().fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
        assert(p.toArray().every(Number.isFinite));
        if (p.y > 0 && p.y < 2.2) {
          assert(p.x >= site.x - .001 && p.x <= site.x + site.w + .001, `${site.id} X ${p.x}`);
          assert(p.z >= site.z - .001 && p.z <= site.z + site.d + .001, `${site.id} Z ${p.z}`);
        }
      }
    });
  }
});
test('the portable pack has normals, no studio objects and a bounded render cost', async () => {
  const { scene } = await read(); let triangles = 0, meshes = 0;
  scene.traverse(o => {
    assert(!(o instanceof T.Light || o instanceof T.Camera));
    if (o instanceof T.Mesh) {
      meshes++; triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
      assert(o.geometry.getAttribute('normal'));
    }
  });
  assert(triangles > 20000 && triangles < 42000); assert(meshes < 45);
  assert((await stat('public/bangkok/models/thonburi-canal-house.glb')).size < 2800000);
  assert((await stat('art/blender/thonburi-canal-house.blend')).size > 10000);
});
test('one template supplies four independent palettes and five separate cutaways per house', async () => {
  const f = fixture(), model = await read(); let batches = 0;
  const pack = new CanalHouses(f.district, () => batches++, o => f.cutaways.push(o), () => Promise.resolve(model));
  await flush(); assert.equal(batches, 6); assert.equal(f.cutaways.length, 20);
  const paints = new Set<T.Material>(), geometries = new Set<T.BufferGeometry>();
  for (const site of canalHouses) {
    const house = pack.houses.get(site.id)!; let paint: T.Material | undefined;
    assert.equal(f.district.getObjectByName(`thonburi-${site.id}-fallback`)!.visible, false);
    assert(house.userData.animated); assert.equal(house.scale.y, 1);
    house.traverse(o => {
      if (!(o instanceof T.Mesh)) return;
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (m instanceof T.MeshStandardMaterial && m.name === 'ShutterPaint') {
          assert.equal(`#${m.color.getHexString()}`, site.shutters); paint = m;
        }
    });
    assert(paint && !paints.has(paint)); paints.add(paint);
    assert(!f.cutaways.includes(house.getObjectByName('HouseBase')!));
    house.getObjectByName('HouseRoof')!.visible = false;
    assert(house.getObjectByName('HouseFront')!.visible);
  }
  assert(geometries.size < 45, 'clones share geometry');
});
test('a roof crossing the camera ray does not erase the facade behind the party', async () => {
  const f = fixture(), model = await read();
  const pack = new CanalHouses(f.district, () => {}, o => f.cutaways.push(o), () => Promise.resolve(model));
  await flush(); f.district.updateMatrixWorld(true);
  const blue = pack.houses.get('blue')!;
  const front = new T.Box3().setFromObject(blue.getObjectByName('HouseFront')!);
  const roof = new T.Box3().setFromObject(blue.getObjectByName('HouseRoof')!);
  // Camera sits above the house; a contact outside its front wall stays visible by removing only the roof.
  const camera = { x: 3, y: 7, z: -72 }, party = { x: 3, y: 1.2, z: -68.5 };
  assert(blocksCityView(roof, camera, party));
  assert(!blocksCityView(front, camera, party));
});
test('missing assets keep the houses playable and a late load is disposed without attaching', async () => {
  for (const load of [() => Promise.reject(Error('offline')), () => Promise.resolve({ scene: new T.Group() })]) {
    const f = fixture(), pack = new CanalHouses(f.district, () => {}, () => {}, load);
    await flush(); assert.equal(pack.state, 'fallback'); assert(f.district.children.every(o => o.visible));
  }
  const f = fixture(), model = await read(); let releases = 0;
  model.scene.traverse(o => { if (o instanceof T.Mesh) o.geometry.addEventListener('dispose', () => releases++); });
  let resolve!: (v: { scene: T.Group }) => void;
  const pack = new CanalHouses(f.district, () => {}, () => {}, () => new Promise(done => resolve = done));
  pack.dispose(); resolve(model); await flush();
  assert(releases > 0); assert.equal(f.district.children.length, 4); assert.equal(pack.houses.size, 0);
});
