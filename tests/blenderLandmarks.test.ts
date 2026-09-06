import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

async function model(name: string) {
  const data = readFileSync(`public/bangkok/models/${name}.glb`);
  return (await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')).scene;
}
function vertices(root: T.Object3D) {
  root.updateWorldMatrix(true, true); const result: T.Vector3[] = [];
  root.traverse(o => { if (o instanceof T.Mesh) { const p = o.geometry.getAttribute('position'); for (let i=0;i<p.count;i++) result.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld)); } });
  return result;
}
test('the Blender hall export retains its collision footprint, roof clearance and structural cutaways', async () => {
  const root = await model('oldtown-hall');
  for (const name of ['HallBase','HallWalls','HallRoof']) assert(root.getObjectByName(name), name);
  const low = vertices(root).filter(p => p.y < 2.2);
  assert(low.length > 100);
  for (const p of low) { assert(Math.abs(p.x) <= 4.001, `low x ${p.x}`); assert(Math.abs(p.z) <= 2.501, `low z ${p.z}`); assert(p.y >= -.001); }
  const roof = new T.Box3().setFromObject(root.getObjectByName('HallRoof')!);
  assert(roof.min.y >= 2.9 && roof.max.y < 6.6); assert(roof.min.x > -4.8 && roof.max.x < 4.8); assert(roof.min.z > -3.2 && roof.max.z < 3.2);
});
test('the open pavilion keeps its deck and existing four post positions, with overhead braces', async () => {
  const root = await model('lumphini-pavilion');
  const deck = new T.Box3().setFromObject(root.getObjectByName('PavilionBase')!);
  assert(deck.min.x >= -1.501 && deck.max.x <= 1.501 && deck.min.z >= -1.201 && deck.max.z <= 1.201); assert(deck.max.y <= .261);
  const supports = vertices(root.getObjectByName('PavilionSupports')!);
  for (const p of supports) assert([[-1.5,-1],[-1.5,1],[1.5,-1],[1.5,1]].some(([x,z]) => Math.hypot(p.x-x,p.z-z) < .10), 'supports remain in existing post footprints');
  const roof = new T.Box3().setFromObject(root.getObjectByName('PavilionRoof')!); assert(roof.min.y >= 2.19);
});
test('game exports contain finite renderable geometry and portable materials, with editable Blender sources', async () => {
  for (const [name, triangleLimit] of [['oldtown-hall',60000],['lumphini-pavilion',15000]] as const) {
    const root = await model(name); let triangles=0, lights=0;
    const materials=new Set<T.Material>();
    root.traverse(o => {
      if (o instanceof T.Light || o instanceof T.Camera) lights++;
      if (o instanceof T.Mesh) {
        const p=o.geometry.getAttribute('position'); assert(Array.from(p.array).every(Number.isFinite));
        assert(o.geometry.getAttribute('normal')); triangles+=(o.geometry.index?.count ?? p.count)/3;
        for(const mat of Array.isArray(o.material) ? o.material : [o.material]) { assert(mat instanceof T.MeshStandardMaterial); materials.add(mat); }
      }
    });
    assert.equal(lights,0,'studio lights and cameras must not enter the game'); assert(triangles > 1000 && triangles < triangleLimit);
    assert(materials.size < 24); assert(existsSync(`art/blender/${name}.blend`));
    assert(readFileSync(`public/bangkok/models/${name}.glb`).length < 3_000_000);
  }
});
