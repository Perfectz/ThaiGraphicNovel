import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { riverBoatPose, mooredBoatOrigin } from '../src/bangkok/RiverBoats.ts';
import {
  walkable,
  findPath,
  followPath,
  freshAdventure,
  moveAdventure,
  normalizeAdventure,
} from '../src/bangkok/adventure.ts';
import { cityAreaAt } from '../src/bangkok/city.ts';

test('Blender longtail exports portable bounded geometry clear of the pier and courtyard', async () => {
  const b = readFileSync('public/bangkok/models/river-longtail.glb');
  assert(b.length < 1200000);
  const { scene } = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
  for (const n of ['Hull', 'PassengerCabin', 'LongtailEngine']) assert(scene.getObjectByName(n));
  assert(existsSync('art/blender/river-longtail.blend'));
  scene.position.set(mooredBoatOrigin.x, mooredBoatOrigin.y, mooredBoatOrigin.z);
  scene.updateMatrixWorld(true);
  let triangles = 0;
  const materials = new Set();
  scene.traverse((o) => {
    assert(!(o instanceof T.Camera || o instanceof T.Light));
    if (!(o instanceof T.Mesh)) return;
    assert(o.geometry.getAttribute('normal'));
    triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      assert(m instanceof T.MeshStandardMaterial);
      assert(!m.map);
      materials.add(m);
    }
    const pos = o.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const p = new T.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      assert(p.toArray().every(Number.isFinite));
      assert(p.z < -11.9, 'boat stays in water beyond the pier deck');
      assert(!walkable({ x: p.x, z: p.z }), 'geometry never enters walkable ground');
    }
  });
  assert(triangles > 5000 && triangles < 30000);
  assert(materials.size <= 14);
  const hull = new T.Box3().setFromObject(scene.getObjectByName('Hull')!);
  const cabin = new T.Box3().setFromObject(scene.getObjectByName('Canopy')!);
  assert(hull.min.y < -0.7 && hull.max.y > 0.5, 'hull straddles water surface with raised bow');
  assert(cabin.max.y > 1.4 && cabin.max.y < 1.6);
  assert(findPath({ x: 1, z: -5.5 }, { x: 1, z: -10.5 }).length, 'pier remains reachable');
});
test('river traffic travels forward and reduced motion fixes both boats in a safe pose', () => {
  for (let i = 0; i < 210; i++) {
    const a = riverBoatPose(i, false),
      b = riverBoatPose(i + 0.1, false);
    assert(b.x > a.x);
    assert.equal(a.z, -20);
    assert(Math.abs(a.y + 0.6) <= 0.026 && Math.abs(a.roll) <= 0.013);
    for (const moored of [false, true])
      assert.deepEqual(riverBoatPose(i, moored, true), riverBoatPose(0, moored, true));
    const p = riverBoatPose(i, true);
    assert.equal(p.x, -1);
    assert.equal(p.z, -13);
    assert(Math.abs(p.y + 0.6) <= 0.019);
  }
});
test('the timber pier is reachable in both directions, bounded by water, and survives reload', () => {
  for (const [a, b] of [
    [
      { x: 1, z: -5.5 },
      { x: 1, z: -11 },
    ],
    [
      { x: 1, z: -11 },
      { x: 1, z: -5.5 },
    ],
  ]) {
    const path = findPath(a, b);
    assert(path.length);
    let p = a;
    for (let i = 0; i < 1500 && path.length; i++) {
      p = followPath(p, path, 0.07);
      assert(walkable(p));
    }
    assert.equal(path.length, 0);
    assert.deepEqual(p, b);
    const s = moveAdventure(freshAdventure(), p);
    assert.deepEqual(normalizeAdventure(s), s);
    assert.equal(cityAreaAt(p), 'riverside');
  }
  for (const p of [
    { x: 1, z: -11.5 },
    { x: -0.5, z: -9 },
    { x: 2.5, z: -9 },
    { x: 4, z: -10 },
  ])
    assert(!walkable(p));
});
