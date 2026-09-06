import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  foodStallCounter,
  foodStallOrigin,
  cityObstacles,
  inside,
  recoverCityPosition,
} from '../src/bangkok/city.ts';
import {
  freshAdventure,
  normalizeAdventure,
  walkable,
  findPath,
  followPath,
} from '../src/bangkok/adventure.ts';

async function model() {
  const bytes = readFileSync('public/bangkok/models/lek-food-stall.glb');
  assert(bytes.length < 800000);
  return (
    await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene;
}
test('the Blender cart stays in its solid footprint below head height and leaves the serving board clear', async () => {
  const root = await model();
  root.updateMatrixWorld(true);
  for (const name of ['Counter', 'Equipment', 'Canopy']) assert(root.getObjectByName(name));
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      const pos = o.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const p = new T.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        assert([p.x, p.y, p.z].every(Number.isFinite));
        if (p.y < 2.2)
          assert(
            inside({ x: p.x + foodStallOrigin.x, z: p.z + foodStallOrigin.z }, foodStallCounter),
            `outside counter: ${p.toArray()}`,
          );
        assert(
          !cityObstacles
            .filter((r) => r.kind === 'building')
            .some((r) => inside({ x: p.x + foodStallOrigin.x, z: p.z + foodStallOrigin.z }, r)),
          'cart stays in front of the shops',
        );
      }
    }
  });
  const top = new T.Box3().setFromObject(root.getObjectByName('Equipment')!);
  assert(top.max.x < -0.89, 'cooking gear stays left of the existing two-bowl serving board');
  const roof = new T.Box3().setFromObject(root.getObjectByName('Canopy')!);
  assert(roof.min.y >= 2.27 && roof.max.y < 2.9);
  assert(roof.min.x > -2.2 && roof.max.x < 2.1 && roof.min.z > -0.95 && roof.max.z < 0.95);
});
test('the cart export is portable and retains its editable source and bounded geometry budget', async () => {
  const root = await model();
  let triangles = 0;
  const materials = new Set<T.Material>();
  root.traverse((o) => {
    assert(!(o instanceof T.Light || o instanceof T.Camera));
    if (o instanceof T.Mesh) {
      assert(o.geometry.getAttribute('normal'));
      triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        assert(m instanceof T.MeshStandardMaterial);
        materials.add(m);
      }
    }
  });
  assert(triangles > 3000 && triangles < 16000);
  assert(materials.size <= 16);
  assert(existsSync('art/blender/lek-food-stall.blend'));
});
test('the counter blocks walking while the east passage connects Yaowarat and Old Town in both directions', () => {
  assert(!walkable(foodStallOrigin));
  for (const [a, b] of [
    [
      { x: 35, z: 16.5 },
      { x: 37, z: 25 },
    ],
    [
      { x: 37, z: 25 },
      { x: 35, z: 16.5 },
    ],
  ]) {
    const path = findPath(a, b);
    assert(path.length);
    assert(path.some((p) => p.x === 36.5 && p.z === 18));
    let p = a;
    for (let i = 0; i < 2000 && path.length; i++) {
      p = followPath(p, path, 0.07);
      assert(walkable(p));
    }
    assert.equal(path.length, 0);
    assert(Math.hypot(p.x - b.x, p.z - b.z) < 0.001);
  }
});
test('old saves inside the newly solid counter recover nearby without losing progress', () => {
  for (const position of [{ ...foodStallOrigin }, { x: 35.8, z: 17.8 }, { x: 33.4, z: 17.7 }]) {
    const recovered = recoverCityPosition(position);
    assert(recovered && walkable(recovered));
    assert(Math.hypot(recovered.x - position.x, recovered.z - position.z) < 1.5);
    const old = {
      ...freshAdventure(),
      position,
      flags: ['intro', 'innkeeper', 'cook'] as const,
      coins: 47,
      xp: 123,
      learned: ['hello'],
    };
    const save = normalizeAdventure(old);
    assert.deepEqual(save.position, recovered);
    assert.equal(save.coins, 47);
    assert.equal(save.xp, 123);
    assert.deepEqual(save.flags, old.flags);
    assert.deepEqual(save.learned, old.learned);
  }
  assert.equal(recoverCityPosition({ x: 36.5, z: 18 }), null);
});
