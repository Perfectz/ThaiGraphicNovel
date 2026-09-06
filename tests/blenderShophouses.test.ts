import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { placeShophouse } from '../src/bangkok/CityShophouses.ts';

async function load(name: string) {
  const bytes = readFileSync(`public/bangkok/models/${name}.glb`);
  return (
    await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene;
}
function vertices(root: T.Object3D) {
  root.updateWorldMatrix(true, true);
  const result: T.Vector3[] = [];
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      const p = o.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++)
        result.push(new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld));
    }
  });
  return result;
}
for (const name of ['sukhumvit-shophouse', 'yaowarat-shophouse']) {
  test(`${name}: exported geometry keeps door heights and collision boundaries at every district size`, async () => {
    const template = await load(name);
    const original = new T.Box3().setFromObject(template.getObjectByName('ShopLower')!);
    assert(original.max.y < 2.601 && original.min.y >= -0.001);
    for (const height of [5, 6, 7, 9, 11])
      for (const facing of [-1, 1]) {
        const root = placeShophouse(template, { x: 30, z: 5, w: 6, d: 4, height, facing });
        const low = vertices(root).filter((p) => p.y < 2.2);
        assert(low.length > 100);
        for (const p of low) {
          assert(p.x >= 29.99 && p.x <= 36.01, `collision x ${p.x}`);
          assert(p.z >= 4.99 && p.z <= 9.01, `collision z ${p.z}`);
        }
        const ground = new T.Box3().setFromObject(root.getObjectByName('ShopLower')!);
        assert(Math.abs(ground.max.y - original.max.y) < 0.001, 'ground-floor height never stretches');
        const upper = new T.Box3().setFromObject(root.getObjectByName('ShopUpper')!);
        assert(upper.min.y >= 2.54 && upper.max.y > height && upper.max.y < height + 1.5);
      }
    assert.equal(
      template.getObjectByName('ShopUpper')!.scale.y,
      1,
      'instances never mutate the cached template',
    );
  });
  test(`${name}: portable asset budget and editable source`, async () => {
    const template = await load(name);
    let triangles = 0;
    template.traverse((o) => {
      assert(!(o instanceof T.Light || o instanceof T.Camera));
      if (o instanceof T.Mesh) {
        const p = o.geometry.getAttribute('position');
        assert(Array.from(p.array).every(Number.isFinite));
        assert(o.geometry.getAttribute('normal'));
        triangles += (o.geometry.index?.count ?? p.count) / 3;
      }
    });
    assert(triangles > 5000 && triangles < 16000);
    assert(readFileSync(`public/bangkok/models/${name}.glb`).length < 1_000_000);
    assert(existsSync(`art/blender/${name}.blend`));
  });
}
